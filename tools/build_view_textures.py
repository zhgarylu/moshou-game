"""Pack the registered cameras used by the live Three.js character material."""
import argparse
import base64
import json
import shutil
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

from cranial_volume import FEATURES

ROLES = ('thunder', 'thunder-guard', 'sword', 'ward', 'judge', 'corpse', 'black', 'white')
VIEWS = ('front', 'back', 'left', 'right')
CELL_WIDTH, CELL_HEIGHT = 640, 1408


def extend_rear_hair(image):
    """Fill the uncovered rim of the sword master's turned head with neighbouring hair."""
    pixels = np.array(image)
    height, width = pixels.shape[:2]
    for y in range(round(.131 * height)):
        row = pixels[y]
        xs = np.flatnonzero(row[:, 3] > 180)
        runs = np.split(xs, np.flatnonzero(np.diff(xs) > 1) + 1)
        spans = [run for run in runs if len(run) > 5 and abs(run.mean()/width-.395) < .14]
        if not spans:
            continue
        main = max(spans, key=len)
        for direction, edge in ((-1, main[0]), (1, main[-1])):
            length = min(len(main)-2, round(.10 * width))
            step = np.arange(1, length+1)
            dest = np.clip(edge + direction*step, 0, width-1)
            src = edge - direction*(step+1)
            empty = row[dest, 3] < 64
            row[dest[empty], :3] = row[src[empty], :3]
            row[dest[empty], 3] = np.uint8(255 * np.clip((length-step[empty])/6,0,1))
    return Image.fromarray(pixels)


