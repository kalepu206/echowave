import { useEffect, useState } from "react";
import { Icon } from "../components/Icons";
import { api, ApiError, type Post } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import { timeAgo } from "../lib/util";

/** Moderation queue: reported, auto-hidden and un-checked broadcasts. Only for ids listed in ADMIN_UIDS. */
export function Admin() {
  const { profile } = useAuth();
  const toast = useToast();
  const [posts, setPosts] = useState<Post[] | null>(null);

  const load = () => api<{ posts: Post[] }>("/admin/queue").then((r) => setPosts(r.posts)).catch((e) => toast("error", (e as ApiError).message));
  useEffect(() => { if (profile?.isAdmin) load(); }, [profile?.isAdmin]);

  if (!profile?.isAdmin) return <p className="p-10 text-center text-muted">Admins only.</p>;

  const act = async (id: string, action: "approve" | "remove") => {
    try {
      await api(`/admin/posts/${id}`, { method: "POST", body: JSON.stringify({ action }) });
      setPosts((xs) => xs!.filter((x) => x.id !== id));
    } catch (e) {
      toast("error", (e as ApiError).message);
    }
  };

  const ban = async (userId: string, username: string) => {
    if (!confirm(`Ban ${username}? All their broadcasts will be removed and they won't be able to post.`)) return;
    try {
      await api(`/admin/users/${userId}/ban`, { method: "POST", body: JSON.stringify({ banned: true }) });
      setPosts((xs) => xs!.filter((x) => x.userId !== userId));
      toast("success", `${username} banned`);
    } catch (e) {
      toast("error", (e as ApiError).message);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-primary"><Icon name="shield" className="h-6 w-6" /> Moderation queue</h1>
        <button className="btn-secondary" onClick={load}><Icon name="refresh" /> Refresh</button>
      </div>
      {posts === null && <div className="card h-40 animate-pulse" />}
      {posts?.length === 0 && <p className="card p-8 text-center text-muted">All clear — nothing to review.</p>}
      <div className="space-y-3">
        {posts?.map((p) => (
          <div key={p.id} className="card p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-primary">{p.username}</span>
              <span className="text-muted">{timeAgo(p.createdAt)}</span>
              <span className="chip">status: {p.status}</span>
              {!!p.reportCount && <span className="chip">{p.reportCount} reports</span>}
              {p.moderated === false && <span className="chip">AI check skipped</span>}
            </div>
            {p.content && <p className="mb-2 text-sm whitespace-pre-wrap">{p.content}</p>}
            {p.imageUrl && <img src={p.imageUrl} alt={p.imageAlt ?? ""} className="mb-2 max-h-60 rounded-lg" />}
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary" onClick={() => act(p.id, "approve")}><Icon name="check" /> Keep / restore</button>
              <button className="btn-danger" onClick={() => act(p.id, "remove")}><Icon name="trash" /> Remove</button>
              <button className="btn-ghost text-danger" onClick={() => ban(p.userId, p.username)}><Icon name="ban" /> Ban user</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
