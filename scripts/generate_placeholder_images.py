"""Generate warm, food-styled SVG placeholders for every menu item + the hero.

Run from the repo root:  python scripts/generate_placeholder_images.py

These are the *fallback* image path (see README > Images). To use real AI-generated
photos instead, drop <slug>.png files into frontend/public/images/ and point each
menu_items.image_url at them (the frontend prefers .png and falls back to .svg).
"""
from __future__ import annotations

import math
import pathlib

OUT = pathlib.Path(__file__).resolve().parents[1] / "frontend" / "public" / "images"
OUT.mkdir(parents=True, exist_ok=True)

# slug, display title, price, palette (bg1, bg2, plate, food accents...)
ITEMS = [
    ("lunch-rajma-chawal", "Rajma Chawal Thali", 120, ("#fbe9d7", "#f6cfa8", "#fff", ["#8d3b1f", "#e8c37a", "#d94f2a"])),
    ("lunch-paneer-butter-masala", "Paneer Butter Masala Thali", 160, ("#fdeede", "#f7c9a0", "#fff", ["#d9662e", "#f2d17c", "#8a3a1c"])),
    ("lunch-aloo-gobi", "Aloo Gobi Homestyle Thali", 110, ("#fbeecd", "#efd39b", "#fff", ["#e6b84a", "#c9772b", "#7fae4e"])),
    ("lunch-chole-bhature", "Chole Bhature Special", 130, ("#fde9d0", "#f3c893", "#fff", ["#7a3b1e", "#e7c07d", "#c1521f"])),
    ("dinner-dal-khichdi", "Dal Khichdi Comfort Bowl", 100, ("#fbe7c9", "#eccf96", "#fff", ["#e8c065", "#c98a34", "#9c5a24"])),
    ("dinner-kadai-chicken", "Kadai Chicken Thali", 190, ("#fbe2cf", "#f0bd94", "#fff", ["#b8401f", "#e8a95e", "#6f2c16"])),
    ("dinner-mixed-veg", "Mixed Veg Curry Thali", 120, ("#f7ead0", "#e6cf9c", "#fff", ["#7fae4e", "#d9822b", "#c53f2c"])),
    ("dinner-palak-paneer", "Palak Paneer Thali", 150, ("#eef0d3", "#cdd79b", "#fff", ["#3f6b3a", "#e7d9a8", "#a7c65f"])),
]


def food_svg(title: str, price: int, palette) -> str:
    bg1, bg2, plate, accents = palette
    cx, cy, r = 300, 210, 130
    blobs = []
    for i, col in enumerate(accents):
        ang = -math.pi / 2 + i * (2 * math.pi / len(accents))
        bx = cx + math.cos(ang) * 58
        by = cy + math.sin(ang) * 58
        blobs.append(
            f'<circle cx="{bx:.0f}" cy="{by:.0f}" r="46" fill="{col}" opacity="0.92"/>'
        )
    blob_str = "".join(blobs)
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="600" height="440" viewBox="0 0 600 440">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="{bg1}"/><stop offset="1" stop-color="{bg2}"/>
    </linearGradient>
    <filter id="s" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#85301a" flood-opacity="0.22"/>
    </filter>
  </defs>
  <rect width="600" height="440" fill="url(#bg)"/>
  <circle cx="{cx}" cy="{cy}" r="{r}" fill="{plate}" filter="url(#s)"/>
  <circle cx="{cx}" cy="{cy}" r="{r-14}" fill="none" stroke="#eadfd2" stroke-width="3"/>
  <g>{blob_str}</g>
  <circle cx="{cx}" cy="{cy}" r="26" fill="#fdf6ef" opacity="0.9"/>
  <rect x="0" y="370" width="600" height="70" fill="#6d2a19" opacity="0.92"/>
  <text x="28" y="404" font-family="Georgia, serif" font-size="24" fill="#fffaf3" font-weight="bold">{title}</text>
  <text x="28" y="428" font-family="Arial, sans-serif" font-size="14" fill="#f6cfa8">GharSe Tiffin &#183; homestyle</text>
  <text x="572" y="414" text-anchor="end" font-family="Georgia, serif" font-size="26" fill="#f9b024" font-weight="bold">&#8377;{price}</text>
</svg>
"""


def hero_svg() -> str:
    plates = []
    spots = [(180, 190, 96), (400, 165, 82), (300, 330, 110), (120, 360, 66), (470, 340, 74)]
    cols = ["#df6524", "#f9b024", "#a63a18", "#e78544", "#c94d1a"]
    for (x, y, rr), c in zip(spots, cols):
        plates.append(
            f'<circle cx="{x}" cy="{y}" r="{rr}" fill="#fffaf3" filter="url(#s)"/>'
            f'<circle cx="{x}" cy="{y}" r="{rr-18}" fill="{c}" opacity="0.9"/>'
            f'<circle cx="{x}" cy="{y}" r="{rr*0.32:.0f}" fill="#fdf6ef" opacity="0.85"/>'
        )
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="900" height="620" viewBox="0 0 900 620">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fdf6ef"/><stop offset="0.55" stop-color="#f6cfa8"/><stop offset="1" stop-color="#efac72"/>
    </linearGradient>
    <filter id="s" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#85301a" flood-opacity="0.25"/>
    </filter>
  </defs>
  <rect width="900" height="620" fill="url(#bg)"/>
  <g transform="translate(150,20)">{''.join(plates)}</g>
  <text x="48" y="560" font-family="Georgia, serif" font-size="30" fill="#6d2a19" font-weight="bold">Ghar ka khana, delivered daily</text>
</svg>
"""


def main() -> None:
    for slug, title, price, palette in ITEMS:
        (OUT / f"{slug}.svg").write_text(food_svg(title, price, palette), encoding="utf-8")
    (OUT / "hero-tiffin.svg").write_text(hero_svg(), encoding="utf-8")
    print(f"Wrote {len(ITEMS) + 1} placeholder images to {OUT}")


if __name__ == "__main__":
    main()
