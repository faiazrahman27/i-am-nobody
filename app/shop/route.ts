import { htmlResponse, readHtmlFile } from "@/lib/readHtml";

export const dynamic = "force-dynamic";

export async function GET() {
  const html = await readHtmlFile("shop.html");
  return htmlResponse(html);
}
