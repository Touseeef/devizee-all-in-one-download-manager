import { useState } from "react";
import {
    AlertCircle,
    Folder,
    MoreVertical,
    PlayCircle,
    Play,
    RotateCcw,
    Trash2,
    X,
    Loader2,
} from "lucide-react";
import type { DownloadRecord } from "../../types";
import { STATUS_DISPLAY, ERROR_MESSAGES } from "../../status";
import { formatFileSize } from "../../lib/format";
import { formatDisplayBadge } from "../../lib/formatClassify";

export function HistoryItem({
    record,
    onOpenFolder,
    onOpenFile,
    onRemove,
    onDeleteFile,
    onRetry,
    tOpenFolder,
    tOpenFile,
    tRemoveRow,
    tDeleteFile,
}: {
    record: DownloadRecord;
    onOpenFolder: () => void;
    onOpenFile: () => void;
    onRemove: () => void;
    onDeleteFile: () => void;
    onRetry?: () => void;
    tOpenFolder: string;
    tOpenFile: string;
    tRemoveRow: string;
    tDeleteFile: string;
}) {
    const display = STATUS_DISPLAY[record.status] || STATUS_DISPLAY.error;
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <div
            onDoubleClick={() => {
                if (record.status === "completed" && record.file_path) {
                    onOpenFile();
                }
            }}
            className="p-3 flex gap-3 relative group cursor-pointer"
            title={record.status === "completed" ? "Double-click to open file" : undefined}
        >
            <div
                className={`w-16 aspect-video rounded-md flex items-center justify-center shrink-0 ${record.status === "error"
                    ? "bg-status-danger-subtle/30 text-status-danger"
                    : "bg-surface-2 text-tertiary"
                    }`}
            >
                {record.status === "error" ? (
                    <AlertCircle size={18} />
                ) : (
                    <PlayCircle size={18} className="opacity-40" />
                )}
            </div>

            <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="flex items-center justify-between gap-3 mb-1">
                    <div className="min-w-0 flex-1">
                        <h4
                            className="text-body-sm font-semibold truncate text-primary"
                            title={record.title}
                        >
                            {record.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5">
                            {record.status === "error" ? (
                                <span className="text-caption text-status-danger font-medium text-[11px] flex items-center gap-1">
                                    <span>
                                        {ERROR_MESSAGES[record.error_code || "unknown"] || ERROR_MESSAGES.unknown}
                                    </span>
                                </span>
                            ) : (
                                <>
                                    <span className="text-caption text-tertiary text-[10px] font-mono">
                                        {formatDisplayBadge(record.format)}
                                    </span>
                                    {record.file_size && record.file_size > 0 && (
                                        <span className="text-caption text-tertiary font-mono text-[10px]">
                                            {formatFileSize(record.file_size)}
                                        </span>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                        <span
                            className={`text-caption font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 text-[11px] ${display.colorToken === "accent"
                                ? "bg-accent-subtle text-accent"
                                : display.colorToken === "status-success"
                                    ? "bg-status-success-subtle text-status-success"
                                    : display.colorToken === "status-danger"
                                        ? "bg-status-danger-subtle text-status-danger"
                                        : display.colorToken === "status-warning"
                                            ? "bg-status-warning-subtle text-status-warning"
                                            : "bg-surface-2 text-secondary"
                                }`}
                        >
                            {display.colorToken === "accent" && (
                                <Loader2 size={10} className="animate-spin" />
                            )}
                            {display.label}{" "}
                            {record.status === "downloading" && `${record.percent.toFixed(0)}%`}
                        </span>

                        {record.status === "error" && onRetry && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRetry();
                                }}
                                className="px-2.5 py-1 rounded-md bg-status-danger hover:bg-status-danger/90 text-white flex items-center gap-1 text-[11px] font-semibold transition-all active:scale-95 shrink-0"
                                title="Retry download"
                            >
                                <RotateCcw size={11} />
                                <span>Retry</span>
                            </button>
                        )}

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {record.status === "completed" && record.file_path && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onOpenFile();
                                    }}
                                    className="w-7 h-7 rounded-md hover:bg-surface-3 text-secondary hover:text-primary flex items-center justify-center transition-colors"
                                    title={tOpenFile}
                                >
                                    <Play size={12} fill="currentColor" />
                                </button>
                            )}

                            {record.status === "completed" && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onOpenFolder();
                                    }}
                                    className="w-7 h-7 rounded-md hover:bg-surface-3 text-secondary hover:text-primary flex items-center justify-center transition-colors"
                                    title={tOpenFolder}
                                >
                                    <Folder size={12} />
                                </button>
                            )}

                            {record.file_path && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteFile();
                                    }}
                                    className="w-7 h-7 rounded-md hover:bg-status-danger-subtle text-secondary hover:text-status-danger flex items-center justify-center transition-colors"
                                    title={tDeleteFile}
                                >
                                    <Trash2 size={12} />
                                </button>
                            )}

                            <div className="relative">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setMenuOpen(!menuOpen);
                                    }}
                                    onBlur={() => setTimeout(() => setMenuOpen(false), 200)}
                                    className="w-7 h-7 flex items-center justify-center text-tertiary hover:text-primary rounded-md hover:bg-surface-3 transition-colors"
                                >
                                    <MoreVertical size={14} />
                                </button>

                                {menuOpen && (
                                    <div className="absolute right-0 top-full mt-1 w-40 bg-surface-1 rounded-md shadow-floating p-1 z-30 animate-in zoom-in-95 duration-fast border border-border-subtle">
                                        {record.status === "completed" && (
                                            <button
                                                onClick={onOpenFolder}
                                                className="w-full text-left px-2.5 py-1.5 text-caption font-semibold text-primary hover:bg-surface-2 rounded flex items-center gap-2"
                                            >
                                                <Folder size={13} /> {tOpenFolder}
                                            </button>
                                        )}
                                        <button
                                            onClick={onRemove}
                                            className="w-full text-left px-2.5 py-1.5 text-caption font-semibold text-primary hover:bg-surface-2 rounded flex items-center gap-2"
                                        >
                                            <X size={13} /> {tRemoveRow}
                                        </button>
                                        {record.file_path && (
                                            <button
                                                onClick={onDeleteFile}
                                                className="w-full text-left px-2.5 py-1.5 text-caption font-semibold text-status-danger hover:bg-status-danger-subtle rounded flex items-center gap-2"
                                            >
                                                <Trash2 size={13} /> {tDeleteFile}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {display.progressMode !== "hidden" && (
                    <div className="h-1 bg-surface-2 rounded-full overflow-hidden mt-1">
                        {display.progressMode === "determinate" && (
                            <div
                                className="h-full bg-accent transition-all duration-fast"
                                style={{ width: `${record.percent}%` }}
                            />
                        )}
                        {display.progressMode === "indeterminate" && (
                            <div className="h-full bg-accent w-1/3 animate-pulse" />
                        )}
                    </div>
                )}

                {(record.status === "downloading" || record.status === "muxing") && (
                    <div className="mt-2 px-2.5 py-1.5 rounded-md bg-surface-2/70 grid grid-cols-3 gap-2 text-[11px] font-mono">
                        <div>
                            <span className="text-[10px] uppercase text-tertiary block font-sans">
                                Speed
                            </span>
                            <span className="text-secondary font-medium">
                                {record.speed && record.speed !== "0 B/s"
                                    ? record.speed
                                    : "Calculating..."}
                            </span>
                        </div>
                        <div>
                            <span className="text-[10px] uppercase text-tertiary block font-sans">
                                ETA
                            </span>
                            <span className="text-secondary font-medium">
                                {record.eta || "--:--"}
                            </span>
                        </div>
                        <div>
                            <span className="text-[10px] uppercase text-tertiary block font-sans">
                                Progress
                            </span>
                            <span className="text-secondary font-medium">
                                {record.percent.toFixed(0)}%
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}