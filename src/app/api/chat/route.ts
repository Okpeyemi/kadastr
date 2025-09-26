import { NextRequest, NextResponse } from "next/server"
import { generateAnswer, type ChatSourceMeta } from "@/lib/gemini"
import { searchWeb } from "@/lib/websearch"

// Heuristique simple pour détecter une réponse incertaine
function isUncertain(text: string | undefined): boolean {
  const t = (text || "").trim()
  if (!t) return true
  const short = t.replace(/\s+/g, " ").length < 120
  const patterns = [
    /je ne sais pas/i,
    /je ne suis pas (s[uû]r|certain)/i,
    /je n[’']ai pas cette information/i,
    /information (non disponible|indisponible)/i,
    /je ne peux pas/i,
    /je ne dispose pas/i,
    /pas (assez|suffisamment) d'?informations?/i,
    /malheureusement/i,
    /désol[ée]/i,
    /je ne suis pas en mesure/i,
    /\?\?/
  ]
  const doubtful = patterns.some((r) => r.test(t))
  return short || doubtful
}

function classifyStatus(text: string): "ok" | "warn" | "error" {
  const t = (text || "").toLowerCase()
  if (/(litige|inondable|restriction|dpl|dpm|inconstructible|non conforme|danger|interdit|majeur)/.test(t)) return "error"
  if (/(chevauchement|proximité|attention|alerte|risque|conflit)/.test(t)) return "warn"
  if (/(aucun conflit|aucune alerte|conforme|pas de conflit|aucun chevauchement)/.test(t)) return "ok"
  return "warn"
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ ok: false, error: "GEMINI_API_KEY manquant." }, { status: 500 })
    }

    const { question, context = [], history = [], useWeb = true }: {
      question?: string
      context?: Array<{ content: string; metadata?: ChatSourceMeta }>
      history?: Array<{ role: "user" | "ai"; content: string }>
      useWeb?: boolean
    } = await req.json()

    if (!question || typeof question !== "string") {
      return NextResponse.json({ ok: false, error: "Paramètre 'question' manquant." }, { status: 400 })
    }

    // 1) Réponse primaire
    let mergedContext = Array.isArray(context) ? context : []
    const primary = await generateAnswer(
      question,
      mergedContext,
      Array.isArray(history) ? history : []
    )

    // 2) Option web si nécessaire
    let usedWeb = false
    let secondary: string | undefined
    let finalText = primary
    if (useWeb || isUncertain(primary)) {
      try {
        const web = await searchWeb(question, 5)
        if (web && web.length) {
          const webCtx = web.map(w => ({
            content: `${w.title ? w.title + "\n" : ""}${w.content}`,
            metadata: { titre: w.title, url: w.url, source: "web" as const },
          }))
          mergedContext = [...webCtx, ...mergedContext]
          secondary = await generateAnswer(
            question,
            mergedContext,
            Array.isArray(history) ? history : []
          )
          if (secondary && secondary.trim().length > 0 && !isUncertain(secondary)) {
            usedWeb = true
            finalText = secondary
          }
        }
      } catch { /* ignore */ }
    }

    // 3) Classification par Gemini (unique token)
    const statusPrompt = [
      "Lis le résumé ci-dessous et classe la situation en un seul mot parmi: ok, warn, error.",
      "- ok: aucun conflit/alerte, conforme.",
      "- warn: chevauchement mineur, proximité, alerte ou risque non bloquant.",
      "- error: litige, zone inondable, restriction, DPL/DPM, inconstructible, non conforme, danger, interdiction, conflit majeur.",
      "Réponds uniquement par: ok, warn ou error."
    ].join(" ")
    const statusRaw = await generateAnswer(
      statusPrompt,
      [{ content: finalText, metadata: { source: "summary" } }],
      []
    )
    let status = String(statusRaw || "").trim().toLowerCase()
    if (status.includes("error")) status = "error"
    else if (status.includes("warn") || status.includes("warning") || status === "attention") status = "warn"
    else if (status.includes("ok") || status.includes("conforme")) status = "ok"
    else status = "warn"

    return NextResponse.json({ ok: true, text: finalText, usedWeb, status })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erreur serveur."
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}