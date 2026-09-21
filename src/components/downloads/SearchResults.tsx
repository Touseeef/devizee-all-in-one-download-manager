import { Download, Play, Search, X } from "lucide-react";
import type { PlaylistEntry } from "../../types";

export function SearchResults({
    results,
    onClose,
    onInspect,
    onPlay,
}: {
    results: PlaylistEntry[];
    onClose: () => void;
    onInspect: (url: string) => void;
    onPlay: (entry: PlaylistEntry) => void;
}) {
    return (
        <div className="bg-surface-1 rounded-md p-4 shadow-raised space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-fast border border-border-subtle">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Search size={15} className="text-accent" />
                    <h3 className="text-body-sm font-semibold text-primary">
                        YouTube Search Results ({results.length})
                    </h3>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="text-caption text-secondary hover:text-primary flex items-center gap-1 hover:underline"
                >
                    <X size={13} />
                    <span>Close Results</span>
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {results.map((res) => (
                    <div
                        key={res.id}
                        className="bg-surface-0 rounded-md p-2.5 border border-border-subtle flex flex-col justify-between hover:border-accent/40 transition-colors group/card shadow-sm"
                    >
                        <div>
                            <div
                                className="aspect-video w-full rounded-sm overflow-hidden bg-surface-2 relative cursor-pointer group/thumb mb-2"
                                onClick={() => onInspect(res.url)}
                                title="Click to analyze and download"
                            >
                                <img
                                    src={res.thumbnail || `https://i.ytimg.com/vi/${res.id}/hqdefault.jpg`}
                                    alt={res.title}
                                    className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-200"
                                    onError={(e) => {
                                        e.currentTarget.src = `https://i.ytimg.com/vi/${res.id}/hqdefault.jpg`;
                                    }}
                                />
                                <div className="absolute inset-0 bg-black/25 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity">
                                    <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center shadow-md">
                                        <Play size={14} fill="white" className="ml-0.5" />
                                    </div>
                                </div>
                                {res.duration_string && (
                                    <span className="absolute bottom-1 right-1 bg-black/80 text-white font-mono text-[10px] px-1 py-0.5 rounded">
                                        {res.duration_string}
                                    </span>
                                )}
                            </div>
                            <h4
                                className="text-body-sm font-semibold text-primary line-clamp-2 cursor-pointer hover:text-accent"
                                onClick={() => onInspect(res.url)}
                                title={res.title}
                            >
                                {res.title}
                            </h4>
                        </div>

                        <div className="mt-2.5 pt-2 border-t border-border-subtle flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => onInspect(res.url)}
                                className="flex-1 bg-accent hover:bg-accent-hover text-white py-1 rounded-sm text-caption font-semibold transition-all hover:scale-[1.02] flex items-center justify-center gap-1 shadow-sm"
                            >
                                <Download size={12} />
                                <span>Inspect & Download</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => onPlay(res)}
                                className="w-7 h-7 rounded-sm bg-surface-2 hover:bg-surface-3 text-secondary hover:text-primary flex items-center justify-center transition-colors border border-border-subtle shrink-0"
                                title="Play preview in-app"
                            >
                                <Play size={12} fill="currentColor" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}