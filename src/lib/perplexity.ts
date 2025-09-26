const PPLX_ENDPOINT = 'https://api.perplexity.ai/chat/completions'

export interface PerplexityResult {
	title: string
	url: string
	snippet: string
}

export function isRelevant (text: string) {
	const t = (text || '').toLowerCase()
	return (
		t.includes('bénin')
		|| t.includes('benin')
		|| t.includes('foncier')
		|| t.includes('cadastre')
		|| t.includes('titre foncier')
	)
}

export async function perplexitySearch (
	query: string,
	maxResults = 3,
) {
	const apiKey = process.env.PERPLEXITY_API_KEY || process.env.PPLX_API_KEY || ''
	if (!apiKey) throw new Error('PERPLEXITY_API_KEY manquant')

	const sys = [
		'Tu es un agent de recherche web spécialisé sur le foncier béninois.',
		'Retourne uniquement un JSON de la forme',
		'{"results":[{"title":"...","url":"...","snippet":"..."}]}',
		'Les résultats doivent concerner le Bénin (foncier, cadastre, titres).',
	].join(' ')

	const body = {
		model: process.env.PERPLEXITY_MODEL || 'sonar',
		messages: [
			{ role: 'system', content: sys },
			{ role: 'user', content: query },
		],
		max_tokens: 1000,
		temperature: 0,
	}

	const res = await fetch(PPLX_ENDPOINT, {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
			'Accept': 'application/json',
		},
		body: JSON.stringify(body),
	})
	if (!res.ok) {
		const txt = await res.text()
		throw new Error(`Perplexity API error: ${txt}`)
	}
	const data = await res.json()
	const content = data?.choices?.[0]?.message?.content || ''
	let results: PerplexityResult[] = []
	try {
		const parsed = JSON.parse(content)
		if (Array.isArray(parsed?.results)) results = parsed.results
	} catch {}

	if (!results.length) {
		// fallback: extraire quelques URLs et créer des snippets courts
		const urls = (content.match(/https?:\/\/\S+/g) || []).slice(0, maxResults)
		results = urls.map((u: string) => ({
			title: 'Résultat web',
			url: u.replace(/[\)\]\.,]+$/, ''),
			snippet: content.slice(0, 200),
		}))
	}

	// filtrage Bénin/foncier
	results = results.filter(r => isRelevant(`${r.title} ${r.snippet}`))
	return results.slice(0, maxResults)
}
