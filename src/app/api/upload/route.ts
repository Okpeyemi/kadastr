import { NextRequest, NextResponse } from "next/server"
import { mkdir, writeFile } from "fs/promises"
import path from "path"

const MAX_SIZE = 10 * 1024 * 1024

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    if (!file) return NextResponse.json({ ok: false, error: "Fichier manquant." }, { status: 400 })
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      return NextResponse.json({ ok: false, error: "Format invalide." }, { status: 400 })
    }
    const bytes = await file.arrayBuffer()
    if (bytes.byteLength > MAX_SIZE) {
      return NextResponse.json({ ok: false, error: "Fichier trop volumineux (10MB max)." }, { status: 413 })
    }

    // Dev: sauvegarde locale
    const uploadDir = path.join(process.cwd(), "public", "uploads")
    await mkdir(uploadDir, { recursive: true })
    const base = path.basename(file.name, path.extname(file.name)).replace(/[^a-z0-9_-]/gi, "_").slice(0, 60) || "file"
    const ext = path.extname(file.name) || (file.type === "application/pdf" ? ".pdf" : "")
    const filename = `${base}-${Date.now()}${ext}`
    const filepath = path.join(uploadDir, filename)
    await writeFile(filepath, Buffer.from(bytes))
    const url = `/uploads/${filename}`

    // Déclenchement du traitement
    const origin = req.nextUrl.origin
    let analysis: any = null
    try {
      const proc = await fetch(`${origin}/api/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: new URL(url, origin).href }),
      })
      analysis = await proc.json().catch(() => null)
    } catch { /* ignore */ }

    return NextResponse.json({ ok: true, url, analysis })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Erreur serveur." }, { status: 500 })
  }
}