import { useRef, useState, type FormEvent } from "react";
import { Icon } from "./Icons";
import { api, ApiError, type Post } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useLocation } from "../lib/location";
import { useToast } from "../lib/toast";
import { compressImage } from "../lib/util";
import { Link } from "../lib/router";

const LIMIT = 280;

export function BroadcastForm({ onPosted }: { onPosted: (p: Post) => void }) {
  const { user } = useAuth();
  const loc = useLocation();
  const toast = useToast();
  const [content, setContent] = useState("");
  const [place, setPlace] = useState("");
  const [useLoc, setUseLoc] = useState(false);
  const [urgent, setUrgent] = useState(false);
  const [image, setImage] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!user) {
    return (
      <section className="card p-6">
        <h2 className="mb-2 text-lg font-semibold text-primary">Broadcast a Message</h2>
        <p className="mb-4 text-sm text-muted">Sign in to share what's happening in your area. Reading the feed is open to everyone.</p>
        <div className="flex flex-wrap gap-2">
          <Link to="/login?mode=signup" className="btn-primary"><Icon name="userPlus" /> Create free account</Link>
          <Link to="/login" className="btn-secondary"><Icon name="login" /> Login</Link>
        </div>
      </section>
    );
  }


  const pickImage = async (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast("error", "That isn't an image file.");
    try {
      const blob = await compressImage(f);
      setImage(blob);
      setPreview(URL.createObjectURL(blob));
    } catch (e) {
      toast("error", (e as Error).message);
    }
  };

  const clearImage = () => {
    if (preview) URL.revokeObjectURL(preview);
    setImage(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const toggleLocation = async () => {
    if (useLoc) return setUseLoc(false);
    const c = loc.coords ?? (await loc.locate());
    if (c) setUseLoc(true);
    else toast("error", "Couldn't get your location", "Allow location access in your browser or phone settings, or type an area name instead.");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !image) return toast("error", "Write something or attach a photo.");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("content", content.trim());
      if (place.trim()) fd.set("place", place.trim());
      if (useLoc && loc.coords) {
        fd.set("lat", String(loc.coords.lat));
        fd.set("lng", String(loc.coords.lng));
      }
      if (urgent) fd.set("urgent", "1");
      if (image) fd.set("image", image, "photo.jpg");
      const r = await api<{ post: Post }>("/posts", { method: "POST", body: fd });
      onPosted(r.post);
      setContent("");
      setPlace("");
      setUrgent(false);
      clearImage();
      toast("success", "Broadcast sent!", r.post.urgent ? "Marked as an urgent alert." : undefined);
    } catch (err) {
      const e = err as ApiError;
      toast("error", e.code === "rejected" ? "Not posted" : "Couldn't broadcast", e.message);
    } finally {
      setBusy(false);
    }
  };

  const left = LIMIT - content.length;

  return (
    <section className="card p-5 sm:p-6">
      <h2 className="mb-4 text-lg font-semibold text-primary">Broadcast a Message</h2>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="bc-content" className="sr-only">Your message</label>
          <textarea
            id="bc-content"
            className="field min-h-24 resize-y"
            placeholder="What's happening in your area? (Optional if attaching an image)"
            maxLength={LIMIT}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <p className={`mt-1 text-xs ${left < 20 ? "text-danger" : "text-muted"}`}>{left} characters remaining</p>
        </div>

        <div>
          <p className="label"><Icon name="image" /> Attach image (optional)</p>
          {preview ? (
            <div className="relative overflow-hidden rounded-lg border border-border">
              <img src={preview} alt="Selected photo preview" className="max-h-64 w-full object-cover" />
              <button type="button" className="btn-secondary absolute top-2 right-2 px-2 py-1" onClick={clearImage} aria-label="Remove photo">
                <Icon name="x" />
              </button>
            </div>
          ) : (
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="field file:mr-3 file:rounded-md file:border-0 file:bg-primary/15 file:px-3 file:py-1 file:text-sm file:text-primary"
              onChange={(e) => pickImage(e.target.files?.[0])}
            />
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="bc-place" className="label"><Icon name="pin" /> Area or landmark (optional)</label>
            <input id="bc-place" className="field" maxLength={40} placeholder="e.g. MG Road, near the metro" value={place} onChange={(e) => setPlace(e.target.value)} />
          </div>
          <div>
            <p className="label"><Icon name="locate" /> Location (optional)</p>
            <button type="button" className={useLoc ? "btn-primary w-full" : "btn-secondary w-full"} onClick={toggleLocation} aria-pressed={useLoc} disabled={loc.status === "locating"}>
              <Icon name={loc.status === "locating" ? "loader" : useLoc ? "check" : "locate"} />
              {loc.status === "locating" ? "Finding you…" : useLoc ? "Location added (about 1 km)" : "Use current location"}
            </button>
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--accent)]" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />
          <span>
            <span className="font-medium">This is an urgent safety alert</span>
            <span className="block text-xs text-muted">Accidents, floods, fires, missing person, road closures. AI double-checks before marking it urgent.</span>
          </span>
        </label>

        <button type="submit" className="btn-primary w-full py-2.5" disabled={busy || (!content.trim() && !image)}>
          <Icon name={busy ? "loader" : "send"} />
          {busy ? "Checking & sending…" : "Broadcast"}
        </button>
        <p className="text-center text-xs text-muted">
          Every broadcast is checked by AI for safety and disappears after 48 hours. <Link to="/guidelines" className="underline">Guidelines</Link>
        </p>
      </form>
    </section>
  );
}
