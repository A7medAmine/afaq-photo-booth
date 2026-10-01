"""Organize raw sticker images: strip white/checker backgrounds, trim, export webp.

Usage: python scripts/build-stickers.py <source-dir>
Writes public/assets/stickers/<slug>.webp and src/stickerCatalog.json.
"""
import glob, json, os, sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

SRC = sys.argv[1]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'assets', 'stickers')
MAX = 512

# index in sorted(glob('*')) -> (slug, group)
NAMES = """cars|f1_car|objects
back_to_505|music
weird|memes
money_bow|cute
princess|cute
hg_hot_girl|cute
cat_shocked|cats
grad_cap_silhouette|cute
hello_kitty_graduate|cute
swans|cute
limited_edition|memes
cat_question|cats
warning_do_not_touch|memes
billie_figure|music
505|music
arctic_monkeys|music
cat_screaming|cats
chase_atlantic_box|music
chase_atlantic_rose|music
the_weeknd|music
drake_no|memes
will_smith_pose|memes
spiderverse_hanging|memes
zzz|objects
teddy_bear|cute
white_chicks|memes
gumball_nicolas|memes
anime_hands_on_face|memes
gavin_kid|memes
jake_reading|memes
squidward_papers|memes
be_positive_proton|memes
peace_hand|objects
makeup_palette|cute
i_know_bas_bastaabat|arabic
deal_with_it_glasses|objects
dont_be_racist_arabic|arabic
beard|objects
drama_toggle|memes
tfou|arabic
nerd_alert|memes
come_along_with_me|cute
unacceptable|memes
i_bee_leaf_in_you|cute
cat_omg|cats
skeleton_thumbs|memes
blurry_girl_bow|memes
girl_explosion|memes
girl_biting_finger|memes
praying_girls|memes
delete_it|memes
shocked_girl|memes
detective_conan_arabic|arabic
red_dress_explosion_arabic|arabic
anime_goggles|memes
spiderman_jump|memes
dog_side_eye|memes
panda|cute
claw_clip|cute
mustache_a|objects
oops_girl|memes
kawaii_girl|cute
mustache_b|objects
exclamation_marks|objects
hello_kitty|cute
we_bare_bears|cute
cat_coffee|cats
cat_thumbs_up|cats
iced_coffee|cute
cherries|cute
red_bow|cute
dollars|objects
pink_bow|cute
clapperboard|objects
bmo|objects
checkered_flags|objects
duck_sunglasses|cute
camera|objects
neymar|memes
pointing_hand|objects
matcha|cute
cat_sunglasses|cats
aliens|memes
plus_1000_aura|memes
cat_angry|cats
smiley|objects
back_to_back|memes
born_to_make_history|memes
cat_grumpy|cats
blush_compact|cute
clown|memes
cat_sunglasses_thumbs|cats
dog_and_cat|cats
dog_sunglasses|cute
sparkles|cute
spiderweb_heart|cute
cat_sunglasses_small|cats
hug_sketch|memes
iconic|memes
ignored|memes
kylie|memes
man|memes
monkeys|memes
pony|cute
possums|memes
slay|memes
spiderman|memes
spongebob|memes
unicorn|cute
wtf|memes""".split('\n')
NAMES[0] = 'f1_car|objects'
NAMES = [n.split('|') for n in NAMES]

files = sorted(glob.glob(os.path.join(SRC, '*')))
assert len(files) == len(NAMES), (len(files), len(NAMES))

def strip_bg(im):
    a = np.asarray(im.convert('RGB')).astype(int)
    mn, mx = a.min(2), a.max(2)
    bg = (mn >= 200) & (mx - mn <= 18)
    lab, _ = ndimage.label(bg)
    border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bg = np.isin(lab, border[border > 0])
    alpha = Image.fromarray(((~bg) * 255).astype('uint8'))
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    out = im.convert('RGBA')
    out.putalpha(alpha)
    return out

os.makedirs(OUT, exist_ok=True)
catalog = []
for f, (slug, group) in zip(files, NAMES):
    im = Image.open(f)
    has_alpha = im.mode in ('RGBA', 'LA', 'P') and np.asarray(im.convert('RGBA'))[..., 3].min() < 250
    im = im.convert('RGBA') if has_alpha else strip_bg(im)
    bbox = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    if bbox:
        im = im.crop(bbox)
    im.thumbnail((MAX, MAX), Image.LANCZOS)
    im.save(os.path.join(OUT, slug + '.webp'), quality=88, method=6)
    catalog.append({'id': slug, 'group': group, 'aspect': round(im.width / im.height, 3)})
    print(slug, group, im.size, 'alpha' if has_alpha else 'stripped')

json.dump(catalog, open(os.path.join(ROOT, 'src', 'stickerCatalog.json'), 'w'), indent=1)
