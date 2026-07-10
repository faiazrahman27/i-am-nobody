import type {
  ArchetypeDefinition,
  ArchetypeSlug,
} from "./types";

const archetypes: readonly ArchetypeDefinition[] = [
  {
    slug: "nobody-classic",
    code: "NCL",

    title: {
      it: "Nobody Classic",
      en: "Nobody Classic",
    },

    description: {
      it: "La presenza canonica di Nobody, vicina alla copertina originale.",
      en: "The canonical Nobody presence, close to the original cover.",
    },

    clothingPrompt:
      "a perfectly tailored black tuxedo, white pleated dress shirt, black bow tie, restrained white pocket square, formal and timeless, close to the original book cover",

    permittedProps: [],

    forbiddenDetails: [
      "coloured suit",
      "showy jewellery",
      "decorative lapel pins",
      "ceremonial costume",
    ],

    defaultProp: null,
    active: true,
    displayOrder: 1,
  },

  {
    slug: "worker",
    code: "WRK",

    title: {
      it: "Il Lavoratore",
      en: "The Worker",
    },

    description: {
      it: "Nobody attraverso la dignità sobria del lavoro.",
      en: "Nobody through the restrained dignity of work.",
    },

    clothingPrompt:
      "refined dark workwear: a clean structured work jacket or elegant dark denim layers, realistic materials, minimal seams and hardware, practical but premium",

    permittedProps: [
      "one clean work glove",
    ],

    forbiddenDetails: [
      "construction site",
      "hard hat",
      "heavy tools",
      "high-visibility costume",
      "dirty caricature styling",
    ],

    defaultProp: null,
    active: true,
    displayOrder: 2,
  },

  {
    slug: "chef",
    code: "CHF",

    title: {
      it: "Lo Chef",
      en: "The Chef",
    },

    description: {
      it: "Nobody espresso da una divisa culinaria essenziale e precisa.",
      en: "Nobody expressed through an essential and precise culinary uniform.",
    },

    clothingPrompt:
      "a clean, beautifully fitted white chef jacket with minimal buttons and an understated dark apron detail, immaculate, elegant, and contemporary",

    permittedProps: [
      "one folded white kitchen towel",
    ],

    forbiddenDetails: [
      "kitchen",
      "food",
      "knives",
      "pans",
      "flames",
      "ingredients",
      "chef hat caricature",
    ],

    defaultProp: null,
    active: true,
    displayOrder: 3,
  },

  {
    slug: "athlete",
    code: "ATH",

    title: {
      it: "L’Atleta",
      en: "The Athlete",
    },

    description: {
      it: "Nobody come disciplina, presenza e controllo.",
      en: "Nobody as discipline, presence, and control.",
    },

    clothingPrompt:
      "a premium minimal technical tracksuit or refined monochrome athletic jacket and trousers, tailored silhouette, restrained performance materials, no visible branding",

    permittedProps: [
      "one plain ball",
      "one plain racket",
    ],

    forbiddenDetails: [
      "stadium",
      "gym",
      "action pose",
      "competition scene",
      "team logos",
      "medals",
      "multiple sports props",
    ],

    defaultProp: null,
    active: true,
    displayOrder: 4,
  },

  {
    slug: "businessman",
    code: "BSN",

    title: {
      it: "L’Uomo d’Affari",
      en: "The Businessman",
    },

    description: {
      it: "Nobody dentro il ruolo del potere professionale.",
      en: "Nobody within the role of professional power.",
    },

    clothingPrompt:
      "a refined charcoal or black tailored business suit, crisp white shirt, restrained dark tie or open formal collar, immaculate and authoritative without visible luxury branding",

    permittedProps: [
      "one closed unbranded laptop",
    ],

    forbiddenDetails: [
      "office",
      "boardroom",
      "city skyline",
      "money",
      "briefcase cliché",
      "luxury watch focus",
    ],

    defaultProp: null,
    active: true,
    displayOrder: 5,
  },

  {
    slug: "artist",
    code: "ART",

    title: {
      it: "L’Artista",
      en: "The Artist",
    },

    description: {
      it: "Nobody come gesto creativo senza spettacolarizzazione.",
      en: "Nobody as a creative gesture without spectacle.",
    },

    clothingPrompt:
      "a minimal black turtleneck or refined dark creative jacket with one extremely subtle tactile or handcrafted detail, elegant and intellectually restrained",

    permittedProps: [
      "one small unbranded sketchbook",
      "one single paintbrush",
    ],

    forbiddenDetails: [
      "messy studio",
      "paint splashes",
      "easel",
      "palette",
      "bohemian costume",
      "multiple art tools",
    ],

    defaultProp: null,
    active: true,
    displayOrder: 6,
  },

  {
    slug: "father",
    code: "FTH",

    title: {
      it: "Il Padre",
      en: "The Father",
    },

    description: {
      it: "Nobody come cura, responsabilità e presenza silenziosa.",
      en: "Nobody as care, responsibility, and quiet presence.",
    },

    clothingPrompt:
      "simple elegant casual clothing: a soft fine-knit sweater or understated jacket over a clean shirt, warm, mature, refined, and emotionally restrained",

    permittedProps: [
      "one small key",
      "one simple folded note",
    ],

    forbiddenDetails: [
      "children",
      "family portrait",
      "domestic room",
      "sentimental posing",
      "father stereotype costume",
    ],

    defaultProp: null,
    active: true,
    displayOrder: 7,
  },

  {
    slug: "dancer",
    code: "DNC",

    title: {
      it: "Il Danzatore",
      en: "The Dancer",
    },

    description: {
      it: "Nobody come controllo del corpo prima del movimento.",
      en: "Nobody as bodily control before movement.",
    },

    clothingPrompt:
      "minimal black dancewear or a refined monochrome urban dance outfit, fluid but structured, elegant silhouette, composed and still rather than performing",

    permittedProps: [],

    forbiddenDetails: [
      "dance pose",
      "stage",
      "spotlight show",
      "costume feathers",
      "theatrical makeup",
      "motion blur",
    ],

    defaultProp: null,
    active: true,
    displayOrder: 8,
  },

  {
    slug: "builder",
    code: "BLD",

    title: {
      it: "Il Costruttore",
      en: "The Builder",
    },

    description: {
      it: "Nobody come capacità di dare forma senza esibire gli strumenti.",
      en: "Nobody as the ability to shape without displaying the tools.",
    },

    clothingPrompt:
      "minimal refined architectural workwear, a structured neutral utility jacket with clean lines and one subtle construction-related material detail, premium and composed",

    permittedProps: [
      "one clean work glove",
      "one small plain carpenter pencil",
    ],

    forbiddenDetails: [
      "construction site",
      "hard hat",
      "tool belt",
      "power tools",
      "blueprints filling the frame",
      "dust-covered costume",
    ],

    defaultProp: null,
    active: true,
    displayOrder: 9,
  },

  {
    slug: "student",
    code: "STD",

    title: {
      it: "Lo Studente",
      en: "The Student",
    },

    description: {
      it: "Nobody come apertura, dubbio e apprendimento.",
      en: "Nobody as openness, doubt, and learning.",
    },

    clothingPrompt:
      "clean refined academic casualwear: an understated knit, shirt, or minimal jacket with a youthful but timeless silhouette, elegant and unbranded",

    permittedProps: [
      "one closed plain book",
      "one minimal backpack strap",
    ],

    forbiddenDetails: [
      "classroom",
      "school uniform caricature",
      "graduation gown",
      "stack of books",
      "visible school logos",
    ],

    defaultProp: "one closed plain book",
    active: true,
    displayOrder: 10,
  },

  {
    slug: "traveler",
    code: "TRV",

    title: {
      it: "Il Viaggiatore",
      en: "The Traveler",
    },

    description: {
      it: "Nobody come attraversamento, distanza e ritorno.",
      en: "Nobody as passage, distance, and return.",
    },

    clothingPrompt:
      "an elegant travel-inspired coat or refined layered jacket, practical and timeless, subtle texture, composed and unbranded",

    permittedProps: [
      "one small plain key",
      "one restrained luggage tag without text",
    ],

    forbiddenDetails: [
      "airport",
      "train station",
      "landscape",
      "suitcase pile",
      "maps",
      "passport",
      "tourist styling",
    ],

    defaultProp: null,
    active: true,
    displayOrder: 11,
  },

  {
    slug: "creator",
    code: "CRT",

    title: {
      it: "Il Creatore",
      en: "The Creator",
    },

    description: {
      it: "Nobody come origine di qualcosa che prima non esisteva.",
      en: "Nobody as the origin of something that did not exist before.",
    },

    clothingPrompt:
      "a refined contemporary black or deep-neutral outfit combining a clean jacket with a minimal tactile detail, thoughtful, modern, and quietly inventive",

    permittedProps: [
      "one closed unbranded notebook",
      "one small plain key",
    ],

    forbiddenDetails: [
      "technology lab",
      "glowing screens",
      "holograms",
      "maker-space clutter",
      "inventor costume",
    ],

    defaultProp: null,
    active: true,
    displayOrder: 12,
  },

  {
    slug: "dreamer",
    code: "DRM",

    title: {
      it: "Il Sognatore",
      en: "The Dreamer",
    },

    description: {
      it: "Nobody come spazio interiore, possibilità e immaginazione.",
      en: "Nobody as inner space, possibility, and imagination.",
    },

    clothingPrompt:
      "softly tailored dark clothing with a subtle flowing layer or fine texture, introspective, elegant, minimal, and grounded in reality",

    permittedProps: [
      "one simple flower",
    ],

    forbiddenDetails: [
      "clouds",
      "stars",
      "galaxy",
      "surreal landscape",
      "sleeping pose",
      "fantasy costume",
    ],

    defaultProp: null,
    active: true,
    displayOrder: 13,
  },

  {
    slug: "speaker",
    code: "SPK",

    title: {
      it: "Lo Speaker",
      en: "The Speaker",
    },

    description: {
      it: "Nobody come voce pubblica senza perdere il silenzio interiore.",
      en: "Nobody as a public voice without losing inner silence.",
    },

    clothingPrompt:
      "a refined dark jacket or minimal formal outfit suitable for a thoughtful public speaker, clean lines, calm authority, and no visible branding",

    permittedProps: [
      "one small plain presentation remote",
    ],

    forbiddenDetails: [
      "stage",
      "podium",
      "audience",
      "microphone wall",
      "spotlights",
      "dramatic hand gestures",
    ],

    defaultProp: null,
    active: true,
    displayOrder: 14,
  },

  {
    slug: "infinite",
    code: "INF",

    title: {
      it: "L’Infinito",
      en: "The Infinite",
    },

    description: {
      it: "Nobody oltre il ruolo, in una presenza senza tempo.",
      en: "Nobody beyond the role, in a timeless presence.",
    },

    clothingPrompt:
      "a sculptural, timeless, almost statue-like dark garment with clean architectural draping, minimal and human, elegant rather than fantastical",

    permittedProps: [],

    forbiddenDetails: [
      "wings",
      "halo",
      "magic",
      "cosmic effects",
      "fantasy armour",
      "religious costume",
      "non-human anatomy",
    ],

    defaultProp: null,
    active: true,
    displayOrder: 15,
  },
] as const;

export const NOBODY_ARCHETYPES = archetypes;

export const NOBODY_ARCHETYPE_BY_SLUG: Readonly<
  Record<ArchetypeSlug, ArchetypeDefinition>
> = Object.freeze(
  Object.fromEntries(
    archetypes.map((archetype) => [
      archetype.slug,
      archetype,
    ]),
  ) as Record<ArchetypeSlug, ArchetypeDefinition>,
);

export function getNobodyArchetype(
  slug: ArchetypeSlug,
) {
  return NOBODY_ARCHETYPE_BY_SLUG[slug];
}

export function isNobodyArchetypeSlug(
  value: unknown,
): value is ArchetypeSlug {
  return (
    typeof value === "string" &&
    value in NOBODY_ARCHETYPE_BY_SLUG
  );
}