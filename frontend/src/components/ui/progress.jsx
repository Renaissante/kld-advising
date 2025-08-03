"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { cn } from "@/lib/utils"

// ... existing code ...
// ... existing code ...
const Progress = React.forwardRef(({ className, value, fillColor, ...props }, ref) => ( // Added fillColor prop
  <ProgressPrimitive.Root
    ref={ref}
    className={cn("relative h-4 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800", className)}
    {...props}>
    <ProgressPrimitive.Indicator
      // Use fillColor if provided, otherwise default to bg-primary
      className={cn("h-full w-full flex-1 transition-all", fillColor || "bg-primary")}
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }} />
  </ProgressPrimitive.Root>
))
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }