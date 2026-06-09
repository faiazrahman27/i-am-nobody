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
  ["Spazi dal vivo", "Live spaces"],
  ["Eventi e rituali", "Events and rituals"],
  ["Nessuna introduzione. Spazi in cui la domanda diventa collettiva.", "No introductions. Spaces where the question becomes collective."],
  ["18 giugno 2026 - Milano", "June 18, 2026 - Milan"],
  ["Luogo da annunciare - 19:00", "Location to be announced - 7:00 pm"],
  ["Luglio 2026 - Bologna", "July 2026 - Bologna"],
  ["Una sera, una domanda.", "One evening, one question."],
  ["Settembre 2026", "September 2026"],
  ["Workshop per aziende.", "Company workshop."],
  ["Ottobre 2026 - Roma", "October 2026 - Rome"],
  ["Internazionale - TBD", "International - TBD"],
  ["Edizione inglese.", "English edition."],
  ["Conversazioni con chi ha fatto i conti con la domanda. Con o senza maschera.", "Conversations with those who have come to terms with the question. With or without a mask."],
  ["Chi sei quando perdi tutto", "Who you are when you lose everything"],
  ["Con Andrea Magelli - episodio di lancio", "With Andrea Magelli - launch episode"],
  ["48 min - 18 giugno 2026", "48 min - June 18, 2026"],
  ["Il ruolo che ti ha occupato", "The role that occupied you"],
  ["Ospite da annunciare", "Guest to be announced"],
  ["Coming soon - luglio 2026", "Coming soon - July 2026"],
  ["Costruire insieme senza perdersi", "Build together without getting lost"],
  ["L'algoritmo non sa chi sei", "The algorithm doesn't know who you are"],
  ["Coming soon - agosto 2026", "Coming soon - August 2026"],
  ['aria-label="Ascolta episodio 01"', 'aria-label="Listen to episode 01"'],
  ['aria-label="Ascolta episodio 02"', 'aria-label="Listen to episode 02"'],
  ['aria-label="Ascolta episodio 03"', 'aria-label="Listen to episode 03"'],
  ['aria-label="Ascolta episodio 04"', 'aria-label="Listen to episode 04"'],
  ["Entra nella soglia.", "Enter the threshold."],
  ["Una domanda alla volta. Nessun rumore. Solo ciò che resta.", "One question at a time. No noise. Only what remains."],
  ['placeholder="la tua email"', 'placeholder="your email"'],
  ["Viaggio dentro. Ritorno a te.", "Journey within. Return to yourself."],
  [">Soglie<", ">Thresholds<"],
  [">Libro<", ">Book<"],
  [">25 Chiavi<", ">25 Keys<"],
  [">Eventi<", ">Events<"],
  ['href="/shop">Shop</a>', 'href="/en/shop">Shop</a>'],
  ['href="#top">I AM <span>NOBODY</span>', 'href="/en">I AM <span>NOBODY</span>'],
];

const CONSENT_BANNER_STYLES = `<style id="iam-cookie-consent-styles">
.iam-cookie-banner{position:fixed;left:20px;right:20px;bottom:20px;z-index:3000;width:min(760px,calc(100vw - 40px));display:none;background:rgba(5,5,5,.96);color:#fff;border:1px solid rgba(255,255,255,.14);box-shadow:0 22px 70px rgba(0,0,0,.42);backdrop-filter:blur(18px);font-family:'DM Sans',Arial,sans-serif;}
.iam-cookie-banner.is-visible{display:block;}
.iam-cookie-banner-inner{padding:22px;display:grid;gap:16px;}
.iam-cookie-eyebrow{font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#d4a017;font-weight:700;}
.iam-cookie-title{font-family:'Bebas Neue',Arial,sans-serif;font-size:28px;line-height:1;color:#fff;letter-spacing:.6px;margin:0;}
.iam-cookie-text{font-family:'Cormorant Garamond',Georgia,serif;font-size:16px;line-height:1.55;color:rgba(255,255,255,.72);margin:0;}
.iam-cookie-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.iam-cookie-btn{border:1px solid rgba(255,255,255,.2);background:transparent;color:#fff;min-height:40px;padding:0 15px;font-family:'DM Sans',Arial,sans-serif;font-size:9px;letter-spacing:2px;text-transform:uppercase;cursor:pointer;transition:background .24s ease,color .24s ease,border-color .24s ease,transform .24s ease;}
.iam-cookie-btn:hover{transform:translateY(-1px);border-color:rgba(255,255,255,.46);}
.iam-cookie-btn.primary{background:#fff;color:#050505;border-color:#fff;}
.iam-cookie-btn.primary:hover{background:#2eaa8a;color:#fff;border-color:#2eaa8a;}
.iam-cookie-details{display:none;border-top:1px solid rgba(255,255,255,.1);padding-top:14px;}
.iam-cookie-banner[data-expanded="true"] .iam-cookie-details{display:grid;gap:12px;}
.iam-cookie-row{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.08);}
.iam-cookie-row:last-child{border-bottom:0;}
.iam-cookie-row strong{display:block;font-size:10px;letter-spacing:2px;text-transform:uppercase;margin-bottom:5px;}
.iam-cookie-row span{display:block;font-family:'Cormorant Garamond',Georgia,serif;font-size:15px;line-height:1.45;color:rgba(255,255,255,.64);}
.iam-cookie-switch{flex:0 0 auto;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,.58);border:1px solid rgba(255,255,255,.16);padding:8px 10px;}
.iam-cookie-settings-link{border:0;background:transparent;color:inherit;font:inherit;letter-spacing:inherit;text-transform:inherit;padding:0;cursor:pointer;transition:color .24s ease;}
.iam-cookie-settings-link:hover{color:#fff;}
@media(max-width:620px){.iam-cookie-banner{left:12px;right:12px;bottom:12px;width:calc(100vw - 24px);}.iam-cookie-banner-inner{padding:18px;}.iam-cookie-actions{align-items:stretch;}.iam-cookie-btn{width:100%;}.iam-cookie-row{flex-direction:column;gap:10px;}}
@media(prefers-reduced-motion:reduce){.iam-cookie-banner *{transition:none!important;}}
</style>`;

