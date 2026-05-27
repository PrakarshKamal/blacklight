import * as React from "react"

import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function ShimmerButton({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      className={cn(
        buttonVariants({ variant: "default" }),
        "shimmer-btn bg-gradient-to-r from-violet-500 to-violet-600 text-white hover:from-violet-400 hover:to-violet-500",
        className
      )}
      {...props}
    />
  )
}

export { ShimmerButton }
