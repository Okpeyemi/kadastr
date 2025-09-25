"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Upload } from "lucide-react"
import { RefreshCw, Trash2 } from "lucide-react"
import { usePathname } from "next/navigation"
import Image from "next/image"

const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10MB

export function DemandeForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const pathname = usePathname()
  const [file, setFile] = React.useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const [isUploading, setIsUploading] = React.useState(false)
  const [uploadedUrl, setUploadedUrl] = React.useState<string | null>(null)

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function validate(f: File) {
    if (!["application/pdf"].includes(f.type) && !f.type.startsWith("image/")) {
      return "Format invalide. Seules les images et les PDF sont acceptés."
    }
    if (f.size > MAX_SIZE_BYTES) {
      return `Fichier trop volumineux. Taille max: ${Math.round(MAX_SIZE_BYTES / (1024 * 1024))}MB.`
    }
    return null
  }

  function handlePick(f?: File) {
    if (!f) return
    const err = validate(f)
    setError(err)
    if (err) {
      setFile(null)
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
        setPreviewUrl(null)
      }
      return
    }
    setFile(f)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(f.type.startsWith("image/") ? URL.createObjectURL(f) : null)
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    handlePick(f || undefined)
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const f = e.dataTransfer.files?.[0]
    handlePick(f || undefined)
  }

  function onDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(true)
  }

  function onDragLeave() {
    setIsDragging(false)
  }

  function clearFile() {
    setFile(null)
    setError(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setUploadedUrl(null)
    setError(null)

    try {
      const fd = new FormData()
      if (file) {
        fd.append("file", file)
      } else {
        // fallback si l'utilisateur a sélectionné via l'input natif
        const input = (e.currentTarget.elements.namedItem("file") as HTMLInputElement | null)
        const f = input?.files?.[0]
        if (!f) {
          setError("Veuillez sélectionner un fichier.")
          return
        }
        const err = validate(f)
        if (err) {
          setError(err)
          return
        }
        fd.append("file", f)
      }

      setIsUploading(true)
      const res = await fetch("/api/upload", { method: "POST", body: fd })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setError(json?.error ?? "Échec de l’upload.")
        return
      }
      setUploadedUrl(json.url as string)
      // Option: rediriger vers une page de traitement
      // router.push("/traitement")
    } catch (err) {
      setError("Erreur réseau, réessayez.")
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      encType="multipart/form-data"
      onSubmit={handleSubmit}
      {...props}
    >
      {pathname === "/demande" && (
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-4xl font-bold">Uploader un fichier</h1>
          <p className="text-muted-foreground text-md">
            Glissez-déposez une image ou un PDF, ou cliquez pour sélectionner.
          </p>
        </div>
      )}

      {/* Input natif (accessible) */}
      <div className="grid gap-2">
        <Input
          id="file"
          name="file"
          type="file"
          accept="image/*,application/pdf"
          onChange={onInputChange}
          className="sr-only"
        />
      </div>

      {/* Zone drag & drop cliquable */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => document.getElementById("file")?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            document.getElementById("file")?.click()
          }
        }}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={cn(
          "cursor-pointer border-border bg-background/50 hover:bg-background transition-colors",
          "flex flex-col items-center justify-center rounded-lg border-2 border-dashed hover:border-primary p-8 text-center",
          isDragging && "border-ring bg-ring/5"
        )}
        aria-describedby={error ? "file-error" : undefined}
      >
        <div className="text-muted-foreground mb-3">
          <Upload className="h-10 w-10 text-muted-foreground" aria-hidden />
        </div>
        <div className="text-sm">
          <span className="font-medium underline underline-offset-4">
            Cliquez pour choisir
          </span>{" "}
          ou déposez un fichier ici
        </div>
        <div className="text-muted-foreground mt-1 text-xs">
          Formats: images, PDF • Taille max: 10MB
        </div>
      </div>

      {/* Aperçu / détails */}
      {error && (
        <div id="file-error" className="text-destructive text-sm">
          {error}
        </div>
      )}
      {file && (
        <div className="flex items-center gap-4 rounded-lg border p-4">
          {previewUrl ? (
            <Image
              src={previewUrl}
              alt="Aperçu du fichier"
              width={400}
              height={300}
              className="h-30 w-30 object-cover rounded-md"
              // utile pour blob:/data: issus d’un input file
              unoptimized={typeof previewUrl === "string" && (previewUrl.startsWith("blob:") || previewUrl.startsWith("data:"))}
            />
          ) : (
            <div className="bg-muted text-muted-foreground flex h-16 w-16 items-center justify-center rounded">
              PDF
            </div>
          )}
          <div className="flex-1">
            <div className="font-medium">{file.name}</div>
            <div className="text-muted-foreground text-xs">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              className="flex items-center cursor-pointer"
              variant="secondary"
              onClick={() => document.getElementById("file")?.click()}
              aria-label="Remplacer le fichier"
            >
              <RefreshCw className="h-4 w-4" aria-hidden /> <span>Remplacer</span>
            </Button>
            <Button
              type="button"
              className="flex items-center cursor-pointer"
              variant="destructive"
              onClick={clearFile}
              aria-label="Supprimer le fichier"
            >
              <Trash2 className="h-4 w-4" aria-hidden /> <span>Supprimer</span>
            </Button>
          </div>
        </div>
      )}
      {uploadedUrl && (
        <div className="text-xs text-foreground">
          Fichier enregistré: <a className="underline" href={uploadedUrl} target="_blank" rel="noreferrer">{uploadedUrl}</a>
        </div>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" className="w-full text-md cursor-pointer" disabled={!file && !uploadedUrl || !!error || isUploading}>
          {isUploading ? "Envoi en cours…" : "Envoyer"}
        </Button>
      </div>
    </form>
  )
}