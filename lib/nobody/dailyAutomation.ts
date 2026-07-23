import "server-only";

import { randomBytes } from "node:crypto";

export const NOBODY_AUTOMATION_TIMEZONE = "Europe/Rome";
export const NOBODY_AUTOMATION_LOCAL_HOUR = 10;
export const NOBODY_AUTOMATION_DAILY_COUNT = 10;

export function getRomeDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: NOBODY_AUTOMATION_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return {
    localDate: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

const CERTIFICATE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function createCertificateCode(date = new Date()) {
  const year = new Intl.DateTimeFormat("en", {
    timeZone: NOBODY_AUTOMATION_TIMEZONE,
    year: "numeric",
  }).format(date);

  const bytes = randomBytes(12);
  const token = Array.from(
    bytes,
    (byte) => CERTIFICATE_ALPHABET[byte % CERTIFICATE_ALPHABET.length],
  ).join("");

  return `IAMN-${year}-${token.slice(0, 4)}-${token.slice(4, 8)}-${token.slice(8, 12)}`;
}
