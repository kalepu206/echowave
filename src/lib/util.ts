export function timeAgo(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} day${d > 1 ? "s" : ""} ago`;
  return new Date(ts).toLocaleDateString();
}

export function formatDistance(km: number): string {
  if (km < 1) return "< 1 km away";
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km away`;
}

export function sentimentLabel(score: number): { label: string; icon: "smile" | "meh" | "frown"; cls: string } {
  if (score > 0.2) return { label: "Positive", icon: "smile", cls: "text-success" };
  if (score < -0.2) return { label: "Concerning", icon: "frown", cls: "text-danger" };
  return { label: "Neutral", icon: "meh", cls: "text-muted" };
}

/** Shrinks a photo in the browser so uploads are fast and under 2 MB. */
export async function compressImage(file: File, maxSide = 1600, quality = 0.82): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Could not read this image."));
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    let q = quality;
    for (;;) {
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", q));
      if (!blob) throw new Error("Could not process this image.");
      if (blob.size <= 1.9 * 1024 * 1024 || q <= 0.4) return blob;
      q -= 0.15;
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}
