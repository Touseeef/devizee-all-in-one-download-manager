import { useEffect } from "react";
import { AlertCircle } from "lucide-react";

export type DuplicateDialogState = {
    isOpen: boolean;
    formatId: string;
    ext: string;
    isAudio: boolean;
    specificInfo?: any;
    formatLabel?: string;
    // ─── W2-8: Enhanced comparison context ───
    existingRecord?: {
        title: string;
        format: string;
        file_size?: number | null;
        file_path?: string | null;
        date_added: number;
    };
    newEstimatedSize?: number | null;
    newLabel?: string;
};

export function DuplicateDialog({
    state,
    onOverwrite,
    onKeepBoth,
    onCancel,
}: {
    state: DuplicateDialogState;
    onOverwrite: () => void;
    onKeepBoth: () => void;
    onCancel: () => void;
}) {
    useEffect(() => {
        if (!state.isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onCancel();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [state.isOpen, onCancel]);

    if (!state.isOpen) return null;

    const existing = state.existingRecord;
    const existingSizeLabel = existing?.file_size
        ? formatBytes(existing.file_size)
        : "Unknown size";
    const existingDate = existing?.date_added
        ? new Date(existing.date_added * 1000).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
        })
        : "—";
    const existingFolder = getParentFolder(existing?.file_path || "");
    const newSizeLabel = state.newEstimatedSize
        ? `~${formatBytes(state.newEstimatedSize)} (estimated)`
        : "Size will be estimated";

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in p-4">
            <div className="bg-surface-1 rounded-2xl border border-border-strong shadow-floating max-w-2xl w-full space-y-5 animate-in zoom-in-95 p-6">
                {/* Header */}
                <div className="flex items-start gap-3 pb-4 border-b border-border-subtle">
                    <div className="w-9 h-9 rounded-xl bg-status-warning/15 text-status-warning flex items-center justify-center shrink-0">
                        <AlertCircle size={18} />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-body font-bold text-primary">
                            This video is already in your library
                        </h3>
                        <p className="text-caption text-secondary mt-0.5">
                            A file matching this URL and format already exists on disk.
                        </p>
                    </div>
                </div>

                {/* Side-by-Side Comparison */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* EXISTING */}
                    <div className="p-4 rounded-xl bg-surface-2/60 border border-border-subtle space-y-2.5">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-tertiary">
                                Existing File
                            </span>
                            <span className="px-1.5 py-0.5 rounded-full bg-status-success-subtle text-status-success text-[9px] font-bold">
                                ON DISK
                            </span>
                        </div>
                        <div className="space-y-2">
                            <div>
                                <p className="text-body-sm font-bold text-primary truncate" title={existing?.title}>
                                    {existing?.title || "Unknown"}
                                </p>
                                <p className="text-caption text-accent font-semibold mt-0.5">
                                    {existing?.format || "—"}
                                </p>
                            </div>
                            <div className="space-y-1 text-[11px] font-mono text-secondary">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-tertiary">Size:</span>
                                    <span className="text-primary font-semibold">{existingSizeLabel}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-tertiary">Added:</span>
                                    <span className="text-primary">{existingDate}</span>
                                </div>
                                <div className="flex items-start gap-1.5">
                                    <span className="text-tertiary shrink-0">Path:</span>
                                    <span
                                        className="text-primary break-all leading-tight"
                                        title={existing?.file_path || ""}
                                    >
                                        {existingFolder}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* NEW DOWNLOAD */}
                    <div className="p-4 rounded-xl bg-accent/5 border border-accent/30 space-y-2.5">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-accent">
                                New Download
                            </span>
                            <span className="px-1.5 py-0.5 rounded-full bg-accent/20 text-accent text-[9px] font-bold">
                                WILL START
                            </span>
                        </div>
                        <div className="space-y-2">
                            <div>
                                <p className="text-body-sm font-bold text-primary truncate" title={existing?.title}>
                                    {existing?.title || "Unknown"}
                                </p>
                                <p className="text-caption text-accent font-semibold mt-0.5">
                                    {state.newLabel || state.formatLabel || "—"}
                                </p>
                            </div>
                            <div className="space-y-1 text-[11px] font-mono text-secondary">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-tertiary">Size:</span>
                                    <span className="text-primary font-semibold">{newSizeLabel}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-tertiary">Added:</span>
                                    <span className="text-primary">Now</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-tertiary">Path:</span>
                                    <span className="text-tertiary italic">Same folder</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-2">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-2.5 bg-surface-2 text-secondary hover:text-primary rounded-xl text-body-sm font-semibold hover:bg-surface-3 transition-colors border border-border-subtle cursor-pointer"
                    >
                        Skip
                    </button>
                    <button
                        onClick={onOverwrite}
                        className="flex-1 py-2.5 bg-status-danger text-white rounded-xl text-body-sm font-semibold hover:bg-status-danger/90 transition-colors shadow-sm cursor-pointer"
                        title="Delete the existing file and download fresh"
                    >
                        Replace File
                    </button>
                    <button
                        onClick={onKeepBoth}
                        className="flex-1 py-2.5 bg-accent text-white rounded-xl text-body-sm font-semibold hover:bg-accent-hover transition-colors shadow-sm cursor-pointer"
                        title="Keep the existing file and add a new copy with _2 suffix"
                    >
                        Keep Both
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Local helpers ───
function formatBytes(bytes: number): string {
    if (!bytes || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const val = bytes / Math.pow(1024, i);
    return `${val.toFixed(i >= 3 ? 2 : 1)} ${units[i]}`;
}

function getParentFolder(filePath: string): string {
    if (!filePath) return "—";
    // Strip the filename — show only the containing folder.
    // The title of the file is already displayed above, so the filename
    // in the path line is redundant noise that breaks the layout.
    const lastSep = Math.max(filePath.lastIndexOf("\\"), filePath.lastIndexOf("/"));
    const folder = lastSep > 0 ? filePath.slice(0, lastSep) : filePath;
    // Shorten the user profile prefix (Windows: C:\Users\<name> → ~)
    return folder
        .replace(/^[A-Za-z]:\\Users\\[^\\]+/i, "~")
        .replace(/^\/home\/[^/]+/i, "~");
}