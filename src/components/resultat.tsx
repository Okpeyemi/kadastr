"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation"; // + useSearchParams
import { RefreshCw, Download, EyeClosed, Eye, BadgeCheck, BadgeAlert, BadgeX } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import Image from "next/image";
import Lottie from "lottie-react";
import runningAnim from "../../public/running.json";
import { Progress } from "@/components/ui/progress";
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

// Loader centré avec progression (15s par défaut)
export function ResultLoader({
  className,
  durationMs = 15000,
}: {
  className?: string;
  durationMs?: number;
}) {
  const [value, setValue] = React.useState(0);

  React.useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / durationMs, 1);
      setValue(Math.round(p * 100));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [durationMs]);

  return (
    <div className={className} aria-busy={value < 100} aria-live="polite">
      <div className="mb-2 text-center">
        <div className="text-foreground font-medium">Traitement en cours…</div>
        <div className="text-muted-foreground text-sm">
          Merci de patienter pendant la préparation de votre dossier.
        </div>
      </div>
      <div className="flex w-full justify-center">
        <Lottie animationData={runningAnim} loop={true} style={{ width: 400, height: 400 }} />
      </div>
      <Progress value={value} />
      <div className="text-muted-foreground mt-2 text-xs text-center">
        {value}% terminé
      </div>
    </div>
  );
}

type ResultatProps = {
  className?: string;
  imageUrl?: string;
  resultText?: string;
  // Nouveaux props pour le loader
  loader?: React.ReactNode;
  loaderDurationMs?: number; // défaut 15000
};

