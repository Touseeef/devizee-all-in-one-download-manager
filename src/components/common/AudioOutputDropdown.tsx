// src/components/common/AudioOutputDropdown.tsx
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Headphones, Speaker, Volume2 } from "lucide-react";

export function AudioOutputDropdown({
    audioDevices,
    selectedDevice,
    onSelectDevice,
    placement = "up",
    compact = false,
}: {
    audioDevices: MediaDeviceInfo[];
    selectedDevice: string;
    onSelectDevice: (deviceId: string) => void;
    placement?: "up" | "down" | "right";
    compact?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleOutsideClick = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        if (open) document.addEventListener("mousedown", handleOutsideClick);
        return () => document.removeEventListener("mousedown", handleOutsideClick);
    }, [open]);

    const activeDeviceObj = audioDevices.find((d) => d.deviceId === selectedDevice);
    const activeLabel = activeDeviceObj?.label || (selectedDevice === "default" || !selectedDevice ? "Default Audio Output" : "Speaker / Headphones");

    const panelPosition =
        placement === "up"
            ? "bottom-full mb-1.5 left-0"
            : placement === "right"
                ? "left-full ml-2 bottom-0"
                : "top-full mt-1.5 left-0";

    return (
        <div className={`relative text-left ${compact ? "inline-block w-full" : "w-full"}`} ref={dropdownRef}>
            {compact ? (
                <button
                    type="button"
                    onClick={() => setOpen(!open)}
                    title={`Audio Output: ${activeLabel}`}
                    className="w-full flex items-center justify-center py-2.5 rounded-md bg-surface-2 hover:bg-surface-3 text-secondary hover:text-primary border border-border-subtle transition-colors cursor-pointer"
                >
                    <Volume2 size={15} className="text-secondary" />
                </button>
            ) : (
                <button
                    type="button"
                    onClick={() => setOpen(!open)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-surface-2 hover:bg-surface-3 text-primary border border-border-subtle text-caption font-semibold transition-all shadow-xs cursor-pointer"
                    title={`Active Output: ${activeLabel}`}
                >
                    <Speaker size={14} className="text-secondary shrink-0" />
                    <span className="flex-1 text-left truncate">{activeLabel}</span>
                    <ChevronDown size={12} className="text-tertiary shrink-0" />
                </button>
            )}

            {open && (
                <div
                    className={`absolute ${panelPosition} w-60 rounded-xl bg-surface-1 border border-border-subtle shadow-floating p-1.5 z-50 animate-in fade-in zoom-in-95 duration-fast space-y-1`}
                >
                    <div className="px-2 py-1 text-[10px] uppercase font-bold text-tertiary tracking-wider border-b border-border-subtle/50 mb-1 flex items-center justify-between">
                        <span>Audio Output</span>
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            onSelectDevice("default");
                            setOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-caption transition-colors cursor-pointer ${
                            selectedDevice === "default" || !selectedDevice
                                ? "bg-accent/10 text-accent font-semibold ring-1 ring-inset ring-accent/30"
                                : "text-primary hover:bg-surface-2"
                        }`}
                    >
                        <div className="flex items-center gap-2 min-w-0">
                            <Speaker size={13} className="shrink-0" />
                            <span className="truncate">System Default (Automatic)</span>
                        </div>
                        {(selectedDevice === "default" || !selectedDevice) && <Check size={12} className="shrink-0 text-accent" />}
                    </button>

                    {audioDevices.map((dev, idx) => {
                        const isSelected = dev.deviceId === selectedDevice;
                        const isHeadphone = /headphone|earphone|airpod/i.test(dev.label);
                        const DevIcon = isHeadphone ? Headphones : Speaker;
                        return (
                            <button
                                key={dev.deviceId || idx}
                                type="button"
                                onClick={() => {
                                    onSelectDevice(dev.deviceId);
                                    setOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-caption transition-colors cursor-pointer ${
                                    isSelected
                                        ? "bg-accent/10 text-accent font-semibold ring-1 ring-inset ring-accent/30"
                                        : "text-primary hover:bg-surface-2"
                                }`}
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <DevIcon size={13} className="shrink-0" />
                                    <span className="truncate" title={dev.label || `Audio Device ${idx + 1}`}>
                                        {dev.label || `Audio Device ${idx + 1}`}
                                    </span>
                                </div>
                                {isSelected && <Check size={12} className="shrink-0 text-accent" />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
