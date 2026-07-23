// Manche Rezeptseiten liefern innerhalb ihrer JSON-LD-Strings HTML-Entities
// statt echter UTF-8-Umlaute (z.B. "K&auml;se" statt "Käse") — JSON.parse
// dekodiert das nicht, das ist kein JSON-Feature. Named Entities: kleine,
// auf den in Rezepttexten üblichen Zeichensatz beschränkte Tabelle statt
// einer vollen HTML5-Entity-Liste (YAGNI). Numerische Entities (&#228;/&#x00e4;)
// deckt eine generische Regel ab.
const NAMED_ENTITIES: Record<string, string> = {
  auml: "ä", ouml: "ö", uuml: "ü", szlig: "ß",
  Auml: "Ä", Ouml: "Ö", Uuml: "Ü",
  eacute: "é", egrave: "è", agrave: "à", ccedil: "ç",
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
};

export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const codePoint = code[1]?.toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    return NAMED_ENTITIES[code] ?? match;
  });
}
