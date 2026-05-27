import * as React from "react"

import { cn } from "@/lib/utils"

function BentoGrid({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="bento-grid"
      className={cn("grid gap-4 md:grid-cols-2 lg:grid-cols-3", className)}
      {...props}
    />
  )
}

function BentoCard({
  className,
  featured = false,
  ...props
}: React.ComponentProps<"div"> & { featured?: boolean }) {
  return (
    <div
      data-slot="bento-card"
      data-featured={featured}
      className={cn(
        "shine-border rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-6 backdrop-blur",
        "data-[featured=true]:md:col-span-2 data-[featured=true]:lg:col-span-2",
        className
      )}
      {...props}
    />
  )
}

export { BentoGrid, BentoCard }
