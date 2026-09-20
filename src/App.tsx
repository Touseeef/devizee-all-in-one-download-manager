import React, { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { WebviewWindow, getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { 
  Download, Music, Settings, Search, X, Folder, MoreVertical, 
  Trash2, AlertCircle, PlayCircle, Loader2, Play, Pause, Volume2,
  ListPlus, CheckCircle2, Clock, CheckSquare, Square
} from "lucide-react";
import { TaskStatus, STATUS_DISPLAY } from "./status";

type FormatOption = {
  format_id: string;
  label: string;
  ext: string;
  is_audio_only: boolean;
  resolution: string | null;
  filesize_approx: number | null;
};

type VideoInfo = {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  duration_string: string;
  uploader: string;
  formats: FormatOption[];
};

type PlaylistEntry = {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  duration_string: string;
};

type PlaylistInfo = {
  id: string;
  title: string;
  uploader: string;
  entries: PlaylistEntry[];
};

type DownloadRecord = {
  id: string;
  url: string;
  title: string;
  file_path: string | null;
  status: TaskStatus;
  percent: number;
  format: string;
  date_added: number;
  hidden: boolean;
};

export default function App() {
  const isHud = window.location.search.includes("hud=true");
  
  // Navigation & Tabs
  const [activeTab, setActiveTab] = useState("downloads");
  const [url, setUrl] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  
  // Playlist states
  const [playlistInfo, setPlaylistInfo] = useState<PlaylistInfo | null>(null);
  const [showPlaylistSection, setShowPlaylistSection] = useState(false);
  const [selectedPlaylistItems, setSelectedPlaylistItems] = useState<Set<string>>(new Set());
  
  // Audio Preview state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isLoadingAudioId, setIsLoadingAudioId] = useState<string | null>(null);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [previewTime, setPreviewTime] = useState(0);

  // History & Notifications
  const [history, setHistory] = useState<DownloadRecord[]>([]);
  const completedBatch = useRef<string[]>([]);
  const errorBatch = useRef<string[]>([]);
  const notificationTimer = useRef<any>(null);

  // Clipboard Radar Logic
  const lastClipboard = useRef<string>("");
  const [hudData, setHudData] = useState<any>(null);

  useEffect(() => {
    if (isHud) {
      const unlisten = listen<any>("hud-data", (e) => {
        setHudData(e.payload);
      });
      return () => { unlisten.then(f => f()); };
    } else {
      const interval = setInterval(async () => {
        try {
          const text = await readText();
          if (text && text !== lastClipboard.current && (text.includes("youtube.com") || text.includes("youtu.be"))) {
            lastClipboard.current = text;
            const info: VideoInfo = await invoke("fetch_video_info", { url: text });
            let hudWin = await WebviewWindow.getByLabel("hud");
            if (!hudWin) {
              hudWin = new WebviewWindow("hud", {
                url: "/?hud=true",
                width: 360,
                height: 128,
                transparent: true,
                decorations: false,
                alwaysOnTop: true,
                resizable: false,
                focus: false,
              });
            }
            hudWin.emit("hud-data", { info, url: text });
            hudWin.show();
            setTimeout(() => { hudWin?.hide(); }, 8000);
          }
        } catch {
          // Ignore clipboard read errors
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isHud]);

  const flushNotifications = async () => {
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
          notificationTimer.current = setTimeout(flushNotifications, 2000);
        } else if (p.status === "error" && oldStatus !== "error") {
          errorBatch.current.push(p.task_id);
          clearTimeout(notificationTimer.current);
          notificationTimer.current = setTimeout(flushNotifications, 2000);
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
          file_path: p.file_path || newHistory[idx].file_path,
        };
        return newHistory;
      });
    });

    return () => {
      unlisten.then(f => f());
    };
  }, []);

  // Audio preview playback handlers
  const toggleAudioPreview = async (targetUrl: string, songId: string) => {
    if (!audioRef.current) return;

    if (previewingId === songId) {
      if (isPlayingAudio) {
        audioRef.current.pause();
        setIsPlayingAudio(false);
      } else {
        audioRef.current.play();
        setIsPlayingAudio(true);
      }
      return;
    }

    // Stop current
    audioRef.current.pause();
    setPreviewingId(songId);
    setIsLoadingAudioId(songId);
    setIsPlayingAudio(false);
    setPreviewProgress(0);
    setPreviewTime(0);

    try {
      const streamUrl: string = await invoke("get_audio_stream_url", { url: targetUrl });
      if (audioRef.current) {
        audioRef.current.src = streamUrl;
        audioRef.current.play();
        setIsPlayingAudio(true);
      }
    } catch (err) {
      console.error("Audio stream error:", err);
      setPreviewingId(null);
    } finally {
      setIsLoadingAudioId(null);
    }
  };

  const handleAudioTimeUpdate = () => {
    if (audioRef.current && audioRef.current.duration) {
      const current = audioRef.current.currentTime;
      const total = audioRef.current.duration;
      setPreviewTime(current);
      setPreviewProgress((current / total) * 100);
    }
  };

  const handleAudioEnded = () => {
    setIsPlayingAudio(false);
    setPreviewProgress(0);
    setPreviewTime(0);
  };

  const formatSeconds = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // URL Analysis Logic
  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = url.trim();
    if (!clean) return;

    setFetchError("");
    setVideoInfo(null);
    setPlaylistInfo(null);
    setShowPlaylistSection(false);
    setSelectedPlaylistItems(new Set());
    setIsFetching(true);

    const hasVideo = clean.includes("watch?v=") || clean.includes("youtu.be/") || clean.includes("shorts/");
    const hasList = clean.includes("list=");

    const videoMatch = clean.match(/(?:v=|youtu\.be\/|shorts\/)([\w-]{11})/);
    const videoId = videoMatch ? videoMatch[1] : null;

    // Instant Visual Feedback (Optimistic UI): show thumbnail immediately!
    if (videoId) {
      setVideoInfo({
        id: videoId,
        title: "Resolving video information...",
        url: clean,
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        duration_string: "--:--",
        uploader: "Connecting to server...",
        formats: [],
      });
    }

    try {
      if (hasVideo) {
        // Fetch target song first so its preview and format picker appear immediately
        const videoClean = clean.replace(/([?&])list=[^&]+/, "").replace(/([?&])index=\d+/, "");
        const info: VideoInfo = await invoke("fetch_video_info", { url: videoClean });
        setVideoInfo(info);

        // If it also contains a playlist, fetch playlist in the background
        if (hasList) {
          invoke("fetch_playlist_info", { url: clean })
            .then((plInfo: any) => {
              setPlaylistInfo(plInfo);
            })
            .catch(() => undefined);
        }
      } else if (hasList) {
        // Pure playlist link (e.g. youtube.com/playlist?list=...)
        const plInfo: PlaylistInfo = await invoke("fetch_playlist_info", { url: clean });
        setPlaylistInfo(plInfo);
        setShowPlaylistSection(true);
      } else {
        // Normal single link
        const info: VideoInfo = await invoke("fetch_video_info", { url: clean });
        setVideoInfo(info);
      }
    } catch (err: any) {
      setFetchError(err.toString());
    } finally {
      setIsFetching(false);
    }
  };

  const handleStartDownload = async (formatId: string, ext: string, isAudio: boolean, specificInfo?: any) => {
    const info = specificInfo || videoInfo;
    if (!info) return;
    
    const taskId = `${info.id}-${Date.now()}`;
    
    const newRecord: DownloadRecord = {
      id: taskId,
      url: info.url,
      title: info.title,
      file_path: null,
      status: "starting",
      percent: 0,
      format: formatId,
      date_added: Date.now() / 1000,
      hidden: false,
    };
    
    setHistory(prev => [newRecord, ...prev]);
    
    if (!specificInfo) {
      setVideoInfo(null);
      setUrl("");
    }

    try {
      await invoke("start_download", {
        taskId: taskId,
        url: info.url,
        title: info.title,
        formatId: formatId,
        isAudioOnly: isAudio,
        ext: ext,
      });
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleBatchDownload = async (formatId: string, ext: string, isAudio: boolean) => {
    if (!playlistInfo) return;
    const entries = playlistInfo.entries.filter((e) => selectedPlaylistItems.has(e.id));
    if (entries.length === 0) return;

    setPlaylistInfo(null);
    setShowPlaylistSection(false);
    setUrl("");
    
    for (const entry of entries) {
      await handleStartDownload(formatId, ext, isAudio, entry);
    }
  };

  const openFolder = async (path: string | null) => {
    if (!path) return;
    try {
      await invoke("open_folder", { path });
    } catch (e) {
      console.error("Failed to open folder", e);
    }
  };

  const handleRemoveHistory = async (id: string) => {
    await invoke("hide_history_item", { id });
    loadHistory();
  };

  const handleDeleteFile = async (id: string, filePath: string | null) => {
    if (!filePath) return;
    const confirm = window.confirm("Are you sure you want to permanently delete this file from your disk?");
    if (confirm) {
      await invoke("delete_history_file", { id, filePath });
      loadHistory();
    }
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

  // Status counters for StatTiles
  const activeCount = history.filter(h => h.status === "downloading" || h.status === "muxing" || h.status === "starting").length;
  const queuedCount = history.filter(h => h.status === "queued" || h.status === "fetching_metadata").length;
  const attentionCount = history.filter(h => h.status === "error" || h.status === "interrupted").length;
  const completedCount = history.filter(h => h.status === "completed").length;

  if (isHud) {
    return (
      <div className="w-full h-full bg-surface-1 rounded-lg p-3.5 shadow-floating flex flex-col justify-center overflow-hidden">
        {hudData?.info ? (
          <>
            <div className="flex gap-3 items-center">
              <img src={hudData.info.thumbnail} className="w-16 h-11 object-cover rounded-md shadow-sm shrink-0" />
              <div className="flex-1 min-w-0">
                <h4 className="text-body-sm font-semibold truncate text-primary">{hudData.info.title}</h4>
                <p className="text-caption text-secondary truncate">Copied link detected</p>
              </div>
            </div>
            <div className="flex gap-2 mt-2.5">
              <button 
                onClick={async () => { 
                  await invoke("start_download", { 
                    taskId: `${hudData.info.id}-${Date.now()}`,
                    url: hudData.url, 
                    title: hudData.info.title,
                    formatId: hudData.info.formats[0].format_id, 
                    ext: hudData.info.formats[0].ext, 
                    isAudioOnly: false 
                  });
                  const win = getCurrentWebviewWindow();
                  await win.hide(); 
                }} 
                className="flex-1 bg-accent text-white py-1.5 rounded-full text-caption font-semibold hover:bg-accent-hover transition-colors"
              >
                Download Best
              </button>
              <button 
                onClick={async () => { 
                  const win = getCurrentWebviewWindow();
                  await win.hide(); 
                }} 
                className="px-3 bg-surface-2 text-primary py-1.5 rounded-full text-caption font-semibold hover:bg-surface-0 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-secondary gap-2 font-medium text-body-sm">
            <Loader2 className="animate-spin" size={16} /> Inspecting clipboard...
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-surface-0 text-primary font-sans antialiased overflow-hidden p-6 gap-6">
      {/* Hidden Audio Player for In-line Previews */}
      <audio 
        ref={audioRef} 
        onTimeUpdate={handleAudioTimeUpdate} 
        onEnded={handleAudioEnded} 
        className="hidden" 
      />

      {/* Modern Clean Sidebar */}
      <aside className="w-60 rounded-lg flex flex-col pt-8 pb-6 bg-surface-1 shadow-raised shrink-0">
        <div className="px-6 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-accent flex items-center justify-center text-white">
              <Download size={18} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-heading-sm font-semibold tracking-tight text-primary">Devizee</h1>
              <p className="text-caption text-tertiary">Download Manager</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          <SidebarItem 
            icon={<Download size={17} />} 
            label="Downloads" 
            active={activeTab === "downloads"} 
            onClick={() => setActiveTab("downloads")} 
            badge={activeCount > 0 ? activeCount : undefined} 
          />
          <SidebarItem 
            icon={<Music size={17} />} 
            label="Audio Hub" 
            active={activeTab === "audio"} 
            onClick={() => setActiveTab("audio")} 
          />
          <div className="pt-6 pb-2 px-3 text-caption text-tertiary font-semibold uppercase tracking-wider">Preferences</div>
          <SidebarItem 
            icon={<Settings size={17} />} 
            label="Settings" 
            active={activeTab === "settings"} 
            onClick={() => setActiveTab("settings")} 
          />
        </nav>

        <div className="px-4 text-caption text-tertiary">
          v0.1.0 • Fast & Open
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden rounded-lg bg-surface-1 shadow-raised">
        
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-8 shrink-0 border-b border-subtle">
          <h2 className="text-heading font-semibold text-primary">
            {activeTab === "downloads" && "Downloads & Queue"}
            {activeTab === "audio" && "Audio Hub"}
            {activeTab === "settings" && "Settings"}
          </h2>
          <span className="text-body-sm text-secondary">
            {activeCount > 0 ? `${activeCount} downloading` : "Ready"}
          </span>
        </header>

        {/* Content Scroll */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
          
          {activeTab === "downloads" && (
            <div className="max-w-4xl mx-auto space-y-6">
              
              {/* StatTiles — 4 purposeful hero gradient cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatTile 
                  label="Active" 
                  count={activeCount} 
                  sub="Downloading now"
                  gradient="var(--gradient-tile-primary)" 
                  icon={<Download size={18} />} 
                />
                <StatTile 
                  label="Queued" 
                  count={queuedCount} 
                  sub="Waiting in line"
                  gradient="var(--gradient-tile-blue)" 
                  icon={<Clock size={18} />} 
                />
                <StatTile 
                  label="Attention" 
                  count={attentionCount} 
                  sub="Errors / stalled"
                  gradient="var(--gradient-tile-amber)" 
                  icon={<AlertCircle size={18} />} 
                />
                <StatTile 
                  label="Completed" 
                  count={completedCount} 
                  sub="Ready on disk"
                  gradient="var(--gradient-tile-violet)" 
                  icon={<CheckCircle2 size={18} />} 
                />
              </div>

              {/* URL Input Form */}
              <form onSubmit={handleAnalyze} className="relative">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-accent">
                  <Search size={20} strokeWidth={2.5} />
                </div>
                <input
                  type="text"
                  placeholder="Paste YouTube video or playlist link (https://...)"
                  className="w-full bg-surface-0 border border-subtle focus:border-accent rounded-md h-13 pl-12 pr-36 text-body font-medium transition-colors outline-none text-primary placeholder:text-tertiary"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={isFetching || !url.trim()}
                  className="absolute right-1.5 top-1.5 bottom-1.5 bg-accent hover:bg-accent-hover text-white px-5 rounded-md font-semibold text-body-sm transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isFetching ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} strokeWidth={2.5} />}
                  Analyze
                </button>
              </form>

              {fetchError && (
                <div className="bg-status-danger-subtle p-4 rounded-md flex items-start gap-3 text-status-danger">
                  <AlertCircle size={18} className="mt-0.5 shrink-0" />
                  <div className="text-body-sm font-medium">
                    <span className="font-semibold">Analysis Error: </span>{fetchError}
                  </div>
                </div>
              )}

              {/* Single Video Card Preview */}
              {videoInfo && (
                <div className="bg-surface-1 rounded-lg p-5 shadow-raised relative overflow-hidden">
                  <div className="flex flex-col md:flex-row gap-5">
                    <div className="w-full md:w-64 aspect-video rounded-md overflow-hidden bg-surface-0 shrink-0 relative shadow-sm">
                      <img src={videoInfo.thumbnail} alt="Thumbnail" className="w-full h-full object-cover" />
                      <div className="absolute bottom-2 right-2 bg-black/75 text-white font-mono text-caption px-1.5 py-0.5 rounded">
                        {videoInfo.duration_string}
                      </div>
                    </div>
                    
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-heading-sm font-semibold leading-snug line-clamp-2 text-primary">
                            {videoInfo.title}
                          </h3>
                          {/* In-line Audio Preview Play Button for Target Video */}
                          <button
                            type="button"
                            onClick={() => toggleAudioPreview(videoInfo.url, videoInfo.id)}
                            className="shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-2 hover:bg-surface-0 text-accent font-semibold text-caption transition-colors"
                            title="Preview audio before downloading"
                          >
                            {isLoadingAudioId === videoInfo.id ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : previewingId === videoInfo.id && isPlayingAudio ? (
                              <Pause size={13} fill="currentColor" />
                            ) : (
                              <Play size={13} fill="currentColor" />
                            )}
                            <span>{previewingId === videoInfo.id && isPlayingAudio ? "Pause" : "Listen Preview"}</span>
                          </button>
                        </div>
                        <p className="text-secondary text-body-sm mt-1">{videoInfo.uploader}</p>

                        {/* In-line Audio Progress Bar */}
                        {previewingId === videoInfo.id && (
                          <div className="mt-3 p-2 rounded-md bg-surface-0">
                            <div className="flex items-center justify-between text-caption text-secondary font-mono mb-1">
                              <span className="flex items-center gap-1"><Volume2 size={12} className="text-accent" /> Playing Audio Preview</span>
                              <span>{formatSeconds(previewTime)}</span>
                            </div>
                            <div className="h-1 bg-surface-2 rounded-full overflow-hidden">
                              <div className="h-full bg-accent transition-all duration-fast" style={{ width: `${previewProgress}%` }} />
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Format Tiers & Actions */}
                      <div className="mt-4 pt-3 border-t border-subtle flex flex-wrap items-center gap-2.5">
                        {videoInfo.formats.length === 0 ? (
                          <div className="flex items-center gap-2 text-body-sm text-secondary py-1">
                            <Loader2 size={14} className="animate-spin text-accent" />
                            <span>Resolving format tiers & qualities...</span>
                          </div>
                        ) : (
                          videoInfo.formats.map((f) => (
                            <button
                              key={f.format_id}
                              onClick={() => handleStartDownload(f.format_id, f.ext, f.is_audio_only)}
                              className={`px-3.5 py-1.5 rounded-full text-body-sm font-semibold transition-colors
                                ${f.format_id.includes("bestvideo+bestaudio") 
                                  ? "bg-accent text-white hover:bg-accent-hover" 
                                  : "bg-surface-2 text-primary hover:bg-surface-0"}
                              `}
                            >
                              {f.label}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Part of Playlist Banner / Expandable Checklist */}
              {playlistInfo && (
                <div className="bg-surface-1 rounded-lg shadow-raised overflow-hidden">
                  <div className="p-4 flex items-center justify-between border-b border-subtle">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-md bg-accent-subtle text-accent flex items-center justify-center shrink-0">
                        <ListPlus size={18} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-body text-primary">{playlistInfo.title}</h4>
                        <p className="text-caption text-secondary">{playlistInfo.entries.length} songs in playlist • {selectedPlaylistItems.size} selected</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setShowPlaylistSection(!showPlaylistSection)}
                        className="px-3.5 py-1.5 rounded-full bg-surface-2 hover:bg-surface-0 text-primary text-body-sm font-semibold transition-colors"
                      >
                        {showPlaylistSection ? "Collapse Playlist" : "Select Playlist Songs"}
                      </button>
                      {selectedPlaylistItems.size > 0 && (
                        <button
                          type="button"
                          onClick={() => handleBatchDownload("bestvideo+bestaudio/best", "mp4", false)}
                          className="px-4 py-1.5 rounded-full bg-accent hover:bg-accent-hover text-white text-body-sm font-semibold transition-colors shadow-sm"
                        >
                          Download Selected ({selectedPlaylistItems.size})
                        </button>
                      )}
                    </div>
                  </div>

                  {showPlaylistSection && (
                    <div className="p-4 space-y-3 bg-surface-0/50">
                      {/* Select All / Deselect All Controls */}
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-3 text-caption font-semibold">
                          <button 
                            type="button"
                            onClick={selectAllPlaylist} 
                            className="flex items-center gap-1 text-accent hover:underline"
                          >
                            <CheckSquare size={14} /> Select All
                          </button>
                          <span className="text-tertiary">•</span>
                          <button 
                            type="button"
                            onClick={deselectAllPlaylist} 
                            className="flex items-center gap-1 text-secondary hover:underline"
                          >
                            <Square size={14} /> Deselect All
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={selectedPlaylistItems.size === 0}
                            onClick={() => handleBatchDownload("bestaudio/best", "mp3", true)}
                            className="px-3 py-1 rounded-full bg-surface-2 text-primary hover:bg-surface-1 text-caption font-semibold disabled:opacity-40 transition-colors"
                          >
                            Download as Audio (MP3)
                          </button>
                          <button
                            type="button"
                            disabled={selectedPlaylistItems.size === 0}
                            onClick={() => handleBatchDownload("bestvideo+bestaudio/best", "mp4", false)}
                            className="px-3 py-1 rounded-full bg-accent text-white hover:bg-accent-hover text-caption font-semibold disabled:opacity-40 transition-colors"
                          >
                            Download as Video (MP4)
                          </button>
                        </div>
                      </div>

                      {/* Playlist Scroll Area */}
                      <div className="max-h-80 overflow-y-auto space-y-1.5 pr-2">
                        {playlistInfo.entries.map((entry, idx) => {
                          const isSelected = selectedPlaylistItems.has(entry.id);
                          const isThisPreviewing = previewingId === entry.id;

                          return (
                            <div 
                              key={entry.id} 
                              className={`flex flex-col p-2 rounded-md transition-colors bg-surface-1 shadow-sm ${isSelected ? "ring-1 ring-accent" : ""}`}
                            >
                              <div className="flex items-center gap-3">
                                <input 
                                  type="checkbox" 
                                  checked={isSelected}
                                  onChange={() => togglePlaylistItem(entry.id)}
                                  className="w-4 h-4 rounded text-accent accent-accent cursor-pointer"
                                />
                                <span className="text-caption text-tertiary w-5 text-right font-mono">{idx + 1}</span>
                                
                                {/* Item Thumbnail */}
                                <img 
                                  src={entry.thumbnail || `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg`} 
                                  alt=""
                                  className="w-14 aspect-video rounded object-cover bg-surface-0 shrink-0" 
                                />

                                {/* Title & Duration */}
                                <div className="flex-1 min-w-0">
                                  <p className="text-body-sm font-semibold text-primary truncate" title={entry.title}>
                                    {entry.title}
                                  </p>
                                  <span className="text-caption text-tertiary">{entry.duration_string}</span>
                                </div>

                                {/* In-line Audio Preview Button */}
                                <button
                                  type="button"
                                  onClick={() => toggleAudioPreview(entry.url, entry.id)}
                                  className="w-7 h-7 rounded-full bg-surface-2 hover:bg-surface-0 text-accent flex items-center justify-center shrink-0 transition-colors"
                                  title="Listen audio preview"
                                >
                                  {isLoadingAudioId === entry.id ? (
                                    <Loader2 size={12} className="animate-spin" />
                                  ) : isThisPreviewing && isPlayingAudio ? (
                                    <Pause size={12} fill="currentColor" />
                                  ) : (
                                    <Play size={12} fill="currentColor" />
                                  )}
                                </button>
                              </div>

                              {/* Sleek In-line Audio Progress Bar Below Song Title */}
                              {isThisPreviewing && (
                                <div className="mt-2 pl-9 pr-2">
                                  <div className="flex items-center justify-between text-caption text-secondary font-mono mb-1">
                                    <span className="flex items-center gap-1 text-[11px]"><Volume2 size={11} className="text-accent" /> In-line Preview</span>
                                    <span className="text-[11px]">{formatSeconds(previewTime)}</span>
                                  </div>
                                  <div className="h-1 bg-surface-0 rounded-full overflow-hidden">
                                    <div className="h-full bg-accent transition-all duration-fast" style={{ width: `${previewProgress}%` }} />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Downloads Queue & History */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-heading-sm font-semibold text-primary">Downloads Activity</h3>
                  <span className="text-caption text-secondary">{history.length} items recorded</span>
                </div>

                {history.length === 0 ? (
                  <div className="py-12 text-center bg-surface-0 rounded-lg">
                    <Download size={24} className="mx-auto mb-2 text-tertiary" />
                    <p className="text-body-sm text-secondary font-medium">No active downloads or history yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {history.map((record) => (
                      <HistoryItem 
                        key={record.id} 
                        record={record} 
                        onOpenFolder={() => openFolder(record.file_path)}
                        onRemove={() => handleRemoveHistory(record.id)}
                        onDeleteFile={() => handleDeleteFile(record.id, record.file_path)}
                      />
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {activeTab === "settings" && (
            <div className="max-w-2xl mx-auto py-6">
              <div className="bg-surface-1 rounded-lg p-6 shadow-raised space-y-6">
                <h3 className="text-heading-sm font-semibold text-primary">Preferences</h3>
                <div className="space-y-3">
                  <label className="text-body-sm font-semibold text-secondary block">Download Folder</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      readOnly 
                      value="Downloads/Devizee" 
                      className="flex-1 bg-surface-0 border border-subtle rounded-md px-4 py-2 text-body-sm text-primary outline-none" 
                    />
                    <button 
                      type="button"
                      onClick={() => openFolder("Downloads/Devizee")}
                      className="bg-surface-2 text-primary hover:bg-surface-0 px-4 rounded-md font-semibold text-body-sm transition-colors"
                    >
                      Open
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

function StatTile({ label, count, sub, gradient, icon }: { label: string; count: number; sub: string; gradient: string; icon: React.ReactNode }) {
  return (
    <div 
      className="rounded-xl p-4 text-white shadow-floating relative overflow-hidden flex flex-col justify-between min-h-24"
      style={{ background: gradient }}
    >
      <div className="flex items-center justify-between opacity-90">
        <span className="text-caption font-semibold uppercase tracking-wider">{label}</span>
        {icon}
      </div>
      <div>
        <div className="text-display font-bold leading-tight">{count}</div>
        <div className="text-caption opacity-80 mt-0.5">{sub}</div>
      </div>
    </div>
  );
}

function SidebarItem({ icon, label, active, onClick, badge }: any) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-md font-semibold text-body-sm transition-colors outline-none
        ${active 
          ? "bg-accent-subtle text-accent" 
          : "text-secondary hover:bg-surface-2 hover:text-primary"
        }
      `}
    >
      <div className="flex items-center gap-2.5">
        {icon}
        <span>{label}</span>
      </div>
      {badge !== undefined && (
        <span className="bg-accent text-white text-caption px-2 py-0.5 rounded-full font-bold">
          {badge}
        </span>
      )}
    </button>
  );
}

function HistoryItem({ record, onOpenFolder, onRemove, onDeleteFile }: { record: DownloadRecord, onOpenFolder: () => void, onRemove: () => void, onDeleteFile: () => void }) {
  const display = STATUS_DISPLAY[record.status] || STATUS_DISPLAY.error;
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="bg-surface-1 rounded-md p-3.5 flex gap-4 transition-all shadow-raised relative group">
      <div className="w-20 aspect-video bg-surface-0 rounded flex items-center justify-center text-tertiary shrink-0">
        <PlayCircle size={20} className="opacity-40" />
      </div>
      
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex items-center justify-between gap-3 mb-1">
          <h4 className="text-body-sm font-semibold truncate text-primary" title={record.title}>
            {record.title}
          </h4>
          
          <div className="shrink-0 flex items-center gap-2">
            <span className={`text-caption font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 ${
              display.colorToken === "accent" ? "bg-accent-subtle text-accent" : 
              display.colorToken === "status-success" ? "bg-status-success-subtle text-status-success" : 
              display.colorToken === "status-danger" ? "bg-status-danger-subtle text-status-danger" :
              display.colorToken === "status-warning" ? "bg-status-warning-subtle text-status-warning" :
              "bg-surface-0 text-secondary"
            }`}>
              {display.colorToken === "accent" && <Loader2 size={11} className="animate-spin" />}
              {display.label} {record.status === "downloading" && `${record.percent}%`}
            </span>
            
            <div className="relative">
              <button 
                onClick={() => setMenuOpen(!menuOpen)}
                onBlur={() => setTimeout(() => setMenuOpen(false), 200)}
                className="w-7 h-7 flex items-center justify-center text-tertiary hover:text-primary rounded transition-colors"
              >
                <MoreVertical size={16} />
              </button>
              
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-surface-1 rounded-md shadow-floating p-1.5 z-30 animate-in zoom-in-95 duration-fast">
                  {record.status === "completed" && (
                    <button onClick={onOpenFolder} className="w-full text-left px-3 py-2 text-caption font-semibold text-primary hover:bg-surface-0 rounded flex items-center gap-2">
                      <Folder size={14} /> Open in Folder
                    </button>
                  )}
                  <button onClick={onRemove} className="w-full text-left px-3 py-2 text-caption font-semibold text-primary hover:bg-surface-0 rounded flex items-center gap-2">
                    <X size={14} /> Remove Row
                  </button>
                  {record.file_path && (
                    <button onClick={onDeleteFile} className="w-full text-left px-3 py-2 text-caption font-semibold text-status-danger hover:bg-status-danger-subtle rounded flex items-center gap-2">
                      <Trash2 size={14} /> Delete from Disk
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-surface-0 rounded-full overflow-hidden mt-1">
          {display.progressMode === "determinate" && (
            <div className="h-full bg-accent transition-all duration-fast" style={{ width: `${record.percent}%` }} />
          )}
          {display.progressMode === "indeterminate" && (
            <div className="h-full bg-accent w-1/3 animate-pulse" />
          )}
          {record.status === "completed" && (
            <div className="h-full bg-status-success w-full" />
          )}
          {record.status === "error" && (
            <div className="h-full bg-status-danger w-full opacity-50" />
          )}
        </div>
      </div>
    </div>
  );
}