"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError(""); setMessage("");
    const origin = window.location.origin;
    const { error: authError } = await createClient().auth.signInWithOtp({ email, options: { emailRedirectTo: `${origin}/auth/confirm` } });
    setLoading(false);
    if (authError) setError(authError.message); else setMessage("Prüfe deine E-Mails – der Login-Link ist unterwegs.");
  }
  return <main className="mx-auto flex min-h-screen max-w-md items-center px-6"><Card className="w-full"><CardHeader><CardTitle>MealPlanner Login</CardTitle></CardHeader><CardContent><form onSubmit={submit} className="space-y-4"><div className="space-y-2"><Label htmlFor="email">E-Mail-Adresse</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div><Button type="submit" disabled={loading}>{loading ? "Wird gesendet …" : "Link senden"}</Button>{message && <p className="text-sm text-green-700">{message}</p>}{error && <p className="text-sm text-destructive">Der Login-Link konnte nicht gesendet werden: {error}</p>}</form></CardContent></Card></main>;
}
