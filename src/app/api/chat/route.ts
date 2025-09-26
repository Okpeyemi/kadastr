import { NextRequest, NextResponse } from "next/server"
import { generateAnswer, type ChatSourceMeta, embedText } from "@/lib/gemini"
import { searchWeb } from "@/lib/websearch"
import { getAnonClient, getAdminClient } from "@/lib/supabase" // <-- ajout

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

// helper: score supabase (similarity/score/distance)
type MatchDocumentRow = {
  content: string
  metadata: import("@/lib/gemini").ChatSourceMeta | null
  similarity?: number
  score?: number
  distance?: number
}

function scoreOf(
  d: Readonly<Pick<MatchDocumentRow, "similarity" | "score" | "distance">> | null | undefined
): number {
  if (typeof d?.similarity === "number") return d.similarity
  if (typeof d?.score === "number") return d.score
  if (typeof d?.distance === "number") {
    const v = 1 - d.distance
    return Number.isFinite(v) ? v : 0
  }
  return 0
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

    // 0) RAG: recherche Supabase d’abord
    const thr = Number(process.env.RETRIEVAL_THRESHOLD || "0.5")
    let sbContext: Array<{ content: string; metadata?: ChatSourceMeta }> = []
    let bestScore = 0
    try {
      const emb = await embedText(question)
      const anon = getAnonClient()
      // match_documents: fonction RPC côté Supabase (vector similarity)
      const { data, error } = await anon.rpc<MatchDocumentRow[]>("match_documents", {
        query_embedding: emb,
        match_count: 5,
        filter: null,
      }) as { data: MatchDocumentRow[] | null; error: unknown }

      if (!error && Array.isArray(data) && data.length) {
        bestScore = scoreOf(data[0])
        sbContext = data.map((d): { content: string; metadata?: ChatSourceMeta } => ({
          content: String(d?.content ?? ""),
          metadata: d?.metadata ?? undefined,
        }))
      }
    } catch {
      // en cas d’échec Supabase, on continue sans bloquer
    }

    // 1) Première tentative: contexte Supabase + contexte fourni
    let mergedContext = [...sbContext, ...(Array.isArray(context) ? context : [])]
    const primary = await generateAnswer(
      question,
      mergedContext,
      Array.isArray(history) ? history : []
    )

    // 2) Fallback web si (autorisé) ET (réponse incertaine OU faible score RAG)
    let usedWeb = false
    let finalText = primary
    const allowWebFallback = bestScore < thr
    if ((useWeb && allowWebFallback) || isUncertain(primary)) {
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
          if (secondary && secondary.trim().length > 0 && !isUncertain(secondary)) {
            usedWeb = true
            finalText = secondary
            // ingestion asynchrone: enregistre la réponse dans Supabase
            void (async () => {
              try {
                const admin = getAdminClient()
                const embAns = await embedText(finalText ?? "")
                const meta = {
                  source: "qa",
                  section: "answer",
                  question,
                  usedWeb: true,
                  // stocke les URLs utilisées si présentes dans web
                  urls: web.map(w => w.url).filter(Boolean),
                  date_scrap: new Date().toISOString(),
                }
                await admin.rpc("insert_document", {
                  p_content: finalText ?? "",
                  p_metadata: meta,
                  p_embedding: embAns,
                })
              } catch {
                // ignore
              }
            })()
            return NextResponse.json({ ok: true, text: finalText, usedWeb })
          }
        }
      } catch {
        // ignore fallback errors
      }
    }

    // 3) Réponse RAG (ou primaire) — on enregistre aussi
    void (async () => {
      try {
        const admin = getAdminClient()
        const embAns = await embedText(finalText ?? "")
        const meta = {
          source: "qa",
          section: "answer",
          question,
          usedWeb: false,
          // si des sources RAG existent, on les matérialise dans la metadata
          ragSources: sbContext.map(c => c.metadata?.url).filter(Boolean),
          date_scrap: new Date().toISOString(),
        }
        await admin.rpc("insert_document", {
          p_content: finalText ?? "",
          p_metadata: meta,
          p_embedding: embAns,
        })
      } catch {
        // ignore
      }
    })()

    return NextResponse.json({ ok: true, text: finalText, usedWeb })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erreur serveur."
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}