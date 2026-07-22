import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/logout-button";

export default async function RezepteLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/login");
  return <><header className="border-b"><div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4"><Link href="/rezepte" className="font-semibold">MealPlanner</Link><LogoutButton /></div></header>{children}</>;
}
