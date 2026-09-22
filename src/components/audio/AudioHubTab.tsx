// src/components/audio/AudioHubTab.tsx
import { useState } from "react";
import type { RefObject } from "react";
import {
    Download,
    Folder,
    Loader2,
    Music,
    Pause,
    Play,
    Repeat,
    Repeat1,
    Shuffle,
    SkipBack,
    SkipForward,
    Trash2,
} from "lucide-react";
import type { DownloadRecord } from "../../types";
import type { TranslationKey } from "../../lib/i18n";
import { WaveformVisualizer } from "../common/WaveformVisualizer";

export function AudioHubTab({
    t,
    history,
    isAudioFormat,
    handleStartDownload,
    openFolder,
    openFile,
    handleDeleteFile,
    audioRef,
    activeAudioPlaying,
    isAudioElementPlaying,
    onPlayItem,
    onPlayPause,
    onNext,
    onPrev,
    onSeek,
    previewTime,
    previewDuration,
    audioShuffle,
    audioRepeat,
    onToggleShuffle,
    onCycleRepeat,
    formatSeconds,
}: {
    t: (key: TranslationKey) => string;
    history: DownloadRecord[];
    isAudioFormat: (fmt: string) => boolean;
    handleStartDownload: (
        formatId: string,
        ext: string,
        isAudio: boolean,
        specificInfo?: any,
        formatLabel?: string,
        duplicateAction?: "overwrite" | "keep_both"
    ) => Promise<void>;
    openFolder: (path?: string | null) => void;
    openFile: (path?: string | null) => void;
    handleDeleteFile: (id: string, filePath: string | null) => void;
    audioRef: RefObject<HTMLAudioElement | null>;
    activeAudioPlaying: DownloadRecord | null;
    isAudioElementPlaying: boolean;
    onPlayItem: (item: DownloadRecord) => void;
    onPlayPause: () => void;
    onNext: () => void;
    onPrev: () => void;
    onSeek: (seconds: number) => void;
    previewTime: number;
    previewDuration: number;
    audioShuffle: boolean;
    audioRepeat: "off" | "all" | "one";
    onToggleShuffle: () => void;
    onCycleRepeat: () => void;
    formatSeconds: (secs: number) => string;
}) {
    const [audioHubUrl, setAudioHubUrl] = useState("");
    const [audioHubFormat, setAudioHubFormat] = useState("mp3");

    const audioHistory = history.filter(
        (h) => h.status === "completed" && isAudioFormat(h.format)
    );

    const activeConversions = history.filter(
        (h) =>
            isAudioFormat(h.format) &&
            (h.status === "starting" ||
                h.status === "downloading" ||
                h.status === "muxing")
    );

    const repeatActive = audioRepeat !== "off";

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-150">
            {/* Header + Quick Converter Card */}
            <div className="bg-surface-1 rounded-xl border border-border-subtle p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-md bg-accent text-white flex items-center justify-center">
                            <Music size={16} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-body text-primary">
                                {t("audio_hub_title")}
                            </h3>
                            <p className="text-caption text-secondary">{t("audio_hub_sub")}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => openFolder(null)}
                        className="px-3 py-1.5 rounded-md bg-surface-2 hover:bg-surface-3 text-caption font-semibold text-primary flex items-center gap-1.5 transition-colors border border-border-subtle"
                        title="Open Audio Directory in Explorer"
                    >
                        <Folder size={13} />
                        <span>Open Audio Folder</span>
                    </button>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                    <input
                        type="text"
                        placeholder={t("audio_hub_input")}
                        value={audioHubUrl}
                        onChange={(e) => setAudioHubUrl(e.target.value)}
                        className="flex-1 bg-surface-0 border border-border-subtle rounded-md px-3.5 py-2 text-body-sm text-primary outline-none focus:border-accent"
                    />
                    <select
                        value={audioHubFormat}
                        onChange={(e) => setAudioHubFormat(e.target.value)}
                        className="bg-surface-2 border border-border-subtle text-primary rounded-md px-3 py-2 text-caption font-semibold outline-none cursor-pointer"
                    >
                        <option value="mp3">MP3 (320 kbps)</option>
                        <option value="m4a">M4A / AAC (256 kbps)</option>
                        <option value="flac">FLAC (Lossless)</option>
                        <option value="opus">Opus (160 kbps)</option>
                    </select>
                    <button
                        type="button"
                        disabled={!audioHubUrl.trim()}
                        onClick={() => {
                            handleStartDownload("bestaudio/best", audioHubFormat, true, {
                                id: `audio-${Date.now()}`,
                                url: audioHubUrl.trim(),
                                title: `Audio Track (${audioHubFormat.toUpperCase()})`,
                            });
                            setAudioHubUrl("");
                        }}
                        className="bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-md font-semibold text-caption transition-all disabled:opacity-40 flex items-center gap-1.5"
                    >
                        <Download size={14} />
                        <span>{t("audio_hub_rip")}</span>
                    </button>
                </div>
            </div>

            {/* Active Conversions */}
            {activeConversions.length > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-caption font-semibold text-secondary uppercase tracking-wider">
                        <Loader2 size={12} className="animate-spin text-accent" />
                        <span>Active Conversions ({activeConversions.length})</span>
                    </div>
                    {activeConversions.map((task) => (
                        <div
                            key={task.id}
                            className="p-3 bg-surface-1 border border-accent/30 rounded-lg space-y-2 animate-in fade-in duration-fast"
                        >
                            <div className="flex items-center justify-between text-caption font-semibold">
                                <div className="flex items-center gap-2 truncate">
                                    <Music size={13} className="text-accent shrink-0" />
                                    <span className="text-primary truncate">{task.title}</span>
                                </div>
                                <span className="text-secondary font-mono text-[11px] shrink-0">
                                    {task.speed || ""} {task.eta ? `• ETA: ${task.eta}` : ""}
                                </span>
                            </div>
                            <div className="h-1.5 bg-surface-0 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-accent transition-all duration-fast"
                                    style={{ width: `${task.percent}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Offline Music Library */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-body font-semibold text-primary">
                        {t("audio_library")}
                    </h3>
                    <span className="text-caption text-secondary">
                        {audioHistory.length} tracks logged
                    </span>
                </div>

                {audioHistory.length === 0 ? (
                    <div className="py-12 text-center bg-surface-1 rounded-xl border border-border-subtle space-y-2">
                        <Music size={24} className="mx-auto text-tertiary" />
                        <p className="text-body-sm text-secondary font-medium">
                            {t("audio_library_empty")}
                        </p>
                        <p className="text-caption text-tertiary">
                            {t("audio_library_empty_sub")}
                        </p>
                    </div>
                ) : (
                    <div className="bg-surface-1 rounded-xl border border-border-subtle overflow-hidden">
                        {audioHistory.map((item) => {
                            const isActive = activeAudioPlaying?.id === item.id;
                            return (
                                <div
                                    key={item.id}
                                    className={`flex items-center justify-between gap-4 px-4 py-3 border-b border-border-subtle last:border-b-0 transition-colors ${isActive ? "bg-accent-subtle/40" : "hover:bg-surface-2/40"
                                        }`}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <button
                                            onClick={() => onPlayItem(item)}
                                            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-transform hover:scale-105 active:scale-95 ${isActive
                                                ? "bg-accent text-white"
                                                : "bg-surface-2 text-primary hover:bg-accent hover:text-white"
                                                }`}
                                            title={isActive && isAudioElementPlaying ? "Pause" : "Play"}
                                        >
                                            {isActive && isAudioElementPlaying ? (
                                                <Pause size={13} fill="currentColor" />
                                            ) : (
                                                <Play size={13} fill="currentColor" />
                                            )}
                                        </button>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p
                                                    className={`text-body-sm font-semibold truncate cursor-pointer ${isActive ? "text-accent" : "text-primary hover:text-accent"
                                                        }`}
                                                    onDoubleClick={() => openFile(item.file_path)}
                                                    title={item.title}
                                                >
                                                    {item.title}
                                                </p>
                                                {isActive && isAudioElementPlaying && (
                                                    <WaveformVisualizer
                                                        mediaElement={audioRef.current}
                                                        isPlaying={isAudioElementPlaying}
                                                        onSeek={onSeek}
                                                    />
                                                )}
                                            </div>
                                            <span className="text-caption text-tertiary text-[11px]">
                                                {item.format.toUpperCase()}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Always-visible actions */}
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button
                                            onClick={() => openFile(item.file_path)}
                                            className="w-7 h-7 rounded-md text-tertiary hover:text-primary hover:bg-surface-2 flex items-center justify-center transition-colors"
                                            title="Open file directly"
                                        >
                                            <Play size={12} fill="currentColor" />
                                        </button>
                                        <button
                                            onClick={() => openFolder(item.file_path)}
                                            className="w-7 h-7 rounded-md text-tertiary hover:text-primary hover:bg-surface-2 flex items-center justify-center transition-colors"
                                            title="Show in folder"
                                        >
                                            <Folder size={12} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteFile(item.id, item.file_path)}
                                            className="w-7 h-7 rounded-md text-tertiary hover:text-status-danger hover:bg-status-danger-subtle flex items-center justify-center transition-colors"
                                            title="Delete from disk"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Player bar — appears below the library when a track is playing */}
            {activeAudioPlaying && (
                <div className="bg-surface-1 rounded-xl border border-accent/30 p-4 space-y-3 animate-in fade-in duration-fast">
                    <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-md bg-accent-subtle text-accent flex items-center justify-center shrink-0">
                            <Music size={18} />
                        </div>

                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <p
                                    className="text-body-sm font-semibold text-primary truncate"
                                    title={activeAudioPlaying.title}
                                >
                                    {activeAudioPlaying.title}
                                </p>
                                {isAudioElementPlaying && (
                                    <WaveformVisualizer
                                        mediaElement={audioRef.current}
                                        isPlaying={isAudioElementPlaying}
                                        onSeek={onSeek}
                                    />
                                )}
                            </div>
                            <p className="text-caption text-secondary">
                                {activeAudioPlaying.format.toUpperCase()}
                            </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                            <button
                                type="button"
                                onClick={onToggleShuffle}
                                className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${audioShuffle
                                    ? "text-accent bg-accent-subtle"
                                    : "text-secondary hover:text-primary hover:bg-surface-2"
                                    }`}
                                title={audioShuffle ? "Shuffle on" : "Shuffle off"}
                            >
                                <Shuffle size={14} />
                            </button>

                            <button
                                type="button"
                                onClick={onPrev}
                                className="w-9 h-9 rounded-md text-primary hover:bg-surface-2 flex items-center justify-center transition-colors"
                                title="Previous track"
                            >
                                <SkipBack size={16} fill="currentColor" />
                            </button>

                            <button
                                type="button"
                                onClick={onPlayPause}
                                className="w-10 h-10 rounded-full bg-accent hover:bg-accent-hover text-white flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
                                title={isAudioElementPlaying ? "Pause" : "Play"}
                            >
                                {isAudioElementPlaying ? (
                                    <Pause size={15} fill="currentColor" />
                                ) : (
                                    <Play size={15} fill="currentColor" className="ml-0.5" />
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={onNext}
                                className="w-9 h-9 rounded-md text-primary hover:bg-surface-2 flex items-center justify-center transition-colors"
                                title="Next track"
                            >
                                <SkipForward size={16} fill="currentColor" />
                            </button>

                            <button
                                type="button"
                                onClick={onCycleRepeat}
                                className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${repeatActive
                                    ? "text-accent bg-accent-subtle"
                                    : "text-secondary hover:text-primary hover:bg-surface-2"
                                    }`}
                                title={
                                    audioRepeat === "off"
                                        ? "Repeat off"
                                        : audioRepeat === "all"
                                            ? "Repeat all"
                                            : "Repeat one"
                                }
                            >
                                {audioRepeat === "one" ? <Repeat1 size={14} /> : <Repeat size={14} />}
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 text-caption text-tertiary font-mono text-[11px]">
                        <span className="w-10 text-right">{formatSeconds(previewTime)}</span>
                        <input
                            type="range"
                            min="0"
                            max={previewDuration || 100}
                            step="0.5"
                            value={previewTime}
                            onChange={(e) => onSeek(parseFloat(e.target.value))}
                            className="flex-1 h-1 bg-surface-2 accent-accent cursor-pointer rounded-full"
                        />
                        <span className="w-10">{formatSeconds(previewDuration || 0)}</span>
                    </div>
                </div>
            )}
        </div>
    );
}