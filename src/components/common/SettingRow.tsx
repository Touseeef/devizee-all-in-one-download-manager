import type { ReactNode } from "react";

export function SettingRow({
    title,
    desc,
    children,
}: {
    title: string;
    desc: string;
    children: ReactNode;
}) {
    return (
        <div className="flex items-center justify-between gap-4 py-1">
            <div className="min-w-0 flex-1">
                <p className="text-body-sm font-semibold text-primary">{title}</p>
                <p className="text-caption text-secondary mt-0.5">{desc}</p>
            </div>
            <div className="shrink-0">{children}</div>
        </div>
    );
}

export function SettingToggle({
    title,
    desc,
    checked,
    onChange,
}: {
    title: string;
    desc: string;
    checked: boolean;
    onChange: (v: boolean) => void;
}) {
    return (
        <div className="flex items-center justify-between gap-4 py-1">
            <div className="min-w-0 flex-1">
                <p className="text-body-sm font-semibold text-primary">{title}</p>
                <p className="text-caption text-secondary mt-0.5">{desc}</p>
            </div>
            <button
                type="button"
                onClick={() => onChange(!checked)}
                className={`w-10 h-5 rounded-full transition-colors relative shrink-0 p-0.5 ${checked ? "bg-accent" : "bg-surface-2"
                    }`}
            >
                <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${checked ? "translate-x-5" : "translate-x-0"
                        }`}
                />
            </button>
        </div>
    );
}