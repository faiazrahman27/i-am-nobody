import { readFile } from "node:fs/promises";
import path from "node:path";

export type HtmlFileName =
  | "home.html"
  | "shop.html"
  | "home-en.html"
  | "shop-en.html";

export async function readHtmlFile(fileName: HtmlFileName) {
  const filePath = path.join(process.cwd(), "content", fileName);
  return readFile(filePath, "utf8");
}

export function htmlResponse(html: string) {
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "DENY",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    },
  });
}
