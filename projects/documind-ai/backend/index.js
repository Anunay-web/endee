import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import uploadRoutes from "./routes/uploadRoutes.js";
import queryRoutes from "./routes/queryRoutes.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/upload", uploadRoutes);
app.use("/query", queryRoutes);

app.get("/", (req, res) => {
  res.send("Backend running 🚀");
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});