const CONSENT_BANNER_MARKUP = `<div class="iam-cookie-banner" data-cookie-banner data-expanded="false" role="dialog" aria-modal="false" aria-labelledby="iamCookieTitle" hidden>
  <div class="iam-cookie-banner-inner">
    <div>
      <span class="iam-cookie-eyebrow" data-cookie-copy="eyebrow">Privacy &amp; cookies</span>
      <h2 class="iam-cookie-title" id="iamCookieTitle" data-cookie-copy="title">Cookie settings</h2>
    </div>
    <p class="iam-cookie-text" data-cookie-copy="body"></p>
    <div class="iam-cookie-actions">
      <button class="iam-cookie-btn primary" type="button" data-cookie-accept></button>
      <button class="iam-cookie-btn" type="button" data-cookie-reject></button>
      <button class="iam-cookie-btn" type="button" data-cookie-toggle aria-expanded="false" aria-controls="iamCookieDetails"></button>
    </div>
    <div class="iam-cookie-details" id="iamCookieDetails">
      <div class="iam-cookie-row">
        <div><strong data-cookie-copy="necessaryTitle"></strong><span data-cookie-copy="necessaryBody"></span></div>
        <span class="iam-cookie-switch" data-cookie-copy="alwaysOn"></span>
      </div>
      <div class="iam-cookie-row">
        <div><strong data-cookie-copy="optionalTitle"></strong><span data-cookie-copy="optionalBody"></span></div>
        <span class="iam-cookie-switch" data-cookie-copy="off"></span>
      </div>
      <button class="iam-cookie-btn primary" type="button" data-cookie-save></button>
    </div>
  </div>
</div>`;

