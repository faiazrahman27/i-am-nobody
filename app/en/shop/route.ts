import { htmlResponse, readHtmlFile } from "@/lib/readHtml";

export const dynamic = "force-dynamic";

export async function GET() {
  const html = await readHtmlFile("shop-en.html");
  return htmlResponse(html);
}
