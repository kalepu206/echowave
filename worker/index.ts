import { Hono, type Context } from "hono";
import { verifyFirebaseToken } from "./auth";
import { moderate, heuristicCheck, summarizeTrending, arrayBufferToBase64 } from "./ai";
import type { AppEnv, Env, PostRow, UserRow } from "./types";

const CONTENT_LIMIT = 280;
const COMMENT_LIMIT = 200;
const PLACE_LIMIT = 40;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const POSTS_PER_HOUR = 5;
const COMMENTS_PER_HOUR = 30;
const REPORTS_PER_DAY = 20;
const PAGE_SIZE = 30;
const HOUR = 3600_000;

const api = new Hono<AppEnv>();

// ---------- helpers ----------

type C = Context<AppEnv>;

const now = () => Date.now();
const uid = () => crypto.randomUUID();

function fail(c: C, status: 400 | 401 | 403 | 404 | 409 | 413 | 429 | 500, error: string, extra: Record<string, unknown> = {}) {
  return c.json({ error, ...extra }, status);
}

function isAdmin(env: Env, id: string | undefined): boolean {
  if (!id) return false;
  return (env.ADMIN_UIDS || "").split(",").map((s) => s.trim()).filter(Boolean).includes(id);
}

/** Round to ~1 km so exact home locations are never stored. */
function roundCoord(n: number): number {
  return Math.round(n * 100) / 100;
}

function parseCoord(v: unknown, min: number, max: number): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function cleanText(s: unknown, max: number): string {
  if (typeof s !== "string") return "";
  // strip control characters except newlines, collapse 3+ newlines
  return s.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
}

function toPost(r: PostRow, viewer: { uid?: string; lat?: number | null; lng?: number | null }) {
  let distance: number | null = null;
  if (viewer.lat != null && viewer.lng != null && r.lat != null && r.lng != null) {
    distance = Math.round(distanceKm(viewer.lat, viewer.lng, r.lat, r.lng) * 10) / 10;
  }
  let topics: string[] = [];
  try {
    topics = JSON.parse(r.topics);
  } catch {
    /* ignore */
  }
  return {
    id: r.id,
    userId: r.user_id,
    username: r.username,
    content: r.content,
    place: r.place,
    hasLocation: r.lat != null,
    distanceKm: distance,
    imageUrl: r.image_key ? `/api/img/${r.image_key}` : null,
    imageAlt: r.image_alt,
    sentiment: r.sentiment,
    topics,
    urgent: !!r.urgent,
    likeCount: r.like_count,
    commentCount: r.comment_count,
    likedByMe: !!r.liked,
    isMine: viewer.uid === r.user_id,
    status: r.status,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
  };
}

const POST_SELECT = `
  SELECT p.*, u.username,
         EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = ?) AS liked
  FROM posts p JOIN users u ON u.id = p.user_id`;

/** Requires a signed-in user who has picked a username and is not banned. */
function requireUser(c: C): UserRow | Response {
  const auth = c.get("auth");
  if (!auth) return fail(c, 401, "Please sign in first.");
  const user = c.get("user");
  if (!user) return fail(c, 403, "Please choose a username first.", { code: "needs_username" });
  if (user.banned) return fail(c, 403, "Your account has been suspended for breaking the community guidelines.");
  return user;
}

async function notify(env: Env, to: string, type: string, postId: string | null, actor: string | null) {
  if (actor && to === actor) return;
  await env.DB.prepare(
    "INSERT INTO notifications (id, user_id, type, post_id, actor_id, read, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)",
  ).bind(uid(), to, type, postId, actor, now()).run();
}

// ---------- auth middleware ----------

api.use("*", async (c, next) => {
  c.set("auth", null);
  c.set("user", null);
  const header = c.req.header("authorization");
  if (header?.startsWith("Bearer ")) {
    try {
      const auth = await verifyFirebaseToken(header.slice(7), c.env.FIREBASE_PROJECT_ID);
      c.set("auth", auth);
      const user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(auth.uid).first<UserRow>();
      c.set("user", user ?? null);
    } catch (e) {
      console.warn("invalid token", (e as Error).message);
      return fail(c, 401, "Your session has expired. Please sign in again.");
    }
  }
  await next();
});

