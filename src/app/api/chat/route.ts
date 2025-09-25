import { NextRequest, NextResponse } from "next/server"
import { generateAnswer, type ChatSourceMeta } from "@/lib/gemini"

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ ok: false, error: "GEMINI_API_KEY manquant." }, { status: 500 })
    }

    const { question, context = [], history = [] }: {
      question?: string
      context?: Array<{ content: string; metadata?: ChatSourceMeta }>
      history?: Array<{ role: "user" | "ai"; content: string }>
    } = await req.json()

    if (!question || typeof question !== "string") {
      return NextResponse.json({ ok: false, error: "Paramètre 'question' manquant." }, { status: 400 })
    }

    const text = await generateAnswer(question, Array.isArray(context) ? context : [], Array.isArray(history) ? history : [])
    return NextResponse.json({ ok: true, text })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Erreur serveur." }, { status: 500 })
  }
}