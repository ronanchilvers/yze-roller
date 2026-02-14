const SKILL_ATTRIBUTE_MAP = Object.freeze({
  Burgle: "Wits",
  Cajole: "Empathy",
  Deduce: "Wits",
  Hoodwink: "Empathy",
  Notice: "Wits",
  Physick: "Empathy",
  Pinch: "Agility",
  Scramble: "Agility",
  Scrap: "Strength",
  Sneak: "Agility",
  Streetwise: "Wits",
  Tinker: "Wits",
});

export const SKILL_ATTRIBUTE_ENTRIES = Object.freeze(
  Object.entries(SKILL_ATTRIBUTE_MAP),
);

export const CANONICAL_SKILLS = Object.freeze(
  Object.keys(SKILL_ATTRIBUTE_MAP),
);

export default SKILL_ATTRIBUTE_MAP;