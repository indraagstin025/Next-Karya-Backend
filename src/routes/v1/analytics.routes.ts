import { Router } from "express";
import { AnalyticsController } from "../../controllers/analytics.controller";
import { requireAuth } from "../../middlewares/auth";

const router = Router();
const analyticsController = new AnalyticsController();

router.use(requireAuth);

router.get("/overview", analyticsController.getOverview);
router.get("/pages", analyticsController.getPages);
router.get("/sources", analyticsController.getSources);

export default router;
