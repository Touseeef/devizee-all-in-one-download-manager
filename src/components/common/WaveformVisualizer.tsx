// src/components/common/WaveformVisualizer.tsx
import { useEffect, useRef } from "react";

export function WaveformVisualizer({
    mediaElement,
    isPlaying,
    onSeek,
    width = 80,
    height = 22,
    barCount = 24,
}: {
    mediaElement: HTMLMediaElement | null;
    isPlaying: boolean;
    onSeek?: (seconds: number) => void;
    width?: number;
    height?: number;
    barCount?: number;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const progressRef = useRef(0);

    // Track playback position
    useEffect(() => {
        if (!mediaElement) return;
        let raf = 0;
        const tick = () => {
            const d = mediaElement.duration;
            const c = mediaElement.currentTime;
            progressRef.current = d && isFinite(d) && d > 0 ? c / d : 0;
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [mediaElement]);

    // Animated draw loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d")!;
        const accent = getComputedStyle(document.documentElement)
            .getPropertyValue("--color-accent")
            .trim() || "#14b8a6";
        const inactive = getComputedStyle(document.documentElement)
            .getPropertyValue("--color-text-tertiary")
            .trim() || "#888";

        const gap = 1;
        const barW = (width - (barCount - 1) * gap) / barCount;
        const midY = height / 2;

        let raf = 0;
        let phase = 0;
        let last: number | null = null;

        const draw = (now: number) => {
            raf = requestAnimationFrame(draw);
            if (last !== null && isPlaying) phase += (now - last) * 0.005;
            last = now;

            ctx.clearRect(0, 0, width, height);

            for (let i = 0; i < barCount; i++) {
                let norm: number;
                if (isPlaying) {
                    // Moving, complex waveform — 3 sine waves at different freqs
                    const s1 = Math.abs(Math.sin(phase + i * 0.4));
                    const s2 = Math.abs(Math.sin(phase * 1.7 + i * 0.9));
                    const s3 = Math.abs(Math.sin(phase * 0.6 + i * 1.3));
                    norm = 0.25 + s1 * 0.5 + s2 * 0.2 + s3 * 0.15;
                } else {
                    norm = 0.3;
                }

                const barH = Math.max(2, norm * height * 0.95);
                const x = i * (barW + gap);
                const y = midY - barH / 2;
                const isPlayed = i / barCount <= progressRef.current;

                ctx.fillStyle = isPlayed ? accent : inactive;
                ctx.globalAlpha = isPlaying ? (isPlayed ? 1 : 0.5) : 0.35;
                ctx.fillRect(x, y, barW, barH);
            }
            ctx.globalAlpha = 1;
        };

        raf = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(raf);
    }, [isPlaying, width, height, barCount]);

    const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!onSeek || !mediaElement) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const d = mediaElement.duration;
        if (d && isFinite(d)) onSeek(ratio * d);
    };

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            onClick={handleClick}
            className={`shrink-0 ${onSeek ? "cursor-pointer" : ""}`}
            title={onSeek ? "Click to seek" : undefined}
        />
    );
}