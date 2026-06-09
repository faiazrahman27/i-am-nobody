import { htmlResponse } from "@/lib/readHtml";

type Locale = "it" | "en";
type LegalSlug = "privacy" | "cookies" | "shipping" | "returns";

type LegalSection = {
  title: string;
  body: string[];
};

type LegalPage = {
  eyebrow: string;
  title: string;
  intro: string;
  updated: string;
  sections: LegalSection[];
};

const legalPages: Record<LegalSlug, Record<Locale, LegalPage>> = {
  privacy: {
    it: {
      eyebrow: "Dati personali",
      title: "Privacy",
      intro: "Come vengono trattati i dati quando navighi, acquisti o ci scrivi.",
      updated: "Aggiornato il 9 giugno 2026",
      sections: [
        {
          title: "Titolare",
          body: [
            "Il titolare del trattamento &egrave; I AM NOBODY / Andrea Magelli. Per richieste privacy o ordini usa il canale di supporto indicato nel checkout o nella conferma d'ordine.",
            "Questa pagina riguarda il sito I AM NOBODY, lo shop e le comunicazioni collegate agli acquisti."
          ]
        },
        {
          title: "Dati che trattiamo",
          body: [
            "Dati di contatto e spedizione quando effettui un ordine: nome, email, indirizzo, paese, telefono se fornito, prodotti acquistati e note necessarie alla consegna.",
            "Dati tecnici necessari al funzionamento del sito: lingua, carrello, preferenze essenziali, indirizzo IP e log tecnici di sicurezza.",
            "Dati di pagamento: non conserviamo i dati completi della carta. I pagamenti e il checkout sono gestiti dai provider di pagamento e da Shopify."
          ]
        },
        {
          title: "Perch&eacute; li usiamo",
          body: [
            "Per preparare e spedire gli ordini, inviare conferme, gestire assistenza, resi, rimborsi e obblighi fiscali.",
            "Per mantenere il sito sicuro, ricordare il carrello e migliorare il funzionamento tecnico dello shop.",
            "Per inviare comunicazioni marketing solo se hai dato consenso o se la legge lo consente. Puoi disiscriverti in ogni momento."
          ]
        },
        {
          title: "Servizi coinvolti",
          body: [
            "Shopify gestisce prodotti, carrello e checkout. I dati necessari all'ordine possono essere trattati da Shopify e dai provider di pagamento collegati.",
            "Google Fonts viene usato per caricare i caratteri tipografici del sito. Il browser pu&ograve; effettuare richieste ai server di Google per mostrare i font.",
            "Corrieri e servizi logistici ricevono solo i dati necessari alla consegna."
          ]
        },
        {
          title: "Tempi e diritti",
          body: [
            "Conserviamo i dati d'ordine per il tempo necessario a consegna, assistenza, obblighi contabili e tutela dei diritti.",
            "Puoi chiedere accesso, rettifica, cancellazione, limitazione, portabilit&agrave; o opposizione quando applicabile. Puoi anche revocare il consenso dato.",
            "Se ritieni che i tuoi dati non siano trattati correttamente, puoi rivolgerti all'autorit&agrave; garante competente."
          ]
        }
      ]
    },
    en: {
      eyebrow: "Personal data",
      title: "Privacy",
      intro: "How data is handled when you browse, buy, or contact us.",
      updated: "Updated June 9, 2026",
      sections: [
        {
          title: "Controller",
          body: [
            "The data controller is I AM NOBODY / Andrea Magelli. For privacy or order requests, use the support channel shown at checkout or in your order confirmation.",
            "This page covers the I AM NOBODY website, shop, and purchase-related communications."
          ]
        },
        {
          title: "Data we process",
          body: [
            "Contact and delivery details when you place an order: name, email, address, country, phone number if provided, purchased products, and delivery notes.",
            "Technical data needed for the site to work: language, cart, essential preferences, IP address, and security logs.",
            "Payment data: we do not store full card details. Payments and checkout are handled by payment providers and Shopify."
          ]
        },
        {
          title: "Why we use it",
          body: [
            "To prepare and ship orders, send confirmations, handle support, returns, refunds, and accounting duties.",
            "To keep the site secure, remember the cart, and improve the technical operation of the shop.",
            "To send marketing only when you have consented or where the law allows it. You can unsubscribe at any time."
          ]
        },
        {
          title: "Services involved",
          body: [
            "Shopify handles products, cart, and checkout. Order data may be processed by Shopify and connected payment providers.",
            "Google Fonts is used to load the site's typography. Your browser may request font files from Google servers.",
            "Couriers and logistics partners receive only the information needed to deliver your order."
          ]
        },
        {
          title: "Retention and rights",
          body: [
            "Order data is kept for delivery, support, accounting obligations, and protection of legal rights.",
            "You may request access, correction, deletion, restriction, portability, or objection where applicable. You may also withdraw consent.",
            "If you believe your data is not handled properly, you may contact the competent data protection authority."
          ]
        }
      ]
    }
  },
  cookies: {
    it: {
      eyebrow: "Preferenze e strumenti",
      title: "Cookies",
      intro: "Cosa viene salvato dal sito e perch&eacute;.",
      updated: "Aggiornato il 9 giugno 2026",
      sections: [
        {
          title: "Uso attuale",
          body: [
            "Il sito usa strumenti tecnici necessari per lingua, carrello, sicurezza e funzionamento dello shop.",
            "Il carrello pu&ograve; usare localStorage del browser per ricordare gli oggetti selezionati prima del checkout.",
            "Il banner cookie pu&ograve; salvare in localStorage la tua scelta sui cookie necessari e sugli eventuali strumenti opzionali.",
            "Al momento non impostiamo cookie pubblicitari o di profilazione direttamente dal sito."
          ]
        },
        {
          title: "Cookie necessari",
          body: [
            "I cookie o strumenti equivalenti necessari permettono navigazione, checkout, sicurezza, preferenze essenziali e prevenzione di abusi.",
            "Questi strumenti non richiedono consenso perch&eacute; servono a fornire il servizio richiesto."
          ]
        },
        {
          title: "Shopify e pagamento",
          body: [
            "Quando apri il checkout, Shopify e i provider di pagamento possono impostare cookie tecnici, antifrode e di sessione.",
            "Quei cookie sono gestiti dai rispettivi provider e servono per completare il pagamento e proteggere la transazione."
          ]
        },
        {
          title: "Preferenze",
          body: [
            "Puoi cancellare cookie e localStorage dalle impostazioni del browser. Se lo fai, carrello o preferenze potrebbero azzerarsi.",
            "Se in futuro verranno aggiunti analytics o marketing cookies, verranno mostrati con scelta chiara prima dell'attivazione quando richiesto."
          ]
        }
      ]
    },
    en: {
      eyebrow: "Preferences and tools",
      title: "Cookies",
      intro: "What the site stores and why.",
      updated: "Updated June 9, 2026",
      sections: [
        {
          title: "Current use",
          body: [
            "The site uses technical tools needed for language, cart, security, and shop functionality.",
            "The cart may use browser localStorage to remember selected items before checkout.",
            "The cookie banner may store your choice about necessary cookies and any optional tools in localStorage.",
            "We do not currently set advertising or profiling cookies directly from the site."
          ]
        },
        {
          title: "Necessary cookies",
          body: [
            "Necessary cookies or equivalent tools support browsing, checkout, security, essential preferences, and abuse prevention.",
            "These tools do not require consent because they are needed to provide the requested service."
          ]
        },
        {
          title: "Shopify and payment",
          body: [
            "When you open checkout, Shopify and payment providers may set technical, anti-fraud, and session cookies.",
            "Those cookies are managed by the respective providers and are used to complete payment and protect the transaction."
          ]
        },
        {
          title: "Preferences",
          body: [
            "You can clear cookies and localStorage in your browser settings. If you do, cart and preferences may reset.",
            "If analytics or marketing cookies are added later, they will be shown with a clear choice before activation where required."
          ]
        }
      ]
    }
  },
  shipping: {
    it: {
      eyebrow: "Consegna",
      title: "Spedizioni",
      intro: "Tempi, imballaggio e cosa succede dopo l'ordine.",
      updated: "Aggiornato il 9 giugno 2026",
      sections: [
        {
          title: "Tempi",
          body: [
            "Gli ordini fisici vengono preparati normalmente entro 1-2 giorni lavorativi.",
            "La consegna stimata &egrave; 3-5 giorni lavorativi dopo la spedizione. I tempi possono variare per isole, aree remote, festivit&agrave; o controlli del corriere."
          ]
        },
        {
          title: "Costi",
          body: [
            "La spedizione &egrave; gratuita per ordini superiori a &euro;50.",
            "Per ordini inferiori a &euro;50, il costo viene mostrato prima del pagamento nel checkout."
          ]
        },
        {
          title: "Imballaggio",
          body: [
            "Libri, card e bundle vengono imballati per proteggere angoli e superfici durante il trasporto.",
            "I poster vengono spediti in tubo rigido protettivo."
          ]
        },
        {
          title: "Digitale",
          body: [
            "Ebook e workbook digitali non vengono spediti fisicamente.",
            "I file sono disponibili dopo l'acquisto in PDF ed EPUB, quando previsti dal prodotto."
          ]
        },
        {
          title: "Problemi di consegna",
          body: [
            "Se il pacco risulta danneggiato o non arriva, contattaci dal canale indicato nella conferma d'ordine indicando numero ordine e foto dell'imballo se disponibili."
          ]
        }
      ]
    },
    en: {
      eyebrow: "Delivery",
      title: "Shipping",
      intro: "Timing, packaging, and what happens after you order.",
      updated: "Updated June 9, 2026",
      sections: [
        {
          title: "Timing",
          body: [
            "Physical orders are normally prepared within 1-2 business days.",
            "Estimated delivery is 3-5 business days after shipment. Timing may vary for islands, remote areas, holidays, or courier checks."
          ]
        },
        {
          title: "Costs",
          body: [
            "Shipping is free for orders over &euro;50.",
            "For orders under &euro;50, the shipping cost is shown before payment at checkout."
          ]
        },
        {
          title: "Packaging",
          body: [
            "Books, cards, and bundles are packed to protect corners and surfaces in transit.",
            "Posters are shipped in a protective rigid tube."
          ]
        },
        {
          title: "Digital",
          body: [
            "Ebooks and digital workbooks are not physically shipped.",
            "Files are available after purchase in PDF and EPUB, where included with the product."
          ]
        },
        {
          title: "Delivery issues",
          body: [
            "If a parcel arrives damaged or does not arrive, contact us through the channel shown in your order confirmation with your order number and packaging photos if available."
          ]
        }
      ]
    }
  },
  returns: {
    it: {
      eyebrow: "Cambio idea",
      title: "Resi",
      intro: "Come funzionano resi, rimborsi e prodotti digitali.",
      updated: "Aggiornato il 9 giugno 2026",
      sections: [
        {
          title: "Prodotti fisici",
          body: [
            "Puoi richiedere il reso dei prodotti fisici entro 30 giorni dalla consegna.",
            "Il prodotto deve essere integro, non usato e restituito con imballo adeguato. Per poster e stampe, usa un imballo rigido equivalente."
          ]
        },
        {
          title: "Diritto di recesso",
          body: [
            "Per gli acquisti online nell'Unione Europea hai normalmente 14 giorni per recedere senza indicare il motivo.",
            "La policy di 30 giorni dello shop non riduce i diritti previsti dalla legge."
          ]
        },
        {
          title: "Costi e rimborso",
          body: [
            "Salvo errore nostro o prodotto difettoso, le spese di rientro sono a carico del cliente.",
            "Dopo la ricezione e verifica del reso, il rimborso viene emesso sul metodo di pagamento originale."
          ]
        },
        {
          title: "Prodotti digitali",
          body: [
            "Ebook, workbook e file digitali sono disponibili subito dopo l'acquisto.",
            "Una volta scaricato o ricevuto accesso al contenuto digitale, il rimborso pu&ograve; non essere disponibile se la legge lo consente."
          ]
        },
        {
          title: "Difetti o danni",
          body: [
            "Se ricevi un prodotto danneggiato o errato, scrivici dal canale indicato nella conferma d'ordine entro 7 giorni dalla consegna.",
            "Includi numero ordine e foto chiare del prodotto e dell'imballo."
          ]
        }
      ]
    },
    en: {
      eyebrow: "Change of mind",
      title: "Returns",
      intro: "How returns, refunds, and digital products work.",
      updated: "Updated June 9, 2026",
      sections: [
        {
          title: "Physical products",
          body: [
            "You may request a return for physical products within 30 days of delivery.",
            "Items must be intact, unused, and returned with suitable packaging. For posters and prints, use equivalent rigid packaging."
          ]
        },
        {
          title: "Right of withdrawal",
          body: [
            "For online purchases in the European Union, you normally have 14 days to withdraw without giving a reason.",
            "The shop's 30-day policy does not reduce your legal rights."
          ]
        },
        {
          title: "Costs and refund",
          body: [
            "Unless the mistake is ours or the product is faulty, return shipping costs are paid by the customer.",
            "After the returned product is received and checked, the refund is issued to the original payment method."
          ]
        },
        {
          title: "Digital products",
          body: [
            "Ebooks, workbooks, and digital files are available shortly after purchase.",
            "Once downloaded or accessed, digital content may not be refundable where the law allows it."
          ]
        },
        {
          title: "Faults or damage",
          body: [
            "If you receive a damaged or incorrect product, contact us through the channel shown in your order confirmation within 7 days of delivery.",
            "Include your order number and clear photos of the product and packaging."
          ]
        }
      ]
    }
  }
};

