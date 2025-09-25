import { GoogleGenAI } from '@google/genai'

export interface ChatSourceMeta {
    source?: string
    titre?: string
    section?: string
    url?: string
    date_scrap?: string
}

const apiKey = process.env.GEMINI_API_KEY || ''
const ai = new GoogleGenAI({ apiKey })

export async function embedText (text: string) {
    const modelId = process.env.GEMINI_EMBED_MODEL
        || 'text-embedding-004'
    const dim = Number(process.env.EMBEDDINGS_DIM || '768')
    const res = await ai.models.embedContent({
        model: modelId,
        contents: text,
        config: { outputDimensionality: dim },
    })
    const vec = res.embeddings?.[0]?.values
    if (!vec || vec.length === 0) {
        throw new Error('Gemini embeddings manquants ou vides')
    }
    return vec
}

export async function generateAnswer (
    question: string,
    context: Array<{ content: string, metadata?: ChatSourceMeta }>,
    history: Array<{ role: 'user' | 'ai', content: string }> = [],
) {
    const modelId = process.env.CHAT_MODEL || 'gemini-2.5-flash'

  const system = [
    'Tu es un chatbot spécialisé en foncier du Bénin.',
    "L'utilisateur peut poser des questions ou engager d'autres sujets, mais tu dois recentrer la conversation sur le foncier béninois si elle s'écarte.",
    "Si la conversation dévie, rappelle poliment l'utilisateur et propose une question ou un angle lié au foncier au Bénin.",
    'Réponds uniquement si l\'information figure dans les documents fournis. Si tu ne trouves rien, réponds exactement :',
    '"Je n\'ai pas cette information dans mes ressources foncières béninoises."',
  ].join(' ')

    const ctx = (context || []).map((c, i) => {
        const m = c.metadata || {}
        const parts = [
            `[${i + 1}]`,
            m.titre ? `titre=${m.titre}` : undefined,
            m.section ? `section=${m.section}` : undefined,
            m.source ? `source=${m.source}` : undefined,
            m.url ? `url=${m.url}` : undefined,
            m.date_scrap ? `date=${m.date_scrap}` : undefined,
        ].filter(Boolean).join(' ')
        return `- ${parts}\n${c.content}`
    }).join('\n\n')

    const hist = (history || [])
        .filter(m => m?.content?.trim())
        .slice(-10)
        .map(m => `${m.role === 'user' ? 'Utilisateur' : 'Assistant'}: ${m.content}`)
        .join('\n')

    const prompt = [
        system,
        hist ? ['','Historique (récent):', hist].join('\n') : '',
        ctx ? ['','Contexte:', ctx].join('\n') : '',
        '',
        `Question: ${question}`,
    ].filter(Boolean).join('\n')

    const res = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
    })
    return res.text
}
