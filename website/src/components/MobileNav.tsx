"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  label: string;
  href: string;
  children?: NavItem[];
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export default function MobileNav({
  navigation,
}: {
  navigation: NavSection[];
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="lg:hidden mb-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm text-muted hover:text-foreground py-2 transition-colors"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
        Navigation
      </button>

      {open && (
        <div className="border border-border rounded-lg bg-surface p-4 mt-2 mb-4 max-h-[60vh] overflow-y-auto">
          {navigation.map((section) => (
            <div key={section.title} className="mb-5 last:mb-0">
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-2">
                {section.title}
              </h3>
              {section.items.map((item) => (
                <div key={item.label}>
                  {item.children ? (
                    <div className="mb-1.5">
                      <span className="text-sm text-muted px-2 py-1">
                        {item.label}
                      </span>
                      <div className="ml-3 pl-3 space-y-0.5">
                        {item.children.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={() => setOpen(false)}
                            className={`block text-sm py-1 px-2 rounded transition-colors ${
                              pathname === child.href
                                ? "text-accent font-medium"
                                : "text-muted hover:text-foreground"
                            }`}
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`block text-sm py-1 px-2 rounded transition-colors ${
                        pathname === item.href
                          ? "text-accent font-medium"
                          : "text-muted hover:text-foreground"
                      }`}
                    >
                      {item.label}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
