import type { NobodyThreshold } from "./types";

/**
 * Editorial knowledge distilled from the complete English manuscript:
 * FINAL PAPERBACK IAM_Nobody_ENGLISH_v14.pdf (111 pages).
 *
 * This is intentionally embedded in the server bundle. The production planner
 * therefore needs only the Responses API and does not need OpenAI Files,
 * Vector Stores, File Search, or a copy of the PDF in GitHub/Vercel.
 */
export const NOBODY_BOOK_CONTEXT_VERSION = "2026-07-23.1";

export const NOBODY_BOOK_IDENTITY = [
  "I AM NOBODY is a question-led work about identity, roles, presence, relationship, responsibility, integrity, dream, technology, community, Earth, conflict, and legacy.",
  "It is not self-help, a productivity manual, an academic treatise, a catalogue of professions, or a motivational slogan collection.",
  "Its central invitation is to step outside ordinary noise long enough to notice the distance between the version of a person that functions and the person who exists beneath performance.",
  "The mask is not a symbol of deception. It is a protected ritual space in which performance can stop, truth can emerge, and the other person can be seen without projection.",
  "Questions matter more than ready answers. The work should leave an opening rather than solve the person shown.",
  "Two quiet threads run through the whole book: integrity, meaning becoming whole again; and dream, meaning becoming alive again.",
  "The movement from Nobody to Infinite is not a ladder or a linear self-improvement programme. The four thresholds are mirrors that may coexist in one life and even in one image.",
  "The final direction is relational: self-knowledge is not the destination. It is what makes genuine attention, love, responsibility, community, peace, stewardship, and legacy possible.",
].join("\n");

export const NOBODY_BOOK_THRESHOLDS: ReadonlyArray<
  Readonly<{
    name: NobodyThreshold;
    centralQuestion: string;
    meaning: string;
    humanMovement: string;
    visualTension: string;
    avoid: string;
  }>
> = [
  {
    name: "Nobody",
    centralQuestion:
      "Who are you when you put down everything you were given to carry?",
    meaning:
      "The noise falls away and the difference becomes visible between the person who functions and the person who exists. Nobody is not erasure or worthlessness; it is the first honest pause beneath labels, usefulness, expectation, optimisation, and automatic performance.",
    humanMovement:
      "From fragmentation toward integrity; from content toward ritual; from usefulness toward existence; from automatic functioning toward silence, vulnerability, bodily truth, and the return of a forgotten dream.",
    visualTension:
      "A recognisable role is still present, but it has become quiet enough for the human being underneath to be felt. The figure may seem suspended between holding the role together and letting it dissolve.",
    avoid:
      "Do not depict humiliation, disappearance, social insignificance, blankness, defeat, or a generic sad person. Nobody is a lucid threshold, not a lack of value.",
  },
  {
    name: "Somebody",
    centralQuestion: "Are you that Somebody, or has it taken your place?",
    meaning:
      "The person has become recognisable through a name, duty, achievement, social role, family role, reputation, expectation, or identity. Somebody is useful and necessary until the role stops being a tool and becomes a cage that chooses on the person's behalf.",
    humanMovement:
      "From chosen role toward defended identity; from social competence toward invisible exhaustion; from the Persona toward the unacknowledged Shadow; from being known for a function toward asking what remains underneath it.",
    visualTension:
      "Clothing and posture clearly communicate a role, while one restrained contradiction reveals that the role may have occupied too much of the person. The image should hold dignity and pressure at the same time.",
    avoid:
      "Do not celebrate status, luxury, authority, success, uniform, or profession as the final meaning. Do not turn the figure into an advertisement or a costume.",
  },
  {
    name: "Anybody",
    centralQuestion:
      "What would happen if all of us who feel like pawns realised how many we are?",
    meaning:
      "Identity becomes fluid, multiplied, profiled, predicted, and paralysed by excessive possibility. Yet Anybody also contains the system's blind spot: different people recognising one another, saying me too, and rebuilding presence and community without erasing difference.",
    humanMovement:
      "From infinite options toward chosen responsibility; from profile toward embodied presence; from algorithmic confirmation toward encounter; from curated sameness toward difference that recognises itself; from isolation toward a real we.",
    visualTension:
      "The single figure should feel both singular and universally recognisable. The person belongs to a larger human condition without becoming an anonymous stereotype or demographic category.",
    avoid:
      "Do not make universality mean generic clothing, neutral emotion, faceless crowds, internet clichés, or social-category symbolism. Anybody is shared recognition through difference.",
  },
  {
    name: "Infinite",
    centralQuestion: "What is there in you that no algorithm will ever measure?",
    meaning:
      "The person contains something unrepeatable and beyond the system's reach: embodied experience, love, doubt, responsibility, attention, dream, relationship, care for the Earth, courage, and the invisible trace left in other people.",
    humanMovement:
      "From output toward legacy; from optimisation toward wholeness; from possession toward stewardship; from self-definition toward attention to the other; from noise toward the dream that remains alive; from category toward the irreducible face.",
    visualTension:
      "The role becomes secondary to a timeless and responsible human presence. The figure may feel as though a social shell has loosened, revealing agency, openness, care, or a quiet decision to remain human.",
    avoid:
      "Do not use mystical spectacle, supernatural power, cosmic fantasy, heroic domination, halos, or grandiose transcendence. Infinite is concrete, relational, embodied, and built through small acts.",
  },
] as const;

