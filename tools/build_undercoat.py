"""Restore robe pigment concealed by independently rigged sleeves and hands."""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

VIEWS = ('front', 'back', 'left', 'right')
TOP, BOTTOM = .12, .83
W, H = 448, 736


PANELS = {
    'sword': (.394,.455,.594,.731), 'ward': (.383,.525,.558,.727),
    'black': (.344,.466,.589,.756), 'white': (.390,.472,.635,.756),
    'thunder': (.44,.525,.621,.80),'thunder-guard':(.44,.525,.621,.80),
    'judge':(.363,.404,.673,.671),'corpse':(.331,.428,.638,.748),
}


def fill_cloth(rgb, known, panel, role):
    # Continue the large scale lighting from visible cloth across the hole.
    # Each level supplies a broader neighbourhood where no close textile exists.
    mass=known.astype('f')
    colors=rgb.astype('f')*mass[...,None]
    pyramid=[]
    while min(mass.shape)>4:
        blurred=ndi.gaussian_filter(mass,1.6)
        smoothed=ndi.gaussian_filter(colors,(1.6,1.6,0))
        pyramid.append((blurred,smoothed))
        mass=blurred[::2,::2];colors=smoothed[::2,::2]
    field=np.median(rgb[known],axis=0)[None,None,:]
    for local,color in reversed(pyramid):
        h,w=local.shape
        field=ndi.zoom(field,(h/field.shape[0],w/field.shape[1],1),order=1,prefilter=False)
        ramp=np.clip((local-.025)/.53,0,1)[...,None]
        field=field*(1-ramp)+color/np.maximum(local,.00001)[...,None]*ramp

    # A single uninterrupted piece of this character's own back hem supplies
    # the weave and broad descending folds, without tiling patches or copying
    # accessories translated from another viewpoint.
    donor=np.asarray(panel.resize((W,H),Image.Resampling.BICUBIC)).astype('f')
    lum=donor@np.array([.2126,.7152,.0722])
    low=ndi.gaussian_filter(lum,(16,12))
    high=ndi.gaussian_filter(lum,(1.4,1.4))
    grain=(lum-high)*1.04
    folds=(high-low)/np.maximum(33,low)
    base=np.median(donor.reshape(-1,3),axis=0)
    depth=np.minimum(1.,ndi.distance_transform_edt(~known)/34.)[...,None]
    garment=.27 if role=='sword' else .13
    field=field*(1-garment*depth)+base*garment*depth
    return np.uint8(np.clip(field*(1+.80*np.clip(folds,-.52,.60)[...,None])+np.clip(grain,-18,19)[...,None],0,255))


def undercoat(output,role,regions):
    # Use the same registered colour/alpha as the game. This includes the
    # existing clean plates for swords, staffs, scabbards and hanging tassels.
    source=Image.open(output/f'{role}-views.webp').convert('RGBA')
    cw,ch=source.width//2,source.height//2
    atlas=Image.new('RGBA',(2*W,2*H))
    u0,v0,u1,v1=PANELS[role]
    donor=source.crop((cw+round(u0*cw),round(v0*ch),cw+round(u1*cw),round(v1*ch))).convert('RGB')
    for k,view in enumerate(VIEWS):
        x0=(k%2)*cw; y0=(k//2)*ch
        image=source.crop((x0,y0+round(TOP*ch),x0+cw,y0+round(BOTTOM*ch)))
        rgba=np.asarray(image.resize((W,H),Image.Resampling.LANCZOS))
        raw=Image.new('L',(W,H)); pen=ImageDraw.Draw(raw)
        for polygon in regions[view]:
            pen.polygon([(round(u*(W-1)),round((v-TOP)/(BOTTOM-TOP)*(H-1))) for u,v in polygon],fill=255)
        mask=np.asarray(raw)>0
        # A few pixels outside the line include antialiased fingertips and
        # the dark shadow of a cuff drawn on the neighbouring textile.
        mask=ndi.binary_dilation(mask,iterations=5)
        solid=rgba[:,:,3]>197
        trusted=solid & ~ndi.binary_dilation(mask,iterations=3)
        # No face or bare neck is an admissible donor for the hidden robe.
        trusted[:int((.17-TOP)/(BOTTOM-TOP)*H)]=False
        fill=fill_cloth(rgba[:,:,:3],trusted,donor,role)
        missing=mask | (rgba[:,:,3]<150)
        strength=ndi.gaussian_filter(missing.astype('f'),1.28)
        color=np.uint8(np.clip(fill*strength[...,None]+rgba[:,:,:3]*(1-strength[...,None]),0,255))
        # Store the stencil above 1/2 alpha. The lower half would discard
        # hidden RGB in browser image decoders. Every texel is a usable fallback.
        patch=Image.fromarray(color)
        patch.putalpha(Image.fromarray(np.uint8(128+127*strength)))
        atlas.paste(patch,((k%2)*W,(k//2)*H))
    atlas.save(output/f'{role}-undercoat.webp',quality=91,method=4,alpha_quality=95)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output',type=Path); parser.add_argument('roles',nargs='*')
    args=parser.parse_args()
    regions=json.loads(Path(__file__).with_name('undercoat-regions.json').read_text())
    for role in args.roles or regions:
        undercoat(args.output,role,regions[role])


if __name__=='__main__':
    main()
