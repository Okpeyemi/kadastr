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
    type ApiItem = { title?: unknown; url?: unknown; content?: unknown; snippet?: unknown }
    return (results as ApiItem[]).map((r) => ({
      title: typeof r.title === "string" ? r.title : "",
      url: typeof r.url === "string" ? r.url : "",
      content: typeof r.content === "string" ? r.content : (typeof r.snippet === "string" ? r.snippet : ""),
    }))
  } catch {
    return []
  }
}