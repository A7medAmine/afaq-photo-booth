"""Add blush + hat face stickers from a folder with blushhing/ and hats/ subfolders.

Usage: python scripts/build-face-stickers-3.py <source-dir>
Writes public/assets/stickers/<id>.webp. Blush pairs are cut down to one blob (the app mirrors it).
"""
import glob, os, sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'assets', 'stickers')
MAX = 512


def strip_light_bg(im, thresh=228):
    """Remove near-white / light-gray (incl. baked-in checkerboard) connected to the border."""
    a = np.asarray(im.convert('RGB')).astype(int)
    light = (a.min(2) >= thresh) | ((a.max(2) - a.min(2) < 14) & (a.min(2) >= 200))
    lab, _ = ndimage.label(light)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bg = np.isin(lab, edge[edge > 0])
    alpha = Image.fromarray(((~bg) * 255).astype('uint8')).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    out = im.convert('RGBA')
    out.putalpha(alpha)
    return out


def first_blob(im):
    a = np.asarray(im.getchannel('A')) > 12
    lab, n = ndimage.label(ndimage.binary_dilation(a, iterations=6))
    if n < 2:
        return im
    xs = [np.where(lab == i)[1].min() for i in range(1, n + 1)]
    keep = lab == (int(np.argmin(xs)) + 1)
    out = im.copy()
    al = np.asarray(im.getchannel('A')).copy()
    al[~keep] = 0
    out.putalpha(Image.fromarray(al))
    return out


def save(im, slug):
    bbox = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    if bbox:
        im = im.crop(bbox)
    im.thumbnail((MAX, MAX), Image.LANCZOS)
    im.save(os.path.join(OUT, slug + '.webp'), quality=90, method=6)
    print(slug, im.size)


blush = sorted(glob.glob(os.path.join(SRC, 'blushhing', '*')))
for i, f in enumerate(blush, 1):
    im = Image.open(f).convert('RGBA')
    if im.getchannel('A').getextrema()[0] > 250:
        im = strip_light_bg(im)
    save(first_blob(im), f'blush_k{i}')

hats = sorted(glob.glob(os.path.join(SRC, 'hats', '*')))
for slug, f in zip(['hat_cowboy', 'hat_witch_black', 'hat_witch_purple'], hats):
    im = Image.open(f).convert('RGBA')
    if im.getchannel('A').getextrema()[0] > 250:
        im = strip_light_bg(im)
    save(im, slug)
