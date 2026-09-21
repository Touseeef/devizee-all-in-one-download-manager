import React, { useState, useEffect, useRef } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core"; import { listen } from "@tauri-apps/api/event";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { open } from "@tauri-apps/plugin-dialog";
import { AlertCircle } from "lucide-react";

import { ErrorBoundary } from "./ErrorBoundary";

import type {
  FormatOption,
  VideoInfo,
  PlaylistEntry,
  PlaylistInfo,
  DownloadRecord,
} from "./types";
import {
  parseTimeToSeconds,
  formatSecondsToTime,
} from "./lib/format";
import {
  isVideoFormat,
  isAudioFormat,
} from "./lib/formatClassify";
import { createTranslator } from "./lib/i18n";
import { globalAudioState } from "./lib/audioContext";

import { ConfirmDialog } from "./components/common/ConfirmDialog";
import { StatCard } from "./components/downloads/StatCard";
import { SettingsTab } from "./components/settings/SettingsTab";
import { AudioHubTab } from "./components/audio/AudioHubTab";
import { UrlInput } from "./components/downloads/UrlInput";
import { SearchResults } from "./components/downloads/SearchResults";
import { ActivityList } from "./components/downloads/ActivityList";
import { VideoCard } from "./components/downloads/VideoCard";
import { PlaylistPanel } from "./components/downloads/PlaylistPanel";
import { BatchProgress } from "./components/downloads/BatchProgress";
import { DuplicateDialog } from "./components/common/DuplicateDialog";
import type { DuplicateDialogState } from "./components/common/DuplicateDialog";
import { revealItemInDir, openPath } from "@tauri-apps/plugin-opener";
import { AppShell } from "./components/layout/AppShell";
import { Sidebar } from "./components/layout/Sidebar";
import { ClipboardHud } from "./components/hud/ClipboardHud";
import { MiniPlayerBar } from "./components/downloads/MiniPlayerBar";


