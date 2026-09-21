import { Loader2 } from "lucide-react";
import type { DownloadRecord } from "../../types";

export function BatchProgress({
    title,
    taskIds,
    formatLabel,
    history,
    onClear,
}: {
    title: string;
    taskIds: string[];
    formatLabel: string;
    history: DownloadRecord[];
    onClear: () => void;
}) {
    const batchItems = history.filter((h) =>
        taskIds.some((id) => h.id.startsWith(id) || h.id === id)
    );
    const finished = batchItems.filter((h) => h.status === "completed").length;
    const total = taskIds.length;
    const avgPercent =
        batchItems.length > 0
            ? Math.round(batchItems.reduce((acc, h) => acc + h.percent, 0) / total)
            : 0;

    return (
        <div className="bg-surface-1 rounded-md p-4 shadow-raised border border-accent/40 space-y-2.5 animate-in fade-in slide-in-from-bottom-2 duration-fast">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Loader2 size={15} className="animate-spin text-accent" />
                    <div>
                        <h4 className="font-semibold text-body-sm text-primary">
                            Batch Downloading: {title}
                        </h4>
                        <p className="text-caption text-secondary">
                            Format:{" "}
                            <span className="font-mono font-semibold text-accent">{formatLabel}</span>{" "}
                            • {total} items in batch
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onClear}
                    className="px-2.5 py-1 rounded-md bg-surface-2 hover:bg-surface-0 text-secondary hover:text-primary text-caption font-semibold transition-colors border border-border-subtle"
                >
                    Clear Batch View
                </button>
            </div>

            <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-caption text-secondary">
                    <span>
                        {finished} of {total} completed
                    </span>
                    <span className="font-mono font-semibold text-primary">{avgPercent}%</span>
                </div>
                <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
                    <div
                        className={`h-full transition-all duration-300 ${finished === total ? "bg-status-success" : "bg-accent"
                            }`}
                        style={{ width: `${avgPercent}%` }}
                    />
                </div>
            </div>
        </div>
    );
}