export const NOBODY_BOOK_CHAPTERS = [
  {
    threshold: "Nobody" as const,
    title: "A mask, a question, a silence",
    coreQuestion: "Who are you when no one is watching?",
    thesis:
      "Ritual interrupts ordinary time and brings a person back, while endless content carries them away. The mask creates a protected space in which the managed face can stop performing and a truer gaze can emerge.",
    tensions: [
      "content versus ritual",
      "managed face versus protected truth",
      "noise versus silence",
      "label versus person",
      "the system as habitat versus the system as owner",
    ],
    humanSituations: [
      "alone in a car with the radio off",
      "awake late after notifications stop",
      "present at a gathering but unable to feel present",
      "a person who finally has no audience to satisfy",
      "someone pausing before reaching for the next distraction",
    ],
    visualMetaphors: [
      "a formal layer held with less certainty than usual",
      "hands no longer performing their expected task",
      "a small sign of stillness inside otherwise functional clothing",
      "a role that appears to be gently loosening rather than dramatically breaking",
    ],
  },
  {
    threshold: "Nobody" as const,
    title: "The moment the noise drops",
    coreQuestion: "Who are you when you stop being useful to someone?",
    thesis:
      "Nobody is the instant in which fragmentation becomes visible. Integrity means becoming undivided rather than perfect, and dream is the fragile desire that often reappears only after usefulness and urgency become quiet.",
    tensions: [
      "functioning self versus existing self",
      "comfort versus freedom",
      "fragmentation versus integrity",
      "usefulness versus intrinsic life",
      "urgent task versus forgotten dream",
    ],
    humanSituations: [
      "the reliable person with nothing left to give",
      "someone whose day is full but whose life feels absent",
      "the person who remembers an abandoned dream in an ordinary pause",
      "a caregiver after everyone else is finally asleep",
      "a worker between the end of duty and the return home",
    ],
    visualMetaphors: [
      "clothing that still carries responsibility while posture admits depletion",
      "one personal detail surviving beneath practical layers",
      "a body at rest before the mind has accepted rest",
      "a role presented without its usual performance energy",
    ],
  },
  {
    threshold: "Nobody" as const,
    title: "How many versions of you exist today?",
    coreQuestion: "Which version of yourself is hardest to maintain?",
    thesis:
      "A person adapts across work, family, friendship, social media, and solitude. These versions are not necessarily false, but continuously managing them creates invisible fatigue and may leave no stable sense of self beneath them.",
    references: [
      "Pirandello: one person for oneself, many for others, no single final self",
      "Bauman: liquid identity adapting to every container",
      "Van Gogh: self-portrait as slow inward search rather than external confirmation",
    ],
    tensions: [
      "multiplicity versus coherence",
      "adaptability versus anchor",
      "self-portrait versus selfie",
      "inward search versus external validation",
      "social skill versus invisible monitoring",
    ],
    humanSituations: [
      "a person moving between professional and family versions of themselves",
      "someone whose online confidence disappears offline",
      "the friend who becomes different in every group",
      "a person whose private clothing contradicts their public identity",
      "someone exhausted by being interpreted differently by everyone",
    ],
    visualMetaphors: [
      "layered garments from different roles without becoming a collage",
      "one detail that belongs to a private self and another to a public self",
      "controlled asymmetry suggesting multiple versions competing quietly",
      "a polished exterior with one deliberately unoptimised element",
    ],
  },
  {
    threshold: "Nobody" as const,
    title: "The face you show and the one you hide",
    coreQuestion:
      "Which role do you play so well you have almost forgotten it is a role?",
    thesis:
      "The Persona is a necessary social face, while the Shadow contains excluded vulnerability, fear, anger, need, tenderness, and contradiction. What is denied does not disappear; it acts indirectly and becomes part of what others inherit from us.",
    references: [
      "Jung: Persona and Shadow",
      "Oscar Wilde: the mask can allow truth",
      "Japanese Nō: a fixed mask changes with the angle and with the viewer",
    ],
    tensions: [
      "social face versus hidden life",
      "necessary mask versus forgotten mask",
      "declared values versus behaviour under pressure",
      "control versus the Shadow acting indirectly",
      "being seen versus managing how one is seen",
    ],
    humanSituations: [
      "the calm person whose fear appears only at home",
      "the generous person unable to admit resentment",
      "the strong parent hiding grief",
      "the dependable partner unable to ask for help",
      "someone who smiles automatically while carrying an unsaid truth",
    ],
    visualMetaphors: [
      "a composed silhouette with a private softness in fabric or gesture",
      "formal clothing interrupted by one vulnerable, human detail",
      "tension between symmetrical presentation and asymmetrical body language",
      "a protective layer that reveals rather than conceals",
    ],
  },
  {
    threshold: "Somebody" as const,
    title: "The cost of having a name",
    coreQuestion:
      "When did you last do something that did not match who everyone expects you to be?",
    thesis:
      "A recognisable identity provides orientation and social function, but the role can slowly replace the person. The system prefers solved, predictable Somebodies, while human beings remain unfinished and irreducible.",
    tensions: [
      "chosen identity versus inherited expectation",
      "recognition versus confinement",
      "reputation versus freedom to change",
      "predictability versus living contradiction",
      "the role as tool versus the role as cage",
    ],
    humanSituations: [
      "a leader who wants to stop leading for one day",
      "the family problem-solver who does not know how to need others",
      "a recognised expert becoming a beginner",
      "the successful person privately questioning the life success built",
      "someone acting outside a long-defended identity",
    ],
    visualMetaphors: [
      "highly legible role clothing with one unexpected personal choice",
      "a garment worn correctly but without complete identification",
      "a posture that resists the status implied by the clothes",
      "a restrained sign of transition out of an established identity",
    ],
  },
  {
    threshold: "Somebody" as const,
    title: "You are tired. But of what, exactly?",
    coreQuestion:
      "Is there something you are consuming of yourself that does not regenerate?",
    thesis:
      "Contemporary exhaustion often comes from self-exploitation, permanent reachability, performance, validation loops, and the management of several selves at once. Burnout may be the body saying what the mind has not permitted itself to say: enough.",
    references: [
      "Marx: alienation when work gives nothing of the self back",
      "Byung-Chul Han: the person becomes both boss and worker, brand and product",
    ],
    tensions: [
      "availability versus presence",
      "productivity versus regeneration",
      "validation rush versus immediate emptiness",
      "self-management versus self-exploitation",
      "filled gaps versus the lost fertility of boredom",
    ],
    humanSituations: [
      "the always-reachable colleague after work",
      "a creator who has become their own content factory",
      "the person who checks the phone without deciding to",
      "an invisible caregiver whose labour has no end point",
      "someone who cannot explain why ordinary conversation feels impossible at night",
    ],
    visualMetaphors: [
      "practical clothing carrying signs of continuous use without dirt or melodrama",
      "a device or work object held without attention, or no object at all",
      "a body that is upright because duty requires it, not because energy remains",
      "repetition suggested through material, fastening, or restrained pattern",
    ],
  },
  {
    threshold: "Somebody" as const,
    title: "The role you play so well you have forgotten it is a role",
    coreQuestion:
      "If the role you fill were the only thing left of you, would it be enough?",
    thesis:
      "Automatic answers and repeated duties can make a role indistinguishable from identity. The Shadow then acts through impatience, distance, and unrecognised need, especially toward the people closest to us. Real encounter begins when the role briefly comes off.",
    tensions: [
      "automatic answer versus real answer",
      "social shortcut versus total identity",
      "competence versus unspoken need",
      "declared model versus transmitted behaviour",
      "role performance versus encounter",
    ],
    humanSituations: [
      "a parent alone after performing certainty all day",
      "a manager who cannot answer honestly when asked how they are",
      "a peacemaker privately carrying anger",
      "the eldest sibling who became a substitute parent",
      "a partner whose dependable role has replaced intimacy",
    ],
    visualMetaphors: [
      "a role-specific layer worn almost like armour without becoming literal armour",
      "one softened closure, loosened cuff, or released hand",
      "posture between professional readiness and private surrender",
      "a visible function paired with a detail that asks what existed before it",
    ],
  },
  {
    threshold: "Anybody" as const,
    title: "When we were all together and no one recognised each other",
    coreQuestion:
      "How many people around you are living the same feeling you keep to yourself?",
    thesis:
      "Different people may share the sense of performing in a system they did not fully choose. Community begins not with sameness but when difference recognises difference and stays in relationship without deleting, curating, or reducing the other.",
    tensions: [
      "curated connection versus coexistence",
      "sameness versus recognised difference",
      "private isolation versus naming a shared feeling",
      "identity enclosure versus common ground",
      "individual profile versus a living public space",
    ],
    humanSituations: [
      "a newcomer who discovers others also feel out of place",
      "neighbours who share a problem but have never spoken",
      "people of different generations carrying the same uncertainty",
      "someone entering a community without needing to become similar",
      "a person who remains in a difficult shared space instead of filtering it away",
    ],
    visualMetaphors: [
      "clothing that belongs to a specific life yet carries a universal emotional logic",
      "a subtle sign of readiness to recognise another person outside the frame",
      "an ordinary public-life garment treated with dignity rather than anonymity",
      "difference communicated through specificity, not category symbols",
    ],
  },
  {
    threshold: "Anybody" as const,
    title: "The freedom that paralyses you",
    coreQuestion:
      "What choice do you keep postponing because choosing means losing something?",
    thesis:
      "Freedom can produce anxiety because every choice closes other possibilities. Excessive options consume the energy needed to live any one of them, while algorithms quietly channel apparently limitless freedom through invisible rails.",
    references: [
      "Kierkegaard: anxiety as the dizziness of freedom",
      "Sartre: even refusing to choose is a choice",
      "Barry Schwartz: too many options can collapse decision-making",
    ],
    tensions: [
      "possibility versus commitment",
      "freedom versus paralysis",
      "choice versus loss",
      "infinite options versus invisible rails",
      "reversible identity versus a lived decision",
    ],
    humanSituations: [
      "a person between two countries, careers, relationships, or homes",
      "someone keeping several futures alive and inhabiting none",
      "a young adult afraid that one choice will erase every other self",
      "a couple postponing a shared decision because it would make life real",
      "a person delegating taste and direction to recommendations",
    ],
    visualMetaphors: [
      "clothing assembled for movement while the body remains still",
      "one unresolved fastening or reversible layer",
      "hands that could act but remain deliberately restrained",
      "a clear path suggested through one chosen detail rather than many competing props",
    ],
  },
  {
    threshold: "Anybody" as const,
    title: "What is left when you put down your phone",
    coreQuestion:
      "When did you last feel your body truly present, not as image or data but as physical experience?",
    thesis:
      "The body has become something to monitor, optimise, display, and quantify rather than inhabit. Presence returns through breath, touch, slowness, shared ritual, physical memory, and gestures that communicate more than content.",
    references: [
      "Foucault: surveillance becomes self-surveillance",
      "the panopticon carried voluntarily in the pocket",
      "the Aufguss as a contemporary ritual of heat, breath, time, and shared presence",
    ],
    tensions: [
      "monitoring the body versus inhabiting it",
      "physical presence versus mental elsewhere",
      "data versus sensation",
      "optimisation versus listening",
      "message versus gesture",
    ],
    humanSituations: [
      "a person taking the first five minutes of morning before the phone",
      "someone relearning bodily trust after illness, grief, or overwork",
      "a parent whose remembered legacy may be one physical gesture",
      "partners recovering a gesture that says more than a message",
      "a person walking, cooking, bathing, breathing, or waiting without a screen",
    ],
    visualMetaphors: [
      "tactile fabrics and bodily comfort without wellness advertising",
      "hands relaxed into physical presence rather than holding a device",
      "clothing that allows breathing, movement, warmth, or contact",
      "a restrained embodied detail such as rolled sleeves, grounded footwear, or an open palm",
    ],
  },
  {
    threshold: "Anybody" as const,
    title: "The algorithm does not know who you are. Do you?",
    coreQuestion:
      "What has the algorithm helped you discover, and what has it prevented you from seeing?",
    thesis:
      "Algorithms do not need evil intentions to narrow a person's field of vision. They optimise attention by predicting what keeps a person engaged, creating a mirror that can feel like the world and a profile that can begin to feel like identity.",
    references: [
      "Eli Pariser: the filter bubble",
      "the profile as controlled self-representation",
      "real community as sustained encounter with difference",
    ],
    tensions: [
      "being predicted versus being known",
      "mirror versus world",
      "confirmation versus surprise",
      "profile versus person",
      "engagement versus attention",
      "audience size versus a small room of real questioning",
    ],
    humanSituations: [
      "someone whose feed constantly confirms a defended identity",
      "a person choosing to read what challenges them",
      "an online creator trying to recover a private self",
      "friends or partners having a conversation no recommendation system would produce",
      "a citizen staying with complexity instead of instant reaction",
    ],
    visualMetaphors: [
      "a contemporary garment with one element resisting perfect personalisation",
      "a device absent, lowered, closed, or treated as secondary",
      "an outward-facing posture suggesting readiness for an unpredicted encounter",
      "specific imperfection interrupting an otherwise optimised presentation",
    ],
  },
  {
    threshold: "Infinite" as const,
    title: "What no system reaches",
    coreQuestion: "What is there in you that no profile has ever truly captured?",
    thesis:
      "Each person is literally unrepeatable through the combination of experience, wounds, love, fear, memory, and questions. Infinite is the daily refusal to surrender that irreducibility to a format that performs, scales, and pleases.",
    tensions: [
      "unrepeatable life versus repeatable format",
      "integrity versus optimisation",
      "true version versus convenient appearance",
      "dream versus urgency",
      "inner direction versus benchmark",
    ],
    humanSituations: [
      "someone protecting a dream that produces no immediate value",
      "a person declining to imitate the version that performs best",
      "an older person carrying an unmeasurable life history",
      "a quiet individual whose influence exists in other people",
      "someone choosing coherence over applause",
    ],
    visualMetaphors: [
      "a personal detail that cannot be reduced to status or trend",
      "role clothing made secondary by an unmistakably human posture",
      "an element suggesting a private dream without literal fantasy",
      "a clear sense that the figure has chosen rather than merely complied",
    ],
  },
  {
    threshold: "Infinite" as const,
    title: "Human in a world of machines",
    coreQuestion:
      "When you let a machine think in your place, what part of becoming yourself do you avoid?",
    thesis:
      "AI can produce fast and plausible outputs, but subjective embodied experience, belief, doubt, irreversible encounter, love, mortality, and transformation cannot be delegated. The slow process of finding words is not merely inefficiency; it is part of how thought and identity form.",
    references: [
      "Heidegger: technology is a way of revealing, never merely a neutral tool",
      "legacy is relational transformation rather than generated output",
    ],
    tensions: [
      "output versus process",
      "plausibility versus lived belief",
      "speed versus formation",
      "simulation of empathy versus being changed by encounter",
      "content trace versus legacy",
    ],
    humanSituations: [
      "a student deciding what must still be learned personally",
      "a worker recovering their own voice after delegating every difficult sentence",
      "a creator using AI as an instrument without surrendering authorship",
      "a parent deciding which human capacities must be transmitted",
      "partners protecting something valuable precisely because it cannot be automated",
    ],
    visualMetaphors: [
      "a tool present but subordinate to the person",
      "clothing that reflects contemporary work without techno-futurist costume",
      "a handwritten, tactile, repaired, or personally chosen detail without readable text",
      "a body showing hesitation, attention, or decision rather than machine-like efficiency",
    ],
  },
  {
    threshold: "Infinite" as const,
    title: "The we that is missing",
    coreQuestion:
      "Is there someone in your life you have not truly seen beyond the role they play?",
    thesis:
      "The figures who once knew people across time have become fragmented and specialised. A real we is built in the space between people through continuity, listening, disagreement, vulnerability, trust, and recognition that the other is irreducible.",
    references: [
      "Hannah Arendt: politics arises in the space between people",
      "Levinas: the other's face makes a claim before permission is given",
      "Simone Weil: attention as a radical form of love and generosity",
    ],
    tensions: [
      "communication volume versus being known over time",
      "parallel speech versus dialogue",
      "agreement versus staying together through difference",
      "individual achievement versus shared intelligence",
      "self-knowledge versus truly seeing another",
    ],
    humanSituations: [
      "a long-term listener who knows a person's history",
      "a mediator staying in motion with people who disagree",
      "a neighbour noticing a change others missed",
      "a couple turning trust into a project that serves others",
      "someone learning to see a parent, worker, migrant, elder, or opponent as a person",
    ],
    visualMetaphors: [
      "a posture of listening toward someone outside the frame",
      "clothing that suggests service without institutional insignia",
      "an open stance carrying responsibility rather than dominance",
      "one relational object only when subtle, personal, and unbranded",
    ],
  },
  {
    threshold: "Infinite" as const,
    title: "The Earth we are",
    coreQuestion:
      "What responsibility toward those who come after you are you avoiding?",
    thesis:
      "The climate crisis can produce helplessness that starts to resemble indifference. Integral ecology joins care for the self, relationships, communities, food, place, and Earth because the same extractive logic exhausts both people and planet.",
    references: [
      "Pope Francis: integral ecology and the principle that everything is connected",
      "Arne Næss: nature has value in itself and requires relationship",
      "Hans Jonas: act in a way compatible with genuinely human life for those not yet born",
      "Sara Roversi and the Future Food Institute: regeneration through food, education, territory, care, and community",
    ],
    tensions: [
      "extraction versus regeneration",
      "ownership versus stewardship",
      "helplessness versus daily practice",
      "consumption versus inheritance",
      "urgency versus the intelligence of rest",
    ],
    humanSituations: [
      "a steward returning a place in better condition",
      "a food-system worker caring for territory rather than merely producing",
      "a parent modelling restraint and regeneration",
      "a person translating climate anxiety into one durable responsibility",
      "someone allowing land, body, or community to rest rather than extracting more",
    ],
    visualMetaphors: [
      "workwear or everyday clothing marked by repair, care, reuse, cultivation, or stewardship without greenwashing",
      "one natural or food-related object only when symbolically restrained and realistic",
      "materials suggesting durability and care rather than consumption",
      "a grounded stance of tending rather than heroic saving",
    ],
  },
  {
    threshold: "Infinite" as const,
    title: "When the world is burning",
    coreQuestion:
      "When conflict reduces another person to a category, can you remain in relationship with their complexity?",
    thesis:
      "The feed places war, bodies, recipes, and jokes in one continuous stream, dissolving the protocol for pain. Violence begins when the other loses a face and becomes enemy, tribe, number, or category. Peace also begins before treaties, in daily language and the practice of staying with otherness.",
    references: [
      "Levinas: ethics begins with the face of the other",
      "Arendt: war compresses complex identity into tribe and border",
    ],
    tensions: [
      "mediated proximity versus real presence",
      "feeling versus scrolling",
      "face versus category",
      "complexity versus tribe",
      "automatic reaction versus elaborated responsibility",
      "harmony through erasure versus peace through recognition",
    ],
    humanSituations: [
      "a person carrying news of conflict into an ordinary day",
      "someone speaking carefully to children about war",
      "a displaced person refusing to be reduced to displacement",
      "partners or friends remaining in relationship through deep disagreement",
      "a citizen resisting dehumanising language",
    ],
    visualMetaphors: [
      "dignified everyday clothing carrying the weight of witness without depicting violence",
      "a posture that refuses both aggression and passive detachment",
      "one sign of memory, repair, or displacement without national flags or political slogans",
      "the face-covering system used to heighten ethical presence, never to erase personhood",
    ],
  },
  {
    threshold: "Infinite" as const,
    title: "Infinite and the trace left in others",
    coreQuestion: "Who will you be when it is all over?",
    thesis:
      "Identity is not finally answered; it is revisited. What remains is built through small, almost invisible gestures of listening, staying, loving, asking, transmitting courage, changing places, and becoming a presence another person recognises as home.",
    references: [
      "Levinas: responsibility",
      "Simone Weil: attention",
      "Plato: love as movement toward the other",
    ],
    tensions: [
      "achievement versus trace",
      "large gesture versus small act done wholly",
      "self-definition versus what remains in others",
      "solitary introspection versus the path from I to other",
      "planned legacy versus invisible daily inheritance",
    ],
    humanSituations: [
      "the person whose one act of attention changed another life",
      "a teacher, parent, friend, neighbour, host, or caregiver remembered for how they were",
      "someone repairing a relationship through presence rather than explanation",
      "a person choosing to stay when disappearing would be easier",
      "an ordinary life whose legacy is relational rather than public",
    ],
    visualMetaphors: [
      "a mature, settled stance without triumph",
      "clothing carrying continuity, repair, or memory",
      "one subtle inherited or transmitted object without readable text",
      "a figure whose quiet presence suggests they have affected lives beyond the frame",
    ],
  },
] as const;

