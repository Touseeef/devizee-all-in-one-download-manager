import {
    CheckSquare,
    Download,
    ListPlus,
    Loader2,
    Pause,
    Play,
    RotateCcw,
    RotateCw,
    Square,
    Volume2,
} from "lucide-react";
import type {
    DownloadRecord,
    PlaylistEntry,
    PlaylistInfo,
} from "../../types";
import type { TranslationKey } from "../../lib/i18n";
import { WaveformVisualizer } from "../common/WaveformVisualizer";

export function PlaylistPanel({
    t,
    playlistInfo,
    isLoadingPlaylist,
    showSection,
    setShowSection,
    selectedIds,
    toggleItem,
    selectAll,
    deselectAll,
    batchPreset,
    setBatchPreset,
    setBatchFormatId,
    setBatchExt,
    setBatchIsAudio,
    onBatchDownload,
    onSingleDownload,
    onPlayVideo,
    onPreviewAudio,
    previewingId,
    isAudioElementPlaying,
    isLoadingAudioId,
    previewTime,
    previewDuration,
    onSeek,
    onSeekRelative,
    onClosePreview,
    history,
    audioRef,
}: {
    t: (key: TranslationKey) => string;
    playlistInfo: PlaylistInfo | null;
    isLoadingPlaylist: boolean;
    showSection: boolean;
    setShowSection: (v: boolean) => void;
    selectedIds: Set<string>;
    toggleItem: (id: string) => void;
    selectAll: () => void;
    deselectAll: () => void;
    batchPreset: string;
    setBatchPreset: (p: string) => void;
    setBatchFormatId: (id: string) => void;
    setBatchExt: (ext: string) => void;
    setBatchIsAudio: (v: boolean) => void;
    onBatchDownload: () => void;
    onSingleDownload: (entry: PlaylistEntry, presetLabel: string) => void;
    onPlayVideo: (entry: PlaylistEntry) => void;
    onPreviewAudio: (url: string, id: string) => void;
    previewingId: string | null;
    isAudioElementPlaying: boolean;
    isLoadingAudioId: string | null;
    previewTime: number;
    previewDuration: number;
    onSeek: (s: number) => void;
    onSeekRelative: (delta: number) => void;
    onClosePreview: () => void;
    history: DownloadRecord[];
    audioRef: React.RefObject<HTMLAudioElement | null>;
}) {
    const formatSeconds = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m}:${s < 10 ? "0" : ""}${s}`;
    };

    const presetLabel = (preset: string) => {
        if (preset === "1080p") return "1080p Video";
        if (preset === "720p") return "720p Video";
        if (preset === "480p") return "480p Video";
        if (preset === "mp3") return "MP3 Audio";
        return "M4A Audio";
    };

    if (!playlistInfo && !isLoadingPlaylist) return null;

    return (
        <div className="bg-surface-1 rounded-md shadow-raised overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-fast">
            <div className="p-3.5 flex items-center justify-between border-b border-border-subtle">
                <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-md bg-accent-subtle text-accent flex items-center justify-center shrink-0">
                        {isLoadingPlaylist ? (
                            <Loader2 size={15} className="animate-spin" />
                        ) : (
                            <ListPlus size={15} />
                        )}
                    </div>
                    <div>
                        <h4 className="font-semibold text-body-sm text-primary">
                            {isLoadingPlaylist
                                ? "Resolving playlist tracks..."
                                : playlistInfo?.title}
                        </h4>
                        <p className="text-caption text-secondary">
                            {playlistInfo
                                ? `${playlistInfo.entries.length} videos detected • ${selectedIds.size} selected`
                                : "Analyzing list..."}
                        </p>
                    </div>
                </div>

                {playlistInfo && (
                    <button
                        type="button"
                        onClick={() => setShowSection(!showSection)}
                        className="px-3 py-1 rounded-md bg-surface-2 hover:bg-surface-0 text-primary text-caption font-semibold transition-colors border border-border-subtle"
                    >
                        {showSection ? "Collapse" : "Expand Playlist"}
                    </button>
                )}
            </div>

            {playlistInfo && showSection && (
                <div className="p-3.5 space-y-3 bg-surface-0/40">
                    <div className="flex flex-wrap items-center justify-between gap-3 px-1 pb-1 border-b border-border-subtle/50">
                        <div className="flex items-center gap-3 text-caption font-semibold">
                            <button
                                type="button"
                                onClick={selectAll}
                                className="px-3 py-1 rounded-md border border-border-subtle bg-surface-1 hover:bg-surface-2 flex items-center gap-1.5 text-accent shadow-sm transition-colors"
                            >
                                <CheckSquare size={13} />
                                <span>{t("select_all")}</span>
                            </button>
                            <button
                                type="button"
                                onClick={deselectAll}
                                className="px-3 py-1 rounded-md border border-border-subtle bg-surface-1 hover:bg-surface-2 flex items-center gap-1.5 text-secondary hover:text-primary shadow-sm transition-colors"
                            >
                                <Square size={13} />
                                <span>{t("deselect_all")}</span>
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            <select
                                value={batchPreset}
                                onChange={(e) => {
                                    const p = e.target.value;
                                    setBatchPreset(p);
                                    if (p === "1080p") {
                                        setBatchFormatId("bestvideo[height<=1080]+bestaudio/best[height<=1080]");
                                        setBatchExt("mp4");
                                        setBatchIsAudio(false);
                                    } else if (p === "720p") {
                                        setBatchFormatId("bestvideo[height<=720]+bestaudio/best[height<=720]");
                                        setBatchExt("mp4");
                                        setBatchIsAudio(false);
                                    } else if (p === "480p") {
                                        setBatchFormatId("bestvideo[height<=480]+bestaudio/best[height<=480]");
                                        setBatchExt("mp4");
                                        setBatchIsAudio(false);
                                    } else if (p === "mp3") {
                                        setBatchFormatId("bestaudio/best");
                                        setBatchExt("mp3");
                                        setBatchIsAudio(true);
                                    } else if (p === "m4a") {
                                        setBatchFormatId("bestaudio/best");
                                        setBatchExt("m4a");
                                        setBatchIsAudio(true);
                                    }
                                }}
                                className="bg-surface-1 border border-border-subtle text-primary rounded-md px-2.5 py-1 text-caption font-semibold outline-none cursor-pointer"
                            >
                                <option value="1080p">1080p Video (MP4)</option>
                                <option value="720p">720p Video (MP4)</option>
                                <option value="480p">480p Video (MP4)</option>
                                <option value="mp3">Audio (MP3 320k)</option>
                                <option value="m4a">Audio (M4A)</option>
                            </select>
                            <button
                                type="button"
                                disabled={selectedIds.size === 0}
                                onClick={onBatchDownload}
                                className="px-3.5 py-1 rounded-md bg-accent text-white hover:bg-accent-hover text-caption font-semibold disabled:opacity-40 transition-all shadow-sm flex items-center gap-1.5"
                            >
                                <Download size={13} />
                                <span>
                                    {t("download_selected")} ({selectedIds.size})
                                </span>
                            </button>
                        </div>
                    </div>

                    <div className="max-h-80 overflow-y-auto overflow-x-hidden space-y-2.5 px-2 py-1.5">
                        {playlistInfo.entries.map((entry, idx) => {
                            const isSelected = selectedIds.has(entry.id);
                            const isThisPreviewing = previewingId === entry.id;
                            const entryTask = history.find(
                                (h) => h.id.startsWith(entry.id) || h.url.includes(entry.id)
                            );

                            return (
                                <div
                                    key={entry.id}
                                    className={`flex flex-col p-2.5 rounded-md transition-all bg-surface-1 shadow-sm border border-border-subtle ${isSelected ? "ring-1 ring-accent border-accent/60" : ""
                                        }`}
                                >
                                    <div className="flex items-center gap-2.5">
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggleItem(entry.id)}
                                            className="w-3.5 h-3.5 rounded text-accent accent-accent cursor-pointer"
                                        />
                                        <span className="text-caption text-tertiary w-5 text-right font-mono text-[11px]">
                                            {idx + 1}
                                        </span>

                                        <div
                                            onClick={() => onPlayVideo(entry)}
                                            className="w-14 aspect-video rounded-sm overflow-hidden bg-surface-0 shrink-0 relative cursor-pointer group/thumb"
                                            title="Click to play this video directly in-app above"
                                        >
                                            <img
                                                src={
                                                    entry.thumbnail ||
                                                    `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg`
                                                }
                                                alt=""
                                                onError={(e) => {
                                                    e.currentTarget.src = `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg`;
                                                }}
                                                className="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform duration-200"
                                            />
                                            <div className="absolute inset-0 bg-black/25 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity">
                                                <Play size={12} fill="white" className="text-white ml-0.5" />
                                            </div>
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <p
                                                className="text-body-sm font-semibold text-primary truncate cursor-pointer hover:text-accent"
                                                onClick={() => onPlayVideo(entry)}
                                                title={entry.title}
                                            >
                                                {entry.title}
                                            </p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-caption text-tertiary text-[11px]">
                                                    {entry.duration_string}
                                                </span>
                                                {entryTask && (
                                                    <span
                                                        className={`text-[10px] font-semibold px-1.5 py-0.2 rounded font-mono flex items-center gap-1 ${entryTask.status === "completed"
                                                            ? "bg-status-success-subtle/30 text-status-success"
                                                            : entryTask.status === "error"
                                                                ? "bg-status-danger-subtle/30 text-status-danger"
                                                                : "bg-accent-subtle text-accent"
                                                            }`}
                                                    >
                                                        {entryTask.status === "downloading" && (
                                                            <Loader2 size={9} className="animate-spin" />
                                                        )}
                                                        {entryTask.status === "downloading"
                                                            ? `${entryTask.percent.toFixed(0)}%`
                                                            : entryTask.status === "completed"
                                                                ? "Downloaded"
                                                                : entryTask.status === "error"
                                                                    ? "Failed"
                                                                    : entryTask.status}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            disabled={
                                                entryTask?.status === "downloading" ||
                                                entryTask?.status === "starting" ||
                                                entryTask?.status === "muxing"
                                            }
                                            onClick={() => onSingleDownload(entry, presetLabel(batchPreset))}
                                            className="w-7 h-7 rounded-md bg-surface-2 hover:bg-surface-3 text-secondary hover:text-accent flex items-center justify-center shrink-0 transition-colors border border-border-subtle shadow-sm disabled:opacity-40"
                                            title="Download this track directly"
                                        >
                                            <Download size={12} />
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => onPreviewAudio(entry.url, entry.id)}
                                            className="w-7 h-7 rounded-md bg-surface-2 hover:bg-surface-3 text-accent flex items-center justify-center shrink-0 transition-colors border border-border-subtle shadow-sm"
                                            title="Listen audio preview"
                                        >
                                            {isLoadingAudioId === entry.id ? (
                                                <Loader2 size={12} className="animate-spin" />
                                            ) : isThisPreviewing && isAudioElementPlaying ? (
                                                <Pause size={12} fill="currentColor" />
                                            ) : (
                                                <Play size={12} fill="currentColor" />
                                            )}
                                        </button>
                                    </div>

                                    {entryTask &&
                                        (entryTask.status === "downloading" ||
                                            entryTask.status === "muxing") && (
                                            <div className="h-1 bg-surface-2 rounded-full overflow-hidden mt-2 ml-7 mr-1">
                                                <div
                                                    className="h-full bg-accent transition-all duration-fast"
                                                    style={{ width: `${entryTask.percent}%` }}
                                                />
                                            </div>
                                        )}

                                    {isThisPreviewing && (
                                        <div className="mt-2 pl-8 pr-1 space-y-1.5">
                                            <div className="flex items-center justify-between text-caption text-secondary font-mono text-[10px]">
                                                <span className="flex items-center gap-1.5 text-accent font-semibold">
                                                    <Volume2 size={11} /> Playing Preview
                                                    <WaveformVisualizer
                                                        mediaElement={audioRef.current}
                                                        isPlaying={isAudioElementPlaying}
                                                    />
                                                </span>
                                                <span>
                                                    {formatSeconds(previewTime)} / {formatSeconds(previewDuration || 0)}
                                                </span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0"
                                                max={previewDuration || 100}
                                                step="0.5"
                                                value={previewTime}
                                                onChange={(e) => onSeek(parseFloat(e.target.value))}
                                                className="w-full h-1 bg-surface-0 accent-accent cursor-pointer rounded-full outline-none"
                                            />
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => onSeekRelative(-5)}
                                                        className="text-[10px] text-secondary hover:text-primary flex items-center gap-0.5"
                                                    >
                                                        <RotateCcw size={9} /> -5s
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => onSeekRelative(5)}
                                                        className="text-[10px] text-secondary hover:text-primary flex items-center gap-0.5"
                                                    >
                                                        +5s <RotateCw size={9} />
                                                    </button>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={onClosePreview}
                                                    className="text-[10px] text-secondary hover:text-status-danger"
                                                >
                                                    Close Preview
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}