api.get("/health", (c) => c.json({ ok: true, time: now() }));

// ---------- account ----------

api.get("/me", (c) => {
  const auth = c.get("auth");
  if (!auth) return c.json({ signedIn: false });
  const user = c.get("user");
  return c.json({
    signedIn: true,
    uid: auth.uid,
    username: user?.username ?? null,
    banned: !!user?.banned,
    emailVerified: auth.emailVerified,
    isAdmin: isAdmin(c.env, auth.uid),
  });
});

api.post("/me", async (c) => {
  const auth = c.get("auth");
  if (!auth) return fail(c, 401, "Please sign in first.");
  const body = await c.req.json<{ username?: string }>().catch(() => ({}) as { username?: string });
  const username = (body.username ?? "").trim();
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username))
    return fail(c, 400, "Usernames are 3-20 characters: letters, numbers and _ only.");
  if (/^(admin|echowave|moderator|support|official)/i.test(username) && !isAdmin(c.env, auth.uid))
    return fail(c, 400, "That username is reserved.");
  const taken = await c.env.DB.prepare("SELECT id FROM users WHERE username = ? COLLATE NOCASE")
    .bind(username).first<{ id: string }>();
  if (taken && taken.id !== auth.uid) return fail(c, 409, "That username is taken.");
  await c.env.DB.prepare(
    `INSERT INTO users (id, username, banned, created_at) VALUES (?, ?, 0, ?)
     ON CONFLICT(id) DO UPDATE SET username = excluded.username`,
  ).bind(auth.uid, username, now()).run();
  return c.json({ ok: true, username });
});

/** Deletes everything the user created. The app then deletes the Firebase login itself. */
api.delete("/me", async (c) => {
  const auth = c.get("auth");
  if (!auth) return fail(c, 401, "Please sign in first.");
  const me = auth.uid;
  const db = c.env.DB;

  const images = await db.prepare("SELECT image_key FROM posts WHERE user_id = ? AND image_key IS NOT NULL")
    .bind(me).all<{ image_key: string }>();
  const keys = images.results.map((r) => r.image_key);
  for (let i = 0; i < keys.length; i += 500) await c.env.IMAGES.delete(keys.slice(i, i + 500));

  const myPosts = "SELECT id FROM posts WHERE user_id = ?";
  await db.batch([
    // fix counters on other people's posts
    db.prepare("UPDATE posts SET like_count = MAX(like_count - 1, 0) WHERE id IN (SELECT post_id FROM likes WHERE user_id = ?)").bind(me),
    db.prepare(
      `UPDATE posts SET comment_count = MAX(comment_count -
         (SELECT COUNT(*) FROM comments c WHERE c.post_id = posts.id AND c.user_id = ? AND c.status = 'live'), 0)
       WHERE id IN (SELECT post_id FROM comments WHERE user_id = ?)`,
    ).bind(me, me),
    // things attached to my posts
    db.prepare(`DELETE FROM likes WHERE post_id IN (${myPosts})`).bind(me),
    db.prepare(`DELETE FROM comments WHERE post_id IN (${myPosts})`).bind(me),
    db.prepare(`DELETE FROM reports WHERE post_id IN (${myPosts})`).bind(me),
    db.prepare(`DELETE FROM notifications WHERE post_id IN (${myPosts})`).bind(me),
    // my own activity
    db.prepare("DELETE FROM likes WHERE user_id = ?").bind(me),
    db.prepare("DELETE FROM comments WHERE user_id = ?").bind(me),
    db.prepare("DELETE FROM reports WHERE user_id = ?").bind(me),
    db.prepare("DELETE FROM blocks WHERE user_id = ? OR blocked_id = ?").bind(me, me),
    db.prepare("DELETE FROM notifications WHERE user_id = ? OR actor_id = ?").bind(me, me),
    db.prepare("DELETE FROM posts WHERE user_id = ?").bind(me),
    db.prepare("DELETE FROM users WHERE id = ?").bind(me),
  ]);
  return c.json({ ok: true });
});

// ---------- posts ----------

