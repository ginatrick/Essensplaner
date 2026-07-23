import pytest

from parsing.quantity import parse_quantity


@pytest.mark.parametrize(
    ("raw_amount", "raw_unit", "expected"),
    [
        # ALDI (live beobachtete Rohtexte, siehe codex/007-prospekt-aldi-norma.md)
        (None, "500-g-Packung", (500.0, "g")),
        (None, "1,5-kg-Packung", (1500.0, "g")),
        (None, "150-g-Becher", (150.0, "g")),
        (None, "2er-Packung", (2.0, "stk")),
        (None, "Stück", (1.0, "stk")),
        (None, "kg-Preis", (1000.0, "g")),
        (None, "6x20-g-Packung", (120.0, "g")),
        # Norma (schon halb normalisiert, siehe sources/norma/fetch.py)
        (500, "g", (500.0, "g")),
        (8, "kg", (8000.0, "g")),
        (None, "Stück", (1.0, "stk")),
        # Unbekanntes Format -> kein Raten
        (None, None, (None, None)),
        (None, "", (None, None)),
        (None, "irgendein Text ohne Menge", (None, None)),
    ],
)
def test_parse_quantity(raw_amount, raw_unit, expected):
    assert parse_quantity(raw_amount, raw_unit) == expected


def test_volumen_wird_auf_ml_normalisiert():
    assert parse_quantity(None, "1,5-l-Flasche") == (1500.0, "ml")
    assert parse_quantity(None, "330 ml") == (330.0, "ml")


def test_reine_gebindewoerter_ohne_gewicht():
    assert parse_quantity(None, "Packung") == (1.0, "stk")
    assert parse_quantity(None, "3 Paar") == (3.0, "stk")
    assert parse_quantity(None, "Dose/Flasche") == (1.0, "stk")
