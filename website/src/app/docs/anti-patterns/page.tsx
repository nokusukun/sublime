import AntiPatternCatalog from "@/components/AntiPatternCatalog";
import { parseAntiPatterns } from "@/lib/anti-patterns";

export const metadata = {
  title: "Anti-patterns Catalog",
};

export default function AntiPatternsPage() {
  const patterns = parseAntiPatterns();

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-[1.875rem] font-bold tracking-tight mb-4">Anti-pattern catalog</h1>
        <p className="text-muted leading-relaxed max-w-[42rem] mb-2">
          Named failure modes of LLM-generated code. Use this catalog as a field
          guide: if you recognize a pattern here in your own output, rewrite.
        </p>
        <p className="text-muted text-sm leading-relaxed max-w-[42rem]">
          Every entry has the same shape — <em>Pattern &middot; Forbidden example &middot;
          Why it hurts &middot; Rewrite &middot; See in <code className="text-xs bg-surface border border-border px-1 py-0.5 rounded font-mono">/sublime</code></em> — and
          three tag axes so entries are filterable at a glance.
        </p>
      </div>

      <AntiPatternCatalog patterns={patterns} />
    </div>
  );
}
