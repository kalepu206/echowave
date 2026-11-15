import { createRemoteJWKSet, jwtVerify } from "jose";
import type { AuthInfo, Env } from "./types";

/**
 * Sign-in with Google, handled entirely by this Worker (no Firebase).
 *
 * Flow: /api/auth/google/start -> Google consent screen -> /api/auth/google/callback
 * The callback checks Google's signed ID token, then stores a random session id (hashed) in D1
 * and gives the browser an HttpOnly cookie. JavaScript can never read that cookie.
 */

const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
export const SESSION_COOKIE = "ew_session";
const STATE_COOKIE = "ew_oauth";
const SESSION_DAYS = 60;

// ---------- small helpers ----------

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomToken(bytes = 32): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

async function sha256(text: string): Promise<string> {
  return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))));
}

export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > -1 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

function cookie(name: string, value: string, maxAgeSec: number, secure: boolean): string {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure ? "; Secure" : ""}`;
}

/** The one address Google sends people back to (avoids www / non-www mix-ups). */
export function appOrigin(env: Env, req: Request): string {
  return (env.APP_ORIGIN || new URL(req.url).origin).replace(/\/$/, "");
}

function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/api/") ? next : "/";
}

function redirect(location: string, cookies: string[] = []): Response {
  const headers = new Headers({ location, "cache-control": "no-store" });
  for (const c of cookies) headers.append("set-cookie", c);
  return new Response(null, { status: 302, headers });
}

// ---------- Google sign-in ----------

export async function startGoogleLogin(req: Request, env: Env): Promise<Response> {
  const origin = appOrigin(env, req);
  const url = new URL(req.url);
  // Always start on the main domain so the cookie lands there
  if (url.origin !== origin) return redirect(`${origin}${url.pathname}${url.search}`);
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return redirect(`${origin}/login?error=not_configured`);

  const state = randomToken(16);
  const verifier = randomToken(32);
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  const next = safeNext(url.searchParams.get("next"));

  const google = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  google.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: `${origin}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();

  const secure = origin.startsWith("https://");
  return redirect(google.toString(), [cookie(STATE_COOKIE, `${state}|${verifier}|${next}`, 600, secure)]);
}

export async function finishGoogleLogin(req: Request, env: Env): Promise<Response> {
  const origin = appOrigin(env, req);
  const secure = origin.startsWith("https://");
  const clearState = cookie(STATE_COOKIE, "", 0, secure);
  const url = new URL(req.url);
  const fail = (code: string) => redirect(`${origin}/login?error=${code}`, [clearState]);

  if (url.searchParams.get("error")) return fail("cancelled");
  const saved = readCookie(req, STATE_COOKIE);
  const [state, verifier, next] = (saved ?? "").split("|");
  if (!saved || !state || state !== url.searchParams.get("state")) return fail("expired");
  const code = url.searchParams.get("code");
  if (!code) return fail("cancelled");

  // Exchange the one-time code for Google's signed ID token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${origin}/api/auth/google/callback`,
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  if (!tokenRes.ok) {
    console.error("google token exchange failed", tokenRes.status, (await tokenRes.text()).slice(0, 300));
    return fail("google");
  }
  const { id_token } = (await tokenRes.json()) as { id_token?: string };
  if (!id_token) return fail("google");

  let claims: { sub?: string; email?: unknown; email_verified?: unknown; name?: unknown };
  try {
    ({ payload: claims } = await jwtVerify(id_token, GOOGLE_JWKS, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: env.GOOGLE_CLIENT_ID,
    }));
  } catch (e) {
    console.error("bad google id token", (e as Error).message);
    return fail("google");
  }
  if (!claims.sub) return fail("google");
  if (claims.email_verified !== true) return fail("unverified");

  const userId = `google:${claims.sub}`;
  const email = typeof claims.email === "string" ? claims.email : null;
  const name = typeof claims.name === "string" ? claims.name.slice(0, 80) : null;
  const token = randomToken(32);
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO identities (user_id, provider, email, name, created_at, last_login_at) VALUES (?, 'google', ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET email = excluded.email, name = excluded.name, last_login_at = excluded.last_login_at`,
    ).bind(userId, email, name, now, now),
    env.DB.prepare("INSERT INTO sessions (id_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
      .bind(await sha256(token), userId, now, now + SESSION_DAYS * 86400_000),
    env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(now),
  ]);

  return redirect(`${origin}${safeNext(next)}`, [clearState, cookie(SESSION_COOKIE, token, SESSION_DAYS * 86400, secure)]);
}

// ---------- sessions ----------

export async function readSession(req: Request, env: Env): Promise<AuthInfo | null> {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) return null;
  const row = await env.DB.prepare(
    `SELECT s.user_id, i.email, i.name FROM sessions s LEFT JOIN identities i ON i.user_id = s.user_id
     WHERE s.id_hash = ? AND s.expires_at > ?`,
  ).bind(await sha256(token), Date.now()).first<{ user_id: string; email: string | null; name: string | null }>();
  if (!row) return null;
  return { uid: row.user_id, email: row.email ?? undefined, name: row.name ?? undefined };
}

export async function endSession(req: Request, env: Env): Promise<string> {
  const token = readCookie(req, SESSION_COOKIE);
  if (token) await env.DB.prepare("DELETE FROM sessions WHERE id_hash = ?").bind(await sha256(token)).run();
  return cookie(SESSION_COOKIE, "", 0, appOrigin(env, req).startsWith("https://"));
}
