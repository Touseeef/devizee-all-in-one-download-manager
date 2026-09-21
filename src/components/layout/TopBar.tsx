import type { RefObject } from "react";
import { Download, Music, Settings as SettingsIcon, Volume2 } from "lucide-react";
import type { TranslationKey } from "../../lib/i18n";
import { TopNavButton } from "../common/TopNavButton";
import { ThemeDropdown } from "../common/ThemeDropdown";
import { WaveformVisualizer } from "../common/WaveformVisualizer";

export function TopBar({
    t,
    activeTab,
    setActiveTab,
    activeCount,
    audioHistoryCount,
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
}: {
    t: (key: TranslationKey) => string;
    activeTab: "downloads" | "audio" | "settings";
    setActiveTab: (tab: "downloads" | "audio" | "settings") => void;
    activeCount: number;
    audioHistoryCount: number;
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
}) {
    return (
        <header
            data-tauri-drag-region
            className="h-12 bg-surface-1 border-b border-border-subtle flex items-center justify-between px-4 shrink-0 z-30 shadow-sm select-none"
        >
            {/* Left: Branding & Status */}
            <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center text-white shadow-sm">
                    <Download size={15} strokeWidth={2.5} />
                </div>
                <div className="flex items-center gap-2">
                    <span className="font-semibold text-body-sm tracking-tight text-primary">Devizee</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-accent-subtle text-accent font-medium">
                        v0.1.0
                    </span>
                    {nowPlaying.type !== "none" && (
                        <span className="flex items-center gap-1.5 text-[11px] text-accent font-medium px-2 py-0.5 rounded-full bg-accent-subtle">
                            <Volume2 size={12} className="animate-pulse" /> Playing {nowPlaying.type}
                            <WaveformVisualizer
                                mediaElement={
                                    nowPlaying.type === "audio" ? audioRef.current : videoElementRef.current
                                }
                                isPlaying={
                                    nowPlaying.type === "audio" ? isAudioElementPlaying : activeVideoPlaying
                                }
                            />
                        </span>
                    )}
                </div>
            </div>

            {/* Center: Navigation Tabs */}
            <div className="flex items-center bg-surface-2 p-1 rounded-md gap-1">
                <TopNavButton
                    active={activeTab === "downloads"}
                    onClick={() => setActiveTab("downloads")}
                    icon={<Download size={14} />}
                    label={t("nav_downloads")}
                    badge={activeCount > 0 ? activeCount : undefined}
                />
                <TopNavButton
                    active={activeTab === "audio"}
                    onClick={() => setActiveTab("audio")}
                    icon={<Music size={14} />}
                    label={t("nav_audio")}
                    badge={audioHistoryCount > 0 ? audioHistoryCount : undefined}
                />
                <TopNavButton
                    active={activeTab === "settings"}
                    onClick={() => setActiveTab("settings")}
                    icon={<SettingsIcon size={14} />}
                    label={t("nav_settings")}
                />
            </div>

            {/* Right: Audio Device + Theme Switcher */}
            <div className="flex items-center gap-2">
                {audioDevices.length > 0 && (
                    <select
                        value={selectedAudioDevice}
                        onChange={(e) => handleDeviceChange(e.target.value)}
                        className="bg-surface-2 border border-border-subtle rounded-md px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-surface-3 outline-none cursor-pointer max-w-[180px] truncate shadow-sm"
                        title="Select Audio Output Device"
                    >
                        {audioDevices.map((d, idx) => (
                            <option key={d.deviceId || idx} value={d.deviceId}>
                                {d.label ||
                                    (d.deviceId === "default"
                                        ? "Default Device"
                                        : `Audio Output ${idx + 1}`)}
                            </option>
                        ))}
                    </select>
                )}
                {activeCount > 0 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-subtle text-accent text-caption font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                        <span>{activeCount} active</span>
                    </div>
                )}
                <ThemeDropdown currentTheme={theme} onSelectTheme={handleThemeChange} />
            </div>
        </header>
    );
}