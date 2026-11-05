/**
 * MIME types accepted by the media library, mapped to the extension used for stored object paths.
 */
export const MEDIA_MIME_EXTENSIONS = {
  "image/webp": ".webp",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/svg+xml": ".svg",
  "application/pdf": ".pdf",
} as const;

export type MediaMimeType = keyof typeof MEDIA_MIME_EXTENSIONS;

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const PDF_MAX_BYTES = 10 * 1024 * 1024;

export const MEDIA_MIME_TYPES = Object.keys(MEDIA_MIME_EXTENSIONS) as MediaMimeType[];

/**
 * Returns the upload ceiling for a MIME type, or `null` when the type is not supported.
 */
export function maxBytesForMime(mimeType: string): number | null {
  if (!Object.prototype.hasOwnProperty.call(MEDIA_MIME_EXTENSIONS, mimeType)) {
    return null;
  }
  return mimeType === "application/pdf" ? PDF_MAX_BYTES : IMAGE_MAX_BYTES;
}

/**
 * Returns the canonical file extension for an allowed MIME type.
 */
export function extensionForMime(mimeType: string): string {
  const extension = MEDIA_MIME_EXTENSIONS[mimeType as MediaMimeType];
  return typeof extension === "string" ? extension : ".bin";
}
