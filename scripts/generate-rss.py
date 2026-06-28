#!/usr/bin/env python3
"""
Generate RSS feed from itzune.github.io/data/projects.json.

Usage: python3 scripts/generate-rss.py
Output: rss.xml (written to repo root)

The feed is sorted by the optional 'date' field (ISO 8601), newest first.
Projects without a date appear last.
"""

import json
import sys
from datetime import datetime, timezone
from html import escape as html_escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROJECTS_JSON = ROOT / "data" / "projects.json"
OUTPUT = ROOT / "rss.xml"

SITE_URL = "https://itzune.eus"
FEED_TITLE = "Itzune — proiektuak"
FEED_DESC = {
    "eu": "Itzune kolektiboaren proiektuen jarioa — euskarazko AI ereduak, datu-multzoak eta tresnak.",
    "en": "Feed of Itzune collective projects — Basque AI models, datasets, and tools.",
}
FEED_TITLE_FULL = "Itzune — proiektuak / projects"


def load_projects() -> list[dict]:
    with open(PROJECTS_JSON) as f:
        data = json.load(f)
    return data.get("projects", [])


def sort_by_date(projects: list[dict]) -> list[dict]:
    """Sort by date descending (newest first). Missing dates go last."""
    def sort_key(p: dict) -> tuple[int, str]:
        d = p.get("date", "")
        if d:
            try:
                return (0, d)
            except Exception:
                return (1, d)
        return (1, "")
    return sorted(projects, key=sort_key, reverse=True)


def format_rfc822(iso_date: str) -> str:
    """Convert ISO 8601 to RFC 822 date format for RSS."""
    dt = datetime.fromisoformat(iso_date)
    # Force to UTC if no timezone
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.strftime("%a, %d %b %Y %H:%M:%S %z")


def generate_item(project: dict) -> str:
    guid = project.get("id", "")
    url = project.get("url", f"{SITE_URL}/")
    title = project.get("title", {}).get("eu") or project.get("title", {}).get("en") or guid
    body = project.get("body", {}).get("eu") or project.get("body", {}).get("en") or ""
    date_iso = project.get("date", "")
    tag = project.get("tag", "")

    # Category label
    tag_labels = {"models": "Ereduak", "datasets": "Datu-multzoak", "others": "Tresnak"}
    category = tag_labels.get(tag, tag)

    lines = ["  <item>"]
    lines.append(f"    <title>{html_escape(title)}</title>")
    lines.append(f"    <link>{html_escape(url)}</link>")
    lines.append(f"    <guid isPermaLink=\"false\">{html_escape(guid)}</guid>")
    lines.append(f"    <description>{html_escape(body)}</description>")
    lines.append(f"    <category>{html_escape(category)}</category>")
    if date_iso:
        lines.append(f"    <pubDate>{format_rfc822(date_iso)}</pubDate>")
    lines.append("  </item>")
    return "\n".join(lines)


def generate_feed(projects: list[dict]) -> str:
    now = format_rfc822(datetime.now(timezone.utc).isoformat())

    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
        "  <channel>",
        f"    <title>{html_escape(FEED_TITLE_FULL)}</title>",
        f"    <link>{html_escape(SITE_URL)}/</link>",
        f"    <description>{html_escape(FEED_DESC['eu'])}</description>",
        f"    <language>eu</language>",
        f"    <lastBuildDate>{now}</lastBuildDate>",
        f"    <atom:link href=\"{SITE_URL}/rss.xml\" rel=\"self\" type=\"application/rss+xml\"/>",
    ]

    for project in projects:
        lines.append(generate_item(project))

    lines.extend([
        "  </channel>",
        "</rss>",
    ])

    return "\n".join(lines) + "\n"


def main():
    projects = load_projects()
    projects = sort_by_date(projects)
    feed = generate_feed(projects)

    with open(OUTPUT, "w") as f:
        f.write(feed)

    print(f"✅ RSS feed generated: {OUTPUT}")
    print(f"   {len(projects)} projects")


if __name__ == "__main__":
    main()
