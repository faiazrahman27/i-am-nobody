import "server-only";

import { timingSafeEqual } from "node:crypto";

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function requireCronSecret() {
  const secret = process.env.CRON_SECRET?.trim();

  if (!secret || secret.length < 32) {
    throw new Error(
      "CRON_SECRET must be configured as a server-only value with at least 32 characters.",
    );
  }

  return secret;
}

export function isAuthorizedCronRequest(request: Request) {
  const expected = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization")?.trim() ?? "";

  if (!expected || expected.length < 32) return false;

  return safeEqual(authorization, `Bearer ${expected}`);
}

export function isAuthorizedInternalGenerationRequest(request: Request) {
  const expected = process.env.CRON_SECRET?.trim();
  const supplied = request.headers.get("x-studio-internal-secret")?.trim() ?? "";

  if (!expected || expected.length < 32) return false;

  return safeEqual(supplied, expected);
}
