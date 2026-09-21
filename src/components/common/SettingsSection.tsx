import type { ReactNode } from "react";

export function SettingsSection({
    title,
    icon,
    children,
}: {
    title: string;
    icon: ReactNode;
    children: ReactNode;
}) {
    return (
        <section className="bg-surface-1 rounded-md p-4 shadow-raised space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-border-subtle text-primary">
                <div className="text-accent">{icon}</div>
                <h3 className="text-body-sm font-semibold">{title}</h3>
            </div>
            <div className="space-y-3 pt-1">{children}</div>
        </section>
    );
}