"""Gemeinsame Playwright-Hilfsfunktion für Prospekt-Crawler (JS-gerenderte
Ketten-Seiten). Enthält kein Ketten-Wissen — nur Browser-Start mit
realistischem, kontaktierbarem User-Agent (siehe docs/13-recht-risiken.md:
"User-Agent mit Kontaktangabe"). Jeder Crawler ruft das selbst auf, kein
Crawler importiert einen anderen (siehe .claude/agents/ingest-entwickler.md)."""

from contextlib import contextmanager

from playwright.sync_api import Page, sync_playwright

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0 Safari/537.36 "
    "MealPlanner-Ingest/1.0 (privates Projekt, Kontakt: patrickwilh@googlemail.com)"
)


@contextmanager
def rendered_page(url: str, *, wait_until: str = "networkidle", timeout_ms: int = 30000):
    """Öffnet `url` in einem echten (headless) Browser und liefert die Page,
    nachdem clientseitiges JS gerendert hat. Für Seiten, die ihre Inhalte
    per Fetch/XHR nachladen (kein Server-Side-Rendering)."""
    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            page: Page = browser.new_page(user_agent=USER_AGENT)
            page.goto(url, timeout=timeout_ms, wait_until=wait_until)
            yield page
        finally:
            browser.close()
