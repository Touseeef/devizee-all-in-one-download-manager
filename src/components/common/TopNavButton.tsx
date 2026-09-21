import type { ReactNode } from "react";

export function TopNavButton({
    active,
    onClick,
    icon,
    label,
    badge,
}: {
    active: boolean;
    onClick: () => void;
    icon: ReactNode;
    label: string;
    badge?: number;
}) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-caption font-semibold transition-all ${active
                ? "bg-surface-1 text-primary shadow-sm"
                : "text-secondary hover:text-primary hover:bg-surface-1/50"
                }`}
        >
            {icon}
            <span>{label}</span>
            {badge !== undefined && (
                <span className="ml-1 bg-accent text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                    {badge}
                </span>
            )}
        </button>
    );
}