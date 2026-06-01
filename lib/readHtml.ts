import { readFile } from "node:fs/promises";
import path from "node:path";

type Locale = "it" | "en";
type HtmlFileName = "home.html" | "shop.html";

const HOME_EN_TRANSLATIONS: Array<[string, string]> = [
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
  ["Podcast / video rituali", "Podcast / video rituals"],
  [
    "Una serie di contenuti brevi: una domanda, una soglia, una provocazione. Perfetti per social e newsletter.",
    "A series of short contents: one question, one threshold, one provocation. Perfect for social media and newsletters."
  ],
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
];

function replaceAllText(html: string, translations: Array<[string, string]>) {
  let output = html;

  for (const [from, to] of translations) {
    output = output.split(from).join(to);
  }

  return output;
}

export async function readHtmlFile(fileName: HtmlFileName, locale: Locale) {
  const filePath = path.join(process.cwd(), "content", fileName);
  const html = await readFile(filePath, "utf8");

  if (fileName === "shop.html") {
    return locale === "en"
      ? html.replace('<html lang="it">', '<html lang="en">')
      : html;
  }

  if (locale === "it") {
    return html;
  }

  return replaceAllText(html, HOME_EN_TRANSLATIONS);
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
