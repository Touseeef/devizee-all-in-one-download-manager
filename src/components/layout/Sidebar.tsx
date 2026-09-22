import type { RefObject } from "react";
import {
    LayoutDashboard,
    Music,
    Settings as SettingsIcon,
    Volume2,
} from "lucide-react";
import { SidebarNavItem } from "./SidebarNavItem";
import { ActiveStatusWidget } from "./ActiveStatusWidget";
import { ThemeDropdown } from "../common/ThemeDropdown";
import { WaveformVisualizer } from "../common/WaveformVisualizer";
import logo from "../../assets/devizee-logo.png";
import type { NowPlaying } from "../../types";

export function Sidebar({
    collapsed = false,
    activeTab,
    setActiveTab,
    activeCount,
    queuedCount,
    nowPlaying,
    audioRef,
    videoElementRef,
    theme,
    handleThemeChange,
}: {
    collapsed?: boolean;
    activeTab: "downloads" | "audio" | "settings";
    setActiveTab: (tab: "downloads" | "audio" | "settings") => void;
    activeCount: number;
    queuedCount: number;
    nowPlaying: NowPlaying;
    audioRef: RefObject<HTMLAudioElement | null>;
    videoElementRef: RefObject<HTMLVideoElement | null>;
    theme: string;
    handleThemeChange: (theme: string) => void;
}) {
    const pillVisible = nowPlaying.type !== "none";
    const pillPlaying = pillVisible && nowPlaying.state === "playing";

    return (
        <aside
            className={`${collapsed ? "w-[64px]" : "w-60"
                } bg-surface-1 border-r border-border-subtle flex flex-col shrink-0 transition-[width] duration-200`}
        >
            {/* Branding — drag region */}
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
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-subtle text-accent font-semibold shrink-0">
                            v0.1.0
                        </span>
                    </>
                )}
            </div>

            {/* Navigation */}
            <nav className={`flex-1 overflow-y-auto ${collapsed ? "p-2 space-y-1" : "p-3 space-y-1"}`}>
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

            {/* Now-playing pill — visible on playing OR paused */}
            {pillVisible && (
                <div
                    className={`rounded-md bg-accent-subtle border border-accent/30 flex items-center ${collapsed
                        ? "mx-2 mb-2 p-2 justify-center"
                        : "mx-3 mb-3 px-3 py-2 gap-2"
                        }`}
                    title={collapsed ? `${pillPlaying ? "Playing" : "Paused"} ${nowPlaying.type}` : undefined}
                >
                    {collapsed ? (
                        <WaveformVisualizer
                            mediaElement={
                                nowPlaying.type === "audio"
                                    ? audioRef.current
                                    : videoElementRef.current
                            }
                            isPlaying={pillPlaying}
                        />
                    ) : (
                        <>
                            <Volume2
                                size={12}
                                className={`shrink-0 ${pillPlaying ? "text-accent animate-pulse" : "text-tertiary"}`}
                            />
                            <span
                                className={`text-caption font-semibold truncate flex-1 ${pillPlaying ? "text-accent" : "text-secondary"}`}
                            >
                                {pillPlaying ? `Playing ${nowPlaying.type}` : `${nowPlaying.type} paused`}
                            </span>
                            <WaveformVisualizer
                                mediaElement={
                                    nowPlaying.type === "audio"
                                        ? audioRef.current
                                        : videoElementRef.current
                                }
                                isPlaying={pillPlaying}
                            />
                        </>
                    )}
                </div>
            )}

            {/* Active Status widget */}
            <ActiveStatusWidget
                activeCount={activeCount}
                queuedCount={queuedCount}
                collapsed={collapsed}
            />

            {/* Theme switcher — bottom */}
            <div className={`border-t border-border-subtle ${collapsed ? "p-2" : "px-3 pb-3 pt-3"}`}>
                {!collapsed && (
                    <div className="text-[10px] uppercase text-tertiary font-semibold tracking-wider px-1 mb-2">
                        Theme
                    </div>
                )}
                <ThemeDropdown
                    currentTheme={theme}
                    onSelectTheme={handleThemeChange}
                    placement={collapsed ? "right" : "up"}
                    fullWidth
                    compact={collapsed}
                />
            </div>
        </aside>
    );
}