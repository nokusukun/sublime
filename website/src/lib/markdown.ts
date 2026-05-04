import matter from "gray-matter";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import { visit } from "unist-util-visit";
import path from "path";
import type { Root, Element } from "hast";

const COMMANDS = new Set([
  "audit", "critique", "refactor", "tighten", "name",
  "simplify", "extract", "harden", "polish", "scaffold",
]);

const GITHUB_BASE = "https://github.com/nokusukun/sublime/blob/main";

/**
 * Resolve a repo-relative file path to a web route, or a GitHub URL for
 * content that doesn't have its own page.
 */
function repoPathToRoute(repoPath: string): string {
  // Strip leading slashes
  let p = repoPath.replace(/^\/+/, "");

  // Split off any hash fragment
  let hash = "";
  const hashIdx = p.indexOf("#");
  if (hashIdx !== -1) {
    hash = p.slice(hashIdx);
    p = p.slice(0, hashIdx);
  }

  // Normalize trailing slashes
  p = p.replace(/\/+$/, "");

  // sublime/SKILL.md → /docs/foundation
  if (p === "sublime/SKILL.md") return `/docs/foundation${hash}`;

  // {command}/SKILL.md → /docs/commands/{command}
  const cmdMatch = p.match(/^([^/]+)\/SKILL\.md$/);
  if (cmdMatch && COMMANDS.has(cmdMatch[1])) {
    return `/docs/commands/${cmdMatch[1]}${hash}`;
  }

  // anti-patterns/{slug}.md → /docs/anti-patterns/{slug}
  const apMatch = p.match(/^anti-patterns\/([^/]+)\.md$/);
  if (apMatch) {
    const slug = apMatch[1];
    if (slug === "README") return `/docs/anti-patterns${hash}`;
    return `/docs/anti-patterns/${slug}${hash}`;
  }

  // anti-patterns (bare directory) → /docs/anti-patterns
  if (p === "anti-patterns") return `/docs/anti-patterns${hash}`;

  // languages/{lang}/SKILL.md → /docs/languages/{lang}
  const langMatch = p.match(/^languages\/([^/]+)\/SKILL\.md$/);
  if (langMatch) return `/docs/languages/${langMatch[1]}${hash}`;

  // Everything else → GitHub link
  return `${GITHUB_BASE}/${p}${hash}`;
}

function rehypeRewriteLinks(sourcePath: string) {
  const sourceDir = path.dirname(sourcePath);

  return () => (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "a") return;
      const href = node.properties?.href;
      if (typeof href !== "string") return;

      // Skip absolute URLs and anchors
      if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("#")) return;

      // Resolve relative path against the source file's directory
      const resolved = path.normalize(path.join(sourceDir, href));
      node.properties!.href = repoPathToRoute(resolved);
    });
  };
}

export async function renderMarkdown(raw: string, sourcePath: string): Promise<string> {
  const { content } = matter(raw);

  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeSlug)
    .use(rehypeRewriteLinks(sourcePath))
    .use(rehypeHighlight, { detect: true, ignoreMissing: true })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(content);

  return result.toString();
}
