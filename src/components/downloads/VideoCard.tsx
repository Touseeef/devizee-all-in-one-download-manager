import type { RefObject } from "react";
import {
    AlertCircle,
    CheckCircle2,
    Download,
    Loader2,
    Maximize2,
    Minimize2,
    Pause,
    Play,
    RotateCcw,
    RotateCw,
    Scissors,
    Volume1,
    Volume2,
    VolumeX,
    X,
} from "lucide-react";
import type { DownloadRecord, FormatOption, VideoInfo } from "../../types";
import { ERROR_MESSAGES } from "../../status";
import type { TranslationKey } from "../../lib/i18n";
import { WaveformVisualizer } from "../common/WaveformVisualizer";

export type VideoManagerApi = {
    // Playback
    handleVideoEnded: () => void;
    activeVideoPlaying: boolean;
    isVideoLoading: boolean;
    videoStreamUrl: string | null;
    videoFullscreen: boolean;
    videoContainerRef: RefObject<HTMLDivElement | null>;
    videoElementRef: RefObject<HTMLVideoElement | null>;
    iframeRef: RefObject<HTMLIFrameElement | null>;
    // Audio preview
    previewingId: string | null;
    isAudioElementPlaying: boolean;
    isLoadingAudioId: string | null;
    previewTime: number;
    previewDuration: number;
    audioRef: RefObject<HTMLAudioElement | null>;
    // Volume
    volume: number;
    isMuted: boolean;
    // Trimming
    isTrimming: boolean;
    setIsTrimming: (v: boolean) => void;
    trimStart: string;
    setTrimStart: (v: string) => void;
    trimEnd: string;
    setTrimEnd: (v: string) => void;
    // Actions
    handlePlayVideo: (v: { id: string; url: string; title: string; thumbnail: string; duration_string: string }) => void;
    toggleFullscreen: () => void;
    handleCloseVideoPlayer: () => void;
    exitFullscreenAndKeepPlaying: () => void;
    sendIframeCommand: (func: string, args?: any[]) => void;
    toggleAudioPreview: (url: string, id: string) => void;
    handleSeek: (s: number) => void;
    handleSeekRelative: (delta: number) => void;
    toggleMute: () => void;
    handleVolumeChange: (v: number) => void;
    adjustTrimTimestamp: (cur: string, setter: (v: string) => void, delta: number) => void;
    handleStartDownload: (
        formatId: string,
        ext: string,
        isAudio: boolean,
        specificInfo?: any,
        formatLabel?: string,
        duplicateAction?: "overwrite" | "keep_both"
    ) => Promise<void>;
    handleRetryDownload: (r: DownloadRecord) => void;
    openFile: (path?: string | null) => void;
    formatSeconds: (secs: number) => string;
    setisAudioElementPlaying: (v: boolean) => void;
    setPreviewingId: (v: string | null) => void;
    setNowPlaying: (v: { type: "none" | "audio" | "video"; id: string | null }) => void;
    setActiveVideoPlaying: (v: boolean) => void;
    nowPlaying: { type: "none" | "audio" | "video"; id: string | null };
};

