// Проверка целостности списков: node selfcheck.mjs  (node ≥22.18 — импортирует .ts напрямую)
import assert from "node:assert";
import { NEEDS, FEELINGS_MET, FEELINGS_UNMET, VALUES } from "./src/data.ts";

for (const [name, list] of Object.entries({ NEEDS, FEELINGS_MET, FEELINGS_UNMET, VALUES })) {
  assert(Array.isArray(list) && list.length > 30, `${name}: list too small`);
  assert(list.every((x) => typeof x === "string" && x.trim()), `${name}: bad entry`);
  assert(new Set(list).size === list.length, `${name}: duplicates`);
}
const overlap = FEELINGS_MET.filter((x) => FEELINGS_UNMET.includes(x));
assert(overlap.length === 0, `met/unmet overlap: ${overlap}`);
console.log(`ok: ${NEEDS.length} needs, ${FEELINGS_MET.length}+${FEELINGS_UNMET.length} feelings, ${VALUES.length} values`);
