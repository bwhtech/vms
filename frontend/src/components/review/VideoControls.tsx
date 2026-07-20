import { Button, buttonVariants } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { formatTimecode } from "@/hooks/useVideoPlayer"
import { Maximize, Minimize, Pause, Play, Repeat, RotateCcw, RotateCw, Volume1, Volume2, VolumeX } from "lucide-react"

const SPEED_OPTIONS = [0.5, 1, 1.5, 2]

interface VideoControlsProps {
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  isMuted: boolean
  playbackRate: number
  isLooping: boolean
  onTogglePlay: () => void
  onToggleMute: () => void
  onVolumeChange: (vol: number) => void
  onPlaybackRateChange: (rate: number) => void
  onToggleLoop: () => void
  isFullscreen: boolean
  onToggleFullscreen: () => void
  onSkipBackward: () => void
  onSkipForward: () => void
  popoverContainer?: HTMLElement | null
}

export function VideoControls({
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  playbackRate,
  isLooping,
  onTogglePlay,
  onToggleMute,
  onVolumeChange,
  onPlaybackRateChange,
  onToggleLoop,
  isFullscreen,
  onToggleFullscreen,
  onSkipBackward,
  onSkipForward,
  popoverContainer,
}: VideoControlsProps) {
  const VolumeIcon = isMuted || volume === 0
    ? VolumeX
    : volume < 0.5
      ? Volume1
      : Volume2

  return (
    <div className="flex items-center gap-1 px-2 py-1.5">
      <Button variant="ghost" size="icon-sm" onClick={onSkipBackward} title="Skip back 10s (←)">
        <RotateCcw size={18} />
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={onTogglePlay}>
        {isPlaying ? <Pause size={18} /> : <Play size={18} />}
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={onSkipForward} title="Skip forward 10s (→)">
        <RotateCw size={18} />
      </Button>

      <div className="hidden items-center gap-1 md:flex">
        <Button variant="ghost" size="icon-sm" onClick={onToggleMute}>
          <VolumeIcon size={18} />
        </Button>
        <input
          type="range"
          min={0}
          max={100}
          value={isMuted ? 0 : Math.round(volume * 100)}
          onChange={(e) => onVolumeChange(Number(e.target.value) / 100)}
          className="w-20 h-1.5 appearance-none rounded-full bg-white/20 cursor-pointer accent-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-sm"
        />
      </div>

      <div className="mx-1 font-mono text-[10px] text-muted-foreground select-none md:text-xs">
        {formatTimecode(currentTime)} / {formatTimecode(duration)}
      </div>

      <div className="ml-auto flex items-center gap-1">
        <Popover>
          <PopoverTrigger
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "hidden font-mono text-xs md:inline-flex cursor-pointer"
            )}
          >
            {playbackRate}x
          </PopoverTrigger>
          <PopoverContent className="w-auto min-w-0 p-1" align="end" container={popoverContainer}>
            <div className="flex flex-col">
              {SPEED_OPTIONS.map((rate) => (
                <Button
                  key={rate}
                  variant={playbackRate === rate ? "secondary" : "ghost"}
                  size="sm"
                  className="justify-start font-mono text-xs"
                  onClick={() => onPlaybackRateChange(rate)}
                >
                  {rate}x
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggleLoop}
          className={`hidden md:inline-flex ${isLooping ? "text-primary" : "text-muted-foreground"}`}
        >
          <Repeat size={18} />
        </Button>

        <Button variant="ghost" size="icon-sm" onClick={onToggleFullscreen}>
          {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
        </Button>
      </div>
    </div>
  )
}
