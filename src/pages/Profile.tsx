import { useEffect, useState } from "react";
import { EmailAuthProvider, GoogleAuthProvider, deleteUser, reauthenticateWithCredential, reauthenticateWithPopup } from "firebase/auth";
import { Icon } from "../components/Icons";
import { PostCard } from "../components/PostCard";
import { api, ApiError, type Post } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useRouter } from "../lib/router";
import { useToast } from "../lib/toast";

export function Profile() {
  const { user, profile, signOut, refresh } = useAuth();
  const { navigate } = useRouter();
  const toast = useToast();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [blocked, setBlocked] = useState<{ id: string; username: string }[]>([]);
  const [newName, setNewName] = useState(profile?.username ?? "");
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    api<{ posts: Post[] }>("/posts?user=me").then((r) => setPosts(r.posts)).catch(() => setPosts([]));
    api<{ blocked: { id: string; username: string }[] }>("/blocks").then((r) => setBlocked(r.blocked)).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user) navigate("/login", { replace: true });
  }, [user, navigate]);

  if (!user) return null;

  const isPassword = user.providerData.some((p) => p.providerId === "password");

  const rename = async () => {
    try {
      await api("/me", { method: "POST", body: JSON.stringify({ username: newName.trim() }) });
      await refresh();
      toast("success", "Username updated");
    } catch (e) {
      toast("error", (e as ApiError).message);
    }
  };

  const unblock = async (id: string) => {
    await api(`/users/${id}/block`, { method: "DELETE" }).catch(() => {});
    setBlocked((b) => b.filter((x) => x.id !== id));
  };

  const deleteAccount = async () => {
    setBusy(true);
    try {
      // Firebase needs a fresh sign-in before an account can be deleted.
      if (isPassword) {
        await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email ?? "", password));
      } else {
        await reauthenticateWithPopup(user, new GoogleAuthProvider());
      }
      await api("/me", { method: "DELETE" });
      await deleteUser(user);
      toast("success", "Your account and all your data have been deleted.");
      navigate("/", { replace: true });
    } catch (e) {
      const code = (e as { code?: string }).code;
      toast("error", "Couldn't delete account", code === "auth/invalid-credential" || code === "auth/wrong-password" ? "Password is incorrect." : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <section className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-primary">{profile?.username}</h1>
            <p className="text-sm text-muted">{user.email}</p>
          </div>
          <button className="btn-secondary" onClick={async () => { await signOut(); navigate("/"); }}>
            <Icon name="logout" /> Sign out
          </button>
        </div>
        <div className="mt-5 flex flex-wrap items-end gap-2">
          <div className="min-w-48 flex-1">
            <label htmlFor="rename" className="label">Change username</label>
            <input id="rename" className="field" value={newName} maxLength={20} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <button className="btn-secondary" onClick={rename} disabled={!newName.trim() || newName === profile?.username}>Save</button>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Your broadcasts</h2>
        <p className="mb-3 text-sm text-muted">Broadcasts disappear from the feed 48 hours after posting.</p>
        <div className="space-y-4">
          {posts === null && <div className="card h-32 animate-pulse" />}
          {posts?.length === 0 && <p className="card p-6 text-center text-sm text-muted">You haven't broadcast anything yet.</p>}
          {posts?.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              onChange={(np) => setPosts((xs) => xs!.map((x) => (x.id === np.id ? np : x)))}
              onRemove={(id) => setPosts((xs) => xs!.filter((x) => x.id !== id))}
            />
          ))}
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-3 text-lg font-semibold">Blocked people</h2>
        {blocked.length === 0 ? (
          <p className="text-sm text-muted">You haven't blocked anyone.</p>
        ) : (
          <ul className="divide-y divide-border">
            {blocked.map((b) => (
              <li key={b.id} className="flex items-center justify-between py-2 text-sm">
                {b.username}
                <button className="btn-ghost" onClick={() => unblock(b.id)}>Unblock</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card border-danger/50 p-6">
        <h2 className="mb-1 text-lg font-semibold text-danger">Delete account</h2>
        <p className="mb-4 text-sm text-muted">Permanently deletes your account, broadcasts, photos, comments and likes. This can't be undone.</p>
        {!deleting ? (
          <button className="btn-danger" onClick={() => setDeleting(true)}><Icon name="trash" /> Delete my account</button>
        ) : (
          <div className="space-y-3">
            {isPassword && (
              <div>
                <label htmlFor="del-pw" className="label">Your password</label>
                <input id="del-pw" type="password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            )}
            <div>
              <label htmlFor="del-confirm" className="label">Type DELETE to confirm</label>
              <input id="del-confirm" className="field" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button className="btn-danger" disabled={busy || confirmText !== "DELETE" || (isPassword && !password)} onClick={deleteAccount}>
                {busy && <Icon name="loader" />} Permanently delete
              </button>
              <button className="btn-secondary" onClick={() => setDeleting(false)}>Cancel</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
