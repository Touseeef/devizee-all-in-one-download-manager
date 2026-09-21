import {
    Clock,
    Cpu,
    Download,
    ExternalLink,
    FastForward,
    RefreshCw,
    Shield,
    Sliders,
    Volume1,
    Volume2,
    VolumeX,
} from "lucide-react";
import { SettingsSection } from "../common/SettingsSection";
import { SettingRow, SettingToggle } from "../common/SettingRow";
import { ThemeDropdown } from "../common/ThemeDropdown";
import type { TranslationKey } from "../../lib/i18n";

export function SettingsTab({
    t,
    settings,
    updateSetting,
    theme,
    handleThemeChange,
    audioDevices,
    selectedAudioDevice,
    handleDeviceChange,
    volume,
    isMuted,
    handleVolumeChange,
    toggleMute,
    handleToggleAutostart,
    handleBrowseFolder,
    openFolder,
}: {
    t: (key: TranslationKey) => string;
    settings: any;
    updateSetting: (key: string, val: any) => void;
    theme: string;
    handleThemeChange: (theme: string) => void;
    audioDevices: MediaDeviceInfo[];
    selectedAudioDevice: string;
    handleDeviceChange: (deviceId: string) => void;
    volume: number;
    isMuted: boolean;
    handleVolumeChange: (v: number) => void;
    toggleMute: () => void;
    handleToggleAutostart: (enable: boolean) => void;
    handleBrowseFolder: (
        key:
            | "saveFolder"
            | "videoFolder"
            | "audioFolder"
            | "documentsFolder"
            | "generalFolder"
            | "compressedFolder"
            | "programsFolder"
            | "tempFolder"
    ) => void;
    openFolder: (path?: string | null) => void;
}) {
    return (
        <div className="max-w-3xl mx-auto space-y-6 pb-8 animate-in fade-in duration-150">
            {/* General Settings */}
            <SettingsSection title={t("settings_general")} icon={<Sliders size={16} />}>
                <SettingRow title={t("settings_theme")} desc="Choose from 6 custom visual themes">
                    <ThemeDropdown currentTheme={theme} onSelectTheme={handleThemeChange} />
                </SettingRow>

                <SettingRow title={t("settings_lang")} desc="Application interface display language">
                    <select
                        value={settings.language}
                        onChange={(e) => updateSetting("language", e.target.value)}
                        className="bg-surface-2 border border-border-subtle rounded-md px-3 py-1.5 text-caption font-semibold outline-none text-primary cursor-pointer"
                    >
                        <option value="en">English (US)</option>
                        <option value="es">Español</option>
                        <option value="de">Deutsch</option>
                        <option value="fr">Français</option>
                        <option value="zh">中文 (简体)</option>
                    </select>
                </SettingRow>

                <SettingToggle
                    title={t("settings_autoplay")}
                    desc={t("settings_autoplay_desc")}
                    checked={settings.autoplay}
                    onChange={(v) => updateSetting("autoplay", v)}
                />

                <SettingToggle
                    title={t("settings_autostart")}
                    desc={t("settings_autostart_desc")}
                    checked={settings.launchOnBoot}
                    onChange={handleToggleAutostart}
                />

                <SettingToggle
                    title={t("settings_tray")}
                    desc={t("settings_tray_desc")}
                    checked={settings.minimizeToTray}
                    onChange={(v) => updateSetting("minimizeToTray", v)}
                />

                <SettingRow title={t("settings_updates")} desc="Check GitHub for newer releases and yt-dlp patches">
                    <select
                        value={settings.checkUpdates}
                        onChange={(e) => updateSetting("checkUpdates", e.target.value)}
                        className="bg-surface-2 border border-border-subtle rounded-md px-3 py-1.5 text-caption font-semibold outline-none text-primary cursor-pointer"
                    >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="manual">Manual Only</option>
                    </select>
                </SettingRow>
            </SettingsSection>

            {/* Downloads Settings */}
            <SettingsSection title={t("settings_downloads")} icon={<Download size={16} />}>
                <SettingRow title={t("settings_save_loc")} desc="Base root directory where downloads are stored">
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            readOnly
                            value={settings.saveFolder}
                            className="bg-surface-0 border border-border-subtle rounded-md px-2.5 py-1 text-caption text-primary outline-none w-44 truncate"
                            title={settings.saveFolder}
                        />
                        <button
                            type="button"
                            onClick={() => handleBrowseFolder("saveFolder")}
                            className="px-3 py-1 rounded-md bg-accent text-white hover:bg-accent-hover text-caption font-semibold transition-colors shadow-sm"
                        >
                            Browse...
                        </button>
                        <button
                            type="button"
                            onClick={() => openFolder(null)}
                            className="px-3 py-1 rounded-md bg-surface-2 hover:bg-surface-0 text-caption font-semibold border border-border-subtle"
                        >
                            Open
                        </button>
                    </div>
                </SettingRow>

                <SettingRow title="Video Downloads Location" desc="Custom directory for video files (.mp4, .mkv, .webm)">
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            readOnly
                            placeholder={`${settings.saveFolder || "Downloads/Devizee"}/Videos`}
                            value={settings.videoFolder || ""}
                            className="bg-surface-0 border border-border-subtle rounded-md px-2.5 py-1 text-caption text-primary outline-none w-44 truncate placeholder:text-tertiary"
                            title={settings.videoFolder || `${settings.saveFolder || "Downloads/Devizee"}/Videos`}
                        />
                        <button
                            type="button"
                            onClick={() => handleBrowseFolder("videoFolder")}
                            className="px-3 py-1 rounded-md bg-surface-2 hover:bg-surface-0 text-caption font-semibold border border-border-subtle"
                        >
                            Browse...
                        </button>
                        {settings.videoFolder && (
                            <button
                                type="button"
                                onClick={() => updateSetting("videoFolder", "")}
                                className="px-2 py-1 rounded-md text-caption text-tertiary hover:text-status-danger"
                                title="Reset to default subfolder"
                            >
                                Reset
                            </button>
                        )}
                    </div>
                </SettingRow>

                <SettingRow title="Audio Downloads Location" desc="Custom directory for audio files (.mp3, .m4a, .flac, .opus)">
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            readOnly
                            placeholder={`${settings.saveFolder || "Downloads/Devizee"}/Audio`}
                            value={settings.audioFolder || ""}
                            className="bg-surface-0 border border-border-subtle rounded-md px-2.5 py-1 text-caption text-primary outline-none w-44 truncate placeholder:text-tertiary"
                            title={settings.audioFolder || `${settings.saveFolder || "Downloads/Devizee"}/Audio`}
                        />
                        <button
                            type="button"
                            onClick={() => handleBrowseFolder("audioFolder")}
                            className="px-3 py-1 rounded-md bg-surface-2 hover:bg-surface-0 text-caption font-semibold border border-border-subtle"
                        >
                            Browse...
                        </button>
                        {settings.audioFolder && (
                            <button
                                type="button"
                                onClick={() => updateSetting("audioFolder", "")}
                                className="px-2 py-1 rounded-md text-caption text-tertiary hover:text-status-danger"
                                title="Reset to default subfolder"
                            >
                                Reset
                            </button>
                        )}
                    </div>
                </SettingRow>

                <SettingRow title="Documents Location" desc="Custom directory for documents (.pdf, .docx, .txt, .epub)">
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            readOnly
                            placeholder={`${settings.saveFolder || "Downloads/Devizee"}/Documents`}
                            value={settings.documentsFolder || settings.generalFolder || ""}
                            className="bg-surface-0 border border-border-subtle rounded-md px-2.5 py-1 text-caption text-primary outline-none w-44 truncate placeholder:text-tertiary"
                            title={
                                settings.documentsFolder ||
                                settings.generalFolder ||
                                `${settings.saveFolder || "Downloads/Devizee"}/Documents`
                            }
                        />
                        <button
                            type="button"
                            onClick={() => handleBrowseFolder("documentsFolder")}
                            className="px-3 py-1 rounded-md bg-surface-2 hover:bg-surface-0 text-caption font-semibold border border-border-subtle"
                        >
                            Browse...
                        </button>
                        {(settings.documentsFolder || settings.generalFolder) && (
                            <button
                                type="button"
                                onClick={() => {
                                    updateSetting("documentsFolder", "");
                                    updateSetting("generalFolder", "");
                                }}
                                className="px-2 py-1 rounded-md text-caption text-tertiary hover:text-status-danger"
                                title="Reset to default subfolder"
                            >
                                Reset
                            </button>
                        )}
                    </div>
                </SettingRow>

                <SettingRow title="Compressed Archives Location" desc="Custom directory for archives (.zip, .rar, .7z, .tar, .gz)">
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            readOnly
                            placeholder={`${settings.saveFolder || "Downloads/Devizee"}/Compressed`}
                            value={settings.compressedFolder || ""}
                            className="bg-surface-0 border border-border-subtle rounded-md px-2.5 py-1 text-caption text-primary outline-none w-44 truncate placeholder:text-tertiary"
                            title={settings.compressedFolder || `${settings.saveFolder || "Downloads/Devizee"}/Compressed`}
                        />
                        <button
                            type="button"
                            onClick={() => handleBrowseFolder("compressedFolder")}
                            className="px-3 py-1 rounded-md bg-surface-2 hover:bg-surface-0 text-caption font-semibold border border-border-subtle"
                        >
                            Browse...
                        </button>
                        {settings.compressedFolder && (
                            <button
                                type="button"
                                onClick={() => updateSetting("compressedFolder", "")}
                                className="px-2 py-1 rounded-md text-caption text-tertiary hover:text-status-danger"
                                title="Reset to default subfolder"
                            >
                                Reset
                            </button>
                        )}
                    </div>
                </SettingRow>

                <SettingRow title="Programs Location" desc="Custom directory for executables and installers (.exe, .msi)">
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            readOnly
                            placeholder={`${settings.saveFolder || "Downloads/Devizee"}/Programs`}
                            value={settings.programsFolder || ""}
                            className="bg-surface-0 border border-border-subtle rounded-md px-2.5 py-1 text-caption text-primary outline-none w-44 truncate placeholder:text-tertiary"
                            title={settings.programsFolder || `${settings.saveFolder || "Downloads/Devizee"}/Programs`}
                        />
                        <button
                            type="button"
                            onClick={() => handleBrowseFolder("programsFolder")}
                            className="px-3 py-1 rounded-md bg-surface-2 hover:bg-surface-0 text-caption font-semibold border border-border-subtle"
                        >
                            Browse...
                        </button>
                        {settings.programsFolder && (
                            <button
                                type="button"
                                onClick={() => updateSetting("programsFolder", "")}
                                className="px-2 py-1 rounded-md text-caption text-tertiary hover:text-status-danger"
                                title="Reset to default subfolder"
                            >
                                Reset
                            </button>
                        )}
                    </div>
                </SettingRow>

                <SettingRow
                    title="Temporary / In-Progress Files Location"
                    desc="Scratch directory for active download segments before final muxing"
                >
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            readOnly
                            placeholder="System Temp (Default)"
                            value={settings.tempFolder || ""}
                            className="bg-surface-0 border border-border-subtle rounded-md px-2.5 py-1 text-caption text-primary outline-none w-44 truncate placeholder:text-tertiary"
                            title={settings.tempFolder || "System Temp (Default)"}
                        />
                        <button
                            type="button"
                            onClick={() => handleBrowseFolder("tempFolder")}
                            className="px-3 py-1 rounded-md bg-surface-2 hover:bg-surface-0 text-caption font-semibold border border-border-subtle"
                        >
                            Browse...
                        </button>
                        {settings.tempFolder && (
                            <button
                                type="button"
                                onClick={() => updateSetting("tempFolder", "")}
                                className="px-2 py-1 rounded-md text-caption text-tertiary hover:text-status-danger"
                                title="Reset to default scratch location"
                            >
                                Reset
                            </button>
                        )}
                    </div>
                </SettingRow>

                <SettingToggle
                    title={t("settings_auto_org")}
                    desc={t("settings_auto_org_desc")}
                    checked={settings.autoOrganize}
                    onChange={(v) => updateSetting("autoOrganize", v)}
                />

                <SettingRow title={t("settings_filename")} desc="Template used when naming downloaded files">
                    <input
                        type="text"
                        value={settings.filenameTemplate}
                        onChange={(e) => updateSetting("filenameTemplate", e.target.value)}
                        className="bg-surface-0 border border-border-subtle rounded-md px-2.5 py-1 text-caption text-primary outline-none font-mono w-56"
                    />
                </SettingRow>

                <SettingRow title={t("settings_duplicate")} desc="Action when file already exists on disk">
                    <select
                        value={settings.duplicateAction}
                        onChange={(e) => updateSetting("duplicateAction", e.target.value)}
                        className="bg-surface-2 border border-border-subtle rounded-md px-3 py-1.5 text-caption font-semibold outline-none text-primary cursor-pointer"
                    >
                        <option value="rename">Rename (Add Number)</option>
                        <option value="overwrite">Overwrite Existing</option>
                        <option value="skip">Skip Download</option>
                        <option value="ask">Always Ask</option>
                    </select>
                </SettingRow>

                <SettingToggle
                    title={t("settings_oneclick")}
                    desc={t("settings_oneclick_desc")}
                    checked={settings.oneClickDownload}
                    onChange={(v) => updateSetting("oneClickDownload", v)}
                />
            </SettingsSection>

            {/* Connection & Speed Limit */}
            <SettingsSection title={t("settings_speed")} icon={<FastForward size={16} />}>
                <SettingRow title={t("settings_speed_limit")} desc="Throttle bandwidth to prevent network saturation">
                    <div className="flex items-center gap-2">
                        <select
                            value={settings.speedLimit}
                            onChange={(e) => updateSetting("speedLimit", e.target.value)}
                            className="bg-surface-2 border border-border-subtle rounded-md px-3 py-1.5 text-caption font-semibold outline-none text-primary cursor-pointer"
                        >
                            <option value="unlimited">{t("settings_speed_unlimited")}</option>
                            <option value="1M">1.0 MB/s</option>
                            <option value="3M">3.0 MB/s</option>
                            <option value="5M">5.0 MB/s</option>
                            <option value="10M">10.0 MB/s</option>
                            <option value="custom">{t("settings_speed_custom")}</option>
                        </select>
                        {settings.speedLimit === "custom" && (
                            <input
                                type="text"
                                placeholder="e.g. 500K, 2.5M"
                                value={settings.customSpeedLimit}
                                onChange={(e) => updateSetting("customSpeedLimit", e.target.value)}
                                className="w-24 bg-surface-0 border border-border-subtle rounded-md px-2 py-1 text-caption text-primary outline-none font-mono"
                            />
                        )}
                    </div>
                </SettingRow>

                <SettingToggle
                    title={t("settings_proxy")}
                    desc={t("settings_proxy_desc")}
                    checked={settings.proxyEnabled}
                    onChange={(v) => updateSetting("proxyEnabled", v)}
                />

                {settings.proxyEnabled && (
                    <div className="p-3 bg-surface-0 rounded-md space-y-2 border border-border-subtle animate-in fade-in duration-fast">
                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <label className="text-[10px] font-semibold text-secondary uppercase">Protocol</label>
                                <select
                                    value={settings.proxyProtocol}
                                    onChange={(e) => updateSetting("proxyProtocol", e.target.value)}
                                    className="w-full bg-surface-2 border border-border-subtle rounded-md px-2 py-1 text-caption text-primary outline-none cursor-pointer"
                                >
                                    <option value="socks5">SOCKS5</option>
                                    <option value="http">HTTP</option>
                                    <option value="https">HTTPS</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-semibold text-secondary uppercase">Host / IP</label>
                                <input
                                    type="text"
                                    placeholder="127.0.0.1"
                                    value={settings.proxyHost}
                                    onChange={(e) => updateSetting("proxyHost", e.target.value)}
                                    className="w-full bg-surface-1 border border-border-subtle rounded-md px-2 py-1 text-caption text-primary outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-semibold text-secondary uppercase">Port</label>
                                <input
                                    type="text"
                                    placeholder="1080"
                                    value={settings.proxyPort}
                                    onChange={(e) => updateSetting("proxyPort", e.target.value)}
                                    className="w-full bg-surface-1 border border-border-subtle rounded-md px-2 py-1 text-caption text-primary outline-none"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </SettingsSection>

            {/* Scheduler & Night Mode */}
            <SettingsSection title={t("settings_scheduler")} icon={<Clock size={16} />}>
                <SettingToggle
                    title={t("settings_night_mode")}
                    desc={t("settings_night_mode_desc")}
                    checked={settings.enableScheduler}
                    onChange={(v) => updateSetting("enableScheduler", v)}
                />

                {settings.enableScheduler && (
                    <div className="flex items-center justify-between p-2.5 bg-surface-0 rounded-md border border-border-subtle text-caption text-secondary">
                        <span>Night Queue Start Time:</span>
                        <input
                            type="time"
                            value={settings.scheduledTime}
                            onChange={(e) => updateSetting("scheduledTime", e.target.value)}
                            className="bg-surface-2 border border-border-subtle rounded px-2 py-0.5 text-primary text-caption font-semibold outline-none"
                        />
                    </div>
                )}
            </SettingsSection>

            {/* Sounds & Volume */}
            <SettingsSection title="Sounds & Volume" icon={<Volume2 size={16} />}>
                <SettingRow title="Audio Output Device" desc="Select your preferred speaker for playback">
                    <select
                        value={selectedAudioDevice}
                        onChange={(e) => handleDeviceChange(e.target.value)}
                        className="bg-surface-2 border border-border-subtle rounded-md px-3 py-1.5 text-caption font-semibold outline-none text-primary cursor-pointer w-56 truncate"
                    >
                        {audioDevices.map((d) => (
                            <option key={d.deviceId} value={d.deviceId}>
                                {d.label || "Speaker " + d.deviceId.slice(0, 4)}
                            </option>
                        ))}
                    </select>
                </SettingRow>

                <SettingRow title="Master Media Volume" desc="Global playback volume for previews and player">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={toggleMute}
                            className="w-7 h-7 rounded-md bg-surface-2 hover:bg-surface-3 text-secondary hover:text-primary flex items-center justify-center transition-colors border border-border-subtle"
                        >
                            {isMuted || volume === 0 ? (
                                <VolumeX size={13} />
                            ) : volume < 0.5 ? (
                                <Volume1 size={13} />
                            ) : (
                                <Volume2 size={13} />
                            )}
                        </button>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={isMuted ? 0 : volume}
                            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                            className="w-28 h-1.5 bg-surface-2 accent-accent cursor-pointer rounded-full"
                        />
                        <span className="text-caption font-mono w-8 text-right text-secondary">
                            {Math.round((isMuted ? 0 : volume) * 100)}%
                        </span>
                    </div>
                </SettingRow>

                <SettingToggle
                    title="Audible Completion Chime"
                    desc="Play a pleasant sound effect upon task completion"
                    checked={settings.playSound}
                    onChange={(v) => updateSetting("playSound", v)}
                />

                <SettingToggle
                    title="Desktop Notifications"
                    desc="Display system notifications when downloads conclude"
                    checked={settings.showNotifications}
                    onChange={(v) => updateSetting("showNotifications", v)}
                />
            </SettingsSection>

            {/* Antivirus & Protection */}
            <SettingsSection title={t("settings_security")} icon={<Shield size={16} />}>
                <SettingToggle
                    title={t("settings_defender")}
                    desc={t("settings_defender_desc")}
                    checked={settings.scanAntivirus}
                    onChange={(v) => updateSetting("scanAntivirus", v)}
                />
            </SettingsSection>

            {/* Advanced & Engine */}
            <SettingsSection title={t("settings_advanced")} icon={<Cpu size={16} />}>
                <SettingRow
                    title="YouTube Cookies from Browser"
                    desc="Uses your browser's login to access age-restricted and bot-detected videos. Requires the browser to be installed on this PC and logged into YouTube."
                >
                    <select
                        value={settings.cookiesFromBrowser || "none"}
                        onChange={(e) => updateSetting("cookiesFromBrowser", e.target.value)}
                        className="bg-surface-2 border border-border-subtle rounded-md px-3 py-1.5 text-caption font-semibold outline-none text-primary cursor-pointer"
                    >
                        <option value="none">Disabled (default)</option>
                        <option value="chrome">Chrome</option>
                        <option value="edge">Edge</option>
                        <option value="firefox">Firefox</option>
                        <option value="brave">Brave</option>
                        <option value="opera">Opera</option>
                        <option value="vivaldi">Vivaldi</option>
                    </select>
                </SettingRow>

                <SettingRow title={t("settings_custom_flags")} desc={t("settings_custom_flags_desc")}>
                    <input
                        type="text"
                        placeholder="--throttled-rate 100K ..."
                        value={settings.customFlags}
                        onChange={(e) => updateSetting("customFlags", e.target.value)}
                        className="bg-surface-0 border border-border-subtle rounded-md px-2.5 py-1 text-caption text-primary outline-none font-mono w-56"
                    />
                </SettingRow>

                <SettingRow title="yt-dlp Engine Status" desc="Active core extraction & muxing binary">
                    <div className="flex items-center gap-2">
                        <span className="text-caption font-mono bg-surface-2 px-2 py-0.5 rounded text-secondary">
                            2026.08.19
                        </span>
                        <button
                            onClick={() => alert("yt-dlp engine is currently up to date.")}
                            className="px-2.5 py-1 rounded-md bg-surface-2 hover:bg-surface-0 text-caption font-semibold flex items-center gap-1 text-accent border border-border-subtle"
                        >
                            <RefreshCw size={12} /> Check Update
                        </button>
                    </div>
                </SettingRow>
            </SettingsSection>

            {/* About Devizee */}
            <div className="p-4 bg-surface-1 rounded-md shadow-raised flex items-center justify-between text-caption text-secondary">
                <div>
                    <p className="font-semibold text-primary">Devizee Download Manager</p>
                    <p className="text-[11px] text-tertiary">Licensed under MIT • Zero telemetry & 100% open source</p>
                </div>
                <a
                    href="https://github.com/Touseeef/devizee-all-in-one-download-manager"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-accent font-semibold hover:underline"
                >
                    <span>GitHub Repository</span>
                    <ExternalLink size={12} />
                </a>
            </div>
        </div>
    );
}