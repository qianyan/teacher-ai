#!/usr/bin/env python3
"""
Generate a long PNG from self-contained HTML.

Default path uses Playwright's full-page screenshot (exact document height, no
trailing blank band). Falls back to legacy Chrome --window-size + heuristic
height only if Playwright fails (e.g. no Node/npx).

Usage:
  python3 scripts/generate-long-screenshot.py path/to/report.html
  python3 scripts/generate-long-screenshot.py path/to/report.html --legacy-chrome
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path


def _file_url(path: Path) -> str:
    return path.resolve().as_uri()


def screenshot_playwright(html_path: Path, output_path: Path, timeout_ms: int = 120_000) -> bool:
    """
    Use `npx playwright screenshot --full-page` so height matches document (no blank tail).

    Tries: (1) system Google Chrome via --channel chrome; (2) Playwright's bundled Chromium
    (requires `npx playwright install` once if browsers are missing).
    """
    npx = shutil.which("npx")
    if not npx:
        return False

    url = _file_url(html_path)
    base = [
        npx,
        "--yes",
        "playwright",
        "screenshot",
        "--viewport-size",
        "1080,800",
        "--full-page",
        "--timeout",
        str(timeout_ms),
        url,
        str(output_path),
    ]

    attempts: list[tuple[str, list[str]]] = [
        ("Playwright + Google Chrome (--channel chrome)", ["--channel", "chrome"]),
        ("Playwright bundled Chromium (run `npx playwright install` if needed)", []),
    ]

    last_err = ""
    for label, extra in attempts:
        cmd = base[:-2] + extra + base[-2:]  # insert extra before url + out
        print(f"📸 {label}…")
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode == 0 and output_path.is_file():
            if r.stdout:
                print(r.stdout.strip())
            return True
        last_err = (r.stderr or r.stdout or "").strip()

    if last_err:
        print(last_err, file=sys.stderr)
    return False


def estimate_height_chrome_fallback(html_content: str) -> int:
    """Rough height for legacy Chrome viewport (often oversized — prefer Playwright)."""
    section_count = html_content.count('<div class="section"')
    photo_count = html_content.count('<div class="photo-item"')
    list_count = html_content.count('<div class="list-item"')
    tips_count = html_content.count('<div class="tip-card"')

    header_height = 600
    footer_height = 100
    section_height = 100
    content_box_height = list_count * 200
    # Rows: grid-3 → ceil(n/3), grid-4 → ceil(n/4); blend toward grid-3 (more common)
    rows = (photo_count + 2) // 3
    photo_grid_height = rows * 320
    tips_height = 500 + tips_count * 250

    estimated = (
        header_height
        + (section_count * section_height)
        + content_box_height
        + photo_grid_height
        + tips_height
        + footer_height
    )
    # Tighter buffer than before to reduce blank tail if Playwright is unavailable
    return int(estimated * 1.02) + 80


def screenshot_chrome_window(html_path: Path, output_path: Path, height: int) -> bool:
    chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    if not os.path.isfile(chrome):
        print("Chrome not found at expected path.", file=sys.stderr)
        return False
    cmd = [
        chrome,
        "--headless",
        "--disable-gpu",
        "--no-sandbox",
        "--hide-scrollbars",
        f"--screenshot={output_path}",
        f"--window-size=1080,{height}",
        "--virtual-time-budget=10000",
        _file_url(html_path),
    ]
    print(f"📸 Legacy Chrome viewport screenshot (height={height}px, may include extra blank at bottom)…")
    r = subprocess.run(cmd, capture_output=True)
    return r.returncode == 0 and output_path.is_file()


def main() -> int:
    parser = argparse.ArgumentParser(description="HTML → long PNG (Playwright full-page by default)")
    parser.add_argument("html", help="Path to self-contained .html")
    parser.add_argument(
        "--legacy-chrome",
        action="store_true",
        help="Use headless Chrome + estimated window height only (old behavior)",
    )
    args = parser.parse_args()

    html_path = Path(args.html).expanduser()
    if not html_path.is_file():
        print(f"Not found: {html_path}", file=sys.stderr)
        return 1

    output_path = html_path.resolve().with_suffix(".png")

    if not args.legacy_chrome:
        if screenshot_playwright(html_path, output_path):
            print(f"✅ Screenshot saved: {output_path}")
            _print_dims(output_path)
            return 0
        print("⚠️  Playwright + Chrome channel failed; try: npx playwright install", file=sys.stderr)
        print("   Falling back to legacy Chrome + height estimate…", file=sys.stderr)

    with open(html_path, encoding="utf-8") as f:
        html_content = f.read()
    h = estimate_height_chrome_fallback(html_content)
    print(f"📏 Legacy estimated height: {h}px")
    if screenshot_chrome_window(html_path, output_path, h):
        print(f"✅ Screenshot saved: {output_path}")
        _print_dims(output_path)
        return 0

    print("❌ Screenshot failed.", file=sys.stderr)
    return 1


def _print_dims(png_path: Path) -> None:
    if shutil.which("sips"):
        _ = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", str(png_path)], check=False)


if __name__ == "__main__":
    sys.exit(main())
