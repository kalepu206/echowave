import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "./Icons";
import { api, ApiError, type Comment, type Post } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import { Link, useRouter } from "../lib/router";
import { formatDistance, sentimentLabel, timeAgo } from "../lib/util";

const REPORT_REASONS = [
  ["spam", "Spam or advertising"],
  ["scam", "Scam or fraud"],
  ["harassment", "Harassment or hate"],
  ["false_info", "False or misleading"],
  ["personal_info", "Shares someone's private info"],
  ["inappropriate", "Sexual or violent content"],
  ["other", "Something else"],
] as const;

interface Props {
  post: Post;
  onChange?: (p: Post) => void;
  onRemove?: (id: string) => void;
  onBlock?: (userId: string) => void;
  defaultOpenComments?: boolean;
}

export function PostCard({ post, onChange, onRemove, onBlock, defaultOpenComments = false }: Props) {
  const { user, profile } = useAuth();
  const toast = useToast();
  const { navigate } = useRouter();
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [showComments, setShowComments] = useState(defaultOpenComments);
  const menuRef = useRef<HTMLDivElement>(null);
  const s = sentimentLabel(post.sentiment);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  const needLogin = () => {
    toast("info", "Sign in to do that");
    navigate("/login");
  };

  const like = async () => {
    if (!user) return needLogin();
    const optimistic = { ...post, likedByMe: !post.likedByMe, likeCount: post.likeCount + (post.likedByMe ? -1 : 1) };
    onChange?.(optimistic);
    try {
      const r = await api<{ liked: boolean; likeCount: number }>(`/posts/${post.id}/like`, { method: "POST" });
      onChange?.({ ...post, likedByMe: r.liked, likeCount: r.likeCount });
    } catch (e) {
      onChange?.(post);
      toast("error", (e as ApiError).message);
    }
  };

  const share = async () => {
    const url = `${window.location.origin}/p/${post.id}`;
    const text = post.content ? `${post.content.slice(0, 100)}${post.content.length > 100 ? "…" : ""}` : "Local update on EchoWave";
    try {
      if (navigator.share) await navigator.share({ title: "EchoWave", text, url });
      else {
        await navigator.clipboard.writeText(url);
        toast("success", "Link copied");
      }
    } catch {
      /* user cancelled */
    }
  };

  const remove = async () => {
    setMenu(false);
    if (!confirm("Delete this broadcast? This can't be undone.")) return;
    try {
      await api(`/posts/${post.id}`, { method: "DELETE" });
      onRemove?.(post.id);
      toast("success", "Broadcast deleted");
    } catch (e) {
      toast("error", (e as ApiError).message);
    }
  };

  const block = async () => {
    setMenu(false);
    if (!user) return needLogin();
    if (!confirm(`Block ${post.username}? You won't see their broadcasts or comments. You can unblock them from your profile.`)) return;
    try {
      await api(`/users/${post.userId}/block`, { method: "POST" });
      onBlock?.(post.userId);
      toast("success", `${post.username} is blocked`);
    } catch (e) {
      toast("error", (e as ApiError).message);
    }
  };

  const report = async (reason: string) => {
    setReporting(false);
    try {
      await api(`/posts/${post.id}/report`, { method: "POST", body: JSON.stringify({ reason }) });
      onRemove?.(post.id);
      toast("success", "Thanks for reporting", "We've hidden it from your feed and our team will review it.");
    } catch (e) {
      toast("error", (e as ApiError).message);
    }
  };

  return (
    <article className={`card overflow-hidden ${post.urgent ? "border-accent/70" : ""}`}>
      <div className="p-4 sm:p-5">
        <header className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-primary">{post.username}</span>
              {post.urgent && (
                <span className="inline-flex items-center gap-1 rounded-md bg-accent px-1.5 py-0.5 text-[11px] font-bold tracking-wide text-accent-fg uppercase">
                  <Icon name="siren" className="h-3 w-3" /> Urgent
                </span>
              )}
              {post.status !== "live" && <span className="chip">{post.status === "hidden" ? "Hidden — under review" : "Removed"}</span>}
            </div>
            {(post.place || post.distanceKm != null) && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                <Icon name="pin" className="h-3 w-3" />
                {[post.place, post.distanceKm != null ? formatDistance(post.distanceKm) : null].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Link to={`/p/${post.id}`} className="text-xs text-muted hover:text-fg">
              <time dateTime={new Date(post.createdAt).toISOString()}>{timeAgo(post.createdAt)}</time>
            </Link>
            <div className="relative" ref={menuRef}>
              <button className="btn-ghost px-1.5 py-1" onClick={() => setMenu((m) => !m)} aria-label="More options" aria-expanded={menu}>
                <Icon name="more" />
              </button>
              {menu && (
                <div className="card absolute right-0 z-20 mt-1 w-48 py-1 shadow-xl">
                  {(post.isMine || profile?.isAdmin) && (
                    <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger hover:bg-border/30" onClick={remove}>
                      <Icon name="trash" /> Delete
                    </button>
                  )}
                  {!post.isMine && (
                    <>
                      <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-border/30" onClick={() => { setMenu(false); if (!user) needLogin(); else setReporting(true); }}>
                        <Icon name="flag" /> Report
                      </button>
                      <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-border/30" onClick={block}>
                        <Icon name="ban" /> Block {post.username}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {post.content && <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">{post.content}</p>}
      </div>

      {post.imageUrl && (
        <img src={post.imageUrl} alt={post.imageAlt ?? "Photo shared with this broadcast"} loading="lazy" className="max-h-[28rem] w-full border-y border-border bg-input object-cover" />
      )}

      {post.topics.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pt-3 sm:px-5">
          {post.topics.map((t) => <span key={t} className="chip">#{t}</span>)}
        </div>
      )}

      <footer className="mt-3 flex items-center justify-between border-t border-border px-2 py-1.5 sm:px-3">
        <div className="flex items-center gap-1">
          <button className={`btn-ghost ${post.likedByMe ? "text-primary" : ""}`} onClick={like} aria-pressed={post.likedByMe} aria-label={post.likedByMe ? "Unlike" : "Like"}>
            <Icon name="like" className="h-4 w-4" fill={post.likedByMe ? "currentColor" : "none"} />
            <span>{post.likeCount}</span>
          </button>
          <span className={`flex items-center gap-1 px-2 text-xs ${s.cls}`} title="Tone detected by AI">
            <Icon name={s.icon} className="h-3.5 w-3.5" /> {s.label}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button className="btn-ghost" onClick={() => setShowComments((v) => !v)} aria-expanded={showComments} aria-label="Comments">
            <Icon name="comment" /> <span>{post.commentCount}</span>
          </button>
          <button className="btn-ghost" onClick={share} aria-label="Share">
            <Icon name="share" />
          </button>
        </div>
      </footer>

      {showComments && <Comments post={post} onCount={(n) => onChange?.({ ...post, commentCount: n })} />}

      {reporting && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={() => setReporting(false)}>
          <div className="card w-full max-w-sm p-5" role="dialog" aria-modal="true" aria-labelledby="report-title" onClick={(e) => e.stopPropagation()}>
            <h3 id="report-title" className="mb-1 text-base font-semibold">Report this broadcast</h3>
            <p className="mb-3 text-sm text-muted">What's wrong with it?</p>
            <div className="space-y-1">
              {REPORT_REASONS.map(([value, label]) => (
                <button key={value} className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-border/40" onClick={() => report(value)}>
                  {label}
                </button>
              ))}
            </div>
            <button className="btn-secondary mt-3 w-full" onClick={() => setReporting(false)}>Cancel</button>
          </div>
        </div>
      )}
    </article>
  );
}

function Comments({ post, onCount }: { post: Post; onCount: (n: number) => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<Comment[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ comments: Comment[] }>(`/posts/${post.id}/comments`).then((r) => setItems(r.comments)).catch(() => setItems([]));
  }, [post.id]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      const r = await api<{ comment: Comment }>(`/posts/${post.id}/comments`, { method: "POST", body: JSON.stringify({ content: text }) });
      const next = [...(items ?? []), r.comment];
      setItems(next);
      onCount(post.commentCount + 1);
      setText("");
    } catch (err) {
      toast("error", "Comment not posted", (err as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  const del = async (id: string) => {
    try {
      await api(`/comments/${id}`, { method: "DELETE" });
      setItems((xs) => (xs ?? []).filter((c) => c.id !== id));
      onCount(Math.max(post.commentCount - 1, 0));
    } catch (err) {
      toast("error", (err as ApiError).message);
    }
  };

  return (
    <div className="border-t border-border bg-input/50 px-4 py-3 sm:px-5">
      {items === null ? (
        <p className="text-sm text-muted">Loading comments…</p>
      ) : (
        <ul className="space-y-2.5">
          {items.length === 0 && <li className="text-sm text-muted">No comments yet.</li>}
          {items.map((c) => (
            <li key={c.id} className="text-sm">
              <span className="font-medium text-primary">{c.username}</span>{" "}
              <span className="break-words">{c.content}</span>
              <span className="ml-2 text-xs text-muted">{timeAgo(c.createdAt)}</span>
              {c.isMine && (
                <button className="ml-2 text-xs text-muted underline hover:text-danger" onClick={() => del(c.id)}>delete</button>
              )}
            </li>
          ))}
        </ul>
      )}
      {user ? (
        <form onSubmit={send} className="mt-3 flex gap-2">
          <label htmlFor={`c-${post.id}`} className="sr-only">Write a comment</label>
          <input id={`c-${post.id}`} className="field" maxLength={200} placeholder="Add a comment…" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn-primary px-3" disabled={busy || !text.trim()} aria-label="Send comment">
            <Icon name={busy ? "loader" : "send"} />
          </button>
        </form>
      ) : (
        <p className="mt-3 text-sm text-muted"><Link to="/login" className="text-primary underline">Sign in</Link> to comment.</p>
      )}
    </div>
  );
}