export const NOBODY_BOOK_CHAPTER_THEMES = NOBODY_BOOK_CHAPTERS.map(
  (chapter) =>
    `${chapter.title}: ${chapter.thesis} Core tension: ${chapter.tensions.join(
      "; ",
    )}.`,
);

export const NOBODY_BOOK_QUESTIONS = [
  "Who are you when no one is watching?",
  "Which mask do you wear so often you've forgotten it's a mask?",
  "What do you hide behind your smile?",
  "When did you betray yourself and pretend nothing happened?",
  "What are you most afraid of that you've never said out loud?",
  "When did you feel most alive, where were you, and who were you with?",
  "What have you never told anyone, and what would happen if you said it now?",
  "What desire have you buried because it seemed impossible or wrong?",
  "What makes you fragile in a way you would not change?",
  "What is your greatest wound, and what did it teach you?",
  "Who have you not apologised to yet?",
  "What would make you a better person that you keep putting off?",
  "What is your subtlest addiction, the one you do not call an addiction?",
  "If your body could speak, what would it tell you that you are ignoring?",
  "How much of who you are is truly yours, and how much have you borrowed from others?",
  "What do you think no machine will ever understand about you?",
  "When did you feel part of something larger than yourself, and what did you leave in it?",
  "Which version of you exists only online, and how much do you miss or resent it?",
  "What do you love about yourself that you have never said out loud?",
  "What can you not forgive in someone else or in yourself?",
  "If you could remove one thing from the world, what would it be?",
  "What responsibility toward those who come after you are you avoiding?",
  "How large is the distance between who you are privately and who you show publicly, and how large do you want it to be?",
  "Is there a dream you stopped saying out loud because you stopped feeling entitled to have it?",
  "Who will you be when it is all over?",
] as const;

