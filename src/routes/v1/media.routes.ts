import { Router } from "express";
import { appContainer, AppContainer } from "../../container";
import { uploadMiddleware } from "../../controllers/media.controller";
import { validateParams, idParamSchema } from "../../middlewares/validate";

export function createMediaRouter(container: AppContainer = appContainer): Router {
  const router = Router();
  const { media: mediaController } = container.controllers;
  const { requireAuth, rateLimiter } = container.middlewares;

  router.use(requireAuth);

  router.get("/", mediaController.getMedia);
  router.post(
    "/",
    rateLimiter({ windowSec: 60, maxRequests: 20, prefix: "rl_media_upload" }),
    uploadMiddleware.single("file"),
    mediaController.uploadMedia
  );
  router.delete("/:id", validateParams(idParamSchema), mediaController.deleteMedia);

  return router;
}

export default createMediaRouter();
