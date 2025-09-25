"use client"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { usePathname } from "next/navigation"
import { FilePlus } from "lucide-react"
import { useState } from "react"
import { DemandeModal } from "@/components/demande-modal"

export function SiteHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const PAGE_TITLES: Record<string, string> = {
    "/": "Accueil",
    "/demande": "Demande",
    "/demandes": "Mes Demandes",
    "/traitement": "Traitement",
    "/resultat": "Résultat",
    "/demande-de-situation": "Demande de situation",
  }

  function deriveTitle(path: string) {
    const seg = path.split("?")[0].split("/").filter(Boolean).pop() ?? ""
    if (!seg) return "Accueil"
    const decoded = decodeURIComponent(seg).replace(/-/g, " ")
    return decoded.charAt(0).toUpperCase() + decoded.slice(1)
  }

  const title = PAGE_TITLES[pathname] ?? deriveTitle(pathname)

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">{title}</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" className="hidden sm:flex" onClick={() => setOpen(true)}>
            <FilePlus className="h-4 w-4" aria-hidden />
            Faire une demande
          </Button>
        </div>
      </div>
      <DemandeModal open={open} onOpenChange={setOpen} />
    </header>
  )
}
