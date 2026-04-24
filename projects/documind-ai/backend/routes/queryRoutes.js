import express from "express";
const router = express.Router();

import { queryDocument } from "../controllers/queryController.js";

router.post("/", queryDocument);

export default router;