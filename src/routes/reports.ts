import { Router } from "express";
import { createReportController } from "../controllers/reports.controller";
import requireAuth from "../middlewares/requireAuth";

const router = Router();

// POST /reports
router.post("/", requireAuth, createReportController);

export default router;