export const NOBODY_BOOK_AUDIENCE_LENSES = [
  "For the self in silence: no audience, no evaluation, no requirement to remain consistent with the public version.",
  "For a young person: identity built simultaneously online and offline, possibility and anxiety, validation, algorithmic influence, inherited climate and political realities, and the need to retain choice.",
  "For a parent: the unplanned legacy transmitted through behaviour under fatigue, fear, disagreement, screens, touch, stewardship, and language about other people.",
  "For a son or daughter: seeing a parent as a person with a life before parenthood, unnamed tiredness, abandoned dreams, difficult choices, physical memories, and conversations that may still be possible.",
  "For people who share a life: the other as the hardest mirror, intimacy beyond roles, silence, bodily gestures, shared choices, difficult conversations, disagreement without erasure, and what their love leaves in the world.",
  "For workers and creators: alienation, self-exploitation, authorship, the pressure to become a brand, the role that replaces the person, invisible labour, and the need for regeneration.",
  "For citizens and communities: public space, politics between people, listening, disagreement, coexistence with difference, responsibility, war, peace, climate, food, territory, and stewardship.",
  "For a person in transition: migration, ageing, illness, grief, parenthood, retirement, leadership, loss of status, recovery, choosing a home, ending a role, beginning again, or becoming unnecessary in a former function.",
] as const;

