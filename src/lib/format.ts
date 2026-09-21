// src/lib/format.ts

export const formatFileSize = (bytes?: number | null): string => {
    if (!bytes || bytes <= 0) return "";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let val = bytes;
    let idx = 0;
    while (val >= 1024 && idx < units.length - 1) {
        val /= 1024;
        idx++;
    }
    return `${val.toFixed(1)} ${units[idx]}`;
};

export const parseTimeToSeconds = (str: string): number => {
    if (!str) return 0;
    const parts = str.trim().split(":").map(Number);
    if (parts.length === 3)
        return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
    if (parts.length === 2) return (parts[0] || 0) * 60 + (parts[1] || 0);
    return Number(str) || 0;
};

export const formatSecondsToTime = (
    secs: number,
    forceHours: boolean = false
): string => {
    const s = Math.max(0, Math.floor(secs));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (forceHours || h > 0) {
        return `${h}:${m < 10 ? "0" : ""}${m}:${sec < 10 ? "0" : ""}${sec}`;
    }
    return `${m < 10 ? "0" : ""}${m}:${sec < 10 ? "0" : ""}${sec}`;
};