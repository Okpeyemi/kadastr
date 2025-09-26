"use client"

import { AppSidebar } from "@/components/app-sidebar"
// import { ChartAreaInteractive } from "@/components/chart-area-interactive"
// import { DataTable } from "@/components/data-table"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Demandes, type DemandeItem } from "@/components/demandes"
import { Button } from "@/components/ui/button"
import React from "react"

export default function Page() {
  // pagination state
  const [page, setPage] = React.useState(1)
  const pageSize = 6

  // Charger les demandes depuis public/submission.csv
  const [items, setItems] = React.useState<DemandeItem[]>([])

  React.useEffect(() => {
    function splitCsvLine(line: string): string[] {
      const out: string[] = []
      let cur = ""
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
          else { inQuotes = !inQuotes }
        } else if (ch === ';' && !inQuotes) { out.push(cur); cur = "" }
        else { cur += ch }
      }
      out.push(cur)
      return out
    }

    async function load() {
      try {
        const res = await fetch("/submission.csv", { cache: "no-store" })
        if (!res.ok) return
        const text = await res.text()
        const lines = (text || "").split(/\r?\n/).filter(l => l.trim().length)
        if (!lines.length) return
        const header = splitCsvLine(lines[0]).map(s => s.trim())
        const nameIdx = header.indexOf("Nom_du_levé")
        const coordsIdx = header.indexOf("Coordonnées")
        if (nameIdx < 0 || coordsIdx < 0) return

        const rows: DemandeItem[] = []
        for (let li = 1; li < lines.length; li++) {
          const parts = splitCsvLine(lines[li])
          const name = (parts[nameIdx] || "").trim()
          let coordStr = (parts[coordsIdx] || "").trim()
          if (!name || !coordStr) continue
          if (coordStr[0] === '"' && coordStr[coordStr.length - 1] === '"') coordStr = coordStr.slice(1, -1)
          coordStr = coordStr.replace(/""/g, '"')

          let coordsArr: Array<{ x: number; y: number }> = []
          try { coordsArr = JSON.parse(coordStr) } catch { coordsArr = [] }

          const coords = coordsArr.map((c, i) => ({
            name: `B${i + 1}`,
            x: Number(c.x),
            y: Number(c.y),
          })).filter(c => Number.isFinite(c.x) && Number.isFinite(c.y))

          rows.push({
            id: li,
            title: name,
            imageUrl: `/${name}`,
            mapHref: `/resultat?view=map&leve=${encodeURIComponent(name)}`,
            downloadUrl: `/${name}`,
            coords,
          })
        }
        setItems(rows)
      } catch {
        // ignore
      }
    }

    load()
  }, [])

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const pagedItems = React.useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize]
  )

  const goPrev = () => setPage((p) => Math.max(1, p - 1))
  const goNext = () => setPage((p) => Math.min(totalPages, p + 1))

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:p-6">
              <Demandes items={pagedItems} />

              {/* Pagination footer (duplication pour confort) */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Page {page} / {totalPages}
                </span>
                <span className="text-xs text-muted-foreground">
                  Affichage {(page - 1) * pageSize + 1}
                  {"–"}
                  {Math.min(page * pageSize, items.length)} sur {items.length}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={goPrev} disabled={page === 1}>
                    Précédent
                  </Button>
                  <Button variant="default" size="sm" onClick={goNext} disabled={page === totalPages}>
                    Suivant
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
