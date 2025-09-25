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

  // Source des demandes (inchangée, simplement extraite pour pagination)
  const items = React.useMemo(() => ([
    {
      id: 1,
      title: "Demande #1",
      imageUrl: "/leve4.jpeg",
      mapHref: "/resultat?view=map",
      tfNumber: "TF123",
      coords: [
        { name: "B1", x: 429728.0, y: 725718.0 },
        { name: "B2", x: 429751.8, y: 725700.71 },
        { name: "B3", x: 429729.95, y: 725668.94 },
        { name: "B4", x: 429676.88, y: 725562.08 },
        { name: "B5", x: 429643.33, y: 725574.63 },
        { name: "B6", x: 429684.85, y: 725686.03 },
      ],
    },
    {
      id: 2,
      title: "Demande #2",
      imageUrl: "/placeholder.svg",
      mapHref: "/resultat?view=map",
      tfNumber: "TF123",
      coords: [
        { name: "B1", x: 429728.0, y: 725718.0 },
        { name: "B2", x: 429751.8, y: 725700.71 },
        { name: "B3", x: 429729.95, y: 725668.94 },
        { name: "B4", x: 429676.88, y: 725562.08 },
        { name: "B5", x: 429643.33, y: 725574.63 },
        { name: "B6", x: 429684.85, y: 725686.03 },
      ],
    },
    {
      id: 3,
      title: "Demande #3",
      imageUrl: "/placeholder.svg",
      mapHref: "/resultat?view=map",
      tfNumber: "TF123",
      coords: [
        { name: "B1", x: 429728.0, y: 725718.0 },
        { name: "B2", x: 429751.8, y: 725700.71 },
        { name: "B3", x: 429729.95, y: 725668.94 },
        { name: "B4", x: 429676.88, y: 725562.08 },
        { name: "B5", x: 429643.33, y: 725574.63 },
        { name: "B6", x: 429684.85, y: 725686.03 },
      ],
    },
  ] satisfies DemandeItem[]), [])

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
