import { env } from "../config/env";
import { IWebhookNotifier } from "../container/types";
import { defaultLogger, ILogger } from "../core/logger";

export interface RevalidatePayload {
  tag: string;
  action: "update";
}

/**
 * Dispatches authenticated cache-revalidation webhooks to the Next.js frontend
 * when published CMS content or site status changes.
 */
export class WebhookNotifier implements IWebhookNotifier {
  constructor(
    private readonly frontendUrl: string = env.FRONTEND_URL,
    private readonly webhookSecret: string = env.WEBHOOK_SECRET,
    private readonly logger: ILogger = defaultLogger
  ) {}

  /**
   * Posts a revalidation tag to `${frontendUrl}/api/revalidate` with exponential backoff
   * (2s, 4s, 8s) and a 3-second per-request timeout so slow frontend responses do not block mutations.
   */
  async triggerRevalidation(tag: string, retries = 3): Promise<void> {
    const url = `${this.frontendUrl}/api/revalidate`;
    const payload: RevalidatePayload = {
      tag,
      action: "update",
    };

    const delays = [2000, 4000, 8000];

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-webhook-secret": this.webhookSecret,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(3000),
        });

        if (response.ok) {
          return;
        }
        this.logger.warn("[Webhook] Revalidation attempt returned non-OK status", {
          tag,
          attempt: attempt + 1,
          status: response.status,
        });
      } catch (err: any) {
        this.logger.warn("[Webhook] Revalidation attempt failed", {
          tag,
          attempt: attempt + 1,
          error: err?.message,
        });
      }

      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
      }
    }

    this.logger.error("[Webhook] Revalidation exhausted all retry attempts", {
      tag,
      maxAttempts: retries + 1,
    });
  }
}

export const defaultWebhookNotifier = new WebhookNotifier();

/**
 * Triggers Next.js ISR cache revalidation for the given tag using the default `WebhookNotifier`.
 */
export async function triggerRevalidationWebhook(
  tag: string,
  retries = 3
): Promise<void> {
  return defaultWebhookNotifier.triggerRevalidation(tag, retries);
}
