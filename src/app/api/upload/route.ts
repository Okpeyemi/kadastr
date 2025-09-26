export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { mkdir, writeFile } from "fs/promises"
import path from "path"
import { put } from "@vercel/blob"

const MAX_SIZE = 10 * 1024 * 1024

type ProcessResponse = {
  ok: boolean
  text?: string
  rows?: string[][]
  csvText?: string
  csvUrl?: string | null
  error?: string
}

type PipelineResponse = {
  ok: boolean
  alreadyRunning?: boolean
  pid?: number
  error?: string
}

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

    let url: string

    if (process.env.VERCEL) {
      // Prod: Vercel Blob (persistant)
      const base = path
        .basename(file.name, path.extname(file.name))
        .replace(/[^a-z0-9_-]/gi, "_")
        .slice(0, 60) || "file"
      const ext = path.extname(file.name) || (file.type === "application/pdf" ? ".pdf" : "")
      const filename = `${base}-${Date.now()}${ext}`

      const res = await put(filename, file.stream(), {
        access: "public",
        contentType: file.type || "application/octet-stream",
      })
      url = res.url
    } else {
      // Dev: sauvegarde locale dans public/uploads (existant)
      const uploadDir = path.join(process.cwd(), "public", "uploads")
      await mkdir(uploadDir, { recursive: true })
      const base = path
        .basename(file.name, path.extname(file.name))
        .replace(/[^a-z0-9_-]/gi, "_")
        .slice(0, 60) || "file"
      const ext = path.extname(file.name) || (file.type === "application/pdf" ? ".pdf" : "")
      const filename = `${base}-${Date.now()}${ext}`
      const filepath = path.join(uploadDir, filename)
      await writeFile(filepath, Buffer.from(bytes))
      url = `/uploads/${filename}`
    }

    // Déclenchement du traitement
    const origin = req.nextUrl.origin
    let analysis: ProcessResponse | null = null
    try {
      const proc = await fetch(`${origin}/api/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: new URL(url, origin).href }),
      })
      analysis = await proc.json().catch(() => null) as ProcessResponse | null
    } catch { /* ignore */ }

    // Démarrage pipeline
    let pipeline: PipelineResponse | null = null
    if (!process.env.VERCEL) {
      try {
        const pRes = await fetch(`${origin}/api/pipeline`, { method: "POST", cache: "no-store" })
        pipeline = await pRes.json().catch(() => ({} as PipelineResponse))
      } catch {
        pipeline = { ok: false, error: "pipeline_disabled_in_prod" }
      }
    } else {
      pipeline = { ok: false, error: "pipeline_disabled_in_prod" }
    }

    return NextResponse.json({ ok: true, url, analysis, pipeline })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erreur serveur."
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}