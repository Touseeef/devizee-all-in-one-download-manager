import { Download, Search, X } from "lucide-react";
import type { DownloadRecord } from "../../types";
import type { TranslationKey } from "../../lib/i18n";
import { HistoryItem } from "./HistoryItem";

type QueueFilter = "all" | "video" | "audio" | "active" | "completed" | "attention";
type SortBy = "date_desc" | "date_asc" | "size_desc" | "size_asc" | "title" | "progress";

export function ActivityList({
    t,
    sortedHistory,
    activitySearchQuery,
    setActivitySearchQuery,
    queueFilter,
    setQueueFilter,
    sortBy,
    setSortBy,
    selectedHistoryItems,
    setSelectedHistoryItems,
    onOpenFolder,
    onOpenFile,
    onRemove,
    onDeleteFile,
    onRetry,
}: {
    t: (key: TranslationKey) => string;
    sortedHistory: DownloadRecord[];
    activitySearchQuery: string;
    setActivitySearchQuery: (v: string) => void;
    queueFilter: QueueFilter;
    setQueueFilter: (v: QueueFilter) => void;
    sortBy: SortBy;
    setSortBy: (v: SortBy) => void;
    selectedHistoryItems: Set<string>;
    setSelectedHistoryItems: (v: Set<string>) => void;
    onOpenFolder: (path?: string | null) => void;
    onOpenFile: (path?: string | null) => void;
    onRemove: (id: string) => void;
    onDeleteFile: (id: string, path: string | null) => void;
    onRetry: (record: DownloadRecord) => void;
}) {
    return (
        <div className="space-y-3 pt-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-subtle pb-3">
                <div className="flex items-center gap-2">
                    <Download className="text-accent" size={18} />
                    <h3 className="text-body font-bold text-primary">{t("activity_title")}</h3>
                    <span className="text-caption text-secondary font-mono">
                        ({sortedHistory.length})
                    </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative flex items-center">
                        <Search className="absolute left-2.5 text-tertiary pointer-events-none" size={13} />
                        <input
                            type="text"
                            placeholder="Search history..."
                            value={activitySearchQuery}
                            onChange={(e) => setActivitySearchQuery(e.target.value)}
                            className="bg-surface-2 border border-border-subtle rounded-md pl-8 pr-7 h-8 text-caption font-medium text-primary placeholder:text-tertiary focus:outline-none focus:border-accent w-36 sm:w-44"
                        />
                        {activitySearchQuery && (
                            <button
                                type="button"
                                onClick={() => setActivitySearchQuery("")}
                                className="absolute right-2 text-tertiary hover:text-primary"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>

                    <select
                        value={queueFilter}
                        onChange={(e) => setQueueFilter(e.target.value as QueueFilter)}
                        className="bg-surface-2 border border-border-subtle rounded-md px-2.5 h-8 text-caption font-medium text-primary hover:bg-surface-3 outline-none cursor-pointer"
                    >
                        <option value="all">{t("filter_all")}</option>
                        <option value="video">{t("filter_video")}</option>
                        <option value="audio">{t("filter_audio")}</option>
                        <option value="active">{t("filter_active")}</option>
                        <option value="completed">{t("tile_completed")}</option>
                        <option value="attention">{t("tile_attention")}</option>
                    </select>

                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as SortBy)}
                        className="bg-surface-2 border border-border-subtle rounded-md px-2.5 h-8 text-caption font-medium text-primary hover:bg-surface-3 outline-none cursor-pointer"
                    >
                        <option value="date_desc">Newest First</option>
                        <option value="date_asc">Oldest First</option>
                        <option value="size_desc">Largest Size</option>
                        <option value="size_asc">Smallest Size</option>
                        <option value="title">Title A-Z</option>
                        <option value="progress">Progress</option>
                    </select>
                </div>
            </div>

            {sortedHistory.length === 0 ? (
                <div className="py-10 text-center bg-surface-1 rounded-md shadow-raised">
                    <Download size={20} className="mx-auto mb-1.5 text-tertiary" />
                    <p className="text-body-sm text-secondary font-medium">{t("no_tasks")}</p>
                </div>
            ) : (
                <div className="space-y-1.5">
                    <div className="flex items-center gap-2 px-3 pb-1">
                        <input
                            type="checkbox"
                            className="w-3.5 h-3.5 rounded text-accent accent-accent cursor-pointer"
                            checked={
                                sortedHistory.length > 0 &&
                                selectedHistoryItems.size === sortedHistory.length
                            }
                            onChange={(e) => {
                                if (e.target.checked)
                                    setSelectedHistoryItems(new Set(sortedHistory.map((h) => h.id)));
                                else setSelectedHistoryItems(new Set());
                            }}
                        />
                        <span className="text-caption text-secondary font-semibold text-[11px] uppercase tracking-wider">
                            Select All
                        </span>
                    </div>
                    {sortedHistory.map((record) => (
                        <div key={record.id} className="flex items-stretch gap-2.5">
                            <div className="flex items-center pl-1 shrink-0">
                                <input
                                    type="checkbox"
                                    className="w-3.5 h-3.5 rounded text-accent accent-accent cursor-pointer"
                                    checked={selectedHistoryItems.has(record.id)}
                                    onChange={(e) => {
                                        const next = new Set(selectedHistoryItems);
                                        if (e.target.checked) next.add(record.id);
                                        else next.delete(record.id);
                                        setSelectedHistoryItems(next);
                                    }}
                                />
                            </div>
                            <div className="flex-1 min-w-0">
                                <HistoryItem
                                    record={record}
                                    onOpenFolder={() => onOpenFolder(record.file_path)}
                                    onOpenFile={() => onOpenFile(record.file_path)}
                                    onRemove={() => onRemove(record.id)}
                                    onDeleteFile={() => onDeleteFile(record.id, record.file_path)}
                                    onRetry={() => onRetry(record)}
                                    tOpenFolder={t("open_folder")}
                                    tOpenFile={t("open_file")}
                                    tRemoveRow={t("remove_row")}
                                    tDeleteFile={t("delete_file")}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}