import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

const contentDir = path.join(root, "content");
const libDir = path.join(root, "lib");
const appDir = path.join(root, "app");

const files = {
  homeIt: path.join(contentDir, "home.html"),
  shopIt: path.join(contentDir, "shop.html"),
  homeEn: path.join(contentDir, "home-en.html"),
  shopEn: path.join(contentDir, "shop-en.html"),
  readHtml: path.join(libDir, "readHtml.ts"),
  enRoute: path.join(appDir, "en", "route.ts"),
  enShopRoute: path.join(appDir, "en", "shop", "route.ts"),
  itRoute: path.join(appDir, "it", "route.ts"),
  itShopRoute: path.join(appDir, "it", "shop", "route.ts"),
  rootRoute: path.join(appDir, "route.ts"),
  shopRoute: path.join(appDir, "shop", "route.ts"),
};

function replaceAllPairs(input, pairs) {
  let output = input;

  for (const [from, to] of pairs) {
    output = output.split(from).join(to);
  }

  return output;
}

function makeEnglishHome(html) {
  return replaceAllPairs(html, [
    ['<html lang="it">', '<html lang="en">'],
    ["I AM NOBODY — Site Mockup V2", "I AM NOBODY — Official Site"],
    ["Andrea Magelli · progetto editoriale / culturale / esperienziale", "Andrea Magelli · editorial / cultural / experiential project"],
    ["Chi sei quando nessuno ti guarda?", "Who are you when no one is watching?"],
    [
      "Un libro-manifesto, una maschera, venticinque chiavi e un viaggio in quattro soglie: Nobody, Somebody, Anybody, Infinite.",
      "A manifesto-book, a mask, twenty-five keys, and a journey through four thresholds: Nobody, Somebody, Anybody, Infinite."
    ],
    ["Scopri il libro →", "Discover the book →"],
    ["Apri le 25 chiavi", "Open the 25 keys"],
    ["Non sei ciò che mostri.", "You are not what you show."],
    ["Sei ciò che rimane.", "You are what remains."],
    ["Un progetto per tornare interi, non perfetti.", "A project for becoming whole again, not perfect."],
    ["Architettura narrativa", "Narrative architecture"],
    ["Le quattro soglie", "The four thresholds"],
    [
      "Non sono fasi da completare. Sono specchi. Ognuno riflette una domanda diversa.",
      "They are not stages to complete. They are mirrors. Each one reflects a different question."
    ],
    [
      "Il momento in cui il rumore cala e quello che pensavi di essere non coincide più con quello che senti.",
      "The moment when the noise fades and what you thought you were no longer matches what you feel."
    ],
    [
      "Chi sei quando togli tutto quello che ti è stato dato da portare?",
      "Who are you when you remove everything you were told to carry?"
    ],
    [
      "Il ruolo, il nome, il personaggio. Utile finché non prende il tuo posto.",
      "The role, the name, the character. Useful until it takes your place."
    ],
    [
      "Sei tu quel Somebody — o è lui che ha preso il tuo posto?",
      "Are you that Somebody — or has it taken your place?"
    ],
    [
      "Puoi essere chiunque. E invece di sentirti libero, rischi di sentirti perso.",
      "You can be anybody. And instead of feeling free, you may feel lost."
    ],
    [
      "Cosa succede quando i Nobody si riconoscono?",
      "What happens when the Nobodies recognize each other?"
    ],
    [
      "Quello che nessun sistema raggiunge: l’irripetibile, il sogno, la legacy.",
      "What no system can reach: the unrepeatable, the dream, the legacy."
    ],
    [
      "Cosa c’è in te che nessun algoritmo potrà mai misurare?",
      "What is inside you that no algorithm will ever be able to measure?"
    ],
    ["Il libro", "The book"],
    ["Libro, oggetto, rito.", "Book, object, ritual."],
    [
      "Una pubblicazione pensata come esperienza: pagine manifesto, domande, soglie, chiavi, spazi di silenzio e una voce personale che tiene insieme identità, corpo, algoritmo, sogno e legacy.",
      "A publication designed as an experience: manifesto pages, questions, thresholds, keys, spaces of silence, and a personal voice connecting identity, body, algorithm, dream, and legacy."
    ],
    ["Release simbolica", "Symbolic release"],
    ["Chiavi / domande", "Keys / questions"],
    ["Soglie narrative", "Narrative thresholds"],
    ["Oggetto derivato", "Derived object"],
    ["Le 25 chiavi", "The 25 keys"],
    [
      "Non sono risposte. Sono aperture. Un mazzo di domande, un poster, una performance, un rituale collettivo.",
      "They are not answers. They are openings. A deck of questions, a poster, a performance, a collective ritual."
    ],
    ["Quante volte lasci decidere all’algoritmo?", "How often do you let the algorithm decide?"],
    ["Se spegnessi tutto, cosa resterebbe acceso?", "If you turned everything off, what would remain lit?"],
    [
      "L’AI può aiutarti a produrre. Ma tu cosa vuoi generare?",
      "AI can help you produce. But what do you want to generate?"
    ],
    ["Chi sarai quando tutto finirà?", "Who will you be when everything ends?"],
    ["Ricevi le chiavi in anteprima", "Receive the keys in preview"],
    ["Estensioni possibili", "Possible extensions"],
    ["Da libro a piattaforma", "From book to platform"],
    ["Il sito non deve vendere solo un libro. Deve aprire un universo.", "The site should not only sell a book. It should open a universe."],
    ["Editoriale", "Editorial"],
    ["Libro + card deck", "Book + card deck"],
    [
      "Vendita libro, poster A3, mazzo “Le 25 Chiavi”, edizioni limitate numerate e bundle regalo.",
      "Book sales, A3 posters, “The 25 Keys” deck, numbered limited editions, and gift bundles."
    ],
    ["Media", "Media"],
    ["Podcast / video rituali", "Podcast / video rituals"],
    [
      "Una serie di contenuti brevi: una domanda, una soglia, una provocazione. Perfetti per social e newsletter.",
      "A series of short contents: one question, one threshold, one provocation. Perfect for social media and newsletters."
    ],
    ["Live / corporate", "Live / corporate"],
    ["Keynote + workshop", "Keynote + workshop"],
    [
      "Format per aziende, scuole, community e festival: identità, AI, corpo, ruoli, sogno e legacy.",
      "Formats for companies, schools, communities, and festivals: identity, AI, body, roles, dream, and legacy."
    ],
    ["Entra nella soglia.", "Enter the threshold."],
    ["Una domanda alla volta. Nessun rumore. Solo ciò che resta.", "One question at a time. No noise. Only what remains."],
    ['placeholder="la tua email"', 'placeholder="your email"'],
    ["Viaggio dentro. Ritorno a te.", "Journey within. Return to yourself."],
    [">Soglie<", ">Thresholds<"],
    [">Libro<", ">Book<"],
    [">25 Chiavi<", ">25 Keys<"],
    [">Esperienze<", ">Experiences<"],
    ['href="/shop">Shop</a>', 'href="/en/shop">Shop</a>'],
    ['href="#top">I AM <span>NOBODY</span>', 'href="/en">I AM <span>NOBODY</span>'],
  ]);
}

