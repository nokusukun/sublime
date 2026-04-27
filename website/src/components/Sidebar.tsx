"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

interface NavItem {
  label: string;
  href: string;
  children?: NavItem[];
}

interface NavSection {
  title: string;
  items: NavItem[];
}

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const isActive = pathname === item.href;
  const hasActiveChild = item.children?.some((c) => pathname === c.href);
  const [open, setOpen] = useState(isActive || hasActiveChild || false);

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className={`w-full text-left text-sm py-1.5 px-3 rounded-md flex items-center justify-between transition-colors ${
            hasActiveChild
              ? "text-accent font-medium"
              : "text-muted hover:text-foreground"
          }`}
        >
          {item.label}
          <svg
            className={`w-3 h-3 transition-transform duration-150 ${open ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
        {open && (
          <div className="ml-3 mt-0.5 pl-3 space-y-0.5">
            {item.children.map((child) => (
              <NavLink key={child.href} item={child} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={`block text-sm py-1.5 px-3 rounded-md transition-colors ${
        isActive
          ? "bg-accent-subtle text-accent font-medium"
          : "text-muted hover:text-foreground hover:bg-surface-hover"
      }`}
    >
      {item.label}
    </Link>
  );
}

export default function Sidebar({ navigation }: { navigation: NavSection[] }) {
  return (
    <nav className="w-56 shrink-0 h-full overflow-y-auto py-8 pr-6 hidden lg:block">
      <div className="space-y-8">
        {navigation.map((section) => (
          <div key={section.title}>
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-2.5 px-3">
              {section.title}
            </h3>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink key={item.label} item={item} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}
