import fs from "fs";
import pdf from "pdf-parse-fixed";

export const parsePDF = async (filePath) => {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdf(dataBuffer);
  return data.text;
};