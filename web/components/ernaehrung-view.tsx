"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { dayLabel } from "@/lib/plan/week";

type Member = { id: string; name: string; age: number | null; activity: "normal" | "sport_hoch"; training_days: number[] };

const DAYS = [0, 1, 2, 3, 4, 5, 6];

export function ErnaehrungView() {
  const supabase = useMemo(() => createClient(), []);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");

  async function load() {
    const { data } = await supabase.from("household_members").select("id, name, age, activity, training_days").order("name");
    setMembers((data ?? []) as Member[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function addMember() {
    if (!newName.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    await supabase.from("household_members").insert({ user_id: userData.user.id, name: newName.trim() });
    setNewName("");
    await load();
  }

  async function removeMember(id: string) {
    await supabase.from("household_members").delete().eq("id", id);
    setMembers((list) => list.filter((m) => m.id !== id));
  }

  async function updateMember(id: string, patch: Partial<Member>) {
    setMembers((list) => list.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    await supabase.from("household_members").update(patch).eq("id", id);
  }

  function toggleTrainingDay(member: Member, day: number) {
    const next = member.training_days.includes(day)
      ? member.training_days.filter((d) => d !== day)
      : [...member.training_days, day].sort();
    void updateMember(member.id, { training_days: next });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Ernährung & Profil</h1>
      <p className="text-sm text-muted-foreground">
        Trainingstage fließen später in Rezeptvorschläge ein. Planungshilfe, keine medizinische Beratung —
        siehe Wochen-Ampel im Speiseplan.
      </p>

      <Card>
        <CardHeader><CardTitle>Haushaltsmitglieder</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addMember()}
            />
            <Button type="button" onClick={addMember}>
              <Plus className="mr-1 h-4 w-4" /> Hinzufügen
            </Button>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Lädt …</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Haushaltsmitglieder erfasst.</p>
          ) : (
            <ul className="space-y-4">
              {members.map((member) => (
                <li key={member.id} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-medium">{member.name}</span>
                    <div className="flex items-center gap-1">
                      <Label htmlFor={`age-${member.id}`} className="text-xs text-muted-foreground">Alter</Label>
                      <Input
                        id={`age-${member.id}`}
                        type="number"
                        min="0"
                        className="h-7 w-16"
                        value={member.age ?? ""}
                        onChange={(e) => updateMember(member.id, { age: e.target.value ? Number(e.target.value) : null })}
                      />
                    </div>
                    <select
                      className="h-7 rounded-md border border-input bg-transparent px-2 text-xs"
                      value={member.activity}
                      onChange={(e) => updateMember(member.id, { activity: e.target.value as Member["activity"] })}
                    >
                      <option value="normal">Normal aktiv</option>
                      <option value="sport_hoch">Sport (hoch)</option>
                    </select>
                    <Button type="button" variant="ghost" className="ml-auto h-7 w-7 p-0 text-destructive" onClick={() => removeMember(member.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {DAYS.map((day) => (
                      <Button
                        key={day}
                        type="button"
                        variant={member.training_days.includes(day) ? "default" : "outline"}
                        className="h-7 w-11 text-xs"
                        onClick={() => toggleTrainingDay(member, day)}
                      >
                        {dayLabel(day)}
                      </Button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
