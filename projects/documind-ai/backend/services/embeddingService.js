import { pipeline } from "@xenova/transformers";

let extractor;

const initEmbeddingModel = async () => {
  if (!extractor) {
    extractor = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    );
    console.log("✅ Embedding model loaded");
  }
};

export const getEmbedding = async (text) => {
  await initEmbeddingModel();

  // 🔥 normalize text (VERY IMPORTANT)
  const normalized = text
    .toLowerCase()
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const output = await extractor(normalized, {
    pooling: "mean",
    normalize: true,
  });

  return Array.from(output.data);
};