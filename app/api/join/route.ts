import net from "node:net";
import tls from "node:tls";
import { Buffer } from "node:buffer";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_EMAIL_LENGTH = 254;
const MAX_FIELD_LENGTH = 140;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

type JoinPayload = {
  email?: unknown;
  language?: unknown;
  page?: unknown;
  source?: unknown;
};

type SmtpResponse = {
  code: number;
  message: string;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}

function checkRateLimit(key: string) {
  const now = Date.now();
  const existing = rateLimitStore.get(key);

  if (!existing || existing.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (existing.count >= RATE_LIMIT_MAX_REQUESTS) return false;

  existing.count += 1;
  rateLimitStore.set(key, existing);
  return true;
}

function normalizeString(value: unknown, maxLength = MAX_FIELD_LENGTH) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function normalizeEmail(value: unknown) {
  const email = normalizeString(value, MAX_EMAIL_LENGTH).toLowerCase();
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  return valid ? email : "";
}

function sanitizeHeader(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function dotStuff(message: string) {
  return message.replace(/^\./gm, "..");
}

function readResponse(socket: net.Socket | tls.TLSSocket) {
  return new Promise<SmtpResponse>((resolve, reject) => {
    let buffer = "";
    let timeout: NodeJS.Timeout;

    const cleanup = () => {
      clearTimeout(timeout);
      socket.off("data", onData);
      socket.off("error", onError);
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      const lastLine = lines[lines.length - 1];

      if (lastLine && /^\d{3} /.test(lastLine)) {
        cleanup();
        resolve({ code: Number(lastLine.slice(0, 3)), message: buffer });
      }
    };

    timeout = setTimeout(() => {
      cleanup();
      reject(new Error("SMTP response timed out"));
    }, 15000);

    socket.on("data", onData);
    socket.on("error", onError);
  });
}

async function sendCommand(socket: net.Socket | tls.TLSSocket, command: string, expectedCodes: number[]) {
  socket.write(`${command}\r\n`);
  const response = await readResponse(socket);

  if (!expectedCodes.includes(response.code)) {
    throw new Error(`SMTP command failed: ${command} -> ${response.message}`);
  }

  return response;
}

function createPlainSocket(host: string, port: number) {
  return new Promise<net.Socket>((resolve, reject) => {
    const socket = net.connect(port, host, () => resolve(socket));
    socket.once("error", reject);
  });
}

function createTlsSocket(host: string, port: number) {
  return new Promise<tls.TLSSocket>((resolve, reject) => {
    const socket = tls.connect({ host, port, servername: host }, () => resolve(socket));
    socket.once("error", reject);
  });
}

function upgradeToTls(socket: net.Socket, host: string) {
  return new Promise<tls.TLSSocket>((resolve, reject) => {
    const secureSocket = tls.connect({ socket, servername: host }, () => resolve(secureSocket));
    secureSocket.once("error", reject);
  });
}

async function connectSmtp(host: string, port: number, secure: boolean) {
  if (secure) {
    const socket = await createTlsSocket(host, port);
    await readResponse(socket);
    return socket;
  }

  const socket = await createPlainSocket(host, port);
  await readResponse(socket);
  await sendCommand(socket, "EHLO iamnobody.live", [250]);
  await sendCommand(socket, "STARTTLS", [220]);
  const secureSocket = await upgradeToTls(socket, host);
  return secureSocket;
}

async function sendJoinEmail(options: {
  email: string;
  language: string;
  page: string;
  source: string;
  ip: string;
  userAgent: string;
}) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = (process.env.SMTP_SECURE || "true").toLowerCase() !== "false";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const to = process.env.AUTHOR_JOIN_RECIPIENT || "andreamagelli@iamnobody.live";
  const from = process.env.MAIL_FROM || user || "andreamagelli@iamnobody.live";
  const subject = process.env.JOIN_NOTIFICATION_SUBJECT || "New I AM NOBODY join request";

  if (!host || !user || !pass) {
    throw new Error("Missing SMTP configuration");
  }

  const now = new Date();
  const safeTo = sanitizeHeader(to);
  const safeFrom = sanitizeHeader(from);
  const safeSubject = sanitizeHeader(subject);
  const replyTo = sanitizeHeader(options.email);
  const messageId = `<join-${Date.now()}-${Math.random().toString(36).slice(2)}@iamnobody.live>`;

  const body = [
    "New I AM NOBODY join request",
    "",
    `Email: ${options.email}`,
    `Language: ${options.language}`,
    `Page: ${options.page}`,
    `Source: ${options.source}`,
    `IP: ${options.ip}`,
    `User agent: ${options.userAgent}`,
    `Time: ${now.toISOString()}`,
    "",
    "This email was generated from the join form on iamnobody.live.",
  ].join("\r\n");

  const rawEmail = dotStuff([
    `From: I AM NOBODY <${safeFrom}>`,
    `To: ${safeTo}`,
    `Reply-To: ${replyTo}`,
    `Subject: ${safeSubject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    `Date: ${now.toUTCString()}`,
    `Message-ID: ${messageId}`,
    "",
    body,
  ].join("\r\n"));

  const socket = await connectSmtp(host, port, secure);

  try {
    await sendCommand(socket, "EHLO iamnobody.live", [250]);
    await sendCommand(socket, "AUTH LOGIN", [334]);
    await sendCommand(socket, Buffer.from(user).toString("base64"), [334]);
    await sendCommand(socket, Buffer.from(pass).toString("base64"), [235]);
    await sendCommand(socket, `MAIL FROM:<${safeFrom}>`, [250]);
    await sendCommand(socket, `RCPT TO:<${safeTo}>`, [250, 251]);
    await sendCommand(socket, "DATA", [354]);
    socket.write(`${rawEmail}\r\n.\r\n`);
    const dataResponse = await readResponse(socket);

    if (dataResponse.code !== 250) {
      throw new Error(`SMTP DATA failed: ${dataResponse.message}`);
    }

    await sendCommand(socket, "QUIT", [221]);
  } finally {
    socket.destroy();
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);

    if (!checkRateLimit(ip)) {
      return jsonResponse({ ok: false, error: "rate_limited" }, 429);
    }

    const payload = (await request.json()) as JoinPayload;
    const email = normalizeEmail(payload.email);
    const language = normalizeString(payload.language, 8) || "it";
    const page = normalizeString(payload.page, 160) || "/";
    const source = normalizeString(payload.source, 80) || "homepage-newsletter";

    if (!email) {
      return jsonResponse({ ok: false, error: "invalid_email" }, 400);
    }

    await sendJoinEmail({
      email,
      language,
      page,
      source,
      ip,
      userAgent: request.headers.get("user-agent") || "unknown",
    });

    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("Join form email failed", error);
    return jsonResponse({ ok: false, error: "send_failed" }, 500);
  }
}