export function Resultat({
  className,
  imageUrl = "/placeholder.svg",
  resultText = "Votre résultat sera affiché ici.",
  loader,
  loaderDurationMs = 15000,
}: ResultatProps) {
  const router = useRouter();
  const searchParams = useSearchParams(); // <- query courante (/resultat?leve=...)
  const iframeSrc = React.useMemo(() => {
    const qs = searchParams?.toString();
    return `/map.html${qs ? `?${qs}` : ""}`; // propage ?leve=... à l’iframe
  }, [searchParams]);

  const [open, setOpen] = React.useState(true);

  // >>> Ajout: état lié à la levée sélectionnée depuis la carte
  const [leveName, setLeveName] = React.useState<string | null>(null);
  const [imgSrc, setImgSrc] = React.useState<string>(imageUrl);
  const [analysisHtml, setAnalysisHtml] = React.useState<string | null>(null)
  // + optionnel: texte brut envoyé par la carte
  const [analysisText, setAnalysisText] = React.useState<string | null>(null)

  // Résumé IA (Markdown)
  const [aiMd, setAiMd] = React.useState<string | null>(null)
  const [aiLoading, setAiLoading] = React.useState(false)
  const [aiErr, setAiErr] = React.useState<string | null>(null)
  const [aiStatus, setAiStatus] = React.useState<'ok'|'warn'|'error'|null>(null)

  // Affichage du loader centré: se ferme uniquement quand data prête (pas de timeout)
  const [showLoader, setShowLoader] = React.useState(true);

  // Fermer dès qu’on reçoit des données utiles
  React.useEffect(() => {
    if (!showLoader) return
    if (analysisHtml || leveName) {
      setShowLoader(false)
    }
  }, [analysisHtml, leveName, showLoader])

  React.useEffect(() => {
    const onMsg = (e: MessageEvent<unknown>) => {
      const d = (e.data ?? {}) as { type?: string; imageUrl?: string; name?: string; html?: string; text?: string }
      if (d.type === "kadastr:leve:selected") {
        if (typeof d.imageUrl === "string") setImgSrc(d.imageUrl);
        if (typeof d.name === "string") setLeveName(d.name);
      } else if (d.type === "kadastr:leve:analysis") {
        if (typeof d.html === "string") setAnalysisHtml(d.html);
        if (typeof d.text === "string") setAnalysisText(d.text);
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // Helper: HTML -> texte
  const htmlToText = React.useCallback((html: string) => {
    const el = document.createElement("div")
    el.innerHTML = html
    return (el.textContent || el.innerText || "").trim()
  }, [])

  // Déclenche la génération Gemini quand on a un résultat
  React.useEffect(() => {
    if (!analysisHtml && !analysisText) return
    const controller = new AbortController()
    const ctx = [
      analysisText || "",
      analysisHtml ? htmlToText(analysisHtml) : "",
    ].filter(Boolean).join("\n\n")

    setAiLoading(true)
    setAiErr(null)
    setAiMd(null)

    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        question:
          "Rédige un résumé clair, structuré et actionnable du résultat d'analyse suivant. " +
          "Formate en Markdown (titres `##`, listes, tableaux si pertinent). " +
          "Ne déduis rien qui n’est pas dans les données. Termine par une section '## Recommandations' si utile.",
        context: [
          {
            content: ctx,
            metadata: { source: "map", titre: leveName || "Analyse de parcelle" },
          },
        ],
        history: [],
        useWeb: false, // pas de recherche web
      }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok === false) {
          setAiErr(j?.error || "Échec de la génération.")
          setAiStatus("error")
        } else if (typeof j?.text === "string" && j.text.trim()) {
          setAiMd(j.text.trim())
          if (j?.status === "ok" || j?.status === "warn" || j?.status === "error") {
            setAiStatus(j.status)
          } else {
            // fallback heuristique si API ancienne
            const t = j.text.toLowerCase()
            if (/(aucun conflit|conforme|pas de conflit|aucun chevauchement)/.test(t)) setAiStatus("ok")
            else if (/(litige|inondable|restriction|inconstructible|non conforme|danger|interdit)/.test(t)) setAiStatus("error")
            else if (/(chevauchement|proximité|attention|alerte|risque|conflit)/.test(t)) setAiStatus("warn")
            else setAiStatus(null)
          }
        } else {
          setAiErr("Réponse vide.")
          setAiStatus("warn")
        }
      })
      .catch((e) => {
        if (e?.name !== "AbortError") setAiErr("Échec de la génération.")
      })
      .finally(() => setAiLoading(false))

    return () => controller.abort()
  }, [analysisHtml, analysisText, leveName, htmlToText])

  return (
    <div className={cn("relative w-full h-full", className)}>
      {/* Overlay loader centré */}
      {showLoader && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          {loader ?? <ResultLoader className="w-full max-w-md p-4" durationMs={loaderDurationMs} />}
        </div>
      )}

      {/* Carte plein écran */}
      <iframe
        title="Carte interactive"
        className="absolute inset-0 w-full h-full rounded-xl"
        src={iframeSrc} // <-- avant: "/map.html"
        loading="lazy"
        style={{ border: 0 }}
      />

      {/* Bouton toggle du panneau résultat */}
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setOpen((v) => !v)}
        className="absolute w-fit top-2 right-2 p-2 z-20"
        aria-label={open ? "Masquer le résultat" : "Afficher le résultat"}
        aria-pressed={open}
      >
        {open ? (
          <span className="flex items-center w-full gap-2">
            <EyeClosed className="h-4 w-4" aria-hidden />
            <span>Masquer le résultat</span>
          </span>
        ) : (
          <span className="flex items-center w-full gap-2">
            <Eye className="h-4 w-4" aria-hidden />
            <span>Afficher le résultat</span>
          </span>
        )}
      </Button>

      {/* Panneau résultat */}
      {open && (
        <div className="absolute px-2 pt-14 pb-6 right-0 z-10 max-w-[360px] h-full flex flex-col justify-between gap-4">
          <Card className="bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Résultat de votre demande</span>
                {leveName && (
                  <span className="ml-2 text-[11px] font-semibold rounded-full px-2 py-0.5 bg-slate-100 border text-slate-600">
                    {leveName}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3 items-center">
                <div className="w-full rounded-md h-90 hidden border overflow-y-scroll border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100 p-3">
                  <div className="font-semibold text-slate-700 border-b border-slate-200 pb-2 mb-2">
                    Résultat d&apos;analyse :
                  </div>
                  {analysisHtml ? (
                    <div
                      className="text-sm leading-relaxed text-slate-700 space-y-1"
                      dangerouslySetInnerHTML={{ __html: analysisHtml }}
                    />
                  ) : (
                    <div className="text-sm leading-relaxed text-slate-700">
                      {resultText}
                    </div>
                  )}
                </div>

                {/* Statut d’analyse (un seul badge) */}
                <div aria-live="polite">
                  {aiStatus === "ok" && (
                    <span className="flex flex-col items-center gap-1 text-green-600">
                      <BadgeCheck className="bg-green-500/40 h-14 w-14 p-2 rounded-full" aria-hidden /> <span className="text-xs font-medium">Conforme</span>
                    </span>
                  )}
                  {aiStatus === "warn" && (
                    <span className="flex flex-col items-center gap-1 text-amber-600">
                      <BadgeAlert className="bg-amber-500/40 h-14 w-14 p-2 rounded-full" aria-hidden /> <span className="text-xs font-medium">À vérifier</span>
                    </span>
                  )}
                  {aiStatus === "error" && (
                    <span className="flex flex-col items-center gap-1 text-red-600">
                      <BadgeX className="bg-red-500/40 h-14 w-14 p-2 rounded-full" aria-hidden /> <span className="text-xs font-medium">Conflits majeurs</span>
                    </span>
                  )}
                  {!aiStatus && <span className="text-muted-foreground text-xs">—</span>}
                </div>

                {/* Nouveau: Résumé IA (Markdown) */}
                <div className="w-full rounded-md border min-w-[300px] h-90 overflow-y-scroll border-slate-200 bg-white p-3">
                  <div className="font-semibold text-slate-700 border-b border-slate-200 pb-2 mb-2">
                    Résumé IA
                  </div>
                  {aiLoading ? (
                    <div className="text-sm text-slate-600">Génération en cours…</div>
                  ) : aiErr ? (
                    <div className="text-sm text-red-600">{aiErr}</div>
                  ) : aiMd ? (
                    <div className="text-sm leading-relaxed text-slate-700 prose prose-sm max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiMd}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500">—</div>
                  )}
                </div>

                <div className="flex justify-end items-center gap-2">
                  <Button
                    type="button"
                    variant="success"
                    onClick={() => router.push("/resultat?download=true")}
                    className="cursor-pointer"
                  >
                    <Download className="h-4 w-4" aria-hidden /> Télécharger
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
