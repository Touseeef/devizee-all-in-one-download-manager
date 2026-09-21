// src/lib/formatClassify.ts

export const isVideoFormat = (fmt: string): boolean => {
  if (!fmt) return true;
  const f = fmt.toLowerCase();
  if (f.startsWith("audio (") || f === "bestaudio/best" || f.includes("audio_only"))
    return false;
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

export const isAudioFormat = (fmt: string): boolean => {
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

export const formatDisplayBadge = (fmt: string): string => {
  if (!fmt) return "Media";
  const f = fmt.trim();

  if (!f.includes("[") && !f.includes("+") && !f.includes("/")) {
    return f;
  }

  const clipMatch = f.match(/(\[Clip [^\]]+\])/i);
  const clipSuffix = clipMatch ? ` ${clipMatch[1]}` : "";

  if (isAudioFormat(f)) {
    const extMatch =
      f.match(/\(([A-Z0-9]+)\)/i) ||
      f.match(/(mp3|m4a|flac|wav|opus|aac|ogg)/i);
    const ext = extMatch ? extMatch[1].toUpperCase() : "AUDIO";
    return `Audio (${ext})${clipSuffix}`;
  }

  if (f.includes("2160") || f.includes("4k")) return `4K (2160p)${clipSuffix}`;
  if (f.includes("1440") || f.includes("2k")) return `2K (1440p)${clipSuffix}`;
  if (f.includes("1080")) return `1080p Video${clipSuffix}`;
  if (f.includes("720")) return `720p Video${clipSuffix}`;
  if (f.includes("480")) return `480p Video${clipSuffix}`;
  if (f.includes("360")) return `360p Video${clipSuffix}`;

  const extMatch = f.match(/(mp4|mkv|webm|avi|mov)/i);
  if (extMatch) return `${extMatch[1].toUpperCase()} Video${clipSuffix}`;

  return `Video${clipSuffix}`;
};