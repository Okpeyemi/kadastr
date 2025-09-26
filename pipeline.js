import fs from 'fs';
import fse from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import * as turf from '@turf/turf';
import proj4 from 'proj4';
import Papa from 'papaparse';
import pLimit from 'p-limit';
import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config';

// -------------------------
// Configs
// -------------------------
const API_KEYS = [
  'AIzaSyCG9tFOViF-ALLxkW7wZo2zNVeACTXL38g',

];

const GEOJSON_FILES = [
  'aif.geojson', 'air_proteges.geojson', 'dpl.geojson', 'dpm.geojson',
  'enregistrement individuel.geojson', 'litige.geojson', 'parcelles.geojson',
  'restriction.geojson', 'tf_demembres.geojson', 'tf_en_cours.geojson',
  'tf_etat.geojson', 'titre_reconstitue.geojson', 'zone_inondable.geojson'
];

const CURRENT = path.resolve('.');
const CACHE_DIR = path.join(CURRENT, '.cache');
fse.ensureDirSync(CACHE_DIR);

// -------------------------
// Gemini Initialization
// -------------------------
let geminiClients = [];
function initGemini() {
  if (!API_KEYS.every(key => key)) throw new Error('Set GOOGLE_API_KEY in your environment.');
  geminiClients = API_KEYS.map(key => new GoogleGenerativeAI(key));
  console.log(`Initialized ${geminiClients.length} Gemini clients`);
}

// -------------------------
// Caching System
// -------------------------
function md5File(filePath) {
  try {
    const data = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(data).digest('hex');
  } catch (e) {
    console.warn(`Failed to hash ${filePath}: ${e.message}`);
    return null;
  }
}

function cachePathFor(file) {
  return path.join(CACHE_DIR, `${path.basename(file, path.extname(file))}_cache.json`);
}

function loadCacheIfValid(filePath) {
  const cachePath = cachePathFor(filePath);
  if (!fs.existsSync(cachePath)) return null;
  try {
    const content = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    const currentHash = md5File(filePath);
    if (content.file_hash === currentHash) return content;
    return null;
  } catch (e) {
    console.warn(`Failed to load cache for ${filePath}: ${e.message}`);
    return null;
  }
}

function saveCache(filePath, payload) {
  try {
    const cachePath = cachePathFor(filePath);
    fs.writeFileSync(cachePath, JSON.stringify(payload));
    console.log(`Cached ${filePath}`);
  } catch (e) {
    console.warn(`Failed to save cache for ${filePath}: ${e.message}`);
  }
}

// -------------------------
// Load GeoJSON
// -------------------------
async function loadGeoJSONLayers() {
  const layers = {};
  for (const fname of GEOJSON_FILES) {
    const filePath = path.join(CURRENT, 'data', 'couche', fname);
    if (!fs.existsSync(filePath)) {
      console.warn(`GeoJSON not found: ${filePath} -> layer will be empty`);
      layers[fname] = null;
      continue;
    }
    const tryCache = loadCacheIfValid(filePath);
    if (tryCache) {
      layers[fname] = tryCache.geojson;
      console.log(`Loaded ${fname} from cache (${tryCache.featureCount} features)`);
      continue;
    }
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const geojson = JSON.parse(raw);
      const featureCount = (geojson.features?.length) || 0;
      saveCache(filePath, { file_hash: md5File(filePath), timestamp: Date.now(), featureCount, geojson });
      console.log(`Loaded ${fname} (${featureCount} features)`);
      layers[fname] = geojson;
    } catch (e) {
      console.warn(`Failed to parse GeoJSON ${fname}: ${e.message}`);
      layers[fname] = null;
    }
  }
  return layers;
}

// -------------------------
// R-Tree Index for Fast Lookup
// -------------------------
class LayerIndex {
  constructor(layerGeoJSON) {
    this.items = [];
    if (!layerGeoJSON?.features) return;
    layerGeoJSON.features.forEach(feat => {
      if (!feat.geometry) return;
      const bbox = turf.bbox(feat);
      this.items.push({ bbox, feat });
    });
  }

