import type { NobodyThreshold } from "./types";

export const NOBODY_BOOK_CONTEXT_VERSION = "2026-07-14.1";

export const NOBODY_BOOK_THRESHOLDS: ReadonlyArray<
  Readonly<{
    name: NobodyThreshold;
    meaning: string;
    visualTension: string;
  }>
> = [
  {
    name: "Nobody",
    meaning:
      "The noise falls away and the person beneath the label becomes visible. The central movements are silence, integrity, vulnerability, forgotten dreams, the body, and the distance between the functioning self and the real self.",
    visualTension:
      "A role is present, but it is quiet enough for the human being underneath to be felt.",
  },
  {
    name: "Somebody",
    meaning:
      "The person has become recognisable through a name, duty, social role, achievement, expectation, or identity that may have changed from a useful tool into a cage.",
    visualTension:
      "The clothing clearly communicates a role while the image questions whether the role has taken the person's place.",
  },
  {
    name: "Anybody",
    meaning:
      "Identity becomes fluid, multiplied, algorithmically shaped, and sometimes paralysed by choice. The counter-movement is presence, embodiment, difference, recognition, and real community.",
    visualTension:
      "The figure feels singular and universal at once, never reduced to a stereotype or social category.",
  },
  {
    name: "Infinite",
    meaning:
      "The person contains something no system can measure: love, responsibility, attention, dreams, legacy, relationship, care for the Earth, and the capacity to recognise the irreducible other.",
    visualTension:
      "The role becomes secondary to a timeless, relational, responsible human presence.",
  },
] as const;

export const NOBODY_BOOK_CHAPTER_THEMES = [
  "the versions of the self used across work, family, friendship, social media, and solitude",
  "the public face, the hidden self, Persona, Shadow, and the covered face that can reveal truth",
  "invisible fatigue, self-exploitation, availability without presence, and the loss of empty time",
  "the role performed so well that it becomes identity",
  "freedom, postponed choices, the paralysis of too many possibilities, and the cost of every yes",
  "returning to the body, physical presence, touch, memory, and life beyond the screen",
  "profiles, algorithms, filter bubbles, attention, and the difference between being known and being predicted",
  "what remains human in a world of machines: embodied experience, love, belief, doubt, transformation, and legacy",
  "the missing we: listening, disagreement, relationship, community, and seeing the person beyond the role",
  "integral ecology, stewardship, regeneration, care for food, places, people, and the Earth",
  "war, dehumanisation, the disappearing face, tribal identity, responsibility, and peace as a daily practice",
  "integrity as becoming whole and dream as becoming alive",
] as const;

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
  "How large is the distance between who you are privately and who you show publicly?",
  "Is there a dream you stopped saying out loud because you stopped feeling entitled to have it?",
  "Who will you be when it is all over?",
] as const;

export const NOBODY_BOOK_AUDIENCE_LENSES = [
  "a person alone in silence",
  "a young person building an identity online and offline",
  "a parent whose example is becoming a legacy",
  "a son or daughter trying to see a parent as a person",
  "partners trying to remain present to one another",
  "friends who know different versions of the same person",
  "a worker, caregiver, neighbour, citizen, creator, or community member",
  "someone moving through loss, transition, uncertainty, migration, ageing, responsibility, or renewal",
] as const;

export const NOBODY_DAILY_PLANNER_SOURCEBOOK = [
  "I AM NOBODY is not a catalogue of professions. It is a visual inquiry into identity, roles, relationship, presence, integrity, dream, community, technology, Earth, conflict, and legacy.",
  "The daily collection may include professions, but it must also include relational roles, life stages, social expectations, invisible labour, inner conflicts, transitions, civic responsibility, care, embodied experience, and ordinary human situations.",
  "Every artwork is one anonymous standing figure in the established I AM NOBODY visual universe. The setting is never literal. The role is communicated through clothing, material, posture, one optional restrained object, and the emotional logic of the image.",
  "Do not reduce people to clichés, costumes, luxury signals, uniforms, identity labels, or simplistic demographic stereotypes.",
  "The collection should feel editorial, contemporary, human, restrained, and connected to the book's questions rather than to trend forecasting or advertising.",
  "The ten briefs must be genuinely different from one another and from recent Studio history. They must not be a renamed repetition of businessman, student, worker, chef, artist, athlete, parent, traveller, speaker, or similar stock roles.",
  "Invent new roles and situations whenever the book supports them. Examples of the level of breadth include invisible caregiver, first-time leader, night-shift listener, person between homes, sibling carrying family memory, retired expert learning to be unnecessary, mediator staying inside disagreement, climate steward, person rebuilding trust, volunteer after a crisis, or someone choosing to disconnect. These are examples of breadth, not a list to repeat.",
].join("\n");
