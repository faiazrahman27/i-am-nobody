import { htmlResponse, readHtmlFile } from "@/lib/readHtml";

export const dynamic = "force-dynamic";

export async function GET() {
  const html = await readHtmlFile("home.html", "it");
  return htmlResponse(html);
}