export const NOBODY_BOOK_AUTHORIAL_VALUES = [
  "Humility and curiosity remain useful because growth stops when a person stops asking who they are and where they may be wrong.",
  "Finding one's place requires stopping the imitation of somebody else's place; 'me too' can become a refined form of self-abandonment when it erases difference.",
  "Diversity is not a declared value but a daily practice expressed through listening, building, choosing, and remaining with people who are not the same.",
  "Real impact passes through care for food, places, people, relationships, and Earth.",
  "Passion is not decorative emotion but a motor that must be placed at the centre or it is lost.",
  "Learning happens through doing, error, feedback, responsibility, and continued relationship with what one builds.",
  "Identity is a practice of listening rather than a final definition.",
  "The point is not to remove every mask but to remember that a mask is being worn.",
  "The authorial voice is direct, intimate, restrained, contemporary, morally serious without preaching, and willing to leave the question unanswered.",
] as const;

export const NOBODY_BOOK_VOICES = [
  "Pirandello — fragmented identity and the many selves held by other people's gazes.",
  "Bauman — liquid modernity and lives without stable anchors.",
  "Van Gogh — self-portrait as repeated inward search rather than vanity.",
  "Jung — Persona, Shadow, excluded emotions, and the cost of disowned parts.",
  "Oscar Wilde — the mask as a condition that can permit truth.",
  "Marx — alienation when work no longer belongs to the worker or returns the self.",
  "Byung-Chul Han — self-exploitation, performance, and contemporary exhaustion.",
  "Kierkegaard — anxiety as the dizziness produced by freedom.",
  "Sartre — the impossibility of escaping choice.",
  "Camus — meaning and dignity inside repetition rather than outside it.",
  "Foucault — surveillance internalised as self-surveillance.",
  "Heidegger — technology as a way of revealing and organising the world, never merely a neutral tool.",
  "Arendt — politics and shared reality arising in the space between people.",
  "Levinas — ethics beginning in the face and irreducibility of the other.",
  "Simone Weil — attention as a rare and pure form of generosity.",
  "Hans Jonas — responsibility toward people not yet born.",
  "Pope Francis — integral ecology and the inseparability of Earth, relationships, and self.",
  "Gregory Bateson — ecology of mind and the continuity between relational and environmental patterns.",
  "Arne Næss — nature as relationship and intrinsic value rather than resource.",
  "Alex Zanardi — questions, rather than answers, as what matters most in human life.",
  "Sara Roversi — the future cultivated through systemic regeneration, food, education, territory, care, and community.",
] as const;

