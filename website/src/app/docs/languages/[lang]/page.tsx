import { getMarkdownContent } from "@/lib/content";
import { renderMarkdown } from "@/lib/markdown";
import type { Metadata } from "next";

const LANGUAGES = ["typescript", "python", "go", "react"] as const;

const DISPLAY_NAMES: Record<string, string> = {
  typescript: "TypeScript",
  python: "Python",
  go: "Go",
  react: "React",
};

export function generateStaticParams() {
  return LANGUAGES.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return {
    title: DISPLAY_NAMES[lang] ?? lang,
  };
}

export default async function LanguagePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const sourcePath = `languages/${lang}/SKILL.md`;
  const content = getMarkdownContent(sourcePath);
  const html = await renderMarkdown(content, sourcePath);

  return (
    <div
      className="prose"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
