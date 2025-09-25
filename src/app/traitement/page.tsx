import { Traitement } from "@/components/traitement";
import { BrandLink } from "@/components/brand-link";

export default function TraitementPage() {
  return (
    <div className="grid min-h-svh">
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <div className="flex justify-center gap-2 md:justify-start">
          <BrandLink href="#" label="Kadastr." />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-lg">
            <Traitement redirectTo="/demande" durationMs={40000} />
          </div>
        </div>
      </div>
    </div>
  );
}
