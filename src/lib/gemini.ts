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
    "Utilise les documents fournis comme source principale, mais tu peux compléter avec des informations fiables (sur internet) lorsque nécessaire.",
    "Lorsque tu complètes avec des connaissances externes, précise clairement les sources",
    "Si des résultats web (metadata.source=web) sont fournis dans le contexte, synthétise-les et ajoute à la fin une section intitulée “## Sources” listant les URL pertinentes.",
    "Si la conversation dévie, recentre poliment sur le foncier béninois et propose un angle ou une question liée au sujet.",
    "Formate toujours ta réponse en Markdown clair et concis: titres (##), listes à puces, tableaux si utile, et blocs de code ```lang si nécessaire.",
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