"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { RefreshCw, Download, EyeClosed, Eye } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import Image from "next/image";
import Lottie from "lottie-react";
import runningAnim from "../../public/running.json";
import { Progress } from "@/components/ui/progress";

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
  const [open, setOpen] = React.useState(true);

  // >>> Ajout: état lié à la levée sélectionnée depuis la carte
  const [leveName, setLeveName] = React.useState<string | null>(null);
  const [imgSrc, setImgSrc] = React.useState<string>(imageUrl);
  const [analysisHtml, setAnalysisHtml] = React.useState<string | null>(null);

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
      const d = (e.data ?? {}) as { type?: string; imageUrl?: string; name?: string; html?: string }
      if (d.type === "kadastr:leve:selected") {
        if (typeof d.imageUrl === "string") setImgSrc(d.imageUrl);
        if (typeof d.name === "string") setLeveName(d.name);
      } else if (d.type === "kadastr:leve:analysis") {
        if (typeof d.html === "string") setAnalysisHtml(d.html);
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

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
        src="/map.html"
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
                <div className="rounded-lg border max-sm:hidden border-slate-200 overflow-hidden shrink-0 bg-white shadow-sm">
                  {/* Utiliser URL absolue si fournie, sinon /uploads/<name> */}
                  {(() => {
                    const normalized = (imgSrc || "").replace(/^\//, "")
                    const resolved = /^https?:\/\//i.test(imgSrc) ? imgSrc : `/uploads/${normalized}`
                    return (
                      <Image
                        src={resolved}
                        alt="Image de la levée"
                        width={220}
                        height={220}
                        className="h-[100px] w-[100px] object-cover"
                        unoptimized={/^https?:\/\//i.test(resolved)}
                      />
                    )
                  })()}
                </div>

                <div className="w-full rounded-md h-90 border overflow-y-scroll border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100 p-3">
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
                <div className="flex justify-end items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => router.push("/demande")}
                    className="cursor-pointer"
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden /> Reprendre
                  </Button>
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