  intersectsPoint(x, y) {
    for (const { bbox, feat } of this.items) {
      if (!(x < bbox[0] || x > bbox[2] || y < bbox[1] || y > bbox[3])) {
        if (turf.booleanPointInPolygon(turf.point([x, y]), feat)) return true;
      }
    }
    return false;
  }

  intersectsPolygon(poly) {
    for (const { bbox, feat } of this.items) {
      if (!turf.booleanDisjoint(poly, feat)) return true;
    }
    return false;
  }
}

// -------------------------
// Image Encoding
// -------------------------
async function encodeImageToBase64(imagePath) {
  try {
    const buf = await sharp(imagePath)
      .resize({ width: 2048, height: 2048, fit: 'inside' })
      .jpeg({ quality: 90 })
      .toBuffer();
    return buf.toString('base64');
  } catch (e) {
    console.warn(`encodeImageToBase64 failed for ${imagePath}: ${e.message}`);
    return null;
  }
}

// -------------------------
// Polygon Helpers
// -------------------------
function createPolygonFromCoords(coords) {
  if (!coords || coords.length < 3) return null;
  let pts = coords.map(c => [Number(c.x), Number(c.y)]).filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]));
  if (pts.length < 3) return null;
  if (pts[0][0] !== pts[pts.length - 1][0] || pts[0][1] !== pts[pts.length - 1][1]) pts.push(pts[0]);
  try {
    const poly = turf.polygon([pts]);
    if (turf.area(poly) < 0.1) return null;
    return poly;
  } catch {
    return null;
  }
}

// -------------------------
// Gemini Call
// -------------------------
async function callGeminiWithImage(base64Image, promptText, imagePath, keyIndex = 0, retries = 3) {
  const client = geminiClients[keyIndex];
  if (!client) throw new Error('Gemini client not initialized.');

  const modelName = 'gemini-2.0-flash-exp';
  const model = client.getGenerativeModel({ model: modelName });

  const content = [
    promptText,
    { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
  ];

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await model.generateContent(content);
      const response = await result.response;
      let text = await response.text();
      if (text.startsWith('```')) text = text.split('\n').slice(1).join('\n');
      if (text.endsWith('```')) text = text.split('\n').slice(0, -1).join('\n');
      return text.trim() || '[]';
    } catch (e) {
      if (attempt === retries) return '[]';
      await new Promise(r => setTimeout(r, 200 * attempt));
    }
  }
  return '[]';
}

// -------------------------
// Process Single Image
// -------------------------
async function processSingleImage(imagePath, keyIndex = 0) {
  console.log(`Processing image: ${imagePath}`);
  const encoded = await encodeImageToBase64(imagePath);
  if (!encoded) {
    console.warn(`Image encoding failed for ${imagePath}`);
    return { success: false, polygons: [], error: 'encode_failed', imagePath };
  }

  const promptText = `
Extract all tables of Parcelle, X, Y coordinates from this image in JSON format.
- Keep the table name as a header above each table.
- Ensure that the columns are always in order: Parcelle (or Point/Bornes), X, Y.
- If the image provides Y first and X second, swap the values so that X comes first and Y second.
- Include all rows of coordinates exactly as they appear after normalization.
- Make sure to extract ALL coordinate tables visible in the image.
- Output ONLY the JSON array, no markdown or extra text.

Output format:
[
  {
    "table_name": "string",
    "coordinates": [
      {"point": "string", "x": number, "y": number},
      ...
    ]
  },
  ...
]
`;

  let textResponse;
  try {
    textResponse = await callGeminiWithImage(encoded, promptText, imagePath, keyIndex);
  } catch (e) {
    console.warn(`Gemini call failed for ${imagePath}: ${e.message}`);
    return { success: false, polygons: [], error: 'gemini_failed', imagePath };
  }

  console.log(`---LLM raw response for ${imagePath}:\n${textResponse.slice(0, 1000)}\n---end of response---`);

  // Parse the response
  let parsed = [];
  try {
    parsed = JSON.parse(textResponse);
    if (!Array.isArray(parsed)) parsed = [];
  } catch (e) {
    console.warn(`JSON parse failed for ${imagePath}: ${e.message}`);
    const first = textResponse.indexOf('[');
    const last = textResponse.lastIndexOf(']');
    if (first !== -1 && last !== -1) {
      try {
        parsed = JSON.parse(textResponse.slice(first, last + 1));
      } catch {
        console.warn(`Fallback JSON parse failed for ${imagePath}`);
        parsed = [];
      }
    }
  }

  const validated = [];
  for (const table of parsed) {
    // Normalize: coordinates might be under 'coordinates' or 'table'
    const rawCoords = table.coordinates || table.table || [];
    
    const coords = rawCoords.map(c => {
      return {
        point: c.point || c.Marnes || c.Bornes || '',
        x: Number(c.X || c.x),
        y: Number(c.Y || c.y),
      };
    }).filter(c => Number.isFinite(c.x) && Number.isFinite(c.y));

    if (coords.length) {
      validated.push({
        table_name: table.table_name || 'Table',
        coordinates: coords
      });
      console.log(`Validated table for ${imagePath}: ${JSON.stringify(coords, null, 2)}`);
    }
  }

  // Create polygons for intersection
  const validPolys = validated.map(table => createPolygonFromCoords(table.coordinates)).filter(p => p);

  console.log(`Total polygons created for ${imagePath}: ${validPolys.length}`);

  return { success: true, polygons: validated, error: null, imagePath };
}