const labels = {
  it: {
    shop: "Shop",
    home: "Home",
    policies: "Policy",
    footer: "I AM NOBODY &middot; Andrea Magelli",
    source: "Informazioni pratiche per acquisti, dati e assistenza."
  },
  en: {
    shop: "Shop",
    home: "Home",
    policies: "Policies",
    footer: "I AM NOBODY &middot; Andrea Magelli",
    source: "Practical information for orders, data, and support."
  }
};

export function isLegalSlug(value: string): value is LegalSlug {
  return value === "privacy" || value === "cookies" || value === "shipping" || value === "returns";
}

export function isLocale(value: string): value is Locale {
  return value === "it" || value === "en";
}

export function legalPageResponse(slug: LegalSlug, locale: Locale) {
  return htmlResponse(renderLegalPage(slug, locale));
}

function renderLegalPage(slug: LegalSlug, locale: Locale) {
  const page = legalPages[slug][locale];
  const langPrefix = locale === "en" ? "/en" : "/it";
  const otherLocale = locale === "en" ? "it" : "en";
  const otherPrefix = otherLocale === "en" ? "/en" : "/it";
  const nav = [
    ["privacy", "Privacy"],
    ["cookies", "Cookies"],
    ["shipping", locale === "en" ? "Shipping" : "Spedizioni"],
    ["returns", locale === "en" ? "Returns" : "Resi"]
  ] as const;

  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${page.title} - I AM NOBODY</title>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Bebas+Neue&family=DM+Sans:wght@300;400;500;700&display=swap" rel="stylesheet" />
  <style>
    :root{--dark:#050505;--ink:#0b0b0b;--paper:#f4f1ec;--ghost:#8f887e;--rule:#ded8cf;--i2:#d4a017;--fd:'Bebas Neue',sans-serif;--fb:'Cormorant Garamond',serif;--fu:'DM Sans',sans-serif;}
    *{box-sizing:border-box;margin:0;padding:0;}
    html{background:var(--dark);scroll-behavior:smooth;}
    body{font-family:var(--fb);background:var(--paper);color:var(--ink);min-height:100vh;-webkit-font-smoothing:antialiased;}
    a{color:inherit;text-decoration:none;}
    nav{position:fixed;top:0;left:0;right:0;z-index:20;height:76px;padding:0 46px;display:flex;align-items:center;justify-content:space-between;gap:24px;background:rgba(5,5,5,.88);backdrop-filter:blur(18px);border-bottom:1px solid rgba(255,255,255,.08);}
    .brand{font-family:var(--fd);font-size:22px;letter-spacing:3px;color:#fff;line-height:1.1;white-space:nowrap;}
    .brand span{color:var(--i2);}
    .nav-right{display:flex;align-items:center;gap:14px;min-width:0;}
    .nav-links{display:flex;align-items:center;gap:26px;font-family:var(--fu);font-size:10px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,.55);}
    .nav-links a{transition:color .24s ease,transform .24s ease;white-space:nowrap;}
    .nav-links a:hover,.nav-links a.active{color:#fff;transform:translateY(-1px);}
    .lang{display:flex;align-items:center;height:36px;border:1px solid rgba(255,255,255,.2);border-radius:999px;overflow:hidden;}
    .lang a{height:100%;display:flex;align-items:center;padding:0 11px;font-family:var(--fu);font-size:10px;letter-spacing:1.7px;color:rgba(255,255,255,.52);transition:background .24s ease,color .24s ease;}
    .lang a:hover{color:#fff;}
    .lang a.active{background:var(--paper);color:#050505;}
    .nav-toggle{display:none;width:38px;height:38px;border:1px solid rgba(255,255,255,.18);border-radius:999px;background:transparent;color:#fff;cursor:pointer;align-items:center;justify-content:center;flex:0 0 auto;flex-direction:column;gap:4px;transition:background .24s ease,border-color .24s ease,transform .24s ease;}
    .nav-toggle span,.nav-toggle:before,.nav-toggle:after{content:"";width:16px;height:1px;background:currentColor;display:block;transition:transform .24s ease,opacity .24s ease;}
    .nav-toggle:hover,.nav-toggle[aria-expanded="true"]{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.34);transform:translateY(-1px);}
    .nav-toggle[aria-expanded="true"]:before{transform:translateY(5px) rotate(45deg);}
    .nav-toggle[aria-expanded="true"] span{opacity:0;}
    .nav-toggle[aria-expanded="true"]:after{transform:translateY(-5px) rotate(-45deg);}
    .hero{background:#070707;color:var(--paper);padding:156px 64px 76px;border-bottom:1px solid rgba(255,255,255,.08);}
    .hero-inner{width:min(1180px,88vw);margin:0 auto;}
    .eyebrow{display:block;font-family:var(--fu);font-size:10px;letter-spacing:4px;text-transform:uppercase;color:var(--i2);font-weight:700;margin-bottom:24px;}
    h1{font-family:var(--fd);font-size:clamp(72px,10vw,142px);line-height:.86;letter-spacing:.5px;text-transform:uppercase;color:#fff;}
    .intro{max-width:720px;margin-top:28px;font-size:clamp(25px,3vw,40px);line-height:1.12;font-style:italic;color:rgba(244,241,236,.72);}
    .updated{font-family:var(--fu);font-size:10px;letter-spacing:2.6px;text-transform:uppercase;color:rgba(255,255,255,.54);font-weight:700;margin-top:30px;}
    main{background:var(--paper);padding:72px 64px 92px;}
    .policy-wrap{width:min(1180px,88vw);margin:0 auto;display:grid;grid-template-columns:280px 1fr;gap:54px;align-items:start;}
    .side{position:sticky;top:112px;border-top:1px solid var(--rule);padding-top:18px;}
    .side-label{font-family:var(--fu);font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#6f6964;font-weight:700;margin-bottom:18px;}
    .side a{display:block;font-family:var(--fd);font-size:30px;line-height:1;padding:12px 0;color:rgba(0,0,0,.48);border-bottom:1px solid var(--rule);transition:color .24s ease,padding-left .24s ease;}
    .side a:hover,.side a.active{color:#000;padding-left:8px;}
    .content{border-top:1px solid var(--rule);}
    section{display:grid;grid-template-columns:260px 1fr;gap:38px;padding:34px 0;border-bottom:1px solid var(--rule);}
    h2{font-family:var(--fd);font-size:38px;line-height:1;text-transform:uppercase;letter-spacing:.5px;}
    p{font-size:20px;line-height:1.55;color:rgba(0,0,0,.68);margin-bottom:14px;}
    p:last-child{margin-bottom:0;}
    .note{margin-top:34px;padding:22px 24px;background:#fff;border-left:3px solid var(--i2);font-family:var(--fu);font-size:13px;line-height:1.7;color:rgba(0,0,0,.68);}
    footer{background:#050505;padding:62px 64px 42px;border-top:1px solid rgba(255,255,255,.08);}
    .footer-top{display:flex;align-items:center;justify-content:space-between;gap:30px;margin-bottom:40px;padding-bottom:40px;border-bottom:1px solid rgba(255,255,255,.06);}
    .footer-logo{font-family:var(--fd);font-size:22px;letter-spacing:3px;color:#fff;line-height:1.1;}
    .footer-logo span{color:var(--i2);}
    .footer-tagline{font-family:var(--fb);font-size:15px;font-style:italic;color:rgba(255,255,255,.54);margin-top:8px;margin-bottom:0;line-height:1.6;}
    .footer-bottom{display:flex;justify-content:space-between;gap:20px;font-family:var(--fu);font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,.42);line-height:1.7;}
    .footer-links a{color:rgba(255,255,255,.58);transition:color .24s ease;}
    .footer-links a:hover{color:#fff;}
    @media(max-width:900px){nav{padding:0 24px}.nav-toggle{display:flex}.nav-links{position:fixed;left:0;right:0;top:76px;display:flex;flex-direction:column;align-items:flex-start;gap:0;max-height:0;overflow:hidden;opacity:0;pointer-events:none;background:rgba(5,5,5,.98);border-top:1px solid rgba(255,255,255,.08);padding:0 28px;transform:translateY(-8px);transition:max-height .28s ease,opacity .24s ease,transform .28s ease,padding .28s ease}.nav-links.open{max-height:220px;opacity:1;pointer-events:auto;padding:10px 28px 18px;transform:translateY(0)}.nav-links a{width:100%;padding:13px 0;border-bottom:1px solid rgba(255,255,255,.06)}.nav-links a:hover{transform:none}.hero,main,footer{padding-left:28px;padding-right:28px}.policy-wrap{grid-template-columns:1fr}.side{position:static}.side a{display:inline-block;margin-right:18px;border-bottom:0}section{grid-template-columns:1fr;gap:14px}.footer-top,.footer-bottom{flex-direction:column;align-items:flex-start}}
    @media(max-width:620px){nav{display:grid;grid-template-columns:minmax(0,1fr) auto;height:76px;padding:0 18px;align-items:center;gap:12px}.brand{font-size:20px;letter-spacing:2px;justify-self:start;width:max-content}.nav-right{position:fixed;top:19px;right:18px;justify-self:end;gap:8px}.lang{display:none}.hero{padding-top:142px}.hero,main,footer{padding-left:20px;padding-right:20px}p{font-size:18px}.side a{font-size:25px}}
    @media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
  </style>
</head>
<body>
  <nav>
    <a class="brand" href="${langPrefix}">I AM <span>NOBODY</span></a>
    <div class="nav-right">
      <div class="nav-links" id="policyNavLinks">
        <a href="${langPrefix}/shop">${labels[locale].shop}</a>
        <a href="${langPrefix}">${labels[locale].home}</a>
      </div>
      <div class="lang" aria-label="Language switcher">
        <a href="${otherPrefix}/${slug}">${otherLocale.toUpperCase()}</a>
        <a href="${langPrefix}/${slug}" class="active">${locale.toUpperCase()}</a>
      </div>
      <button class="nav-toggle" type="button" aria-label="Menu" aria-expanded="false" aria-controls="policyNavLinks" data-nav-toggle><span></span></button>
    </div>
  </nav>
  <header class="hero">
    <div class="hero-inner">
      <span class="eyebrow">${page.eyebrow}</span>
      <h1>${page.title}</h1>
      <p class="intro">${page.intro}</p>
      <div class="updated">${page.updated}</div>
    </div>
  </header>
  <main>
    <div class="policy-wrap">
      <aside class="side">
        <div class="side-label">${labels[locale].policies}</div>
        ${nav.map(([navSlug, navLabel]) => `<a href="${langPrefix}/${navSlug}" class="${navSlug === slug ? "active" : ""}">${navLabel}</a>`).join("")}
      </aside>
      <div class="content">
        ${page.sections.map(section => `<section><h2>${section.title}</h2><div>${section.body.map(text => `<p>${text}</p>`).join("")}</div></section>`).join("")}
        <div class="note">${labels[locale].source}</div>
      </div>
    </div>
  </main>
  <footer>
    <div class="footer-top">
      <div>
        <div class="footer-logo">I AM <span>NOBODY</span></div>
        <p class="footer-tagline">${labels[locale].source}</p>
      </div>
      <div style="height:2px;width:60px;background:linear-gradient(90deg,#4a90d9,#2eaa8a,#d4a017,#7b4fa0,#4a90d9);"></div>
    </div>
    <div class="footer-bottom">
      <span>${labels[locale].footer}</span>
      <span class="footer-links"><a href="${langPrefix}/privacy">Privacy</a> &middot; <a href="${langPrefix}/cookies">Cookies</a> &middot; <a href="${langPrefix}/shipping">${locale === "en" ? "Shipping" : "Spedizioni"}</a> &middot; <a href="${langPrefix}/returns">${locale === "en" ? "Returns" : "Resi"}</a></span>
    </div>
  </footer>
  <script>
    (function(){
      var navToggle = document.querySelector('[data-nav-toggle]');
      var navLinks = document.getElementById('policyNavLinks');
      function setMenuOpen(open){
        if(!navToggle || !navLinks) return;
        navToggle.setAttribute('aria-expanded', String(open));
        navLinks.classList.toggle('open', open);
      }
      if(navToggle && navLinks){
        navToggle.addEventListener('click', function(){
          setMenuOpen(navToggle.getAttribute('aria-expanded') !== 'true');
        });
        navLinks.addEventListener('click', function(event){
          var target = event.target;
          if(target && target.closest && target.closest('a')) setMenuOpen(false);
        });
        window.addEventListener('resize', function(){
          if(window.innerWidth > 900) setMenuOpen(false);
        });
      }
    })();
  </script>
</body>
</html>`;
}
