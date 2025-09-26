"use client";

import { Resultat, ResultLoader } from "@/components/resultat";
import { BrandLink } from "@/components/brand-link";
import { FileAxis3D } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function ResultatPage() {
  const router = useRouter();
  const [remaining, setRemaining] = useState(30);

  useEffect(() => {
    const totalMs = 5 * 60 * 1000; // 5 minutes
    const totalSeconds = Math.ceil(totalMs / 1000); // 300 seconds
    // initialize remaining to the full duration (overrides the previous 30s)
    setRemaining(totalSeconds);

    const redirectTimeout = setTimeout(() => {
      router.push("/demandes");
    }, totalMs);

    const interval = setInterval(() => {
      setRemaining((r) => (r > 0 ? r - 1 : 0));
    }, 1000);

    return () => {
      clearTimeout(redirectTimeout);
      clearInterval(interval);
    };
  }, [router]);

  return (
    <div className="grid min-h-svh">
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <div className="flex justify-between w-full gap-2">
          <BrandLink href="#" label="Kadastr." />
          <Button
            type="button"
            onClick={() => router.push("/demandes")}
            className="cursor-pointer"
          >
            <FileAxis3D className="h-4 w-4" aria-hidden /> Voir Mes Demandes
          </Button>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full h-full">
            <Resultat
              imageUrl="/leve4.jpeg"
              resultText="Exemple de texte de résultat. Vous pouvez remplacer ce contenu par le message retourné par votre traitement."
              // Afficher le loader centré pendant 15s
              loader={<ResultLoader className="w-full max-w-md p-4" durationMs={15000} />}
              loaderDurationMs={20000}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
