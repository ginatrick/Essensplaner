// Begründung, Schritt 3 aus docs/10-modul-lernen.md: "Der LLM wählt nicht
// aus, er erklärt nur." Grounded ausschließlich in übergebenen Fakten, kein
// Erfinden von Zutaten oder Ähnlichkeiten. Modell: Haiku 4.5 (docs/11).

export const HAIKU_MODEL = "claude-haiku-4-5-20251001";

// Gleiche minimale Client-Schnittstelle wie haikuClassify.ts, injizierbar für Tests.
export type AnthropicTextClient = {
  messages: {
    create(params: unknown): Promise<{ content: Array<{ type: string; text?: string }> }>;
  };
};

export type ExplanationContext = {
  improvedCriteria: string[]; // Labels der Ampel-Kriterien, die diese Woche grün/besser sind
  explorationTitles: string[]; // Rezepttitel der Exploration-Slots (neu/unbekannt)
  favoriteTitles: string[]; // Rezepttitel mit hohem taste_score, zum Vergleich
};

const FALLBACK_TEXT = "Diese Woche basiert auf deinen bisherigen Vorlieben.";

function buildPrompt(context: ExplanationContext): string {
  const parts: string[] = [];
  if (context.improvedCriteria.length > 0) {
    parts.push(`Diese Ernährungs-Ampel-Kriterien sind diese Woche besser abgedeckt: ${context.improvedCriteria.join(", ")}.`);
  }
  if (context.explorationTitles.length > 0) {
    parts.push(`Neue, bisher unbekannte Rezepte in diesem Vorschlag: ${context.explorationTitles.join(", ")}.`);
  }
  if (context.favoriteTitles.length > 0) {
    parts.push(`Bekannte Favoriten des Nutzers (nur zur Einordnung, nicht zwingend diese Woche dabei): ${context.favoriteTitles.join(", ")}.`);
  }
  return parts.join("\n");
}

export async function explainSuggestion(client: AnthropicTextClient, context: ExplanationContext): Promise<string> {
  if (context.improvedCriteria.length === 0 && context.explorationTitles.length === 0) {
    return FALLBACK_TEXT;
  }

  const response = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 200,
    system:
      "Du erklärst in 2-3 kurzen Sätzen auf Deutsch, warum ein Wochenspeiseplan so zusammengestellt wurde. " +
      "Nutze ausschließlich die gegebenen Fakten. Erfinde keine Zutaten, keine Zubereitungsdetails und keine " +
      "Ähnlichkeiten zwischen Rezepten, die nicht explizit genannt sind.",
    messages: [{ role: "user", content: buildPrompt(context) }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  const text = textBlock?.text?.trim();
  return text || FALLBACK_TEXT;
}