export default function App() {
  const isHud = window.location.search.includes("hud=true");

  // Navigation & Tabs
  const [activeTab, setActiveTab] = useState<"downloads" | "audio" | "settings">("downloads");
  const [url, setUrl] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [isLoadingPlaylist, setIsLoadingPlaylist] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [showPreviews, setShowPreviews] = useState(true);
  const [duplicateDialog, setDuplicateDialog] = useState<DuplicateDialogState | null>(null);
  const [selectedHistoryItems, setSelectedHistoryItems] = useState<Set<string>>(new Set());
  const [confirmDialogState, setConfirmDialogState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    confirmVariant?: "danger" | "accent";
    onConfirm: () => void;
  } | null>(null);

  // Playlist states
  const [playlistInfo, setPlaylistInfo] = useState<PlaylistInfo | null>(null);
  const [showPlaylistSection, setShowPlaylistSection] = useState(true);
  const [selectedPlaylistItems, setSelectedPlaylistItems] = useState<Set<string>>(new Set());

  // Single Global "Now Playing" Mutual-Exclusivity State
  const [nowPlaying, setNowPlaying] = useState<{ type: "none" | "audio" | "video"; id: string | null }>({ type: "none", id: null });

  // In-App Video Player State
  const [activeVideoPlaying, setActiveVideoPlaying] = useState(false);
  const [videoStreamUrl, setVideoStreamUrl] = useState<string | null>(null);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [videoFullscreen, setVideoFullscreen] = useState(false);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const mainScrollRef = useRef<HTMLElement | null>(null);
  const videoStreamCache = useRef<Map<string, string>>(new Map());

  const resetInput = () => {
    setUrl("");
    setFetchError("");
    setSelectedFormat(null);
    setVideoInfo(null);
    setPlaylistInfo(null);
    setSearchResults(null);
    setVideoFullscreen(false);
    setShowPreviews(true);
    setIsTrimming(false);
    setActiveCardTaskId(null);
  };

  // YouTube IFrame API PostMessage Command Dispatcher
  const sendIframeCommand = (func: string, args: any[] = []) => {
    try {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({
            event: "command",
            func: func,
            args: args,
          }),
          "*"
        );
      }
    } catch (e) {
      console.warn("sendIframeCommand failed:", e);
    }
  };

  // In-Line Audio Preview & Scrubbing State
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [isAudioElementPlaying, setisAudioElementPlaying] = useState(false);
  const [isLoadingAudioId, setIsLoadingAudioId] = useState<string | null>(null);
  const [previewTime, setPreviewTime] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(0);

  const audioStreamCache = useRef<Map<string, string>>(new Map());

  // --- NEW: Audio Output Devices State ---
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>("default");

  const refreshAudioDevices = async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      // Request temporary media permission to unlock hardware device labels in Chromium
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
      } catch (_) { }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const outputs = devices.filter(d => d.kind === "audiooutput");
      setAudioDevices(outputs.length > 0 ? outputs : [{ deviceId: "default", label: "Default System Audio", kind: "audiooutput", groupId: "", toJSON: () => ({}) }]);
    } catch (e) {
      console.error("Device enumeration error:", e);
    }
  };

  useEffect(() => {
    refreshAudioDevices();
    navigator.mediaDevices?.addEventListener?.("devicechange", refreshAudioDevices);
    return () => {
      navigator.mediaDevices?.removeEventListener?.("devicechange", refreshAudioDevices);
    };
  }, []);

  const handleDeviceChange = async (deviceId: string) => {
    setSelectedAudioDevice(deviceId);
    try {
      const audioEl = audioRef.current as any;
      if (audioEl && typeof audioEl.setSinkId === "function") {
        await audioEl.setSinkId(deviceId);
      }

      const videoEl = videoElementRef.current as any;
      if (videoEl && typeof videoEl.setSinkId === "function") {
        await videoEl.setSinkId(deviceId);
      }
    } catch (e) {
      console.error("Audio routing failed", e);
    }
  };

  // --- NEW: Synchronous AudioContext Unlocker ---
  const unlockAudioContext = () => {
    if (!globalAudioState.ctx) {
      try { globalAudioState.ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); } catch (e) { }
    }
    if (globalAudioState.ctx && globalAudioState.ctx.state === 'suspended') {
      globalAudioState.ctx.resume().catch(() => { });
    }
  };

  // Global Volume State (Persisted)
  const [volume, setVolume] = useState<number>(() => {
    const saved = localStorage.getItem("devizee_volume");
    return saved !== null ? parseFloat(saved) : 0.8;
  });
  const [isMuted, setIsMuted] = useState(false);

  // Clip-Before-Download (Trimming USP) State
  const [isTrimming, setIsTrimming] = useState(false);
  const [trimStart, setTrimStart] = useState("00:00");
  const [trimEnd, setTrimEnd] = useState("");

  // Card Download Live Status Tracker (Prevents Card Disappearing)
  const [activeCardTaskId, setActiveCardTaskId] = useState<string | null>(null);

  // Priority 3: Explicit Quality Selection State
  const [selectedFormat, setSelectedFormat] = useState<FormatOption | null>(null);

  // Audio Hub state (url/format now live inside AudioHubTab)
  const [activeAudioPlaying, setActiveAudioPlaying] = useState<DownloadRecord | null>(null);
  const [audioQueue, setAudioQueue] = useState<DownloadRecord[]>([]);
  const [audioQueuePos, setAudioQueuePos] = useState(0);
  const [audioShuffle, setAudioShuffle] = useState(false);
  const [audioRepeat, setAudioRepeat] = useState<"off" | "all" | "one">("off");
  // History, Queue Filtering & Sorting
  const [history, setHistory] = useState<DownloadRecord[]>([]);
  const [activitySearchQuery, setActivitySearchQuery] = useState("");
  const [queueFilter, setQueueFilter] = useState<"all" | "video" | "audio" | "active" | "queued" | "completed" | "attention">("all"); const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "size_desc" | "size_asc" | "title" | "progress">("date_desc");
  const completedBatch = useRef<string[]>([]);
  const errorBatch = useRef<string[]>([]);
  const notificationTimer = useRef<any>(null);

  // YouTube Keyword Search State
  const [searchResults, setSearchResults] = useState<PlaylistEntry[] | null>(null);
  const [isSearchingYoutube, setIsSearchingYoutube] = useState(false);

  // Playlist Bulk-Download State & Batch Progress View
  const [batchPreset, setBatchPreset] = useState("1080p");
  const [batchFormatId, setBatchFormatId] = useState("bestvideo[height<=1080]+bestaudio/best[height<=1080]");
  const [batchExt, setBatchExt] = useState("mp4");
  const [batchIsAudio, setBatchIsAudio] = useState(false);
  const [activePlaylistBatch, setActivePlaylistBatch] = useState<{
    title: string;
    taskIds: string[];
    formatLabel: string;
  } | null>(null);

  // User Settings State
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem("devizee_settings");
    if (saved) {
      try { return JSON.parse(saved); } catch { }
    }
    return {
      // General
      language: "en",
      launchOnBoot: false,
      minimizeToTray: true,
      checkUpdates: "daily",
      theme: "dark",
      autoplay: false,
      // Downloads
      saveFolder: "Downloads/Devizee",
      videoFolder: "",
      audioFolder: "",
      documentsFolder: "",
      compressedFolder: "",
      programsFolder: "",
      tempFolder: "",
      autoOrganize: true,

      filenameTemplate: "%(title)s [%(id)s].%(ext)s",
      duplicateAction: "rename",
      defaultPreset: "best",
      oneClickDownload: false,
      maxParallel: 3,
      maxConnections: 8,
      // Connection & Speed
      speedLimit: "unlimited",
      customSpeedLimit: "2M",
      quietHoursSpeedLimit: false,
      proxyEnabled: false,
      proxyProtocol: "socks5",
      proxyHost: "127.0.0.1",
      proxyPort: "1080",
      proxyUser: "",
      proxyPass: "",
      connectionTimeout: 30,
      retryCount: 3,
      // Scheduler
      enableScheduler: false,
      scheduledTime: "02:00",
      quietHoursStart: "09:00",
      quietHoursEnd: "18:00",
      postDownloadAction: "nothing",
      // Security
      scanAntivirus: true,
      httpsWarnings: true,
      // yt-dlp auth — helps with age-restricted / bot-detected videos
      cookiesFromBrowser: "none",
      // Sounds & Notifications
      playSound: true,
      showNotifications: true,
      groupNotifications: true,
      // Helpers
      clipboardRadar: true,
      fake4kDetection: true,
      autoTagMusic: true,
      // Privacy & History
      historyLogging: true,
      autoClearDays: 30,
      // Advanced
      customFlags: "",
      logLevel: "info",
    };
  });

  const [theme, setTheme] = useState<string>(() => settings.theme || localStorage.getItem("devizee_theme") || "dark");

  const updateSetting = (key: string, val: any) => {
    setSettings((prev: any) => {
      const next = { ...prev, [key]: val };
      localStorage.setItem("devizee_settings", JSON.stringify(next));
      return next;
    });
  };

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    updateSetting("theme", newTheme);
  };

  // Immediate theme application (supports all 5 themes and sets data-theme attribute)
  useEffect(() => {
    localStorage.setItem("devizee_theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
    // Light mode is the only non-dark theme; OLED, Sunset, and Frost are dark-variant themes
    document.documentElement.classList.toggle("dark", theme !== "light");
  }, [theme]);

  // Fullscreen change listener
  useEffect(() => {
    const onFsChange = () => {
      setVideoFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Single Consolidated Volume Controller
  const handleVolumeChange = (newVol: number) => {
    const clamped = Math.max(0, Math.min(1, newVol));
    setVolume(clamped);
    setIsMuted(clamped === 0);
    localStorage.setItem("devizee_volume", clamped.toString());
    updateSetting("volume", clamped);
    if (audioRef.current) audioRef.current.volume = clamped;
    if (videoElementRef.current) videoElementRef.current.volume = clamped;
    sendIframeCommand("setVolume", [Math.round(clamped * 100)]);
    if (clamped === 0) {
      sendIframeCommand("mute");
    } else {
      sendIframeCommand("unMute");
    }
  };

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      const restore = volume > 0 ? volume : 0.8;
      if (audioRef.current) audioRef.current.volume = restore;
      if (videoElementRef.current) videoElementRef.current.volume = restore;
      sendIframeCommand("unMute");
      sendIframeCommand("setVolume", [Math.round(restore * 100)]);
    } else {
      setIsMuted(true);
      if (audioRef.current) audioRef.current.volume = 0;
      if (videoElementRef.current) videoElementRef.current.volume = 0;
      sendIframeCommand("mute");
    }
  };

  // Sync volume to audio/video elements and iframe on state change or mount
  useEffect(() => {
    const effective = isMuted ? 0 : volume;
    if (audioRef.current) audioRef.current.volume = effective;
    if (videoElementRef.current) videoElementRef.current.volume = effective;
    sendIframeCommand("setVolume", [Math.round(effective * 100)]);
    if (isMuted || effective === 0) {
      sendIframeCommand("mute");
    } else {
      sendIframeCommand("unMute");
    }
  }, [volume, isMuted, activeVideoPlaying]);

  // Unified Fullscreen Exit & Close Handlers
  const exitFullscreenAndKeepPlaying = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => { });
    }
    setVideoFullscreen(false);
  };

  const handleCloseVideoPlayer = () => {
    exitFullscreenAndKeepPlaying();
    setActiveVideoPlaying(false);
    setNowPlaying({ type: "none", id: null });
    if (videoElementRef.current) videoElementRef.current.pause();
    sendIframeCommand("pauseVideo");
  };

  // Actually load a track into the audio element. Used by queue navigation.
  const playAudioItemNow = (item: DownloadRecord) => {
    if (!item.file_path || !audioRef.current) {
      console.warn("[AudioHub] Skipping play — no file_path or audio element", {
        hasFilePath: !!item.file_path,
        hasAudioRef: !!audioRef.current,
        title: item.title,
      });
      return;
    }
    if (videoElementRef.current) videoElementRef.current.pause();
    sendIframeCommand("pauseVideo");
    setPreviewingId(null);
    setActiveAudioPlaying(item);
    setNowPlaying({ type: "audio", id: item.id });

    const src = convertFileSrc(item.file_path);
    console.log("[AudioHub] Loading:", src);

    audioRef.current.src = src;
    audioRef.current.volume = isMuted ? 0 : volume;

    audioRef.current
      .play()
      .then(() => {
        console.log("[AudioHub] Playback started");
        setisAudioElementPlaying(true);
      })
      .catch((err) => console.error("[AudioHub] Play failed:", err));
  };
  // Click handler for a library row. Builds a fresh queue and starts playback.
  const playAudioFromLibrary = (item: DownloadRecord) => {
    unlockAudioContext();

    // Toggle: same track + playing → pause
    if (activeAudioPlaying?.id === item.id && isAudioElementPlaying) {
      audioRef.current?.pause();
      setisAudioElementPlaying(false);
      return;
    }

    // Toggle: same track + paused → resume
    if (activeAudioPlaying?.id === item.id && audioRef.current) {
      audioRef.current
        .play()
        .then(() => setisAudioElementPlaying(true))
        .catch(() => { });
      return;
    }

    if (!item.file_path) return;

    const lib = history.filter(
      (h) => h.status === "completed" && isAudioFormat(h.format)
    );
    if (lib.length === 0) return;

    let ordered = [...lib];
    if (audioShuffle) {
      for (let i = ordered.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
      }
    }

    const startIdx = ordered.findIndex((x) => x.id === item.id);
    setAudioQueue(ordered);
    setAudioQueuePos(startIdx >= 0 ? startIdx : 0);
    playAudioItemNow(item);
  };

  // Transport controls
  const toggleAudioPlayPause = () => {
    if (!audioRef.current) return;
    if (isAudioElementPlaying) {
      audioRef.current.pause();
      setisAudioElementPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setisAudioElementPlaying(true))
        .catch(() => { });
    }
  };

  const audioNext = () => {
    if (audioQueue.length === 0) return;
    const nextPos = audioQueuePos + 1;
    if (nextPos < audioQueue.length) {
      setAudioQueuePos(nextPos);
      playAudioItemNow(audioQueue[nextPos]);
    } else if (audioRepeat === "all") {
      setAudioQueuePos(0);
      playAudioItemNow(audioQueue[0]);
    }
  };

  const audioPrev = () => {
    if (audioQueue.length === 0 || !audioRef.current) return;
    // Restart current track if past 3 seconds
    if (audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }
    const prevPos = audioQueuePos - 1;
    if (prevPos >= 0) {
      setAudioQueuePos(prevPos);
      playAudioItemNow(audioQueue[prevPos]);
    } else if (audioRepeat === "all") {
      const lastPos = audioQueue.length - 1;
      setAudioQueuePos(lastPos);
      playAudioItemNow(audioQueue[lastPos]);
    }
  };

  const toggleAudioShuffle = () => {
    const nextShuffle = !audioShuffle;
    setAudioShuffle(nextShuffle);

    // Rebuild remaining queue to reflect new shuffle setting
    if (audioQueue.length > 0) {
      const played = audioQueue.slice(0, audioQueuePos + 1);
      const remaining = audioQueue.slice(audioQueuePos + 1);
      if (nextShuffle) {
        for (let i = remaining.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
        }
      }
      setAudioQueue([...played, ...remaining]);
    }
  };

  const cycleAudioRepeat = () => {
    setAudioRepeat((prev) =>
      prev === "off" ? "all" : prev === "all" ? "one" : "off"
    );
  };

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) {
        return; // Do not intercept while typing
      }

      if (e.code === "Space") {
        e.preventDefault();
        if (nowPlaying.type === "video" && videoElementRef.current) {
          if (videoElementRef.current.paused) videoElementRef.current.play();
          else videoElementRef.current.pause();
        } else if (nowPlaying.type === "audio" && audioRef.current) {
          if (isAudioElementPlaying) {
            audioRef.current.pause();
            setisAudioElementPlaying(false);
          } else {
            audioRef.current.play().then(() => setisAudioElementPlaying(true)).catch(() => { });
          }
        }
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        if (nowPlaying.type === "video" && videoElementRef.current) {
          videoElementRef.current.currentTime = Math.max(0, videoElementRef.current.currentTime - 5);
        } else if (nowPlaying.type === "audio" && audioRef.current) {
          handleSeekRelative(-5);
        }
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        if (nowPlaying.type === "video" && videoElementRef.current) {
          videoElementRef.current.currentTime = Math.min(
            videoElementRef.current.duration || 86400,
            videoElementRef.current.currentTime + 5
          );
        } else if (nowPlaying.type === "audio" && audioRef.current) {
          handleSeekRelative(5);
        }
      } else if (e.code === "Escape") {
        if (document.fullscreenElement) {
          e.preventDefault();
          exitFullscreenAndKeepPlaying();
        }
      } else if (e.code === "KeyM") {
        e.preventDefault();
        toggleMute();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nowPlaying, isAudioElementPlaying, volume, isMuted]);

  // Browse Folder via plugin-dialog
  const handleBrowseFolder = async (key: "saveFolder" | "videoFolder" | "audioFolder" | "documentsFolder" | "generalFolder" | "compressedFolder" | "programsFolder" | "tempFolder") => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        defaultPath: (settings as any)[key] || settings.saveFolder,
      });
      if (selected && typeof selected === "string") {
        updateSetting(key, selected);
      }
    } catch (err) {
      console.error(`Browse ${key} error:`, err);
    }
  };

  // Web Audio API Synthesized Completion Chime
  const playCompletionChime = () => {
    if (!settings.playSound || isMuted || volume === 0) return;
    try {
      if (!globalAudioState.ctx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        globalAudioState.ctx = new AudioCtx();
      }
      const ctx = globalAudioState.ctx;
      if (ctx.state === "suspended") ctx.resume().catch(() => { });
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);
        gain.gain.setValueAtTime(0.22 * volume, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.4);
      });
    } catch (e) {
      console.error("Failed to play chime", e);
    }
  };
  // Guard against tab-switch playback side-effects
  useEffect(() => {
    // When switching tabs, ensure we don't trigger accidental autoplay
    if (activeTab !== "downloads") {
      if (videoElementRef.current) videoElementRef.current.pause();
      sendIframeCommand("pauseVideo");
    }
  }, [activeTab]);

  // Translation helper
  const t = createTranslator(settings.language);

  // Autostart toggle handler
  const handleToggleAutostart = async (enable: boolean) => {
    updateSetting("launchOnBoot", enable);
    try {
      await invoke("set_autostart", { enable });
    } catch (err) {
      console.error("Autostart setting error:", err);
    }
  };

  const openFolder = async (path?: string | null) => {
    try {
      const resolved = await invoke<string>("resolve_folder_path", {
        path: path || null,
        baseDir: settings.saveFolder,
      });

      // If a specific file was requested, reveal it in its parent folder.
      // Otherwise open the resolved directory itself.
      if (path) {
        try {
          await revealItemInDir(resolved);
          return;
        } catch {
          // fall through to openPath
        }
      }
      await openPath(resolved);
    } catch (e) {
      console.error("openFolder failed:", e);
    }
  };
  // Open file handler (launches default player directly)
  const openFile = async (path?: string | null) => {
    if (!path) return;
    try {
      await invoke("open_file", { path });
    } catch (e) {
      console.error("Failed to open file", e);
    }
  };

  // Clipboard Radar Logic
  const lastClipboard = useRef<string>("");

  // One-time migration: fix any legacy double-nested file paths
  // ("Downloads/Devizee/Downloads/Devizee/...") left over from before
  // the resolve_output_dir fix. Safe to run every startup — it just
  // rewrites matching paths and returns 0 for already-fixed records.
  useEffect(() => {
    invoke<number>("fix_legacy_paths")
      .then((n) => {
        if (n > 0) {
          console.log(`[Migration] Fixed ${n} legacy paths`);
          loadHistory();
        }
      })
      .catch((e) => console.warn("[Migration] Skipped:", e));
  }, []);

  useEffect(() => {
    // HUD window listens for its own data inside ClipboardHud.
    // This effect only runs in the main app window.
    if (isHud) return;
    if (!settings.clipboardRadar) return;

    const interval = setInterval(async () => {
      try {
        const text = await readText();
        if (
          text &&
          text !== lastClipboard.current &&
          (text.includes("youtube.com") || text.includes("youtu.be"))
        ) {
          lastClipboard.current = text;
          const info: VideoInfo = await invoke("fetch_video_info", { url: text, cookiesFromBrowser: settings.cookiesFromBrowser });
          let hudWin = await WebviewWindow.getByLabel("hud");
          if (!hudWin) {
            hudWin = new WebviewWindow("hud", {
              url: "/?hud=true",
              width: 350,
              height: 120,
              transparent: true,
              decorations: false,
              alwaysOnTop: true,
              resizable: false,
              focus: false,
            });
          }
          hudWin.emit("hud-data", { info, url: text });
          hudWin.show();
          setTimeout(() => {
            hudWin?.hide();
          }, 8000);
        }
      } catch { }
    }, 1500);

    return () => clearInterval(interval);
  }, [isHud, settings.clipboardRadar]);

  const flushNotifications = async () => {
    if (!settings.showNotifications) return;
    let granted = await isPermissionGranted();
    if (!granted) {
      const permission = await requestPermission();
      granted = permission === "granted";
    }
    if (!granted) return;

    const comps = completedBatch.current.length;
    const errs = errorBatch.current.length;

    if (comps > 0) {
      sendNotification({
        title: "Devizee",
        body: comps === 1 ? "1 download completed successfully." : `${comps} downloads completed successfully.`,
      });
      playCompletionChime();
    }
    if (errs > 0) {
      sendNotification({
        title: "Devizee Error",
        body: errs === 1 ? "1 download failed." : `${errs} downloads failed. View queue for details.`,
      });
    }

    completedBatch.current = [];
    errorBatch.current = [];
  };

  const loadHistory = async () => {
    try {
      const recs: DownloadRecord[] = await invoke("get_history");
      setHistory(recs);
    } catch (e) {
      console.error("Failed to load history", e);
    }
  };

  // Single-Instance Native Messaging Relay Listener
  useEffect(() => {
    const unlisten = listen<string>("open-url", (event) => {
      if (event.payload) {
        setUrl(event.payload);
        setActiveTab("downloads");
        analyzeUrl(event.payload);
      }
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  useEffect(() => {
    loadHistory();

    const unlisten = listen<any>("download-progress", (event) => {
      const p = event.payload;

      setHistory(prev => {
        const idx = prev.findIndex(r => r.id === p.task_id);
        const oldStatus = idx !== -1 ? prev[idx].status : null;

        if (p.status === "completed" && oldStatus !== "completed") {
          completedBatch.current.push(p.task_id);
          clearTimeout(notificationTimer.current);
          notificationTimer.current = setTimeout(flushNotifications, 1800);
        } else if (p.status === "error" && oldStatus !== "error") {
          errorBatch.current.push(p.task_id);
          clearTimeout(notificationTimer.current);
          notificationTimer.current = setTimeout(flushNotifications, 1800);
        }

        if (idx === -1) {
          loadHistory();
          return prev;
        }

        const newHistory = [...prev];
        newHistory[idx] = {
          ...newHistory[idx],
          status: p.status,
          percent: p.percent,
          speed: p.speed,
          eta: p.eta,
          file_path: p.file_path || newHistory[idx].file_path,
          error_code: p.error_code || newHistory[idx].error_code,
          error_message: p.error || newHistory[idx].error_message,
        };
        return newHistory;
      });
    });

    return () => {
      unlisten.then(f => f());
    };
  }, []);



  // In-App Video Playback Trigger (Plays video on thumbnail click)
  const handlePlayVideo = async (targetVideo: { id: string; url: string; title: string; thumbnail: string; duration_string: string }) => {
    // Enforce mutual exclusivity: stop any active audio immediately
    unlockAudioContext();
    if (audioRef.current) audioRef.current.pause();
    setisAudioElementPlaying(false);
    setPreviewingId(null);
    setActiveAudioPlaying(null);
    setNowPlaying({ type: "video", id: targetVideo.id });

    // If selecting a video from playlist, promote to active main card
    if (!videoInfo || videoInfo.id !== targetVideo.id) {
      setSelectedFormat(null);
      setVideoInfo({
        id: targetVideo.id,
        title: targetVideo.title,
        url: targetVideo.url,
        thumbnail: targetVideo.thumbnail,
        duration: null,
        duration_string: targetVideo.duration_string,
        uploader: "",
        video_formats: [],
        audio_formats: [],
        formats: [],
      });
      // Fetch full formats in background
      invoke<VideoInfo>("fetch_video_info", { url: targetVideo.url, cookiesFromBrowser: settings.cookiesFromBrowser }).then(info => setVideoInfo(info))
        .catch(err => console.error(err));
    }

    // Smooth scroll to top of workspace
    mainScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });

    setActiveVideoPlaying(true);
    setIsVideoLoading(true);

    // If stream URL is already cached, start immediate playback
    if (videoStreamCache.current.has(targetVideo.id)) {
      setVideoStreamUrl(videoStreamCache.current.get(targetVideo.id)!);
      setIsVideoLoading(false);
      return;
    }

    try {
      const streamUrl = await invoke<string>("get_video_stream_url", { url: targetVideo.url, cookiesFromBrowser: settings.cookiesFromBrowser }); videoStreamCache.current.set(targetVideo.id, streamUrl);
      setVideoStreamUrl(streamUrl);
    } catch (err) {
      console.error("Video stream extraction fallback:", err);
      setVideoStreamUrl(null);
    } finally {
      setIsVideoLoading(false);
    }
  };

  const toggleFullscreen = () => {
    if (!videoContainerRef.current) return;
    if (!document.fullscreenElement) {
      videoContainerRef.current.requestFullscreen().catch(() => { });
    } else {
      document.exitFullscreen().catch(() => { });
    }
  };

  // Audio preview playback handlers with instantaneous cache & seeking
  const toggleAudioPreview = async (targetUrl: string, songId: string) => {
    unlockAudioContext();
    if (!audioRef.current) return;
    // Clear queue — previews are one-shot, they shouldn't auto-advance
    setAudioQueue([]);
    setAudioQueuePos(0);
    // FIX: yt-dlp defaults to extracting the whole playlist if the URL contains playlist parameters
    // Strip them so we strictly preview the individual song
    let cleanUrl = targetUrl;
    try {
      const parsed = new URL(targetUrl);
      parsed.searchParams.delete('list');
      parsed.searchParams.delete('index');
      cleanUrl = parsed.toString();
    } catch (e) { }

    // 1. Pause Video Element & Iframe (but keep it mounted so position is preserved)
    if (videoElementRef.current) videoElementRef.current.pause();
    sendIframeCommand("pauseVideo");
    // Do NOT call setActiveVideoPlaying(false) — that unmounts the video element and loses position.

    if (previewingId === songId) {
      if (isAudioElementPlaying) {
        audioRef.current.pause();
        setisAudioElementPlaying(false);
        setNowPlaying({ type: "none", id: null });
      } else {
        audioRef.current.play().then(() => {
          setisAudioElementPlaying(true);
          setNowPlaying({ type: "audio", id: songId });
        }).catch(() => { });
      }
      return;
    }

    audioRef.current.pause();
    setActiveAudioPlaying(null); // Fix: Clear Audio Hub state
    setPreviewingId(songId);
    setisAudioElementPlaying(false);
    setPreviewTime(0);
    setNowPlaying({ type: "audio", id: songId });

    // Apply persisted volume
    audioRef.current.volume = isMuted ? 0 : volume;

    // Instant Playback from cache if already resolved
    if (audioStreamCache.current.has(songId)) {
      const cachedUrl = audioStreamCache.current.get(songId)!;
      audioRef.current.src = cachedUrl;
      audioRef.current.play()
        .then(() => {
          setisAudioElementPlaying(true);
          setIsLoadingAudioId(null);
        })
        .catch((err) => {
          console.error("Playback error:", err);
          setIsLoadingAudioId(null);
        });
      return;
    }

    setIsLoadingAudioId(songId);

    try {
      const bytes: number[] = await invoke("fetch_audio_bytes", { url: cleanUrl, cookiesFromBrowser: settings.cookiesFromBrowser });
      // Guard: if backend returned a tiny payload, it's almost certainly an HTTP
      // error page (403, 404, etc.) wrapped as bytes, not real audio.
      if (!bytes || bytes.length < 4096) {
        throw new Error(
          `Audio fetch returned ${bytes?.length ?? 0} bytes — likely an HTTP error, not real audio.`
        );
      }
      const blob = new Blob([new Uint8Array(bytes)], { type: "audio/webm" }); const blobUrl = URL.createObjectURL(blob);
      audioStreamCache.current.set(songId, blobUrl);
      if (audioRef.current) {
        audioRef.current.src = blobUrl;
        audioRef.current.load();
        await audioRef.current.play();
        setisAudioElementPlaying(true);
      }
    } catch (err) {
      console.error("Audio stream error:", err);
      setPreviewingId(null);
      setNowPlaying({ type: "none", id: null });
    } finally {
      setIsLoadingAudioId(null);
    }
  };

  const handleAudioTimeUpdate = () => {
    if (audioRef.current) {
      setPreviewTime(audioRef.current.currentTime);
      setPreviewDuration(audioRef.current.duration || 0);
    }
  };

  const handleAudioEnded = () => {
    setisAudioElementPlaying(false);
    setPreviewTime(0);

    // Preview (no queue) — just stop
    if (audioQueue.length === 0) {
      setNowPlaying({ type: "none", id: null });
      setActiveAudioPlaying(null);
      return;
    }

    // Repeat one — replay current track
    if (audioRepeat === "one" && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current
        .play()
        .then(() => setisAudioElementPlaying(true))
        .catch(() => { });
      return;
    }

    // Advance to next track
    const nextPos = audioQueuePos + 1;
    if (nextPos < audioQueue.length) {
      setAudioQueuePos(nextPos);
      playAudioItemNow(audioQueue[nextPos]);
      return;
    }

    // End of queue — wrap or stop
    if (audioRepeat === "all" && audioQueue.length > 0) {
      setAudioQueuePos(0);
      playAudioItemNow(audioQueue[0]);
      return;
    }

    setNowPlaying({ type: "none", id: null });
    setActiveAudioPlaying(null);
  };

  const handleSeek = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      setPreviewTime(seconds);
    }
  };

  function handleSeekRelative(delta: number) {
    if (audioRef.current) {
      const total = audioRef.current.duration || 0;
      const nextTime = Math.max(0, Math.min(total, audioRef.current.currentTime + delta));
      audioRef.current.currentTime = nextTime;
      setPreviewTime(nextTime);
    }
  }

  const formatSeconds = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // Adjust trim input via Arrow keys / Mouse Wheel (Step 5)
  const adjustTrimTimestamp = (currentVal: string, setter: (v: string) => void, delta: number) => {
    const totalMax = videoInfo?.duration ? videoInfo.duration : 86400;
    const currentSecs = parseTimeToSeconds(currentVal);
    const nextSecs = Math.max(0, Math.min(totalMax, currentSecs + delta));
    setter(formatSecondsToTime(nextSecs, totalMax >= 3600));
  };

  // URL Analysis Logic - Robust for single videos, YouTube mixes, playlists, and keyword search
  async function analyzeUrl(rawInput: string) {
    const clean = rawInput.trim();
    if (!clean) return;

    // Stop any playing audio or video before analyzing a new URL
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
    }
    if (videoElementRef.current) videoElementRef.current.pause();
    sendIframeCommand("pauseVideo");
    setisAudioElementPlaying(false);
    setPreviewingId(null);
    setActiveAudioPlaying(null);
    setAudioQueue([]);
    setAudioQueuePos(0);
    setNowPlaying({ type: "none", id: null });

    // Check if input is a direct URL or a keyword search for YouTube
    const isUrl = /^https?:\/\//i.test(clean) ||
      clean.startsWith("www.") ||
      clean.includes("youtube.com/") ||
      clean.includes("youtu.be/") ||
      clean.includes("soundcloud.com/") ||
      clean.includes("vimeo.com/");

    if (!isUrl) {
      // Direct YouTube Search via ytsearch5:
      setFetchError("");
      setSelectedFormat(null);
      setVideoInfo(null);
      setPlaylistInfo(null);
      setSearchResults(null);
      setIsSearchingYoutube(true);
      setIsFetching(true);
      try {
        const results = await invoke<PlaylistEntry[]>("search_youtube", { query: clean, cookiesFromBrowser: settings.cookiesFromBrowser }); setSearchResults(results);
        if (!results || results.length === 0) {
          setFetchError(`No YouTube results found for "${clean}".`);
        }
      } catch (err: any) {
        setFetchError(`YouTube search error: ${err.toString()}`);
      } finally {
        setIsSearchingYoutube(false);
        setIsFetching(false);
      }
      return;
    }

    setSearchResults(null);
    setFetchError("");
    setSelectedFormat(null);
    setVideoInfo(null);
    setPlaylistInfo(null);
    setSelectedPlaylistItems(new Set());
    setActiveVideoPlaying(false);
    setVideoStreamUrl(null);
    setActiveCardTaskId(null);
    setIsFetching(true);

    const listMatch = clean.match(/[?&]list=([^&]+)/);
    const listId = listMatch ? listMatch[1] : null;

    const videoMatch = clean.match(/(?:v=|youtu\.be\/|shorts\/)([\w-]{11})/);
    const videoId = videoMatch ? videoMatch[1] : null;

    // Optimistic Instant UI for YouTube
    if (videoId) {
      setVideoInfo({
        id: videoId,
        title: "Resolving video information...",
        url: `https://www.youtube.com/watch?v=${videoId}`,
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        duration: null,
        duration_string: "--:--",
        uploader: "Connecting to server...",
        video_formats: [],
        audio_formats: [],
        formats: [],
      });
    }

    try {
      if (listId) {
        setIsLoadingPlaylist(true);
        // If it's already a watch URL or a mix (RD...), pass clean; otherwise pass canonical playlist URL
        const plUrl = clean.includes("watch?") || listId.startsWith("RD")
          ? clean
          : `https://www.youtube.com/playlist?list=${listId}`;

        const plPromise = invoke<PlaylistInfo>("fetch_playlist_info", { url: plUrl, cookiesFromBrowser: settings.cookiesFromBrowser })
          .then((plInfo) => {
            setPlaylistInfo(plInfo);
            setShowPlaylistSection(true);
            // Default select only the active song, not the whole playlist
            if (videoId) {
              setSelectedPlaylistItems(new Set([videoId]));
            } else if (plInfo.entries.length > 0) {
              setSelectedPlaylistItems(new Set([plInfo.entries[0].id]));
            }
          })
          .catch((plErr) => {
            console.error("Playlist error:", plErr);
          })
          .finally(() => {
            setIsLoadingPlaylist(false);
          });

        if (videoId) {
          const videoClean = `https://www.youtube.com/watch?v=${videoId}`;
          const info = await invoke<VideoInfo>("fetch_video_info", { url: videoClean, cookiesFromBrowser: settings.cookiesFromBrowser }); setVideoInfo(info);
          if (info.duration_string && info.duration_string !== "--:--") {
            setTrimEnd(info.duration_string);
          }
          if (settings.autoplay) {
            handlePlayVideo(info);
          }
        }
        await plPromise;
      } else if (videoId) {
        const info = await invoke<VideoInfo>("fetch_video_info", { url: clean, cookiesFromBrowser: settings.cookiesFromBrowser });
        setVideoInfo(info);
        if (info.duration_string && info.duration_string !== "--:--") {
          setTrimEnd(info.duration_string);
        }
        if (settings.autoplay) {
          handlePlayVideo(info);
        }
      } else {
        const info = await invoke<VideoInfo>("fetch_video_info", { url: clean, cookiesFromBrowser: settings.cookiesFromBrowser }); setVideoInfo(info);
        if (info.duration_string && info.duration_string !== "--:--") {
          setTrimEnd(info.duration_string);
        }
        if (settings.autoplay) {
          handlePlayVideo(info);
        }
      }
    } catch (err: any) {
      setFetchError(err.toString());
    } finally {
      setIsFetching(false);
    }
  }

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    await analyzeUrl(url);
  };

  const handleImportTxtLines = async (lines: string[]) => {
    const maxConcurrency = settings.maxParallel || 3;
    let currentIndex = 0;

    const processQueue = async () => {
      while (currentIndex < lines.length) {
        const currentHistory = await invoke<DownloadRecord[]>("get_history");
        const active = currentHistory.filter(
          (h) =>
            h.status === "downloading" ||
            h.status === "muxing" ||
            h.status === "starting" ||
            h.status === "fetching_metadata"
        ).length;

        if (active >= maxConcurrency) {
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }

        const line = lines[currentIndex++];
        if (!line) break;

        try {
          const info = await invoke<VideoInfo>("fetch_video_info", { url: line, cookiesFromBrowser: settings.cookiesFromBrowser });
          const presetLabel =
            batchPreset === "1080p"
              ? "1080p Video"
              : batchPreset === "720p"
                ? "720p Video"
                : batchPreset === "480p"
                  ? "480p Video"
                  : batchPreset === "mp3"
                    ? "MP3 Audio"
                    : "M4A Audio";
          handleStartDownload(
            batchFormatId,
            batchExt,
            batchIsAudio,
            info,
            `TXT Import (${presetLabel})`,
            "keep_both"
          );
        } catch (err) {
          console.error("Failed to fetch info for", line, err);
        }
      }
    };

    for (let i = 0; i < maxConcurrency; i++) {
      processQueue();
    }
  };
  const handleStartDownload = async (
    formatId: string,
    ext: string,
    isAudio: boolean,
    specificInfo?: any,
    formatLabel?: string,
    duplicateAction?: "overwrite" | "keep_both"
  ) => {
    const info = specificInfo || videoInfo;
    if (!info) return;

    // 1. Define clip trimming status FIRST so displayFormat can use it
    const isClipTrimming = !specificInfo && isTrimming && trimStart && trimEnd;
    const downloadSectionsArg = isClipTrimming ? `*${trimStart}-${trimEnd}` : null;

    // 2. Compute display formats (Enhanced with Step 2's 1080p/720p fallbacks)
    const fallbackLabel = isAudio
      ? `Audio (${ext.toUpperCase()})`
      : formatId.includes("1080")
        ? "1080p Video"
        : formatId.includes("720")
          ? "720p Video"
          : `${ext.toUpperCase()} Video`;

    const baseDisplayFormat = formatLabel || fallbackLabel;
    const displayFormat = isClipTrimming
      ? `${baseDisplayFormat} [Clip ${trimStart}-${trimEnd}]`
      : baseDisplayFormat;

    // 3. Duplicate check logic
    if (!duplicateAction) {
      const isDup = history.some(
        (h) =>
          h.url === info.url &&
          h.status === "completed" &&
          h.format.toLowerCase().includes(ext.toLowerCase())
      );
      if (isDup) {
        setDuplicateDialog({ isOpen: true, formatId, ext, isAudio, specificInfo, formatLabel });
        return;
      }
    }

    // 4. Create task ID and new record
    const taskId = `${info.id}-${Date.now()}`;

    const newRecord: DownloadRecord = {
      id: taskId,
      url: info.url,
      title: info.title,
      file_path: null,
      status: "starting",
      percent: 0,
      format: displayFormat,
      date_added: Date.now() / 1000,
      hidden: false,
    };

    setHistory(prev => [newRecord, ...prev]);

    // Crucial Fix for Step 6: DO NOT WIPE videoInfo! Transition button to live status
    if (!specificInfo) {
      setActiveCardTaskId(taskId);
      setIsTrimming(false);
    }

    // Speed limit and proxy parameters
    const speedLimitArg = settings.speedLimit === "unlimited"
      ? null
      : settings.speedLimit === "custom"
        ? settings.customSpeedLimit
        : settings.speedLimit;

    const proxyArg = settings.proxyEnabled && settings.proxyHost
      ? `${settings.proxyProtocol}://${settings.proxyHost}:${settings.proxyPort}`
      : null;


    try {
      await invoke("start_download", {
        taskId: taskId,
        url: info.url,
        title: info.title,
        formatId: formatId,
        formatLabel: displayFormat,
        isAudioOnly: isAudio,
        ext: ext,
        baseDir: settings.saveFolder,
        videoDir: settings.videoFolder || null,
        audioDir: settings.audioFolder || null,
        docsDir: settings.documentsFolder || settings.generalFolder || null,
        compDir: settings.compressedFolder || null,
        progDir: settings.programsFolder || null,
        tempDir: settings.tempFolder || null,
        speedLimit: speedLimitArg,
        proxy: proxyArg,
        customFlags: settings.customFlags ? settings.customFlags : null,
        scanAntivirus: settings.scanAntivirus,
        downloadSections: downloadSectionsArg,
        cookiesFromBrowser: settings.cookiesFromBrowser,
        duplicateAction: duplicateAction || null,
      });
    } catch (e: any) {
      console.error("Start download failed:", e);
      // FIX: Force immediate state update even if the previous batch hasn't committed
      setHistory(prev => {
        const next = [...prev];
        const idx = next.findIndex(r => r.id === taskId);
        if (idx !== -1) {
          next[idx] = { ...next[idx], status: "error", error_code: "spawn_failed", error_message: e.toString() };
        } else {
          next.unshift({ ...newRecord, status: "error", error_code: "spawn_failed", error_message: e.toString() });
        }
        return next;
      });
      setActiveCardTaskId(null); // Clear spinner from main card
    }
  };

  const handleRetryDownload = async (record: DownloadRecord) => {
    const isAudio = isAudioFormat(record.format);
    const extMatch = record.format.match(/\(([A-Z0-9]+)\)/i);
    const ext = extMatch ? extMatch[1].toLowerCase() : (isAudio ? "mp3" : "mp4");
    const formatId = isAudio ? "bestaudio/best" : (record.format.includes("[") ? record.format : "bestvideo+bestaudio/best");

    setHistory(prev => prev.map(r => r.id === record.id ? {
      ...r,
      status: "starting",
      percent: 0,
      speed: "0 B/s",
      eta: "--",
      error_code: undefined,
      error_message: undefined,
    } : r));

    setActiveCardTaskId(record.id);

    const speedLimitArg = settings.speedLimit === "unlimited"
      ? null
      : settings.speedLimit === "custom"
        ? settings.customSpeedLimit
        : settings.speedLimit;

    const proxyArg = settings.proxyEnabled && settings.proxyHost
      ? `${settings.proxyProtocol}://${settings.proxyHost}:${settings.proxyPort}`
      : null;

    try {
      await invoke("start_download", {
        taskId: record.id,
        url: record.url,
        title: record.title,
        formatId: formatId,
        formatLabel: record.format,
        isAudioOnly: isAudio,
        ext: ext,
        baseDir: settings.saveFolder,
        videoDir: settings.videoFolder,
        audioDir: settings.audioFolder,
        docsDir: settings.generalFolder,
        compDir: settings.compressedFolder,
        progDir: settings.programsFolder,
        tempDir: settings.tempFolder,
        speedLimit: speedLimitArg,
        proxy: proxyArg,
        customFlags: settings.customFlags ? settings.customFlags : null,
        scanAntivirus: settings.scanAntivirus,
        downloadSections: null,
        duplicateAction: "overwrite",
      });
    } catch (e: any) {
      console.error("Retry download failed:", e);
    }
  };

  const handleBatchDownload = async (formatId?: string, ext?: string, isAudio?: boolean) => {
    if (!playlistInfo) return;
    const entries = playlistInfo.entries.filter((e) => selectedPlaylistItems.has(e.id));
    if (entries.length === 0) return;

    const useFmtId = formatId || batchFormatId;
    const useExt = ext || batchExt;
    const useIsAudio = isAudio !== undefined ? isAudio : batchIsAudio;

    // Build human-readable format label
    const resolvedLabel = useIsAudio
      ? `Audio (${useExt.toUpperCase()})`
      : useFmtId.includes("1080")
        ? `1080p Video`
        : useFmtId.includes("720")
          ? `720p Video`
          : useFmtId.includes("4k") || useFmtId.includes("2160")
            ? `4K Video`
            : `${useExt.toUpperCase()} Video`;

    const taskIds = entries.map((e) => e.id);
    setActivePlaylistBatch({
      title: playlistInfo.title,
      taskIds,
      formatLabel: resolvedLabel,
    });

    for (const entry of entries) {
      await handleStartDownload(useFmtId, useExt, useIsAudio, entry, resolvedLabel);
    }
  };

  const handleRemoveHistory = async (id: string) => {
    await invoke("hide_history_item", { id });
    loadHistory();
  };

  const handleDeleteFile = async (id: string, filePath: string | null) => {
    if (!filePath) return;
    setConfirmDialogState({
      isOpen: true,
      title: "Delete File",
      message: "Are you sure you want to delete this file from your disk?",
      confirmText: "Delete from Disk",
      confirmVariant: "danger",
      onConfirm: async () => {
        await invoke("delete_history_file", { id, filePath });
        loadHistory();
        setConfirmDialogState(null);
      }
    });
  };

  const togglePlaylistItem = (id: string) => {
    setSelectedPlaylistItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllPlaylist = () => {
    if (playlistInfo) {
      setSelectedPlaylistItems(new Set(playlistInfo.entries.map(e => e.id)));
    }
  };

  const deselectAllPlaylist = () => {
    setSelectedPlaylistItems(new Set());
  };

  // Status counters
  const activeCount = history.filter(h => h.status === "downloading" || h.status === "muxing" || h.status === "starting").length;
  const queuedCount = history.filter(h => h.status === "queued" || h.status === "fetching_metadata").length;
  const attentionCount = history.filter(h => h.status === "error" || h.status === "interrupted").length;
  const completedCount = history.filter(h => h.status === "completed").length;


  // Filtered & Sorted history with Real-Time Search & Attention Filter
  const filteredHistory = history.filter(item => {
    // 1. Keyword search across title, url, format
    if (activitySearchQuery.trim()) {
      const q = activitySearchQuery.toLowerCase().trim();
      const matchTitle = item.title?.toLowerCase().includes(q);
      const matchUrl = item.url?.toLowerCase().includes(q);
      const matchFormat = item.format?.toLowerCase().includes(q);
      if (!matchTitle && !matchUrl && !matchFormat) return false;
    }

    // 2. Queue filter category
    if (queueFilter === "all") return true;
    if (queueFilter === "video") return isVideoFormat(item.format);
    if (queueFilter === "audio") return isAudioFormat(item.format);
    if (queueFilter === "active") return item.status === "downloading" || item.status === "muxing" || item.status === "starting";
    if (queueFilter === "queued") return item.status === "queued" || item.status === "fetching_metadata"; if (queueFilter === "completed") return item.status === "completed";
    if (queueFilter === "attention") return item.status === "error" || item.status === "interrupted" || item.status === "missing";
    return true;
  });

  const sortedHistory = [...filteredHistory].sort((a, b) => {
    if (sortBy === "date_desc") return b.date_added - a.date_added;
    if (sortBy === "date_asc") return a.date_added - b.date_added;
    if (sortBy === "size_desc") return (b.file_size || 0) - (a.file_size || 0);
    if (sortBy === "size_asc") return (a.file_size || 0) - (b.file_size || 0);
    if (sortBy === "title") return a.title.localeCompare(b.title);
    if (sortBy === "progress") return b.percent - a.percent;
    return 0;
  });

  const activeCardTask = activeCardTaskId ? history.find(h => h.id === activeCardTaskId) : null;

  // StatCard mini-lists (top 2 items per state)
  const cardItems = {
    active: history.filter(
      h => h.status === "downloading" || h.status === "muxing" || h.status === "starting"
    ),
    queued: history.filter(
      h => h.status === "queued" || h.status === "fetching_metadata"
    ),
    attention: history.filter(
      h => h.status === "error" || h.status === "interrupted"
    ),
    completed: history.filter(h => h.status === "completed"),
  };
  if (isHud) {
    return <ClipboardHud settings={settings} />;
  }

  return (
    <AppShell
      mainRef={mainScrollRef}
      sidebar={(collapsed) => (
        <Sidebar
          collapsed={collapsed}
          activeTab={activeTab}
          setActiveTab={(tab) => {
            if (tab === "downloads") {
              setQueueFilter("all");
              setShowPreviews(true);
              setActivitySearchQuery("");
            }
            setActiveTab(tab);
          }}
          activeCount={activeCount}
          queuedCount={queuedCount}
          nowPlaying={nowPlaying}
          isAudioElementPlaying={isAudioElementPlaying}
          activeVideoPlaying={activeVideoPlaying}
          audioRef={audioRef}
          videoElementRef={videoElementRef}
          theme={theme}
          handleThemeChange={handleThemeChange}
        />
      )}
    >
      {/* Hidden Audio Player for In-line Previews */}
      <audio
        ref={audioRef}
        preload="auto"
        onPlay={() => setisAudioElementPlaying(true)}
        onPause={() => setisAudioElementPlaying(false)}
        onTimeUpdate={handleAudioTimeUpdate}
        onEnded={handleAudioEnded}
        onError={(e) => {
          console.error("Audio playback error on preview stream:", e);
          setIsLoadingAudioId(null);
          setisAudioElementPlaying(false);
          setPreviewingId(null);
          setActiveAudioPlaying(null);
          setNowPlaying({ type: "none", id: null });
        }}
        className="hidden"
      />

      <ErrorBoundary fallbackTitle="An error occurred in this workspace view">

        {/* ===================== TAB 1: DOWNLOADS ===================== */}
        {activeTab === "downloads" && (
          <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-150">

            {/* StatTiles — 5 Purposeful Gradient Highlight Tiles (Clickable to Filter) */}


            {/* URL Input Form */}
            <UrlInput
              url={url}
              setUrl={setUrl}
              isFetching={isFetching}
              isSearchingYoutube={isSearchingYoutube}
              onAnalyze={handleAnalyze}
              onClear={resetInput}
              onImportTxtLines={handleImportTxtLines}
              placeholder={t("input_placeholder")}
              labelAnalyze={t("btn_analyze")}
              labelAnalyzing={t("analyzing")}
            />
            {/* StatCards — 4 state tiles (click to filter) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                variant="active"
                count={activeCount}
                items={cardItems.active}
                active={queueFilter === "active"}
                onClick={() => {
                  const next = queueFilter === "active" ? "all" : "active";
                  setQueueFilter(next);
                  setShowPreviews(next === "all");
                }}
              />
              <StatCard
                variant="queued"
                count={queuedCount}
                items={cardItems.queued}
                active={queueFilter === "queued"}
                onClick={() => {
                  const next = queueFilter === "queued" ? "all" : "queued";
                  setQueueFilter(next);
                  setShowPreviews(next === "all");
                }}
              />
              <StatCard
                variant="attention"
                count={attentionCount}
                items={cardItems.attention}
                active={queueFilter === "attention"}
                onClick={() => {
                  const next = queueFilter === "attention" ? "all" : "attention";
                  setQueueFilter(next);
                  setShowPreviews(next === "all");
                }}
              />
              <StatCard
                variant="completed"
                count={completedCount}
                items={cardItems.completed}
                active={queueFilter === "completed"}
                onClick={() => {
                  const next = queueFilter === "completed" ? "all" : "completed";
                  setQueueFilter(next);
                  setShowPreviews(next === "all");
                }}
              />
            </div>
            {/* Mini player bar — only shows while audio is playing anywhere in the app */}
            {activeAudioPlaying && (
              <MiniPlayerBar
                track={activeAudioPlaying}
                isPlaying={isAudioElementPlaying}
                onPlayPause={toggleAudioPlayPause}
                onOpenAudioHub={() => setActiveTab("audio")}
                audioRef={audioRef}
              />
            )}
            {fetchError && (
              <div className="bg-status-danger-subtle p-3.5 rounded-md flex items-start gap-2.5 text-status-danger animate-in fade-in duration-fast">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <div className="text-body-sm font-medium">
                  <span className="font-semibold">{t("analysis_failed")}: </span>{fetchError}
                </div>
              </div>
            )}

            {/* YouTube Keyword Search Results Grid */}
            {searchResults && (
              <SearchResults
                results={searchResults}
                onClose={() => setSearchResults(null)}
                onInspect={(u) => {
                  setUrl(u);
                  analyzeUrl(u);
                }}
                onPlay={(entry) => handlePlayVideo(entry)}
              />
            )}

            {/* Single Video Card Preview with Integrated In-App Player */}
            {videoInfo && showPreviews && (
              <VideoCard
                videoInfo={videoInfo}
                settings={settings}
                selectedFormat={selectedFormat}
                setSelectedFormat={setSelectedFormat}
                activeCardTask={activeCardTask}
                onDismissProgress={() => setActiveCardTaskId(null)}
                t={t}
                vm={{
                  activeVideoPlaying,
                  isVideoLoading,
                  videoStreamUrl,
                  videoFullscreen,
                  videoContainerRef,
                  videoElementRef,
                  iframeRef,
                  previewingId,
                  isAudioElementPlaying,
                  isLoadingAudioId,
                  previewTime,
                  previewDuration,
                  audioRef,
                  volume,
                  isMuted,
                  isTrimming,
                  setIsTrimming,
                  trimStart,
                  setTrimStart,
                  trimEnd,
                  setTrimEnd,
                  handlePlayVideo,
                  toggleFullscreen,
                  handleCloseVideoPlayer,
                  exitFullscreenAndKeepPlaying,
                  sendIframeCommand,
                  toggleAudioPreview,
                  handleSeek,
                  handleSeekRelative,
                  toggleMute,
                  handleVolumeChange,
                  adjustTrimTimestamp,
                  handleStartDownload,
                  handleRetryDownload,
                  openFile,
                  formatSeconds,
                  setisAudioElementPlaying,
                  setPreviewingId,
                  setNowPlaying,
                  setActiveVideoPlaying,
                  nowPlaying,
                }}
              />
            )}

            {/* Playlist Banner & Items Drawer */}
            {(playlistInfo || isLoadingPlaylist) && showPreviews && (
              <PlaylistPanel
                t={t}
                playlistInfo={playlistInfo}
                isLoadingPlaylist={isLoadingPlaylist}
                showSection={showPlaylistSection}
                setShowSection={setShowPlaylistSection}
                selectedIds={selectedPlaylistItems}
                toggleItem={togglePlaylistItem}
                selectAll={selectAllPlaylist}
                deselectAll={deselectAllPlaylist}
                batchPreset={batchPreset}
                setBatchPreset={setBatchPreset}
                setBatchFormatId={setBatchFormatId}
                setBatchExt={setBatchExt}
                setBatchIsAudio={setBatchIsAudio}
                onBatchDownload={() => handleBatchDownload()}
                onSingleDownload={(entry, presetLabel) =>
                  handleStartDownload(batchFormatId, batchExt, batchIsAudio, entry, presetLabel)
                }
                onPlayVideo={handlePlayVideo}
                onPreviewAudio={toggleAudioPreview}
                previewingId={previewingId}
                isAudioElementPlaying={isAudioElementPlaying}
                isLoadingAudioId={isLoadingAudioId}
                previewTime={previewTime}
                previewDuration={previewDuration}
                onSeek={handleSeek}
                onSeekRelative={handleSeekRelative}
                onClosePreview={() => {
                  if (audioRef.current) audioRef.current.pause();
                  setisAudioElementPlaying(false);
                  setPreviewingId(null);
                  setNowPlaying({ type: "none", id: null });
                }}
                history={history}
                audioRef={audioRef}
              />
            )}

            {/* BatchProgressView for Playlist Bulk Downloads */}
            {activePlaylistBatch && (
              <BatchProgress
                title={activePlaylistBatch.title}
                taskIds={activePlaylistBatch.taskIds}
                formatLabel={activePlaylistBatch.formatLabel}
                history={history}
                onClear={() => setActivePlaylistBatch(null)}
              />
            )}

            {/* Downloads Activity List with Categorization Tabs, Real-Time Search & Sorting */}
            <ActivityList
              t={t}
              sortedHistory={sortedHistory}
              activitySearchQuery={activitySearchQuery}
              setActivitySearchQuery={setActivitySearchQuery}
              queueFilter={queueFilter}
              setQueueFilter={setQueueFilter}
              sortBy={sortBy}
              setSortBy={setSortBy}
              selectedHistoryItems={selectedHistoryItems}
              setSelectedHistoryItems={setSelectedHistoryItems}
              onOpenFolder={openFolder}
              onOpenFile={openFile}
              onRemove={handleRemoveHistory}
              onDeleteFile={handleDeleteFile}
              onRetry={handleRetryDownload}
            />

          </div>
        )}

        {/* ===================== TAB 2: AUDIO HUB ===================== */}
        {activeTab === "audio" && (
          <AudioHubTab
            t={t}
            history={history}
            isAudioFormat={isAudioFormat}
            handleStartDownload={handleStartDownload}
            openFolder={openFolder}
            openFile={openFile}
            handleDeleteFile={handleDeleteFile}
            audioRef={audioRef}
            activeAudioPlaying={activeAudioPlaying}
            isAudioElementPlaying={isAudioElementPlaying}
            onPlayItem={playAudioFromLibrary}
            onPlayPause={toggleAudioPlayPause}
            onNext={audioNext}
            onPrev={audioPrev}
            onSeek={handleSeek}
            previewTime={previewTime}
            previewDuration={previewDuration}
            audioShuffle={audioShuffle}
            audioRepeat={audioRepeat}
            onToggleShuffle={toggleAudioShuffle}
            onCycleRepeat={cycleAudioRepeat}
            formatSeconds={formatSeconds}
          />
        )}

        {/* ===================== TAB 3: COMPLETE SETTINGS ===================== */}
        {activeTab === "settings" && (
          <SettingsTab
            t={t}
            settings={settings}
            updateSetting={updateSetting}
            theme={theme}
            handleThemeChange={handleThemeChange}
            audioDevices={audioDevices}
            selectedAudioDevice={selectedAudioDevice}
            handleDeviceChange={handleDeviceChange}
            volume={volume}
            isMuted={isMuted}
            handleVolumeChange={handleVolumeChange}
            toggleMute={toggleMute}
            handleToggleAutostart={handleToggleAutostart}
            handleBrowseFolder={handleBrowseFolder}
            openFolder={openFolder}
          />
        )}

      </ErrorBoundary>

      {duplicateDialog && (
        <DuplicateDialog
          state={duplicateDialog}
          onOverwrite={() => {
            handleStartDownload(
              duplicateDialog.formatId,
              duplicateDialog.ext,
              duplicateDialog.isAudio,
              duplicateDialog.specificInfo,
              duplicateDialog.formatLabel,
              "overwrite"
            );
            setDuplicateDialog(null);
          }}
          onKeepBoth={() => {
            handleStartDownload(
              duplicateDialog.formatId,
              duplicateDialog.ext,
              duplicateDialog.isAudio,
              duplicateDialog.specificInfo,
              duplicateDialog.formatLabel,
              "keep_both"
            );
            setDuplicateDialog(null);
          }}
          onCancel={() => setDuplicateDialog(null)}
        />
      )}

      {confirmDialogState && (
        <ConfirmDialog
          isOpen={confirmDialogState.isOpen}
          title={confirmDialogState.title}
          message={confirmDialogState.message}
          confirmText={confirmDialogState.confirmText}
          confirmVariant={confirmDialogState.confirmVariant}
          onConfirm={confirmDialogState.onConfirm}
          onCancel={() => setConfirmDialogState(null)}
        />
      )}
    </AppShell>
  );
}


