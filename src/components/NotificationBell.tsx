import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icons";
import { api, type Notification } from "../lib/api";
import { useRouter } from "../lib/router";
import { timeAgo } from "../lib/util";

export function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { navigate } = useRouter();

  const load = async () => {
    try {
      const r = await api<{ notifications: Notification[]; unread: number }>("/notifications");
      setItems(r.notifications);
      setUnread(r.unread);
    } catch {
      /* ignore, retry next tick */
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      setUnread(0);
      api("/notifications/read", { method: "POST" }).catch(() => {});
    }
  };

  const text = (n: Notification) =>
    n.type === "like"
      ? `${n.actor ?? "Someone"} liked your broadcast`
      : n.type === "comment"
        ? `${n.actor ?? "Someone"} commented on your broadcast`
        : "One of your broadcasts was removed for breaking the community guidelines";

  return (
    <div className="relative" ref={ref}>
      <button className="btn-ghost relative" onClick={toggle} aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} aria-expanded={open}>
        <Icon name="bell" className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 right-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white dark:text-[#1c1e24]">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="card absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden shadow-xl">
          <p className="border-b border-border px-4 py-3 text-sm font-semibold">Notifications</p>
          <ul className="max-h-96 overflow-y-auto">
            {items.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">Nothing yet. Likes and comments on your broadcasts show up here.</li>}
            {items.map((n) => (
              <li key={n.id}>
                <button
                  className={`w-full px-4 py-3 text-left text-sm hover:bg-border/30 ${n.read ? "" : "bg-primary/10"}`}
                  onClick={() => {
                    setOpen(false);
                    if (n.postId && n.type !== "removed") navigate(`/p/${n.postId}`);
                  }}
                >
                  <span className="block">{text(n)}</span>
                  {n.snippet && <span className="mt-0.5 block truncate text-xs text-muted">“{n.snippet}”</span>}
                  <span className="mt-0.5 block text-xs text-muted">{timeAgo(n.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
