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

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ ok: false, error: "GEMINI_API_KEY manquant." }, { status: 500 })
    }

    const { question, context = [], history = [], useWeb = false }: {
      question?: string
      context?: Array<{ content: string; metadata?: ChatSourceMeta }>
      history?: Array<{ role: "user" | "ai"; content: string }>
      useWeb?: boolean
    } = await req.json()

    if (!question || typeof question !== "string") {
      return NextResponse.json({ ok: false, error: "Paramètre 'question' manquant." }, { status: 400 })
    }

    // 1) Première tentative sans web (on respecte le contexte fourni)
    let mergedContext = Array.isArray(context) ? context : []
    const primary = await generateAnswer(
      question,
      mergedContext,
      Array.isArray(history) ? history : []
    )

    // 2) Si l’utilisateur force le web OU si la réponse semble incertaine → recherche web, second essai
    let usedWeb = false
    if (useWeb || isUncertain(primary)) {
      try {
        const web = await searchWeb(question, 5)
        if (web && web.length) {
          const webCtx = web.map(w => ({
            content: `${w.title ? w.title + "\n" : ""}${w.content}`,
            metadata: { titre: w.title, url: w.url, source: "web" as const },
          }))
          mergedContext = [...webCtx, ...mergedContext]
          const secondary = await generateAnswer(
            question,
            mergedContext,
            Array.isArray(history) ? history : []
          )
          // Si la seconde réponse est valable, on la renvoie; sinon, on garde la première
          if (secondary && secondary.trim().length > 0 && !isUncertain(secondary)) {
            usedWeb = true
            return NextResponse.json({ ok: true, text: secondary, usedWeb })
          }
        }
      } catch { /* ignore fallback errors */ }
    }

    return NextResponse.json({ ok: true, text: primary, usedWeb })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Erreur serveur." }, { status: 500 })
  }
}