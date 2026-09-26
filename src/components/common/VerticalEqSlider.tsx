import React, { useRef, useState, useCallback } from "react";

interface Props {
    value: number;
    min?: number;
    max?: number;
    onChange: (v: number) => void;
}

export function VerticalEqSlider({ value, min = -12, max = 12, onChange }: Props) {
    const trackRef = useRef<HTMLDivElement>(null);
    const [dragging, setDragging] = useState(false);

    const pctFromValue = (v: number) => ((v - min) / (max - min)) * 100;

    const updateFromPointer = useCallback(
        (clientY: number) => {
            const el = trackRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const y = clientY - rect.top;
            const pct = 1 - Math.max(0, Math.min(1, y / rect.height));
            onChange(Math.round(min + pct * (max - min)));
        },
        [min, max, onChange]
    );

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        e.preventDefault();
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        setDragging(true);
        updateFromPointer(e.clientY);
    };
    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (dragging) updateFromPointer(e.clientY);
    };
    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        try { (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId); } catch { }
        setDragging(false);
    };

    const pct = pctFromValue(value);
    const thumbTop = 100 - pct;
    const isCenter = value === 0;
    const isPositive = value > 0;
    const fillTop = Math.min(50, thumbTop);
    const fillHeight = Math.abs(50 - thumbTop);

    return (
        <div className="flex flex-col items-center gap-2 select-none">
            <div
                ref={trackRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className="relative w-10 h-44 cursor-pointer"
                style={{ touchAction: "none" }}
            >
                <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-1.5 rounded-full bg-surface-3 border border-border-subtle/40" />
                <div
                    className={`absolute left-1/2 -translate-x-1/2 rounded-full pointer-events-none ${isCenter ? "" : isPositive ? "bg-accent/50" : "bg-status-warning/50"
                        }`}
                    style={{ top: `${fillTop}%`, height: `${fillHeight}%`, width: 6 }}
                />
                <div className="absolute left-0 right-0 h-px bg-border-strong pointer-events-none" style={{ top: "50%" }} />
                <div
                    className={`absolute left-1/2 w-6 h-6 rounded-full bg-white shadow-md pointer-events-none flex items-center justify-center transition-transform ${dragging ? "scale-125" : ""
                        }`}
                    style={{
                        top: `${thumbTop}%`,
                        transform: "translate(-50%, -50%)",
                        border: isPositive
                            ? "2px solid var(--color-accent, #14b8a6)"
                            : isCenter
                                ? "2px solid var(--color-border-strong, #999)"
                                : "2px solid var(--color-status-warning, #f59e0b)",
                    }}
                >
                    <div
                        className={`w-2 h-2 rounded-full ${isPositive
                            ? "bg-accent"
                            : isCenter
                                ? "bg-border-strong"
                                : "bg-status-warning"
                            }`}
                    />
                </div>
            </div>
        </div>
    );
}