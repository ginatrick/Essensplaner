// Stufe 3 aus docs/05-modul-rezepte.md: wenn Regex + Alias (exakt/Fuzzy) keinen
// Treffer liefern, klassifiziert Claude Haiku den rohen Zutatentext gegen die
// vollständige Liste bekannter ingredients. Haiku wählt nur aus dieser Liste
// oder antwortet "kein Treffer" — kein Erfinden neuer Zutaten.
//
// Modell laut docs/11-modellwahl.md: Haiku 4.5 (billig, hochfrequent).
// Der Client ist injizierbar (kein globaler Import von @anthropic-ai/sdk hier),
// damit Tests mit einem Fake-Client ohne echten API-Call laufen.

export const HAIKU_MODEL = "claude-haiku-4-5-20251001";

export type KnownIngredient = { id: string; name: string };

// Minimale Teilmenge der Anthropic-SDK-Schnittstelle, die diese Funktion
// tatsächlich braucht — reicht für echten Client und Fake in Tests.
export type AnthropicMessagesClient = {
  messages: {
    create(params: unknown): Promise<{
      content: Array<{ type: string; input?: unknown }>;
    }>;
  };
};

const CLASSIFY_TOOL_NAME = "classify_ingredient";

// Tool-Use statt Freitext-JSON: Claude muss ein Objekt nach diesem Schema
// liefern, kein Parsen von Prosa/Markdown-Codefences nötig.
function buildTool(knownIds: string[]) {
  return {
    name: CLASSIFY_TOOL_NAME,
    description: "Ordnet den Zutatentext einer bekannten ingredient_id zu, oder null falls keine passt.",
    input_schema: {
      type: "object" as const,
      properties: {
        ingredient_id: {
          type: ["string", "null"],
          enum: [...knownIds, null],
          description: "Die id aus der Liste, die der Zutatentext meint, oder null bei keinem Treffer.",
        },
      },
      required: ["ingredient_id"],
    },
  };
}

// Stufe 3 aus docs/05-modul-rezepte.md: klassifiziert rawName gegen die volle
// ingredients-Liste. Gibt die passende ingredient_id oder null zurück — nie
// eine id, die nicht in known enthalten ist (Schema erzwingt das serverseitig
// zusätzlich per Nachvalidierung, falls Haiku trotzdem daneben liegt).
export async function haikuClassify(
  client: AnthropicMessagesClient,
  rawName: string,
  known: KnownIngredient[],
): Promise<string | null> {
  const trimmed = rawName.trim();
  if (!trimmed || known.length === 0) return null;

  const knownIds = known.map((k) => k.id);
  const list = known.map((k) => `${k.id}: ${k.name}`).join("\n");

  const response = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 256,
    system:
      "Du ordnest einen rohen Zutatentext aus einem Kochrezept genau einer Zutat aus einer " +
      "vorgegebenen Liste zu. Wähle ausschließlich eine id aus der Liste. Erfinde niemals eine " +
      "neue id oder Zutat. Wenn keine Zutat aus der Liste eindeutig passt, gib null zurück.",
    messages: [
      {
        role: "user",
        content: `Zutatentext: "${trimmed}"\n\nBekannte Zutaten (id: name):\n${list}`,
      },
    ],
    tools: [buildTool(knownIds)],
    tool_choice: { type: "tool", name: CLASSIFY_TOOL_NAME },
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse) return null;

  const input = toolUse.input as { ingredient_id?: string | null } | undefined;
  const ingredientId = input?.ingredient_id ?? null;
  if (ingredientId === null) return null;

  // Nachvalidierung: nur ids akzeptieren, die tatsächlich in der übergebenen
  // Liste waren (Schutz gegen Halluzination trotz Tool-Schema).
  return knownIds.includes(ingredientId) ? ingredientId : null;
}
