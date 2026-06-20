#!/usr/bin/env python3
"""Generate luxury OG preview image for social sharing."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "og-image.jpg"
ENVELOPE = ROOT / "public" / "assets" / "canva" / "envelope.png"

W, H = 1200, 630
BG = (250, 248, 244)  # champagne ivory


FONT_TITLE = "/System/Library/Fonts/Supplemental/Didot.ttc"
FONT_SUB = "/System/Library/Fonts/Supplemental/Georgia Italic.ttf"
FONT_DATE = "/System/Library/Fonts/Supplemental/Georgia.ttf"


def load_font(path: str, size: int, index: int = 0) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size, index=index)


def draw_centered(
    draw: ImageDraw.ImageDraw,
    text: str,
    y: int,
    font: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int],
    tracking: int = 0,
) -> None:
    if tracking == 0:
        bbox = draw.textbbox((0, 0), text, font=font)
        width = bbox[2] - bbox[0]
        x = (W - width) // 2
        draw.text((x, y), text, font=font, fill=fill)
        return

    chars = list(text)
    widths = [draw.textbbox((0, 0), c, font=font)[2] for c in chars]
    total = sum(widths) + tracking * (len(chars) - 1)
    x = (W - total) // 2
    for i, char in enumerate(chars):
        draw.text((x, y), char, font=font, fill=fill)
        x += widths[i] + tracking


def add_envelope_shadow(base: Image.Image, envelope: Image.Image, x: int, y: int) -> None:
    shadow = Image.new("RGBA", envelope.size, (0, 0, 0, 0))
    alpha = envelope.split()[3] if envelope.mode == "RGBA" else None
    shadow_fill = Image.new("RGBA", envelope.size, (35, 28, 22, 90))
    if alpha:
        shadow.paste(shadow_fill, (0, 0), alpha)
    else:
        shadow = envelope.convert("RGBA")
        shadow = Image.eval(shadow, lambda p: min(p, 60))

    blurred = shadow.filter(ImageFilter.GaussianBlur(18))
    base.alpha_composite(blurred, (x + 8, y + 16))


def main() -> None:
    canvas = Image.new("RGB", (W, H), BG)
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))

    envelope = Image.open(ENVELOPE).convert("RGBA")
    target_w = 520
    scale = target_w / envelope.width
    target_h = int(envelope.height * scale)
    envelope = envelope.resize((target_w, target_h), Image.Resampling.LANCZOS)

    env_x = (W - target_w) // 2
    env_y = 170

    add_envelope_shadow(layer, envelope, env_x, env_y)
    layer.alpha_composite(envelope, (env_x, env_y))

    canvas = canvas.convert("RGBA")
    canvas.alpha_composite(layer)

    draw = ImageDraw.Draw(canvas)
    font_title = load_font(FONT_TITLE, 54, index=0)
    font_sub = load_font(FONT_SUB, 32)
    font_date = load_font(FONT_DATE, 28)

    draw_centered(draw, "YAZAN & NORA", 52, font_title, (0, 0, 0), tracking=6)
    draw_centered(draw, "We hope you'll join us", 122, font_sub, (102, 102, 102))
    draw_centered(draw, "10.10.2026", 548, font_date, (40, 40, 40), tracking=4)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(OUT, "JPEG", quality=92, optimize=True, progressive=True)
    print(f"Saved {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