export const NOBODY_BOOK_VISUAL_GRAMMAR = [
  "The book's threshold imagery moves from a single helmeted figure dissolving at the lower body, to one central Somebody surrounded by alternate role versions, to different helmeted people sharing a public waiting place, and finally to an unmasked human standing while the helmet rests beside him.",
  "Use these as conceptual movements, not layouts to copy: fragmentation becoming visible; role multiplication; difference sharing space; and the human presence becoming more important than the mask.",
  "The production artwork remains one calm, front-facing, standing figure. Never reproduce the book pages, typography, arches, crowd scenes, monuments, scenery, or illustrations literally.",
  "The role must be legible through clothing, material, fit, wear, posture, and at most one restrained object. The deeper book question must be legible through contradiction, not through text or theatrical symbolism.",
  "A strong image contains two truths at once: what the person is expected to be and what the person may actually be living.",
  "The emotional register is dignified, quiet, unresolved, contemporary, and human. Avoid spectacle, fantasy, horror, melodrama, pity, sentimentality, or motivational triumph.",
  "Ordinary life is preferred to exceptional status. Small responsibilities, invisible labour, family memory, care, transition, listening, repair, and presence are as important as formal occupations.",
  "No readable words, logos, branding, insignia, flags, weapons, political slogans, religious propaganda, or demographic caricatures.",
] as const;

