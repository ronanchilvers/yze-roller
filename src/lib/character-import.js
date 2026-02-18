import SKILL_ATTRIBUTE_MAP, {
  CANONICAL_SKILLS,
} from "../data/skill-mappings.js";

export const REQUIRED_ATTRIBUTES = Object.freeze({
  strength: "Strength",
  agility: "Agility",
  wits: "Wits",
  empathy: "Empathy",
});

const normalizeKey = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const toInteger = (value) => {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") {
      return null;
    }
    if (!/^-?\d+$/.test(trimmed)) {
      return null;
    }
    return Number(trimmed);
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return null;
  }

  return parsed;
};

const toSkillDiceCount = (value) => {
  const parsed = toInteger(value);
  if (parsed === null) {
    return null;
  }

  if (parsed < 0 || parsed > 10) {
    return null;
  }

  return parsed;
};

const toPositiveInteger = (value) => {
  const parsed = toInteger(value);
  if (parsed === null) {
    return null;
  }
  return parsed >= 1 ? parsed : null;
};

const buildLookup = (source) => {
  const entries = Object.entries(source ?? {});
  const lookup = new Map();

  for (const [key, value] of entries) {
    lookup.set(normalizeKey(key), value);
  }

  return lookup;
};

export const parseCharacterJson = (text) => {
  if (typeof text !== "string") {
    return { data: null, error: "Import payload must be a JSON string." };
  }

  try {
    const data = JSON.parse(text);
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return { data: null, error: "JSON must be an object." };
    }
    return { data, error: null };
  } catch (error) {
    return {
      data: null,
      error: error?.message ? `Invalid JSON: ${error.message}` : "Invalid JSON.",
    };
  }
};

export const buildDisplayName = (source) => {
  const first = String(source?.firstname ?? "").trim();
  const last = String(source?.lastname ?? "").trim();
  const nickname = String(source?.nickname ?? "").trim();
  const pieces = [];

  if (first) {
    pieces.push(first);
  }

  if (nickname) {
    pieces.push(`"${nickname}"`);
  }

  if (last) {
    pieces.push(last);
  }

  const display = pieces.join(" ").trim();
  if (display) {
    return display;
  }

  return String(source?.name ?? "").trim() || "Imported Character";
};

const buildSkillKeyMap = (skills) => {
  const map = new Map();

  for (const skill of skills) {
    map.set(`skill_${normalizeKey(skill)}`, skill);
  }

  return map;
};

export const parseCharacterImport = (
  source,
  {
    skillAttributeMap = SKILL_ATTRIBUTE_MAP,
    canonicalSkills = CANONICAL_SKILLS,
  } = {},
) => {
  const errors = [];
  const warnings = [];
  const lookup = buildLookup(source);

  const attributes = {};
  for (const [attributeKey, label] of Object.entries(REQUIRED_ATTRIBUTES)) {
    const raw = lookup.get(`attribute_${attributeKey}`);
    const parsed = toPositiveInteger(raw);

    if (parsed === null) {
      errors.push(`Missing or invalid ${label} attribute dice.`);
      continue;
    }

    attributes[attributeKey] = parsed;
  }

  const skillKeyMap = buildSkillKeyMap(canonicalSkills);
  const skills = {};

  for (const [key, value] of lookup.entries()) {
    if (!key.startsWith("skill_")) {
      continue;
    }

    const canonical = skillKeyMap.get(key);
    if (!canonical) {
      continue;
    }

    const parsed = toSkillDiceCount(value);
    if (parsed === null) {
      warnings.push(`Invalid dice count for ${canonical}; using 0.`);
      skills[canonical] = 0;
      continue;
    }

    skills[canonical] = parsed;
  }

  for (const canonical of canonicalSkills) {
    if (!(canonical in skills)) {
      skills[canonical] = 0;
    }
  }

  const normalizedSkills = {};
  for (const skill of canonicalSkills) {
    normalizedSkills[skill] = skills[skill] ?? 0;
  }

  const skillAttributes = {};
  for (const [skill, attribute] of Object.entries(skillAttributeMap)) {
    const skillKey = canonicalSkills.includes(skill) ? skill : null;
    if (!skillKey) {
      continue;
    }
    skillAttributes[skillKey] = attribute;
  }

  const missingSkillMappings = Object.keys(normalizedSkills).filter(
    (skill) => !skillAttributes[skill],
  );
  if (missingSkillMappings.length > 0) {
    errors.push(
      `Missing attribute mapping for: ${missingSkillMappings.join(", ")}.`,
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    character: {
      name: buildDisplayName(source),
      attributes,
      skills: normalizedSkills,
      skillAttributes,
    },
  };
};
