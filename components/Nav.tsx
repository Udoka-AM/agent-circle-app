"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { WalletButton } from "./WalletButton";

const LINKS = [
  { href: "/", label: "Leaderboard" },
  { href: "/agents", label: "Agents" },
  { href: "/builders", label: "For Builders" },
  { href: "/dashboard", label: "Dashboard" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav() {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const pathname = usePathname() ?? "/";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      className="sticky top-0 z-50 border-b backdrop-blur"
      style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--background) 82%, transparent)" }}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <Image src="/logo.png" alt="Agent Circle" width={28} height={28} className="rounded-lg" priority />
          <span className="text-sm font-semibold tracking-tight">Agent Circle</span>
        </Link>

        <nav
          className="hidden items-center gap-6 text-sm sm:flex"
          aria-label="Primary"
        >
          {LINKS.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className="nav-link"
                aria-current={active ? "page" : undefined}
                data-active={active ? "true" : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <WalletButton />
          <button
            type="button"
            className="btn-ghost px-3 py-2 text-xs sm:hidden"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "Close" : "Menu"}
          </button>
        </div>
      </div>

      {open ? (
        <nav
          id={menuId}
          className="border-t px-6 py-3 sm:hidden"
          style={{ borderColor: "var(--border)" }}
          aria-label="Mobile"
        >
          <div className="mx-auto flex max-w-6xl flex-col gap-1">
            {LINKS.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="nav-link rounded-xl px-3 py-3 text-sm"
                  aria-current={active ? "page" : undefined}
                  data-active={active ? "true" : undefined}
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
