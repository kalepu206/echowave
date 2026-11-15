export interface Env {
  DB: D1Database;
  IMAGES: R2Bucket;
  ASSETS: Fetcher;
  GEMINI_API_KEY: string;
  GEMINI_MODEL: string;
  FIREBASE_PROJECT_ID: string;
  ADMIN_UIDS: string;
  POST_TTL_HOURS: string;
  REPORT_HIDE_THRESHOLD: string;
  ANDROID_PACKAGE: string;
  ANDROID_SHA256: string;
}

export interface AuthInfo {
  uid: string;
  email?: string;
  emailVerified: boolean;
}

export interface UserRow {
  id: string;
  username: string;
  banned: number;
  created_at: number;
}

export interface PostRow {
  id: string;
  user_id: string;
  username: string;
  content: string;
  place: string | null;
  lat: number | null;
  lng: number | null;
  image_key: string | null;
  image_alt: string | null;
  sentiment: number;
  spam_score: number;
  topics: string;
  urgent: number;
  moderated: number;
  like_count: number;
  comment_count: number;
  report_count: number;
  status: string;
  created_at: number;
  expires_at: number;
  liked: number;
}

export type AppEnv = {
  Bindings: Env;
  Variables: { auth: AuthInfo | null; user: UserRow | null };
};
