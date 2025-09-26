"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation"; 

export default function Home() {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <Button
        type="button"
        onClick={() => router.push("/demande")}
        className="cursor-pointer"
      >
         Démarrer une demande
      </Button>
    </div>
  );
}
