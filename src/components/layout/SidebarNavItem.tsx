import type { ReactNode } from "react";

export function SidebarNavItem({
    active,
    onClick,
    icon,
    label,
    badge,
    collapsed = false,
}: {
    active: boolean;
    onClick: () => void;
    icon: ReactNode;
    label: string;
    badge?: number;
    collapsed?: boolean;
}) {
    if (collapsed) {
        return (
            <button
                type="button"
                onClick={onClick}
                title={label}
                className={`relative w-full flex items-center justify-center py-2.5 rounded-md transition-colors active:scale-[0.97] ${active
                    ? "bg-accent-subtle text-accent"
                    : "text-secondary hover:bg-surface-2 hover:text-primary"
                    }`}
            >
                {active && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-accent" />
                )}
                <span className="shrink-0">{icon}</span>
                {badge !== undefined && badge > 0 && (
                    <span className="absolute top-1 right-2 bg-accent text-white text-[9px] px-1 rounded-full font-bold">
                        {badge}
                    </span>
                )}
            </button>
        );
    }

    return (
        <button
            type="button"
            onClick={onClick}
            className={`relative w-full flex items-center gap-3 pl-4 pr-3 py-2 rounded-md text-body-sm transition-colors active:scale-[0.99] ${active
                ? "bg-accent-subtle text-accent font-semibold"
                : "text-secondary font-medium hover:bg-surface-2 hover:text-primary"
                }`}
        >
            {active && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-accent" />
            )}
            <span className="shrink-0">{icon}</span>
            <span className="flex-1 text-left">{label}</span>
            {badge !== undefined && badge > 0 && (
                <span className="bg-accent text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0">
                    {badge}
                </span>
            )}
        </button>
    );
}