api.get("/posts", async (c) => {
  const auth = c.get("auth");
  const viewer = auth?.uid ?? "";
  const q = c.req.query();
  const lat = parseCoord(q.lat, -90, 90);
  const lng = parseCoord(q.lng, -180, 180);
  const radius = Math.min(Math.max(Number(q.radius) || 10, 1), 200);
  const before = Number(q.before) || null;
  const search = cleanText(q.q, 60);
  const mine = q.user === "me" && !!auth;

  const where: string[] = [];
  const params: unknown[] = [viewer];

  if (mine) {
    where.push("p.user_id = ?", "p.status != 'removed'");
    params.push(viewer);
  } else {
    where.push("p.status = 'live'", "p.expires_at > ?");
    params.push(now());
    if (viewer) {
      where.push("p.user_id NOT IN (SELECT blocked_id FROM blocks WHERE user_id = ?)");
      params.push(viewer);
    }
  }
  const near = !mine && lat != null && lng != null && q.near === "1";
  if (near) {
    const dLat = radius / 111;
    const dLng = radius / (111 * Math.max(Math.cos((lat! * Math.PI) / 180), 0.01));
    where.push("p.lat BETWEEN ? AND ?", "p.lng BETWEEN ? AND ?");
    params.push(lat! - dLat, lat! + dLat, lng! - dLng, lng! + dLng);
  }
  if (search) {
    const like = `%${search.replace(/[%_]/g, "")}%`;
    where.push("(p.content LIKE ? OR p.topics LIKE ? OR p.place LIKE ? OR u.username LIKE ?)");
    params.push(like, like, like, like);
  }
  if (before) {
    where.push("p.created_at < ?");
    params.push(before);
  }
  params.push(PAGE_SIZE);

  const res = await c.env.DB.prepare(`${POST_SELECT} WHERE ${where.join(" AND ")} ORDER BY p.created_at DESC LIMIT ?`)
    .bind(...params).all<PostRow>();
  let posts = res.results.map((r) => toPost(r, { uid: viewer, lat, lng }));
  if (near) posts = posts.filter((p) => p.distanceKm == null || p.distanceKm <= radius);
  return c.json({
    posts,
    nextBefore: res.results.length === PAGE_SIZE ? res.results[res.results.length - 1].created_at : null,
  });
});

api.get("/posts/:id", async (c) => {
  const viewer = c.get("auth")?.uid ?? "";
  const row = await c.env.DB.prepare(`${POST_SELECT} WHERE p.id = ?`).bind(viewer, c.req.param("id")).first<PostRow>();
  if (!row || (row.status !== "live" && row.user_id !== viewer && !isAdmin(c.env, viewer)))
    return fail(c, 404, "This broadcast is no longer available.");
  const q = c.req.query();
  return c.json({ post: toPost(row, { uid: viewer, lat: parseCoord(q.lat, -90, 90), lng: parseCoord(q.lng, -180, 180) }) });
});

