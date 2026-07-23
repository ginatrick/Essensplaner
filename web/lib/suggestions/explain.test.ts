import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { explainSuggestion, type AnthropicTextClient } from "./explain.ts";

function makeFakeHaiku(text: string, calls: unknown[] = []): AnthropicTextClient {
  return {
    messages: {
      async create(params: unknown) {
        calls.push(params);
        return { content: [{ type: "text", text }] };
      },
    },
  };
}

describe("explainSuggestion", () => {
  test("ohne Fakten -> Fallback-Text, kein API-Call", async () => {
    const calls: unknown[] = [];
    const client = makeFakeHaiku("sollte nicht genutzt werden", calls);
    const result = await explainSuggestion(client, { improvedCriteria: [], explorationTitles: [], favoriteTitles: [] });
    assert.equal(result, "Diese Woche basiert auf deinen bisherigen Vorlieben.");
    assert.equal(calls.length, 0);
  });

  test("mit Fakten -> ruft Haiku und gibt den Text zurück", async () => {
    const client = makeFakeHaiku("Diese Woche mit mehr Hülsenfrüchten.");
    const result = await explainSuggestion(client, {
      improvedCriteria: ["Hülsenfrüchte"], explorationTitles: ["Linsencurry"], favoriteTitles: ["Kichererbsen-Curry"],
    });
    assert.equal(result, "Diese Woche mit mehr Hülsenfrüchten.");
  });

  test("leere Antwort von Haiku -> Fallback-Text", async () => {
    const client = makeFakeHaiku("");
    const result = await explainSuggestion(client, { improvedCriteria: ["Fisch"], explorationTitles: [], favoriteTitles: [] });
    assert.equal(result, "Diese Woche basiert auf deinen bisherigen Vorlieben.");
  });
});
