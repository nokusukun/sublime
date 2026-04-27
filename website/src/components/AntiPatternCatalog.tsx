"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

interface AntiPattern {
  name: string;
  slug: string;
  kind: "AI-slop" | "Quality";
  detection: "Lint" | "Type-check" | "Review";
  scope: string;
  category: string;
  categorySlug: string;
}

function TagPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-full border border-solid transition-colors cursor-pointer ${
        active
          ? "bg-foreground text-background border-foreground"
          : "border-border text-muted hover:border-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function KindBadge({ kind }: { kind: string }) {
  return (
    <span
      className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
        kind === "AI-slop"
          ? "bg-accent-subtle text-accent"
          : "bg-surface-hover text-muted"
      }`}
    >
      {kind}
    </span>
  );
}

function DetectionBadge({ detection }: { detection: string }) {
  const classes: Record<string, string> = {
    Lint: "bg-accent-subtle text-accent",
    "Type-check": "bg-surface-hover text-foreground",
    Review: "bg-surface text-muted",
  };
  return (
    <span
      className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${classes[detection] ?? ""}`}
    >
      {detection}
    </span>
  );
}

export default function AntiPatternCatalog({
  patterns,
}: {
  patterns: AntiPattern[];
}) {
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<string | null>(null);
  const [detectionFilter, setDetectionFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const categories = useMemo(
    () => [...new Set(patterns.map((p) => p.category))].sort(),
    [patterns],
  );

  const filtered = useMemo(() => {
    return patterns.filter((p) => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase()))
        return false;
      if (kindFilter && p.kind !== kindFilter) return false;
      if (detectionFilter && p.detection !== detectionFilter) return false;
      if (categoryFilter && p.category !== categoryFilter) return false;
      return true;
    });
  }, [patterns, search, kindFilter, detectionFilter, categoryFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, AntiPattern[]>();
    for (const p of filtered) {
      const list = map.get(p.category) || [];
      list.push(p);
      map.set(p.category, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const clearAll = () => {
    setSearch("");
    setKindFilter(null);
    setDetectionFilter(null);
    setCategoryFilter(null);
  };

  const hasFilters = search || kindFilter || detectionFilter || categoryFilter;

  return (
    <div>
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search patterns..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-[28rem] px-3 py-2 text-sm bg-surface border border-border rounded-md focus:outline-none focus:border-accent placeholder:text-muted transition-colors"
        />
      </div>

      <div className="flex flex-wrap gap-6 mb-8">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-2">
            Kind
          </p>
          <div className="flex gap-2">
            <TagPill
              label="AI-slop"
              active={kindFilter === "AI-slop"}
              onClick={() =>
                setKindFilter(kindFilter === "AI-slop" ? null : "AI-slop")
              }
            />
            <TagPill
              label="Quality"
              active={kindFilter === "Quality"}
              onClick={() =>
                setKindFilter(kindFilter === "Quality" ? null : "Quality")
              }
            />
          </div>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-2">
            Detection
          </p>
          <div className="flex gap-2">
            <TagPill
              label="Lint"
              active={detectionFilter === "Lint"}
              onClick={() =>
                setDetectionFilter(
                  detectionFilter === "Lint" ? null : "Lint",
                )
              }
            />
            <TagPill
              label="Type-check"
              active={detectionFilter === "Type-check"}
              onClick={() =>
                setDetectionFilter(
                  detectionFilter === "Type-check" ? null : "Type-check",
                )
              }
            />
            <TagPill
              label="Review"
              active={detectionFilter === "Review"}
              onClick={() =>
                setDetectionFilter(
                  detectionFilter === "Review" ? null : "Review",
                )
              }
            />
          </div>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-2">
            Category
          </p>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <TagPill
                key={cat}
                label={cat}
                active={categoryFilter === cat}
                onClick={() =>
                  setCategoryFilter(categoryFilter === cat ? null : cat)
                }
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
        <p className="text-sm text-muted font-variant-numeric tabular-nums">
          {filtered.length} of {patterns.length} patterns
        </p>
        {hasFilters && (
          <button
            onClick={clearAll}
            className="text-xs text-accent hover:underline underline-offset-2"
          >
            Clear filters
          </button>
        )}
      </div>

      {grouped.length === 0 ? (
        <p className="text-muted text-sm py-12 text-center">
          No patterns match your filters.
        </p>
      ) : (
        <div className="space-y-10">
          {grouped.map(([category, items]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-foreground mb-3">
                {category}
              </h3>
              <div className="space-y-0.5">
                {items.map((p) => (
                  <Link
                    key={p.slug}
                    href={`/docs/anti-patterns/${p.categorySlug}`}
                    className="flex items-center gap-3 py-2.5 px-3 rounded-md hover:bg-surface-hover transition-colors group"
                  >
                    <span className="text-sm text-foreground group-hover:text-accent transition-colors flex-1 min-w-0 truncate">
                      {p.name}
                    </span>
                    <div className="flex gap-1.5 shrink-0">
                      <KindBadge kind={p.kind} />
                      <DetectionBadge detection={p.detection} />
                      {p.scope !== "Universal" && (
                        <span className="text-[10px] font-mono text-muted px-1.5 py-0.5 rounded bg-surface border border-border">
                          {p.scope}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
