import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/login");
  const email = (claims.claims.email as string | undefined) ?? "";
  const { data: members } = await supabase.from("household_members").select("id, name, age").order("name");

  return <AppShell email={email} members={members ?? []}>{children}</AppShell>;
}
