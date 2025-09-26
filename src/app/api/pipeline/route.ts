import { NextRequest, NextResponse } from "next/server"
import { spawn } from "child_process"
import path from "path"
import { mkdir, readFile, unlink, writeFile, stat } from "fs/promises"

export const runtime = "nodejs"

export async function POST(_req: NextRequest) {
  if (process.env.VERCEL) {
    return NextResponse.json({ ok: false, error: "pipeline_disabled_in_prod" }, { status: 501 })
  }

  try {
    const cwd = process.cwd()
    const script = path.join(cwd, "pipeline.js")
    const cacheDir = path.join(cwd, ".cache")
    const lockPath = path.join(cacheDir, "pipeline.lock")

    await mkdir(cacheDir, { recursive: true })

    // lock: éviter plusieurs exécutions concurrentes
    try {
      const data = await readFile(lockPath, "utf8").catch(() => null)
      if (data) {
        const j = JSON.parse(data)
        if (j?.pid && (await isProcessAlive(Number(j.pid)))) {
          return NextResponse.json({ ok: true, alreadyRunning: true, pid: j.pid, startedAt: j.startedAt })
        }
        // ancien lock mort → cleanup
        await unlink(lockPath).catch(() => {})
      }
    } catch {
      // ignore
    }

    // Vérifie que le fichier existe (optionnel)
    await stat(script)

    const child = spawn(process.execPath, [script], {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    })

    // log dans la console serveur pour debug
    child.stdout?.on("data", (d) => console.log(`[pipeline] ${String(d).trimEnd()}`))
    child.stderr?.on("data", (d) => console.error(`[pipeline] ${String(d).trimEnd()}`))

    // écrit le lock
    const payload = { pid: child.pid, startedAt: Date.now() }
    await writeFile(lockPath, JSON.stringify(payload), "utf8")

    // enlève le lock à la fin
    child.on("close", async () => {
      try { await unlink(lockPath) } catch {}
      console.log(`[pipeline] process ${child.pid} terminé`)
    })

    return NextResponse.json({ ok: true, pid: child.pid, script })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erreur serveur"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}