function makeEnglishShop(html) {
  return replaceAllPairs(html, [
    ['<html lang="it">', '<html lang="en">'],
    ["I AM Nobody — Shop", "I AM Nobody — Shop"],
    [">Il libro<", ">The book<"],
    [">Le soglie<", ">Thresholds<"],
    [">Eventi<", ">Events<"],
    [">Aziende<", ">Companies<"],
    [">Carrello", ">Cart"],
    ["I AM Nobody · Shop", "I AM Nobody · Shop"],
    ["OGGETTI<br>CHE RESTANO.", "OBJECTS<br>THAT REMAIN."],
    [
      "Non merchandising. Strumenti. Ogni oggetto è un modo diverso di portare la domanda con te.",
      "Not merchandise. Tools. Every object is a different way to carry the question with you."
    ],
    [">Tutto<", ">All<"],
    [">Libri<", ">Books<"],
    [">Le 25 Chiavi<", ">The 25 Keys<"],
    [">Manifesti<", ">Posters<"],
    [">Postcard<", ">Postcards<"],
    [">Bundle<", ">Bundles<"],
    ["<!-- ══ IL LIBRO ══ -->", "<!-- ══ THE BOOK ══ -->"],
    ["Il libro", "The book"],
    ["IL LIBRO", "THE BOOK"],
    [
      "Disponibile in italiano e inglese, in edizione standard e in edizione speciale numerata.",
      "Available in Italian and English, in standard edition and numbered special edition."
    ],
    ["Libro IT", "Italian book"],
    ["Libro EN", "English book"],
    ["EDIZIONE SPECIALE", "SPECIAL EDITION"],
    ["Edizione speciale", "Special edition"],
    ["edizione speciale", "special edition"],
    ["Numerata", "Numbered"],
    ["numerata", "numbered"],
    ["Aggiungi", "Add"],
    ["AGGIUNGI", "ADD"],
    ["Compra", "Buy"],
    ["COMPRA", "BUY"],
    ["Quick view", "Quick view"],
    ["Anteprima", "Preview"],
    ["ANTEPRIMA", "PREVIEW"],
    ["Nuovo", "New"],
    ["NUOVO", "NEW"],
    ["Limitato", "Limited"],
    ["LIMITATO", "LIMITED"],
    ["Digitale", "Digital"],
    ["DIGITALE", "DIGITAL"],
    ["Mazzo", "Deck"],
    ["mazzo", "deck"],
    ["Domande", "Questions"],
    ["domande", "questions"],
    ["Poster", "Poster"],
    ["Manifesto", "Poster"],
    ["manifesto", "poster"],
    ["Postcard", "Postcard"],
    ["Singola", "Single"],
    ["singola", "single"],
    ["Per chi guida", "For those who lead"],
    ["Per chi cresce", "For those who grow"],
    ["Per chi ama", "For those who love"],
    ["Per chi costruisce", "For those who build"],
    ["TUTTO IAM NOBODY", "ALL IAM NOBODY"],
    ["Tutto IAM NOBODY", "All IAM NOBODY"],
    ["Risparmi", "You save"],
    ["risparmi", "you save"],
    ["Include", "Includes"],
    ["include", "includes"],
    ["Oggetti", "Objects"],
    ["oggetti", "objects"],
    ["che restano", "that remain"],
    ["CHE RESTANO", "THAT REMAIN"],
    ["Spedizione", "Shipping"],
    ["spedizione", "shipping"],
    ["Consegna", "Delivery"],
    ["consegna", "delivery"],
    ["Download", "Download"],
    ["download", "download"],
    ["Email", "Email"],
    ["email", "email"],
    ["Footer", "Footer"],
    ["Torna al sito", "Back to site"],
    ["Privacy", "Privacy"],
    ["Termini", "Terms"],
    ["Rimborsi", "Refunds"],
    ["Contatti", "Contact"],
    ['href="#" class="nav-logo"', 'href="/en" class="nav-logo"'],
    ['href="#" class="active">Shop</a>', 'href="/en/shop" class="active">Shop</a>'],
  ]);
}

