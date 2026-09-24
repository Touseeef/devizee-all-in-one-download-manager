import { ArrowDown, ListOrdered, Clock, Check, AlertCircle } from "lucide-react";
import type { DownloadRecord } from "../../types";

export type StatCardVariant = "active" | "queued" | "attention" | "completed";

const CARD_CONFIG = {
    active: {
        title: "Active",
        sub: "Downloading Now",
        icon: ArrowDown,
    },
    queued: {
        title: "Queued",
        sub: "Waiting in Queue",
        icon: ListOrdered,
    },
    attention: {
        title: "Attention",
        sub: "Needs Action",
        icon: Clock,
    },
    completed: {
        title: "Completed",
        sub: "Ready for Use",
        icon: Check,
    },
} as const;

export function StatCard({
    variant,
    count,
    items,
    active,
    onClick,
}: {
    variant: StatCardVariant;
    count: number;
    items: DownloadRecord[];
    active: boolean;
    onClick: () => void;
}) {
    const cfg = CARD_CONFIG[variant];
    const Icon = cfg.icon;

    // Active metrics computation
    const activeItem = variant === "active" && items.length > 0 ? items[0] : null;
    const speed = activeItem?.speed && activeItem.speed !== "0 B/s" ? activeItem.speed : "--";
    const percent = activeItem ? Math.round(activeItem.percent) : 0;

    return (
        <button
            type="button"
            onClick={onClick}
            className={`text-left w-full rounded-xl overflow-hidden transition-all duration-200 active:scale-[0.99] flex flex-col border cursor-pointer relative ${
                active
                    ? "border-accent ring-2 ring-accent shadow-raised shadow-accent/20 scale-[1.015]"
                    : "border-border-subtle bg-surface-1 hover:border-border-strong hover:shadow-raised"
            }`}
        >
            {/* Top Color Banner */}
            <div
                style={{
                    background: `var(--card-${variant}-bg)`,
                    borderBottom: `1px solid var(--card-${variant}-border)`,
                }}
                className="px-3.5 py-2.5 flex items-center justify-between shadow-xs transition-colors duration-150"
            >
                <div>
                    <div
                        style={{ color: `var(--card-${variant}-title)` }}
                        className="font-bold text-[13px] leading-tight flex items-center gap-1.5"
                    >
                        <span>{cfg.title}</span>
                        {count > 0 && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-surface-1 border border-border-subtle text-primary font-bold shadow-2xs">
                                {count}
                            </span>
                        )}
                        {active && (
                            <span className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.2 rounded-full bg-accent text-white shadow-2xs">
                                Active
                            </span>
                        )}
                    </div>
                    <div
                        style={{ color: `var(--card-${variant}-sub)` }}
                        className="text-[11px] font-medium"
                    >
                        {cfg.sub}
                    </div>
                </div>
                <div
                    style={{
                        background: `var(--card-${variant}-badge)`,
                        color: `var(--card-${variant}-badge-text)`,
                    }}
                    className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 shadow-xs"
                >
                    <Icon size={12} strokeWidth={2.5} />
                </div>
            </div>

            {/* Body */}
            <div className="p-3 bg-surface-1 flex-1 flex flex-col justify-between min-h-[96px]">
                {variant === "active" && activeItem ? (
                    <div className="space-y-2">
                        {/* Circular Progress & Metrics */}
                        <div className="flex items-center gap-3">
                            <div className="relative w-10 h-10 shrink-0 flex items-center justify-center">
                                <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                                    <path
                                        className="text-surface-2"
                                        strokeWidth="3.5"
                                        stroke="currentColor"
                                        fill="none"
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    />
                                    <path
                                        style={{ stroke: `var(--card-active-ring)` }}
                                        className="transition-all duration-300"
                                        strokeDasharray={`${percent}, 100`}
                                        strokeWidth="3.5"
                                        strokeLinecap="round"
                                        fill="none"
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    />
                                </svg>
                                <span className="absolute text-[10px] font-bold font-mono text-primary">
                                    {percent}%
                                </span>
                            </div>
                            <div className="min-w-0">
                                <div className="text-[11px] font-semibold text-primary font-mono truncate">
                                    {speed}
                                </div>
                                <div className="text-[10px] text-secondary">
                                    Download Speed
                                </div>
                            </div>
                        </div>

                        {/* Top 2 Active Tasks */}
                        <div className="space-y-1 pt-1 border-t border-border-subtle/60">
                            {items.slice(0, 2).map((item) => (
                                <div key={item.id} className="flex items-center justify-between text-[11px] text-secondary">
                                    <span className="truncate pr-2">{item.title}</span>
                                    <span
                                        style={{ color: `var(--card-active-ring)` }}
                                        className="font-mono text-[10px] shrink-0 font-medium"
                                    >
                                        {Math.round(item.percent)}%
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : items.length > 0 ? (
                    <div className="space-y-1.5 overflow-y-auto max-h-[90px] pr-1.5 focus:outline-none">
                        {items.map((item) => (
                            <div key={item.id} className="flex items-start justify-between gap-1.5 text-[11px] text-secondary leading-snug hover:text-primary transition-colors">
                                <span className="truncate flex-1 font-medium" title={item.title}>
                                    {item.title}
                                </span>
                                {variant === "attention" ? (
                                    <AlertCircle size={12} className="text-status-warning shrink-0 mt-0.5" />
                                ) : variant === "completed" ? (
                                    <span className="font-mono text-[10px] text-tertiary shrink-0 font-semibold">
                                        {item.format?.split(" ")[0] || "Done"}
                                    </span>
                                ) : (
                                    <span className="w-1.5 h-1.5 rounded-full bg-status-info shrink-0 mt-1.5" />
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="h-full flex items-center justify-center text-center text-caption text-tertiary">
                        No {cfg.title.toLowerCase()} items
                    </div>
                )}
            </div>
            {active && <div className="h-1 w-full bg-accent shrink-0 shadow-xs" />}
        </button>
    );
}