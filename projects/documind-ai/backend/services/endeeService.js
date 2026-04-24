let database = [];

export const insertVectors = async (vectors) => {
  database.push(...vectors);
  console.log("DB SIZE:", database.length);
  return { success: true };
};

const similarity = (a, b) => {
  let dot = 0, normA = 0, normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

export const searchVectors = async (queryVector, documentId, question) => {
  const query = question.toLowerCase();

  const results = database
    .filter(v => String(v.metadata.documentId) === String(documentId))
    .map(v => {
      const sim = similarity(queryVector, v.values);
      const text = v.metadata.text.toLowerCase();

      let boost = 0;

      query.split(" ").forEach(word => {
        if (word.length > 3 && text.includes(word)) {
          boost += 0.1;
        }
      });

      return {
        score: sim + boost,
        metadata: v.metadata,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  console.log("FILTERED RESULTS:", results.length);

  return {
    data: {
      matches: results,
    },
  };
};