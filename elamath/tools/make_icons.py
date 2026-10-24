"""Genera los íconos de la PWA (azul #002B49 con integral dorada #D59B2D). Uso: python3 tools/make_icons.py"""
from PIL import Image, ImageDraw, ImageFont

BLUE, GOLD = (0, 43, 73), (213, 155, 45)
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"

def render(size, safe=1.0, rounded=True):
    """safe < 1 reduce el glifo para el área segura de los íconos 'maskable'."""
    img = Image.new("RGBA", (size, size), BLUE if not rounded else (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        d.rounded_rectangle((0, 0, size - 1, size - 1), radius=int(size * 0.22), fill=BLUE)
    # borde dorado inferior fino (guiño a la barra superior de la app)
    bar_h = max(2, int(size * 0.035))
    d.rectangle((int(size * 0.18), int(size * 0.86), int(size * 0.82), int(size * 0.86) + bar_h), fill=GOLD)
    font = ImageFont.truetype(FONT, int(size * 0.66 * safe))
    bbox = d.textbbox((0, 0), "∫", font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(((size - w) / 2 - bbox[0], (size - h) / 2 - bbox[1] - size * 0.03), "∫", font=font, fill=GOLD)
    return img

render(192).save("icons/icon-192.png")
render(512).save("icons/icon-512.png")
render(512, safe=0.78, rounded=False).save("icons/icon-maskable-512.png")   # a sangre, sin esquinas
render(180, rounded=False).convert("RGB").save("icons/apple-touch-icon.png")  # iOS aplica su propia máscara
