import type { ReactNode } from "react";

export function StatTile({
    label,
    count,
    sub,
    gradient,
    icon,
    onClick,
}: {
    label: string;
    count: number;
    sub: string;
    gradient: string;
    icon: ReactNode;
    onClick?: () => void;
}) {
    return (
        <div
            onClick={onClick}
            className={`rounded-md p-3.5 text-white shadow-floating relative overflow-hidden flex flex-col justify-between min-h-20 transition-all ${onClick ? "cursor-pointer hover:scale-[1.02] active:scale-[0.99]" : ""
                }`}
            style={{ background: gradient }}
        >
            <div className="flex items-center justify-between opacity-90">
                <span className="text-caption font-semibold uppercase tracking-wider text-[10px]">
                    {label}
                </span>
                {icon}
            </div>
            <div>
                <div className="text-heading font-bold leading-tight">{count}</div>
                <div className="text-caption opacity-85 mt-0.5 text-[11px]">{sub}</div>
            </div>
        </div>
    );
}