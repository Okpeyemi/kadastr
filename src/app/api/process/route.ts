import { NextRequest, NextResponse } from "next/server"
import path from "path"
import { mkdir, writeFile } from "fs/promises"

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    console.log("ok")
    if (!url || typeof url !== "string") {
      return NextResponse.json({ ok: false, error: "Paramètre 'url' manquant." }, { status: 400 })
    }

    const absUrl = new URL(url, req.nextUrl.origin).href
    const fileRes = await fetch(absUrl, { cache: "no-store" })
    if (!fileRes.ok) {
      return NextResponse.json({ ok: false, error: `Échec du téléchargement (${fileRes.status}).` }, { status: 400 })
    }
    const ct = fileRes.headers.get("content-type") || "application/octet-stream"
    const buf = Buffer.from(await fileRes.arrayBuffer())
    const dataUrl = `data:${ct};base64,${buf.toString("base64")}`

    // Appel OpenRouter
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY || ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-exp:free",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Extract a table of Parcelle, X, Y coordinates from this image in CSV format." },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    })

    if (!resp.ok) {
      const t = await resp.text().catch(() => "")
      return NextResponse.json({ ok: false, error: `OpenRouter: ${resp.status}`, details: t }, { status: 502 })
    }
    const json = await resp.json()
    const aiText = json?.choices?.[0]?.message?.content || ""

    // Parse lignes: B1,427094.70,712773.67
    const matches = Array.from(aiText.matchAll(/(B\d+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/g))
    const rows = matches.map(m => [m[1], m[2], m[3]])
    const csvText = ["Parcelle,X,Y", ...rows.map(r => r.join(","))].join("\n")

    // Sauvegarde CSV en dev local uniquement
    let csvUrl: string | null = null
    try {
      if (!process.env.VERCEL) {
        const baseName = path.basename(new URL(absUrl).pathname).replace(/\.[^.]+$/, "")
        const uploadDir = path.join(process.cwd(), "public", "uploads")
        await mkdir(uploadDir, { recursive: true })
        const csvPath = path.join(uploadDir, `${baseName}.csv`)
        await writeFile(csvPath, csvText, "utf8")
        console.log("ok")
        csvUrl = `/uploads/${baseName}.csv`
      }
    } catch {
      /* ignore write error in prod */
    }

    return NextResponse.json({ ok: true, text: aiText, rows, csvText, csvUrl })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Erreur serveur." }, { status: 500 })
  }
}