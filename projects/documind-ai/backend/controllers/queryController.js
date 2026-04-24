import { getEmbedding } from "../services/embeddingService.js";
import { searchVectors } from "../services/endeeService.js";
import { generateAnswer } from "../services/llmService.js";

export const queryDocument = async (req, res) => {
  try {
    const { question, documentId } = req.body;

    if (!question) {
      return res.status(400).json({ error: "Question is required" });
    }

    const q = question.toLowerCase();

    // 🔹 embedding
    const queryVector = await getEmbedding(question);

    // 🔹 retrieval
    const results = await searchVectors(queryVector, documentId, question);
    const matches = results?.data?.matches || [];

    if (!matches.length) {
      return res.json({ answer: "No relevant information found." });
    }

    // 🔹 select best chunks
    const topMatches = matches
      .filter(m => m.score > 0.2) // 🔥 lower threshold
      .slice(0, 5);

    const rawContext = topMatches
      .map(m => m.metadata.text)
      .join("\n---\n");

    // 🔹 clean context (GENERIC)
    const cleanedContext = rawContext
      .split("\n")
      .map(l => l.trim())
      .filter(line => {
        if (line.length < 20) return false;
        if (line.split(" ").length < 5) return false;
        if (/\S+@\S+\.\S+/.test(line)) return false;
        if (/https?:\/\/\S+/.test(line)) return false;
        return true;
      })
      .join("\n");

    if (!cleanedContext) {
      return res.json({ answer: "No useful content found." });
    }

    // 🔥 COUNT QUESTIONS
    if (q.includes("how many") || q.includes("number of")) {
      const count = cleanedContext
        .split("\n")
        .filter(line => line.includes("-") || line.includes("–")).length;

      return res.json({
        answer:
          count > 0
            ? `There are ${count} items mentioned in the document.`
            : "Could not determine count.",
      });
    }

    // 🔥 "WHO / WHAT" GENERIC HANDLING
    if (q.startsWith("who") || q.startsWith("what")) {
      const bestLine = cleanedContext
        .split("\n")
        .sort((a, b) => b.length - a.length)[0];

      if (bestLine) {
        return res.json({ answer: bestLine });
      }
    }

    // 🔹 LLM fallback
    const limitedContext = cleanedContext.slice(0, 1000);
    const answer = await generateAnswer(limitedContext, question);

    return res.json({ answer });

  } catch (err) {
    console.error("QUERY ERROR:", err);
    return res.status(500).json({ error: "Query failed" });
  }
};