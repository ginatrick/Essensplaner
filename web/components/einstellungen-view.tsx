"use client";

import { useEffect, useMemo, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { loadSettings, saveSettings } from "@/lib/optimizer/settingsStore";
import type { OptimizerSettings } from "@/lib/optimizer/types";

const FIELDS: { key: keyof OptimizerSettings; label: string; hint: string; step?: string }[] = [
  { key: "costPerKm", label: "Fahrtkosten (€/km)", hint: "Für die Fahrtkosten in der Varianten-Berechnung", step: "0.01" },
  { key: "costPerHour", label: "Zeitkosten (€/h)", hint: "Was dir deine Zeit wert ist — 0 = Zeit wird nur angezeigt, nicht eingerechnet" },
  { key: "toleranceEur", label: "Toleranz REWE (€)", hint: "REWE wird empfohlen, wenn nicht mehr als so viel teurer als Multi-Markt und deutlich schneller" },
  { key: "thresholdEur", label: "Schwelle Multi-Markt (€)", hint: "Multi-Markt wird empfohlen, wenn mindestens so viel günstiger als REWE" },
  { key: "maxMultiStoreCount", label: "Max. Märkte (Variante A)", hint: "Obergrenze für die Multi-Markt-Variante" },
  { key: "compromiseStoreCount", label: "Märkte im Kompromiss (Variante D)", hint: "Feste Anzahl für die Kompromiss-Variante" },
  { key: "reweServiceFeeCent", label: "REWE Abholgebühr (Cent)", hint: "Falls REWE für den Abholservice eine Gebühr berechnet" },
];

export function EinstellungenView() {
  const supabase = useMemo(() => createClient(), []);
  const [settings, setSettings] = useState<OptimizerSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSettings(supabase).then(setSettings);
  }, [supabase]);

  function update(key: keyof OptimizerSettings, value: number) {
    setSettings((s) => (s ? { ...s, [key]: value } : s));
    setSaved(false);
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    await saveSettings(supabase, settings);
    setSaving(false);
    setSaved(true);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Einstellungen</h1>

      <Card>
        <CardHeader>
          <CardTitle>Einkaufs-Optimizer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!settings ? (
            <p className="text-sm text-muted-foreground">Lädt …</p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                {FIELDS.map((field) => (
                  <div key={field.key} className="space-y-1">
                    <Label htmlFor={field.key}>{field.label}</Label>
                    <Input
                      id={field.key}
                      type="number"
                      step={field.step ?? "1"}
                      min="0"
                      value={settings[field.key]}
                      onChange={(e) => update(field.key, Number(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground">{field.hint}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <Button type="button" onClick={save} disabled={saving}>
                  <Save className="mr-2 h-4 w-4" /> Speichern
                </Button>
                {saved && <span className="text-sm text-muted-foreground">Gespeichert.</span>}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
