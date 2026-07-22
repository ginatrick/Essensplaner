"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
export function RezeptDeleteButton({ id }: { id: string }) { const router = useRouter(); return <Button variant="destructive" onClick={async () => { if (!window.confirm("Rezept wirklich löschen?")) return; const { error } = await createClient().from("recipes").delete().eq("id", id); if (error) window.alert("Löschen fehlgeschlagen: " + error.message); else router.push("/rezepte"); }}>Löschen</Button>; }