api.post("/posts", async (c) => {
  const user = requireUser(c);
  if (user instanceof Response) return user;
  const auth = c.get("auth")!;
  if (!auth.emailVerified) return fail(c, 403, "Please verify your email address before broadcasting.", { code: "verify_email" });

  const db = c.env.DB;
  const recent = await db.prepare("SELECT COUNT(*) AS n FROM posts WHERE user_id = ? AND created_at > ?")
    .bind(user.id, now() - HOUR).first<{ n: number }>();
  if ((recent?.n ?? 0) >= POSTS_PER_HOUR)
    return fail(c, 429, `You can broadcast up to ${POSTS_PER_HOUR} times an hour. Please try again a bit later.`);

  const form = await c.req.formData().catch(() => null);
  if (!form) return fail(c, 400, "Invalid request.");
  const content = cleanText(form.get("content"), CONTENT_LIMIT + 1);
  if (content.length > CONTENT_LIMIT) return fail(c, 400, `Broadcasts are limited to ${CONTENT_LIMIT} characters.`);
  const place = cleanText(form.get("place"), PLACE_LIMIT) || null;
  const latRaw = parseCoord(form.get("lat"), -90, 90);
  const lngRaw = parseCoord(form.get("lng"), -180, 180);
  const hasLoc = latRaw != null && lngRaw != null;
  const image = form.get("image");
  const file = image && typeof image !== "string" ? (image as File) : null;

  if (!content && !file) return fail(c, 400, "Write something or attach a photo.");

  let imageBuf: ArrayBuffer | null = null;
  let imageType = "";
  if (file) {
    imageType = file.type;
    if (!["image/jpeg", "image/png", "image/webp"].includes(imageType))
      return fail(c, 400, "Photos must be JPEG, PNG or WebP.");
    if (file.size > MAX_IMAGE_BYTES) return fail(c, 413, "Photos must be under 2 MB.");
    imageBuf = await file.arrayBuffer();
  }

  // duplicate check
  if (content) {
    const dup = await db.prepare("SELECT 1 FROM posts WHERE user_id = ? AND content = ? AND created_at > ?")
      .bind(user.id, content, now() - 24 * HOUR).first();
    if (dup) return fail(c, 409, "You already broadcast this message today.");
  }

  const pre = content ? heuristicCheck(content) : null;
  if (pre) return fail(c, 400, pre.message, { code: "rejected", reason: pre.reason });

  const mod = await moderate(
    c.env,
    content,
    imageBuf ? { mimeType: imageType, base64: arrayBufferToBase64(imageBuf) } : undefined,
  );
  if (!mod.allowed) return fail(c, 400, mod.message, { code: "rejected", reason: mod.reason });

  const urgentRequested = form.get("urgent") === "1";
  const id = uid();
  let imageKey: string | null = null;
  if (imageBuf) {
    const ext = imageType === "image/png" ? "png" : imageType === "image/webp" ? "webp" : "jpg";
    imageKey = `${id}.${ext}`;
    await c.env.IMAGES.put(imageKey, imageBuf, { httpMetadata: { contentType: imageType } });
  }
  const created = now();
  const ttl = Math.min(Math.max(Number(c.env.POST_TTL_HOURS) || 48, 1), 24 * 30);
  await db.prepare(
    `INSERT INTO posts (id, user_id, content, place, lat, lng, image_key, image_alt, sentiment, spam_score, topics,
                        urgent, moderated, like_count, comment_count, report_count, status, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 'live', ?, ?)`,
  ).bind(
    id, user.id, content, place,
    hasLoc ? roundCoord(latRaw!) : null, hasLoc ? roundCoord(lngRaw!) : null,
    imageKey, mod.imageDescription, mod.sentiment, mod.spam, JSON.stringify(mod.topics),
    // urgent only if the user asked AND the AI agrees (or AI is down)
    urgentRequested && (mod.urgent || !mod.aiChecked) ? 1 : 0,
    mod.aiChecked ? 1 : 0, created, created + ttl * HOUR,
  ).run();

  const row = await db.prepare(`${POST_SELECT} WHERE p.id = ?`).bind(user.id, id).first<PostRow>();
  return c.json({ post: toPost(row!, { uid: user.id }) }, 201);
});

api.delete("/posts/:id", async (c) => {
  const auth = c.get("auth");
  if (!auth) return fail(c, 401, "Please sign in first.");
  const id = c.req.param("id");
  const post = await c.env.DB.prepare("SELECT user_id, image_key FROM posts WHERE id = ?").bind(id)
    .first<{ user_id: string; image_key: string | null }>();
  if (!post) return fail(c, 404, "Not found.");
  if (post.user_id !== auth.uid && !isAdmin(c.env, auth.uid)) return fail(c, 403, "You can only delete your own broadcasts.");
  await deletePosts(c.env, [id], post.image_key ? [post.image_key] : []);
  return c.json({ ok: true });
});

async function deletePosts(env: Env, ids: string[], imageKeys: string[]) {
  if (!ids.length) return;
  if (imageKeys.length) await env.IMAGES.delete(imageKeys);
  const db = env.DB;
  const stmts: D1PreparedStatement[] = [];
  for (const id of ids) {
    stmts.push(
      db.prepare("DELETE FROM likes WHERE post_id = ?").bind(id),
      db.prepare("DELETE FROM comments WHERE post_id = ?").bind(id),
      db.prepare("DELETE FROM reports WHERE post_id = ?").bind(id),
      db.prepare("DELETE FROM notifications WHERE post_id = ?").bind(id),
      db.prepare("DELETE FROM posts WHERE id = ?").bind(id),
    );
  }
  for (let i = 0; i < stmts.length; i += 100) await db.batch(stmts.slice(i, i + 100));
}

