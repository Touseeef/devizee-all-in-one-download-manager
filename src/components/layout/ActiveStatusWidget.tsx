// src/components/layout/ActiveStatusWidget.tsx
import { memo } from "react";
import { Activity } from "lucide-react";

function ActiveStatusWidgetInner({
    activeCount,
    queuedCount,
    collapsed = false,
}: {
    activeCount: number;
    queuedCount: number;
    collapsed?: boolean;
}) {
    const total = activeCount + queuedCount;
    const isActive = activeCount > 0;

    if (collapsed) {
        return (
            <div
                className="mx-2 mb-2 p-2 rounded-md bg-surface-2 border border-border-subtle flex items-center justify-center"
                title={
                    total === 0
                        ? "No active downloads"
                        : `${activeCount} Downloading · ${queuedCount} Queued`
                }
            >
                <span
                    className={`w-2 h-2 rounded-full ${isActive ? "bg-accent animate-pulse" : "bg-tertiary"
                        }`}
                />
            </div>
        );
    }

    return (
        <div className="mx-3 mb-3 p-3 rounded-md bg-surface-2 border border-border-subtle">
            <div className="flex items-center gap-2 mb-2">
                <Activity size={13} className={isActive ? "text-accent" : "text-tertiary"} />
                <span className="text-[10px] uppercase font-bold tracking-wider text-tertiary">
                    Active Status
                </span>
            </div>

            <div className="flex items-end gap-3">
                <div className="flex items-end gap-0.5 h-8 shrink-0">
                    {[0, 1, 2, 3, 4].map((i) => (
                        <span
                            key={i}
                            className="w-1 rounded-sm bg-accent transition-opacity duration-300"
                            style={{
                                height: isActive ? `${20 + ((i * 13) % 80)}%` : "12%",
                                animation: isActive
                                    ? `activeStatusPulse 1.${4 + i}s ease-in-out infinite alternate`
                                    : undefined,
                                opacity: isActive ? 1 : 0.25,
                            }}
                        />
                    ))}
                </div>

                <div className="flex-1 min-w-0">
                    {total === 0 ? (
                        <div className="text-caption text-tertiary">No active downloads</div>
                    ) : (
                        <div className="text-caption text-primary leading-tight">
                            <span className="font-semibold text-accent">{activeCount}</span>
                            <span className="text-tertiary"> Downloading · </span>
                            <span className="font-semibold text-secondary">{queuedCount}</span>
                            <span className="text-tertiary"> Queued</span>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
        @keyframes activeStatusPulse {
          0%   { height: 20%; }
          100% { height: 85%; }
        }
      `}</style>
        </div>
    );
}

export const ActiveStatusWidget = memo(ActiveStatusWidgetInner);