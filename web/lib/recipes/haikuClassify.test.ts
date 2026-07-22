import { test } from "node:test";
import assert from "node:assert/strict";
import { haikuClassify, type AnthropicMessagesClient } from "./haikuClassify.ts";

// Fake-Client: bildet nur messages.create() nach, kein echter API-Call.
function makeFakeHaiku(toolInput: unknown, calls: unknown[] = []): AnthropicMessagesClient {
  return {
    messages: {
      async create(params: unknown) {
        calls.push(params);
        return { content: [{ type: "tool_use", input: toolInput }] };
      },
    },
  };
}

const known = [
  { id: "ing-1", name: "Petersilie" },
  { id: "ing-2", name: "Olivenöl" },
];

test("Treffer: gibt die von Haiku gewählte ingredient_id zurück", async () => {
  const client = makeFakeHaiku({ ingredient_id: "ing-1" });

  const result = await haikuClassify(client, "glatte Petersilie", known);

  assert.equal(result, "ing-1");
});

test("Kein Treffer (ingredient_id: null) → null", async () => {
  const client = makeFakeHaiku({ ingredient_id: null });

  const result = await haikuClassify(client, "Einhornstaub", known);

  assert.equal(result, null);
});

test("Halluzinierte id außerhalb der Liste wird verworfen → null", async () => {
  const client = makeFakeHaiku({ ingredient_id: "ing-erfunden" });

  const result = await haikuClassify(client, "glatte Petersilie", known);

  assert.equal(result, null);
});

test("Prompt enthält den Zutatentext und alle bekannten Zutaten", async () => {
  const calls: unknown[] = [];
  const client = makeFakeHaiku({ ingredient_id: "ing-2" }, calls);

  await haikuClassify(client, "Olivenöl nativ", known);

  const params = calls[0] as { model: string; messages: { content: string }[]; tool_choice: { name: string } };
  assert.equal(params.model, "claude-haiku-4-5-20251001");
  assert.match(params.messages[0].content, /Olivenöl nativ/);
  assert.match(params.messages[0].content, /ing-1: Petersilie/);
  assert.equal(params.tool_choice.name, "classify_ingredient");
});

test("Leerer Text → null ohne API-Call", async () => {
  const calls: unknown[] = [];
  const client = makeFakeHaiku({ ingredient_id: "ing-1" }, calls);

  const result = await haikuClassify(client, "   ", known);

  assert.equal(result, null);
  assert.equal(calls.length, 0);
});

test("Leere Zutatenliste → null ohne API-Call", async () => {
  const client = makeFakeHaiku({ ingredient_id: "ing-1" });

  const result = await haikuClassify(client, "Salz", []);

  assert.equal(result, null);
});
