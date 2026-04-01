export type DatasetChunk = {
  chunkIndex: number;
  content: string;
  charCount: number;
};

function normalizeWhitespace(text: string) {
  return text.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function buildDatasetChunks(input: {
  text: string;
  maxCharsPerChunk?: number;
  overlapChars?: number;
}) {
  const maxChars = Math.max(500, Math.min(input.maxCharsPerChunk ?? 1800, 5000));
  const overlap = Math.max(0, Math.min(input.overlapChars ?? 220, Math.floor(maxChars / 2)));
  const text = normalizeWhitespace(input.text);
  if (!text) return [] satisfies DatasetChunk[];

  const paragraphs = text.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  const chunks: DatasetChunk[] = [];
  let current = "";

  const pushChunk = () => {
    const normalized = current.trim();
    if (!normalized) return;
    chunks.push({
      chunkIndex: chunks.length,
      content: normalized,
      charCount: normalized.length,
    });
  };

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    pushChunk();
    const seed = current.slice(Math.max(0, current.length - overlap)).trim();
    current = seed ? `${seed}\n\n${paragraph}` : paragraph;

    while (current.length > maxChars) {
      const part = current.slice(0, maxChars).trim();
      chunks.push({
        chunkIndex: chunks.length,
        content: part,
        charCount: part.length,
      });
      current = current.slice(Math.max(0, maxChars - overlap)).trim();
    }
  }

  pushChunk();
  return chunks;
}
