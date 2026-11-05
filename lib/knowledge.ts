import fs from "node:fs";
import path from "node:path";

const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge");

/**
 * Removes editor-only content so it can never reach the model: HTML comments,
 * and any line containing the word TODO. Removing these here, rather than
 * asking the model to ignore them, guarantees a placeholder is never quoted.
 */
export function cleanMarkdown(markdown: string): string {
  return markdown
    .replace(/<!--[\s\S]*?-->/g, "")
    .split(/\r?\n/)
    .filter((line) => !/\bTODO\b/.test(line))
    .join("\n")
    .trim();
}

/**
 * Lists the .md files the assistant may use, including in subfolders.
 * Anything starting with an underscore (drafts, templates) and README files
 * are for editors only and are never loaded.
 */
function listKnowledgeFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith("_")) return [];
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listKnowledgeFiles(fullPath);
    const isContent =
      entry.name.endsWith(".md") && entry.name.toLowerCase() !== "readme.md";
    return isContent ? [fullPath] : [];
  });
}

/**
 * Reads the knowledge base into one string. Paths are sorted so the output is
 * byte-identical between requests, which prompt caching relies on.
 */
function readKnowledgeBase(): string {
  return listKnowledgeFiles(KNOWLEDGE_DIR)
    .map((file) => ({
      file,
      name: path.relative(KNOWLEDGE_DIR, file).split(path.sep).join("/"),
    }))
    .sort((a, b) => (a.name < b.name ? -1 : 1))
    .map(({ file, name }) => {
      const content = cleanMarkdown(fs.readFileSync(file, "utf8"));
      return `<document name="${name}">\n${content}\n</document>`;
    })
    .join("\n\n");
}

let cached: string | undefined;

/** The knowledge base, read once per server instance. Edits go live on deploy. */
export function getKnowledgeBase(): string {
  cached ??= readKnowledgeBase();
  return cached;
}
