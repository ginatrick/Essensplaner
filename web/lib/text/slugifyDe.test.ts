import { test } from "node:test";
import assert from "node:assert/strict";
import { slugifyDe } from "./slugifyDe.ts";

test("Umlaute werden transliteriert", () => {
  assert.equal(slugifyDe("Käse"), "kaese");
  assert.equal(slugifyDe("Kaese"), "kaese");
});

test("ß wird zu ss", () => {
  assert.equal(slugifyDe("Gemüse"), "gemuese");
});

test("Leerzeichen werden zu Trennstrichen", () => {
  assert.equal(slugifyDe("Hüttenkäse natur"), "huettenkaese-natur");
});

test("Führende/nachgestellte Trennstriche werden entfernt", () => {
  assert.equal(slugifyDe("  Öl!  "), "oel");
});
