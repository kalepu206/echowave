import { useEffect, useState } from "react";

export function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#1c1e24" : "#f0f2f5");
    try {
      localStorage.setItem("ew-theme", dark ? "dark" : "light");
    } catch {
      /* private mode */
    }
  }, [dark]);
  return { dark, toggle: () => setDark((d) => !d) };
}
