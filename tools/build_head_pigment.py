"""Prepare an eye-free scalp, isolated beard and skin for the closed head meshes."""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

VIEWS = ('front', 'back', 'left', 'right')
SIZE = 384
# Ear silhouettes measured inside each source's head crop, from y=.02.
# Order is the left and right profile. Values retain each painting's asymmetry.
EARS = {
    'sword': ((.413,.415,.56,.605),(.490,.428,.612,.614)),
    'ward': ((.471,.427,.606,.672),(.406,.43,.54,.673)),
    'black': ((.451,.480,.594,.653),(.510,.473,.635,.655)),
    'white': ((.397,.635,.497,.765),(.509,.634,.626,.764)),
    'judge': ((.501,.420,.61,.608),(.419,.413,.513,.592)),
    'thunder': ((.410,.449,.555,.631),(.509,.45,.617,.626)),
    'thunder-guard': ((.412,.445,.553,.622),(.509,.449,.618,.621)),
    'corpse': ((.413,.536,.554,.705),(.477,.537,.589,.697)),
}


def quilt(rgb, mask):
    """Retain observed strands and cover unobserved areas with actual texture patches."""
    if mask.sum() < 3:
        raise ValueError('No pigment in material mask')
    h,w = mask.shape
    radius = max(4,round(min(w,h)*.057))
    inside = ndi.distance_transform_edt(mask)
    radius = min(radius,max(2,int(inside.max())-1))
    centers = np.column_stack(np.where(inside>radius*1.52))
    if not len(centers):
        centers=np.column_stack(np.where(inside>=inside.max()*.90))
    rng=np.random.default_rng(112)
    weight=np.outer(np.hanning(radius*2+3)[1:-1],np.hanning(radius*2+3)[1:-1])
    offset=np.arange(-radius,radius+1)
    accum=np.zeros((h,w,3),'f'); total=np.zeros((h,w),'f')
    for cy in range(0,h+radius,radius):
        for cx in range(0,w+radius,radius):
            if 0<=cy<h and 0<=cx<w and inside[cy,cx]>radius*1.5:
                sy,sx=cy,cx
            else:
                delta=centers-[cy,cx]
                dist=(delta*delta).sum(axis=1)
                candidates=centers[dist<=dist.min()+(radius*2.2)**2]
                sy,sx=candidates[rng.integers(len(candidates))]
            ys=cy+offset; xs=cx+offset
            vy=(ys>=0)&(ys<h); vx=(xs>=0)&(xs<w)
            if not vx.any() or not vy.any(): continue
            sl=np.ix_(ys[vy],xs[vx]); window=weight[np.ix_(vy,vx)]
            donor=rgb[np.ix_(np.clip(sy+offset[vy],0,h-1),np.clip(sx+offset[vx],0,w-1))]
            total[sl]+=window
            accum[sl]+=donor*window[...,None]
    filled=accum/np.maximum(total[...,None],.00001)
    mix=np.clip(inside/3,0,1)[...,None]
    return np.uint8(np.clip(filled*(1-mix)+rgb*mix,0,255))


