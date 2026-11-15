import { useEffect, useState } from "react";
import { Icon } from "./Icons";
import { api, ApiError, qs, type Post } from "../lib/api";
import { useRouter } from "../lib/router";

interface Props {
  near: boolean;
  lat?: number;
  lng?: number;
  radius: number;
  refreshKey: number;
}

export function TrendingPanel({ near, lat, lng, radius, refreshKey }: Props) {
  const [min, setMin] = useState(() => Number(localStorage.getItem("ew-min-likes")) || 3);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { navigate } = useRouter();
  const params = qs({ min, near, lat, lng, radius });

  useEffect(() => {
    try { localStorage.setItem("ew-min-likes", String(min)); } catch { /* ignore */ }
    const t = setTimeout(() => {
      api<{ posts: Post[] }>(`/trending${params}`).then((r) => setPosts(r.posts)).catch(() => setPosts([]));
    }, 300);
    setSummary(null);
    return () => clearTimeout(t);
  }, [params, refreshKey, min]);

  const summarize = async () => {
    setSummarizing(true);
    setError(null);
    try {
      const r = await api<{ summary: string }>(`/trending/summary${params}`);
      setSummary(r.summary);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setSummarizing(false);
    }
  };

  return (
    <section className="card p-5" aria-labelledby="trending-title">
      <h2 id="trending-title" className="mb-4 flex items-center gap-2 text-lg font-semibold text-primary">
        <Icon name="zap" className="h-5 w-5 text-accent" /> Trending {near ? "near you" : "now"}
      </h2>
      <label htmlFor="min-likes" className="label">Minimum likes to trend</label>
      <input
        id="min-likes"
        type="number"
        min={1}
        max={1000}
        className="field mb-4"
        value={min}
        onChange={(e) => setMin(Math.max(1, Number(e.target.value) || 1))}
      />
      <div className="rounded-lg border border-border">
        {posts === null && <p className="p-4 text-sm text-muted">Loading…</p>}
        {posts?.length === 0 && <p className="p-4 text-sm text-muted">Nothing has {min}+ likes in the last 24 hours yet.</p>}
        <ul className="divide-y divide-border">
          {posts?.map((p) => (
            <li key={p.id}>
              <button className="w-full px-3 py-2.5 text-left hover:bg-border/30" onClick={() => navigate(`/p/${p.id}`)}>
                <span className="flex items-center gap-1.5 text-sm">
                  {p.urgent && <Icon name="siren" className="h-3.5 w-3.5 shrink-0 text-accent" aria-label="Urgent" />}
                  <span className="truncate">{p.content || "📷 Photo"}</span>
                </span>
                <span className="text-xs text-muted">{p.likeCount} likes{p.place ? ` · ${p.place}` : ""}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <button className="btn-primary mt-4 w-full" onClick={summarize} disabled={summarizing || !posts?.length}>
        <Icon name={summarizing ? "loader" : "sparkles"} /> {summarizing ? "Summarizing…" : "Summarize trending"}
      </button>
      {summary && (
        <div className="mt-4 rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm" role="status">
          <p className="mb-1 flex items-center gap-1.5 font-semibold text-primary"><Icon name="sparkles" /> AI summary</p>
          <p className="leading-relaxed">{summary}</p>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </section>
  );
}
