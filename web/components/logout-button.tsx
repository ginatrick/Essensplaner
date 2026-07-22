"use client";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
export function LogoutButton() { return <Button variant="outline" onClick={async () => { await createClient().auth.signOut(); window.location.href = "/login"; }}>Abmelden</Button>; }
