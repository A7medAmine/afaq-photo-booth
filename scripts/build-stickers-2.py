"""Add the 'Stickers by pressi' batch: strip solid white/gray backgrounds, trim, export webp.

Usage: python scripts/build-stickers-2.py <source-dir>
Appends to src/stickerCatalog.json (skips ids already present).
"""
import glob, json, os, sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

SRC = sys.argv[1]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'assets', 'stickers')
CATALOG = os.path.join(ROOT, 'src', 'stickerCatalog.json')
MAX = 512

NAMES = """need_more_coffee|objects
meditating_book|cute
cute_blush_guy|memes
miffy|cute
pink_ribbon|cute
sad_kid|memes
disco_ball|objects
white_flower|cute
dollar_fan|objects
vintage_camera|objects
iconic_text|memes
year_2026|memes
glitter_star|cute
monster_scream|memes
grad_cap_diploma|objects
clover_seal|cute
cake|cute
dog_coffee|cute
hamster_thank_you|cute
cat_heart_paws|cats
grad_cat|cats
delulu|memes
teddy_brown|cute
university_text|memes
lucky_777|objects
corgi_smirk|cute
lucky_me|cute
ask_chatgpt|memes
film_strip|objects
birthday_bubble|memes
mushroom_girl|memes
gargamel|memes
green_kid|memes
pink_hood_man|memes
lion_hands_hip|memes
nick_fox|memes
saudi_man|arabic
confused_woman|memes
strawberry_face|memes
banana_face|memes
minion_face|memes
rat_face|memes
chicken_face|memes
happy_meal_face|memes
blue_mouse|cute
gargamel_peace|memes
green_lizard|memes
kiwi_face|memes""".split('\n')
NAMES = [n.split('|') for n in NAMES]

files = sorted(glob.glob(os.path.join(SRC, '*')))
assert len(files) == len(NAMES), (len(files), len(NAMES))

def strip_bg(im):
    a = np.asarray(im.convert('RGB')).astype(int)
    h, w, _ = a.shape
    # background colour = median of border pixels
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    ref = np.median(border, axis=0)
    bg = np.abs(a - ref).max(2) <= 14
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
for f, (slug, group) in zip(files, NAMES):
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
    print(slug, group, im.size, 'alpha' if has_alpha else 'stripped')

json.dump(catalog, open(CATALOG, 'w'), indent=1)
