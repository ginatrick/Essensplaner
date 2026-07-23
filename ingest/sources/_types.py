"""Gemeinsame Rohdatentypen der Angebotsquellen."""

from typing import TypedDict


class RawOffer(TypedDict):
    title: str
    brand: str | None
    amount: int | float | None
    unit: str | None
    price_cent: int
    valid_from: str | None
    valid_to: str | None
    source_chain: str
