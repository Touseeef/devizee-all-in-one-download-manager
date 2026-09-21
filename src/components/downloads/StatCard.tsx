import { Loader2, Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import type { DownloadRecord } from "../../types";

export type StatCardVariant = "active" | "queued" | "attention" | "completed";

const VARIANTS = {
    active: {
        label: "Active",
        sub: "Downloading now",
        icon: Loader2,
        iconColor: "text-accent",
        spin: true,
    },
    queued: {
        label: "Queued",
        sub: "Waiting in queue",
        icon: Clock,
        iconColor: "text-status-info",
        spin: false,
    },
    attention: {
        label: "Attention",
        sub: "Failed / stalled",
        icon: AlertCircle,
        iconColor: "text-status-warning",
        spin: false,
    },
    completed: {
        label: "Completed",
        sub: "Ready on disk",
        icon: CheckCircle2,
        iconColor: "text-status-success",
        spin: false,
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
    const v = VARIANTS[variant];
    const Icon = v.icon;

    return (
        <button
            type="button"
            onClick={onClick}
            className={`text-left w-full rounded-lg border px-3.5 py-3 transition-all duration-200 active:scale-[0.99] flex flex-col ${active
                ? "bg-accent-subtle border-accent/30"
                : "bg-surface-1 border-border-subtle hover:bg-surface-2/60"
                }`}
        >
            {/* Header row: label + icon top, count below */}
            <div className="flex items-start justify-between gap-2 shrink-0">
                <div className="min-w-0 flex-1">
                    <div
                        className={`text-[10px] font-semibold uppercase tracking-wider ${active ? "text-accent" : "text-tertiary"
                            }`}
                    >
                        {v.label}
                    </div>
                    <div
                        className={`text-xl font-bold leading-none mt-1 ${active ? "text-accent" : "text-primary"
                            }`}
                    >
                        {count}
                    </div>
                </div>
                <Icon
                    size={14}
                    className={`${v.iconColor} ${v.spin && count > 0 ? "animate-spin" : ""
                        } shrink-0 mt-0.5`}
                />
            </div>

            {/* Scrollable item list — fixed height so all cards match */}
            <div className="h-16 mt-2 border-t border-border-subtle pt-1.5 overflow-y-auto pr-1">
                {items.length > 0 ? (
                    <div className="space-y-1">
                        {items.map((item) => (
                            <div
                                key={item.id}
                                className="flex items-center gap-1.5 text-caption text-secondary leading-tight"
                            >
                                <span
                                    className={`w-1 h-1 rounded-full shrink-0 ${variant === "active"
                                        ? "bg-accent"
                                        : variant === "attention"
                                            ? "bg-status-warning"
                                            : variant === "completed"
                                                ? "bg-status-success"
                                                : "bg-status-info"
                                        }`}
                                />
                                <span className="truncate" title={item.title}>
                                    {item.title}
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-caption text-tertiary leading-tight">
                        {v.sub}
                    </div>
                )}
            </div>
        </button>
    );
}