api.post("/posts/:id/like", async (c) => {
  const user = requireUser(c);
  if (user instanceof Response) return user;
  const id = c.req.param("id");
  const db = c.env.DB;
  const post = await db.prepare("SELECT user_id FROM posts WHERE id = ? AND status = 'live'").bind(id).first<{ user_id: string }>();
  if (!post) return fail(c, 404, "This broadcast is no longer available.");
  const existing = await db.prepare("SELECT 1 FROM likes WHERE post_id = ? AND user_id = ?").bind(id, user.id).first();
  const recount = db.prepare("UPDATE posts SET like_count = (SELECT COUNT(*) FROM likes WHERE post_id = ?) WHERE id = ?").bind(id, id);
  if (existing) {
    await db.batch([db.prepare("DELETE FROM likes WHERE post_id = ? AND user_id = ?").bind(id, user.id), recount]);
  } else {
    await db.batch([db.prepare("INSERT OR IGNORE INTO likes (post_id, user_id, created_at) VALUES (?, ?, ?)").bind(id, user.id, now()), recount]);
    await notify(c.env, post.user_id, "like", id, user.id);
  }
  const row = await db.prepare("SELECT like_count FROM posts WHERE id = ?").bind(id).first<{ like_count: number }>();
  return c.json({ liked: !existing, likeCount: row?.like_count ?? 0 });
});

// ---------- comments ----------

api.get("/posts/:id/comments", async (c) => {
  const viewer = c.get("auth")?.uid ?? "";
  const res = await c.env.DB.prepare(
    `SELECT c.id, c.content, c.created_at, c.user_id, u.username FROM comments c JOIN users u ON u.id = c.user_id
     WHERE c.post_id = ? AND c.status = 'live'
       AND c.user_id NOT IN (SELECT blocked_id FROM blocks WHERE user_id = ?)
     ORDER BY c.created_at ASC LIMIT 200`,
  ).bind(c.req.param("id"), viewer).all<{ id: string; content: string; created_at: number; user_id: string; username: string }>();
  return c.json({
    comments: res.results.map((r) => ({
      id: r.id, content: r.content, createdAt: r.created_at, userId: r.user_id, username: r.username, isMine: r.user_id === viewer,
    })),
  });
});

api.post("/posts/:id/comments", async (c) => {
  const user = requireUser(c);
  if (user instanceof Response) return user;
  if (!c.get("auth")!.emailVerified) return fail(c, 403, "Please verify your email address first.", { code: "verify_email" });
  const id = c.req.param("id");
  const db = c.env.DB;
  const post = await db.prepare("SELECT user_id FROM posts WHERE id = ? AND status = 'live'").bind(id).first<{ user_id: string }>();
  if (!post) return fail(c, 404, "This broadcast is no longer available.");
  const recent = await db.prepare("SELECT COUNT(*) AS n FROM comments WHERE user_id = ? AND created_at > ?")
    .bind(user.id, now() - HOUR).first<{ n: number }>();
  if ((recent?.n ?? 0) >= COMMENTS_PER_HOUR) return fail(c, 429, "You're commenting too fast. Please slow down.");
  const body = await c.req.json<{ content?: string }>().catch(() => ({}) as { content?: string });
  const content = cleanText(body.content, COMMENT_LIMIT);
  if (!content) return fail(c, 400, "Write a comment first.");
  const pre = heuristicCheck(content);
  if (pre) return fail(c, 400, pre.message, { code: "rejected" });
  const mod = await moderate(c.env, content);
  if (!mod.allowed) return fail(c, 400, mod.message, { code: "rejected" });
  const cid = uid();
  const created = now();
  await db.batch([
    db.prepare("INSERT INTO comments (id, post_id, user_id, content, status, created_at) VALUES (?, ?, ?, ?, 'live', ?)")
      .bind(cid, id, user.id, content, created),
    db.prepare("UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?").bind(id),
  ]);
  await notify(c.env, post.user_id, "comment", id, user.id);
  return c.json({ comment: { id: cid, content, createdAt: created, userId: user.id, username: user.username, isMine: true } }, 201);
});

