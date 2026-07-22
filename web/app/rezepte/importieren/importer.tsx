"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RezeptForm } from "@/components/rezept-form";
import { importRecipe, type ImportState } from "./actions";

const initialState: ImportState = {};

export function RezeptImporter() {
  const [state, action, pending] = useActionState(importRecipe, initialState);
  if (state.draft) return <><p className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">Import erfolgreich. Bitte prüfen und anschließend speichern.</p><RezeptForm defaultValues={state.draft} /></>;
  return <form action={action} className="flex gap-2"><Input name="url" type="url" required placeholder="https://…" aria-label="Rezept-URL" /><Button type="submit" disabled={pending}>{pending ? "Wird importiert …" : "Importieren"}</Button>{state.error && <p className="self-center text-sm text-destructive">{state.error}</p>}</form>;
}
