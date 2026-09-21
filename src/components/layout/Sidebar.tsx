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

export function Sidebar({
    collapsed = false,
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
}: {
    collapsed?: boolean;
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
}) {
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
                    className={`shrink-0 pointer-events-none ${collapsed ? "w-8 h-8" : "w-8 h-8"}`}
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

            {/* Now-playing pill (only when something is playing) */}
            {nowPlaying.type !== "none" && (
                <div
                    className={`rounded-md bg-accent-subtle border border-accent/30 flex items-center ${collapsed
                        ? "mx-2 mb-2 p-2 justify-center"
                        : "mx-3 mb-3 px-3 py-2 gap-2"
                        }`}
                    title={collapsed ? `Playing ${nowPlaying.type}` : undefined}
                >
                    {collapsed ? (
                        <WaveformVisualizer
                            mediaElement={
                                nowPlaying.type === "audio"
                                    ? audioRef.current
                                    : videoElementRef.current
                            }
                            isPlaying={
                                nowPlaying.type === "audio"
                                    ? isAudioElementPlaying
                                    : activeVideoPlaying
                            }
                        />
                    ) : (
                        <>
                            <Volume2 size={12} className="text-accent shrink-0 animate-pulse" />
                            <span className="text-caption text-accent font-semibold truncate flex-1">
                                Playing {nowPlaying.type}
                            </span>
                            <WaveformVisualizer
                                mediaElement={
                                    nowPlaying.type === "audio"
                                        ? audioRef.current
                                        : videoElementRef.current
                                }
                                isPlaying={
                                    nowPlaying.type === "audio"
                                        ? isAudioElementPlaying
                                        : activeVideoPlaying
                                }
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
            <div
                className={`border-t border-border-subtle ${collapsed ? "p-2" : "px-3 pb-3 pt-2"
                    }`}
            >
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