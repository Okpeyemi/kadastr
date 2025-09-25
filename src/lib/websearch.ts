export type WebResult = { title: string; url: string; content: string }

export async function searchWeb(query: string, maxResults = 5): Promise<WebResult[]> {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) return []
  try {
    const resp = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "advanced",
        max_results: Math.max(1, Math.min(10, maxResults)),
      }),
      cache: "no-store",
    })
    if (!resp.ok) return []
    const json = await resp.json()
    const results = Array.isArray(json.results) ? json.results : []
    return results.map((r: any) => ({
      title: r.title || "",
      url: r.url || "",
      content: r.content || r.snippet || "",
    }))
  } catch {
    return []
  }
}