import { useRef } from "react";
import { Download, Loader2, Search, X } from "lucide-react";
import { readText } from "@tauri-apps/plugin-clipboard-manager";

export function UrlInput({
    url,
    setUrl,
    isFetching,
    isSearchingYoutube,
    onAnalyze,
    onClear,
    onImportTxtLines,
    placeholder,
    labelAnalyze,
    labelAnalyzing,
}: {
    url: string;
    setUrl: (v: string) => void;
    isFetching: boolean;
    isSearchingYoutube: boolean;
    onAnalyze: (e: React.FormEvent) => void;
    onClear: () => void;
    onImportTxtLines: (lines: string[]) => void;
    placeholder: string;
    labelAnalyze: string;
    labelAnalyzing: string;
}) {
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    return (
        <form onSubmit={onAnalyze} className="relative shadow-raised rounded-md bg-surface-1">
            <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-accent">
                <Search size={18} strokeWidth={2.5} />
            </div>
            <input
                type="text"
                placeholder={placeholder}
                className="w-full bg-surface-1 rounded-md h-12 pl-10 pr-56 text-body-sm font-medium transition-colors outline-none text-primary placeholder:text-tertiary"
                value={url}
                onChange={(e) => {
                    setUrl(e.target.value);
                    if (!e.target.value.trim()) onClear();
                }}
            />
            <div className="absolute right-1.5 top-1.5 bottom-1.5 flex items-center gap-1">
                {url && (
                    <button
                        type="button"
                        onClick={onClear}
                        className="w-7 h-7 flex items-center justify-center rounded-md text-tertiary hover:text-primary hover:bg-surface-2 transition-colors mr-0.5"
                        title="Clear URL"
                    >
                        <X size={14} />
                    </button>
                )}
                <button
                    type="button"
                    onClick={async () => {
                        try {
                            const text = await readText();
                            if (text) setUrl(text);
                        } catch (e) {
                            console.error("Clipboard read failed", e);
                        }
                    }}
                    className="bg-surface-2 hover:bg-surface-3 text-secondary hover:text-primary px-2.5 rounded-md font-semibold text-caption h-full transition-colors border border-border-subtle flex items-center shadow-sm"
                    title="Paste from clipboard"
                >
                    Paste
                </button>
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-surface-2 hover:bg-surface-3 text-secondary hover:text-primary px-2.5 rounded-md font-semibold text-caption h-full transition-colors border border-border-subtle flex items-center shadow-sm"
                    title="Import .txt file with URLs"
                >
                    Import TXT
                </button>
                <input
                    type="file"
                    ref={fileInputRef}
                    accept=".txt"
                    className="hidden"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (evt) => {
                            const text = evt.target?.result as string;
                            const lines = text
                                .split("\n")
                                .map((l) => l.trim())
                                .filter((l) => /^https?:\/\//i.test(l));
                            if (fileInputRef.current) fileInputRef.current.value = "";
                            if (lines.length > 0) onImportTxtLines(lines);
                        };
                        reader.readAsText(file);
                    }}
                />
                <button
                    type="submit"
                    disabled={isFetching || !url.trim()}
                    className="bg-accent hover:bg-accent-hover text-white px-4 rounded-md font-semibold text-body-sm transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center gap-1.5 shadow-sm h-full"
                >
                    {isFetching ? (
                        <Loader2 size={15} className="animate-spin" />
                    ) : isSearchingYoutube ? (
                        <Search size={15} />
                    ) : (
                        <Download size={15} strokeWidth={2.5} />
                    )}
                    <span>
                        {isFetching ? (isSearchingYoutube ? "Searching..." : labelAnalyzing) : labelAnalyze}
                    </span>
                </button>
            </div>
        </form>
    );
}