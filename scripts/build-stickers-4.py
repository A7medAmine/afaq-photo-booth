"""Add the 'radom' batch (memes, pixel art, tech logos, Claude/Clawd): strip backgrounds, trim, export webp.

Usage: python scripts/build-stickers-4.py <source-dir>
Appends to src/stickerCatalog.json (skips ids already present). Exact duplicate files are skipped.
"""
import glob, hashlib, json, os, sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

SRC = sys.argv[1]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'assets', 'stickers')
CATALOG = os.path.join(ROOT, 'src', 'stickerCatalog.json')
MAX = 512

# file (relative to SRC) -> (slug, group)
MAP = {
    '1.jpg': ('pixel_cat_scream', 'cats'),
    '1135118281093442036.jpg': ('blossom_annoyed', 'memes'),
    '1135118281103240282.jpg': ('clarence_chowder', 'memes'),
    '618541330116965076.jpg': ('dog_hands_in_pockets', 'cute'),
    '684406474655098928.jpg': ('snorlax_peek', 'cute'),
    '704109723024918694.jpg': ('cpp_logo', 'tech'),
    '712202128617727428.jpg': ('openai_logo', 'tech'),
    '751749362839451257.jpg': ('shut_up_and_study', 'memes'),
    '857372847796794984.jpg': ('jake_dab', 'memes'),
    '872150284094406882.jpg': ('sql_syringe', 'tech'),
    'Clawd_ Coffee.jpg': ('clawd_coffee', 'tech'),
    'Pegatinas_ Anime _ Redbubble.jpg': ('frieren_scarf', 'cute'),
    'claude/90564642501630222.jpg': ('cheems_pixel', 'memes'),
    'claude/Claude Ai Sticker.jpg': ('claude_logo', 'tech'),
    'claude/Claude Code Happy Sticker.jpg': ('clawd_happy', 'tech'),
    'claude/Claude Code Make No Mistakes Sticker.jpg': ('clawd_make_no_mistakes', 'tech'),
    'claude/Clawd Claude Code Mascot Sticker Sticker.jpg': ('clawd_mascot', 'tech'),
    'claude/Clawd_ Cooking.jpg': ('clawd_cooking', 'tech'),
    'claude/Clawd_ Headphones.jpg': ('clawd_headphones', 'tech'),
    'claude/Clawd_ Paragliding.jpg': ('clawd_paragliding', 'tech'),
    'claude/Clawd_ Rocket.jpg': ('clawd_rocket', 'tech'),
    'claude/Clawd_ Sleeping.jpg': ('clawd_sleeping', 'tech'),
    'claude/Clawd_ Wizard.jpg': ('clawd_wizard', 'tech'),
    'claude/Let Claude Cook sticker.jpg': ('let_claude_cook', 'tech'),
}

def strip_bg(im):
    a = np.asarray(im.convert('RGB')).astype(int)
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    ref = np.median(border, axis=0)
    bg = np.abs(a - ref).max(2) <= 18
    lab, _ = ndimage.label(bg)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bg = np.isin(lab, edge[edge > 0])
    alpha = Image.fromarray(((~bg) * 255).astype('uint8'))
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    out = im.convert('RGBA')
    out.putalpha(alpha)
    return out

catalog = json.load(open(CATALOG))
have = {c['id'] for c in catalog}
seen = {}
for rel, (slug, group) in MAP.items():
    f = os.path.join(SRC, rel)
    h = hashlib.md5(open(f, 'rb').read()).hexdigest()
    if h in seen:
        print('skip duplicate', rel, '=', seen[h]); continue
    seen[h] = rel
    im = Image.open(f)
    has_alpha = im.mode in ('RGBA', 'LA', 'P') and np.asarray(im.convert('RGBA'))[..., 3].min() < 250
    im = im.convert('RGBA') if has_alpha else strip_bg(im)
    bbox = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    if bbox:
        im = im.crop(bbox)
    im.thumbnail((MAX, MAX), Image.LANCZOS)
    im.save(os.path.join(OUT, slug + '.webp'), quality=88, method=6)
    if slug not in have:
        catalog.append({'id': slug, 'group': group, 'aspect': round(im.width / im.height, 3)})
    print(slug, group, im.size)

json.dump(catalog, open(CATALOG, 'w'), indent=1)
