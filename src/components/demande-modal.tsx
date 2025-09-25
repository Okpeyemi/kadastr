"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { DemandeForm } from "@/components/demande-form"

export type DemandeModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
}

export function DemandeModal({
  open,
  onOpenChange,
  title = "Nouvelle demande",
  description = "Uploader une image ou un PDF pour démarrer l’analyse.",
}: DemandeModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DemandeForm />
      </DialogContent>
    </Dialog>
  )
}