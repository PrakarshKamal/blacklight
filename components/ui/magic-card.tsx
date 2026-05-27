import * as React from "react"

import { cn } from "@/lib/utils"

function MagicCard({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="magic-card"
      className={cn(
        "shine-border rounded-2xl border border-zinc-800/80 bg-zinc-950/80 backdrop-blur",
        className
      )}
      {...props}
    />
  )
}

export { MagicCard }