const CONSENT_BANNER_SCRIPT = `<script id="iam-cookie-consent-script">
(function(){
  var STORAGE_KEY = 'iamNobodyCookieConsentV1';
  var COPY = {
    it: {
      eyebrow:'Privacy & cookies',
      title:'Impostazioni cookie',
      body:'Usiamo solo cookie e tecnologie equivalenti necessari per carrello, lingua, sicurezza e checkout. Non attiviamo cookie analytics o marketing. Shopify puo usare cookie tecnici quando apri il checkout.',
      accept:'Accetta necessari',
      reject:'Rifiuta opzionali',
      settings:'Impostazioni',
      save:'Salva impostazioni',
      necessaryTitle:'Necessari',
      necessaryBody:'Sempre attivi: mantengono carrello, preferenze essenziali, sicurezza e funzionamento dello shop.',
      optionalTitle:'Analytics e marketing',
      optionalBody:'Non sono attivi su questo sito. Se verranno aggiunti, saranno bloccati finche non scegli di abilitarli.',
      alwaysOn:'Sempre attivi',
      off:'Non attivi',
      footer:'Cookie'
    },
    en: {
      eyebrow:'Privacy & cookies',
      title:'Cookie settings',
      body:'We use only cookies and equivalent technologies needed for cart, language, security, and checkout. We do not enable analytics or marketing cookies. Shopify may use technical cookies when you open checkout.',
      accept:'Accept necessary',
      reject:'Reject optional',
      settings:'Settings',
      save:'Save settings',
      necessaryTitle:'Necessary',
      necessaryBody:'Always on: they keep cart, essential preferences, security, and shop functionality working.',
      optionalTitle:'Analytics and marketing',
      optionalBody:'Not active on this site. If they are added later, they will stay blocked until you choose to enable them.',
      alwaysOn:'Always on',
      off:'Off',
      footer:'Cookie settings'
    }
  };

  function getLang(){
    return document.documentElement.lang === 'en' || window.location.pathname.indexOf('/en') === 0 ? 'en' : 'it';
  }

  function getConsent(){
    try{
      var raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    }catch(_error){
      return null;
    }
  }

  function saveConsent(source){
    var value = {
      version:1,
      necessary:true,
      analytics:false,
      marketing:false,
      source:source,
      updatedAt:new Date().toISOString()
    };
    try{
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    }catch(_error){}
    window.dispatchEvent(new CustomEvent('iamNobodyCookieConsent', { detail:value }));
    return value;
  }

  function setCopy(root){
    var lang = getLang();
    var copy = COPY[lang] || COPY.it;
    root.querySelectorAll('[data-cookie-copy]').forEach(function(el){
      var key = el.getAttribute('data-cookie-copy');
      if(copy[key]) el.textContent = copy[key];
    });
    var accept = root.querySelector('[data-cookie-accept]');
    var reject = root.querySelector('[data-cookie-reject]');
    var toggle = root.querySelector('[data-cookie-toggle]');
    var save = root.querySelector('[data-cookie-save]');
    if(accept) accept.textContent = copy.accept;
    if(reject) reject.textContent = copy.reject;
    if(toggle) toggle.textContent = copy.settings;
    if(save) save.textContent = copy.save;
  }

  function setBannerVisible(root, visible){
    root.hidden = !visible;
    root.classList.toggle('is-visible', visible);
  }

  function appendFooterSettings(){
    var footerLinks = document.querySelector('.footer-links');
    if(!footerLinks || footerLinks.querySelector('[data-cookie-open]')) return;
    footerLinks.appendChild(document.createTextNode(' \\u00B7 '));
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'iam-cookie-settings-link';
    button.setAttribute('data-cookie-open', '');
    button.textContent = (COPY[getLang()] || COPY.it).footer;
    button.addEventListener('click', function(){
      var banner = document.querySelector('[data-cookie-banner]');
      if(!banner) return;
      setCopy(banner);
      setBannerVisible(banner, true);
      banner.setAttribute('data-expanded', 'true');
      var toggle = banner.querySelector('[data-cookie-toggle]');
      if(toggle) toggle.setAttribute('aria-expanded', 'true');
    });
    footerLinks.appendChild(button);
  }

  function init(){
    var banner = document.querySelector('[data-cookie-banner]');
    if(!banner) return;
    setCopy(banner);
    var toggle = banner.querySelector('[data-cookie-toggle]');

    if(toggle){
      toggle.addEventListener('click', function(){
        var expanded = banner.getAttribute('data-expanded') === 'true';
        banner.setAttribute('data-expanded', String(!expanded));
        toggle.setAttribute('aria-expanded', String(!expanded));
      });
    }

    banner.querySelectorAll('[data-cookie-accept],[data-cookie-reject],[data-cookie-save]').forEach(function(button){
      button.addEventListener('click', function(){
        saveConsent(button.hasAttribute('data-cookie-accept') ? 'accept-necessary' : button.hasAttribute('data-cookie-reject') ? 'reject-optional' : 'save-settings');
        setBannerVisible(banner, false);
      });
    });

    appendFooterSettings();
    var observer = new MutationObserver(appendFooterSettings);
    observer.observe(document.body, { childList:true, subtree:true });

    if(!getConsent()){
      setBannerVisible(banner, true);
    }
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  }else{
    init();
  }
})();
</script>`;

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

function injectConsentBanner(html: string) {
  let output = html;

  if (!output.includes('id="iam-cookie-consent-styles"')) {
    output = output.replace(/<\/head>/i, `${CONSENT_BANNER_STYLES}</head>`);
  }

  if (!output.includes('data-cookie-banner')) {
    output = output.replace(/<\/body>/i, `${CONSENT_BANNER_MARKUP}${CONSENT_BANNER_SCRIPT}</body>`);
  }

  return output;
}

export function htmlResponse(html: string) {
  return new Response(injectConsentBanner(html), {
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