export const NOBODY_BOOK_CREATIVE_BOUNDARIES = [
  "Do not turn a philosophical theme into a literal prop: no cages for trapped roles, no broken chains for freedom, no glowing hearts for love, no planet held in hands for ecology, no binary code covering a technologist, and no masks stacked around a person.",
  "Do not use suffering as aesthetic decoration. Conflict, displacement, burnout, grief, care, and vulnerability must retain dignity and specificity.",
  "Do not reduce a person to profession, nationality, class, age, gender, diagnosis, parenthood, migration status, or political position.",
  "Do not copy the 25 Keys mechanically. A daily concept question may echo their depth but should usually be newly written for the specific life situation.",
  "Do not imply that technology, work, society, family, or roles are simply evil. The book examines what happens when useful systems occupy too much of life.",
  "Do not resolve the artwork with a lesson, redemption arc, therapy slogan, or guaranteed transformation. Preserve uncertainty and the dignity of an unanswered question.",
  "Do not repeat stock roles or lightly rename them. A profession is acceptable only when the inner conflict is specific and visually distinct.",
  "Do not confuse diversity with checking categories. Diversity must appear in different forms of responsibility, relationship, life stage, visibility, work, embodiment, belief, transition, and social expectation.",
] as const;

export const NOBODY_DAILY_PLANNER_SOURCEBOOK = [
  NOBODY_BOOK_IDENTITY,
  "",
  "AUTHORIAL VALUES:",
  ...NOBODY_BOOK_AUTHORIAL_VALUES.map((value) => `- ${value}`),
  "",
  "VISUAL GRAMMAR:",
  ...NOBODY_BOOK_VISUAL_GRAMMAR.map((value) => `- ${value}`),
  "",
  "CREATIVE BOUNDARIES:",
  ...NOBODY_BOOK_CREATIVE_BOUNDARIES.map((value) => `- ${value}`),
].join("\n");
