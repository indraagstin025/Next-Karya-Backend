import { NextFunction, Request, Response, Router } from "express";
import { appContainer, AppContainer } from "../../container";
import { uploadMiddleware } from "../../controllers/media.controller";
import { validateBody, validateParams, idParamSchema } from "../../middlewares/validate";
import {
  confirmMediaUploadSchema,
  createMediaUploadUrlSchema,
  updateMediaSchema,
} from "../../validators/media";
import { sendError } from "../../utils/response";

/**
 * Creates the `/media` router with direct-upload endpoints plus the legacy local
 * multipart fallback, which is disabled when Supabase Storage is the active driver.
 */
export function createMediaRouter(container: AppContainer = appContainer): Router {
  const router = Router();
  const { media: mediaController } = container.controllers;
  const { requireAuth, rateLimiter } = container.middlewares;

  const rejectMultipartWhenDirect = (
    _req: Request,
    res: Response,
    next: NextFunction
  ) => {
    if (container.env.STORAGE_DRIVER === "supabase") {
      return sendError(
        res,
        400,
        "DIRECT_UPLOAD_REQUIRED",
        "Unggah berkas harus langsung ke penyimpanan media. Muat ulang halaman lalu coba lagi."
      );
    }
    next();
  };

  router.use(requireAuth);

  router.get("/", mediaController.getMedia);

  router.post(
    "/upload-url",
    rateLimiter({ windowSec: 60, maxRequests: 20, prefix: "rl_media_upload_url" }),
    validateBody(createMediaUploadUrlSchema),
    mediaController.createUploadUrl
  );

  router.post(
    "/confirm",
    rateLimiter({ windowSec: 60, maxRequests: 30, prefix: "rl_media_confirm" }),
    validateBody(confirmMediaUploadSchema),
    mediaController.confirmUpload
  );

  router.post(
    "/",
    rejectMultipartWhenDirect,
    rateLimiter({ windowSec: 60, maxRequests: 20, prefix: "rl_media_upload" }),
    uploadMiddleware.single("file"),
    mediaController.uploadMedia
  );

  router.patch(
    "/:id",
    validateParams(idParamSchema),
    validateBody(updateMediaSchema),
    mediaController.updateMedia
  );

  router.delete("/:id", validateParams(idParamSchema), mediaController.deleteMedia);

  return router;
}

export default createMediaRouter();
