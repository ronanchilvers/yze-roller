import assert from "node:assert/strict";
import { test } from "vitest";
import {
  buildDisplayName,
  parseCharacterImport,
  parseCharacterJson,
  REQUIRED_ATTRIBUTES,
} from "./character-import.js";
import SKILL_ATTRIBUTE_MAP, {
  CANONICAL_SKILLS,
} from "../data/skill-mappings.js";

const createValidCharacter = () => ({
  firstname: "Bessie",
  lastname: "Collins",
  nickname: "Mope",
  attribute_strength: "1",
  attribute_agility: "2",
  attribute_wits: "3",
  attribute_empathy: "4",
  skill_hoodwink: "2",
  skill_sneak: "3",
  skill_streetwise: "2",
});

test("parseCharacterJson rejects invalid JSON strings", () => {
  const result = parseCharacterJson("{nope");
  assert.equal(result.data, null);
  assert.ok(result.error.startsWith("Invalid JSON"));
});

test("parseCharacterJson rejects non-object payloads", () => {
  const result = parseCharacterJson(JSON.stringify(["nope"]));
  assert.equal(result.data, null);
  assert.equal(result.error, "JSON must be an object.");
});

test("parseCharacterJson returns object payloads", () => {
  const payload = { hello: "world" };
  const result = parseCharacterJson(JSON.stringify(payload));
  assert.deepEqual(result.data, payload);
  assert.equal(result.error, null);
});

test("buildDisplayName prefers firstname nickname lastname", () => {
  const name = buildDisplayName({
    firstname: "Bessie",
    nickname: "Mope",
    lastname: "Collins",
  });
  assert.equal(name, 'Bessie "Mope" Collins');
});

test("buildDisplayName falls back sensibly when fields are missing", () => {
  assert.equal(buildDisplayName({ firstname: "Bessie" }), "Bessie");
  assert.equal(buildDisplayName({ lastname: "Collins" }), "Collins");
  assert.equal(buildDisplayName({ name: "Fallback Name" }), "Fallback Name");
  assert.equal(buildDisplayName({}), "Imported Character");
});

test("parseCharacterImport rejects missing required attributes", () => {
  const payload = createValidCharacter();
  delete payload.attribute_strength;

  const result = parseCharacterImport(payload);
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some((error) => error.includes("Strength")));
});

test("parseCharacterImport rejects non-positive attribute dice", () => {
  const payload = createValidCharacter();
  payload.attribute_wits = "0";

  const result = parseCharacterImport(payload);
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some((error) => error.includes("Wits")));
});

test("parseCharacterImport rejects non-integer attribute dice", () => {
  const payload = createValidCharacter();
  payload.attribute_agility = "2.5";

  const result = parseCharacterImport(payload);
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some((error) => error.includes("Agility")));
});

test("parseCharacterImport accepts valid attributes and defaults missing skills to 0", () => {
  const payload = createValidCharacter();
  delete payload.skill_hoodwink;

  const result = parseCharacterImport(payload);
  assert.equal(result.isValid, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.character.skills.Hoodwink, 0);
});

test("parseCharacterImport records warnings for invalid skill values", () => {
  const payload = createValidCharacter();
  payload.skill_sneak = "";

  const result = parseCharacterImport(payload);
  assert.equal(result.isValid, true);
  assert.equal(result.character.skills.Sneak, 0);
  assert.ok(result.warnings.some((warning) => warning.includes("Sneak")));
});

test("parseCharacterImport warns on non-integer skill dice values", () => {
  const payload = createValidCharacter();
  payload.skill_streetwise = "1.75";

  const result = parseCharacterImport(payload);
  assert.equal(result.isValid, true);
  assert.equal(result.character.skills.Streetwise, 0);
  assert.ok(result.warnings.some((warning) => warning.includes("Streetwise")));
});

test("parseCharacterImport respects canonical skills list", () => {
  const payload = createValidCharacter();
  payload.skill_fake = "3";

  const result = parseCharacterImport(payload, {
    canonicalSkills: CANONICAL_SKILLS,
    skillAttributeMap: SKILL_ATTRIBUTE_MAP,
  });

  assert.equal(result.isValid, true);
  assert.equal(result.character.skills.fake, undefined);
});

test("parseCharacterImport includes mapping for each canonical skill", () => {
  const payload = createValidCharacter();
  const result = parseCharacterImport(payload, {
    canonicalSkills: CANONICAL_SKILLS,
    skillAttributeMap: SKILL_ATTRIBUTE_MAP,
  });

  assert.equal(result.isValid, true);
  for (const skill of CANONICAL_SKILLS) {
    assert.ok(result.character.skillAttributes[skill]);
  }
});

test("parseCharacterImport normalizes attributes to required keys", () => {
  const payload = createValidCharacter();
  const result = parseCharacterImport(payload);

  for (const attributeKey of Object.keys(REQUIRED_ATTRIBUTES)) {
    assert.ok(Number.isInteger(result.character.attributes[attributeKey]));
  }
});