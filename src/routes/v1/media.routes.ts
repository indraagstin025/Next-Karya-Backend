import { Router } from "express";
import { MediaController, uploadMiddleware } from "../../controllers/media.controller";
import { requireAuth } from "../../middlewares/auth";
import { validateParams, idParamSchema } from "../../middlewares/validate";
import { rateLimiter } from "../../middlewares/rateLimiter";

const router = Router();
const mediaController = new MediaController();

router.use(requireAuth);

router.get("/", mediaController.getMedia);
router.post(
  "/",
  rateLimiter({ windowSec: 60, maxRequests: 20, prefix: "rl_media_upload" }),
  uploadMiddleware.single("file"),
  mediaController.uploadMedia
);
router.delete("/:id", validateParams(idParamSchema), mediaController.deleteMedia);

export default router;
