import { useEffect, useRef, useState } from "react"
import { ThemeProvider } from "next-themes"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AnalysisPanel } from "@/components/AnalysisPanel"
import { ConfigDialog } from "@/components/ConfigDialog"
import { Header } from "@/components/Header"
import { OpticalPanel } from "@/components/OpticalPanel"
import { autoConnect, openFiles } from "@/lib/actions"
import { registry, useSources } from "@/lib/sources"

function Workspace() {
  const sources = useSources()
  const [opticalId, setOpticalId] = useState<string | null>(null)
  const [configuring, setConfiguring] = useState(false)
  const [dragging, setDragging] = useState(false)
  const known = useRef(new Set<string>())

  // Show newly added spectra in the optical view; fall back when one is removed.
  useEffect(() => {
    const added = sources.filter((s) => !known.current.has(s.id) && !s.isSnapshot)
    known.current = new Set(sources.map((s) => s.id))
    if (added.length) setOpticalId(added[added.length - 1].id)
    else if (!registry.get(opticalId)) setOpticalId(sources[0]?.id ?? null)
  }, [sources, opticalId])

  useEffect(() => {
    void autoConnect()
  }, [])

  // Drop saved PNG/JPG (+ .config) files anywhere to open them.
  useEffect(() => {
    let depth = 0
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes("Files")
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth++
      setDragging(true)
    }
    const leave = () => {
      depth = Math.max(0, depth - 1)
      if (!depth) setDragging(false)
    }
    const over = (e: DragEvent) => hasFiles(e) && e.preventDefault()
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth = 0
      setDragging(false)
      void openFiles(Array.from(e.dataTransfer!.files))
    }
    window.addEventListener("dragenter", enter)
    window.addEventListener("dragleave", leave)
    window.addEventListener("dragover", over)
    window.addEventListener("drop", drop)
    return () => {
      window.removeEventListener("dragenter", enter)
      window.removeEventListener("dragleave", leave)
      window.removeEventListener("dragover", over)
      window.removeEventListener("drop", drop)
    }
  }, [])

  const configSource = configuring ? registry.get(opticalId) : null

  return (
    <div className="flex h-svh min-h-[560px] flex-col">
      <Header />
      <main className="flex min-h-0 flex-1 flex-col gap-3 p-3 sm:p-4">
        <div className="flex h-[30%] min-h-36 flex-col">
          <OpticalPanel
            sources={sources}
            sourceId={opticalId}
            onSourceChange={setOpticalId}
            onConfigure={() => setConfiguring(true)}
          />
        </div>
        <AnalysisPanel sources={sources} opticalId={opticalId} />
      </main>
      {configSource && <ConfigDialog key={configSource.id} source={configSource} onClose={() => setConfiguring(false)} />}
      {dragging && (
        <div className="pointer-events-none fixed inset-3 z-50 flex items-center justify-center rounded-2xl border-2 border-dashed border-foreground/40 bg-background/70 text-sm backdrop-blur-sm">
          Drop saved spectra (.png / .jpg and .config) to open them
        </div>
      )}
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      <TooltipProvider delayDuration={400}>
        <Workspace />
        <Toaster position="bottom-center" />
      </TooltipProvider>
    </ThemeProvider>
  )
}
