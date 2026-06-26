import type { CharacterIdentity, PersonaCard } from "./types";

const TEMPERAMENTS = [
  "warm but wary",
  "ambitious and restless",
  "calm and observant",
  "dramatic and expressive",
  "practical and blunt",
];

const ECONOMIC = [
  "rent-stressed freelancer",
  "stable salaried professional",
  "recent relocation",
  "side-hustle dependent",
  "family-support obligations",
];

const SOCIAL = [
  "neighborly",
  "keeps to themselves",
  "chatty in halls",
  "conflict-averse",
  "opinionated",
];

const HOUSING = [
  "values quiet",
  "wants premium finishes",
  "needs short commute",
  "prioritizes space",
  "tolerates clutter",
];

const FLAWS = [
  "chronic lateness",
  "noise sensitivity",
  "trust issues",
  "overcommits socially",
  "avoids maintenance requests",
];

export const DEMO_SPRITE_CAST = [
  {
    agentId: "resident-vampire-girl",
    displayName: "Luna",
    spriteKey: "assets/fancy_people/Vampire_Girl",
    gender: "female" as const,
  },
  {
    agentId: "resident-countess",
    displayName: "Countess",
    spriteKey: "assets/fancy_people/Countess_Vampire",
    gender: "female" as const,
  },
  {
    agentId: "resident-gangster-2",
    displayName: "Marco",
    spriteKey: "assets/Gangsters_2",
    gender: "male" as const,
  },
  {
    agentId: "resident-gangster-3",
    displayName: "Vince",
    spriteKey: "assets/Gangsters_3",
    gender: "male" as const,
  },
  {
    agentId: "resident-skelly",
    displayName: "Skelly",
    spriteKey: "assets/FREE_SkeletonPack_ByPhewcumber",
    gender: "male" as const,
    modifiers: [
      "comedically grumpy",
      "makes bone puns",
      "dislikes noisy neighbors",
      "oddly responsible about rent",
      "deadpan fatalism",
    ],
  },
];

export function dealPersonaCards(seed: string): PersonaCard {
  const hash = simpleHash(seed);
  return {
    temperament: TEMPERAMENTS[hash % TEMPERAMENTS.length],
    economicPressure: ECONOMIC[(hash >> 3) % ECONOMIC.length],
    socialStyle: SOCIAL[(hash >> 6) % SOCIAL.length],
    housingPreference: HOUSING[(hash >> 9) % HOUSING.length],
    flawOrStressor: FLAWS[(hash >> 12) % FLAWS.length],
  };
}

export function buildCharacterIdentity(
  castMember: (typeof DEMO_SPRITE_CAST)[number],
  seed: string
): CharacterIdentity {
  return {
    agentId: castMember.agentId,
    displayName: castMember.displayName,
    spriteKey: castMember.spriteKey,
    gender: castMember.gender,
    persona: dealPersonaCards(`${seed}:${castMember.agentId}`),
    modifiers: "modifiers" in castMember ? castMember.modifiers : undefined,
  };
}

function simpleHash(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
