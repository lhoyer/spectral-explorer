import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { Source } from "@/lib/sources"
import { CameraIcon, ImageIcon } from "lucide-react"

export function IconButton({
  label,
  children,
  className,
  variant = "ghost",
  ...props
}: React.ComponentProps<typeof Button> & { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="icon" variant={variant} aria-label={label} className={className} {...props}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export function SourceSelect({
  sources,
  value,
  onChange,
  className,
  placeholder = "Select a spectrum",
}: {
  sources: readonly Source[]
  value: string | null
  onChange: (id: string) => void
  className?: string
  placeholder?: string
}) {
  return (
    <Select value={value ?? ""} onValueChange={onChange} disabled={!sources.length}>
      <SelectTrigger size="sm" className={cn("min-w-0", className)} aria-label="Spectrum">
        <SelectValue placeholder={sources.length ? placeholder : "No spectra yet"} />
      </SelectTrigger>
      <SelectContent>
        {sources.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.kind === "camera" ? <CameraIcon /> : <ImageIcon />}
            <span className="truncate">{s.name}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export const GRAPH_COLORS = [
  { name: "Default", value: "fg" },
  { name: "Cyan", value: "#22d3ee" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Green", value: "#22c55e" },
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Purple", value: "#a855f7" },
  { name: "Yellow", value: "#eab308" },
]

export function ColorSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" className="w-14 shrink-0" aria-label="Graph color">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {GRAPH_COLORS.map((c) => (
          <SelectItem key={c.value} value={c.value}>
            <Swatch color={c.value} />
            <span className="sr-only">{c.name}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function Swatch({ color }: { color: string }) {
  return (
    <span
      className="inline-block size-3.5 rounded-full border border-foreground/20"
      style={{ background: color === "fg" ? "var(--foreground)" : color }}
    />
  )
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card", className)}>{children}</section>
}

export function Toolbar({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("flex flex-wrap items-center gap-1.5 border-b px-2 py-1.5", className)}>{children}</div>
}
