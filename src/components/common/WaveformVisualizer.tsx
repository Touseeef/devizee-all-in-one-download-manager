import { useEffect, useRef } from "react";
import { globalAudioState, analysers } from "../../lib/audioContext";

export function WaveformVisualizer({
    mediaElement,
    isPlaying,
}: {
    mediaElement: HTMLMediaElement | null;
    isPlaying: boolean;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Attach analyser ONLY for same-origin sources (blob:, data:, same origin).
    // Cross-origin sources (asset://, external http) cannot be decoded into
    // an AudioContext — attaching a MediaElementSource to them reroutes the
    // element's output through a graph that produces zeroes, silencing it.
    useEffect(() => {
        if (!mediaElement) return;

        const tryAttach = () => {
            if (analysers.has(mediaElement)) return;

            const src = mediaElement.src || "";
            const isSafe =
                src.startsWith("blob:") ||
                src.startsWith("data:") ||
                src.startsWith(window.location.origin);
            if (!isSafe) return;

            if (!globalAudioState.ctx) {
                try {
                    const AudioContextClass =
                        window.AudioContext || (window as any).webkitAudioContext;
                    if (AudioContextClass) globalAudioState.ctx = new AudioContextClass();
                } catch (e) {
                    console.warn("AudioContext init error:", e);
                    return;
                }
            }
            if (!globalAudioState.ctx) return;

            try {
                const analyser = globalAudioState.ctx.createAnalyser();
                analyser.fftSize = 512;
                analyser.smoothingTimeConstant = 0.75;
                const source = globalAudioState.ctx.createMediaElementSource(mediaElement);
                source.connect(analyser);
                analyser.connect(globalAudioState.ctx.destination);
                analysers.set(mediaElement, analyser);
            } catch (e) {
                console.warn("Analyser attach bypassed:", e);
            }
        };

        tryAttach();
        mediaElement.addEventListener("loadstart", tryAttach);
        mediaElement.addEventListener("loadedmetadata", tryAttach);

        return () => {
            mediaElement.removeEventListener("loadstart", tryAttach);
            mediaElement.removeEventListener("loadedmetadata", tryAttach);
        };
    }, [mediaElement]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d")!;
        const computedAccent = getComputedStyle(document.documentElement)
            .getPropertyValue("--color-accent")
            .trim();
        const strokeStyle = computedAccent || "#14b8a6";

        const W = canvas.width;
        const H = canvas.height;
        const MID = H / 2;

        if (globalAudioState.ctx && globalAudioState.ctx.state === "suspended") {
            globalAudioState.ctx.resume().catch(() => { });
        }

        const analyser = mediaElement ? analysers.get(mediaElement) : undefined;
        const dataArray = analyser ? new Uint8Array(analyser.fftSize) : null;

        let reqId = 0;
        const t0 = performance.now();

        const drawFrame = () => {
            reqId = requestAnimationFrame(drawFrame);
            const t = performance.now() - t0;

            ctx.clearRect(0, 0, W, H);
            ctx.strokeStyle = strokeStyle;
            ctx.lineWidth = 1.4;
            ctx.lineJoin = "round";
            ctx.beginPath();

            if (isPlaying && analyser && dataArray) {
                analyser.getByteTimeDomainData(dataArray);

                let energy = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    energy += Math.abs(dataArray[i] - 128);
                }
                const silent = energy / dataArray.length < 0.8;

                const step = Math.max(1, Math.floor(dataArray.length / W));
                for (let x = 0; x < W; x++) {
                    const idx = Math.min(dataArray.length - 1, x * step);
                    const v = (dataArray[idx] - 128) / 128;
                    const wobble = silent
                        ? Math.sin((x + t * 0.18) * 0.28) * 0.35 +
                        Math.sin((x + t * 0.09) * 0.61) * 0.22
                        : 0;
                    const y = MID + (v + wobble) * (MID - 2);
                    if (x === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
            } else {
                // Procedural fallback — used when no analyser is attached
                // (cross-origin audio, video iframe, paused state)
                for (let x = 0; x < W; x++) {
                    const y =
                        MID +
                        Math.sin((x + t * 0.06) * 0.22) * 2.2 +
                        Math.sin((x + t * 0.03) * 0.55) * 1.4;
                    if (x === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
        };

        drawFrame();
        return () => cancelAnimationFrame(reqId);
    }, [isPlaying, mediaElement]);

    return (
        <canvas
            ref={canvasRef}
            width={80}
            height={22}
            className="opacity-90 shrink-0"
        />
    );
}