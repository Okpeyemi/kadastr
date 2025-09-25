"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Progress } from "@/components/ui/progress"
import Lottie from "lottie-react"
import runningAnim from "../../public/running.json"

type TraitementProps = {
  redirectTo?: string
  durationMs?: number
  className?: string
}

export function Traitement({
  redirectTo = "/demande",
  durationMs = 4000,
  className,
}: TraitementProps) {
  const router = useRouter()
  const [value, setValue] = React.useState(0)

  React.useEffect(() => {
    let raf = 0
    const start = performance.now()

    const tick = (now: number) => {
      const elapsed = now - start
      const p = Math.min(elapsed / durationMs, 1)
      setValue(Math.round(p * 100))
      if (p < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        router.push(redirectTo)
      }
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [durationMs, redirectTo, router])

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
  )
}