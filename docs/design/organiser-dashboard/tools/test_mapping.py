#!/usr/bin/env python3
"""Consistency matrix for Option A (admin #1544). Run: python3 -I docs/design/organiser-dashboard/tools/test_mapping.py

Table-driven over every Option A state x every night. Asserts the critique fixes:
Tickets sold and Ticket link taps come from DIFFERENT sources (fix 7), Going is never
a tile (fix 3), max 4 tiles and no "N more" link (fix 4), no zero is printed, one gold
primary per state (fix 2), and the city-aware empty copy (fix 8).
"""
import re
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gen  # noqa: E402

SECTION = {s: gen.option_a(s) for s in gen.STATES_A}


class Mapping(unittest.TestCase):
    def test_tickets_sold_and_ticket_taps_have_different_sources(self):
        src = {lab: s for lab, _, s in gen.A_TILES}
        self.assertNotEqual(src["Tickets sold"], src["Ticket link taps"])
        nt = {"sold": 11, "opens": 0, "going": 0, "clicks": {"ticket": 22}}
        vals = {lab: f(nt) for lab, f, _ in gen.A_TILES}
        self.assertEqual((vals["Tickets sold"], vals["Ticket link taps"]), (11, 22))

    def test_huge_state_shows_two_different_ticket_numbers(self):
        nt = gen.data("huge")["nights"][0]
        self.assertNotEqual(nt["sold"], nt["clicks"]["ticket"])
        html = SECTION["huge"]
        self.assertIn(gen.n(nt["sold"]), html)
        self.assertIn(gen.n(nt["clicks"]["ticket"]), html)

    def test_every_state_every_night(self):
        for s in gen.STATES_A:
            for nt in gen.data(s)["nights"]:
                with self.subTest(state=s, night=nt["day"]):
                    tiles, extra, _, _ = gen.a_metrics(nt)
                    labels = [t[0] for t in tiles]
                    self.assertLessEqual(len(tiles), 4)
                    self.assertNotIn("Going", labels)
                    self.assertNotIn("Opens", labels)
                    self.assertTrue(all(v > 0 for _, v, _ in tiles))
                    self.assertNotIn(" 0 ", " " + " ".join(extra) + " ")

    def test_rendered_states(self):
        for s, html in SECTION.items():
            with self.subTest(state=s):
                self.assertNotRegex(html, r"\d+ more<")
                self.assertNotRegex(html, r'class="v">0<')
                self.assertNotRegex(html, r">0 (going|people|tickets)")
                self.assertEqual(len(re.findall(r'class="btn[^"]*\bgold\b', html)), 1, "one gold primary")
                self.assertNotIn(">Opens<", html)
        self.assertIn("Share the cancellation", SECTION["cancelled"])
        self.assertIn("Undo cancellation", SECTION["cancelled"])
        self.assertIn("Put this night back on the calendar?", SECTION["cancelled"])
        self.assertIn("3 going", SECTION["upcoming"])
        self.assertIn("counted once per person per day", SECTION["upcoming"])

    def test_primary_is_share_this_night_once_a_night_exists(self):
        for s in ("upcoming", "selling", "huge", "all-zero"):
            with self.subTest(state=s):
                self.assertRegex(SECTION[s], r'class="btn full gold"[^>]*>.*?Share this night')

    def test_empty_copy_by_city(self):
        self.assertIn("dancers near you", SECTION["no-events-no-city"])
        self.assertIn("dancers in Leeds", SECTION["no-events"])
        self.assertIn("Add a photo", SECTION["no-events"])


if __name__ == "__main__":
    unittest.main()