api.delete("/comments/:id", async (c) => {
  const auth = c.get("auth");
  if (!auth) return fail(c, 401, "Please sign in first.");
  const db = c.env.DB;
  const cm = await db.prepare("SELECT post_id, user_id, status FROM comments WHERE id = ?").bind(c.req.param("id"))
    .first<{ post_id: string; user_id: string; status: string }>();
  if (!cm) return fail(c, 404, "Not found.");
  if (cm.user_id !== auth.uid && !isAdmin(c.env, auth.uid)) return fail(c, 403, "Not allowed.");
  await db.batch([
    db.prepare("DELETE FROM comments WHERE id = ?").bind(c.req.param("id")),
    db.prepare("UPDATE posts SET comment_count = MAX(comment_count - ?, 0) WHERE id = ?").bind(cm.status === "live" ? 1 : 0, cm.post_id),
  ]);
  return c.json({ ok: true });
});

// ---------- reports & blocks ----------

api.post("/posts/:id/report", async (c) => {
  const user = requireUser(c);
  if (user instanceof Response) return user;
  const id = c.req.param("id");
  const db = c.env.DB;
  const body = await c.req.json<{ reason?: string }>().catch(() => ({}) as { reason?: string });
  const reason = cleanText(body.reason, 40) || "other";
  const recent = await db.prepare("SELECT COUNT(*) AS n FROM reports WHERE user_id = ? AND created_at > ?")
    .bind(user.id, now() - 24 * HOUR).first<{ n: number }>();
  if ((recent?.n ?? 0) >= REPORTS_PER_DAY) return fail(c, 429, "You've sent a lot of reports today. Thanks — our team will review them.");
  const post = await db.prepare("SELECT user_id FROM posts WHERE id = ?").bind(id).first<{ user_id: string }>();
  if (!post) return fail(c, 404, "Not found.");
  if (post.user_id === user.id) return fail(c, 400, "You can't report your own broadcast.");
  const threshold = Number(c.env.REPORT_HIDE_THRESHOLD) || 3;
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO reports (post_id, user_id, reason, created_at) VALUES (?, ?, ?, ?)").bind(id, user.id, reason, now()),
    db.prepare("UPDATE posts SET report_count = (SELECT COUNT(*) FROM reports WHERE post_id = ?) WHERE id = ?").bind(id, id),
    db.prepare("UPDATE posts SET status = 'hidden' WHERE id = ? AND status = 'live' AND report_count >= ?").bind(id, threshold),
  ]);
  return c.json({ ok: true });
});

api.get("/blocks", async (c) => {
  const auth = c.get("auth");
  if (!auth) return fail(c, 401, "Please sign in first.");
  const res = await c.env.DB.prepare(
    "SELECT b.blocked_id AS id, u.username FROM blocks b JOIN users u ON u.id = b.blocked_id WHERE b.user_id = ? ORDER BY b.created_at DESC",
  ).bind(auth.uid).all<{ id: string; username: string }>();
  return c.json({ blocked: res.results });
});

api.post("/users/:id/block", async (c) => {
  const user = requireUser(c);
  if (user instanceof Response) return user;
  const target = c.req.param("id");
  if (target === user.id) return fail(c, 400, "You can't block yourself.");
  await c.env.DB.prepare("INSERT OR IGNORE INTO blocks (user_id, blocked_id, created_at) VALUES (?, ?, ?)").bind(user.id, target, now()).run();
  return c.json({ ok: true });
});

api.delete("/users/:id/block", async (c) => {
  const auth = c.get("auth");
  if (!auth) return fail(c, 401, "Please sign in first.");
  await c.env.DB.prepare("DELETE FROM blocks WHERE user_id = ? AND blocked_id = ?").bind(auth.uid, c.req.param("id")).run();
  return c.json({ ok: true });
});

// ---------- trending ----------

