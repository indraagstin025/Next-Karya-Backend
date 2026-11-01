import { env } from "../config/env";

export interface RevalidatePayload {
  tag: string;
  action: "update";
}

export async function triggerRevalidationWebhook(
  tag: string,
  retries = 3
): Promise<void> {
  const url = `${env.FRONTEND_URL}/api/revalidate`;
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
          "x-webhook-secret": env.WEBHOOK_SECRET,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(3000),
      });

      if (response.ok) {
        return;
      }
      console.warn(
        `[Webhook] Attempt ${attempt + 1} failed with status: ${response.status}`
      );
    } catch (err: any) {
      console.warn(
        `[Webhook] Attempt ${attempt + 1} request error: ${err.message}`
      );
    }

    if (attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
    }
  }

  console.error(
    `[Webhook] Revalidation for tag "${tag}" failed after ${retries + 1} attempts.`
  );
}
