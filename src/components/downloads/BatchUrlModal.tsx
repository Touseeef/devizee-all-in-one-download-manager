import { useState, useRef } from "react";
import { Download, FileText, Layers, X, Clipboard } from "lucide-react";
import { readText } from "@tauri-apps/plugin-clipboard-manager";

export function BatchUrlModal({
    isOpen,
    onClose,
    onImportUrls,
}: {
    isOpen: boolean;
    onClose: () => void;
    onImportUrls: (urls: string[]) => void;
}) {
    const [rawText, setRawText] = useState("");
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    if (!isOpen) return null;

    const parsedUrls = rawText
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => /^https?:\/\//i.test(l));

    const handlePasteClipboard = async () => {
        try {
            const text = await readText();
            if (text && text.trim()) {
                setRawText((prev) => (prev ? prev + "\n" + text.trim() : text.trim()));
                return;
            }
        } catch {}
        try {
            const text = await navigator.clipboard.readText();
            if (text && text.trim()) {
                setRawText((prev) => (prev ? prev + "\n" + text.trim() : text.trim()));
            }
        } catch {}
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const content = evt.target?.result as string;
            if (content) {
                setRawText((prev) => (prev ? prev + "\n" + content.trim() : content.trim()));
            }
            if (fileInputRef.current) fileInputRef.current.value = "";
        };
        reader.readAsText(file);
    };

    const handleConfirm = () => {
        if (parsedUrls.length === 0) return;
        onImportUrls(parsedUrls);
        setRawText("");
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-fast">
            <div className="bg-surface-1 rounded-2xl border border-border-subtle shadow-floating max-w-xl w-full p-6 space-y-4 animate-in zoom-in-95 duration-fast">
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-accent-subtle text-accent flex items-center justify-center">
                            <Layers size={18} />
                        </div>
                        <div>
                            <h3 className="text-body font-bold text-primary">Batch Links Downloader</h3>
                            <p className="text-[11px] text-tertiary">
                                Download multiple videos or music tracks simultaneously
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg bg-surface-2 hover:bg-surface-3 text-secondary hover:text-primary flex items-center justify-center transition-colors cursor-pointer"
                        title="Close"
                    >
                        <X size={15} />
                    </button>
                </div>

                {/* Quick Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">

                    <button
                        type="button"
                        onClick={handlePasteClipboard}
                        className="px-2.5 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-secondary hover:text-primary text-[11px] font-semibold flex items-center gap-1.5 border border-border-subtle transition-all cursor-pointer"
                        title="Paste from clipboard"
                    >
                        <Clipboard size={13} className="text-secondary" />
                        <span>Paste Clipboard</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2.5 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-secondary hover:text-primary text-[11px] font-semibold flex items-center gap-1.5 border border-border-subtle transition-all cursor-pointer"
                        title="Load links from .txt file"
                    >
                        <FileText size={13} className="text-secondary" />
                        <span>Browse .txt File</span>
                    </button>

                    <input
                        type="file"
                        ref={fileInputRef}
                        accept=".txt"
                        className="hidden"
                        onChange={handleFileChange}
                    />
                </div>

                {/* Multi-line Input Area */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-caption font-semibold">
                        <label className="text-primary">Links List (1 URL per line)</label>
                        <span className="font-mono text-[11px] text-accent font-bold">
                            {parsedUrls.length} {parsedUrls.length === 1 ? "link" : "links"} detected
                        </span>
                    </div>

                    <textarea
                        rows={7}
                        value={rawText}
                        onChange={(e) => setRawText(e.target.value)}
                        placeholder={`https://www.youtube.com/watch?v=qsYGxgZMhQo\nhttps://www.youtube.com/watch?v=kGJ30S4x6hw\n...paste more links here`}
                        className="w-full bg-surface-2 border border-border-subtle focus:border-accent focus:ring-2 focus:ring-accent/20 rounded-xl p-3 text-body-sm font-mono text-primary placeholder:text-tertiary outline-none resize-none custom-scrollbar leading-relaxed"
                    />
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between pt-2">
                    <button
                        type="button"
                        onClick={() => setRawText("")}
                        disabled={!rawText}
                        className="px-3 py-2 rounded-lg text-caption font-semibold text-tertiary hover:text-status-danger disabled:opacity-40 transition-colors cursor-pointer"
                    >
                        Clear Text
                    </button>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-primary text-body-sm font-semibold border border-border-subtle transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>

                        <button
                            type="button"
                            onClick={handleConfirm}
                            disabled={parsedUrls.length === 0}
                            className="px-5 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-body-sm font-bold flex items-center gap-2 shadow-raised disabled:opacity-40 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                        >
                            <Download size={15} strokeWidth={2.5} />
                            <span>Analyze & Load Batch ({parsedUrls.length})</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