await mkdir(path.join(appDir, "en"), { recursive: true });
await mkdir(path.join(appDir, "en", "shop"), { recursive: true });
await mkdir(path.join(appDir, "it"), { recursive: true });
await mkdir(path.join(appDir, "it", "shop"), { recursive: true });
await mkdir(libDir, { recursive: true });

const homeIt = await readFile(files.homeIt, "utf8");
const shopIt = await readFile(files.shopIt, "utf8");

const homeEn = makeEnglishHome(homeIt);
const shopEn = makeEnglishShop(shopIt);

await writeFile(files.homeEn, homeEn, "utf8");
await writeFile(files.shopEn, shopEn, "utf8");

await writeFile(
  files.readHtml,
  `import { readFile } from "node:fs/promises";
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
`,
  "utf8"
);

await writeFile(
  files.rootRoute,
  `import { htmlResponse, readHtmlFile } from "@/lib/readHtml";

export const dynamic = "force-dynamic";

export async function GET() {
  const html = await readHtmlFile("home.html");
  return htmlResponse(html);
}
`,
  "utf8"
);

await writeFile(
  files.shopRoute,
  `import { htmlResponse, readHtmlFile } from "@/lib/readHtml";

export const dynamic = "force-dynamic";

export async function GET() {
  const html = await readHtmlFile("shop.html");
  return htmlResponse(html);
}
`,
  "utf8"
);

await writeFile(
  files.itRoute,
  `import { htmlResponse, readHtmlFile } from "@/lib/readHtml";

export const dynamic = "force-dynamic";

export async function GET() {
  const html = await readHtmlFile("home.html");
  return htmlResponse(html);
}
`,
  "utf8"
);

await writeFile(
  files.itShopRoute,
  `import { htmlResponse, readHtmlFile } from "@/lib/readHtml";

export const dynamic = "force-dynamic";

export async function GET() {
  const html = await readHtmlFile("shop.html");
  return htmlResponse(html);
}
`,
  "utf8"
);

await writeFile(
  files.enRoute,
  `import { htmlResponse, readHtmlFile } from "@/lib/readHtml";

export const dynamic = "force-dynamic";

export async function GET() {
  const html = await readHtmlFile("home-en.html");
  return htmlResponse(html);
}
`,
  "utf8"
);

await writeFile(
  files.enShopRoute,
  `import { htmlResponse, readHtmlFile } from "@/lib/readHtml";

export const dynamic = "force-dynamic";

export async function GET() {
  const html = await readHtmlFile("shop-en.html");
  return htmlResponse(html);
}
`,
  "utf8"
);

console.log("Done.");
console.log("Italian:");
console.log("  /       -> content/home.html");
console.log("  /shop   -> content/shop.html");
console.log("  /it     -> content/home.html");
console.log("  /it/shop -> content/shop.html");
console.log("");
console.log("English:");
console.log("  /en      -> content/home-en.html");
console.log("  /en/shop -> content/shop-en.html");
