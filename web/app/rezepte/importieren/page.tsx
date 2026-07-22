import { RezeptImporter } from "./importer";

export default function RezeptImportierenPage() {
  return <main className="mx-auto max-w-5xl space-y-6 px-6 py-8"><div><h1 className="text-3xl font-semibold">Rezept per URL importieren</h1><p className="mt-2 text-muted-foreground">Die Seite wird serverseitig gelesen. Prüfe den Entwurf vor dem Speichern.</p></div><RezeptImporter /></main>;
}