export function VideoCard({
    videoInfo,
    settings,
    selectedFormat,
    setSelectedFormat,
    activeCardTask,
    onDismissProgress,
    t,
    vm,
}: {
    videoInfo: VideoInfo;
    settings: any;
    selectedFormat: FormatOption | null;
    setSelectedFormat: (f: FormatOption) => void;
    activeCardTask: DownloadRecord | null | undefined;
    onDismissProgress: () => void;
    t: (key: TranslationKey) => string;
    vm: VideoManagerApi;
}) {
    const {
        activeVideoPlaying,
        isVideoLoading,
        videoStreamUrl,
        videoFullscreen,
        videoContainerRef,
        videoElementRef,
        iframeRef,
        previewingId,
        isAudioElementPlaying,
        isLoadingAudioId,
        previewTime,
        previewDuration,
        audioRef,
        volume,
        isMuted,
        isTrimming,
        setIsTrimming,
        trimStart,
        setTrimStart,
        trimEnd,
        setTrimEnd,
        handlePlayVideo,
        handleVideoEnded,
        toggleFullscreen,
        handleCloseVideoPlayer,
        exitFullscreenAndKeepPlaying,
        sendIframeCommand,
        toggleAudioPreview,
        handleSeek,
        handleSeekRelative,
        toggleMute,
        handleVolumeChange,
        adjustTrimTimestamp,
        handleStartDownload,
        handleRetryDownload,
        openFile,
        formatSeconds,
        setisAudioElementPlaying,
        setPreviewingId,
        setNowPlaying,
        nowPlaying,
    } = vm;

    return (
        <div className="bg-surface-1 rounded-xl p-5 border border-border-subtle relative overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-fast">            <div className="flex flex-col sm:flex-row gap-4">
            {/* Interactive Thumbnail / In-App Video Player */}
            <div
                ref={videoContainerRef}
                className="w-full sm:w-64 aspect-video rounded-md overflow-hidden bg-black shrink-0 relative shadow-sm group"
            >
                {activeVideoPlaying ? (
                    <div className="w-full h-full relative flex items-center justify-center bg-black">
                        {isVideoLoading ? (
                            <div className="flex flex-col items-center gap-2 text-white text-caption">
                                <Loader2 size={24} className="animate-spin text-accent" />
                                <span>Buffering video stream...</span>
                            </div>
                        ) : videoStreamUrl ? (
                            <video
                                key={`vid-${videoInfo.id}`}
                                ref={videoElementRef}
                                src={videoStreamUrl}
                                controls
                                autoPlay={settings.autoplay}
                                preload="auto"
                                onEnded={handleVideoEnded}
                                onPlay={() => {
                                    if (audioRef.current) audioRef.current.pause();
                                    setisAudioElementPlaying(false);
                                    setPreviewingId(null);
                                    setNowPlaying({ type: "video", id: videoInfo.id });
                                }}
                                onPause={() => {
                                    if (nowPlaying.type === "video") {
                                        setNowPlaying({ type: "none", id: null });
                                    }
                                }}
                                onVolumeChange={(e) => {
                                    const v = (e.target as HTMLVideoElement).volume;
                                    const m = (e.target as HTMLVideoElement).muted;
                                    if (m !== isMuted) {
                                        // handled by App via props; kept minimal here
                                    }
                                    if (!m && Math.abs(v - volume) > 0.02) {
                                        handleVolumeChange(v);
                                    }
                                }}
                                className="w-full h-full object-contain"
                            />
                        ) : (
                            <iframe
                                ref={iframeRef}
                                src={`https://www.youtube-nocookie.com/embed/${videoInfo.id}?enablejsapi=1&origin=${encodeURIComponent(
                                    window.location.origin
                                )}&autoplay=0&rel=0&modestbranding=1&playsinline=1`}
                                title={videoInfo.title}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                                allowFullScreen
                                onLoad={() => {
                                    const effective = isMuted ? 0 : volume;
                                    sendIframeCommand("setVolume", [Math.round(effective * 100)]);
                                    if (isMuted || effective === 0) {
                                        sendIframeCommand("mute");
                                    } else {
                                        sendIframeCommand("unMute");
                                    }
                                }}
                                className="w-full h-full border-0"
                            />
                        )}

                        <div className="absolute top-2 right-2 flex items-center gap-2 z-20 bg-black/70 backdrop-blur-md px-2 py-1.5 rounded-lg border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="flex items-center gap-1.5 pr-1 border-r border-white/15">
                                <button
                                    type="button"
                                    onClick={toggleMute}
                                    className="w-7 h-7 rounded-md bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                                    title={isMuted ? "Unmute" : "Mute"}
                                >
                                    {isMuted || volume === 0 ? (
                                        <VolumeX size={13} />
                                    ) : volume < 0.5 ? (
                                        <Volume1 size={13} />
                                    ) : (
                                        <Volume2 size={13} />
                                    )}
                                </button>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={isMuted ? 0 : volume}
                                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                                    className="w-16 h-1 bg-white/30 accent-accent cursor-pointer rounded-full"
                                />
                            </div>

                            <button
                                type="button"
                                onClick={toggleFullscreen}
                                className="w-7 h-7 rounded-md bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                                title={videoFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                            >
                                {videoFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (videoFullscreen) exitFullscreenAndKeepPlaying();
                                    else handleCloseVideoPlayer();
                                }}
                                className="w-7 h-7 rounded-md bg-white/10 hover:bg-status-danger/80 text-white flex items-center justify-center transition-colors"
                                title={videoFullscreen ? "Exit Fullscreen (Minimize)" : "Close Video Player"}
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>
                ) : (
                    <div
                        className="w-full h-full relative cursor-pointer"
                        onClick={() => handlePlayVideo(videoInfo)}
                        title="Click to play video directly in app"
                    >
                        <img
                            src={videoInfo.thumbnail}
                            alt="Thumbnail"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                                e.currentTarget.src = `https://i.ytimg.com/vi/${videoInfo.id}/hqdefault.jpg`;
                            }}
                        />
                        <div className="absolute inset-0 bg-black/25 group-hover:bg-black/35 flex items-center justify-center transition-colors">
                            <div className="w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center shadow-floating group-hover:scale-110 transition-transform">
                                <Play size={18} fill="currentColor" className="ml-0.5" />
                            </div>
                        </div>
                        <div className="absolute bottom-1.5 right-1.5 bg-black/80 text-white font-mono text-[10px] px-1.5 py-0.5 rounded shadow-sm">
                            {videoInfo.duration_string}
                        </div>
                        <div className="absolute top-1.5 left-1.5 bg-black/75 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                            Play In-App
                        </div>
                    </div>
                )}
            </div>

            <div className="flex-1 flex flex-col justify-between">
                <div>
                    <div className="flex items-start justify-between gap-3">
                        <h3 className="text-body font-semibold leading-snug line-clamp-2 text-primary">
                            {videoInfo.title}
                        </h3>
                        <div className="flex items-center gap-2 shrink-0">
                            {/* Listen button — hidden when player strip is showing */}
                            {previewingId !== videoInfo.id && (
                                <button
                                    type="button"
                                    onClick={() => toggleAudioPreview(videoInfo.url, videoInfo.id)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent hover:bg-accent-hover text-white font-semibold text-caption shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                                    title="Preview audio before downloading"
                                >
                                    {isLoadingAudioId === videoInfo.id ? (
                                        <Loader2 size={13} className="animate-spin" />
                                    ) : (
                                        <Play size={13} fill="currentColor" />
                                    )}
                                    <span>{t("preview_audio")}</span>
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={() => {
                                    setIsTrimming(!isTrimming);
                                    if (!trimEnd && videoInfo.duration_string !== "--:--") {
                                        setTrimEnd(videoInfo.duration_string);
                                    }
                                }}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-semibold text-caption transition-all border border-border-subtle ${isTrimming
                                    ? "bg-accent text-white shadow-sm"
                                    : "bg-surface-2 hover:bg-surface-0 text-secondary hover:text-primary"
                                    }`}
                                title="Trim start/end clip before downloading"
                            >
                                <Scissors size={12} />
                                <span>{isTrimming ? "Trimming" : "Trim Clip"}</span>
                            </button>
                        </div>

                    </div>

                    <p className="text-secondary text-caption mt-0.5">{videoInfo.uploader}</p>

                    {previewingId === videoInfo.id && (
                        <div className="mt-2.5 p-3 rounded-md bg-surface-0 border border-border-subtle space-y-2.5 animate-in fade-in duration-fast">
                            <div className="flex items-center justify-between text-caption text-secondary font-mono text-[11px]">
                                <span className="flex items-center gap-1.5 font-semibold text-primary">
                                    <Volume2 size={13} className="text-accent" /> In-line Audio Preview
                                    <WaveformVisualizer
                                        mediaElement={audioRef.current}
                                        isPlaying={isAudioElementPlaying}
                                        onSeek={handleSeek}
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
                                onChange={(e) => handleSeek(parseFloat(e.target.value))}
                                className="w-full h-1.5 bg-surface-2 accent-accent cursor-pointer rounded-full outline-none"
                            />

                            <div className="flex items-center justify-between pt-1">
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleSeekRelative(-5)}
                                        className="w-7 h-7 rounded-md bg-surface-2 hover:bg-surface-3 text-secondary hover:text-primary flex items-center justify-center transition-colors border border-border-subtle shadow-sm"
                                        title="Rewind 5 seconds"
                                    >
                                        <RotateCcw size={12} />
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => toggleAudioPreview(videoInfo.url, videoInfo.id)}
                                        className="px-3.5 py-1.5 rounded-md bg-accent hover:bg-accent-hover text-white text-caption font-semibold flex items-center gap-1.5 shadow-sm transition-transform hover:scale-[1.03] active:scale-[0.97]"
                                    >
                                        {isAudioElementPlaying ? (
                                            <Pause size={12} fill="currentColor" />
                                        ) : (
                                            <Play size={12} fill="currentColor" />
                                        )}
                                        <span>{isAudioElementPlaying ? "Stop" : "Play"}</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleSeekRelative(5)}
                                        className="w-7 h-7 rounded-md bg-surface-2 hover:bg-surface-3 text-secondary hover:text-primary flex items-center justify-center transition-colors border border-border-subtle shadow-sm"
                                        title="Forward 5 seconds"
                                    >
                                        <RotateCw size={12} />
                                    </button>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={toggleMute}
                                            className="w-7 h-7 rounded-md bg-surface-2 hover:bg-surface-3 text-secondary hover:text-primary flex items-center justify-center transition-colors border border-border-subtle shadow-sm"
                                        >
                                            {isMuted || volume === 0 ? (
                                                <VolumeX size={13} />
                                            ) : volume < 0.5 ? (
                                                <Volume1 size={13} />
                                            ) : (
                                                <Volume2 size={13} />
                                            )}
                                        </button>
                                        <input
                                            type="range"
                                            min="0"
                                            max="1"
                                            step="0.05"
                                            value={isMuted ? 0 : volume}
                                            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                                            className="w-16 h-1 bg-surface-2 accent-accent cursor-pointer rounded-full"
                                        />
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (audioRef.current) audioRef.current.pause();
                                            setisAudioElementPlaying(false);
                                            setPreviewingId(null);
                                            setNowPlaying({ type: "none", id: null });
                                        }}
                                        className="w-7 h-7 rounded-md bg-surface-2 hover:bg-surface-3 text-secondary hover:text-status-danger flex items-center justify-center transition-colors border border-border-subtle shadow-sm"
                                        title="Close audio preview"
                                    >
                                        <X size={13} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {isTrimming && (
                        <div className="mt-2.5 p-3 rounded-md bg-surface-0 border border-border-subtle space-y-2 animate-in fade-in duration-fast">
                            <div className="flex items-center justify-between text-caption font-semibold text-primary">
                                <span className="flex items-center gap-1.5 text-accent">
                                    <Scissors size={12} />
                                    <span>Clip-Before-Download Range</span>
                                </span>
                                <span className="text-secondary text-[10px]">
                                    Use Up/Down arrows or mouse wheel to adjust
                                </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-caption">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-secondary">Start:</span>
                                    <input
                                        type="text"
                                        value={trimStart}
                                        onChange={(e) => setTrimStart(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "ArrowUp") {
                                                e.preventDefault();
                                                adjustTrimTimestamp(trimStart, setTrimStart, e.shiftKey ? 5 : 1);
                                            } else if (e.key === "ArrowDown") {
                                                e.preventDefault();
                                                adjustTrimTimestamp(trimStart, setTrimStart, e.shiftKey ? -5 : -1);
                                            }
                                        }}
                                        onWheel={(e) => {
                                            e.preventDefault();
                                            const delta = e.deltaY < 0 ? (e.shiftKey ? 5 : 1) : (e.shiftKey ? -5 : -1);
                                            adjustTrimTimestamp(trimStart, setTrimStart, delta);
                                        }}
                                        placeholder="00:00"
                                        className="w-20 bg-surface-1 border border-border-subtle rounded px-2 py-1 text-caption font-mono text-primary outline-none focus:border-accent"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setTrimStart(formatSeconds(previewTime))}
                                        className="text-[10px] font-semibold text-accent hover:underline px-1"
                                    >
                                        Use Pos
                                    </button>
                                </div>

                                <span className="text-tertiary">to</span>

                                <div className="flex items-center gap-1.5">
                                    <span className="text-secondary">End:</span>
                                    <input
                                        type="text"
                                        value={trimEnd}
                                        onChange={(e) => setTrimEnd(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "ArrowUp") {
                                                e.preventDefault();
                                                adjustTrimTimestamp(trimEnd, setTrimEnd, e.shiftKey ? 5 : 1);
                                            } else if (e.key === "ArrowDown") {
                                                e.preventDefault();
                                                adjustTrimTimestamp(trimEnd, setTrimEnd, e.shiftKey ? -5 : -1);
                                            }
                                        }}
                                        onWheel={(e) => {
                                            e.preventDefault();
                                            const delta = e.deltaY < 0 ? (e.shiftKey ? 5 : 1) : (e.shiftKey ? -5 : -1);
                                            adjustTrimTimestamp(trimEnd, setTrimEnd, delta);
                                        }}
                                        placeholder={videoInfo.duration_string}
                                        className="w-20 bg-surface-1 border border-border-subtle rounded px-2 py-1 text-caption font-mono text-primary outline-none focus:border-accent"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setTrimEnd(formatSeconds(previewTime))}
                                        className="text-[10px] font-semibold text-accent hover:underline px-1"
                                    >
                                        Use Pos
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {activeCardTask && (
                    <div
                        className={`mt-3 p-3 rounded-md bg-surface-0 border space-y-2 animate-in fade-in duration-fast ${activeCardTask.status === "error"
                            ? "border-status-danger/40 bg-status-danger-subtle/10"
                            : "border-accent/30"
                            }`}
                    >
                        <div className="flex items-center justify-between text-caption font-semibold">
                            <span
                                className={`flex items-center gap-1.5 ${activeCardTask.status === "error"
                                    ? "text-status-danger"
                                    : activeCardTask.status === "completed"
                                        ? "text-status-success"
                                        : "text-accent"
                                    }`}
                            >
                                {activeCardTask.status === "error" ? (
                                    <AlertCircle size={14} className="text-status-danger" />
                                ) : activeCardTask.status === "completed" ? (
                                    <CheckCircle2 size={14} className="text-status-success" />
                                ) : (
                                    <Loader2 size={14} className="animate-spin text-accent" />
                                )}
                                <span>
                                    {activeCardTask.status === "error"
                                        ? "Download Failed"
                                        : activeCardTask.status === "completed"
                                            ? "Download Completed"
                                            : `Downloading (${activeCardTask.percent.toFixed(0)}%)`}
                                </span>
                            </span>
                            <span className="text-caption font-mono text-secondary text-[11px]">
                                {activeCardTask.status === "downloading" &&
                                    activeCardTask.speed &&
                                    activeCardTask.speed !== "0 B/s"
                                    ? activeCardTask.speed
                                    : ""}{" "}
                                {activeCardTask.status === "downloading" && activeCardTask.eta
                                    ? `• ETA: ${activeCardTask.eta}`
                                    : ""}
                            </span>
                        </div>

                        {activeCardTask.status === "error" ? (
                            <div className="p-2 bg-status-danger-subtle/30 rounded border border-status-danger/20 text-[11px] text-status-danger flex items-start gap-2">
                                <AlertCircle size={13} className="shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold">
                                        {ERROR_MESSAGES[activeCardTask.error_code || "unknown"] ||
                                            ERROR_MESSAGES.unknown}
                                    </p>
                                    {activeCardTask.error_message && (
                                        <p className="text-[10px] text-secondary mt-0.5 truncate font-mono">
                                            {activeCardTask.error_message.slice(0, 140)}
                                        </p>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleRetryDownload(activeCardTask)}
                                    className="px-2.5 py-1 rounded bg-status-danger hover:bg-status-danger/90 text-white font-semibold text-[10px] flex items-center gap-1 shrink-0 shadow-sm transition-all active:scale-95"
                                >
                                    <RotateCcw size={10} /> Retry
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full transition-all duration-fast ${activeCardTask.status === "completed"
                                            ? "bg-status-success"
                                            : "bg-accent"
                                            }`}
                                        style={{ width: `${activeCardTask.percent}%` }}
                                    />
                                </div>

                                {(activeCardTask.status === "downloading" ||
                                    activeCardTask.status === "muxing") && (
                                        <div className="mt-2 px-2.5 py-1.5 rounded bg-surface-2/70 border border-border-subtle/40 grid grid-cols-3 gap-2 text-[11px] font-mono">
                                            <div>
                                                <span className="text-[10px] uppercase text-tertiary block font-sans">
                                                    Speed
                                                </span>
                                                <span className="text-secondary font-medium">
                                                    {activeCardTask.speed && activeCardTask.speed !== "0 B/s"
                                                        ? activeCardTask.speed
                                                        : "Calculating..."}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] uppercase text-tertiary block font-sans">
                                                    ETA
                                                </span>
                                                <span className="text-secondary font-medium">
                                                    {activeCardTask.eta || "--:--"}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] uppercase text-tertiary block font-sans">
                                                    Progress
                                                </span>
                                                <span className="text-secondary font-medium">
                                                    {activeCardTask.percent.toFixed(0)}%
                                                </span>
                                            </div>
                                        </div>
                                    )}
                            </>
                        )}

                        <div className="flex items-center justify-between text-caption pt-0.5">
                            {activeCardTask.file_path && activeCardTask.status === "completed" ? (
                                <button
                                    type="button"
                                    onClick={() => openFile(activeCardTask.file_path)}
                                    className="text-accent font-semibold hover:underline flex items-center gap-1"
                                >
                                    <Play size={11} fill="currentColor" /> Open Downloaded File
                                </button>
                            ) : (
                                <span />
                            )}
                            <button
                                type="button"
                                onClick={onDismissProgress}
                                className="text-secondary hover:text-primary text-[11px] hover:underline"
                            >
                                Dismiss Progress
                            </button>
                        </div>
                    </div>
                )}

                <div className="mt-4 pt-4 border-t border-border-subtle">
                    {videoInfo.video_formats && videoInfo.video_formats.length > 0 ? (
                        <div className="space-y-4">
                            {/* Format selection panel */}
                            <div className="bg-surface-2/40 border border-border-subtle rounded-lg p-4">
                                <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                                    {/* Left col — Download Format pills */}
                                    <div className="lg:col-span-3 space-y-3">
                                        <div className="text-[10px] font-semibold uppercase tracking-wider text-tertiary">
                                            Download Format
                                        </div>

                                        {/* VIDEO subsection */}
                                        <div className="text-[11px] font-semibold text-primary/80 flex items-center gap-2">
                                            <span>Video</span>
                                            <span className="flex-1 h-px bg-border-subtle" />
                                        </div>

                                        {/* Video pills */}
                                        <div className="flex flex-wrap items-center gap-2">
                                            {videoInfo.video_formats.slice(0, 3).map((f) => {
                                                const isSelected =
                                                    selectedFormat?.format_id === f.format_id &&
                                                    !selectedFormat?.is_audio_only;
                                                return (
                                                    <button
                                                        key={f.format_id + f.label}
                                                        type="button"
                                                        onClick={() => setSelectedFormat(f)}
                                                        className={`px-3 py-1.5 rounded-md text-caption font-medium transition-all active:scale-[0.98] border ${isSelected
                                                            ? "bg-accent text-white border-accent shadow-sm"
                                                            : "bg-surface-1 text-primary border-border-subtle hover:border-accent/40 hover:bg-surface-2"
                                                            }`}
                                                    >
                                                        {f.label}
                                                    </button>
                                                );
                                            })}

                                            {videoInfo.video_formats.length > 3 && (
                                                <select
                                                    value={
                                                        selectedFormat &&
                                                            !selectedFormat.is_audio_only &&
                                                            videoInfo.video_formats
                                                                .slice(3)
                                                                .some((x) => x.format_id === selectedFormat.format_id)
                                                            ? selectedFormat.format_id
                                                            : ""
                                                    }
                                                    onChange={(e) => {
                                                        if (!e.target.value) return;
                                                        const f = videoInfo.video_formats.find(
                                                            (x) => x.format_id === e.target.value
                                                        );
                                                        if (f) setSelectedFormat(f);
                                                    }}
                                                    className={`px-2.5 py-1.5 rounded-md text-caption font-medium outline-none cursor-pointer transition-all border ${selectedFormat &&
                                                        !selectedFormat.is_audio_only &&
                                                        videoInfo.video_formats
                                                            .slice(3)
                                                            .some((x) => x.format_id === selectedFormat.format_id)
                                                        ? "bg-accent text-white border-accent shadow-sm"
                                                        : "bg-surface-1 text-primary border-border-subtle hover:border-accent/40 hover:bg-surface-2"
                                                        }`}
                                                >
                                                    <option value="" disabled>
                                                        {t("more_video")}
                                                    </option>
                                                    {videoInfo.video_formats.slice(3).map((f) => (
                                                        <option key={f.format_id + f.label} value={f.format_id}>
                                                            {f.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            )}
                                        </div>

                                        {/* AUDIO subsection */}
                                        <div className="text-[11px] font-semibold text-primary/80 flex items-center gap-2 pt-2">
                                            <span>Audio</span>
                                            <span className="flex-1 h-px bg-border-subtle" />
                                        </div>

                                        {/* Audio pills */}
                                        <div className="flex flex-wrap items-center gap-2">
                                            {videoInfo.audio_formats.slice(0, 3).map((f) => {
                                                const isSelected =
                                                    selectedFormat?.format_id === f.format_id &&
                                                    selectedFormat?.is_audio_only &&
                                                    selectedFormat?.label === f.label;
                                                return (
                                                    <button
                                                        key={f.label + f.ext}
                                                        type="button"
                                                        onClick={() => setSelectedFormat(f)}
                                                        className={`px-3 py-1.5 rounded-md text-caption font-medium transition-all active:scale-[0.98] border ${isSelected
                                                            ? "bg-accent text-white border-accent shadow-sm"
                                                            : "bg-surface-1 text-primary border-border-subtle hover:border-accent/40 hover:bg-surface-2"
                                                            }`}
                                                    >
                                                        {f.label}
                                                    </button>
                                                );
                                            })}

                                            {videoInfo.audio_formats.length > 3 && (
                                                <select
                                                    value={
                                                        selectedFormat &&
                                                            selectedFormat.is_audio_only &&
                                                            videoInfo.audio_formats
                                                                .slice(3)
                                                                .some(
                                                                    (x) =>
                                                                        x.label === selectedFormat.label &&
                                                                        x.ext === selectedFormat.ext
                                                                )
                                                            ? selectedFormat.label
                                                            : ""
                                                    }
                                                    onChange={(e) => {
                                                        if (!e.target.value) return;
                                                        const f = videoInfo.audio_formats.find(
                                                            (x) => x.label === e.target.value
                                                        );
                                                        if (f) setSelectedFormat(f);
                                                    }}
                                                    className={`px-2.5 py-1.5 rounded-md text-caption font-medium outline-none cursor-pointer transition-all border ${selectedFormat &&
                                                        selectedFormat.is_audio_only &&
                                                        videoInfo.audio_formats
                                                            .slice(3)
                                                            .some(
                                                                (x) =>
                                                                    x.label === selectedFormat.label &&
                                                                    x.ext === selectedFormat.ext
                                                            )
                                                        ? "bg-accent text-white border-accent shadow-sm"
                                                        : "bg-surface-1 text-primary border-border-subtle hover:border-accent/40 hover:bg-surface-2"
                                                        }`}
                                                >
                                                    <option value="" disabled>
                                                        {t("more_audio")}
                                                    </option>
                                                    {videoInfo.audio_formats.slice(3).map((f) => (
                                                        <option key={f.label + f.ext} value={f.label}>
                                                            {f.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right col — Quality summary + Customize Trim */}
                                    <div className="lg:col-span-2 space-y-3">
                                        <div>
                                            <div className="text-[10px] font-semibold uppercase tracking-wider text-tertiary mb-1.5">
                                                Quality
                                            </div>
                                            <div
                                                className={`rounded-md px-3 py-2 text-caption font-semibold truncate border ${selectedFormat
                                                    ? "bg-accent-subtle text-accent border-accent/30"
                                                    : "bg-surface-1 text-tertiary border-border-subtle"
                                                    }`}
                                            >
                                                {selectedFormat
                                                    ? selectedFormat.label
                                                    : "No format selected"}
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsTrimming(!isTrimming);
                                                if (!trimEnd && videoInfo.duration_string !== "--:--") {
                                                    setTrimEnd(videoInfo.duration_string);
                                                }
                                            }}
                                            className={`w-full px-3 py-2 rounded-md text-caption font-medium transition-all active:scale-[0.98] border ${isTrimming
                                                ? "bg-accent text-white border-accent shadow-sm"
                                                : "bg-surface-1 text-primary border-border-subtle hover:border-accent/40 hover:bg-surface-2"
                                                }`}
                                        >
                                            {isTrimming ? "Trimming active" : "Customize Trim"}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Full-width primary download button */}
                            <button
                                type="button"
                                disabled={
                                    !selectedFormat ||
                                    !!(
                                        activeCardTask &&
                                        (activeCardTask.status === "starting" ||
                                            activeCardTask.status === "downloading" ||
                                            activeCardTask.status === "muxing")
                                    )
                                }
                                onClick={() => {
                                    if (selectedFormat) {
                                        handleStartDownload(
                                            selectedFormat.format_id,
                                            selectedFormat.ext,
                                            selectedFormat.is_audio_only,
                                            undefined,
                                            selectedFormat.label
                                        );
                                    }
                                }}
                                className={`w-full py-3 px-4 rounded-lg font-semibold text-body-sm flex items-center justify-center gap-2 transition-all ${selectedFormat &&
                                    !(
                                        activeCardTask &&
                                        (activeCardTask.status === "starting" ||
                                            activeCardTask.status === "downloading" ||
                                            activeCardTask.status === "muxing")
                                    )
                                    ? "bg-accent hover:bg-accent-hover text-white active:scale-[0.99] cursor-pointer"
                                    : "bg-surface-2 text-tertiary cursor-not-allowed opacity-60"
                                    }`}
                            >
                                {activeCardTask &&
                                    (activeCardTask.status === "starting" ||
                                        activeCardTask.status === "downloading" ||
                                        activeCardTask.status === "muxing") ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        <span>
                                            Downloading {selectedFormat?.label} (
                                            {activeCardTask.percent.toFixed(0)}%)...
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <Download size={16} />
                                        <span>
                                            {selectedFormat
                                                ? `Download ${selectedFormat.label}`
                                                : "Select a format to download"}
                                        </span>
                                    </>
                                )}
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-caption text-secondary py-1">
                            <Loader2 size={13} className="animate-spin text-accent" />
                            <span>Resolving format streams & audio options...</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
        </div>
    );
}