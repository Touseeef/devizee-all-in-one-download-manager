import { Music, Pause, Play } from "lucide-react";
import type { RefObject } from "react";
import type { DownloadRecord } from "../../types";
import { WaveformVisualizer } from "../common/WaveformVisualizer";

export function MiniPlayerBar({
    track,
    isPlaying,
    onPlayPause,
    onOpenAudioHub,
    audioRef,
}: {
    track: DownloadRecord;
    isPlaying: boolean;
    onPlayPause: () => void;
    onOpenAudioHub: () => void;
    audioRef: RefObject<HTMLAudioElement | null>;
}) {
    return (
        <div className="bg-surface-1 rounded-xl border border-accent/30 px-4 py-2.5 flex items-center gap-3 animate-in fade-in duration-fast">
            <div className="w-8 h-8 rounded-md bg-accent-subtle text-accent flex items-center justify-center shrink-0">
                <Music size={14} />
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <p
                        className="text-body-sm font-semibold text-primary truncate"
                        title={track.title}
                    >
                        {track.title}
                    </p>
                    {isPlaying && (
                        <WaveformVisualizer mediaElement={audioRef.current} isPlaying={isPlaying} />
                    )}
                </div>
                <p className="text-caption text-tertiary text-[11px]">Now playing</p>
            </div>
            <button
                onClick={onPlayPause}
                className="w-9 h-9 rounded-full bg-accent hover:bg-accent-hover text-white flex items-center justify-center transition-transform hover:scale-105 active:scale-95 shrink-0"
                title={isPlaying ? "Pause" : "Play"}
            >
                {isPlaying ? (
                    <Pause size={14} fill="currentColor" />
                ) : (
                    <Play size={14} fill="currentColor" className="ml-0.5" />
                )}
            </button>
            <button
                onClick={onOpenAudioHub}
                className="text-caption text-accent font-semibold hover:underline shrink-0 px-2"
                title="Open the full Audio Hub player"
            >
                Audio Hub →
            </button>
        </div>
    );
}