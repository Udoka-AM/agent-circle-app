"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Before mount the resolved theme is unknown, so render the dark-state toggle
  // to match the server output. Guarding here avoids a hydration mismatch while
  // still showing a real control instead of an empty pill.
  const isLight = mounted && resolvedTheme === "light";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isLight}
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
      title={isLight ? "Dark mode" : "Light mode"}
      onClick={() => setTheme(isLight ? "dark" : "light")}
      className="theme-toggle"
    >
      <span className="theme-toggle-track">
        <span className="theme-toggle-thumb" data-pos={isLight ? "right" : "left"} />
      </span>
    </button>
  );
}
