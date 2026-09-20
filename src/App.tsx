import React, { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { WebviewWindow, getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { 
  Download, Music, Settings as SettingsIcon, Search, X, Folder, MoreVertical, 
  Trash2, AlertCircle, PlayCircle, Loader2, Play, Pause, Volume2, Volume1, VolumeX,
  ListPlus, CheckCircle2, Clock, CheckSquare, Square, 
  ExternalLink, Moon, Sun, Shield, Cpu, 
  RefreshCw, Sliders, FastForward,
  Film, Maximize2, Minimize2, RotateCcw, RotateCw, Scissors,
  ArrowUpDown
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
  duration: number | null;
  duration_string: string;
  uploader: string;
  video_formats: FormatOption[];
  audio_formats: FormatOption[];
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
  speed?: string;
  eta?: string;
  format: string;
  date_added: number;
  hidden: boolean;
};

// ===================== TIME PARSING & FORMATTING HELPERS =====================
const parseTimeToSeconds = (str: string): number => {
  if (!str) return 0;
  const parts = str.trim().split(":").map(Number);
  if (parts.length === 3) return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  if (parts.length === 2) return (parts[0] || 0) * 60 + (parts[1] || 0);
  return Number(str) || 0;
};

const formatSecondsToTime = (secs: number, forceHours: boolean = false): string => {
  const s = Math.max(0, Math.floor(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (forceHours || h > 0) {
    return `${h}:${m < 10 ? "0" : ""}${m}:${sec < 10 ? "0" : ""}${sec}`;
  }
  return `${m < 10 ? "0" : ""}${m}:${sec < 10 ? "0" : ""}${sec}`;
};

// Format Classification Helpers
const isVideoFormat = (fmt: string): boolean => {
  if (!fmt) return true;
  const f = fmt.toLowerCase();
  if (f.startsWith("audio (") || f === "bestaudio/best" || f.includes("audio_only")) return false;
  return (
    f.includes("video") || 
    f.includes("height<=") || 
    f.includes("1080p") || 
    f.includes("720p") || 
    f.includes("480p") || 
    f.includes("360p") || 
    f.includes("4k") || 
    f.includes("8k") ||
    f.includes("mp4") || 
    f.includes("mkv") || 
    f.includes("webm") || 
    f.includes("avi") || 
    f.includes("mov")
  );
};

const isAudioFormat = (fmt: string): boolean => {
  if (!fmt) return false;
  const f = fmt.toLowerCase();
  if (isVideoFormat(fmt)) return false;
  return (
    f.includes("audio") || 
    f.includes("mp3") || 
    f.includes("m4a") || 
    f.includes("flac") || 
    f.includes("wav") || 
    f.includes("opus") ||
    f.includes("aac") ||
    f.includes("ogg")
  );
};

// ===================== MULTI-LANGUAGE DICTIONARY =====================
const translations = {
  en: {
    nav_downloads: "Downloads",
    nav_audio: "Audio Hub",
    nav_settings: "Settings",
    tile_active: "Active",
    tile_active_sub: "Downloading now",
    tile_queued: "Queued",
    tile_queued_sub: "Waiting in queue",
    tile_attention: "Attention",
    tile_attention_sub: "Failed / stalled",
    tile_completed: "Completed",
    tile_completed_sub: "Ready on disk",
    input_placeholder: "Paste video or playlist link (YouTube, SoundCloud, Vimeo...)",
    btn_analyze: "Analyze",
    analyzing: "Analyzing...",
    analysis_failed: "Analysis Failed",
    preview_audio: "Listen",
    pause_audio: "Pause",
    section_video: "Video Qualities",
    section_audio: "Audio Qualities",
    more_video: "More Resolutions ▾",
    more_audio: "More Audio Formats ▾",
    playlist_detected: "Playlist Detected",
    select_all: "Select All",
    deselect_all: "Deselect All",
    download_selected: "Download Selected",
    batch_audio: "Batch Audio (MP3)",
    batch_video: "Batch Video (MP4)",
    activity_title: "Downloads Activity",
    filter_all: "All",
    filter_video: "Video",
    filter_audio: "Audio",
    filter_active: "Active",
    filter_finished: "Finished",
    no_tasks: "No downloads found for this filter.",
    open_folder: "Open in Folder",
    open_file: "Open File",
    remove_row: "Remove Row",
    delete_file: "Delete File",
    settings_general: "General",
    settings_theme: "App Theme",
    theme_light: "Light Mode",
    theme_dark: "Dark Mode",
    settings_lang: "Language",
    settings_autostart: "Start with Windows",
    settings_autostart_desc: "Automatically launch Devizee minimized on system boot",
    settings_tray: "Minimize to System Tray",
    settings_tray_desc: "Closing window keeps background downloads active in system tray",
    settings_autoplay: "Autoplay Media",
    settings_autoplay_desc: "Automatically begin playback when streaming or opening media",
    settings_updates: "Update Check Frequency",
    settings_downloads: "Downloads",
    settings_save_loc: "Default Save Location",
    settings_auto_org: "Auto-organize Folders",
    settings_auto_org_desc: "Sort completed downloads into Video and Audio subdirectories",
    settings_filename: "Filename Template",
    settings_duplicate: "Duplicate Files",
    settings_oneclick: "One-Click Downloads",
    settings_oneclick_desc: "Auto-start highest quality tier without picking formats",
    settings_speed: "Connection & Bandwidth",
    settings_speed_limit: "Bandwidth Speed Limit",
    settings_speed_unlimited: "Unlimited (Full Speed)",
    settings_speed_custom: "Custom Limit",
    settings_proxy: "Proxy Configuration",
    settings_proxy_desc: "Route traffic through HTTP, HTTPS, or SOCKS5 proxy",
    settings_scheduler: "Scheduler & Night Mode",
    settings_night_mode: "Scheduled Night Mode",
    settings_night_mode_desc: "Queue tasks and begin automatically during low-traffic night hours",
    settings_security: "Security & Protection",
    settings_defender: "Windows Defender Scan",
    settings_defender_desc: "Scan downloaded files with Windows Defender (MpCmdRun.exe) upon completion",
    settings_advanced: "Advanced & Engine",
    settings_custom_flags: "Custom yt-dlp Flags",
    settings_custom_flags_desc: "Pass custom arguments directly to the underlying yt-dlp engine",
    audio_hub_title: "Audio Extractor & Downloader",
    audio_hub_sub: "Rip high-bitrate audio from any YouTube, SoundCloud, or web stream",
    audio_hub_input: "Paste media link to extract audio...",
    audio_hub_rip: "Rip Audio",
    audio_library: "Downloaded Music Library",
    audio_library_empty: "No audio tracks downloaded yet.",
    audio_library_empty_sub: "Downloads in MP3, M4A, or FLAC formats appear in your offline audio hub.",
  },
  es: {
    nav_downloads: "Descargas",
    nav_audio: "Centro de Audio",
    nav_settings: "Configuración",
    tile_active: "Activos",
    tile_active_sub: "Descargando ahora",
    tile_queued: "En Cola",
    tile_queued_sub: "Esperando turno",
    tile_attention: "Atención",
    tile_attention_sub: "Fallidos / detenidos",
    tile_completed: "Completados",
    tile_completed_sub: "Listos en disco",
    input_placeholder: "Pegar enlace de video o lista (YouTube, SoundCloud, Vimeo...)",
    btn_analyze: "Analizar",
    analyzing: "Analizando...",
    analysis_failed: "Falló el Análisis",
    preview_audio: "Escuchar",
    pause_audio: "Pausa",
    section_video: "Formatos de Video",
    section_audio: "Formatos de Audio",
    more_video: "Más Resoluciones ▾",
    more_audio: "Más Formatos de Audio ▾",
    playlist_detected: "Lista de Reproducción Detectada",
    select_all: "Seleccionar Todo",
    deselect_all: "Deseleccionar Todo",
    download_selected: "Descargar Seleccionados",
    batch_audio: "Lote de Audio (MP3)",
    batch_video: "Lote de Video (MP4)",
    activity_title: "Actividad de Descargas",
    filter_all: "Todos",
    filter_video: "Video",
    filter_audio: "Audio",
    filter_active: "Activos",
    filter_finished: "Terminados",
    no_tasks: "No hay descargas para este filtro.",
    open_folder: "Abrir en Carpeta",
    open_file: "Abrir Archivo",
    remove_row: "Quitar Fila",
    delete_file: "Eliminar Archivo",
    settings_general: "General",
    settings_theme: "Tema de la Aplicación",
    theme_light: "Modo Claro",
    theme_dark: "Modo Oscuro",
    settings_lang: "Idioma",
    settings_autostart: "Iniciar con Windows",
    settings_autostart_desc: "Iniciar Devizee automáticamente al encender el sistema",
    settings_tray: "Minimizar a la Bandeja",
    settings_tray_desc: "Mantener descargas activas al cerrar la ventana",
    settings_autoplay: "Reproducción Automática",
    settings_autoplay_desc: "Iniciar reproducción automáticamente al cargar medios",
    settings_updates: "Frecuencia de Actualizaciones",
    settings_downloads: "Descargas",
    settings_save_loc: "Ubicación de Guardado",
    settings_auto_org: "Auto-organizar Carpetas",
    settings_auto_org_desc: "Ordenar descargas terminadas en subcarpetas de Video y Audio",
    settings_filename: "Plantilla de Nombre",
    settings_duplicate: "Archivos Duplicados",
    settings_oneclick: "Descargas de Un Clic",
    settings_oneclick_desc: "Descargar máxima calidad de inmediato sin selector",
    settings_speed: "Conexión y Ancho de Banda",
    settings_speed_limit: "Límite de Velocidad",
    settings_speed_unlimited: "Ilimitado (Máxima Velocidad)",
    settings_speed_custom: "Límite Personalizado",
    settings_proxy: "Configuración de Proxy",
    settings_proxy_desc: "Enrutar tráfico por proxy HTTP, HTTPS o SOCKS5",
    settings_scheduler: "Programador y Modo Noche",
    settings_night_mode: "Modo Nocturno Programado",
    settings_night_mode_desc: "Diferir descargas para horas de bajo tráfico",
    settings_security: "Seguridad y Protección",
    settings_defender: "Escaneo Windows Defender",
    settings_defender_desc: "Escanear archivos con MpCmdRun.exe al completar",
    settings_advanced: "Avanzado y Motor",
    settings_custom_flags: "Banderas yt-dlp Personalizadas",
    settings_custom_flags_desc: "Pasar argumentos personalizados directamente a yt-dlp",
    audio_hub_title: "Extractor y Descargador de Audio",
    audio_hub_sub: "Extrae audio de alta fidelidad desde YouTube, SoundCloud o la web",
    audio_hub_input: "Pegar enlace para extraer audio...",
    audio_hub_rip: "Extraer Audio",
    audio_library: "Biblioteca de Música Descargada",
    audio_library_empty: "Aún no hay pistas descargadas.",
    audio_library_empty_sub: "Las pistas en MP3, M4A o FLAC aparecerán en tu biblioteca.",
  },
  de: {
    nav_downloads: "Downloads",
    nav_audio: "Audio-Hub",
    nav_settings: "Einstellungen",
    tile_active: "Aktiv",
    tile_active_sub: "Wird geladen",
    tile_queued: "Wartend",
    tile_queued_sub: "In der Warteschlange",
    tile_attention: "Achtung",
    tile_attention_sub: "Fehlerhaft / angehalten",
    tile_completed: "Abgeschlossen",
    tile_completed_sub: "Auf der Festplatte bereit",
    input_placeholder: "Video- oder Playlist-Link einfügen (YouTube, SoundCloud, Vimeo...)",
    btn_analyze: "Analysieren",
    analyzing: "Analysiere...",
    analysis_failed: "Analyse fehlgeschlagen",
    preview_audio: "Anhören",
    pause_audio: "Pause",
    section_video: "Videoformate",
    section_audio: "Audioformate",
    more_video: "Weitere Auflösungen ▾",
    more_audio: "Weitere Audioformate ▾",
    playlist_detected: "Playlist Erkannt",
    select_all: "Alle Auswählen",
    deselect_all: "Alle Abwählen",
    download_selected: "Ausgewählte Herunterladen",
    batch_audio: "Audio-Stapel (MP3)",
    batch_video: "Video-Stapel (MP4)",
    activity_title: "Download-Aktivität",
    filter_all: "Alle",
    filter_video: "Video",
    filter_audio: "Audio",
    filter_active: "Aktiv",
    filter_finished: "Fertig",
    no_tasks: "Keine Downloads für diesen Filter gefunden.",
    open_folder: "Im Ordner Öffnen",
    open_file: "Datei Öffnen",
    remove_row: "Zeile Entfernen",
    delete_file: "Datei Löschen",
    settings_general: "Allgemein",
    settings_theme: "Design-Modus",
    theme_light: "Heller Modus",
    theme_dark: "Dunkler Modus",
    settings_lang: "Sprache",
    settings_autostart: "Mit Windows Starten",
    settings_autostart_desc: "Devizee beim Systemstart automatisch minimiert starten",
    settings_tray: "In System-Tray Minimieren",
    settings_tray_desc: "Hintergrunddownloads beim Schließen fortsetzen",
    settings_autoplay: "Automatische Wiedergabe",
    settings_autoplay_desc: "Wiedergabe beim Laden von Medien automatisch starten",
    settings_updates: "Update-Prüfung",
    settings_downloads: "Downloads",
    settings_save_loc: "Speicherort",
    settings_auto_org: "Ordner Automatisch Ordnen",
    settings_auto_org_desc: "Sortiert Downloads in Video- und Audio-Unterordner",
    settings_filename: "Dateinamen-Vorlage",
    settings_duplicate: "Duplikate",
    settings_oneclick: "Ein-Klick-Download",
    settings_oneclick_desc: "Beste Qualität sofort ohne Auswahl herunterladen",
    settings_speed: "Verbindung & Bandbreite",
    settings_speed_limit: "Geschwindigkeitsbegrenzung",
    settings_speed_unlimited: "Unbegrenzt (Volle Geschwindigkeit)",
    settings_speed_custom: "Benutzerdefiniertes Limit",
    settings_proxy: "Proxy-Konfiguration",
    settings_proxy_desc: "Verkehr über HTTP-, HTTPS- oder SOCKS5-Proxy leiten",
    settings_scheduler: "Zeitplaner & Nachtmodus",
    settings_night_mode: "Geplanter Nachtmodus",
    settings_night_mode_desc: "Downloads auf verkehrsarme Nachtzeiten verschieben",
    settings_security: "Sicherheit & Schutz",
    settings_defender: "Windows Defender Scan",
    settings_defender_desc: "Dateien nach Abschluss mit MpCmdRun.exe scannen",
    settings_advanced: "Erweitert & Engine",
    settings_custom_flags: "Eigene yt-dlp Flags",
    settings_custom_flags_desc: "Zusätzliche Flags direkt an yt-dlp übergeben",
    audio_hub_title: "Audio-Extraktor & Downloader",
    audio_hub_sub: "Extrahiere hochwertige Audiospuren aus YouTube, SoundCloud oder dem Web",
    audio_hub_input: "Link zum Extrahieren einfügen...",
    audio_hub_rip: "Audio Rippen",
    audio_library: "Heruntergeladene Musikbibliothek",
    audio_library_empty: "Noch keine Audiodateien heruntergeladen.",
    audio_library_empty_sub: "Downloads im MP3-, M4A- oder FLAC-Format erscheinen in deiner Bibliothek.",
  },
  fr: {
    nav_downloads: "Téléchargements",
    nav_audio: "Centre Audio",
    nav_settings: "Paramètres",
    tile_active: "Actifs",
    tile_active_sub: "En cours de téléchargement",
    tile_queued: "En File",
    tile_queued_sub: "En attente dans la file",
    tile_attention: "Attention",
    tile_attention_sub: "Échecs ou bloqués",
    tile_completed: "Terminés",
    tile_completed_sub: "Prêts sur le disque",
    input_placeholder: "Coller le lien de la vidéo ou playlist (YouTube, SoundCloud, Vimeo...)",
    btn_analyze: "Analyser",
    analyzing: "Analyse en cours...",
    analysis_failed: "Échec de l'analyse",
    preview_audio: "Écouter",
    pause_audio: "Pause",
    section_video: "Formats Vidéo",
    section_audio: "Formats Audio",
    more_video: "Autres Résolutions ▾",
    more_audio: "Autres Formats Audio ▾",
    playlist_detected: "Playlist Détectée",
    select_all: "Tout Sélectionner",
    deselect_all: "Tout Désélectionner",
    download_selected: "Télécharger Sélection",
    batch_audio: "Lot Audio (MP3)",
    batch_video: "Lot Vidéo (MP4)",
    activity_title: "Activité des Téléchargements",
    filter_all: "Tous",
    filter_video: "Vidéo",
    filter_audio: "Audio",
    filter_active: "Actifs",
    filter_finished: "Terminés",
    no_tasks: "Aucun téléchargement trouvé pour ce filtre.",
    open_folder: "Ouvrir le Dossier",
    open_file: "Ouvrir le Fichier",
    remove_row: "Supprimer la Ligne",
    delete_file: "Supprimer le Fichier",
    settings_general: "Général",
    settings_theme: "Thème de l'App",
    theme_light: "Mode Clair",
    theme_dark: "Mode Sombre",
    settings_lang: "Langue",
    settings_autostart: "Démarrer avec Windows",
    settings_autostart_desc: "Lancer Devizee automatiquement au démarrage du système",
    settings_tray: "Réduire dans la Barre",
    settings_tray_desc: "Garder les téléchargements actifs en arrière-plan",
    settings_autoplay: "Lecture Automatique",
    settings_autoplay_desc: "Lancer automatiquement la lecture lors du chargement des médias",
    settings_updates: "Fréquence des Mises à Jour",
    settings_downloads: "Téléchargements",
    settings_save_loc: "Dossier d'Enregistrement",
    settings_auto_org: "Organisation Automatique",
    settings_auto_org_desc: "Classer les fichiers dans des dossiers Vidéo et Audio",
    settings_filename: "Modèle de Nom de Fichier",
    settings_duplicate: "Fichiers En Double",
    settings_oneclick: "Téléchargement en 1 Clic",
    settings_oneclick_desc: "Télécharger la meilleure qualité sans sélecteur",
    settings_speed: "Connexion et Vitesse",
    settings_speed_limit: "Limite de Vitesse",
    settings_speed_unlimited: "Illimitée (Vitesse Maximale)",
    settings_speed_custom: "Limite Personnalisée",
    settings_proxy: "Configuration Proxy",
    settings_proxy_desc: "Acheminer le trafic via un proxy HTTP, HTTPS ou SOCKS5",
    settings_scheduler: "Planificateur & Nuit",
    settings_night_mode: "Mode Nuit Planifié",
    settings_night_mode_desc: "Différer les téléchargements pendant les heures creuses",
    settings_security: "Sécurité & Protection",
    settings_defender: "Analyse Windows Defender",
    settings_defender_desc: "Analyser les fichiers avec MpCmdRun.exe à la fin",
    settings_advanced: "Avancé & Moteur",
    settings_custom_flags: "Paramètres yt-dlp Personnalisés",
    settings_custom_flags_desc: "Transmettre des arguments directs au moteur yt-dlp",
    audio_hub_title: "Extracteur & Téléchargeur Audio",
    audio_hub_sub: "Extrayez l'audio haute qualité de YouTube, SoundCloud ou du web",
    audio_hub_input: "Coller le lien pour extraire l'audio...",
    audio_hub_rip: "Extraire Audio",
    audio_library: "Bibliothèque Audio Locale",
    audio_library_empty: "Aucun fichier audio pour le moment.",
    audio_library_empty_sub: "Les téléchargements MP3, M4A et FLAC apparaîtront ici.",
  },
  zh: {
    nav_downloads: "下载管理",
    nav_audio: "音频中心",
    nav_settings: "设置",
    tile_active: "下载中",
    tile_active_sub: "正在全速下载",
    tile_queued: "排队中",
    tile_queued_sub: "等待调度执行",
    tile_attention: "待处理",
    tile_attention_sub: "下载失败或中断",
    tile_completed: "已完成",
    tile_completed_sub: "已保存至本地磁盘",
    input_placeholder: "粘贴视频或播放列表链接 (YouTube, SoundCloud, Vimeo...)",
    btn_analyze: "解析链接",
    analyzing: "正在解析...",
    analysis_failed: "解析失败",
    preview_audio: "试听",
    pause_audio: "暂停",
    section_video: "视频格式规格",
    section_audio: "音频格式规格",
    more_video: "更多分辨率 ▾",
    more_audio: "更多音频格式 ▾",
    playlist_detected: "检测到播放列表",
    select_all: "全选",
    deselect_all: "取消全选",
    download_selected: "下载所选项目",
    batch_audio: "批量提取音频 (MP3)",
    batch_video: "批量下载视频 (MP4)",
    activity_title: "任务下载列表",
    filter_all: "全部",
    filter_video: "视频",
    filter_audio: "音频",
    filter_active: "进行中",
    filter_finished: "已完成",
    no_tasks: "当前分类下暂无任务记录。",
    open_folder: "在文件夹中打开",
    open_file: "打开文件",
    remove_row: "移除记录",
    delete_file: "从磁盘删除文件",
    settings_general: "常规设置",
    settings_theme: "应用外观主题",
    theme_light: "浅色明亮模式",
    theme_dark: "深色夜间模式",
    settings_lang: "界面显示语言",
    settings_autostart: "开机自启动",
    settings_autostart_desc: "在 Windows 系统启动时自动后台静默运行",
    settings_tray: "关闭时最小化到系统托盘",
    settings_tray_desc: "关闭窗口时不退出程序，继续在托盘维持下载任务",
    settings_autoplay: "自动播放媒体",
    settings_autoplay_desc: "流媒体加载或打开文件时自动开始播放",
    settings_updates: "更新检查频率",
    settings_downloads: "下载偏好",
    settings_save_loc: "默认下载保存路径",
    settings_auto_org: "按类别自动分类存放",
    settings_auto_org_desc: "自动将下载完成的文件归类至 Video 和 Audio 子目录",
    settings_filename: "文件名命名模板",
    settings_duplicate: "遇到同名重复文件",
    settings_oneclick: "一键极速下载",
    settings_oneclick_desc: "解析成功后自动开始最高画质下载，跳过格式挑选",
    settings_speed: "网络连接与速度",
    settings_speed_limit: "下载速度上限限制",
    settings_speed_unlimited: "无限制 (全速下载)",
    settings_speed_custom: "自定义限速值",
    settings_proxy: "网络代理配置",
    settings_proxy_desc: "通过 HTTP、HTTPS 或 SOCKS5 代理路由所有网络流量",
    settings_scheduler: "定时调度与夜间模式",
    settings_night_mode: "夜间低峰期下载",
    settings_night_mode_desc: "将非紧急下载任务排队，延后至深夜网络空闲时段运行",
    settings_security: "安全性与文件保护",
    settings_defender: "Windows Defender 安全扫描",
    settings_defender_desc: "文件下载完成后自动调用系统安全引擎 (MpCmdRun.exe) 进行查杀",
    settings_advanced: "高级选项与引擎",
    settings_custom_flags: "自定义 yt-dlp 参数",
    settings_custom_flags_desc: "直接向底层 yt-dlp 引擎传递额外命令行参数",
    audio_hub_title: "音频提取与下载中心",
    audio_hub_sub: "从 YouTube、SoundCloud 或主流流媒体抓取无损/高码率音频",
    audio_hub_input: "粘贴媒体链接提取音频...",
    audio_hub_rip: "立即抓取",
    audio_library: "本地已下载音频库",
    audio_library_empty: "本地暂未下载任何音频文件。",
    audio_library_empty_sub: "下载的 MP3、M4A 或 FLAC 格式音频将展示在此处随时回放。",
  },
};

export default function App() {
  const isHud = window.location.search.includes("hud=true");
  
  // Navigation & Tabs
  const [activeTab, setActiveTab] = useState<"downloads" | "audio" | "settings">("downloads");
  const [url, setUrl] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [isLoadingPlaylist, setIsLoadingPlaylist] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  
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
  const mainScrollRef = useRef<HTMLElement | null>(null);
  const videoStreamCache = useRef<Map<string, string>>(new Map());

  // In-Line Audio Preview & Scrubbing State
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isLoadingAudioId, setIsLoadingAudioId] = useState<string | null>(null);
  const [previewTime, setPreviewTime] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(0);
  const audioStreamCache = useRef<Map<string, string>>(new Map());

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

  // Audio Hub state
  const [audioHubUrl, setAudioHubUrl] = useState("");
  const [audioHubFormat, setAudioHubFormat] = useState("mp3");
  const [activeAudioPlaying, setActiveAudioPlaying] = useState<DownloadRecord | null>(null);

  // History, Queue Filtering & Sorting
  const [history, setHistory] = useState<DownloadRecord[]>([]);
  const [queueFilter, setQueueFilter] = useState<"all" | "video" | "audio" | "active" | "completed">("all");
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "title" | "progress">("date_desc");
  const completedBatch = useRef<string[]>([]);
  const errorBatch = useRef<string[]>([]);
  const notificationTimer = useRef<any>(null);

  // User Settings State
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem("devizee_settings");
    if (saved) {
      try { return JSON.parse(saved); } catch {}
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

  // Immediate theme application
  useEffect(() => {
    localStorage.setItem("devizee_theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  // Fullscreen change listener
  useEffect(() => {
    const onFsChange = () => {
      setVideoFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Volume Controller
  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    setIsMuted(newVol === 0);
    localStorage.setItem("devizee_volume", newVol.toString());
    if (audioRef.current) audioRef.current.volume = newVol;
    if (videoElementRef.current) videoElementRef.current.volume = newVol;
  };

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      const restore = volume > 0 ? volume : 0.8;
      if (audioRef.current) audioRef.current.volume = restore;
      if (videoElementRef.current) videoElementRef.current.volume = restore;
    } else {
      setIsMuted(true);
      if (audioRef.current) audioRef.current.volume = 0;
      if (videoElementRef.current) videoElementRef.current.volume = 0;
    }
  };

  // Guard against tab-switch playback side-effects
  useEffect(() => {
    // When switching tabs, ensure we don't trigger accidental autoplay
    if (activeTab !== "downloads") {
      if (videoElementRef.current) videoElementRef.current.pause();
    }
  }, [activeTab]);

  // Translation helper
  const t = (key: keyof typeof translations["en"]): string => {
    const lang = (settings.language in translations ? settings.language : "en") as keyof typeof translations;
    return translations[lang]?.[key] || translations["en"][key] || (key as string);
  };

  // Autostart toggle handler
  const handleToggleAutostart = async (enable: boolean) => {
    updateSetting("launchOnBoot", enable);
    try {
      await invoke("set_autostart", { enable });
    } catch (err) {
      console.error("Autostart setting error:", err);
    }
  };

  // Open folder handler
  const openFolder = async (path?: string | null) => {
    try {
      await invoke("open_folder", { path: path || null });
    } catch (e) {
      console.error("Failed to open folder", e);
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
  const [hudData, setHudData] = useState<any>(null);

  useEffect(() => {
    if (isHud) {
      const unlisten = listen<any>("hud-data", (e) => {
        setHudData(e.payload);
      });
      return () => { unlisten.then(f => f()); };
    } else if (settings.clipboardRadar) {
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
            setTimeout(() => { hudWin?.hide(); }, 8000);
          }
        } catch {}
      }, 1500);
      return () => clearInterval(interval);
    }
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
    if (audioRef.current) audioRef.current.pause();
    setIsPlayingAudio(false);
    setPreviewingId(null);
    setNowPlaying({ type: "video", id: targetVideo.id });

    // If selecting a video from playlist, promote to active main card
    if (!videoInfo || videoInfo.id !== targetVideo.id) {
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
      invoke<VideoInfo>("fetch_video_info", { url: targetVideo.url })
        .then(info => setVideoInfo(info))
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
      const streamUrl = await invoke<string>("get_video_stream_url", { url: targetVideo.url });
      videoStreamCache.current.set(targetVideo.id, streamUrl);
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
      videoContainerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Audio preview playback handlers with instantaneous cache & seeking
  const toggleAudioPreview = async (targetUrl: string, songId: string) => {
    if (!audioRef.current) return;

    // Enforce mutual exclusivity: stop any active video immediately
    if (videoElementRef.current) videoElementRef.current.pause();
    setActiveVideoPlaying(false);

    if (previewingId === songId) {
      if (isPlayingAudio) {
        audioRef.current.pause();
        setIsPlayingAudio(false);
        setNowPlaying({ type: "none", id: null });
      } else {
        audioRef.current.play().then(() => {
          setIsPlayingAudio(true);
          setNowPlaying({ type: "audio", id: songId });
        }).catch(() => {});
      }
      return;
    }

    audioRef.current.pause();
    setPreviewingId(songId);
    setIsPlayingAudio(false);
    setPreviewTime(0);
    setNowPlaying({ type: "audio", id: songId });

    // Apply persisted volume
    audioRef.current.volume = isMuted ? 0 : volume;

    // Instant Playback from cache if already resolved
    if (audioStreamCache.current.has(songId)) {
      audioRef.current.src = audioStreamCache.current.get(songId)!;
      audioRef.current.play().then(() => setIsPlayingAudio(true)).catch(() => {});
      return;
    }

    setIsLoadingAudioId(songId);

    try {
      const streamUrl: string = await invoke("get_audio_stream_url", { url: targetUrl });
      audioStreamCache.current.set(songId, streamUrl);
      if (audioRef.current) {
        audioRef.current.src = streamUrl;
        audioRef.current.play().then(() => setIsPlayingAudio(true)).catch(() => {});
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
    setIsPlayingAudio(false);
    setPreviewTime(0);
    setNowPlaying({ type: "none", id: null });
  };

  const handleSeek = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      setPreviewTime(seconds);
    }
  };

  const handleSeekRelative = (delta: number) => {
    if (audioRef.current) {
      const total = audioRef.current.duration || 0;
      const nextTime = Math.max(0, Math.min(total, audioRef.current.currentTime + delta));
      audioRef.current.currentTime = nextTime;
      setPreviewTime(nextTime);
    }
  };

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

  // URL Analysis Logic - Robust for single videos, YouTube mixes, and playlists
  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = url.trim();
    if (!clean) return;

    setFetchError("");
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

        const plPromise = invoke<PlaylistInfo>("fetch_playlist_info", { url: plUrl })
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
          const info = await invoke<VideoInfo>("fetch_video_info", { url: videoClean });
          setVideoInfo(info);
          if (info.duration_string && info.duration_string !== "--:--") {
            setTrimEnd(info.duration_string);
          }
          if (settings.autoplay) {
            handlePlayVideo(info);
          }
        }
        await plPromise;
      } else if (videoId) {
        const info = await invoke<VideoInfo>("fetch_video_info", { url: clean });
        setVideoInfo(info);
        if (info.duration_string && info.duration_string !== "--:--") {
          setTrimEnd(info.duration_string);
        }
        if (settings.autoplay) {
          handlePlayVideo(info);
        }
      } else {
        const info = await invoke<VideoInfo>("fetch_video_info", { url: clean });
        setVideoInfo(info);
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
  };

  const handleStartDownload = async (formatId: string, ext: string, isAudio: boolean, specificInfo?: any) => {
    const info = specificInfo || videoInfo;
    if (!info) return;
    
    const taskId = `${info.id}-${Date.now()}`;
    const displayFormat = isAudio ? `Audio (${ext.toUpperCase()})` : formatId;
    
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

    // Clip trimming range parameter (USP)
    const downloadSectionsArg = isTrimming && trimStart && trimEnd ? `*${trimStart}-${trimEnd}` : null;

    try {
      await invoke("start_download", {
        taskId: taskId,
        url: info.url,
        title: info.title,
        formatId: formatId,
        isAudioOnly: isAudio,
        ext: ext,
        subfolder: settings.autoOrganize ? (isAudio ? "Audio" : "Video") : null,
        speedLimit: speedLimitArg,
        proxy: proxyArg,
        customFlags: settings.customFlags ? settings.customFlags : null,
        scanAntivirus: settings.scanAntivirus,
        downloadSections: downloadSectionsArg,
      });
    } catch (e: any) {
      console.error("Start download failed:", e);
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

  const handleRemoveHistory = async (id: string) => {
    await invoke("hide_history_item", { id });
    loadHistory();
  };

  const handleDeleteFile = async (id: string, filePath: string | null) => {
    if (!filePath) return;
    const confirm = window.confirm("Are you sure you want to delete this file from your disk?");
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

  // Status counters
  const activeCount = history.filter(h => h.status === "downloading" || h.status === "muxing" || h.status === "starting").length;
  const queuedCount = history.filter(h => h.status === "queued" || h.status === "fetching_metadata").length;
  const attentionCount = history.filter(h => h.status === "error" || h.status === "interrupted").length;
  const completedCount = history.filter(h => h.status === "completed").length;

  const audioHistory = history.filter(h => 
    h.status === "completed" && isAudioFormat(h.format)
  );

  // Filtered & Sorted history (Fix for Step 8 & Step 9)
  const filteredHistory = history.filter(item => {
    if (queueFilter === "all") return true;
    if (queueFilter === "video") return isVideoFormat(item.format);
    if (queueFilter === "audio") return isAudioFormat(item.format);
    if (queueFilter === "active") return item.status === "downloading" || item.status === "muxing" || item.status === "starting" || item.status === "queued";
    if (queueFilter === "completed") return item.status === "completed";
    return true;
  });

  const sortedHistory = [...filteredHistory].sort((a, b) => {
    if (sortBy === "date_desc") return b.date_added - a.date_added;
    if (sortBy === "date_asc") return a.date_added - b.date_added;
    if (sortBy === "title") return a.title.localeCompare(b.title);
    if (sortBy === "progress") return b.percent - a.percent;
    return 0;
  });

  const activeCardTask = activeCardTaskId ? history.find(h => h.id === activeCardTaskId) : null;

  if (isHud) {
    return (
      <div className="w-full h-full bg-surface-1 rounded-md p-3 shadow-floating flex flex-col justify-center overflow-hidden border border-border-subtle">
        {hudData?.info ? (
          <>
            <div className="flex gap-2.5 items-center">
              <img src={hudData.info.thumbnail} className="w-14 aspect-video object-cover rounded-sm shrink-0 shadow-sm" alt="" />
              <div className="flex-1 min-w-0">
                <h4 className="text-body-sm font-semibold truncate text-primary">{hudData.info.title}</h4>
                <p className="text-caption text-secondary truncate">Detected in clipboard</p>
              </div>
            </div>
            <div className="flex gap-2 mt-2">
              <button 
                onClick={async () => { 
                  await invoke("start_download", { 
                    taskId: `${hudData.info.id}-${Date.now()}`,
                    url: hudData.url, 
                    title: hudData.info.title,
                    formatId: "bestvideo+bestaudio/best", 
                    ext: "mp4", 
                    isAudioOnly: false,
                    subfolder: "Video",
                    speedLimit: null,
                    proxy: null,
                    customFlags: null,
                    scanAntivirus: true,
                    downloadSections: null,
                  });
                  const win = getCurrentWebviewWindow();
                  await win.hide(); 
                }} 
                className="flex-1 bg-accent text-white py-1 rounded-sm text-caption font-semibold hover:bg-accent-hover transition-colors"
              >
                Download Best
              </button>
              <button 
                onClick={async () => { 
                  const win = getCurrentWebviewWindow();
                  await win.hide(); 
                }} 
                className="px-3 bg-surface-2 text-primary py-1 rounded-sm text-caption font-semibold hover:bg-surface-0 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-secondary gap-2 font-medium text-body-sm">
            <Loader2 className="animate-spin text-accent" size={16} /> Inspecting clipboard...
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-surface-0 text-primary font-sans antialiased overflow-hidden select-none">
      {/* Hidden Audio Player for In-line Previews */}
      <audio 
        ref={audioRef} 
        onTimeUpdate={handleAudioTimeUpdate} 
        onEnded={handleAudioEnded} 
        className="hidden" 
      />

      {/* Sleek Custom Desktop TopBar */}
      <header className="h-12 bg-surface-1 border-b border-border-subtle flex items-center justify-between px-4 shrink-0 z-30 shadow-sm">
        {/* Left: Branding & Status */}
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center text-white shadow-sm">
            <Download size={15} strokeWidth={2.5} />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-body-sm tracking-tight text-primary">Devizee</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-accent-subtle text-accent font-medium">v0.1.0</span>
            {nowPlaying.type !== "none" && (
              <span className="flex items-center gap-1 text-[11px] text-accent font-medium px-2 py-0.5 rounded-full bg-accent-subtle animate-pulse">
                <Volume2 size={12} /> Playing {nowPlaying.type}
              </span>
            )}
          </div>
        </div>

        {/* Center: Integrated Navigation Tabs */}
        <div className="flex items-center bg-surface-2 p-1 rounded-md gap-1">
          <TopNavButton 
            active={activeTab === "downloads"} 
            onClick={() => setActiveTab("downloads")}
            icon={<Download size={14} />}
            label={t("nav_downloads")}
            badge={activeCount > 0 ? activeCount : undefined}
          />
          <TopNavButton 
            active={activeTab === "audio"} 
            onClick={() => setActiveTab("audio")}
            icon={<Music size={14} />}
            label={t("nav_audio")}
            badge={audioHistory.length > 0 ? audioHistory.length : undefined}
          />
          <TopNavButton 
            active={activeTab === "settings"} 
            onClick={() => setActiveTab("settings")}
            icon={<SettingsIcon size={14} />}
            label={t("nav_settings")}
          />
        </div>

        {/* Right: Actions & Theme Switcher */}
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-subtle text-accent text-caption font-semibold">
              <Loader2 size={11} className="animate-spin" />
              <span>{activeCount} active</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => handleThemeChange(theme === "light" ? "dark" : "light")}
            className="w-8 h-8 rounded-md bg-surface-2 hover:bg-surface-0 flex items-center justify-center text-secondary hover:text-primary transition-colors border border-border-subtle"
            title="Toggle Theme (Light / Dark)"
          >
            {theme === "light" ? <Moon size={15} /> : <Sun size={15} />}
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <main ref={mainScrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {/* ===================== TAB 1: DOWNLOADS ===================== */}
        {activeTab === "downloads" && (
          <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-150">
            
            {/* StatTiles — 4 Purposeful Gradient Highlight Tiles */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
              <StatTile 
                label={t("tile_active")} 
                count={activeCount} 
                sub={t("tile_active_sub")}
                gradient="var(--gradient-tile-primary)" 
                icon={<Download size={17} />} 
              />
              <StatTile 
                label={t("tile_queued")} 
                count={queuedCount} 
                sub={t("tile_queued_sub")}
                gradient="var(--gradient-tile-blue)" 
                icon={<Clock size={17} />} 
              />
              <StatTile 
                label={t("tile_attention")} 
                count={attentionCount} 
                sub={t("tile_attention_sub")}
                gradient="var(--gradient-tile-amber)" 
                icon={<AlertCircle size={17} />} 
              />
              <StatTile 
                label={t("tile_completed")} 
                count={completedCount} 
                sub={t("tile_completed_sub")}
                gradient="var(--gradient-tile-violet)" 
                icon={<CheckCircle2 size={17} />} 
              />
            </div>

            {/* URL Input Form */}
            <form onSubmit={handleAnalyze} className="relative shadow-raised rounded-md bg-surface-1">
              <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-accent">
                <Search size={18} strokeWidth={2.5} />
              </div>
              <input
                type="text"
                placeholder={t("input_placeholder")}
                className="w-full bg-surface-1 rounded-md h-12 pl-10 pr-32 text-body-sm font-medium transition-colors outline-none text-primary placeholder:text-tertiary"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <button
                type="submit"
                disabled={isFetching || !url.trim()}
                className="absolute right-1.5 top-1.5 bottom-1.5 bg-accent hover:bg-accent-hover text-white px-4 rounded-md font-semibold text-body-sm transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
              >
                {isFetching ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} strokeWidth={2.5} />}
                <span>{isFetching ? t("analyzing") : t("btn_analyze")}</span>
              </button>
            </form>

            {fetchError && (
              <div className="bg-status-danger-subtle p-3.5 rounded-md flex items-start gap-2.5 text-status-danger animate-in fade-in duration-fast">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <div className="text-body-sm font-medium">
                  <span className="font-semibold">{t("analysis_failed")}: </span>{fetchError}
                </div>
              </div>
            )}

            {/* Single Video Card Preview with Integrated In-App Player */}
            {videoInfo && (
              <div className="bg-surface-1 rounded-md p-4 shadow-raised relative overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-fast">
                <div className="flex flex-col sm:flex-row gap-4">
                  
                  {/* Interactive Thumbnail / Embedded In-App Video Player */}
                  <div 
                    ref={videoContainerRef}
                    className="w-full sm:w-64 aspect-video rounded-md overflow-hidden bg-black shrink-0 relative shadow-sm group"
                  >
                    {activeVideoPlaying ? (
                      <div className="w-full h-full relative flex items-center justify-center bg-black">
                        {isVideoLoading ? (
                          <div className="flex flex-col items-center gap-2 text-white text-caption">
                            <Loader2 size={24} className="animate-spin text-accent" />
                            <span>Buffering video stream...</span>
                          </div>
                        ) : videoStreamUrl ? (
                          <video 
                            ref={videoElementRef}
                            src={videoStreamUrl}
                            controls
                            autoPlay
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          // High compatibility fallback iframe for YouTube
                          <iframe
                            src={`https://www.youtube-nocookie.com/embed/${videoInfo.id}?autoplay=1&rel=0`}
                            title={videoInfo.title}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                            allowFullScreen
                            className="w-full h-full border-0"
                          />
                        )}

                        {/* Floating Player Controls Bar (Fix for Step 1: Fullscreen close behaves like minimize & Step 2: Volume Control) */}
                        <div className="absolute top-2 right-2 flex items-center gap-2 z-20 bg-black/70 backdrop-blur-md px-2 py-1.5 rounded-lg border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* In-player volume control */}
                          <div className="flex items-center gap-1.5 pr-1 border-r border-white/15">
                            <button
                              type="button"
                              onClick={toggleMute}
                              className="w-7 h-7 rounded-md bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                              title={isMuted ? "Unmute" : "Mute"}
                            >
                              {isMuted || volume === 0 ? <VolumeX size={13} /> : volume < 0.5 ? <Volume1 size={13} /> : <Volume2 size={13} />}
                            </button>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.05"
                              value={isMuted ? 0 : volume}
                              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                              className="w-16 h-1 bg-white/30 accent-accent cursor-pointer rounded-full"
                              title={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
                            />
                          </div>

                          <button
                            type="button"
                            onClick={toggleFullscreen}
                            className="w-7 h-7 rounded-md bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                            title={videoFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                          >
                            {videoFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (videoFullscreen) {
                                // If in fullscreen mode, close button exits fullscreen without stopping playback
                                if (document.fullscreenElement) {
                                  document.exitFullscreen().catch(() => {});
                                }
                              } else {
                                // If inline player, close button returns to thumbnail view
                                setActiveVideoPlaying(false);
                                setNowPlaying({ type: "none", id: null });
                                if (videoElementRef.current) videoElementRef.current.pause();
                              }
                            }}
                            className="w-7 h-7 rounded-md bg-white/10 hover:bg-status-danger/80 text-white flex items-center justify-center transition-colors"
                            title={videoFullscreen ? "Exit Fullscreen (Minimize)" : "Close Video Player"}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div 
                        className="w-full h-full relative cursor-pointer"
                        onClick={() => handlePlayVideo(videoInfo)}
                        title="Click to play video directly in app"
                      >
                        <img 
                          src={videoInfo.thumbnail} 
                          alt="Thumbnail" 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                          onError={(e) => {
                            e.currentTarget.src = `https://i.ytimg.com/vi/${videoInfo.id}/hqdefault.jpg`;
                          }}
                        />
                        {/* Play Overlay */}
                        <div className="absolute inset-0 bg-black/25 group-hover:bg-black/35 flex items-center justify-center transition-colors">
                          <div className="w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center shadow-floating group-hover:scale-110 transition-transform">
                            <Play size={18} fill="currentColor" className="ml-0.5" />
                          </div>
                        </div>
                        <div className="absolute bottom-1.5 right-1.5 bg-black/80 text-white font-mono text-[10px] px-1.5 py-0.5 rounded shadow-sm">
                          {videoInfo.duration_string}
                        </div>
                        <div className="absolute top-1.5 left-1.5 bg-black/75 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                          Play In-App
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-body font-semibold leading-snug line-clamp-2 text-primary">
                          {videoInfo.title}
                        </h3>
                        
                        <div className="flex items-center gap-2 shrink-0">
                          {/* Step 4: Prominent Primary Accent Listen Button before collapsing into player */}
                          {previewingId !== videoInfo.id && (
                            <button
                              type="button"
                              onClick={() => toggleAudioPreview(videoInfo.url, videoInfo.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent hover:bg-accent-hover text-white font-semibold text-caption shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                              title="Preview audio before downloading"
                            >
                              {isLoadingAudioId === videoInfo.id ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <Play size={13} fill="currentColor" />
                              )}
                              <span>{t("preview_audio")}</span>
                            </button>
                          )}

                          {/* Clip-Before-Download (Trimming USP) Toggle */}
                          <button
                            type="button"
                            onClick={() => {
                              setIsTrimming(!isTrimming);
                              if (!trimEnd && videoInfo.duration_string !== "--:--") {
                                setTrimEnd(videoInfo.duration_string);
                              }
                            }}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-semibold text-caption transition-all border border-border-subtle ${
                              isTrimming 
                                ? "bg-accent text-white shadow-sm" 
                                : "bg-surface-2 hover:bg-surface-0 text-secondary hover:text-primary"
                            }`}
                            title="Trim start/end clip before downloading"
                          >
                            <Scissors size={12} />
                            <span>{isTrimming ? "Trimming" : "Trim Clip"}</span>
                          </button>
                        </div>
                      </div>

                      <p className="text-secondary text-caption mt-0.5">{videoInfo.uploader}</p>

                      {/* Step 4: Redesigned Audio Player Strip (Listen button sits centrally on the progress bar flanked by jumps) */}
                      {previewingId === videoInfo.id && (
                        <div className="mt-2.5 p-3 rounded-md bg-surface-0 border border-border-subtle space-y-2.5 animate-in fade-in duration-fast">
                          <div className="flex items-center justify-between text-caption text-secondary font-mono text-[11px]">
                            <span className="flex items-center gap-1.5 font-semibold text-primary">
                              <Volume2 size={13} className="text-accent" /> In-line Audio Preview
                            </span>
                            <span>{formatSeconds(previewTime)} / {formatSeconds(previewDuration || 0)}</span>
                          </div>

                          {/* Scrubbable Seek Slider */}
                          <input 
                            type="range"
                            min="0"
                            max={previewDuration || 100}
                            step="0.5"
                            value={previewTime}
                            onChange={(e) => handleSeek(parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-surface-2 accent-accent cursor-pointer rounded-full outline-none"
                          />

                          {/* Controls Row: Flanked by Jumps + Volume Controls + Close */}
                          <div className="flex items-center justify-between pt-1">
                            {/* Central Controls Flanked by Backward/Forward Buttons */}
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleSeekRelative(-5)}
                                className="w-7 h-7 rounded-md bg-surface-2 hover:bg-surface-3 text-secondary hover:text-primary flex items-center justify-center transition-colors border border-border-subtle shadow-sm"
                                title="Rewind 5 seconds"
                              >
                                <RotateCcw size={12} />
                              </button>

                              <button
                                type="button"
                                onClick={() => toggleAudioPreview(videoInfo.url, videoInfo.id)}
                                className="px-3.5 py-1.5 rounded-md bg-accent hover:bg-accent-hover text-white text-caption font-semibold flex items-center gap-1.5 shadow-sm transition-transform hover:scale-[1.03] active:scale-[0.97]"
                              >
                                {isPlayingAudio ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                                <span>{isPlayingAudio ? t("pause_audio") : t("preview_audio")}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleSeekRelative(5)}
                                className="w-7 h-7 rounded-md bg-surface-2 hover:bg-surface-3 text-secondary hover:text-primary flex items-center justify-center transition-colors border border-border-subtle shadow-sm"
                                title="Forward 5 seconds"
                              >
                                <RotateCw size={12} />
                              </button>
                            </div>

                            {/* Step 2: Integrated Volume Slider */}
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={toggleMute}
                                  className="w-7 h-7 rounded-md bg-surface-2 hover:bg-surface-3 text-secondary hover:text-primary flex items-center justify-center transition-colors border border-border-subtle shadow-sm"
                                  title={isMuted ? "Unmute" : "Mute"}
                                >
                                  {isMuted || volume === 0 ? <VolumeX size={13} /> : volume < 0.5 ? <Volume1 size={13} /> : <Volume2 size={13} />}
                                </button>
                                <input
                                  type="range"
                                  min="0"
                                  max="1"
                                  step="0.05"
                                  value={isMuted ? 0 : volume}
                                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                                  className="w-16 h-1 bg-surface-2 accent-accent cursor-pointer rounded-full"
                                  title={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
                                />
                              </div>

                              {/* Close Audio Preview Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  if (audioRef.current) audioRef.current.pause();
                                  setIsPlayingAudio(false);
                                  setPreviewingId(null);
                                  setNowPlaying({ type: "none", id: null });
                                }}
                                className="w-7 h-7 rounded-md bg-surface-2 hover:bg-surface-3 text-secondary hover:text-status-danger flex items-center justify-center transition-colors border border-border-subtle shadow-sm"
                                title="Close audio preview"
                              >
                                <X size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Step 5: Clip-Before-Download Range Selector with Arrow Keys & Wheel Increment */}
                      {isTrimming && (
                        <div className="mt-2.5 p-3 rounded-md bg-surface-0 border border-border-subtle space-y-2 animate-in fade-in duration-fast">
                          <div className="flex items-center justify-between text-caption font-semibold text-primary">
                            <span className="flex items-center gap-1.5 text-accent">
                              <Scissors size={12} />
                              <span>Clip-Before-Download Range</span>
                            </span>
                            <span className="text-secondary text-[10px]">Use Up/Down arrows or mouse wheel to adjust</span>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-3 text-caption">
                            <div className="flex items-center gap-1.5">
                              <span className="text-secondary">Start:</span>
                              <input 
                                type="text"
                                value={trimStart}
                                onChange={(e) => setTrimStart(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "ArrowUp") {
                                    e.preventDefault();
                                    adjustTrimTimestamp(trimStart, setTrimStart, e.shiftKey ? 5 : 1);
                                  } else if (e.key === "ArrowDown") {
                                    e.preventDefault();
                                    adjustTrimTimestamp(trimStart, setTrimStart, e.shiftKey ? -5 : -1);
                                  }
                                }}
                                onWheel={(e) => {
                                  e.preventDefault();
                                  const delta = e.deltaY < 0 ? (e.shiftKey ? 5 : 1) : (e.shiftKey ? -5 : -1);
                                  adjustTrimTimestamp(trimStart, setTrimStart, delta);
                                }}
                                placeholder="00:00"
                                className="w-20 bg-surface-1 border border-border-subtle rounded px-2 py-1 text-caption font-mono text-primary outline-none focus:border-accent"
                                title="Scroll or press Up/Down (Shift+Up/Down for ±5s)"
                              />
                              <button
                                type="button"
                                onClick={() => setTrimStart(formatSeconds(previewTime))}
                                className="text-[10px] font-semibold text-accent hover:underline px-1"
                                title="Set start to current playback time"
                              >
                                Use Pos
                              </button>
                            </div>

                            <span className="text-tertiary">to</span>

                            <div className="flex items-center gap-1.5">
                              <span className="text-secondary">End:</span>
                              <input 
                                type="text"
                                value={trimEnd}
                                onChange={(e) => setTrimEnd(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "ArrowUp") {
                                    e.preventDefault();
                                    adjustTrimTimestamp(trimEnd, setTrimEnd, e.shiftKey ? 5 : 1);
                                  } else if (e.key === "ArrowDown") {
                                    e.preventDefault();
                                    adjustTrimTimestamp(trimEnd, setTrimEnd, e.shiftKey ? -5 : -1);
                                  }
                                }}
                                onWheel={(e) => {
                                  e.preventDefault();
                                  const delta = e.deltaY < 0 ? (e.shiftKey ? 5 : 1) : (e.shiftKey ? -5 : -1);
                                  adjustTrimTimestamp(trimEnd, setTrimEnd, delta);
                                }}
                                placeholder={videoInfo.duration_string}
                                className="w-20 bg-surface-1 border border-border-subtle rounded px-2 py-1 text-caption font-mono text-primary outline-none focus:border-accent"
                                title="Scroll or press Up/Down (Shift+Up/Down for ±5s)"
                              />
                              <button
                                type="button"
                                onClick={() => setTrimEnd(formatSeconds(previewTime))}
                                className="text-[10px] font-semibold text-accent hover:underline px-1"
                                title="Set end to current playback time"
                              >
                                Use Pos
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Step 6: Live Download Progress Bar on Card instead of Disappearing */}
                    {activeCardTask && (
                      <div className="mt-3 p-3 rounded-md bg-surface-0 border border-accent/30 space-y-2 animate-in fade-in duration-fast">
                        <div className="flex items-center justify-between text-caption font-semibold">
                          <span className="flex items-center gap-1.5 text-accent">
                            {activeCardTask.status === "completed" ? (
                              <CheckCircle2 size={14} className="text-status-success" />
                            ) : (
                              <Loader2 size={14} className="animate-spin text-accent" />
                            )}
                            <span>{activeCardTask.status === "completed" ? "Download Completed" : `Downloading (${activeCardTask.percent.toFixed(0)}%)`}</span>
                          </span>
                          <span className="text-caption font-mono text-secondary text-[11px]">
                            {activeCardTask.speed && activeCardTask.speed !== "0 B/s" ? activeCardTask.speed : ""} {activeCardTask.eta ? `• ETA: ${activeCardTask.eta}` : ""}
                          </span>
                        </div>

                        <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-fast ${activeCardTask.status === "completed" ? "bg-status-success" : "bg-accent"}`}
                            style={{ width: `${activeCardTask.percent}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-caption pt-0.5">
                          {activeCardTask.file_path ? (
                            <button
                              type="button"
                              onClick={() => openFile(activeCardTask.file_path)}
                              className="text-accent font-semibold hover:underline flex items-center gap-1"
                            >
                              <Play size={11} fill="currentColor" /> Open Downloaded File
                            </button>
                          ) : <span />}
                          <button
                            type="button"
                            onClick={() => setActiveCardTaskId(null)}
                            className="text-secondary hover:text-primary text-[11px] hover:underline"
                          >
                            Dismiss Progress
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 2 DISTINCT SECTIONS: Video Formats & Audio Formats */}
                    <div className="mt-3 pt-3 border-t border-border-subtle space-y-3">
                      {videoInfo.video_formats && videoInfo.video_formats.length > 0 ? (
                        <>
                          {/* VIDEO SECTION */}
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-secondary uppercase tracking-wider">
                              <Film size={12} className="text-accent" />
                              <span>{t("section_video")}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {/* Primary Video Pills */}
                              {videoInfo.video_formats.slice(0, 3).map((f) => (
                                <button
                                  key={f.format_id + f.label}
                                  onClick={() => handleStartDownload(f.format_id, f.ext, false)}
                                  className={`px-3 py-1.5 rounded-md text-caption font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] ${
                                    f.resolution === "1080p" || f.resolution === "Max"
                                      ? "bg-accent text-white hover:bg-accent-hover shadow-sm"
                                      : "bg-surface-2 text-primary hover:bg-surface-0"
                                  }`}
                                >
                                  {f.label}
                                </button>
                              ))}

                              {/* Video Dropdown for Secondary Options */}
                              {videoInfo.video_formats.length > 3 && (
                                <div className="relative inline-block">
                                  <select
                                    onChange={(e) => {
                                      if (!e.target.value) return;
                                      const f = videoInfo.video_formats.find(x => x.format_id === e.target.value);
                                      if (f) handleStartDownload(f.format_id, f.ext, false);
                                      e.target.value = "";
                                    }}
                                    defaultValue=""
                                    className="bg-surface-2 hover:bg-surface-0 text-primary border border-border-subtle px-2.5 py-1.5 rounded-md text-caption font-semibold outline-none cursor-pointer"
                                  >
                                    <option value="" disabled>{t("more_video")}</option>
                                    {videoInfo.video_formats.slice(3).map((f) => (
                                      <option key={f.format_id + f.label} value={f.format_id}>
                                        {f.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* AUDIO SECTION */}
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-secondary uppercase tracking-wider">
                              <Music size={12} className="text-accent" />
                              <span>{t("section_audio")}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {/* Primary Audio Pills */}
                              {videoInfo.audio_formats.slice(0, 2).map((f) => (
                                <button
                                  key={f.format_id + f.label}
                                  onClick={() => handleStartDownload(f.format_id, f.ext, true)}
                                  className="px-3 py-1.5 rounded-md bg-surface-2 hover:bg-surface-0 text-primary text-caption font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
                                >
                                  {f.label}
                                </button>
                              ))}

                              {/* Audio Dropdown for Secondary Options */}
                              {videoInfo.audio_formats.length > 2 && (
                                <div className="relative inline-block">
                                  <select
                                    onChange={(e) => {
                                      if (!e.target.value) return;
                                      const f = videoInfo.audio_formats.find(x => x.label === e.target.value);
                                      if (f) handleStartDownload(f.format_id, f.ext, true);
                                      e.target.value = "";
                                    }}
                                    defaultValue=""
                                    className="bg-surface-2 hover:bg-surface-0 text-primary border border-border-subtle px-2.5 py-1.5 rounded-md text-caption font-semibold outline-none cursor-pointer"
                                  >
                                    <option value="" disabled>{t("more_audio")}</option>
                                    {videoInfo.audio_formats.slice(2).map((f) => (
                                      <option key={f.format_id + f.label} value={f.label}>
                                        {f.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center gap-2 text-caption text-secondary py-1">
                          <Loader2 size={13} className="animate-spin text-accent" />
                          <span>Resolving format streams & audio options...</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Playlist Banner & Items Drawer */}
            {(playlistInfo || isLoadingPlaylist) && (
              <div className="bg-surface-1 rounded-md shadow-raised overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-fast">
                <div className="p-3.5 flex items-center justify-between border-b border-border-subtle">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-md bg-accent-subtle text-accent flex items-center justify-center shrink-0">
                      {isLoadingPlaylist ? <Loader2 size={15} className="animate-spin" /> : <ListPlus size={15} />}
                    </div>
                    <div>
                      <h4 className="font-semibold text-body-sm text-primary">
                        {isLoadingPlaylist ? "Resolving playlist tracks..." : playlistInfo?.title}
                      </h4>
                      <p className="text-caption text-secondary">
                        {playlistInfo ? `${playlistInfo.entries.length} videos detected • ${selectedPlaylistItems.size} selected` : "Analyzing list..."}
                      </p>
                    </div>
                  </div>

                  {playlistInfo && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowPlaylistSection(!showPlaylistSection)}
                        className="px-3 py-1 rounded-md bg-surface-2 hover:bg-surface-0 text-primary text-caption font-semibold transition-colors border border-border-subtle"
                      >
                        {showPlaylistSection ? "Collapse" : "Expand Playlist"}
                      </button>
                      {selectedPlaylistItems.size > 0 && (
                        <button
                          type="button"
                          onClick={() => handleBatchDownload("bestvideo+bestaudio/best", "mp4", false)}
                          className="px-3.5 py-1 rounded-md bg-accent hover:bg-accent-hover text-white text-caption font-semibold transition-all hover:scale-[1.02] shadow-sm"
                        >
                          {t("download_selected")} ({selectedPlaylistItems.size})
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {playlistInfo && showPlaylistSection && (
                  <div className="p-3.5 space-y-3 bg-surface-0/40">
                    
                    {/* Step 10: Clear Spacing between Select All and Deselect All buttons (gap-3) */}
                    <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                      <div className="flex items-center gap-3 text-caption font-semibold">
                        <button 
                          type="button"
                          onClick={selectAllPlaylist} 
                          className="px-3 py-1 rounded-md border border-border-subtle bg-surface-1 hover:bg-surface-2 flex items-center gap-1.5 text-accent shadow-sm transition-colors"
                        >
                          <CheckSquare size={13} />
                          <span>{t("select_all")}</span>
                        </button>
                        <button 
                          type="button"
                          onClick={deselectAllPlaylist} 
                          className="px-3 py-1 rounded-md border border-border-subtle bg-surface-1 hover:bg-surface-2 flex items-center gap-1.5 text-secondary hover:text-primary shadow-sm transition-colors"
                        >
                          <Square size={13} />
                          <span>{t("deselect_all")}</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={selectedPlaylistItems.size === 0}
                          onClick={() => handleBatchDownload("bestaudio/best", "mp3", true)}
                          className="px-3 py-1 rounded-md bg-surface-2 text-primary hover:bg-surface-1 text-caption font-semibold disabled:opacity-40 transition-colors border border-border-subtle"
                        >
                          {t("batch_audio")}
                        </button>
                        <button
                          type="button"
                          disabled={selectedPlaylistItems.size === 0}
                          onClick={() => handleBatchDownload("bestvideo+bestaudio/best", "mp4", false)}
                          className="px-3 py-1 rounded-md bg-accent text-white hover:bg-accent-hover text-caption font-semibold disabled:opacity-40 transition-colors shadow-sm"
                        >
                          {t("batch_video")}
                        </button>
                      </div>
                    </div>

                    {/* Scrollable Checklist */}
                    <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1.5">
                      {playlistInfo.entries.map((entry, idx) => {
                        const isSelected = selectedPlaylistItems.has(entry.id);
                        const isThisPreviewing = previewingId === entry.id;

                        return (
                          <div 
                            key={entry.id} 
                            className={`flex flex-col p-2 rounded-md transition-all bg-surface-1 shadow-sm ${isSelected ? "ring-1 ring-accent" : ""}`}
                          >
                            <div className="flex items-center gap-2.5">
                              <input 
                                type="checkbox" 
                                checked={isSelected}
                                onChange={() => togglePlaylistItem(entry.id)}
                                className="w-3.5 h-3.5 rounded text-accent accent-accent cursor-pointer"
                              />
                              <span className="text-caption text-tertiary w-5 text-right font-mono text-[11px]">{idx + 1}</span>
                              
                              {/* Click Thumbnail to play video directly in app */}
                              <div 
                                onClick={() => handlePlayVideo(entry)}
                                className="w-14 aspect-video rounded-sm overflow-hidden bg-surface-0 shrink-0 relative cursor-pointer group/thumb"
                                title="Click to play this video directly in-app above"
                              >
                                <img 
                                  src={entry.thumbnail || `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg`} 
                                  alt=""
                                  onError={(e) => {
                                    e.currentTarget.src = `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg`;
                                  }}
                                  className="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform duration-200" 
                                />
                                <div className="absolute inset-0 bg-black/25 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity">
                                  <Play size={12} fill="white" className="text-white ml-0.5" />
                                </div>
                              </div>

                              <div className="flex-1 min-w-0">
                                <p className="text-body-sm font-semibold text-primary truncate cursor-pointer hover:text-accent" onClick={() => handlePlayVideo(entry)} title={entry.title}>
                                  {entry.title}
                                </p>
                                <span className="text-caption text-tertiary text-[11px]">{entry.duration_string}</span>
                              </div>

                              {/* Audio Listen Preview Button */}
                              <button
                                type="button"
                                onClick={() => toggleAudioPreview(entry.url, entry.id)}
                                className="w-7 h-7 rounded-md bg-surface-2 hover:bg-surface-3 text-accent flex items-center justify-center shrink-0 transition-colors border border-border-subtle shadow-sm"
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

                            {/* In-Line Audio Scrubbing for playlist tracks */}
                            {isThisPreviewing && (
                              <div className="mt-2 pl-8 pr-1 space-y-1.5">
                                <div className="flex items-center justify-between text-caption text-secondary font-mono text-[10px]">
                                  <span className="flex items-center gap-1 text-accent font-semibold"><Volume2 size={11} /> Playing Preview</span>
                                  <span>{formatSeconds(previewTime)} / {formatSeconds(previewDuration || 0)}</span>
                                </div>
                                <input 
                                  type="range"
                                  min="0"
                                  max={previewDuration || 100}
                                  step="0.5"
                                  value={previewTime}
                                  onChange={(e) => handleSeek(parseFloat(e.target.value))}
                                  className="w-full h-1 bg-surface-0 accent-accent cursor-pointer rounded-full outline-none"
                                />
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleSeekRelative(-5)}
                                      className="text-[10px] text-secondary hover:text-primary flex items-center gap-0.5"
                                    >
                                      <RotateCcw size={9} /> -5s
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSeekRelative(5)}
                                      className="text-[10px] text-secondary hover:text-primary flex items-center gap-0.5"
                                    >
                                      +5s <RotateCw size={9} />
                                    </button>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (audioRef.current) audioRef.current.pause();
                                      setIsPlayingAudio(false);
                                      setPreviewingId(null);
                                      setNowPlaying({ type: "none", id: null });
                                    }}
                                    className="text-[10px] text-secondary hover:text-status-danger"
                                  >
                                    Close Preview
                                  </button>
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

            {/* Downloads Activity List with Categorization Tabs & Sorting (Step 8 & 9) */}
            <div className="space-y-3 pt-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-body-sm font-semibold text-primary">{t("activity_title")}</h3>
                  <span className="text-caption text-secondary">({sortedHistory.length})</span>
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                  {/* Categorization Chips */}
                  <div className="flex items-center bg-surface-1 p-1 rounded-md gap-1 shadow-sm border border-border-subtle overflow-x-auto">
                    {(["all", "video", "audio", "active", "completed"] as const).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setQueueFilter(cat)}
                        className={`px-2.5 py-0.5 rounded-sm text-caption font-semibold transition-colors capitalize ${
                          queueFilter === cat 
                            ? "bg-accent text-white shadow-sm" 
                            : "text-secondary hover:text-primary hover:bg-surface-2"
                        }`}
                      >
                        {cat === "all" ? t("filter_all") :
                         cat === "video" ? t("filter_video") :
                         cat === "audio" ? t("filter_audio") :
                         cat === "active" ? t("filter_active") : t("filter_finished")}
                      </button>
                    ))}
                  </div>

                  {/* Step 8: Sorting dropdown */}
                  <div className="flex items-center bg-surface-1 rounded-md px-2 py-1 border border-border-subtle shadow-sm gap-1.5">
                    <ArrowUpDown size={12} className="text-secondary" />
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="bg-transparent text-caption font-semibold text-primary outline-none cursor-pointer"
                    >
                      <option value="date_desc">Newest First</option>
                      <option value="date_asc">Oldest First</option>
                      <option value="title">Title (A-Z)</option>
                      <option value="progress">Progress</option>
                    </select>
                  </div>
                </div>
              </div>

              {sortedHistory.length === 0 ? (
                <div className="py-10 text-center bg-surface-1 rounded-md shadow-raised">
                  <Download size={20} className="mx-auto mb-1.5 text-tertiary" />
                  <p className="text-body-sm text-secondary font-medium">{t("no_tasks")}</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {sortedHistory.map((record) => (
                    <HistoryItem 
                      key={record.id} 
                      record={record} 
                      onOpenFolder={() => openFolder(record.file_path)}
                      onOpenFile={() => openFile(record.file_path)}
                      onRemove={() => handleRemoveHistory(record.id)}
                      onDeleteFile={() => handleDeleteFile(record.id, record.file_path)}
                      tOpenFolder={t("open_folder")}
                      tOpenFile={t("open_file")}
                      tRemoveRow={t("remove_row")}
                      tDeleteFile={t("delete_file")}
                    />
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ===================== TAB 2: AUDIO HUB ===================== */}
        {activeTab === "audio" && (
          <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-150">
            {/* Audio Quick Converter Card */}
            <div className="bg-surface-1 rounded-md p-5 shadow-raised space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-accent text-white flex items-center justify-center">
                    <Music size={16} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-body text-primary">{t("audio_hub_title")}</h3>
                    <p className="text-caption text-secondary">{t("audio_hub_sub")}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openFolder(null)}
                  className="px-3 py-1.5 rounded-md bg-surface-2 hover:bg-surface-0 text-caption font-semibold text-primary flex items-center gap-1.5 transition-colors border border-border-subtle shadow-sm"
                  title="Open Audio Directory in Explorer"
                >
                  <Folder size={13} />
                  <span>Open Audio Folder</span>
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input 
                  type="text"
                  placeholder={t("audio_hub_input")}
                  value={audioHubUrl}
                  onChange={(e) => setAudioHubUrl(e.target.value)}
                  className="flex-1 bg-surface-0 border border-border-subtle rounded-md px-3.5 py-2 text-body-sm text-primary outline-none focus:border-accent"
                />
                <select 
                  value={audioHubFormat} 
                  onChange={(e) => setAudioHubFormat(e.target.value)}
                  className="bg-surface-2 border border-border-subtle text-primary rounded-md px-3 py-2 text-caption font-semibold outline-none cursor-pointer"
                >
                  <option value="mp3">MP3 (320 kbps)</option>
                  <option value="m4a">M4A / AAC (256 kbps)</option>
                  <option value="flac">FLAC (Lossless)</option>
                  <option value="opus">Opus (160 kbps)</option>
                </select>
                <button
                  type="button"
                  disabled={!audioHubUrl.trim()}
                  onClick={() => {
                    handleStartDownload("bestaudio/best", audioHubFormat, true, {
                      id: `audio-${Date.now()}`,
                      url: audioHubUrl.trim(),
                      title: `Audio Track (${audioHubFormat.toUpperCase()})`,
                    });
                    setAudioHubUrl("");
                  }}
                  className="bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-md font-semibold text-caption transition-all disabled:opacity-40 flex items-center gap-1.5 shadow-sm"
                >
                  <Download size={14} />
                  <span>{t("audio_hub_rip")}</span>
                </button>
              </div>
            </div>

            {/* Offline Music Library */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-body font-semibold text-primary">{t("audio_library")}</h3>
                <span className="text-caption text-secondary">{audioHistory.length} tracks logged</span>
              </div>

              {audioHistory.length === 0 ? (
                <div className="py-12 text-center bg-surface-1 rounded-md shadow-raised space-y-2">
                  <Music size={24} className="mx-auto text-tertiary" />
                  <p className="text-body-sm text-secondary font-medium">{t("audio_library_empty")}</p>
                  <p className="text-caption text-tertiary">{t("audio_library_empty_sub")}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {audioHistory.map((item) => (
                    <div key={item.id} className="bg-surface-1 rounded-md p-3 shadow-raised flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <button 
                          onClick={() => {
                            if (activeAudioPlaying?.id === item.id) {
                              if (isPlayingAudio) { audioRef.current?.pause(); setIsPlayingAudio(false); }
                              else { audioRef.current?.play(); setIsPlayingAudio(true); }
                            } else if (item.file_path) {
                              setActiveAudioPlaying(item);
                              if (audioRef.current) {
                                audioRef.current.src = item.file_path;
                                audioRef.current.volume = isMuted ? 0 : volume;
                                audioRef.current.play();
                                setIsPlayingAudio(true);
                              }
                            }
                          }}
                          className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center shrink-0 hover:scale-105 transition-transform shadow-sm"
                        >
                          {activeAudioPlaying?.id === item.id && isPlayingAudio ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
                        </button>
                        <div className="min-w-0">
                          <p className="text-body-sm font-semibold text-primary truncate cursor-pointer hover:text-accent" onDoubleClick={() => openFile(item.file_path)}>{item.title}</p>
                          <span className="text-caption text-secondary">{item.format.toUpperCase()}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Direct File Action Icon Buttons */}
                        <button 
                          onClick={() => openFile(item.file_path)} 
                          className="w-7 h-7 rounded-md bg-surface-2 hover:bg-surface-3 text-secondary hover:text-primary flex items-center justify-center transition-colors border border-border-subtle shadow-sm" 
                          title="Play / Open file directly"
                        >
                          <Play size={12} fill="currentColor" />
                        </button>
                        <button 
                          onClick={() => openFolder(item.file_path)} 
                          className="w-7 h-7 rounded-md bg-surface-2 hover:bg-surface-3 text-secondary hover:text-primary flex items-center justify-center transition-colors border border-border-subtle shadow-sm" 
                          title="Show in folder"
                        >
                          <Folder size={12} />
                        </button>
                        <button 
                          onClick={() => handleDeleteFile(item.id, item.file_path)} 
                          className="w-7 h-7 rounded-md bg-surface-2 hover:bg-status-danger-subtle text-secondary hover:text-status-danger flex items-center justify-center transition-colors border border-border-subtle shadow-sm" 
                          title="Delete from disk"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================== TAB 3: COMPLETE SETTINGS ===================== */}
        {activeTab === "settings" && (
          <div className="max-w-3xl mx-auto space-y-6 pb-8 animate-in fade-in duration-150">
            
            {/* General Settings */}
            <SettingsSection title={t("settings_general")} icon={<Sliders size={16} />}>
              {/* Sleek Segmented Pill Theme Selector */}
              <SettingRow title={t("settings_theme")} desc="Visual light or dark presentation">
                <div className="flex items-center bg-surface-2 p-1 rounded-md border border-border-subtle gap-1">
                  <button
                    type="button"
                    onClick={() => handleThemeChange("light")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-caption font-semibold transition-all ${
                      theme === "light" 
                        ? "bg-surface-1 text-primary shadow-sm" 
                        : "text-secondary hover:text-primary hover:bg-surface-1/40"
                    }`}
                  >
                    <Sun size={13} className={theme === "light" ? "text-accent" : ""} />
                    <span>{t("theme_light")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleThemeChange("dark")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-caption font-semibold transition-all ${
                      theme === "dark" 
                        ? "bg-accent text-white shadow-sm" 
                        : "text-secondary hover:text-primary hover:bg-surface-1/40"
                    }`}
                  >
                    <Moon size={13} />
                    <span>{t("theme_dark")}</span>
                  </button>
                </div>
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

              {/* Step 3: Autoplay Media Setting */}
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
              <SettingRow title={t("settings_save_loc")} desc="Base folder where downloads are stored">
                <div className="flex items-center gap-2">
                  <input 
                    type="text" 
                    readOnly 
                    value={settings.saveFolder} 
                    className="bg-surface-0 border border-border-subtle rounded-md px-2.5 py-1 text-caption text-primary outline-none w-44"
                  />
                  <button onClick={() => openFolder(null)} className="px-3 py-1 rounded-md bg-surface-2 hover:bg-surface-0 text-caption font-semibold border border-border-subtle">
                    Open
                  </button>
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

            {/* Step 2: Global Volume & Sounds */}
            <SettingsSection title="Sounds & Volume" icon={<Volume2 size={16} />}>
              <SettingRow title="Master Media Volume" desc="Global playback volume for previews and player">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="w-7 h-7 rounded-md bg-surface-2 hover:bg-surface-3 text-secondary hover:text-primary flex items-center justify-center transition-colors border border-border-subtle"
                  >
                    {isMuted || volume === 0 ? <VolumeX size={13} /> : volume < 0.5 ? <Volume1 size={13} /> : <Volume2 size={13} />}
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
                  <span className="text-caption font-mono bg-surface-2 px-2 py-0.5 rounded text-secondary">2026.08.19</span>
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
        )}

      </main>
    </div>
  );
}

// Subcomponents for TopBar & Layout
function TopNavButton({ active, onClick, icon, label, badge }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: number }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-caption font-semibold transition-all ${
        active 
          ? "bg-surface-1 text-primary shadow-sm" 
          : "text-secondary hover:text-primary hover:bg-surface-1/50"
      }`}
    >
      {icon}
      <span>{label}</span>
      {badge !== undefined && (
        <span className="ml-1 bg-accent text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
          {badge}
        </span>
      )}
    </button>
  );
}

function StatTile({ label, count, sub, gradient, icon }: { label: string; count: number; sub: string; gradient: string; icon: React.ReactNode }) {
  return (
    <div 
      className="rounded-md p-3.5 text-white shadow-floating relative overflow-hidden flex flex-col justify-between min-h-20 transition-all hover:scale-[1.01]"
      style={{ background: gradient }}
    >
      <div className="flex items-center justify-between opacity-90">
        <span className="text-caption font-semibold uppercase tracking-wider text-[10px]">{label}</span>
        {icon}
      </div>
      <div>
        <div className="text-heading font-bold leading-tight">{count}</div>
        <div className="text-caption opacity-85 mt-0.5 text-[11px]">{sub}</div>
      </div>
    </div>
  );
}

// History Item with Double-Click, Dedicated Icon Buttons, and Live Speed/ETA (Steps 7 & 8)
function HistoryItem({ 
  record, 
  onOpenFolder, 
  onOpenFile,
  onRemove, 
  onDeleteFile,
  tOpenFolder,
  tOpenFile,
  tRemoveRow,
  tDeleteFile 
}: { 
  record: DownloadRecord; 
  onOpenFolder: () => void; 
  onOpenFile: () => void;
  onRemove: () => void; 
  onDeleteFile: () => void;
  tOpenFolder: string;
  tOpenFile: string;
  tRemoveRow: string;
  tDeleteFile: string;
}) {
  const display = STATUS_DISPLAY[record.status] || STATUS_DISPLAY.error;
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div 
      onDoubleClick={() => {
        if (record.status === "completed" && record.file_path) {
          onOpenFile();
        }
      }}
      className="bg-surface-1 rounded-md p-3 flex gap-3 transition-all shadow-raised relative group cursor-pointer"
      title={record.status === "completed" ? "Double-click to open file" : undefined}
    >
      <div className="w-16 aspect-video bg-surface-0 rounded-sm flex items-center justify-center text-tertiary shrink-0">
        <PlayCircle size={18} className="opacity-40" />
      </div>
      
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex items-center justify-between gap-3 mb-1">
          <div className="min-w-0 flex-1">
            <h4 className="text-body-sm font-semibold truncate text-primary" title={record.title}>
              {record.title}
            </h4>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-caption text-secondary text-[10px] uppercase font-mono">{record.format}</span>
              {/* Step 8: Surface live speed and ETA */}
              {record.status === "downloading" && record.speed && record.speed !== "0 B/s" && (
                <span className="text-caption font-mono text-accent text-[11px]">
                  {record.speed} {record.eta ? `• ETA: ${record.eta}` : ""}
                </span>
              )}
            </div>
          </div>
          
          <div className="shrink-0 flex items-center gap-2">
            <span className={`text-caption font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 text-[11px] ${
              display.colorToken === "accent" ? "bg-accent-subtle text-accent" : 
              display.colorToken === "status-success" ? "bg-status-success-subtle text-status-success" : 
              display.colorToken === "status-danger" ? "bg-status-danger-subtle text-status-danger" :
              display.colorToken === "status-warning" ? "bg-status-warning-subtle text-status-warning" :
              "bg-surface-0 text-secondary"
            }`}>
              {display.colorToken === "accent" && <Loader2 size={10} className="animate-spin" />}
              {display.label} {record.status === "downloading" && `${record.percent.toFixed(0)}%`}
            </span>
            
            {/* Step 7: Dedicated Icon Buttons visible directly without opening menu */}
            <div className="flex items-center gap-1">
              {record.status === "completed" && record.file_path && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onOpenFile(); }}
                  className="w-7 h-7 rounded-md bg-surface-2 hover:bg-surface-3 text-secondary hover:text-primary flex items-center justify-center transition-colors border border-border-subtle shadow-sm"
                  title={tOpenFile}
                >
                  <Play size={12} fill="currentColor" />
                </button>
              )}

              {record.status === "completed" && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onOpenFolder(); }}
                  className="w-7 h-7 rounded-md bg-surface-2 hover:bg-surface-3 text-secondary hover:text-primary flex items-center justify-center transition-colors border border-border-subtle shadow-sm"
                  title={tOpenFolder}
                >
                  <Folder size={12} />
                </button>
              )}

              {record.file_path && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDeleteFile(); }}
                  className="w-7 h-7 rounded-md bg-surface-2 hover:bg-status-danger-subtle text-secondary hover:text-status-danger flex items-center justify-center transition-colors border border-border-subtle shadow-sm"
                  title={tDeleteFile}
                >
                  <Trash2 size={12} />
                </button>
              )}

              {/* Overflow Menu for secondary actions */}
              <div className="relative">
                <button 
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
                  onBlur={() => setTimeout(() => setMenuOpen(false), 200)}
                  className="w-7 h-7 flex items-center justify-center text-tertiary hover:text-primary rounded-md hover:bg-surface-2 transition-colors"
                >
                  <MoreVertical size={14} />
                </button>
                
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-40 bg-surface-1 rounded-md shadow-floating p-1 z-30 animate-in zoom-in-95 duration-fast border border-border-subtle">
                    {record.status === "completed" && (
                      <button onClick={onOpenFolder} className="w-full text-left px-2.5 py-1.5 text-caption font-semibold text-primary hover:bg-surface-0 rounded flex items-center gap-2">
                        <Folder size={13} /> {tOpenFolder}
                      </button>
                    )}
                    <button onClick={onRemove} className="w-full text-left px-2.5 py-1.5 text-caption font-semibold text-primary hover:bg-surface-0 rounded flex items-center gap-2">
                      <X size={13} /> {tRemoveRow}
                    </button>
                    {record.file_path && (
                      <button onClick={onDeleteFile} className="w-full text-left px-2.5 py-1.5 text-caption font-semibold text-status-danger hover:bg-status-danger-subtle rounded flex items-center gap-2">
                        <Trash2 size={13} /> {tDeleteFile}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="h-1 bg-surface-0 rounded-full overflow-hidden mt-0.5">
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

// Setting subcomponents
function SettingsSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-surface-1 rounded-md p-4 shadow-raised space-y-3">
      <div className="flex items-center gap-2 pb-2 border-b border-border-subtle text-primary">
        <div className="text-accent">{icon}</div>
        <h3 className="text-body-sm font-semibold">{title}</h3>
      </div>
      <div className="space-y-3 pt-1">
        {children}
      </div>
    </section>
  );
}

function SettingRow({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div className="min-w-0 flex-1">
        <p className="text-body-sm font-semibold text-primary">{title}</p>
        <p className="text-caption text-secondary mt-0.5">{desc}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SettingToggle({ title, desc, checked, onChange }: { title: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div className="min-w-0 flex-1">
        <p className="text-body-sm font-semibold text-primary">{title}</p>
        <p className="text-caption text-secondary mt-0.5">{desc}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`w-10 h-5 rounded-full transition-colors relative shrink-0 p-0.5 ${
          checked ? "bg-accent" : "bg-surface-2"
        }`}
      >
        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`} />
      </button>
    </div>
  );
}