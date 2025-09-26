import { NextRequest, NextResponse } from "next/server"
import { spawn } from "child_process"
import path from "path"
import { mkdir, readFile, unlink, writeFile, stat } from "fs/promises"

export const runtime = "nodejs"

// Helper: vérifie si un PID est vivant (cross-platform)
async function isProcessAlive(pid: number): Promise<boolean> {
  if (!pid || !Number.isFinite(pid)) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (e: any) {
    const code = e && (e.code || e.errno)
    if (code === "EPERM") return true // existe mais pas les permissions
    return false // ESRCH: n'existe pas
  }
}

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
        await unlink(lockPath).catch(() => {})
      }
    } catch {
      // ignore
    }

    await stat(script)

    const child = spawn(process.execPath, [script], {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    })

    child.stdout?.on("data", (d) => console.log(`[pipeline] ${String(d).trimEnd()}`))
    child.stderr?.on("data", (d) => console.error(`[pipeline] ${String(d).trimEnd()}`))

    const payload = { pid: child.pid, startedAt: Date.now() }
    await writeFile(lockPath, JSON.stringify(payload), "utf8")

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