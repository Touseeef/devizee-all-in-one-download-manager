import type { RefObject } from "react";
import {
    ChevronLeft,
    ChevronRight,
    LayoutDashboard,
    Music,
    Pause,
    Play,
    Settings as SettingsIcon,
    SkipBack,
    SkipForward,
    Volume2,
} from "lucide-react";
import { SidebarNavItem } from "./SidebarNavItem";
import { ActiveStatusWidget } from "./ActiveStatusWidget";
import { ThemeDropdown } from "../common/ThemeDropdown";
import { WaveformVisualizer } from "../common/WaveformVisualizer";
import logo from "../../assets/devizee-logo.png";

export function Sidebar({
    collapsed = false,
    onToggleCollapse,
    activeTab,
    setActiveTab,
    activeCount,
    queuedCount,
    nowPlaying,
    isAudioElementPlaying,
    activeVideoPlaying,
    audioRef,
    videoElementRef,
    theme,
    handleThemeChange,
    audioDevices,
    selectedAudioDevice,
    handleDeviceChange,
    onAudioPlayPause,
    onAudioNext,
    onAudioPrev,
    onAudioSeek,
    autoplayOn,
    onToggleAutoplay,
}: {
    collapsed?: boolean;
    onToggleCollapse?: () => void;
    activeTab: "downloads" | "audio" | "settings";
    setActiveTab: (tab: "downloads" | "audio" | "settings") => void;
    activeCount: number;
    queuedCount: number;
    nowPlaying: { type: "none" | "audio" | "video"; id: string | null };
    isAudioElementPlaying: boolean;
    activeVideoPlaying: boolean;
    audioRef: RefObject<HTMLAudioElement | null>;
    videoElementRef: RefObject<HTMLVideoElement | null>;
    theme: string;
    handleThemeChange: (theme: string) => void;
    audioDevices: MediaDeviceInfo[];
    selectedAudioDevice: string;
    handleDeviceChange: (deviceId: string) => void;
    onAudioPlayPause: () => void;
    onAudioNext: () => void;
    onAudioPrev: () => void;
    onAudioSeek: (seconds: number) => void;
    autoplayOn: boolean;
    onToggleAutoplay: () => void;
}) {
    const currentlyPlaying =
        nowPlaying.type === "audio"
            ? isAudioElementPlaying
            : nowPlaying.type === "video"
                ? activeVideoPlaying
                : false;

    return (
        <aside
            className={`relative ${collapsed ? "w-[64px]" : "w-60"
                } bg-surface-1 border-r border-border-subtle flex flex-col shrink-0 transition-[width] duration-200`}
        >
            {/* Branding */}
            <div
                data-tauri-drag-region
                className={`border-b border-border-subtle flex items-center ${collapsed ? "justify-center py-3" : "px-4 py-4 gap-3"
                    }`}
            >
                <img
                    src={logo}
                    alt="Devizee"
                    className="w-8 h-8 shrink-0 pointer-events-none"
                    draggable={false}
                />
                {!collapsed && (
                    <>
                        <div className="min-w-0 flex-1">
                            <div className="font-bold text-body-sm tracking-tight text-primary leading-tight">
                                Devizee
                            </div>
                            <div className="text-[10px] text-tertiary leading-tight truncate">
                                All-In-One Download Manager
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Navigation */}
            <nav
                className={`flex-1 overflow-y-auto ${collapsed ? "p-2 space-y-1" : "p-3 space-y-1"
                    }`}
            >
                <SidebarNavItem
                    active={activeTab === "downloads"}
                    onClick={() => setActiveTab("downloads")}
                    icon={<LayoutDashboard size={16} />}
                    label="Dashboard"
                    badge={activeCount > 0 ? activeCount : undefined}
                    collapsed={collapsed}
                />
                <SidebarNavItem
                    active={activeTab === "audio"}
                    onClick={() => setActiveTab("audio")}
                    icon={<Music size={16} />}
                    label="Audio Hub"
                    collapsed={collapsed}
                />
                <SidebarNavItem
                    active={activeTab === "settings"}
                    onClick={() => setActiveTab("settings")}
                    icon={<SettingsIcon size={16} />}
                    label="Settings"
                    collapsed={collapsed}
                />
            </nav>

            {/* ============== COLLAPSED BOTTOM ============== */}
            {collapsed && (
                <div className="px-2 pb-2 space-y-1">
                    {/* Playback indicator — tiny dot, no box */}
                    {currentlyPlaying && (
                        <div
                            className="w-full py-2 flex items-center justify-center"
                            title={
                                currentlyPlaying
                                    ? `Playing ${nowPlaying.type}`
                                    : `${nowPlaying.type} paused`
                            }
                        >
                            <span
                                className={`w-2 h-2 rounded-full ${currentlyPlaying
                                    ? "bg-accent animate-pulse"
                                    : "bg-tertiary opacity-60"
                                    }`}
                            />
                        </div>
                    )}

                    {/* Active status dot */}
                    {activeCount + queuedCount > 0 && (
                        <div
                            className="w-full py-2 flex items-center justify-center"
                            title={`${activeCount} downloading · ${queuedCount} queued`}
                        >
                            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                        </div>
                    )}

                    {/* Theme icon */}
                    <ThemeDropdown
                        currentTheme={theme}
                        onSelectTheme={handleThemeChange}
                        placement="right"
                        fullWidth
                        compact
                    />

                    {/* Expand button — clean, full width, no overlap */}
                    {onToggleCollapse && (
                        <button
                            type="button"
                            onClick={onToggleCollapse}
                            className="w-full py-2 rounded-md flex items-center justify-center text-tertiary hover:text-primary hover:bg-surface-2 transition-colors"
                            title="Expand sidebar"
                        >
                            <ChevronRight size={14} />
                        </button>
                    )}
                </div>
            )}

            {/* ============== EXPANDED BOTTOM ============== */}
            {!collapsed && (
                <>
                    {/* Now-playing pill */}
                    {currentlyPlaying && (
                        <div className="mx-3 mb-3 p-3 rounded-md bg-accent-subtle border border-accent/30 space-y-2">
                            <div className="flex items-center gap-2">
                                <Volume2
                                    size={12}
                                    className={`shrink-0 ${currentlyPlaying ? "text-accent animate-pulse" : "text-tertiary"
                                        }`}
                                />
                                <span
                                    className={`text-caption font-semibold truncate flex-1 ${currentlyPlaying ? "text-accent" : "text-secondary"
                                        }`}
                                >
                                    {currentlyPlaying ? `Playing ${nowPlaying.type}` : `${nowPlaying.type} paused`}
                                </span>
                                <WaveformVisualizer
                                    mediaElement={
                                        nowPlaying.type === "audio"
                                            ? audioRef.current
                                            : videoElementRef.current
                                    }
                                    isPlaying={currentlyPlaying}
                                    onSeek={nowPlaying.type === "audio" ? onAudioSeek : undefined}
                                />
                            </div>

                            {nowPlaying.type === "audio" && (
                                <div className="flex items-center justify-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={onAudioPrev}
                                        className="w-7 h-7 rounded-md text-accent hover:bg-accent/15 flex items-center justify-center transition-colors"
                                        title="Previous track"
                                    >
                                        <SkipBack size={12} fill="currentColor" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={onAudioPlayPause}
                                        className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center hover:bg-accent-hover transition-transform active:scale-95"
                                        title={isAudioElementPlaying ? "Pause" : "Play"}
                                    >
                                        {isAudioElementPlaying ? (
                                            <Pause size={12} fill="currentColor" />
                                        ) : (
                                            <Play size={12} fill="currentColor" className="ml-0.5" />
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={onAudioNext}
                                        className="w-7 h-7 rounded-md text-accent hover:bg-accent/15 flex items-center justify-center transition-colors"
                                        title="Next track"
                                    >
                                        <SkipForward size={12} fill="currentColor" />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Active Status widget */}
                    <ActiveStatusWidget
                        activeCount={activeCount}
                        queuedCount={queuedCount}
                        collapsed={false}
                    />

                    {/* Audio output — above theme */}
                    {audioDevices.length > 0 && (
                        <div className="px-3 pb-2">
                            <div className="text-[10px] uppercase text-tertiary font-semibold tracking-wider px-1 mb-1.5">
                                Output
                            </div>
                            <select
                                value={selectedAudioDevice}
                                onChange={(e) => handleDeviceChange(e.target.value)}
                                className="w-full bg-surface-2 border border-border-subtle rounded-md px-2.5 py-1.5 text-caption font-medium text-primary hover:bg-surface-3 outline-none cursor-pointer truncate"
                                title="Select audio output device"
                            >
                                {audioDevices.map((d, idx) => (
                                    <option key={d.deviceId || idx} value={d.deviceId}>
                                        {d.label ||
                                            (d.deviceId === "default"
                                                ? "Default Device"
                                                : `Output ${idx + 1}`)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                    {/* Autoplay toggle */}
                    <div className="px-3 pb-2 flex items-center justify-between">
                        <span className="text-[10px] uppercase text-tertiary font-semibold tracking-wider">
                            Autoplay
                        </span>
                        <button
                            type="button"
                            onClick={onToggleAutoplay}
                            className={`relative w-9 h-5 rounded-full transition-colors ${autoplayOn ? "bg-accent" : "bg-surface-2"
                                }`}
                            title={autoplayOn ? "Autoplay next track" : "Manual"}
                        >
                            <span
                                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${autoplayOn ? "translate-x-4" : "translate-x-0"
                                    }`}
                            />
                        </button>
                    </div>
                    {/* Theme switcher — with collapse button next to the label */}
                    <div className="border-t border-border-subtle px-3 pb-3 pt-2">
                        <div className="flex items-center justify-between mb-2 px-1">
                            <span className="text-[10px] uppercase text-tertiary font-semibold tracking-wider">
                                Theme
                            </span>
                            {onToggleCollapse && (
                                <button
                                    type="button"
                                    onClick={onToggleCollapse}
                                    className="w-5 h-5 rounded-md flex items-center justify-center text-tertiary hover:text-primary hover:bg-surface-2 transition-colors"
                                    title="Collapse sidebar"
                                >
                                    <ChevronLeft size={12} />
                                </button>
                            )}
                        </div>
                        <ThemeDropdown
                            currentTheme={theme}
                            onSelectTheme={handleThemeChange}
                            placement="up"
                            fullWidth
                        />
                    </div>
                </>
            )}
        </aside>
    );
}