// -------------------------
// Main Processing
// -------------------------
async function processImagesAndCreateCSV() {
  const startTime = Date.now();
  const layers = await loadGeoJSONLayers();

  const layerIndexes = {};
  for (const file of GEOJSON_FILES) {
    if (!layers[file]) continue;
    layerIndexes[file] = new LayerIndex(layers[file]);
  }

  let imageDir = path.join(CURRENT, 'data', 'Test');
  if (!fs.existsSync(imageDir)) imageDir = path.join(CURRENT, 'data', 'Training Data');

  const imageFiles = fs.readdirSync(imageDir).filter(f => ['.jpg','.jpeg','.png','.tif'].includes(path.extname(f).toLowerCase()));

  const limit = pLimit(Math.min(API_KEYS.length, 4));
  const tasks = imageFiles.map((img, idx) => limit(() => processSingleImage(path.join(imageDir, img), idx % API_KEYS.length)));

  const results = await Promise.allSettled(tasks);

  const csvRows = [];
  for (let idx = 0; idx < results.length; idx++) {
    const resObj = results[idx];
    const imageName = imageFiles[idx];
    const row = { 'Nom_du_levé': imageName, 'Coordonnées': '' };
    for (const name of GEOJSON_FILES.map(f => path.basename(f, '.geojson'))) row[name] = 'NON';

    if (resObj.status !== 'fulfilled') { csvRows.push(row); continue; }
    const res = resObj.value;
    if (!res.success) { csvRows.push(row); continue; }

    const allCoords = [];
    const polygons = [];
    for (const table of res.polygons) {
      allCoords.push(...table.coordinates);
      const poly = createPolygonFromCoords(table.coordinates);
      if (poly) polygons.push(poly);
    }

    row['Coordonnées'] = JSON.stringify(allCoords.map(c => ({ x: c.x, y: c.y })));

    for (const geojsonFile of GEOJSON_FILES) {
      const index = layerIndexes[geojsonFile];
      if (!index) continue;
      row[path.basename(geojsonFile, '.geojson')] = polygons.some(poly => index.intersectsPolygon(poly)) ? 'OUI' : 'NON';
    }

    csvRows.push(row);
  }

  const header = ['Nom_du_levé', 'Coordonnées', ...GEOJSON_FILES.map(f => path.basename(f, '.geojson'))];
  const csv = Papa.unparse(csvRows, { header: true, columns: header, delimiter: ';' });

  const outPath = path.join(CURRENT, 'results.csv');
  fs.writeFileSync(outPath, csv, { encoding: 'utf8' });
  console.log(`Results saved to ${outPath} (${csvRows.length} rows)`);
  console.log(`Processing completed in ${(Date.now() - startTime)/1000}s`);

  return outPath;
}

// -------------------------
// Run Everything
// -------------------------
(async () => {
  try {
    console.log('Starting JS geospatial pipeline...');
    initGemini();
    await processImagesAndCreateCSV();
    console.log('Processing completed successfully!');
  } catch (e) {
    console.error('Fatal error:', e);
    process.exit(1);
  }
})();