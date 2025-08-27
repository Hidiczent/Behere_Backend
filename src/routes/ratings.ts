import { Router } from "express";
import { createRating } from "../controllers/ratings.controller";
import requireAuth from "../middlewares/requireAuth";

const router = Router();

// POST /ratings
router.post("/",requireAuth, createRating);

export default router;
