"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  CalendarDays,
  UtensilsCrossed,
  ShoppingCart,
  Tag,
  TrendingDown,
  Package,
  HeartPulse,
  BarChart3,
  Settings,
  Bell,
  Leaf,
} from "lucide-react";
import { LogoutButton } from "@/components/logout-button";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; built: boolean };

const NAV_ITEMS: NavItem[] = [
  { href: "/plan", label: "Übersicht", icon: LayoutGrid, built: false },
  { href: "/plan", label: "Wochenplan", icon: CalendarDays, built: true },
  { href: "/rezepte", label: "Rezepte", icon: UtensilsCrossed, built: true },
  { href: "/einkaufslisten", label: "Einkaufslisten", icon: ShoppingCart, built: false },
  { href: "/angebote", label: "Angebote", icon: Tag, built: false },
  { href: "/preisvergleich", label: "Preisvergleich", icon: TrendingDown, built: false },
  { href: "/vorraete", label: "Vorräte", icon: Package, built: false },
  { href: "/ernaehrung", label: "Ernährung & Profil", icon: HeartPulse, built: false },
  { href: "/auswertungen", label: "Auswertungen", icon: BarChart3, built: false },
  { href: "/einstellungen", label: "Einstellungen", icon: Settings, built: false },
];

export function AppShell({ email, children }: { email: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const greetingName = email.split("@")[0];

  return (
    <div className="mx-auto flex min-h-screen max-w-[1440px]">
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar px-4 py-6 sm:flex sm:flex-col">
        <div className="mb-8 flex items-center gap-2 px-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Leaf className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <p className="font-semibold">MealPlanner</p>
            <p className="text-xs text-muted-foreground">Clever planen. Besser essen.</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = item.built && pathname.startsWith(item.href);
            if (!item.built) {
              return (
                <div
                  key={item.label}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground/60"
                  title="Noch nicht verfügbar"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                  <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[10px]">bald</span>
                </div>
              );
            }
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/60"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-6 border-t border-sidebar-border pt-4">
          <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Dein Haushalt</p>
          <p className="px-2 text-sm text-muted-foreground">Angemeldet als {email}</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2 sm:hidden">
            <Leaf className="h-5 w-5 text-primary" />
            <span className="font-semibold">MealPlanner</span>
          </div>
          <div className="hidden sm:block" />
          <div className="flex items-center gap-3">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <span className="hidden text-sm text-muted-foreground sm:inline">Hallo, {greetingName}</span>
            <LogoutButton />
          </div>
        </header>
        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
