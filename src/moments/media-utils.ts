import {
  IMAGE_MAX_BYTES,
  IMAGE_MAX_EDGE,
  IMAGE_OUTPUT_QUALITY,
  IMAGE_SKIP_COMPRESS_BYTES,
  THUMB_MAX_EDGE,
  THUMB_QUALITY,
  VIDEO_MAX_BYTES,
  classifyMime,
} from "./upload-config";

export type PreparedFile = {
  id: string;
  file: File;
  blob: Blob;
  thumb: Blob | null;
  previewUrl: string;
  type: "photo" | "video";
  duration: number | null;
  width: number | null;
  height: number | null;
};

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

async function drawScaled(source: CanvasImageSource, w: number, h: number, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function compressImage(file: File) {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
    const alreadySmall =
      file.size <= IMAGE_SKIP_COMPRESS_BYTES &&
      Math.max(bitmap.width, bitmap.height) <= IMAGE_MAX_EDGE &&
      (file.type === "image/jpeg" || file.type === "image/jpg" || file.type === "image/webp");

    const full = alreadySmall
      ? null
      : await drawScaled(bitmap, bitmap.width, bitmap.height, IMAGE_MAX_EDGE);
    const thumbCanvas = await drawScaled(bitmap, bitmap.width, bitmap.height, THUMB_MAX_EDGE);
    const blob = full ? await canvasToBlob(full, IMAGE_OUTPUT_QUALITY) : null;
    const thumb = thumbCanvas ? await canvasToBlob(thumbCanvas, THUMB_QUALITY) : null;
    const width = bitmap.width;
    const height = bitmap.height;
    const output =
      blob && blob.size > 0 && blob.size < file.size
        ? blob
        : alreadySmall || file.type === "image/jpeg" || file.type === "image/webp"
          ? file
          : blob ?? file;
    bitmap.close?.();
    return {
      blob: output,
      thumb,
      width,
      height,
    };
  } catch {
    return { blob: file, thumb: null, width: null, height: null };
  }
}

async function videoThumbnail(file: File) {
  return new Promise<{ thumb: Blob | null; duration: number | null; width: number | null; height: number | null }>(
    (resolve) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.preload = "auto";
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.autoplay = true;
      video.setAttribute("playsinline", "true");
      video.setAttribute("webkit-playsinline", "true");
      video.style.cssText = "position:fixed;left:-240px;top:0;width:160px;height:90px;opacity:0;pointer-events:none;";
      document.body.appendChild(video);
      let settled = false;
      const done = (
        thumb: Blob | null,
        duration: number | null,
        width: number | null = null,
        height: number | null = null,
      ) => {
        if (settled) return;
        settled = true;
        URL.revokeObjectURL(url);
        video.pause();
        video.removeAttribute("src");
        video.load();
        video.remove();
        resolve({ thumb, duration, width, height });
      };
      const snap = async () => {
        if (!video.videoWidth || !video.videoHeight) return false;
        const canvas = await drawScaled(video, video.videoWidth, video.videoHeight, THUMB_MAX_EDGE);
        const blob = canvas ? await canvasToBlob(canvas, THUMB_QUALITY) : null;
        if (!blob || blob.size < 32) return false;
        done(
          blob,
          Number.isFinite(video.duration) ? video.duration : null,
          video.videoWidth || null,
          video.videoHeight || null,
        );
        return true;
      };
      const seek = () => {
        try {
          video.currentTime = Math.min(0.4, (video.duration || 1) * 0.1);
        } catch {
          void snap();
        }
      };
      video.addEventListener("seeked", () => {
        void snap();
      });
      video.addEventListener("loadeddata", () => {
        void video
          .play()
          .then(() => {
            video.pause();
            return snap();
          })
          .then((ok) => {
            if (!ok) seek();
          })
          .catch(() => {
            seek();
          });
      });
      video.onerror = () => done(null, null);
      video.src = url;
      video.load();
      void video.play().catch(() => undefined);
      setTimeout(() => done(null, video.duration || null, video.videoWidth || null, video.videoHeight || null), 20000);
    },
  );
}

function mimeFromFile(file: File) {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "heic" || ext === "heif") return `image/${ext}`;
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "mp4") return "video/mp4";
  if (ext === "mov") return "video/quicktime";
  return "";
}

export async function prepareFile(file: File): Promise<PreparedFile | null> {
  const mime = mimeFromFile(file);
  const classified = classifyMime(mime);
  if (!classified) return null;
  if (classified.kind === "photo" && file.size > IMAGE_MAX_BYTES) return null;
  if (classified.kind === "video" && file.size > VIDEO_MAX_BYTES) return null;

  const id = crypto.randomUUID();
  if (classified.kind === "photo") {
    const { blob, thumb, width, height } = await compressImage(file);
    return {
      id,
      file,
      blob,
      thumb,
      previewUrl: URL.createObjectURL(thumb ?? blob),
      type: "photo",
      duration: null,
      width,
      height,
    };
  }
  const { thumb, duration, width, height } = await videoThumbnail(file);
  return {
    id,
    file,
    blob: file,
    thumb,
    previewUrl: URL.createObjectURL(thumb ?? file),
    type: "video",
    duration,
    width,
    height,
  };
}

export function formatBytes(bytes: number) {
  if (!bytes) return "0 MB";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value >= 10 || i < 2 ? 0 : 1)} ${units[i]}`;
}
