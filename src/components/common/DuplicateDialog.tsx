// src/components/common/DuplicateDialog.tsx
import { AlertCircle } from "lucide-react";

export type DuplicateDialogState = {
    isOpen: boolean;
    formatId: string;
    ext: string;
    isAudio: boolean;
    specificInfo?: any;
    formatLabel?: string;
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
    if (!state.isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in">
            <div className="bg-surface-1 rounded-lg border border-border-strong shadow-floating p-5 max-w-sm w-full space-y-4 animate-in zoom-in-95">
                <div>
                    <h3 className="text-body font-bold text-primary flex items-center gap-2">
                        <AlertCircle size={18} className="text-status-warning" />
                        Duplicate Download
                    </h3>
                    <p className="text-caption text-secondary mt-2">
                        You have already downloaded or queued this file before. How would you like to proceed?
                    </p>
                </div>
                <div className="flex flex-col gap-2">
                    <button
                        onClick={onOverwrite}
                        className="w-full py-2 bg-status-danger text-white rounded-md text-body-sm font-semibold hover:bg-status-danger/90 transition-colors shadow-sm"
                    >
                        Redownload (Overwrite)
                    </button>
                    <button
                        onClick={onKeepBoth}
                        className="w-full py-2 bg-accent text-white rounded-md text-body-sm font-semibold hover:bg-accent-hover transition-colors shadow-sm"
                    >
                        Keep Both (Auto-Rename)
                    </button>
                    <button
                        onClick={onCancel}
                        className="w-full py-2 bg-surface-2 text-primary rounded-md text-body-sm font-semibold hover:bg-surface-3 transition-colors border border-border-subtle"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}