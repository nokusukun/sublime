import { getMarkdownContent } from "@/lib/content";
import { renderMarkdown } from "@/lib/markdown";

export const metadata = {
  title: "Foundation",
};

export default async function FoundationPage() {
  const sourcePath = "sublime/SKILL.md";
  const content = getMarkdownContent(sourcePath);
  const html = await renderMarkdown(content, sourcePath);

  return (
    <div
      className="prose"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
