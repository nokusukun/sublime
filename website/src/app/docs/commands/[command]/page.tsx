import { getMarkdownContent } from "@/lib/content";
import { renderMarkdown } from "@/lib/markdown";
import type { Metadata } from "next";

const COMMANDS = [
  "audit",
  "critique",
  "refactor",
  "tighten",
  "name",
  "simplify",
  "extract",
  "harden",
  "polish",
  "scaffold",
] as const;

export function generateStaticParams() {
  return COMMANDS.map((command) => ({ command }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ command: string }>;
}): Promise<Metadata> {
  const { command } = await params;
  const label = command.charAt(0).toUpperCase() + command.slice(1);
  return {
    title: `/${command} — ${label}`,
  };
}

export default async function CommandPage({
  params,
}: {
  params: Promise<{ command: string }>;
}) {
  const { command } = await params;
  const content = getMarkdownContent(`${command}/SKILL.md`);
  const html = await renderMarkdown(content);

  return (
    <div
      className="prose"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
