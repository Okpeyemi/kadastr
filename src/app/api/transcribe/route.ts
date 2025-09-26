import { NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"

export async function POST(req: NextRequest) {
  try {
    const { audio, mimeType, language = "fr", prompt } = await req.json()
    if (!audio || !mimeType) {
      return NextResponse.json({ error: "audio (base64) et mimeType requis" }, { status: 400 })
    }

    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "API key manquante (GOOGLE_API_KEY ou GEMINI_API_KEY)" }, { status: 500 })
    }

    const modelId = process.env.TRANSCRIBE_MODEL || process.env.CHAT_MODEL || "gemini-2.5-flash"
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: modelId })

    const sys = [
      `Tu es un transcripteur STT. Transcris fidèlement l'audio en ${language},`,
      "avec ponctuation et accents corrects. N'invente rien.",
      "Si l'audio est inaudible, renvoie: [inaudible].",
    ].join(" ")
    const userPrompt =
      prompt ||
      "Transcris le contenu de l'audio ci-dessous en texte. Ne fournis que la transcription."

    const result = await model.generateContent([
      { text: sys },
      { text: userPrompt },
      { inlineData: { mimeType, data: audio } },
    ])

    const text = (await result.response.text())?.trim() || ""
    return NextResponse.json({ text })
  } catch {
    return NextResponse.json({ error: "Transcription échouée" }, { status: 500 })
  }
}