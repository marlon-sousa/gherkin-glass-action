// Tests the field reader the policies use on what GitHub or ghg write, for docs/BEHAVIOUR.md, rules 7 and 24 to 29.

import assert from "node:assert/strict";
import { test } from "node:test";
import { fieldOf } from "../../src/policies/json_field.ts";

test("a field of an object is given as it is", () => {
  assert.equal(fieldOf({ outcome: "built" }, "outcome"), "built");
  assert.deepEqual(fieldOf({ head: { sha: "a" } }, "head"), { sha: "a" });
});

test("a missing field, or a value that is not an object, gives undefined", () => {
  for (const value of [{}, null, undefined, "text", 3, ["outcome"]]) assert.equal(fieldOf(value, "outcome"), undefined);
});
