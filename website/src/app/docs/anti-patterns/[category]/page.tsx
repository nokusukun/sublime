import { getMarkdownContent } from "@/lib/content";
import { renderMarkdown } from "@/lib/markdown";
import type { Metadata } from "next";

const CATEGORIES = [
  "over-defensive",
  "gratuitous-abstraction",
  "naming-slop",
  "comment-slop",
  "file-organization",
  "boilerplate-and-ceremony",
  "stylistic-tells",
  "security-and-correctness",
  "testing-slop",
  "architectural-slop",
  "dependency-slop",
  "review-burden",
] as const;

export function generateStaticParams() {
  return CATEGORIES.map((category) => ({ category }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const label = category
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return {
    title: label,
  };
}

export default async function AntiPatternCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const sourcePath = `anti-patterns/${category}.md`;
  const content = getMarkdownContent(sourcePath);
  const html = await renderMarkdown(content, sourcePath);

  return (
    <div
      className="prose"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