async function trendingRows(c: C) {
  const viewer = c.get("auth")?.uid ?? "";
  const q = c.req.query();
  const min = Math.min(Math.max(Number(q.min) || 3, 1), 10000);
  const lat = parseCoord(q.lat, -90, 90);
  const lng = parseCoord(q.lng, -180, 180);
  const radius = Math.min(Math.max(Number(q.radius) || 10, 1), 200);
  const near = lat != null && lng != null && q.near === "1";
  const where = ["p.status = 'live'", "p.expires_at > ?", "p.created_at > ?", "p.like_count >= ?"];
  const params: unknown[] = [viewer, now(), now() - 24 * HOUR, min];
  if (viewer) {
    where.push("p.user_id NOT IN (SELECT blocked_id FROM blocks WHERE user_id = ?)");
    params.push(viewer);
  }
  if (near) {
    const dLat = radius / 111;
    const dLng = radius / (111 * Math.max(Math.cos((lat! * Math.PI) / 180), 0.01));
    where.push("p.lat BETWEEN ? AND ?", "p.lng BETWEEN ? AND ?");
    params.push(lat! - dLat, lat! + dLat, lng! - dLng, lng! + dLng);
  }
  const res = await c.env.DB.prepare(`${POST_SELECT} WHERE ${where.join(" AND ")} ORDER BY p.urgent DESC, p.like_count DESC LIMIT 10`)
    .bind(...params).all<PostRow>();
  return { rows: res.results, viewer, lat, lng, key: `sum:${min}:${near ? `${lat!.toFixed(1)},${lng!.toFixed(1)},${radius}` : "all"}` };
}

api.get("/trending", async (c) => {
  const { rows, viewer, lat, lng } = await trendingRows(c);
  return c.json({ posts: rows.map((r) => toPost(r, { uid: viewer, lat, lng })) });
});

api.get("/trending/summary", async (c) => {
  const { rows, key } = await trendingRows(c);
  if (!rows.length) return c.json({ summary: "Nothing is trending right now. Check back soon!" });
  const db = c.env.DB;
  const cached = await db.prepare("SELECT value FROM cache WHERE key = ? AND expires_at > ?").bind(key, now()).first<{ value: string }>();
  if (cached) return c.json({ summary: cached.value, cached: true });
  try {
    const summary = await summarizeTrending(
      c.env,
      rows.filter((r) => r.content).map((r) => ({ content: r.content, likes: r.like_count, place: r.place })),
    );
    await db.prepare("INSERT OR REPLACE INTO cache (key, value, expires_at) VALUES (?, ?, ?)").bind(key, summary, now() + 10 * 60_000).run();
    return c.json({ summary });
  } catch (e) {
    console.error("summary failed", e);
    return fail(c, 500, "The AI summary isn't available right now. Please try again later.");
  }
});

// ---------- notifications ----------

api.get("/notifications", async (c) => {
  const auth = c.get("auth");
  if (!auth) return c.json({ notifications: [], unread: 0 });
  const res = await c.env.DB.prepare(
    `SELECT n.id, n.type, n.post_id, n.read, n.created_at, u.username AS actor, substr(p.content, 1, 60) AS snippet
     FROM notifications n LEFT JOIN users u ON u.id = n.actor_id LEFT JOIN posts p ON p.id = n.post_id
     WHERE n.user_id = ? ORDER BY n.created_at DESC LIMIT 30`,
  ).bind(auth.uid).all<{ id: string; type: string; post_id: string | null; read: number; created_at: number; actor: string | null; snippet: string | null }>();
  const unread = res.results.filter((r) => !r.read).length;
  return c.json({
    unread,
    notifications: res.results.map((r) => ({
      id: r.id, type: r.type, postId: r.post_id, read: !!r.read, createdAt: r.created_at, actor: r.actor, snippet: r.snippet,
    })),
  });
});

api.post("/notifications/read", async (c) => {
  const auth = c.get("auth");
  if (!auth) return fail(c, 401, "Please sign in first.");
  await c.env.DB.prepare("UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0").bind(auth.uid).run();
  return c.json({ ok: true });
});

// ---------- images ----------

