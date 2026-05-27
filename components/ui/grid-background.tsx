import * as React from "react"

import { cn } from "@/lib/utils"

function GridBackground({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("relative overflow-hidden", className)} {...props}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 grid-bg [mask-image:radial-gradient(ellipse_70%_50%_at_50%_0%,black,transparent_75%)]"
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-black/40" />
      <div className="relative">{children}</div>
    </div>
  )
}

export { GridBackground }