def head_scanlines(source, output, selected):
    # Each horizontal interval is measured on the head alone. The side of a
    # sword case, the lion on a shoulder, and the crest of a banner often
    # share image rows with the eyes. Their projected UVs must remain distinct.
    limits = json.loads((Path(__file__).parent / 'head-regions.json').read_text())
    marks = json.loads(Path(__file__).with_name('profile-landmarks.json').read_text())
    metadata = output / 'head-scanlines.js'
    prefix = 'export const headRegistration = '
    existing = metadata.read_text().strip() if metadata.exists() else ''
    records = json.loads(existing[len(prefix):-1]) if existing.startswith(prefix) else {}
    tile = 384
    for role in selected:
        quantized = []
        rectangles = []
        head_atlas = Image.new('RGBA',(tile*2,tile*2))
        for camera, view in enumerate(VIEWS):
            knots = np.array(limits[role][view])
            alpha = np.array(Image.open(source / f'{role}-{view}.png').getchannel('A'))
            h, w = alpha.shape
            # Keep a padded, head-only observation. The UV of an oblique
            # temple may land outside the painted silhouette; there the nearby
            # scalp is a valid donor, while the sword case and coat are not.
            image = Image.open(source / f'{role}-{view}.png').convert('RGB')
            x0 = max(0, int(w*(knots[:,1].min()-.015)))
            x1 = min(w, int(np.ceil(w*(knots[:,2].max()+.015))))
            y1 = min(h, int(np.ceil(h*(knots[-1,0]+.014))))
            rectangles.append([round(x0/w,6),0,round(x1/w,6),round(y1/h,6)])
            yy, xx = np.mgrid[:y1,x0:x1]
            lo = np.interp(yy/h,knots[:,0],knots[:,1])*w
            hi = np.interp(yy/h,knots[:,0],knots[:,2])*w
            mask = (alpha[:y1,x0:x1]>183)&(xx>=lo)&(xx<=hi)&(yy/h<=knots[-1,0])
            # Drop isolated flecks of a prop. Preserve ornaments connected to
            # the crown, minimise colour fringes along wisps of black hair.
            components,_=ndi.label(mask)
            sizes=np.bincount(components.ravel())
            sizes[0]=0
            mask=(components==np.argmax(sizes))
            inner=ndi.binary_erosion(mask,iterations=1)
            nearest=ndi.distance_transform_edt(~inner,return_distances=False,return_indices=True)
            gy,gx=np.indices(mask.shape)
            dy,dx=nearest[0]-gy,nearest[1]-gx
            distance=np.maximum(1,np.hypot(dx,dy))
            # Reflect across the real silhouette into hair, beard or skin,
            # instead of expanding a single nearest pixel across a whole rim.
            factor=np.minimum(.72,7/distance)
            ry=np.clip(np.rint(nearest[0]+dy*factor).astype(int),0,y1-1)
            rx=np.clip(np.rint(nearest[1]+dx*factor).astype(int),0,x1-x0-1)
            safe=inner[ry,rx]; sy=np.where(safe,ry,nearest[0]);sx=np.where(safe,rx,nearest[1])
            picture=np.array(image)[:y1,x0:x1]
            padded=Image.fromarray(picture[sy,sx])
            trust=np.where(inner,255,42+211*np.exp(-((distance/(h*.009))**2))).astype('uint8')
            padded.putalpha(Image.fromarray(trust))
            padded=padded.resize((tile,tile),Image.Resampling.LANCZOS)
            head_atlas.paste(padded,((camera%2)*tile,(camera//2)*tile))
            for v in np.linspace(0, .25, 65):
                if not knots[0, 0] <= v <= knots[-1, 0]:
                    quantized.extend((255, 0))
                    continue
                lower, upper = (np.interp(v, knots[:, 0], knots[:, index]) * (w-1) for index in (1, 2))
                y = round(v * (h-1))
                near = alpha[max(0,y-2):min(h,y+3)].max(axis=0)
                inside = np.flatnonzero((near > 110) & (np.arange(w) >= lower) & (np.arange(w) <= upper))
                values = [inside[0], inside[-1]] if len(inside) > 1 else [lower, upper]
                quantized.extend(round(u * 255 / (w-1)) for u in values)
        head_atlas.save(output / f'{role}-cranial.webp',quality=94,method=4)
        records[role] = {
            'rects': rectangles,
            'landmarks': [FEATURES[role], *marks[role]],
            # Two byte-sized horizontal bounds at 65 heights for each of 4 cameras.
            'rows': base64.b64encode(bytes(quantized)).decode('ascii'),
        }
    payload = json.dumps(records, separators=(',', ':'), sort_keys=True)
    metadata.write_text(prefix + payload + ';\n')


def build(source, output, role):
    atlas = Image.new('RGBA', (CELL_WIDTH * 2, CELL_HEIGHT * 2))
    for index, view in enumerate(VIEWS):
        original = Image.open(source / f'{role}-{view}.png').convert('RGBA')
        for suffix in ('body', 'color'):
            refined = source / f'{role}-{view}-{suffix}.png'
            if refined.exists():
                color = Image.open(refined).convert('RGBA')
                if suffix != 'body':
                    color.putalpha(original.getchannel('A').resize(color.size, Image.Resampling.LANCZOS))
                original = color
                break
        if role == 'sword' and view == 'back':
            original = extend_rear_hair(original)
        image = original.resize((CELL_WIDTH, CELL_HEIGHT), Image.Resampling.LANCZOS)
        atlas.paste(image, ((index % 2) * CELL_WIDTH, (index // 2) * CELL_HEIGHT))
    atlas.save(output / f'{role}-views.webp', quality=94, method=5, alpha_quality=100)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('roles', nargs='*')
    args = parser.parse_args()
    args.output.mkdir(exist_ok=True, parents=True)
    selected = args.roles or ROLES
    head_scanlines(args.source, args.output, selected)
    for role in selected:
        build(args.source, args.output, role)
    face_source = args.source / '面部细节'
    if (face_source / 'bounds.json').is_file():
        bounds = json.loads((face_source / 'bounds.json').read_text())
        for role in bounds:
            shutil.copyfile(face_source / f'{role}.webp', args.output / f'{role}-face.webp')
        (args.output / 'face-bounds.js').write_text(
            'export const faceBounds = ' + json.dumps(bounds, indent=2) + ';\n'
        )