api.get("/img/:key", async (c) => {
  const key = c.req.param("key");
  if (!/^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(key)) return fail(c, 404, "Not found.");
  const obj = await c.env.IMAGES.get(key);
  if (!obj) return fail(c, 404, "Not found.");
  return new Response(obj.body, {
    headers: {
      "content-type": obj.httpMetadata?.contentType ?? "image/jpeg",
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
});

// ---------- admin ----------

api.use("/admin/*", async (c, next) => {
  if (!isAdmin(c.env, c.get("auth")?.uid)) return fail(c, 403, "Admins only.");
  await next();
});

api.get("/admin/queue", async (c) => {
  const res = await c.env.DB.prepare(
    `${POST_SELECT} WHERE p.status = 'hidden' OR p.moderated = 0 OR (p.report_count > 0 AND p.status = 'live')
     ORDER BY p.report_count DESC, p.created_at DESC LIMIT 100`,
  ).bind("").all<PostRow>();
  return c.json({
    posts: res.results.map((r) => ({ ...toPost(r, {}), reportCount: r.report_count, moderated: !!r.moderated })),
  });
});

api.post("/admin/posts/:id", async (c) => {
  const id = c.req.param("id");
  const { action } = await c.req.json<{ action: "approve" | "remove" }>();
  const db = c.env.DB;
  const post = await db.prepare("SELECT user_id FROM posts WHERE id = ?").bind(id).first<{ user_id: string }>();
  if (!post) return fail(c, 404, "Not found.");
  if (action === "approve") {
    await db.batch([
      db.prepare("UPDATE posts SET status = 'live', moderated = 1, report_count = 0 WHERE id = ?").bind(id),
      db.prepare("DELETE FROM reports WHERE post_id = ?").bind(id),
    ]);
  } else {
    await db.prepare("UPDATE posts SET status = 'removed' WHERE id = ?").bind(id).run();
    await notify(c.env, post.user_id, "removed", id, null);
  }
  return c.json({ ok: true });
});

api.post("/admin/users/:id/ban", async (c) => {
  const id = c.req.param("id");
  const { banned } = await c.req.json<{ banned: boolean }>();
  const db = c.env.DB;
  await db.batch([
    db.prepare("UPDATE users SET banned = ? WHERE id = ?").bind(banned ? 1 : 0, id),
    db.prepare(`UPDATE posts SET status = ? WHERE user_id = ? AND status = ?`).bind(
      banned ? "removed" : "live", id, banned ? "live" : "removed",
    ),
  ]);
  return c.json({ ok: true });
});

api.notFound((c) => fail(c, 404, "Not found."));
api.onError((err, c) => {
  console.error(err);
  return fail(c, 500, "Something went wrong. Please try again.");
});

// ---------- app ----------

const app = new Hono<AppEnv>();
app.route("/api", api);

// Digital Asset Links: proves to Android that the Play Store app and this website belong together.
app.get("/.well-known/assetlinks.json", (c) => {
  const pkg = c.env.ANDROID_PACKAGE?.trim();
  const prints = (c.env.ANDROID_SHA256 || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!pkg || !prints.length) return c.json([]);
  return c.json([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: { namespace: "android_app", package_name: pkg, sha256_cert_fingerprints: prints },
    },
  ]);
});
app.all("/.well-known/*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default {
  fetch: app.fetch,

  // Runs on the cron schedule in wrangler.jsonc: deletes expired broadcasts and old notifications.
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      (async () => {
        const graceMs = 24 * HOUR; // keep a day after expiry for reports/appeals
        const expired = await env.DB.prepare("SELECT id, image_key FROM posts WHERE expires_at < ? LIMIT 500")
          .bind(Date.now() - graceMs).all<{ id: string; image_key: string | null }>();
        await deletePosts(
          env,
          expired.results.map((r) => r.id),
          expired.results.map((r) => r.image_key).filter((k): k is string => !!k),
        );
        await env.DB.batch([
          env.DB.prepare("DELETE FROM notifications WHERE created_at < ?").bind(Date.now() - 30 * 24 * HOUR),
          env.DB.prepare("DELETE FROM cache WHERE expires_at < ?").bind(Date.now()),
        ]);
      })(),
    );
  },
} satisfies ExportedHandler<Env>;
