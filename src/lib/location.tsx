import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

interface Coords { lat: number; lng: number }

interface LocationState {
  coords: Coords | null;
  status: "idle" | "locating" | "ready" | "denied" | "error";
  locate: () => Promise<Coords | null>;
  clear: () => void;
}

const Ctx = createContext<LocationState>({ coords: null, status: "idle", locate: async () => null, clear: () => {} });

/** Shared device location for "near me" feed filtering and for tagging broadcasts. Only asked for when the user taps a button. */
export function LocationProvider({ children }: { children: ReactNode }) {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [status, setStatus] = useState<LocationState["status"]>("idle");

  const locate = useCallback(async () => {
    if (!("geolocation" in navigator)) {
      setStatus("error");
      return null;
    }
    setStatus("locating");
    return new Promise<Coords | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCoords(c);
          setStatus("ready");
          resolve(c);
        },
        (err) => {
          setStatus(err.code === err.PERMISSION_DENIED ? "denied" : "error");
          resolve(null);
        },
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 5 * 60_000 },
      );
    });
  }, []);

  const clear = useCallback(() => {
    setCoords(null);
    setStatus("idle");
  }, []);

  return <Ctx.Provider value={{ coords, status, locate, clear }}>{children}</Ctx.Provider>;
}

export const useLocation = () => useContext(Ctx);
