"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const primaryNav = [
  { label: "Docs", href: "/docs/foundation" },
  { label: "Commands", href: "/docs/commands/audit" },
  { label: "Anti-patterns", href: "/docs/anti-patterns" },
  { label: "Languages", href: "/docs/languages/typescript" },
];

export default function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <Link
            href="/"
            className="flex items-center gap-1 font-bold text-lg tracking-tight text-foreground"
          >
            <span className="text-accent font-mono">/</span>
            <span>sublime</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {primaryNav.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-sm px-3 py-1.5 rounded-md transition-colors ${
                    isActive
                      ? "text-foreground bg-surface-hover font-medium"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-4">
            <a
              href="https://github.com/sublime-code/sublime"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View on GitHub"
              className="text-muted hover:text-foreground transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
              </svg>
            </a>

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden text-muted hover:text-foreground transition-colors"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {mobileOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background px-4 py-3 space-y-1">
          <Link
            href="/"
            onClick={() => setMobileOpen(false)}
            className={`block py-2 text-sm transition-colors ${
              pathname === "/"
                ? "text-foreground font-medium"
                : "text-muted hover:text-foreground"
            }`}
          >
            Home
          </Link>
          {primaryNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`block py-2 text-sm transition-colors ${
                pathname.startsWith(item.href)
                  ? "text-foreground font-medium"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
