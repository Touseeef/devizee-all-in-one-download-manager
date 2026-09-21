// src/lib/audioContext.ts

/**
 * Shared AudioContext + AnalyserNode registry.
 * A single AudioContext is reused for the entire app (creating one per
 * track/render is a known Chromium footgun — browser caps concurrent
 * contexts and silently refuses to create more past ~6).
 */
export const globalAudioState: { ctx: AudioContext | null } = { ctx: null };

/**
 * WeakMap keyed by the media element so each element gets exactly one
 * AnalyserNode (createMediaElementSource throws if called twice on the
 * same element).
 */
export const analysers = new WeakMap<HTMLMediaElement, AnalyserNode>();