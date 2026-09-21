import { useEffect } from "react";
import { AlertCircle } from "lucide-react";

export function ConfirmDialog({
    isOpen,
    title,
    message,
    confirmText = "Confirm",
    confirmVariant = "danger",
    onConfirm,
    onCancel,
}: {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    confirmVariant?: "danger" | "accent";
    onConfirm: () => void;
    onCancel: () => void;
}) {
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onCancel();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [isOpen, onCancel]);

    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in">
            <div className="bg-surface-1 rounded-lg border border-border-strong shadow-floating p-5 max-w-sm w-full space-y-4 animate-in zoom-in-95">
                <div>
                    <h3 className="text-body font-bold text-primary flex items-center gap-2">
                        <AlertCircle
                            size={18}
                            className={confirmVariant === "danger" ? "text-status-danger" : "text-status-warning"}
                        />
                        {title}
                    </h3>
                    <p className="text-caption text-secondary mt-2 leading-relaxed">{message}</p>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-3.5 py-1.5 bg-surface-2 text-primary rounded-md text-caption font-semibold hover:bg-surface-3 transition-colors border border-border-subtle"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className={`px-4 py-1.5 text-white rounded-md text-caption font-semibold transition-colors shadow-sm ${confirmVariant === "danger"
                            ? "bg-status-danger hover:bg-status-danger/90"
                            : "bg-accent hover:bg-accent-hover"
                            }`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}