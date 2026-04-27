import { getMarkdownContent } from "@/lib/content";
import { renderMarkdown } from "@/lib/markdown";

export const metadata = {
  title: "Foundation",
};

export default async function FoundationPage() {
  const content = getMarkdownContent("sublime/SKILL.md");
  const html = await renderMarkdown(content);

  return (
    <div
      className="prose"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
