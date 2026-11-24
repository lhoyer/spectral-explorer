import { useCallback, useEffect, useLayoutEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import type { Source } from "@/lib/sources"

export type Point = { x: number; y: number }
export type RenderFn = (ctx: CanvasRenderingContext2D, w: number, h: number, mouse: Point | null) => void

interface PlotProps {
  render: RenderFn
  /** Redraw whenever one of these sources produces new data. */
  sources?: (Source | null | undefined)[]
  trackMouse?: boolean
  onPlotPointer?: (p: Point, e: React.PointerEvent<HTMLCanvasElement>) => void
  onPlotContextMenu?: (p: Point, e: React.MouseEvent<HTMLCanvasElement>) => void
  className?: string
  "aria-label"?: string
}

/** A HiDPI canvas that redraws on resize, theme change and source updates. */
export function Plot({ render, sources = [], trackMouse, onPlotPointer, onPlotContextMenu, className, ...aria }: PlotProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  const renderRef = useRef(render)
  const mouse = useRef<Point | null>(null)
  const size = useRef({ w: 0, h: 0 })
  const raf = useRef(0)

  const draw = useCallback(() => {
    const c = ref.current
    if (!c || !size.current.w || !size.current.h) return
    const ctx = c.getContext("2d")!
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    renderRef.current(ctx, size.current.w, size.current.h, mouse.current)
  }, [])

  const invalidate = useCallback(() => {
    if (raf.current) return
    raf.current = requestAnimationFrame(() => {
      raf.current = 0
      draw()
    })
  }, [draw])

  useLayoutEffect(() => {
    renderRef.current = render
    invalidate()
  }, [render, invalidate])

  useEffect(() => {
    const c = ref.current!
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      const dpr = window.devicePixelRatio || 1
      c.width = Math.max(1, Math.round(width * dpr))
      c.height = Math.max(1, Math.round(height * dpr))
      size.current = { w: width, h: height }
      draw()
    })
    ro.observe(c)
    const mo = new MutationObserver(invalidate)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => {
      ro.disconnect()
      mo.disconnect()
      cancelAnimationFrame(raf.current)
      raf.current = 0
    }
  }, [draw, invalidate])

  const ids = sources.map((s) => s?.id ?? "").join(",")
  useEffect(() => {
    const offs = sources.filter((s): s is Source => !!s).map((s) => s.changed.on(invalidate))
    invalidate()
    return () => offs.forEach((off) => off())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, invalidate])

  const pos = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  return (
    <canvas
      ref={ref}
      role="img"
      {...aria}
      className={cn("block size-full", className)}
      onPointerMove={
        trackMouse
          ? (e) => {
              mouse.current = pos(e)
              invalidate()
            }
          : undefined
      }
      onPointerLeave={
        trackMouse
          ? () => {
              mouse.current = null
              invalidate()
            }
          : undefined
      }
      onPointerDown={onPlotPointer ? (e) => e.button === 0 && onPlotPointer(pos(e), e) : undefined}
      onContextMenu={
        onPlotContextMenu
          ? (e) => {
              e.preventDefault()
              onPlotContextMenu(pos(e), e)
            }
          : undefined
      }
    />
  )
}
