import { useEffect, useRef, useState } from "react";
import {
    ArrowUpDown,
    Eye,
    FastForward,
    Moon,
    Shield,
    Sliders,
    Sun,
} from "lucide-react";

export const THEME_OPTIONS = [
    { id: "light", label: "Light Mode", icon: Sun, desc: "Clean, high-visibility daylight surfaces" },
    { id: "dark", label: "Dark Mode", icon: Moon, desc: "Default slate-navy workstation theme" },
    { id: "oled", label: "OLED Pure Black", icon: Shield, desc: "True black #000000 for OLED power saving" },
    { id: "sunset", label: "Sunset Warm", icon: Sliders, desc: "Warm ember surfaces with amber accents" },
    { id: "frost", label: "Frost Indigo", icon: FastForward, desc: "Cool midnight surfaces with indigo accents" },
    { id: "high-contrast", label: "High Contrast", icon: Eye, desc: "Ultra-sharp edges with vivid high-visibility accents" },
] as const;

export function ThemeDropdown({
    currentTheme,
    onSelectTheme,
    placement = "down",
    fullWidth = false,
    compact = false,
}: {
    currentTheme: string;
    onSelectTheme: (theme: string) => void;
    placement?: "down" | "up" | "right";
    fullWidth?: boolean;
    compact?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleOutsideClick = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        if (open) document.addEventListener("mousedown", handleOutsideClick);
        return () => document.removeEventListener("mousedown", handleOutsideClick);
    }, [open]);

    const activeOption =
        THEME_OPTIONS.find((t) => t.id === currentTheme) || THEME_OPTIONS[1];
    const ActiveIcon = activeOption.icon;

    const panelPosition =
        placement === "up"
            ? "bottom-full mb-1.5 right-0"
            : placement === "right"
                ? "left-full ml-1.5 top-0"
                : "top-full mt-1.5 right-0";

    return (
        <div
            className={`relative text-left ${fullWidth ? "w-full" : "inline-block"}`}
            ref={dropdownRef}
        >
            {compact ? (
                <button
                    type="button"
                    onClick={() => setOpen(!open)}
                    title={`Theme: ${activeOption.label}`}
                    className="w-full flex items-center justify-center py-2.5 rounded-md bg-surface-2 hover:bg-surface-3 text-primary border border-border-subtle transition-colors active:scale-[0.97]"
                >
                    <ActiveIcon size={15} className="text-accent" />
                </button>
            ) : (
                <button
                    type="button"
                    onClick={() => setOpen(!open)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md bg-surface-2 hover:bg-surface-3 text-primary border border-border-subtle text-caption font-semibold transition-all shadow-sm active:scale-[0.98] ${fullWidth ? "w-full" : ""
                        }`}
                    aria-haspopup="true"
                    aria-expanded={open}
                >
                    <ActiveIcon size={14} className="text-accent shrink-0" />
                    <span className="flex-1 text-left truncate">{activeOption.label}</span>
                    <ArrowUpDown size={11} className="text-secondary opacity-60 shrink-0" />
                </button>
            )}

            {open && (
                <div
                    className={`absolute ${panelPosition} w-64 rounded-md bg-surface-1 border border-border-subtle shadow-floating p-1.5 z-50 animate-in fade-in zoom-in-95 duration-fast space-y-0.5`}
                >
                    {THEME_OPTIONS.map((opt) => {
                        const Icon = opt.icon;
                        const isSelected = opt.id === currentTheme;
                        return (
                            <button
                                key={opt.id}
                                type="button"
                                onClick={() => {
                                    onSelectTheme(opt.id);
                                    setOpen(false);
                                }}
                                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-left transition-colors ${isSelected
                                    ? "bg-accent/10 text-accent font-semibold ring-1 ring-inset ring-accent/30"
                                    : "text-primary hover:bg-surface-2 hover:text-primary"
                                    }`}
                            >
                                <Icon
                                    size={15}
                                    className={`shrink-0 ${isSelected ? "text-accent" : "text-secondary"}`}
                                />
                                <div className="min-w-0 flex-1">
                                    <div className="text-caption font-semibold leading-none">{opt.label}</div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}