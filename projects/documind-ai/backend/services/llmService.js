import { pipeline } from "@xenova/transformers";

let generator;

const initModel = async () => {
  if (!generator) {
    generator = await pipeline(
      "text2text-generation",
      "Xenova/flan-t5-small"
    );
    console.log("✅ LLM loaded");
  }
};

export const generateAnswer = async (context, question) => {
  await initModel();

  const prompt = `
You are a helpful assistant.

Rules:
- Answer ONLY using the context
- Ignore emails, links, and noise
- Answer in 1-2 sentences
- If answer not found, say: "Not found in document"

Context:
${context}

Question:
${question}

Answer:
`;

  const result = await generator(prompt, {
    max_new_tokens: 80,
  });

  console.log("LLM RESULT:", result);

  return result?.[0]?.generated_text?.trim() || "No answer generated.";
};