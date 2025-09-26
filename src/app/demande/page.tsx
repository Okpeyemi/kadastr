import { DemandeForm } from "@/components/demande-form";
import { Typewriter } from "@/components/typewriter";
import { BrandLink } from "@/components/brand-link";

export default function DemandePage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="bg-muted relative hidden lg:flex items-center justify-center p-10 min-w-0 overflow-hidden">
        <div className="relative z-10 mx-auto max-w-2xl text-center min-w-0 px-4">
          <h1 className="text-primary font-black text-3xl md:text-5xl break-words text-balance leading-tight">
            <Typewriter
              phrases={[
                "Ajoutez une image ou un PDF de votre plan.",
                "Indiquez votre terrain sur la carte.",
                "Découvrez où sont les coins de votre terrain.",
                "Téléchargez le fichier avec le résultat.",
              ]}
              typingSpeed={45}
              deletingSpeed={28}
              pauseBetween={1200}
            />
          </h1>
        </div>
      </div>
      <div className="flex flex-col gap-4 p-4 md:p-6 min-w-0">
        <div className="flex justify-center gap-2 md:justify-start">
          <BrandLink href="#" label="Kadastr." />
        </div>
        <div className="flex flex-1 items-center justify-center min-w-0">
          <div className="w-full max-w-xl">
            <DemandeForm />
          </div>
        </div>
      </div>
    </div>
  );
}
