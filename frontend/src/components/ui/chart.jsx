// ... existing code ...
import * as React from "react"
import {
  ResponsiveContainer,
  Tooltip,
} from "recharts"
import { cn } from "@/lib/utils"

// Dummy Chart component - recharts uses specific chart types (BarChart, PieChart)
// This is included to satisfy the import if it's expected as a general "Chart" component.
const Chart = ({ children }) => <>{children}</>

// Re-exporting Recharts Tooltip as ChartTooltip
const ChartTooltip = Tooltip

// Basic implementation of ChartTooltipContent to match the expected prop structure
const ChartTooltipContent = React.forwardRef(
  ({ active, payload, className, ...props }, ref) => {
    if (active && payload && payload.length) {
      // Assuming the first payload item contains the data for the tooltip
      return (
        <div
          ref={ref}
          className={cn(
            "bg-white p-3 border rounded-lg shadow-lg text-sm",
            className
          )}
          {...props}
        >
          {payload.map((entry, index) => (
            <div key={`item-${index}`} className="flex items-center justify-between gap-2">
              <span className="font-medium" style={{ color: entry.color }}>
                {entry.name || entry.dataKey}:
              </span>
              <span>{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  }
);
ChartTooltipContent.displayName = "ChartTooltipContent";


const ChartContainer = React.forwardRef(
  ({ className, children, config, ...props }, ref) => {
    const newConfig = React.useMemo(() => {
      if (!config) return {}
      return Object.entries(config).reduce((acc, [key, value]) => {
        return {
          ...acc,
          [key]: {
            color: `hsl(var(--chart-${Object.keys(config).indexOf(key) + 1}))`,
            ...value,
          },
        }
      }, {})
    }, [config])

    // This div acts as the container for the recharts ResponsiveContainer and actual charts.
    // The 'config' prop processing is kept, but its direct application to recharts components
    // would typically be handled by a more complex wrapper or manually in DeanHome.jsx.
    return (
      <div
        ref={ref}
        className={cn("flex aspect-video h-[250px] w-full", className)}
        {...props}
      >
        {children}
      </div>
    )
  },
)
ChartContainer.displayName = "ChartContainer"

export { Chart, ChartContainer, ChartTooltip, ChartTooltipContent }