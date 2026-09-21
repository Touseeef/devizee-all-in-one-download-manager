import { useEffect, useState } from "react";
import type { ReactNode, RefObject } from "react";

export function AppShell({
    sidebar,
    mainRef,
    children,
}: {
    sidebar: (collapsed: boolean) => ReactNode;
    mainRef?: RefObject<HTMLElement | null>;
    children: ReactNode;
}) {
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        const check = () => setCollapsed(window.innerWidth < 1100);
        check();
        window.addEventListener("resize", check);
        return () => window.removeEventListener("resize", check);
    }, []);

    return (
        <div className="flex h-screen bg-surface-0 text-primary font-sans antialiased overflow-hidden select-none">
            {sidebar(collapsed)}
            <main
                ref={mainRef}
                className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6"
            >
                {children}
            </main>
        </div>
    );
}