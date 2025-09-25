"use client";

import * as React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MapPin, RefreshCw, List, LayoutGrid, Download } from "lucide-react";
import Image from "next/image";

type DemandeCoord = {
  name: string;
  x: number;
  y: number;
};

export type DemandeItem = {
  id: string | number;
  title: string;
  imageUrl: string;
  mapHref?: string;
  tfNumber?: string;
  downloadUrl?: string;
  coords?: DemandeCoord[];
};

export function Demandes({
  items,
  className,
}: {
  items: DemandeItem[];
  className?: string;
}) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  function handleDownload(url: string, filename?: string) {
    const a = document.createElement("a");
    a.href = url;
    if (filename) a.download = filename;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Demandes réalisées</h2>
        <div className="flex justify-end">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              aria-pressed={viewMode === "list"}
              aria-label="Affichage liste"
              title="Affichage liste"
              className={`inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground ${
                viewMode === "list"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground"
              }`}
            >
              <List className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              aria-pressed={viewMode === "grid"}
              aria-label="Affichage grille"
              title="Affichage grille"
              className={`inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground ${
                viewMode === "grid"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground"
              }`}
            >
              <LayoutGrid className="size-4" />
            </button>
          </div>
        </div>
      </div>
      <div
        className={cn(
          viewMode === "grid"
            ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            : "flex flex-col gap-4"
        )}
      >
        {items.map((item) =>
          viewMode === "grid" ? (
            // Vue grille
            <Card key={item.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-base">{item.title}</CardTitle>
                <div className="text-xs text-muted-foreground">
                  Numéro TF:{" "}
                  <span className="font-medium text-foreground">
                    {item.tfNumber ?? "—"}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border overflow-hidden">
                  <Image
                    src={item.imageUrl}
                    alt={item.title}
                    width={320}
                    height={200}
                    className="h-48 w-full object-cover"
                  />
                </div>
                <div className="mt-3 rounded-md border bg-muted/30 p-3">
                  <div className="text-xs font-medium mb-1">Coordonnées</div>
                  <ul className="max-h-24 overflow-auto text-xs font-mono text-muted-foreground space-y-0.5">
                    {item.coords?.length ? (
                      item.coords.map((c) => (
                        <li key={c.name}>
                          {c.name}: x={c.x.toFixed(2)}, y={c.y.toFixed(2)}
                        </li>
                      ))
                    ) : (
                      <li>—</li>
                    )}
                  </ul>
                </div>
              </CardContent>
              <CardFooter className="mt-auto flex justify-end gap-2">
                <Button
                  type="button"
                  onClick={() =>
                    router.push(item.mapHref ?? "/resultat?view=map")
                  }
                  className="cursor-pointer"
                >
                  <MapPin className="h-4 w-4" aria-hidden /> Visualiser la carte
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => router.push("/demande")}
                  className="cursor-pointer"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden /> Reprendre
                  l’analyse
                </Button>
                <Button
                  type="button"
                  variant="success"
                  onClick={() =>
                    handleDownload(
                      item.downloadUrl ?? item.imageUrl,
                      `demande-${item.id}`
                    )
                  }
                  className="cursor-pointer"
                >
                  <Download className="h-4 w-4" aria-hidden /> Télécharger
                </Button>
              </CardFooter>
            </Card>
          ) : (
            // Vue liste: flex + vignette réduite
            <Card key={item.id} className="p-4">
              <div className="flex items-center gap-4">
                <div className="rounded-md border overflow-hidden shrink-0">
                  <Image
                    src={item.imageUrl}
                    alt={item.title}
                    width={320}
                    height={200}
                    className="h-full w-24 object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="font-medium line-clamp-1">{item.title}</div>
                  <div className="text-xs text-muted-foreground line-clamp-1">
                    Numéro TF:{" "}
                    <span className="font-medium text-foreground">
                      {item.tfNumber ?? "—"}
                    </span>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-2">
                    <div className="text-[11px] font-medium mb-1">
                      Coordonnées
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] font-mono text-muted-foreground">
                      {item.coords?.length ? (
                        item.coords.map((c) => (
                          <div key={c.name} className="flex items-center gap-1">
                            <span className="text-foreground">{c.name}</span>
                            <span>· x={c.x.toFixed(2)}</span>
                            <span>y={c.y.toFixed(2)}</span>
                          </div>
                        ))
                      ) : (
                        <span>—</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    onClick={() =>
                      router.push(item.mapHref ?? "/resultat?view=map")
                    }
                    className="cursor-pointer"
                  >
                    <MapPin className="h-4 w-4" aria-hidden /> Visualiser la
                    carte
                  </Button>
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
                    onClick={() =>
                      handleDownload(
                        item.downloadUrl ?? item.imageUrl,
                        `demande-${item.id}`
                      )
                    }
                    className="cursor-pointer"
                  >
                    <Download className="h-4 w-4" aria-hidden /> Télécharger
                  </Button>
                </div>
              </div>
            </Card>
          )
        )}
      </div>
    </div>
  );
}
