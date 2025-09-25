"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { type Icon } from "@tabler/icons-react"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

type SidebarBrandProps = {
  href?: string
  label: string
  icon?: Icon
  className?: string
}

export function Brand({ href = "/", label, icon: Icon, className }: SidebarBrandProps) {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          className={cn("data-[slot=sidebar-menu-button]:!p-1.5", className)}
        >
          <a href={href}>
            {Icon && <Icon className="!size-5" />}
            <span className="text-base font-semibold">{label}</span>
          </a>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}