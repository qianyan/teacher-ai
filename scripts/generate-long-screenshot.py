#!/usr/bin/env python3
"""
Generate long screenshot from HTML using Chrome headless
Usage: python3 scripts/generate-long-screenshot.py input.html
"""
import subprocess
import sys
import os
import tempfile

# Get HTML path from command line or use default
html_path = sys.argv[1] if len(sys.argv) > 1 else "input.html"
output_path = os.path.abspath(html_path.replace('.html', '.png'))
html_abs_path = os.path.abspath(html_path)

# Step 1: Analyze HTML to estimate height
print("📏 Calculating HTML content height...")

with open(html_abs_path, 'r', encoding='utf-8') as f:
    html_content = f.read()

# Count different elements to estimate height
section_count = html_content.count('<div class="section"')
photo_count = html_content.count('<div class="photo-item"')
list_count = html_content.count('<div class="list-item"')
tips_count = html_content.count('<div class="tip-card"')

# Base height estimation (in pixels) - more conservative
header_height = 600
footer_height = 100

# Each section: padding + content
section_height = 100  # section padding

# Content within sections - more accurate estimates
content_box_height = list_count * 200  # each list item ~200px
photo_grid_height = (photo_count // 3) * 380 + (photo_count % 3) * 350  # photo grids with spacing
tips_height = 500 + tips_count * 250  # tips section with cards

estimated_height = (
    header_height +
    (section_count * section_height) +
    content_box_height +
    photo_grid_height +
    tips_height +
    footer_height
)

print(f"   Sections: {section_count}, Photos: {photo_count}, Lists: {list_count}, Tips: {tips_count}")
print(f"   Estimated height: {estimated_height}px")

# Use a smaller buffer (5% + 100px)
height = int(estimated_height * 1.05) + 100
print(f"   Screenshot height (with buffer): {height}px")

# Step 2: Generate screenshot
print("📸 Generating screenshot...")
cmd = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "--headless",
    "--disable-gpu",
    "--no-sandbox",
    "--hide-scrollbars",
    f"--screenshot={output_path}",
    f"--window-size=1080,{height}",
    "--virtual-time-budget=10000",
    f"file://{html_abs_path}"
]

result = subprocess.run(cmd, capture_output=True)

if result.returncode == 0:
    print(f"✅ Screenshot saved: {output_path}")

    # Get final dimensions
    info_cmd = ["sips", "-g", "pixelWidth", "-g", "pixelHeight", output_path]
    info = subprocess.run(info_cmd, capture_output=True, text=True)
    for line in info.stdout.split('\n'):
        if 'pixel' in line:
            print(f"   {line.strip()}")
else:
    print(f"❌ Screenshot failed")
    print(result.stderr.decode())
    sys.exit(1)