def dermis(source, role, registration):
    # Sample an actual cheek from the approved close-up. The neck has no collar,
    # eye or lips even where the reference hides the corresponding skin.
    bounds_path=source/'面部细节'/'bounds.json'
    bounds=json.loads(bounds_path.read_text()) if bounds_path.is_file() else {}
    frontal=source/'面部细节'/f'{role}.webp'
    if frontal.exists() and role in bounds:
        rgb=np.asarray(Image.open(frontal).convert('RGB'))
        x0,y0,x1,y1=bounds[role]
    else:
        rgb=np.asarray(Image.open(source/f'{role}-front.png').convert('RGB'))
        x0,y0,x1,y1=0.,0.,1.,1.
    yy,xx=np.indices(rgb.shape[:2]);u=x0+(xx+.5)/rgb.shape[1]*(x1-x0);v=y0+(yy+.5)/rgb.shape[0]*(y1-y0)
    nose,ea,eb,lips,chin=map(np.asarray, registration['landmarks'][0])
    distance=max(.025,eb[0]-ea[0]); height=chin[1]-(ea[1]+eb[1])*.5
    center=ea*.64+lips*.36-np.array([distance*.08,0])
    mask=((u-center[0])/(distance*.20))**2+((v-center[1])/(height*.11))**2<1
    pixels=rgb[mask].astype(float)
    brightness=pixels.mean(axis=1)
    useful=(brightness>np.quantile(brightness,.34))&(brightness<=np.quantile(brightness,.81))
    if useful.any(): pixels=pixels[useful]
    color=np.median(pixels,axis=0)
    # Use the observed pore texture, but let lighting describe the shape of the
    # neck. Retiling reflected edges makes the detail seamless on its cylinder.
    ys,xs=np.where(mask); tex=rgb[ys.min():ys.max()+1,xs.min():xs.max()+1].astype(float)
    detail=tex-ndi.gaussian_filter(tex,(1.6,1.6,0))
    detail=np.clip(detail,-13,13)*.52
    sample=np.concatenate((detail,detail[:,::-1]),axis=1)
    sample=np.concatenate((sample,sample[::-1]),axis=0)
    tex=np.tile(sample,(SIZE//sample.shape[0]+1,SIZE//sample.shape[1]+1,1))[:SIZE,:SIZE]
    return Image.fromarray(np.uint8(np.clip(color*.92+tex,0,255)))

# Four corners (top-left, top-right, bottom-left, bottom-right) of the visible
# neck in the left profile, measured on the same crop as the helix. Right
# paintings are fitted separately to their own ear instead of mirroring pigment.
NECK_SIDE = {
    'sword': ((.31,.71),(.51,.61),(.366,.855),(.548,.77)),
    'ward': ((.485,.717),(.644,.62),(.528,.78),(.658,.745)),
    'black': ((.396,.701),(.574,.63),(.409,.813),(.593,.755)),
    'white': ((.29,.835),(.412,.769),(.314,.957),(.428,.872)),
    'judge': ((.52,.637),(.596,.605),(.525,.707),(.582,.673)),
    'thunder': ((.35,.766),(.523,.646),(.352,.842),(.541,.757)),
    'thunder-guard': ((.353,.759),(.520,.643),(.371,.842),(.530,.758)),
    'corpse': ((.326,.775),(.493,.684),(.336,.884),(.52,.795)),
}


def neck_cylinder(source, role, record, skin):
    """Wrap two measured profiles continuously from throat to nape."""
    reference=np.asarray(skin)
    y,x=np.mgrid[:SIZE,:SIZE*4]
    t=(y+.5)/SIZE
    theta=(x+.5)/(4*SIZE)*2*np.pi-np.pi
    colors=[];weights=[]
    # The reprojected photograph contributes tendons, jugular shadows, wrinkles
    # and the different temperatures on either side of the actual character.
    for k,view in enumerate(('left','right')):
        left,_,right,bot=record['rects'][k+2]
        quad=np.array(NECK_SIDE[role],dtype=float)
        if k:
            le=np.mean(np.array(EARS[role][0]).reshape(2,2),axis=0)
            re=np.mean(np.array(EARS[role][1]).reshape(2,2),axis=0)
            quad[:,0]=re[0]-(quad[:,0]-le[0])
            quad[:,1]+=re[1]-le[1]
            quad=quad[[1,0,3,2]]
        phi=theta-(np.pi/2 if k==0 else -np.pi/2)
        along=(np.sin(phi)+1)*.5
        start=quad[0,:,None,None]*(1-along)+quad[1,:,None,None]*along
        end=quad[2,:,None,None]*(1-along)+quad[3,:,None,None]*along
        u,v=start*(1-t)+end*t
        orig=np.asarray(Image.open(source/f'{role}-{view}.png').convert('RGB'))
        h,w=orig.shape[:2]; ur=(left+u*(right-left))*(w-1); vr=(.02+v*(bot-.02))*(h-1)
        sample=np.stack([ndi.map_coordinates(orig[:,:,ch],[vr,ur],order=1) for ch in range(3)],axis=-1).astype('f')
        # Reject any green collar binding caught at the bottom of the crop.
        # Preserve real wrinkles, moles and pores in the usable skin pixels.
        skinTone=np.median(reference.reshape(-1,3),axis=0)
        luma=sample@np.array([.2126,.7152,.0722]); lumSkin=skinTone@np.array([.2126,.7152,.0722])
        relative=sample/np.maximum(luma[...,None],12)
        targetChroma=skinTone/max(12,lumSkin)
        chroma=np.linalg.norm(relative-targetChroma,axis=-1)
        observed=np.clip((.41-chroma)/.23,0,1)*np.clip((luma-18)/32,0,1)
        # The game key and self-occlusion supply the large-scale illumination;
        # retain the observed tonal range relative to the donor's own exposure.
        texture=(luma-np.median(luma))/max(48,lumSkin)
        registered=skinTone+np.clip(texture,-.46,.42)[...,None]*lumSkin*.88+(relative-targetChroma)*16
        registered=registered*observed[...,None]+skinTone*(1-observed[...,None])
        colors.append(registered)
        weights.append(.018+np.maximum(0,np.cos(phi))**1.6)
    result=sum(c*w[...,None] for c,w in zip(colors,weights))/sum(weights)[...,None]
    detail=np.tile(reference,(1,4,1)).astype(float)-np.median(reference.reshape(-1,3),axis=0)
    return Image.fromarray(np.uint8(np.clip(result+detail,0,255)))


def shaved_scalp(source, record):
    # Close-cropped stubble behind the guardian's left temple. The posterior
    # skull and sides are shaved; his tied black topknot keeps its own pigment.
    im=np.asarray(Image.open(source/'ward-left.png').convert('RGB'))
    left,_,right,bot=record['rects'][2];w,h=im.shape[1],im.shape[0]
    xx=np.array([.529,.633]); yy=np.array([.288,.407])
    px=np.rint((left+xx*(right-left))*w).astype(int);py=np.rint((.02+yy*(bot-.02))*h).astype(int)
    patch=im[py[0]:py[1],px[0]:px[1]].astype(float)
    # Retain the painted stubble colour and pore contrast without repeating a
    # hairline or a shadow across the head.
    palette=np.median(patch.reshape(-1,3),axis=0)
    detail=patch-ndi.gaussian_filter(patch,(1.1,1.1,0))
    sigma=np.clip(np.median(np.abs(detail))*1.48,2.0,5.0)
    rng=np.random.default_rng(47)
    noise=rng.normal(size=(SIZE,SIZE*4)).astype('f')
    broad=ndi.gaussian_filter(noise,7,mode='wrap')
    broad/=max(.0001,broad.std())
    medium=ndi.gaussian_filter(noise,1.35,mode='wrap')
    medium/=max(.0001,medium.std())
    follicles=ndi.gaussian_filter((rng.random(noise.shape)<.062).astype('f'),(.68,.43),mode='wrap')
    grain=.95*sigma*noise+2.6*medium+2.3*broad-22*(follicles-follicles.mean())
    rgb=palette[None,None,:]+grain[...,None]*np.array([.96,.98,1.02])
    return Image.fromarray(np.uint8(np.clip(rgb,0,255)))


def build(source, output, role, record, regions):
    atlas = Image.new('RGB',(SIZE*4,SIZE*4))
    skin = dermis(source,role,record)
    ear_rects = []
    for camera, view in enumerate(VIEWS):
        original = source / f'{role}-{view}.png'
        high = source / f'{role}-{view}-body.png'
        rgba = np.asarray(Image.open(high if high.exists() else original).convert('RGBA'))
        h,w = rgba.shape[:2]
        left, top, right, bottom = record['rects'][camera]
        x0,x1 = round(w*left),round(w*right)
        y0,y1 = round(h*top),round(h*bottom)
        rgb = rgba[y0:y1,x0:x1,:3]
        yy,xx=np.mgrid[y0:y1,x0:x1]; v=(yy+.5)/h; u=(xx+.5)/w
        knots=np.asarray(regions[view])
        in_head = ((rgba[y0:y1,x0:x1,3]>171) & (v < knots[-1,0]) &
                   (u >= np.interp(v,knots[:,0],knots[:,1])) &
                   (u <= np.interp(v,knots[:,0],knots[:,2])))
        if camera in (2,3):
            mid = record['landmarks'][camera-1]
            eye,nose,lips,chin=map(np.asarray,mid)
            a,b,c,d=EARS[role][camera-2]
            ear_rects.append([left+a*(right-left),.02+b*(bottom-.02),
                              left+c*(right-left),.02+d*(bottom-.02)])
            ear=np.array(ear_rects[-1]).reshape(2,2).mean(axis=0)
            length = max(.025,chin[1]-eye[1])
            # Everything between the frontal silhouette and the far edge of
            # the ear is face/neck. A hair cap may never acquire its own eye.
            cutoff = ear_rects[-1][2 if camera==2 else 0]
            ahead = (u < cutoff+.006) if camera==2 else (u > cutoff-.006)
            facial = (v > eye[1]-.63*length) & ahead
            scalp = in_head & ~facial & (v<chin[1]+.015*length)
            lower = (v > lips[1]+.10*length) & (v < chin[1]+.30*length)
            cheekward = (u < ear[0]) if camera==2 else (u > ear[0])
            beard = in_head & lower & cheekward
        elif camera==0:
            nose,ea,eb,lips,chin=map(np.asarray,record['landmarks'][0])
            eye=(ea+eb)*.5; length=chin[1]-eye[1]; spread=max(.025,eb[0]-ea[0])
            center=np.interp(v,[eye[1],chin[1]],[eye[0],chin[0]])
            facial=(v>eye[1]-.64*length)&(abs(u-center)<spread*1.95)
            scalp=in_head & ~facial & (v<chin[1]+.015*length)
            beard=(in_head & (abs(u-chin[0])<spread*.82) &
                   (v>lips[1]+.135*length)&(v<chin[1]+.25*length))
        else:
            # There are no eyes on the rear observation. Exclude the collar
            # when extending the texture over the back of the head.
            scalp = in_head & (v<bottom*.74)
            beard = scalp
        luminance=rgb.mean(axis=2)
        chroma=rgb.max(axis=2).astype(float)-rgb.min(axis=2)
        hair=scalp & (luminance<(165 if role=='ward' else 130)) & (chroma < np.maximum(24,.54*luminance))
        if role in ('judge','black','white','corpse') and camera!=1:
            hair &= v>eye[1]-.64*length
        if hair.sum()<18:
            hair=scalp
        # Facial hair must not pick up the outline of lips or flesh-coloured
        # jaw curves. Only the source's dark stubble/beard belongs on these fibres.
        if role == 'judge' and camera==0:
            # His full curly beard is longer than the skin atlas. The central
            # curls immediately below the moustache contain its silver strands.
            beard=in_head & (u>left+.34*(right-left)) & (u<left+.72*(right-left)) & (v>.111) & (v<bottom*.94)
        dark=beard & (luminance<np.quantile(luminance[beard],.94)) if beard.any() else hair
        for level,valid in ((0,hair),(1,dark),(3,scalp)):
            if valid.sum()<6: valid=hair if hair.any() else in_head
            color=Image.fromarray(quilt(rgb,valid)).resize((SIZE,SIZE),Image.Resampling.LANCZOS)
            atlas.paste(color,(camera*SIZE,level*SIZE))
    if role=='ward':
        atlas.paste(shaved_scalp(source,record),(0,0))
    atlas.paste(neck_cylinder(source,role,record,skin),(0,2*SIZE))
    atlas.save(output / f'{role}-head-materials.webp', quality=93, method=4)
    return np.round(ear_rects,6).tolist()


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source',type=Path); parser.add_argument('output',type=Path)
    parser.add_argument('roles',nargs='*'); args=parser.parse_args()
    prefix='export const headRegistration = '
    data=json.loads((args.output/'head-scanlines.js').read_text().strip()[len(prefix):-1])
    regions=json.loads(Path(__file__).with_name('head-regions.json').read_text())
    target=args.output/'ear-registration.js'
    prefix='export const earRegistration = '
    ears=json.loads(target.read_text().strip()[len(prefix):-1]) if target.exists() else {}
    for role in args.roles or data.keys():
        ears[role]=build(args.source,args.output,role,data[role],regions[role])
    target.write_text(prefix+json.dumps(ears,sort_keys=True,separators=(',',':'))+';\n')


if __name__=='__main__':
    main()
