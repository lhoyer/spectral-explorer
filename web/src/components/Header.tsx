import { useState } from "react"
import { CameraIcon, CircleHelpIcon, FolderOpenIcon, MoonIcon, PlusIcon, SettingsIcon, SparklesIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { addDemo, cameraSupported, connectCamera, listCameras, openFiles } from "@/lib/actions"
import { DEMOS } from "@/lib/demo"
import { CameraSource, useSources } from "@/lib/sources"
import { HelpDialog, SettingsDialog } from "./AppDialogs"
import { IconButton } from "./common"

export function Header() {
  const { resolvedTheme, setTheme } = useTheme()
  const [settings, setSettings] = useState(false)
  const [help, setHelp] = useState(false)

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3 sm:px-4">
      <LogoMark className="size-6" />
      <h1 className="text-sm font-semibold tracking-tight">Spectral Explorer</h1>
      <div className="ml-auto flex items-center gap-1">
        <AddMenu />
        <IconButton label={resolvedTheme === "dark" ? "Light mode" : "Dark mode"} onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
          {resolvedTheme === "dark" ? <SunIcon /> : <MoonIcon />}
        </IconButton>
        <IconButton label="Settings" onClick={() => setSettings(true)}>
          <SettingsIcon />
        </IconButton>
        <IconButton label="Help" onClick={() => setHelp(true)}>
          <CircleHelpIcon />
        </IconButton>
      </div>
      <SettingsDialog open={settings} onOpenChange={setSettings} />
      <HelpDialog open={help} onOpenChange={setHelp} />
    </header>
  )
}

function AddMenu() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const sources = useSources()
  const connected = new Set(sources.filter((s): s is CameraSource => s instanceof CameraSource).map((s) => s.deviceId))
  const labelled = devices.filter((d) => d.label)

  return (
    <DropdownMenu onOpenChange={(o) => o && listCameras().then(setDevices).catch(() => setDevices([]))}>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline">
          <PlusIcon /> Add
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Camera</DropdownMenuLabel>
        {!cameraSupported() && <DropdownMenuItem disabled>Camera not available in this browser</DropdownMenuItem>}
        {cameraSupported() &&
          (labelled.length ? (
            labelled.map((d) => (
              <DropdownMenuItem key={d.deviceId} disabled={connected.has(d.deviceId)} onSelect={() => connectCamera(d.deviceId)}>
                <CameraIcon />
                <span className="truncate">{d.label.replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i, "")}</span>
              </DropdownMenuItem>
            ))
          ) : (
            <DropdownMenuItem onSelect={() => connectCamera()}>
              <CameraIcon /> Connect camera…
            </DropdownMenuItem>
          ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => openFiles()}>
          <FolderOpenIcon /> Open saved spectra…
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <SparklesIcon /> Demo spectra
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {DEMOS.map((d) => (
              <DropdownMenuItem key={d.kind} onSelect={() => addDemo(d.kind)} className="flex-col items-start gap-0">
                <span>{d.name}</span>
                <span className="text-xs text-muted-foreground">{d.description}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function LogoMark({ className }: { className?: string }) {
  const bars = ["#e11d48", "#2563eb", "#16a34a", "#eab308", "#f97316"]
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <clipPath id="logo-lens">
        <circle cx="26" cy="26" r="18" />
      </clipPath>
      <g clipPath="url(#logo-lens)">
        <rect x="8" y="8" width="36" height="36" fill="#fff" />
        {bars.map((c, i) => (
          <rect key={c} x={10 + i * 7} y="6" width="5" height="40" fill={c} />
        ))}
      </g>
      <circle cx="26" cy="26" r="19.5" fill="none" stroke="currentColor" strokeWidth="5" />
      <path d="M40 40 L56 56" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
    </svg>
  )
}
