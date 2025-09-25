import * as React from "react"
import { cn } from "@/lib/utils"
import type { Icon } from "@tabler/icons-react"
import { IconInnerShadowTop } from "@tabler/icons-react"

type BrandLinkProps = {
  href?: string
  label?: string
  icon?: Icon
  className?: string
}

export function BrandLink({
  href = "#",
  label = "Acme Inc.",
  icon: IconComp = IconInnerShadowTop,
  className,
}: BrandLinkProps) {
  return (
    <a href={href} className={cn("flex items-center gap-2 font-medium", className)}>
      <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
        <IconComp className="size-4" />
      </div>
      {label}
    </a>
  )
}