import fs from "fs";
import path from "path";

const CONTENT_ROOT = path.join(process.cwd(), "..");

export function getMarkdownContent(relativePath: string): string {
  const fullPath = path.join(CONTENT_ROOT, relativePath);
  return fs.readFileSync(fullPath, "utf-8");
}

export function getContentPaths(dir: string, pattern = "*.md"): string[] {
  const fullDir = path.join(CONTENT_ROOT, dir);
  if (!fs.existsSync(fullDir)) return [];
  return fs
    .readdirSync(fullDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(".md", ""));
}

export interface NavItem {
  label: string;
  href: string;
  children?: NavItem[];
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export function getNavigation(): NavSection[] {
  return [
    {
      title: "Foundation",
      items: [
        { label: "Core Skill", href: "/docs/foundation" },
      ],
    },
    {
      title: "Commands",
      items: [
        {
          label: "Create",
          href: "/docs/commands",
          children: [
            { label: "/scaffold", href: "/docs/commands/scaffold" },
          ],
        },
        {
          label: "Evaluate",
          href: "/docs/commands",
          children: [
            { label: "/audit", href: "/docs/commands/audit" },
            { label: "/critique", href: "/docs/commands/critique" },
          ],
        },
        {
          label: "Refine",
          href: "/docs/commands",
          children: [
            { label: "/refactor", href: "/docs/commands/refactor" },
            { label: "/tighten", href: "/docs/commands/tighten" },
            { label: "/name", href: "/docs/commands/name" },
          ],
        },
        {
          label: "Simplify",
          href: "/docs/commands",
          children: [
            { label: "/simplify", href: "/docs/commands/simplify" },
            { label: "/extract", href: "/docs/commands/extract" },
          ],
        },
        {
          label: "Harden",
          href: "/docs/commands",
          children: [
            { label: "/harden", href: "/docs/commands/harden" },
            { label: "/polish", href: "/docs/commands/polish" },
          ],
        },
      ],
    },
    {
      title: "Anti-patterns",
      items: [
        { label: "Catalog", href: "/docs/anti-patterns" },
        { label: "Over-defensive", href: "/docs/anti-patterns/over-defensive" },
        { label: "Gratuitous abstraction", href: "/docs/anti-patterns/gratuitous-abstraction" },
        { label: "Naming slop", href: "/docs/anti-patterns/naming-slop" },
        { label: "Comment slop", href: "/docs/anti-patterns/comment-slop" },
        { label: "File organization", href: "/docs/anti-patterns/file-organization" },
        { label: "Boilerplate", href: "/docs/anti-patterns/boilerplate-and-ceremony" },
        { label: "Stylistic tells", href: "/docs/anti-patterns/stylistic-tells" },
        { label: "Security", href: "/docs/anti-patterns/security-and-correctness" },
        { label: "Testing slop", href: "/docs/anti-patterns/testing-slop" },
        { label: "Architectural slop", href: "/docs/anti-patterns/architectural-slop" },
        { label: "Dependency slop", href: "/docs/anti-patterns/dependency-slop" },
        { label: "Review burden", href: "/docs/anti-patterns/review-burden" },
      ],
    },
    {
      title: "Languages",
      items: [
        { label: "TypeScript", href: "/docs/languages/typescript" },
        { label: "Python", href: "/docs/languages/python" },
        { label: "Go", href: "/docs/languages/go" },
        { label: "React", href: "/docs/languages/react" },
      ],
    },
  ];
}
