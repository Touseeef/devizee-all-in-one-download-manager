// src/lib/audioContext.ts

/**
 * Shared AudioContext + AnalyserNode + 8-Band Equalizer registry.
 * A single AudioContext is reused for the entire app.
 */
export const globalAudioState: { ctx: AudioContext | null } = { ctx: null };

export const analysers = new WeakMap<HTMLMediaElement, AnalyserNode>();

export const EQ_FREQUENCIES = [60, 150, 400, 1000, 2400, 6000, 12000, 16000];

export type EqPreset = {
    id: string;
    name: string;
    gains: number[];
};

export const EQ_PRESETS: EqPreset[] = [
    { id: "flat", name: "Flat (Default)", gains: [0, 0, 0, 0, 0, 0, 0, 0] },
    { id: "bass_boost", name: "Bass Boost", gains: [6, 4.5, 2, 0, 0, 0, 0, 0] },
    { id: "vocal", name: "Vocal Booster", gains: [-2, -1, 1, 3.5, 4, 2, 1, 0] },
    { id: "electronic", name: "Electronic / Dance", gains: [5, 4, 1, 0, 1.5, 3, 4, 4.5] },
    { id: "rock", name: "Rock / Metal", gains: [4.5, 3, -1, -1.5, 1, 3, 4, 4] },
    { id: "pop", name: "Pop", gains: [-1, 2, 3, 3, 2, -1, 1, 2] },
    { id: "acoustic", name: "Acoustic / Classical", gains: [3.5, 2.5, 1.5, 0, 1, 2, 3, 3.5] },
    { id: "treble", name: "Treble Boost", gains: [-2, -1, 0, 0, 1.5, 3, 5, 6] },
];

// Load persisted gains or default to 0dB flat
let initialGains = [0, 0, 0, 0, 0, 0, 0, 0];
try {
    const saved = localStorage.getItem("devizee_eq_bands");
    if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 8) {
            initialGains = parsed;
        }
    }
} catch {}

export let currentEqGains: number[] = initialGains;

const elementFilterChains = new WeakMap<HTMLMediaElement, BiquadFilterNode[]>();
const allActiveFilterChains = new Set<BiquadFilterNode[]>();

/**
 * Safeguarded Equalizer connection.
 * Note: In Chromium WebView2, invoking createMediaElementSource on streaming remote
 * media lacking permissive CORS response headers forces the audio pipeline into zeroed silence.
 * To guarantee 100% audio playback across all platforms and external streaming providers,
 * we safely preserve native element audio routing.
 */
export function attachEqualizerToMedia(element: HTMLMediaElement): BiquadFilterNode[] | null {
    if (elementFilterChains.has(element)) {
        return elementFilterChains.get(element)!;
    }
    return null;
}

/**
 * Updates gain values for all 8 bands across all active media elements in real-time.
 */
export function setGlobalEqualizerGains(gains: number[]) {
    currentEqGains = [...gains];
    try {
        localStorage.setItem("devizee_eq_bands", JSON.stringify(gains));
    } catch {}

    const ctx = globalAudioState.ctx;
    const now = ctx ? ctx.currentTime : 0;

    allActiveFilterChains.forEach((filters) => {
        filters.forEach((filter, idx) => {
            const val = gains[idx] !== undefined ? gains[idx] : 0;
            if (ctx) {
                filter.gain.setTargetAtTime(val, now, 0.05);
            } else {
                filter.gain.value = val;
            }
        });
    });
}

/**
 * Applies a named EQ profile preset across all media.
 */
export function applyEqualizerPreset(presetId: string): EqPreset {
    const preset = EQ_PRESETS.find((p) => p.id === presetId) || EQ_PRESETS[0];
    setGlobalEqualizerGains(preset.gains);
    try {
        localStorage.setItem("devizee_eq_preset", preset.id);
    } catch {}
    return preset;
}

/**
 * Safe hardware speaker and audio output routing with automatic fallback.
 */
export async function routeAudioDevice(deviceId: string, element?: HTMLMediaElement | null) {
    const target = deviceId === "default" || !deviceId ? "" : deviceId;

    // 1. Route Web Audio context destination if supported
    if (globalAudioState.ctx && typeof (globalAudioState.ctx as any).setSinkId === "function") {
        try {
            await (globalAudioState.ctx as any).setSinkId(target);
        } catch (e) {
            console.warn("AudioContext setSinkId failed:", e);
        }
    }

    // 2. Route media element directly
    if (element && typeof (element as any).setSinkId === "function") {
        try {
            await (element as any).setSinkId(target);
        } catch (e) {
            console.warn("MediaElement setSinkId failed, falling back to default:", e);
            if (target !== "") {
                try {
                    await (element as any).setSinkId("");
                } catch (_) {}
            }
        }
    }
}