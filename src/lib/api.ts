export interface Post {
  id: string;
  userId: string;
  username: string;
  content: string;
  place: string | null;
  hasLocation: boolean;
  distanceKm: number | null;
  imageUrl: string | null;
  imageAlt: string | null;
  sentiment: number;
  topics: string[];
  urgent: boolean;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  isMine: boolean;
  status: string;
  createdAt: number;
  expiresAt: number;
  reportCount?: number;
  moderated?: boolean;
}

export interface Comment {
  id: string;
  content: string;
  createdAt: number;
  userId: string;
  username: string;
  isMine: boolean;
}

export interface Notification {
  id: string;
  type: "like" | "comment" | "removed";
  postId: string | null;
  read: boolean;
  createdAt: number;
  actor: string | null;
  snippet: string | null;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { ...init, headers, credentials: "same-origin" });
  } catch {
    throw new ApiError("You seem to be offline. Check your connection and try again.", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? "Something went wrong.", res.status, data.code);
  return data as T;
}

export function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== "" && v !== false) s.set(k, String(v === true ? 1 : v));
  }
  const out = s.toString();
  return out ? `?${out}` : "";
}
