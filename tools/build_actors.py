"""Bake four-view, skinned, watertight characters into GLB. Requires numpy, Pillow,
scipy, scikit-image, fast-simplification, manifold3d, xatlas. Input images are tight RGBA
{id}-{front,back,left,right}.png; nose points left on the anatomical left view.
Optional registered -depth.png (near white) and -color.png refine those cameras.
Coordinates in the fitting notes are normalized to the approved front silhouette.
"""
import argparse
import io
import json
import struct
from pathlib import Path

import fast_simplification
import numpy as np
import xatlas
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
from skimage.measure import marching_cubes
from cranial_volume import FEATURES
from anatomical_head import Head, cut_neck
import casting_hand
import carried_relic

HEIGHT = 1.8
VOXELS = 292
ATLAS = 2048
VIEWS = ('front', 'back', 'left', 'right')
# Crown/neck, belt, shoulders/elbows/wrists, toes: annotated in the approved pose.
# Image-left belongs to the character's right hand.
LANDMARKS = {
 'thunder-guard': ((.374,.155),(.357,.38),[(.17,.20),(.092,.34),(.060,.518)],[(.568,.195),(.675,.33),(.715,.505)],(.280,.967),(.598,.965)),
 'thunder': ((.69,.143),(.66,.40),[(.48,.185),(.34,.30),(.42,.146)],[(.835,.196),(.88,.333),(.925,.472)],(.43,.964),(.78,.95)),
 'sword': ((.66,.150),(.65,.395),[(.505,.185),(.389,.321),(.297,.452)],[(.76,.213),(.855,.351),(.93,.480)],(.319,.975),(.758,.948)),
 'ward': ((.553,.15),(.588,.401),[(.371,.176),(.265,.300),(.632,.248)],[(.722,.188),(.844,.296),(.638,.273)],(.269,.972),(.826,.951)),
 'judge': ((.504,.171),(.553,.406),[(.275,.201),(.199,.321),(.344,.357)],[(.70,.219),(.847,.365),(.871,.485)],(.226,.968),(.781,.953)),
 'corpse': ((.382,.163),(.420,.447),[(.200,.19),(.204,.245),(.326,.287)],[(.537,.208),(.729,.240),(.873,.280)],(.347,.975),(.553,.960)),
 'black': ((.536,.166),(.556,.434),[(.308,.204),(.234,.343),(.306,.468)],[(.682,.220),(.770,.325),(.866,.305)],(.273,.965),(.752,.956)),
 'white': ((.615,.164),(.606,.410),[(.424,.202),(.323,.294),(.282,.226)],[(.712,.21),(.787,.331),(.935,.347)],(.519,.972),(.694,.960)),
}
# Back painting has its own camera origin and slightly different body lean.
# Five anatomical centreline landmarks run from the skull to the support feet.
# They never follow accessories at the silhouette, so vertical embroidery stays straight.
BACK_YAW = {'sword':242, 'corpse':195, 'judge':224, 'black':172}
# The approved standing paintings look into the near shoulder; their profiles
# observe the anatomical sagittal plane. Keep +Z on the approved capture, and
# solve depth perpendicular to each character's actual shoulder line.
TORSO_YAW = {'thunder-guard':0, 'thunder':21, 'sword':24, 'ward':23,
             'judge':20, 'corpse':24, 'black':21, 'white':16}
# Vertical registrations of brows, chin, belt and ankles between the two
# independently drawn poses. Positions are measured from each tight crop.
PROFILE_ROWS = {
 'thunder-guard':([0,.095,.147,.395,.943,1],[0,.095,.151,.422,.948,1]),
 'thunder':([0,.083,.137,.398,.943,1],[0,.095,.151,.422,.948,1]),
 'sword':([0,.069,.122,.393,.938,1],[0,.082,.135,.420,.942,1]),
 'ward':([0,.073,.133,.413,.943,1],[0,.078,.142,.431,.944,1]),
 'judge':([0,.095,.159,.416,.946,1],[0,.101,.165,.430,.943,1]),
 'corpse':([0,.104,.152,.435,.944,1],[0,.110,.168,.440,.944,1]),
 'black':([0,.108,.160,.429,.949,1],[0,.113,.168,.434,.950,1]),
 'white':([0,.136,.187,.402,.938,1],[0,.135,.189,.407,.945,1]),
}
BACK_SPINES={
 'thunder-guard':(.626,.6362,.643,.5979,.561),
 'thunder':(.59,.603,.61,.589,.59),'sword':(.393,.398,.438,.442,.440),
 'ward':(.516,.501,.499,.504,.515),'judge':(.495,.485,.469,.467,.455),
 'corpse':(.446,.45,.449,.450,.457),'black':(.491,.489,.482,.491,.492),
 'white':(.443,.437,.437,.433,.432)}
# The visible seam follows the actual sleeve at the elbow and hem in the
# approved pose. Pixels behind these sleeves belong to an independent coat.
# Order is anatomical right, then left (image-left, then image-right).
SLEEVES = {
 'thunder-guard':[
  [(15,19),(24,21),(22,31),(20,40),(12,48),(14,56),(3,55),(0,48),(0,36),(7,25)],
  [(55,19),(65,21),(74,33),(81,45),(72,50),(73,54),(65,56),(64,48),(58,45),(55,32)]],
 'thunder':[
  [(48,17),(55,20),(52,31),(46,40),(36,48),(24,50),(20,45),(26,30),(35,19),(39,11),(46,10),(46,17)],
  [(80,18),(86,20),(93,31),(97,43),(96,50),(88,51),(84,46),(83,39),(80,32)]],
 'sword':[
  [(48,18),(55,18),(54,25),(46,33),(40,35),(36,42),(34,47),(30,50),(25,50),(25,46),(30,41),(33,34),(35,28),(41,21)],
  [(74,20),(81,20),(84,25),(88,31),(91,37),(96,45),(98,48),(96,51),(92,51),(90,47),(86,42),(83,36),(79,33),(75,27)]],
 'ward':[
  [(29,15),(43,16),(50,20),(55,25),(60,23),(62,17),(65,15),(67,20),(64,24),(69,25),(67,28),(56,29),(50,35),(44,43),(33,49),(17,58),(8,58),(13,47),(16,42),(11,42),(9,34),(9,25),(15,18)],
  [(72,16),(81,17),(91,22),(97,27),(99,37),(96,49),(92,53),(84,48),(79,40),(74,33),(67,30),(63,29),(64,26),(70,26),(78,28),(83,29),(76,25)]],
 'judge':[
  [(22,17),(35,17),(42,22),(40,29),(37,35),(39,38),(35,40),(30,38),(26,33),(24,38),(21,45),(15,53),(6,61),(0,61),(4,49),(8,38),(13,27)],
  [(68,20),(74,21),(81,28),(88,35),(94,40),(95,49),(92,55),(92,62),(85,65),(80,63),(82,56),(80,50),(82,45),(79,41),(74,36),(70,29)]],
 'corpse':[
  [(20,17),(29,18),(32,22),(35,24),(41,25),(44,31),(42,35),(33,34),(30,32),(26,39),(20,42),(12,37),(12,28),(14,21)],
  [(52,17),(63,18),(76,21),(86,24),(92,25),(99,30),(100,35),(93,34),(87,31),(83,36),(78,40),(71,39),(62,35),(58,29)]],
 'black':[
  [(29,18),(40,20),(40,29),(35,38),(34,44),(38,47),(38,52),(32,54),(25,52),(23,46),(20,43),(18,52),(12,59),(5,63),(0,65),(3,54),(8,44),(13,33),(20,25)],
  [(66,20),(74,22),(79,27),(80,31),(85,29),(89,29),(91,32),(88,35),(86,35),(88,43),(88,52),(84,58),(79,60),(76,54),(77,46),(74,37),(70,32)]],
 'white':[
  [(41,19),(50,20),(51,27),(47,39),(43,48),(37,55),(28,59),(22,60),(23,49),(28,39),(29,32),(28,25),(25,25),(25,21),(30,20),(32,25),(36,27)],
  [(68,20),(75,21),(79,27),(81,31),(89,33),(98,33),(100,36),(93,37),(87,36),(89,43),(87,52),(80,55),(77,51),(79,41),(75,36),(70,32)]],
}
PROPS = {
 'judge':[(.33,.379),(.36,.378),(.365,.445),(.412,.45),(.409,.480),(.369,.493),(.375,.89),(.364,.99),(.343,.998),(.325,.906),(.315,.493),(.268,.483),(.26,.455),(.324,.442)],
 'sword':[(.279,.468),(.321,.466),(.285,.517),(.334,.535),(.342,.647),(.283,.649),(.292,.541),(.26,.543),(.019,.941),(.0,.968),(.001,.918),(.221,.541),(.173,.535),(.171,.517),(.248,.509)],
 'white':[(.245,.002),(.283,.014),(.325,.014),(.352,.11),(.333,.243),(.345,.312),(.328,.365),(.382,.885),(.407,.991),(.377,.991),(.335,.77),(.28,.382),(.26,.233),(.22,.285),(.19,.410),(.132,.479),(.094,.398),(.074,.32),(.018,.29),(.002,.263),(.055,.194),(.077,.117),(.155,.075),(.18,.026)],
}
# Detached rigid objects also need a clean plate on every camera behind them.
# These silhouettes include the tassels; a tassel fixed on a moving coat would
# otherwise become an apparent second weapon during a swing.
PROPS['judge']=[(.304,.372),(.373,.372),(.372,.433),(.416,.45),(.410,.485),(.382,.496),(.384,.896),(.368,.997),(.338,.997),(.311,.891),(.307,.538),(.288,.546),(.297,.609),(.284,.670),(.290,.832),(.273,.886),(.202,.893),(.194,.843),(.213,.775),(.223,.677),(.210,.643),(.228,.604),(.233,.553),(.213,.551),(.217,.523),(.260,.50),(.252,.48),(.255,.451),(.305,.433)]
PROP_CAMERAS = {
 'judge':{
  'back':[(.933,.410),(.993,.409),(.997,.486),(.977,.503),(.994,.966),(.973,.992),(.943,.905),(.921,.613),(.907,.831),(.873,.878),(.843,.872),(.860,.638),(.834,.610),(.843,.561),(.867,.537),(.852,.521),(.860,.478),(.899,.464)],
  'left':[(.071,.435),(.133,.433),(.140,.491),(.197,.501),(.189,.545),(.142,.555),(.151,.937),(.119,.997),(.085,.958),(.078,.610),(.072,.70),(.055,.821),(.062,.874),(.021,.890),(.006,.821),(.024,.680),(.002,.681),(.012,.632),(.010,.583),(.026,.540),(.031,.507),(.071,.495)],
  'right':[(.807,.435),(.876,.434),(.873,.505),(.935,.515),(.920,.552),(.878,.561),(.878,.943),(.844,.999),(.809,.947),(.806,.624),(.796,.740),(.802,.827),(.773,.882),(.718,.876),(.728,.748),(.734,.689),(.722,.653),(.741,.596),(.707,.595),(.708,.556),(.754,.543),(.746,.518),(.808,.503)]},
 'sword':{
  'back':[(.739,.520),(.784,.520),(.798,.548),(.835,.552),(.836,.580),(.808,.589),(.999,.905),(.996,.957),(.949,.927),(.762,.613),(.763,.665),(.727,.673),(.719,.614),(.729,.584),(.700,.580),(.703,.551)],
  'left':[(.417,.563),(.495,.558),(.511,.592),(.577,.590),(.577,.636),(.598,.681),(.594,.749),(.522,.751),(.521,.683),(.505,.665),(.404,.937),(.354,.969),(.363,.918),(.436,.641),(.391,.637),(.377,.608),(.420,.594)],
  'right':[(.477,.570),(.551,.569),(.553,.596),(.616,.608),(.613,.642),(.566,.647),(.633,.929),(.610,.977),(.563,.949),(.494,.660),(.487,.743),(.409,.752),(.402,.687),(.426,.635),(.400,.617),(.403,.594),(.477,.591)]},
 'white':{
  'back':[(.705,.012),(.843,.015),(.867,.115),(.921,.164),(.925,.219),(.993,.233),(.998,.290),(.911,.276),(.953,.366),(.903,.485),(.876,.483),(.845,.374),(.813,.463),(.753,.528),(.764,.657),(.741,.993),(.711,.990),(.719,.742),(.742,.490),(.749,.302),(.719,.277),(.681,.309),(.654,.260),(.679,.179),(.658,.149),(.680,.112)],
  'left':[(.243,.021),(.295,.025),(.337,.084),(.349,.163),(.366,.207),(.355,.274),(.319,.302),(.311,.273),(.282,.274),(.281,.986),(.251,.997),(.233,.974),(.235,.371),(.217,.425),(.189,.536),(.140,.590),(.142,.481),(.071,.517),(.100,.404),(.024,.455),(.024,.396),(.082,.283),(.004,.323),(.024,.263),(.110,.172),(.106,.112),(.169,.068)],
  'right':[(.716,.026),(.766,.022),(.832,.081),(.863,.143),(.918,.179),(.945,.245),(.995,.298),(.991,.334),(.920,.305),(.962,.422),(.943,.453),(.888,.413),(.913,.509),(.873,.529),(.832,.446),(.849,.579),(.802,.541),(.766,.416),(.766,.985),(.734,.996),(.710,.978),(.714,.315),(.685,.301),(.646,.278),(.627,.209),(.654,.158),(.642,.103),(.693,.066)]}}
# The ferryman holds one mace in his anatomical left hand. Both painted
# profiles show its decorative face; the rigid object itself has one grip.
PROPS['black']=[(.833,.307),(.847,.270),(.841,.261),(.854,.21),(.872,.151),(.891,.135),(.963,.133),(.994,.153),(.998,.193),(.962,.259),(.943,.284),(.969,.324),(.998,.362),(.995,.385),(.954,.363),(.928,.357),(.901,.314),(.891,.274),(.873,.301),(.867,.335),(.835,.342)]
PROP_CAMERAS['black']={
 'back':[(.829,.314),(.826,.258),(.850,.21),(.859,.194),(.899,.179),(.979,.178),(.995,.191),(.962,.244),(.952,.292),(.961,.318),(.930,.318),(.880,.290),(.858,.330)],
 'left':[(.008,.360),(.032,.309),(.076,.286),(.088,.210),(.097,.197),(.184,.197),(.207,.211),(.194,.273),(.171,.313),(.173,.349),(.123,.369),(.108,.400),(.062,.414),(.061,.368),(.017,.392),(.003,.389)],
 'right':[(.772,.206),(.804,.194),(.885,.202),(.904,.217),(.917,.278),(.935,.300),(.995,.362),(.997,.389),(.964,.385),(.912,.363),(.925,.408),(.891,.415),(.861,.369),(.824,.357),(.817,.307),(.796,.273)]}
# The lower right edge of the raised sword was absent from the old polygon
# and reappeared as a second, robe-weighted blade in oblique views.
PROPS['sword']=[(.260,.466),(.321,.464),(.312,.506),(.343,.532),(.348,.654),(.274,.654),(.284,.548),(.268,.553),(.050,.950),(.001,.982),(-.005,.918),(.212,.543),(.167,.538),(.165,.514),(.241,.503)]
BONE_NAMES = ['root','hips','spine','chest','neck','head'] + [
 n+s for s in ('L','R') for n in ('upperArm','forearm','hand','thigh','shin','foot')]
CLOTH_BONES = ['clothL','clothR','clothBack']
BONE_NAMES += CLOTH_BONES
PARENT_NAMES = {'hips':'root','spine':'hips','chest':'spine','neck':'chest','head':'neck'}
PARENT_NAMES.update({name:'hips' for name in CLOTH_BONES})
for s in ('L','R'):
 for name, parent in [('upperArm','chest'),('forearm','upperArm'+s),('hand','forearm'+s),('thigh','hips'),('shin','thigh'+s),('foot','shin'+s)]:
  PARENT_NAMES[name+s]=parent

def profile(mask, mode='all'):
 out=np.full((len(mask),2),np.nan)
 for i,row in enumerate(mask):
  xs=np.flatnonzero(row)
  if len(xs)==0:continue
  if mode=='main':
   intervals=np.split(xs,np.where(np.diff(xs)>1)[0]+1)
   xs=max(intervals,key=len)
  out[i]=[xs[0],xs[-1]]
 iy=np.arange(len(mask));ok=np.isfinite(out[:,0])
 for d in range(2):out[:,d]=np.interp(iy,iy[ok],out[ok,d])
 return ndi.gaussian_filter1d(out,1.05,axis=0).astype('f')

def filled_image(rgb,mask):
 lookup=ndi.distance_transform_edt(~mask,return_distances=False,return_indices=True)
 return rgb[lookup[0],lookup[1]]

def polygon_mask(view,coordinates):
 layer=Image.new('1',(view.w,view.h))
 ImageDraw.Draw(layer).polygon([(round(x*(view.w-1)),round(y*(view.h-1))) for x,y in coordinates],fill=1)
 return np.asarray(layer) & view.mask

def remove_prop(view,cut,bridge=False):
 # Reconstruct hidden cloth from the same horizontal band. Texture patch
 # reflection preserves folded fabric and embroidery instead of stretching an
 # edge pixel over a 20-pixel-wide blade. Empty air around a free tip stays air.
 cut=ndi.binary_dilation(cut,iterations=max(2,round(view.h/280)))
 kept=view.mask & ~cut
 mask=kept | (ndi.binary_closing(kept,iterations=max(3,round(view.h*.027))) & view.mask)
 # A long blade in front of a coat may cover a wider gap than morphological
 # closing can reach. Bridge the hidden cloth between its two visible cut edges
 # above the hem. Keep the free-standing tip and spaces below the hem clear.
 if bridge:
  for y in range(round(view.h*.87)):
   for span in np.split(np.flatnonzero(cut[y]),np.flatnonzero(np.diff(np.flatnonzero(cut[y]))>1)+1):
    if not len(span):continue
    a,b=span[0],span[-1]
    if a>0 and b<view.w-1 and kept[y,max(0,a-5):a].any() and kept[y,b+1:b+6].any():
     mask[y,a:b+1]|=view.mask[y,a:b+1]
 cc,count=ndi.label(mask)
 sizes=np.bincount(cc.ravel())
 keep=(sizes>max(45,round(mask.sum()*.001)))
 keep[0]=False
 mask=keep[cc]
 h,w=view.color.shape[:2]
 resize=lambda a:np.asarray(Image.fromarray(a).resize((w,h),Image.Resampling.NEAREST))
 affected=resize(cut);valid=resize(kept)
 base=view.color.copy()
 for y in np.unique(np.nonzero(affected)[0]):
  xs=np.flatnonzero(affected[y])
  for segment in np.split(xs,np.where(np.diff(xs)>1)[0]+1):
   if len(segment)==0:continue
   l,r=segment[0],segment[-1]
   li=np.flatnonzero(valid[y,:l]);ri=np.flatnonzero(valid[y,r+1:])+r+1
   if not len(li) and not len(ri):continue
   if len(ri):right=base[y,ri[np.minimum(len(ri)-1,r-segment)]].copy()
   if len(li):left=base[y,li[-1-np.minimum(len(li)-1,segment-l)]].copy()
   if not len(li):fill=right
   elif not len(ri):fill=left
   else:
    t=(segment-l+1)/(r-l+2)
    t=t*t*(3-2*t)
    fill=left*(1-t[:,None])+right*t[:,None]
   base[y,segment]=fill
 fullmask=resize(mask)
 return mask,filled_image(base,fullmask),fullmask

class View:
 def __init__(self,folder,role,name):
  f=folder/f'{role}-{name}.png'
  self.img=np.asarray(Image.open(f).convert('RGBA'))
  self.h,self.w=self.img.shape[:2]
  self.mask=self.img[:,:,3]>96
  self.bound=profile(self.mask)
  self.main=profile(self.mask,'main')
  self.raw=self.img[:,:,:3]
  self.color=filled_image(self.raw,self.mask)
  colorfile=folder/f'{role}-{name}-color.png'
  if colorfile.exists():
   rgb=np.asarray(Image.open(colorfile).convert('RGB'))
   if rgb.shape[:2]==self.raw.shape[:2]:self.color=filled_image(rgb,self.mask)
   else:
    hi=Image.fromarray(self.mask).resize((rgb.shape[1],rgb.shape[0]),Image.Resampling.NEAREST)
    self.color=filled_image(rgb,np.asarray(hi))
  dep=folder/f'{role}-{name}-depth.png'
  self.depth=None
  if dep.exists():
   gray=np.asarray(Image.open(dep).convert('L').resize((self.w,self.h)),dtype='f')/255
   self.depth=gray
 def span(self,v):
  row=np.clip(np.rint(v*(self.h-1)).astype(int),0,self.h-1)
  return self.bound[row,:]/(self.w-1)

def world_bones(role,aspect):
 (nx,ny),(px,py),right,left,rf,lf=LANDMARKS[role]
 def xyz(pt,z=0):return np.array([(pt[0]-px)*aspect*HEIGHT,(1-pt[1])*HEIGHT,z],dtype='f')
 out={'root':np.zeros(3,'f'),'hips':xyz((px,py+.075)),'chest':xyz(((nx+px)*.5,ny+.102)),
      'neck':xyz((nx,ny)),'head':xyz((nx,ny-.045))}
 out['spine']=out['hips']*.42+out['chest']*.58
 for s,arm,ank in [('R',right,rf),('L',left,lf)]:
  zvals=[.008,.034,.065]
  if role=='corpse':zvals=[.03,.26,.55]
  elif role=='judge' and s=='R':zvals=[.0,.14,.26]
  elif role=='ward':zvals=[.02,.093,.22]
  elif role=='thunder' and s=='R':zvals=[.008,.104,.19]
  for name,pt,z in zip(['upperArm','forearm','hand'],arm,zvals):out[name+s]=xyz(pt,z)
  toe=xyz(ank,.033);hip=out['hips'].copy();hip[0]+=(1 if s=='L' else -1)*.098
  out['thigh'+s]=hip;out['shin'+s]=hip*.48+toe*.52+[0,0,.035];out['foot'+s]=toe
 for name,offset in zip(CLOTH_BONES,[(.094,-.025,0),(-.094,-.025,0),(0,-.025,-.1)]):
  out[name]=out['hips']+np.asarray(offset,dtype='f')
 return out

class Reconstruction:
 def __init__(self,folder,role,clean_dir=None):
  self.role=role
  self.views={k:View(folder,role,k) for k in VIEWS if (folder/f'{role}-{k}.png').exists()}
  self.front=self.views['front']
  self.aspect=self.front.w/self.front.h
  self.pelvis=LANDMARKS[role][1][0]
  angle=np.radians(BACK_YAW.get(role,180))
  self.back_sin,self.back_cos=np.sin(angle),np.cos(angle)
  self.bones=world_bones(role,self.aspect)
  angle=np.radians(TORSO_YAW[role])
  self.side_sin,self.side_cos=np.sin(angle),np.cos(angle)
  # A profile's outstretched arms and paper streamers can extend well beyond
  # its pelvis. Align its midsagittal plane from the opaque trunk, not its crop.
  self.axes={}
  for key in ('left','right'):
   if key not in self.views:continue
   im=self.views[key]
   section=im.main[int(im.h*.49):int(im.h*.74)]
   self.axes[key]=np.median(section.mean(axis=1))/im.w
  if role in ('sword','judge','black'):
   # The grasp and the entire rigid blade share one physical depth, including
   # when the far hand is occluded by the body in the opposite profile.
   side='L' if role=='black' else 'R'
   wrist=LANDMARKS[role][3 if side=='L' else 2][-1]
   self.bones['hand'+side][2]=self.weapon_depth(wrist[1])
   self.bones['forearm'+side][2]=self.bones['hand'+side][2]*.60
  if role=='white':
   self.bones['handR'][2]=self.staff_depth(.225)
   self.bones['forearmR'][2]=self.bones['handR'][2]*.50
  if role=='corpse':
   for hand,x in [('R',.336),('L',.873)]:
    self.bones['hand'+hand][:]=((x-self.pelvis)*self.aspect*HEIGHT,(1-.258)*HEIGHT,.478)
  self.pr=None
  if role in PROPS:
   self.pr=polygon_mask(self.front,PROPS[role])
   self.pr=ndi.binary_closing(self.pr,iterations=1)
   for name,v in self.views.items():
    cut=self.pr if name=='front' else polygon_mask(v,PROP_CAMERAS[role][name])
    v.body_mask,v.body_color,alpha=remove_prop(v,cut,True)
    v.body_bound=profile(v.body_mask)
    if clean_dir:
     clean_dir.mkdir(parents=True,exist_ok=True)
     out=Image.fromarray(v.body_color);out.putalpha(Image.fromarray(alpha.astype('uint8')*255))
     out.save(clean_dir/f'{role}-{name}-body.png')
  for v in self.views.values():
   if not hasattr(v,'body_mask'):
    v.body_mask,v.body_color,v.body_bound=v.mask,v.color,v.bound
   v.body_main=profile(v.body_mask,'main')
   v.validity=ndi.gaussian_filter(v.body_mask.astype('f'),2)
  self.projections={}
  self.head_rows=json.loads(Path(__file__).with_name('head-regions.json').read_text())[role]
 def profile_v(self,v):
  front,side=PROFILE_ROWS[self.role]
  return np.interp(v,front,side)
 def real_space(self,p):
  p=np.array(p,copy=True,dtype='f')
  p[...,2]=(p[...,2]-p[...,0]*self.side_sin)/self.side_cos
  return p
 def sagittal(self,p):return p[...,0]*self.side_sin+p[...,2]*self.side_cos
 def weapon_depth(self,v):
  depths=[]
  level,left,right=(([.449,.528,.945],[.448,.455,.383],[.528,.542,.616])
                    if self.role=='sword' else ([.356,.471,.991],[.108,.111,.120],[.844,.850,.851]))
  if self.role=='black':
   level,left,right=[.145,.225,.306,.374],[.138,.139,.15,.1],[.849,.856,.858,.902]
  for name,centres in [('left',left),('right',right)]:
   im=self.views[name]
   u=np.interp(v,level,centres)
   depths.append((u-self.axes[name])*(im.w/im.h)*HEIGHT*(-1 if name=='left' else 1))
  return .5*(depths[0]+depths[1])
 def weapon_side_uv(self,key,points):
  if self.role=='white':return self.staff_side_uv(key,points)
  uv=self.project(key,points);y=1-points[:,1]/HEIGHT
  if self.role=='sword':
   front=[.46,.53,.65,.97];view=[.551,.625,.752,.97]
  elif self.role=='judge':
   front=[.355,.45,.67,.99];view=[.40,.52,.73,.99]
  else:
   front=[.137,.205,.305,.37];view=[.197,.257,.355,.405]
  uv[:,1]=np.interp(y,front,view)
  return uv
 def staff_depth(self,v):
  front_y=[0,.23,.60,.99];side_x={'left':[.263,.259,.262,.27],'right':[.742,.743,.742,.744]}
  z=[]
  for key,shaft in side_x.items():
   im=self.views[key];u=np.interp(v,front_y,shaft)
   z.append((u-self.axes[key])*(im.w/im.h)*HEIGHT*(-1 if key=='left' else 1))
  return (z[0]+z[1])*.5
 def staff_side_uv(self,key,p):
  uv=self.project(key,p)
  uv[:,1]=np.interp(1-p[:,1]/HEIGHT,[0,.225,.47,.99,1],[.015,.307,.56,.99,1])
  return uv
 def staff_side_distance(self,v,z):
  ds=[]
  for key in ('left','right'):
   im=self.views[key];mask=polygon_mask(im,PROP_CAMERAS['white'][key])
   # Remove the fingers from the shaft's silhouette at the grip. Their pixels
   # are still available to the body. The upper crest has its own full width.
   r=np.arange(im.h)[:,None]/(im.h-1);x=np.arange(im.w)[None,:]/(im.w-1)
   shaft=(.260 if key=='left' else .742)
   mask &= (r<.56)|(np.abs(x-shaft)<.030)
   dist=(ndi.distance_transform_edt(mask)-ndi.distance_transform_edt(~mask))*HEIGHT/im.h
   vv=np.interp(v,[0,.225,.47,.99,1],[.015,.307,.56,.99,1])
   u=self.axes[key]+z/(HEIGHT*im.w/im.h)*(-1 if key=='left' else 1)
   yy,xx=np.broadcast_arrays(vv[:,None]*(im.h-1),u[None,:]*(im.w-1))
   ds.append(ndi.map_coordinates(dist,[yy,xx],order=1,mode='nearest'))
  # Preserve distinct ribbons with the better observed lateral boundary, then
  # round their cross-sections with the frontal signed distance field.
  return np.maximum(ds[0],ds[1])
 def view_row(self,key,v):
  return self.views[key].span(v)
 def world_to_front(self,p):return np.column_stack([p[:,0]/(HEIGHT*self.aspect)+self.pelvis,1-p[:,1]/HEIGHT])
 def project(self,key,p):
  f=self.world_to_front(p)
  if key=='front':return f
  if key=='back':
   im=self.views[key]
   h=(.06,.24,.45,.73,.96);neck,hips,_,_,rf,lf=LANDMARKS[self.role]
   feet=(rf[0]+lf[0])*.5
   front_spine=(neck[0],neck[0]*.40+hips[0]*.60,hips[0],hips[0]*.45+feet*.55,feet)
   # A monotone cubic tracks anatomical centres without kinks at landmarks.
   from scipy.interpolate import PchipInterpolator
   fv=np.clip(f[:,1],h[0],h[-1])
   scale=self.aspect/(im.w/im.h)
   if not hasattr(self,'back_curve'):
    self.back_curve=PchipInterpolator(h,np.array(BACK_SPINES[self.role])-np.array(front_spine)*scale*self.back_cos)
   x=self.back_curve(fv)+f[:,0]*scale*self.back_cos-p[:,2]*self.back_sin/(HEIGHT*im.w/im.h)
   return np.column_stack([x,f[:,1]])
  im=self.views[key]
  x=self.axes[key]+self.sagittal(p)/(HEIGHT*im.w/im.h)*(-1 if key=='left' else 1)
  return np.column_stack([x,self.profile_v(f[:,1])])
 def plane(self,key,p):
  if key=='front':h=p[:,0];dep=p[:,2]
  elif key=='back':
   h=p[:,0]*self.back_cos-p[:,2]*self.back_sin
   dep=p[:,0]*self.back_sin+p[:,2]*self.back_cos
  else:
   side=1 if key=='left' else -1
   h=-side*self.sagittal(p);dep=side*(p[:,0]*self.side_cos-p[:,2]*self.side_sin)
  return h/HEIGHT+.5,1-p[:,1]/HEIGHT,dep
 def prepare_projections(self,p,f):
  # Build orthographic visibility maps from the body in the actual bind pose.
  # Register source intervals against the observed spans of that mesh, including
  # the nose and boots, rather than treating the entire flank as one constant slab.
  N=420
  tri=p[f]
  cloud=[p[np.unique(f)]]
  for i in range(8):
   for j in range(8-i):
    u=(i+.33)/8;v=(j+.33)/8
    cloud.append(tri[:,0]*(1-u-v)+tri[:,1]*u+tri[:,2]*v)
  cloud=np.concatenate(cloud)
  for key,view in self.views.items():
   u,v,d=self.plane(key,cloud)
   col=np.clip(np.rint(u*(N-1)).astype('i'),0,N-1);row=np.clip(np.rint(v*(N-1)).astype('i'),0,N-1)
   zbuffer=np.full((N,N),-100,dtype='f');np.maximum.at(zbuffer,(row,col),d)
   zbuffer=ndi.maximum_filter(zbuffer,size=3)
   occupancy=zbuffer>-20
   zbuffer=filled_image(zbuffer,occupancy)
   self.projections[key]={'depth':zbuffer}
 def visibility(self,key,points):
  h,y,d=self.plane(key,points);zmap=self.projections[key]['depth'];N=len(zmap)
  near=ndi.map_coordinates(zmap,[y*(N-1),h*(N-1)],order=1,mode='nearest')
  return np.exp(-np.maximum(near-d-.012,0)/.032)
 def sample(self,im,uv):
  # Bilinear sampling for photo and line-art fidelity, including grazing camera angles.
  h,w=im.shape[:2];x=np.clip(uv[:,0]*(w-1),0,w-1.001);y=np.clip(uv[:,1]*(h-1),0,h-1.001)
  ix,iy=x.astype('i'),y.astype('i');fx=(x-ix)[:,None];fy=(y-iy)[:,None]
  return ((im[iy,ix]*(1-fx)+im[iy,ix+1]*fx)*(1-fy)+(im[iy+1,ix]*(1-fx)+im[iy+1,ix+1]*fx)*fy)
 def body_field(self,small,u,v,cm):
  """Intersect the four registered silhouette cones in the oblique camera basis.

  Frontal and sagittal sections both contribute *all* intervals. A gap between
  the elbow and coat, the edge of a nose, or a trailing ribbon no longer becomes
  the fore/aft thickness of an entire scanline. The perpendicular depth maps
  decide which lateral patches can reach the near sleeve/front of a leg.
  """
  h,w=small.shape
  rows=self.profile_v(v[:,0])
  lo=[];hi=[]
  for key,sgn in [('left',-1),('right',1)]:
   im=self.views[key];sc=HEIGHT*im.w/im.h
   body=np.sort((im.body_bound/(im.w-1)-self.axes[key])*sc*sgn,axis=1)
   lo.append(body[:,0].min());hi.append(body[:,1].max())
  z=np.arange(np.floor(min(lo)/cm)-4,np.ceil(max(hi)/cm)+5,dtype='f')*cm
  sides=[];depths=[]
  for key,sgn in [('left',-1),('right',1)]:
   im=self.views[key]
   coords=self.axes[key]+sgn*z/(HEIGHT*im.w/im.h)
   yy,xx=np.broadcast_arrays(rows[:,None]*(im.h-1),coords[None,:]*(im.w-1))
   mask=ndi.map_coordinates(im.body_mask.astype('f'),[yy,xx],order=1,mode='constant')>.45
   mask[(v[:,0]<0)|(v[:,0]>1)]=False
   if im.depth is None:depths.append(np.ones_like(mask,'f'))
   else:
    gray=ndi.map_coordinates(im.depth,[yy,xx],order=1,mode='nearest')
    depths.append(gray)
   sides.append(mask)
  # Two painters observe different amounts of the far arm, hair and hems.
  # Keep the common core and the thin one-sided outlines, without copying big
  # displacements from one pose into both halves of the reconstructed torso.
  side_dist=[ndi.distance_transform_edt(a)-ndi.distance_transform_edt(~a) for a in sides]
  common=(side_dist[0]+side_dist[1])*.5
  lateral=np.maximum(common,np.maximum(*side_dist)-2.0)
  side=lateral>0
  fd=ndi.distance_transform_edt(small)-ndi.distance_transform_edt(~small)
  def section(mask,distance):
   # Normalise each surface against its own local medial axis rather than a
   # row width. The old row rescale embossed horizontal rings into long robes.
   medial=ndi.maximum_filter(np.maximum(distance,0),size=(19,51))
   medial=ndi.gaussian_filter(medial,(5,4))
   return np.clip(distance/np.maximum(medial,2),0,1),medial
  fx,fr=section(small,fd);sz,sr=section(side,lateral)
  # Rounded intersection. Original silhouettes remain constraints at each
  # camera; the free diagonals interpolate continuously around the hull.
  xwall=(1-fx)**2;zwall=(1-sz)**2
  radius=np.minimum(fr[:,:,None],sr[:,None,:])
  field=(1-xwall[:,:,None]-zwall[:,None,:])*np.maximum(radius*.63,1)
  field=np.minimum(field,np.minimum(fd[:,:,None],lateral[:,None,:]))
  x=(u-self.pelvis)*self.aspect*HEIGHT
  y=(1-v)*HEIGHT
  # The interior of a high or low hat should occupy its own symmetric
  # cross-section. For the torso/sleeve and skirt, a side camera sees the
  # outer arm in front of cloth further across the figure; opposing depth
  # observations carve that ordering into the oblique volume.
  fa=profile(small,'all')
  xb=(u[0,1]-u[0,0])*self.aspect*HEIGHT
  row_mid=ndi.gaussian_filter1d((fa[:,0]+fa[:,1])*.5,7)
  midx=x[0,0]+row_mid*xb
  half=np.maximum(.045,ndi.gaussian_filter1d((fa[:,1]-fa[:,0])*.5,6)*xb)
  for index,direction in enumerate([1,-1]):
   depth=depths[index]
   observed=sides[index]
   if not observed.any():continue
   typical=ndi.percentile_filter(depth,90,size=(11,31))
   low,high=np.percentile(depth[observed],[8,95])
   # Relative relief is camera dependent. Calibrate depth globally, then
   # re-centre on visible material in each neighbourhood, not every raster row.
   strength=np.clip(.72*(depth-low)/max(.001,high-low)+.28*(1+3*(depth-typical)),0,1)
   strength=ndi.gaussian_filter(strength,(1.3,1.2))
   allowed=half[:,None]*(.44+.78*strength)
   # Slender one-sided projections (a lion's mane or a paper ribbon) ought
   # not to acquire the entire width of a chest, yet should retain a core.
   margin=np.maximum(.015,half[:,None]*.10)
   wall=(allowed[:,None,:]+margin[:,None,:]-direction*(x-midx[:,None])[:,:,None])/cm
   apply=np.clip((v-.16)/.08,0,1)*np.clip((1.0-v)/.075,0,1)
   field=np.minimum(field,wall+45*(1-apply[:,:,None]))
  # Sculpt the relief within each visible surface in the XY image as well.
  # Preserve the silhouettes while separating neighbouring sleeves, folds,
  # and the wings of a hat that project across the same plane.
  zcore=profile(side,'main')
  zmid=ndi.gaussian_filter1d((zcore[:,0]+zcore[:,1])*.5,7)*cm+z[0]
  zrad=np.maximum(.045,ndi.gaussian_filter1d((zcore[:,1]-zcore[:,0])*.5,7)*cm)
  for key,sgn in [('front',1),('back',-1)]:
   im=self.views[key]
   if im.depth is None:continue
   points=np.stack([x.ravel(),y.ravel(),np.zeros(x.size)],axis=1)
   uv=self.project(key,self.real_space(points))
   grey=ndi.map_coordinates(im.depth,[uv[:,1]*(im.h-1),uv[:,0]*(im.w-1)],order=1,mode='nearest').reshape(h,w)
   blur=ndi.gaussian_filter(grey,(11,10))
   build=np.clip((grey-blur)*.38+(grey-ndi.gaussian_filter(grey,2.2))*.075,-.075,.095)
   # Add only concavities well inside the silhouette, in real metres.
   notch=np.maximum(0,-build)*np.clip(fd/8,0,1)
   plane=zrad[:,None]+.028-notch
   limit=(plane[:,:,None]-sgn*(z[None,None,:]-zmid[:,None,None]))/cm
   # Preserve the arms reaching beyond the torso and trailing ribbons.
   support=(self.bones['handR'][2] if key=='front' else 0)
   if key=='front':
    for side_name in ('L','R'):
     wrist=self.bones['hand'+side_name];near=((x-wrist[0])/.105)**2+((y-wrist[1])/.16)**2
     limit+=np.exp(-near)[:,:,None]*max(.07,wrist[2])/cm
   field=np.minimum(field,np.maximum(limit,field*.55-2.2))
  # Keep rigid object contacts in the hand, but clear their actual blades
  # from the body plate. The opposite-side arm may naturally hide the sword.
  if self.role in ('judge','sword','white','black'):
   src=self.front
   xx=np.clip(np.rint(u*(src.w-1)).astype(int),0,src.w-1)
   yy=np.clip(np.rint(v*(src.h-1)).astype(int),0,src.h-1)
   silhouette=self.pr[yy,xx]
   clearance=ndi.distance_transform_edt(~silhouette)*cm
   if self.role=='white':shaft=self.staff_depth(v[:,0])
   else:shaft=self.weapon_depth(v[:,0])
   front=(shaft[:,None]-.008+clearance*1.4)
   field=np.minimum(field,(front[:,:,None]-z[None,None,:])/cm)
  if self.role=='corpse':
   cuff=np.clip((v-.247)/.026,0,1)*np.clip((.374-v)/.025,0,1)
   limit=.478+(1-cuff)*.7
   field=np.minimum(field,(limit[:,:,None]-z[None,None,:])/cm)
  if self.role=='ward':field=carried_relic.carve_pack(self,field,u,v,z,cm,HEIGHT)
  return cut_neck(self,np.asarray(field,'f'),u,v,z,cm,HEIGHT,polygon_mask),z
 def head_region(self,points):
  weights=[]
  for key in ('front','left','right'):
   uv=self.project(key,points);levels,lower,upper=np.array(self.head_rows[key]).T
   x,y=uv.T
   border=np.minimum(x-np.interp(y,levels,lower),np.interp(y,levels,upper)-x)
   # The rows describe the skull itself. Let the outline soften only over
   # two to three source texels to keep a thin cap cord or a staff separate.
   keep=np.clip(.5+border/.014,0,1)*np.clip(.5+(levels[-1]-y)/.012,0,1)
   weights.append(keep)
  return weights[0]*np.maximum(weights[1],weights[2])
 def sleeve_fields(self,field,u,v,cm,z):
  """Separate sleeves at their sewn armholes, retaining a lining at the chest.

  A single depth hull otherwise binds every underarm triangle to both the
  wrist and belt and stretches a sheet across open air during a cast.
  """
  im=self.front;h,w=field.shape[:2]
  yy=np.clip(np.rint(v*(im.h-1)).astype(int),0,im.h-1)
  xx=np.clip(np.rint(u*(im.w-1)).astype(int),0,im.w-1)
  x=(u-self.pelvis)*self.aspect*HEIGHT
  neck=self.bones['neck'];hip=self.bones['hips']
  axis=np.interp(v,[0,.17,.46,1],[neck[0],neck[0],hip[0],hip[0]])
  # Front extent of the undercoat ends early toward the side seam, so
  # a lifted hand beyond the waist has empty air behind it.
  girth={'ward':1.22,'judge':1.27,'corpse':1.05}.get(self.role,1)
  span=np.interp(v,[0,.14,.21,.31,.45,.65,1],[.06,.10,.147,.152,.141,.178,.13])*girth
  rib=np.sqrt(np.clip(1-((x-axis)/span)**2,0,1))
  coat_depth=.120*girth*rib-.04-np.maximum(0,np.abs(x-axis)-span)*3.8
  torso=field.copy()
  sleeves=[]
  for side,outline in zip(('R','L'),SLEEVES[self.role]):
   polygon=polygon_mask(im,np.asarray(outline)*.01)
   area=polygon[yy,xx]
   distance=ndi.distance_transform_edt(area)-ndi.distance_transform_edt(~area)
   shoulder=self.bones['upperArm'+side];wrist=self.bones['hand'+side]
   # Advance the folded hands and cuffs away from the centreline; preserve
   # a round sleeve cross section at the shoulder's descending edge.
   lift=self.role in ('ward','corpse','white','judge')
   depth=coat_depth+(max(.0,wrist[2]-.085)*.48 if lift else 0)
   if self.role=='corpse':
    arm_reach=np.clip((v-.17)/.095,0,1)
    depth=coat_depth*.45+arm_reach*.037
   sag=(z[None,None,:]-depth[:,:,None])/cm
   seam=distance[:,:,None]
   # Smooth intersection between a seam in the front image and the coat
   # support, as it curves around the body in the perpendicular view.
   radius=3.5
   rounding=np.maximum(radius-np.abs(seam-sag),0)**2/(4*radius)
   cut=np.minimum(seam,sag)-rounding
   # Select the measured depth of this arm; a thin front silhouette cannot
   # occupy the whole torso depth. Round the forearm and hand about the line
   # between the actual elbow and wrist instead of extruding their outline.
   grip=self.bones['hand'+side];elbow=self.bones['forearm'+side]
   segments=[]
   for a,b,ra,rb in [(shoulder,elbow,.10,.082),(elbow,grip,.082,.041)]:
    delta=b[:2]-a[:2];t=np.clip(((x-a[0])*delta[0]+((1-v)*HEIGHT-a[1])*delta[1])/(delta@delta+1e-8),0,1)
    error=(x-a[0]-t*delta[0])**2+((1-v)*HEIGHT-a[1]-t*delta[1])**2
    segments.append((error,a[2]+t*(b[2]-a[2]),ra+t*(rb-ra)))
   upper=1/(1+np.exp(np.clip((segments[0][0]-segments[1][0])/.0014,-15,15)))
   armz=upper*segments[0][1]+(1-upper)*segments[1][1]
   radius=upper*segments[0][2]+(1-upper)*segments[1][2]
   drape=np.clip((v-.27)/.14,0,1)*np.clip((np.sqrt(np.minimum(segments[0][0],segments[1][0]))-.059)/.13,0,1)
   armz=ndi.gaussian_filter(armz-drape*.067,(2.5,2))
   # Sleeve cloth hangs around the elbow and forearm, whose physical depth
   # is known. Crossed silhouettes from the other sleeve and the waist
   # introduce false horizontal folds if allowed to dictate this section.
   valid=area & im.body_mask[yy,xx]
   d=ndi.distance_transform_edt(valid)-ndi.distance_transform_edt(~valid)
   medial=ndi.gaussian_filter(ndi.maximum_filter(np.maximum(d,0),size=(19,21)),2)
   q=np.clip(np.maximum(d,0)/np.maximum(2,medial),0,1)
   ellipse=np.sqrt(q*(2-q))
   radius=(radius+.032*drape)*ellipse
   if im.depth is not None:
    detail=im.depth[yy,xx]
    relief=np.clip((ndi.gaussian_filter(detail,1)-ndi.gaussian_filter(detail,(7,4)))*.20,-.012,.012)*ellipse
   else:relief=0
   shell=np.minimum(d[:,:,None],(radius[:,:,None]+np.asarray(relief)[...,None]-np.abs(z[None,None,:]-armz[:,:,None]))/cm)
   # Shoulder cap overlaps the chest, wrist does not drag any trunk faces.
   shoulder_distance=((x-shoulder[0])/.094)**2+(((1-v)*HEIGHT-shoulder[1])/.080)**2
   overlap=.45+2.65*np.exp(-shoulder_distance)
   arm=shell
   # The far hand is hidden by the trunk in one of the two paintings.
   # A visual hull alone ends its sleeve at the ribs and leaves the gripped
   # mace, sword or banner floating ahead of it. Bridge the actual elbow and
   # wrist with closed tapered lofts. Their projection stays inside the
   # original sleeve and skin silhouette, including the fingers at the grip.
   shoulder=self.bones['upperArm'+side]
   layers=[]
   for a,b,r0,r1 in [(shoulder,elbow,.067,.054),(elbow,grip,.059,.028)]:
    step=b-a;length=float(step@step)
    dx=(x-a[0])[:,:,None];dy=((1-v)*HEIGHT-a[1])[:,:,None];dz=z[None,None,:]-a[2]
    f=np.clip((dx*step[0]+dy*step[1]+dz*step[2])/max(length,1e-7),0,1)
    radial=np.sqrt((dx-step[0]*f)**2+(dy-step[1]*f)**2+(dz-step[2]*f)**2)
    layers.append((r0+(r1-r0)*f-radial)/cm)
   front=self.front.mask[yy,xx]
   support=ndi.distance_transform_edt(area & front)-ndi.distance_transform_edt(~(area & front))
   arm=np.maximum(arm,np.minimum(np.maximum(*layers),support[:,:,None]))
   # Retain an undercoat only where the rib cage or hip could actually be
   # behind the arm. A detached hand silhouette must never leave a second
   # version attached to the leg after the sleeve moves.
   body_depth=.14*girth*rib+.018
   undercoat=np.minimum((span-np.abs(x-axis))[:,:,None],body_depth[:,:,None]-np.abs(z[None,None,:]+.015))/cm
   boundary=np.maximum(-distance[:,:,None]+overlap[:,:,None],undercoat)
   torso=np.minimum(torso,np.minimum(-cut+overlap[:,:,None],boundary))
   if self.role=='sword' and side=='L':
    arm=np.minimum(arm,((casting_hand.WRIST_V+.003-v)*HEIGHT/cm)[:,:,None])
   sleeves.append((side,arm))
  return [('coat',torso),*sleeves]
 def trouser_legs(self,fields,u,v,cm,z):
  """Tailor the split robe over two complete trouser legs and calf boots."""
  (name,coat),*sleeves=fields
  legs=[]
  # Measured edges of the exposed trousers, above and below the cut of the
  # robe. Each leg continues into the hip behind the overlapping outer cloth.
  outlines={
   'R':[(46,47),(61,49),(64,56),(59,62),(55,68),(51,73),(47,79),(43,82),(40,90),(39,99),(24,100),(25,92),(28,85),(30,80),(33,74),(37,67),(41,58)],
   'L':[(62,47),(75,47),(79,58),(79,67),(78,76),(78,88),(79,91),(93,95),(93,98),(64,98),(62,92),(64,81),(63,72),(62,64)]}
  if self.role=='black':
   outlines={
    'R':[(31,55),(46,56),(44,71),(38,86),(38,93),(36,100),(16,100),(16,96),(19,91),(17,84),(20,73)],
    'L':[(55,55),(69,55),(73,72),(76,86),(75,91),(87,95),(87,99),(56,99),(56,93),(55,83),(53,72)]}
  elif self.role=='white':
   outlines={
    'R':[(48,55),(61,55),(60,72),(58,83),(56,92),(58,100),(47,100),(47,92),(48,83),(46,74)],
    'L':[(62,55),(73,56),(74,72),(71,84),(69,92),(80,96),(80,99),(58,99),(58,93),(59,84),(59,74)]}
  im=self.front;yy=np.clip(np.rint(v*(im.h-1)).astype(int),0,im.h-1)
  xx=np.clip(np.rint(u*(im.w-1)).astype(int),0,im.w-1)
  for side,outline in outlines.items():
   mask=polygon_mask(im,np.asarray(outline)*.01)[yy,xx]&im.body_mask[yy,xx]
   d=ndi.distance_transform_edt(mask)-ndi.distance_transform_edt(~mask)
   # A tucked-in trouser leg has its own round section. The boot toes
   # extend forward from the ankle while the boot shaft narrows above it.
   depth=np.interp(v,[.46,.60,.73,.82,.90,.94,.98,1],[.012,.026,.05,.038,.033,.039,.078,.089])
   radius=np.interp(v,[.46,.58,.71,.80,.87,.92,.97,1],[.08,.105,.09,.066,.052,.055,.115,.11])
   edge=np.sqrt(np.clip((d+.3)/np.maximum(2,radius*.52/cm),0,1))
   leg=np.minimum(d[:,:,None],(radius[:,:,None]*edge[:,:,None]-np.abs(z[None,None,:]-depth[:,:,None]))/cm)
   legs.append(('leg'+side,leg))
   # The back tail covers the overlap behind the upper trousers; lower
   # down the visible pixels belong exclusively to the moving boot.
   if self.role!='sword':continue
   rim=np.interp(v,[0,.57,.65,.72,.78,1],[-.14,-.14,-.088,-.028,.065,.12])
   below=np.interp(v,[0,.58,.67,.78,.85,1],[.86,.86,.77,.72,.73,.73])
   lining=np.minimum((rim[:,:,None]-z[None,None,:])/cm,(below-v)[:,:,None]*HEIGHT/cm)
   opening=np.maximum(-d[:,:,None]+1.5,lining)
   opening=np.maximum(opening,((.56-v)*HEIGHT/cm)[:,:,None])
   coat=np.minimum(coat,opening)
  if self.role=='sword':hem=.849
  elif self.role=='black':
   hem=np.interp(u,[0,.18,.22,.28,.34,.38,.45,.55,.59,.64,.72,.75,.85,1],
                   [.91,.915,.895,.887,.879,.902,.926,.902,.865,.853,.844,.869,.878,.88])
  else:
   hem=np.interp(u,[0,.43,.47,.50,.53,.56,.59,.62,.65,.68,.71,.76,1],
                   [.972,.972,.958,.924,.900,.895,.922,.913,.906,.902,.92,.925,.925])
  coat=np.minimum(coat,((hem-v)*HEIGHT/cm)[:,:,None])
  return [(name,coat),*sleeves,*legs]
 def fair_coat_sections(self,field,u,v,cm,z):
  """Refit a closed hanging coat around a continuous angular cross-section.

  Loose collars, kit and arms have already been separated. Work in physical
  polar coordinates around the spine, leaving the holes between panels open.
  A fold can run the length of the cloth without an artificial shelf at every
  row where different photographic silhouettes happen to cross.
  """
  h,w,d=field.shape
  vals=v[:,0];ax=(u[0]-self.pelvis)*self.aspect*HEIGHT
  xmid=np.interp(vals,[0,.17,.45,.72,1],[self.bones['neck'][0],self.bones['neck'][0],0,0,0])
  smid=np.interp(vals,[0,.19,.40,.69,.90,1],[0,0,-.013,-.036,-.032,0])
  angles=128;phi=np.arange(angles)*2*np.pi/angles
  radii=np.arange(0,.87,.006,dtype='f')
  # Rectangular grid index of each polar sample in the model's oblique basis.
  lateral=np.cos(phi)[:,None]*radii
  sagittal=np.sin(phi)[:,None]*radii
  px=(xmid[:,None,None]+lateral[None,:,:]*self.side_cos+sagittal[None,:,:]*self.side_sin-ax[0])/(ax[1]-ax[0])
  pz=(smid[:,None,None]+sagittal[None,:,:]-z[0])/cm
  samples=np.empty((h,angles,len(radii)),dtype='f')
  for y in range(h):
   samples[y]=ndi.map_coordinates(field[y],[px[y],np.broadcast_to(pz[y],px[y].shape)],order=1,mode='constant',cval=-20)
  occupied=samples>=0;present=occupied.any(axis=2)
  last=len(radii)-1-np.flip(occupied,axis=2).argmax(axis=2)
  radius=radii[last]
  nearest=ndi.distance_transform_edt(~present,return_distances=False,return_indices=True)
  radius=radius[nearest[0],nearest[1]]
  # Keep the broad cut and flare of the original costume. A gentle prior
  # across adjacent heights suppresses the high-frequency horizontal steps.
  vertical=ndi.gaussian_filter(radius,(6.6,.85),mode=('nearest','wrap'))
  broader=ndi.gaussian_filter(radius,(12,2.15),mode=('nearest','wrap'))
  target=vertical*.73+broader*.27
  delta=np.clip(target-radius,-.079,.067)
  # Pleats radiate from the waist and grow in depth toward the free hem.
  # Their slowly changing azimuth gives the robe long folds under sidelight.
  hang=np.clip((vals-.44)/.31,0,1)*np.clip((.955-vals)/.10,0,1)
  phase=phi[None,:]+.12*np.sin(2*phi)[None,:]*(vals[:,None]-.50)+.10*np.sin(6*vals[:,None]+phi[None,:])
  ridges=np.cos(10*phase+.9)-.42*np.cos(20*phase+1.8)+.31*np.cos(7*phase-1.0)
  delta+=.0105*hang[:,None]*ridges
  active=np.clip((vals-.181)/.068,0,1)*np.clip((.96-vals)/.145,0,1)
  # Attenuate at the frontal extremities to preserve the approved hem silhouette.
  active=active[:,None]*(.68+.32*np.abs(np.sin(phi)[None,:])**.65)
  delta=ndi.gaussian_filter(delta*active,(1.2,.65),mode=('nearest','wrap'))
  # The heavy ceremonial robes hide almost all inner seams. Fit a clean,
  # closed outer surface there instead of retaining the spurious secondary
  # cylinder left behind by a raised sleeve in the original visual hull.
  layered=self.role in ('judge','ward','white','corpse','black')
  if layered:
   front_occ=(field>0).any(axis=2)
   silhouette=ndi.distance_transform_edt(front_occ)-ndi.distance_transform_edt(~front_occ)
   smooth=ndi.gaussian_filter(ndi.median_filter(radius,(7,3),mode='nearest'),(9.5,2.),mode=('nearest','wrap'))
   curve=smooth+.011*hang[:,None]*ridges
  out=field.copy()
  axial_x=ax[:,None];axial_z=z[None,:]
  for y in np.flatnonzero(active.max(axis=1)>.006):
   sag=axial_z-smid[y];lat=(axial_x-xmid[y]-sag*self.side_sin)/self.side_cos
   r=np.hypot(lat,sag);theta=(np.arctan2(sag,lat)%(2*np.pi))*angles/(2*np.pi)
   j=theta.astype('i')%angles;j1=(j+1)%angles;a=theta-np.floor(theta)
   change=delta[y,j]*(1-a)+delta[y,j1]*a
   shell=radius[y,j]*(1-a)+radius[y,j1]*a
   # Use a radial warp rather than filling to the outermost surface; a tie
   # or split panel may have a second surface behind it on the same ray.
   t=np.clip((r-shell+.105)/.09,0,1);factor=1-(change*t)/np.maximum(r,.03)
   xx=(xmid[y]+factor*(lat*self.side_cos+sag*self.side_sin)-ax[0])/(ax[1]-ax[0])
   zz=(smid[y]+factor*sag-z[0])/cm
   out[y]=ndi.map_coordinates(field[y],[xx,zz],order=1,mode='constant',cval=-20)
   if layered:
    lo,hi=.245,.855 if self.role in ('black','corpse') else .875
    blend=np.clip((vals[y]-lo)/.082,0,1)*np.clip((hi-vals[y])/.082,0,1)
    # Preserve small frontal windows and silhouette holes at the lower panels.
    rr=curve[y,j]*(1-a)+curve[y,j1]*a;outer=(rr-r)/cm
    obs=silhouette[y,:,None]+.68
    shell=np.minimum(outer,obs)-np.maximum(2.7-abs(outer-obs),0)**2/(4*2.7)
    out[y]=out[y]*(1-blend)+np.clip(shell,-20,20)*blend
  return out
 def fair_garment(self,field,u,v,cm,z):
  """Fair each coat along the hanging grain; preserve its frontal hem.

  A visual hull pairs a fold in one picture with *every* strip of fabric
  at the same height in the opposite picture. This creates implausible
  horizontal shelves. Reform the two depth surfaces over garment-scale
  distances, then restore local textile relief measured by each camera.
  """
  inside=field>0;filled=inside.any(axis=2)
  if not filled.any():return field
  nearest=ndi.distance_transform_edt(~filled,return_distances=False,return_indices=True)
  n=len(z)
  low=inside.argmax(axis=2).astype('f');high=(n-1-np.flip(inside,axis=2).argmax(axis=2)).astype('f')
  mix=np.clip((v-.17)/.065,0,1)*np.clip((.925-v)/.09,0,1)
  x=(u-self.pelvis)*self.aspect*HEIGHT;y=(1-v)*HEIGHT
  points=np.stack([x.ravel(),y.ravel(),np.zeros(x.size)],axis=1)
  def surface(raw,key,direction):
   original=raw[nearest[0],nearest[1]]
   smooth=ndi.gaussian_filter(original,(11.5,3.5),mode='nearest')
   im=self.views[key]
   if im.depth is not None:
    uv=self.project(key,self.real_space(points))
    depth=ndi.map_coordinates(im.depth,[uv[:,1]*(im.h-1),uv[:,0]*(im.w-1)],order=1,mode='nearest').reshape(v.shape)
    depth=depth[nearest[0],nearest[1]]
    local=ndi.gaussian_filter(depth,(1.0,.9))-ndi.gaussian_filter(depth,(8,5))
    smooth+=direction*np.clip(local*.24/cm,-4.2,5.3)
   return original+mix*(smooth-original)*.89
  newlow=surface(low,'back',-1);newhigh=surface(high,'front',1)
  # Remap every interior layer as well (underarm holes and layered panels
  # must remain holes). The front outline has not moved a single pixel.
  source=low[:,:,None]+(np.arange(n,dtype='f')[None,None,:]-newlow[:,:,None])*(
    np.maximum(1,high-low)/np.maximum(1,newhigh-newlow))[:,:,None]
  source=np.clip(source,0,n-1.001);i=source.astype('i');a=source-i
  rebuilt=np.take_along_axis(field,i,axis=2)*(1-a)+np.take_along_axis(field,i+1,axis=2)*a
  result=np.where(filled[:,:,None],rebuilt,field).astype('f')
  return self.fair_coat_sections(result,u,v,cm,z)
 def sculpt(self,prop=False):
  im=self.front;h=VOXELS;w=round(self.aspect*h);pad=5
  mask=im.body_mask if not prop else self.pr
  small=np.asarray(Image.fromarray((mask*255).astype('uint8')).resize((w,h),Image.Resampling.LANCZOS))>95
  small=np.pad(small,pad)
  maskdist=ndi.distance_transform_edt(small)-ndi.distance_transform_edt(~small)
  Y,X=np.indices(small.shape,dtype='f')
  u=(X-pad)/(w-1);v=(Y-pad)/(h-1)
  xpos=(u-self.pelvis)*self.aspect*HEIGHT
  ypos=(1-v)*HEIGHT
  cm=HEIGHT/(h-1)
  if prop:
   # The thin blade and its tassel follow the same wrist into the swing.
   if self.role=='white':center=self.staff_depth(v[:,0])[:,None]
   else:center=self.weapon_depth(v[:,0])[:,None]
   thickness=np.maximum(.0054,np.minimum(.018,(np.maximum(maskdist,0)*cm+.003)*.46))
   if self.role=='black':
    # A round iron head, narrowing to the single wooden grip and paper tags.
    iron=np.interp(v,[0,.13,.15,.19,.25,.29,.32,1],[.012,.019,.049,.052,.038,.015,.009,.009])
    thickness=np.minimum(iron,np.maximum(.005,np.sqrt(np.maximum(maskdist*cm,0)*iron)))
   zd=np.arange(np.floor((center.min()-thickness.max())/cm)-3,np.ceil((center.max()+thickness.max())/cm)+4,dtype='f')*cm
   sdf=np.minimum((thickness[:,:,None]-np.abs(zd[None,None,:]-center[:,:,None]))/cm,maskdist[:,:,None])
  else:
   sdf,zd=self.body_field(small,u,v,cm)
  if prop and self.role=='white':
   shaft=self.staff_depth(v[:,0])[:,None]
   zd=np.arange(np.floor((shaft.min()-.23)/cm)-2,np.ceil((shaft.max()+.32)/cm)+3,dtype='f')*cm
   side=self.staff_side_distance(v[:,0],zd)/cm
   base=maskdist[:,:,None]
   # Rounded four-camera visual hull. Above the grip, fan the projecting
   # strips gradually forward according to their offset from the central rod.
   pole=np.interp(v[:,0],[0,.225,.5,.99],[.264,.276,.322,.398])[:,None]
   offset=np.abs(u-pole)
   depth=(self.staff_depth(v[:,0])[:,None]+offset*.33)
   reach=np.interp(v[:,0],[0,.04,.075,.16,.30,.44,.50,.64,1],[.019,.065,.128,.112,.094,.070,.030,.014,.013])[:,None]
   reach=reach+np.minimum(.035,offset*.15)
   rounding=np.sqrt(np.clip(np.maximum(maskdist,0)/(1.2+2.5*reach/.12),.14,1))
   shell=(reach[:,:,None]*rounding[:,:,None]-np.abs(zd[None,None,:]-depth[:,:,None]))/cm
   observed=np.minimum(np.minimum(base,side[:,None,:]),shell)
   # Two independent paintings can hide different paper strips behind the
   # staff. Preserve each actually observed frontal fibre and the continuous
   # shaft, even where that strip is hidden in both lateral captures.
   backing=(.0105-np.abs(zd[None,None,:]-shaft[:,:,None]))/cm
   sdf=np.maximum(observed,np.minimum(base,backing)).astype('f')
   # Add the forward sleeve, wrist and fingers that wrap around the shaft.
   # In the front painting the forearm is foreshortened to a few pixels, but
   # in profile the long axis of the forearm bridges the gap to the handle.
   def limb(a,b,ra,rb):
    ax,ay,az=(a[0]-self.pelvis)*self.aspect*HEIGHT,(1-a[1])*HEIGHT,a[2]
    bx,by,bz=(b[0]-self.pelvis)*self.aspect*HEIGHT,(1-b[1])*HEIGHT,b[2]
    dx,dy,dz=bx-ax,by-ay,bz-az
    x,y=xpos[:,:,None]-ax,ypos[:,:,None]-ay;zz=zd[None,None,:]-az
    t=np.clip((x*dx+y*dy+zz*dz)/(dx*dx+dy*dy+dz*dz),0,1)
    distance=np.sqrt((x-t*dx)**2+(y-t*dy)**2+(zz-t*dz)**2)
    return (ra+(rb-ra)*t-distance)/cm
   z=float(self.staff_depth(.225))
   for a,b,ra,rb in [
    ((.356,.271,.07),(.316,.248,.20),.034,.032),
    ((.316,.248,.20),(.302,.233,z-.023),.032,.019),
    ((.301,.233,z-.023),(.285,.222,z+.007),.017,.021),
    ((.290,.216,z+.009),(.267,.211,z+.014),.009,.007),
    ((.287,.221,z+.013),(.268,.216,z+.019),.009,.007),
    ((.286,.228,z+.012),(.269,.223,z+.019),.008,.006),
    ((.286,.233,z+.009),(.271,.230,z+.017),.007,.005)]:
    sdf=np.maximum(sdf,limb(a,b,ra,rb))
  fields=[('prop',sdf)] if prop else self.sleeve_fields(sdf,u,v,cm,zd)
  if self.role in ('sword','black','white') and not prop:fields=self.trouser_legs(fields,u,v,cm,zd)
  parts=[]
  for part,subfield in fields:
   if part=='coat':subfield=self.fair_garment(subfield,u,v,cm,zd)
   subfield=ndi.gaussian_filter(subfield.astype('f'),(.44,.50,.50) if not prop else (.22,.22,.22))
   # Dust-sized islands can result where two isolated strands cross in
   # projection. Keep real accessories and all continuous sections.
   components,count=ndi.label(subfield>0)
   if count>1:
    mass=np.bincount(components.ravel());tiny=mass<max(24,round(mass[1:].max()*.00035));tiny[0]=False
    if self.role=='ward' and not prop:
     # The seal master's rolled sleeves cross the coat silhouette five
     # times. Each offcut touches a moving sleeve only in the bind pose.
     tiny[1:]=True;tiny[1+mass[1:].argmax()]=False
    subfield[tiny[components]]=-1
   verts,faces,_,_=marching_cubes(subfield,0,allow_degenerate=False)
   points=np.column_stack([((verts[:,1]-pad)/(w-1)-self.pelvis)*self.aspect*HEIGHT,(1-(verts[:,0]-pad)/(h-1))*HEIGHT,zd[0]+verts[:,2]*cm])
   limit=(3900 if self.role=='white' else 1450) if prop else 12400 if part=='coat' else 2350
   points=np.asarray(points,'f');faces=np.asarray(faces,'i')
   tris=points[faces];signed=np.einsum('ij,ij->i',tris[:,0],np.cross(tris[:,1],tris[:,2])).sum()
   if signed<0:faces=faces[:,[0,2,1]].copy()
   if part=='coat':
    # Reserve more of the simplifier's error budget for lips, lids and the
    # jaw than for a square centimetre of robe. Undo this metric immediately
    # after edge collapse; the visible mesh has the original world scale.
    levels=np.linspace(-.15,HEIGHT+.15,1024);slope=1+1.85*np.clip((levels-HEIGHT*.75)/(.13*HEIGHT),0,1)**2
    distance=np.r_[levels[0],levels[0]+np.cumsum((slope[:-1]+slope[1:])*.5*np.diff(levels))]
    stretch=np.interp(points[:,1],levels,slope)
    points[:,[0,2]]*=stretch[:,None];points[:,1]=np.interp(points[:,1],levels,distance)
    points,faces=reduce_closed_surface(points,faces,limit+800)
    points[:,1]=np.interp(points[:,1],distance,levels)
    points[:,[0,2]]/=np.interp(points[:,1],levels,slope)[:,None]
   else:points,faces=reduce_closed_surface(points,faces,limit)
   if (self.role in ('ward','sword') and part=='coat') or part.startswith('leg'):
    keep=isolated_fragments(points,faces,largest_only=True)
    remap=np.cumsum(keep)-1;faces=remap[faces[keep[faces[:,0]]]];points=points[keep]
   parts.append((part,points,faces))
  return parts
 def claw(self,side):
  # Joint positions are annotated on the original frontal knuckles. Depth is
  # measured in both profile cameras: the wrist leaves the cuff at 48 cm and
  # the tips hang at 62--64 cm. A separate closed loft preserves every digit.
  columns=([.307,.33,.354,.380,.398] if side=='R' else [.852,.873,.9,.920,.93])
  tips=([(.309,.325),(.353,.341),(.392,.346),(.419,.336),(.428,.308)] if side=='R' else
        [(.855,.327),(.925,.337),(.952,.345),(.976,.339),(.992,.327)])
  wx=.336 if side=='R' else .872
  def world(x,y,z):return np.array([(x-self.pelvis)*self.aspect*HEIGHT,(1-y)*HEIGHT,z],dtype='f')
  parts=[]
  def loft(controls,radii):
   from scipy.interpolate import PchipInterpolator
   ts=np.arange(len(controls));t=np.linspace(0,ts[-1],len(ts)*3)
   centers=PchipInterpolator(ts,np.asarray(controls))(t)
   radius=PchipInterpolator(ts,np.asarray(radii))(t)
   tangent=np.gradient(centers,axis=0);tangent/=np.linalg.norm(tangent,axis=1)[:,None]
   uvec=np.cross(tangent,[0,1,0]);uvec/=np.maximum(1e-10,np.linalg.norm(uvec,axis=1)[:,None])
   vvec=np.cross(tangent,uvec)
   a=np.arange(12)*2*np.pi/12
   rings=centers[:,None,:]+uvec[:,None,:]*np.cos(a)[None,:,None]*radius[:,0,None,None]+vvec[:,None,:]*np.sin(a)[None,:,None]*radius[:,1,None,None]
   p=np.concatenate([rings.reshape(-1,3),centers[[0,-1]]]);f=[]
   for i in range(len(t)-1):
    for j in range(12):
     a=i*12+j;b=i*12+(j+1)%12
     f.extend([[a,b,b+12],[a,b+12,a+12]])
   for j in range(12):
    f.extend([[len(p)-2,(j+1)%12,j],[len(p)-1,(len(t)-1)*12+j,(len(t)-1)*12+(j+1)%12]])
   f=np.array(f,'i');tri=p[f]
   if np.sum(tri[:,0]*np.cross(tri[:,1],tri[:,2]))<0:f=f[:,[0,2,1]]
   parts.append((p.astype('f'),f))
  loft([world(wx-.011,.247,.280),world(wx-.005,.248,.386),world(wx,.253,.449),world(wx,.259,.488),world(wx+.009,.272,.533),world(wx+.023,.286,.559)],
       [(.016,.010),(.022,.012),(.022,.013),(.025,.015),(.029,.016),(.028,.010)])
  for i,(knuckle,(tx,ty)) in enumerate(zip(columns,tips)):
   ztop=.547+.004*(2-abs(i-2))
   ztip=.633+.007*(2-abs(i-2))-(.019 if i==4 else 0)
   loft([world(knuckle,.280,ztop),world(knuckle+(tx-knuckle)*.42,.294,ztop+.036),
         world(knuckle+(tx-knuckle)*.80,ty-.015,ztip-.014),world(tx,ty,ztip)],
        [(.0095,.011),(.0095,.009),(.006,.006),(.0015,.0014)])
  points=[];faces=[];offset=0
  for p,f in parts:points.append(p);faces.append(f+offset);offset+=len(p)
  return np.concatenate(points),np.concatenate(faces)
 def skin(self,points,part):
  if part=='prop':
   j=np.zeros((len(points),4),'u2');j[:,0]=BONE_NAMES.index('handL' if self.role=='black' else 'handR');w=np.zeros_like(j,'f');w[:,0]=1
   return j,w
  if part.startswith('leg'):
   side=part[-1];v=1-points[:,1]/HEIGHT
   knee=1-self.bones['shin'+side][1]/HEIGHT;ankle=1-self.bones['foot'+side][1]/HEIGHT
   def hinge(v,a,b):
    t=np.clip((v-a)/(b-a),0,1);return t*t*(3-2*t)
   shin=hinge(v,knee-.054,knee+.060);foot=hinge(v,ankle-.061,ankle-.002)
   j=np.broadcast_to([BONE_NAMES.index(n+side) for n in ('thigh','shin','foot')]+[0],(len(points),4))
   hips=1-hinge(v,.46,.65)
   j=j.copy();j[:,-1]=BONE_NAMES.index('hips')
   w=np.column_stack([(1-shin)*(1-hips),shin*(1-foot),shin*foot,(1-shin)*hips])
   return j.astype('u2'),w.astype('f')
  children={'hips':'spine','spine':'chest','chest':'neck','neck':'head'}
  for s in ('L','R'):
   children.update({'upperArm'+s:'forearm'+s,'forearm'+s:'hand'+s,'thigh'+s:'shin'+s,'shin'+s:'foot'+s})
  distances=[]
  for bone in BONE_NAMES:
   arm=bone.startswith(('upperArm','forearm','hand'))
   if (bone in CLOTH_BONES or (part=='coat' and self.role in ('sword','black','white') and bone.startswith(('shin','foot')))
       or (part=='coat' and arm)
       or (part in ('L','R') and not ((arm and bone.endswith(part)) or bone=='chest'))):
    distances.append(np.full(len(points),1e4));continue
   start=self.bones[bone].copy()
   if bone=='root':distances.append(np.full(len(points),1e4));continue
   if bone=='head':end=start+[.015,1.8-start[1]+.03,0];pad=.069
   elif bone.startswith('foot'):end=start+[0,-.025,.103];pad=.048
   elif bone.startswith('hand'):end=start+[0,-.061,.035];pad=.044
   else:end=self.bones[children[bone]].copy();pad=.098 if bone in ('hips','spine','chest') else .053
   direction=end-start;u=np.clip(((points-start)@direction)/(direction@direction+.000001),.13,.88)
   closest=start+u[:,None]*direction
   # Z weights distinguish the folded forearms from the robe in the ward
   # master's forward prayer pose.
   d=np.sum(((points-closest)*np.array([1,1,.62]))**2,axis=1)**.5
   if part in ('L','R') and bone=='chest':
    shoulder=self.bones['upperArm'+part]
    d=np.linalg.norm(points-shoulder,axis=1)*1.7+.012
   distances.append(np.maximum(0,d-pad*.64))
  ds=np.stack(distances,axis=1);j=np.argsort(ds,axis=1)[:,:4]
  d=np.take_along_axis(ds,j,axis=1);w=np.exp(-(d-d[:,:1])/.040);w/=w.sum(axis=1,keepdims=True)
  if part in ('L','R'):return j.astype('u2'),w.astype('f')
  # The cloth is attached at the belt and gains freedom toward the hem.
  # Preserve gait at skin/boot heights and on narrow, low-hanging weapons.
  v=1-points[:,1]/HEIGHT
  hems={'sword':(.79,.89),'corpse':(.84,.93),'judge':(.87,.955),'white':(.90,.978)}
  hem,boot=hems.get(self.role,(.84,.94))
  mix=np.clip((v-.48)/.30,0,1)*np.clip((boot-v)/(boot-hem),0,1)
  relative=points-self.bones['hips']
  rear=np.clip((-relative[:,2]-.035)/.105,0,1)
  left=np.clip(.5+relative[:,0]/.17,0,1)
  if self.role in ('sword','black','white'):mix=np.clip((v-.47)/.25,0,1)*1.31
  cloth=np.column_stack([(1-rear)*left,(1-rear)*(1-left),rear])*(.64*mix[:,None])
  allw=np.column_stack([w*(1-cloth.sum(axis=1,keepdims=True)),cloth])
  allj=np.column_stack([j,np.broadcast_to([BONE_NAMES.index(b) for b in CLOTH_BONES],cloth.shape)])
  order=np.argsort(-allw,axis=1)[:,:4]
  w=np.take_along_axis(allw,order,axis=1);w/=w.sum(axis=1,keepdims=True)
  return np.take_along_axis(allj,order,axis=1).astype('u2'),w.astype('f')
 def colors(self,points,normals,prop):
  if prop:
   front=self.sample(self.front.color,self.project('front',points))
   normal_side=normals[:,0]*self.side_cos-normals[:,2]*self.side_sin
   flank=np.where(normal_side>=0,'left','right')
   sided=front.copy()
   for key in ('left','right'):
    take=flank==key
    if not take.any():continue
    im=self.views[key]
    uv=self.project(key,points[take]) if self.role=='corpse' else self.weapon_side_uv(key,points[take])
    pigment=self.sample(im.color,uv)
    if self.role in PROP_CAMERAS:
     if not hasattr(im,'prop_valid'):
      im.prop_valid=ndi.gaussian_filter(polygon_mask(im,PROP_CAMERAS[self.role][key]).astype('f'),1.5)
     seen=ndi.map_coordinates(im.prop_valid,[uv[:,1]*(im.h-1),uv[:,0]*(im.w-1)],order=1,mode='constant')[:,None]
     pigment=front[take]*(1-seen)+pigment*seen
    sided[take]=pigment
   side_weight=np.abs(normal_side)**2/(np.abs(normal_side)**2+np.abs(normals[:,2])**2+.015)
   if self.role=='white':
    # The thin streamer folds need frontal pigment around their bevels. Pure
    # lateral faces carry the side observation, preserving the raised paper
    # crest while keeping the gripping fingers readably flesh-coloured.
    nx=np.abs(normals[:,0]);nz=np.abs(normals[:,2])
    side_weight=np.clip((nx-.65)/.30,0,1)*np.clip((.45-nz)/.35,0,1)
    uv=self.project('front',points)
    grip=np.exp(-((uv[:,0]-.281)/.041)**2-((uv[:,1]-.224)/.016)**2)
    side_weight*=1-grip
   return front*(1-side_weight[:,None])+sided*side_weight[:,None]
  # Minimum overlap occurs at the four three-quarter seams, with a soft cross
  # fade in normalized direction space. The two approved full-length paintings
  # remain authoritative in their respective frontal hemispheres.
  base={};weights={}
  for name,v in self.views.items():
   uv=self.project(name,points)
   inp=v.body_color
   base[name]=self.sample(inp,uv)
   if name=='front':axis=normals[:,2]
   elif name=='back':axis=normals[:,0]*self.back_sin+normals[:,2]*self.back_cos
   else:axis=(normals[:,0]*self.side_cos-normals[:,2]*self.side_sin)*(1 if name=='left' else -1)
   coverage=ndi.map_coordinates(v.validity,[uv[:,1]*(v.h-1),uv[:,0]*(v.w-1)],order=1,mode='constant',cval=0)
   if name=='back':
    # The belt ribbons and lifted hand sometimes move in the alternate
    # painting. On a surface with no corresponding back observation, show the
    # same textile from the approved front, rather than extruding the last
    # valid back pixel horizontally across empty space.
    # When the head turns, uncovered rear scalp still belongs to the hair.
    # The lifted props and back of the belt can borrow the frontal cloth.
    hair=np.clip((.15-uv[:,1])/.026,0,1) if self.role=='sword' else 0
    blend=np.maximum(coverage,hair)[:,None]
    base[name]=base[name]*blend+base['front']*(1-blend)*.91
    coverage=np.ones_like(coverage)
   weights[name]=(np.maximum(0,axis+.10)**3+.00004)*self.visibility(name,points)*(.015+.985*coverage)*(1.45 if name in ('front','back') else 1.0)
  total=np.maximum(.000001,sum(weights.values()))
  return sum(base[k]*weights[k][:,None] for k in weights)/total[:,None]

def reduce_closed_surface(points,faces,target):
 """Maintain a closed, orientable 2-manifold even at very thin accessories."""
 solid_points=np.ascontiguousarray(points,'f')
 solid_faces=np.ascontiguousarray(faces,'u4')
 if len(faces)<=target:return solid_points,solid_faces
 p,f=fast_simplification.simplify(points.astype('d'),faces.astype('i'),target_count=target,agg=5)
 p=np.asarray(p,'f');f=np.asarray(f,'i')
 # Check actual positions, since a triangle mesh can have distinct coincident
 # indices at a residual edge collapse. The standard short-edge reducer works
 # well for garments but can pinch a thin tassel or chain into a four-face edge.
 _,weld=np.unique(p,axis=0,return_inverse=True)
 tri=weld[f];edge=np.sort(np.concatenate([tri[:,[0,1]],tri[:,[1,2]],tri[:,[2,0]]]),axis=1)
 if np.all(np.unique(edge,axis=0,return_counts=True)[1]==2):return p,f
 import manifold3d
 body=manifold3d.Manifold(manifold3d.Mesh(np.ascontiguousarray(p,'f'),np.ascontiguousarray(f,'u4')))
 if body.status()!=manifold3d.Error.NoError:raise ValueError('reduced surface is not closed')
 mesh=body.to_mesh()
 clean=np.array(mesh.vert_properties[:,:3],'f',copy=True);faces=np.asarray(mesh.tri_verts,'i')
 # A closed pair of coincident shells can touch exactly at a coating edge.
 # Separate their independently indexed points by a sub-pixel micron so an
 # importer that welds vertices by position still receives a 2-manifold.
 _,ids,cnt=np.unique(clean,axis=0,return_inverse=True,return_counts=True)
 for group in np.flatnonzero(cnt>1):
  members=np.flatnonzero(ids==group)
  clean[members,0]+=np.arange(len(members))*2e-6
 return clean,faces

def isolated_fragments(points,faces,largest_only=False):
 """Drop crossed-view debris physically separated from every supported shell."""
 from scipy.sparse import csr_matrix
 from scipy.sparse.csgraph import connected_components
 from scipy.spatial import cKDTree
 edges=np.concatenate([faces[:,[0,1]],faces[:,[1,2]],faces[:,[2,0]]])
 graph=csr_matrix((np.ones(len(edges),'u1'),(edges[:,0],edges[:,1])),shape=(len(points),len(points)))
 _,labels=connected_components(graph,directed=False)
 sizes=np.bincount(labels)
 if largest_only:return labels==sizes.argmax()
 major=sizes>=160
 anchors=points[major[labels]]
 if not len(anchors):return np.ones(len(points),bool)
 tree=cKDTree(anchors)
 keep=major.copy()
 for part in np.flatnonzero(~major):
  nearest=tree.query(points[labels==part])[0].min()
  keep[part]=nearest<=.017
 return keep[labels]

def normals_for(p,f):
 tri=p[f];n=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);out=np.zeros_like(p)
 for i in range(3):np.add.at(out,f[:,i],n)
 return out/np.maximum(1e-8,np.linalg.norm(out,axis=1,keepdims=True))

def paint(mesh,geo,role):
 p,f,props,joints,weights,classes=geo
 n=normals_for(p,f)
 unwrap=xatlas.Atlas();unwrap.add_mesh(np.ascontiguousarray(p,'f'),np.ascontiguousarray(f,'u4'),normals=np.ascontiguousarray(n,'f'))
 opts=xatlas.PackOptions();opts.resolution=ATLAS;opts.padding=4
 unwrap.generate(pack_options=opts)
 mapping,faces,uv=unwrap[0]
 p,n,joints,weights,props,classes=p[mapping],n[mapping],joints[mapping],weights[mapping],props[mapping],classes[mapping]
 faces=np.asarray(faces,'i');uv=np.asarray(uv,'f')
 # Rasterize triangle IDs first, then shade the atlas in batches. This avoids
 # per-fragment Python loops and preserves full reference detail at the face.
 pix=uv*(ATLAS-1)
 ids=Image.new('I',(ATLAS,ATLAS),color=-1);draw=ImageDraw.Draw(ids)
 for i,triangle in enumerate(pix[faces].round().astype('i')):
  draw.polygon([tuple(t) for t in triangle],fill=i)
 ids=np.asarray(ids);yy,xx=np.where(ids>=0)
 texture=np.zeros((ATLAS,ATLAS,3),'u1')
 for i in range(0,len(xx),60000):
  x,y=xx[i:i+60000],yy[i:i+60000];ref=faces[ids[y,x]]
  tri=pix[ref];a=tri[:,0];b=tri[:,1]-a;c=tri[:,2]-a;d=np.column_stack([x,y])-a
  denom=b[:,0]*c[:,1]-c[:,0]*b[:,1];denom=np.where(np.abs(denom)<.000001,.000001,denom)
  wb=(d[:,0]*c[:,1]-c[:,0]*d[:,1])/denom;wc=(b[:,0]*d[:,1]-d[:,0]*b[:,1])/denom
  W=np.clip(np.stack([1-wb-wc,wb,wc],axis=1),0,1);W/=np.maximum(1e-8,W.sum(axis=1,keepdims=True))
  pp=np.einsum('ijk,ij->ik',p[ref],W);nn=np.einsum('ijk,ij->ik',n[ref],W);nn/=np.maximum(1e-7,np.linalg.norm(nn,axis=1,keepdims=True))
  flag=props[ref[:,0]];color=np.zeros_like(pp)
  for prop in [True,False]:
   take=flag==prop
   if take.any():color[take]=mesh.colors(pp[take],nn[take],prop)
  if role=='judge':
   # Crown ornaments carry their own brocade on both faces of the thin silk.
   hat=flag & (pp[:,1]>HEIGHT*.86)
   if hat.any():color[hat]=mesh.sample(mesh.front.color,mesh.project('front',pp[hat]))
  hand=classes[ref[:,0]]==10
  if hand.any():color[hand]=casting_hand.pigment(mesh,pp[hand],nn[hand])
  seal=classes[ref[:,0]]==12
  if seal.any():color[seal]=carried_relic.sample_lion(mesh,pp[seal],nn[seal])
  texture[y,x]=np.clip(color,0,255).astype('u1')
 lookup=ndi.distance_transform_edt(ids<0,return_distances=False,return_indices=True);texture=texture[lookup[0],lookup[1]]
 base_image=Image.fromarray(texture)
 projected=[mesh.project(name,p).astype('f') for name in VIEWS]
 if role=='white':
  # Pack profile observations of the rigid banner alongside its portable UV
  # bake. The live material can preserve painted detail through a full turn,
  # including rays that graze a narrow streamer. No extra network request.
  strip=512;h=ATLAS//2;width=ATLAS+strip
  extended=Image.new('RGB',(width,ATLAS));extended.paste(base_image,(0,0))
  uv[:,0]=(uv[:,0]*(ATLAS-1)+.5)/width
  for index,key in enumerate(('left','right')):
   v=mesh.views[key]
   im=Image.fromarray(v.color).resize((strip,h),Image.Resampling.LANCZOS)
   extended.paste(im,(ATLAS,index*h))
   pq=mesh.staff_side_uv(key,p[props])
   projected[2+index][props,0]=(ATLAS+.5+np.clip(pq[:,0],0,1)*(strip-1))/width
   projected[2+index][props,1]=(index*h+.5+np.clip(pq[:,1],0,1)*(h-1))/ATLAS
  base_image=extended
  projected[0][props,0]+=4
 else:projected[0][props,0]+=2
 out=io.BytesIO();base_image.save(out,format='JPEG',quality=93,subsampling=0,optimize=True)
 # Projectors cannot see through the front arm into the chest or through
 # the skirt into the far leg. Keep that bind-space visibility while posing.
 visibility=np.stack([mesh.visibility(k,p) for k in VIEWS],axis=1)
 visibility[props]=0
 head=mesh.head_region(p);head[props]=0
 head[np.isin(classes,[1,2,3,4,5,8])]=1
 head[np.isin(classes,[6,7,9,10,11])]=0
 # A far-side temple may lie behind the nose in the approved three-quarter
 # portrait. Its contralateral analogue is still a point on the fitted face.
 local=(p-mesh.face_origin)@mesh.face_inverse.T;local[:,0]*=-1
 mirror=mesh.project('front',local@np.linalg.inv(mesh.face_inverse).T+mesh.face_origin).astype('f')
 return p,n,uv,joints,weights,faces,out.getvalue(),projected,visibility,head,classes,mirror

class GLB:
 def __init__(self):
  self.data=bytearray();self.views=[];self.accessors=[]
 def view(self,data,target=None):
  while len(self.data)%4:self.data.append(0)
  entry={'buffer':0,'byteOffset':len(self.data),'byteLength':len(data)}
  if target:entry['target']=target
  self.views.append(entry);self.data.extend(data);return len(self.views)-1
 def acc(self,arr,kind,component,target=None,limits=False):
  arr=np.ascontiguousarray(arr)
  a={'bufferView':self.view(arr.tobytes(),target),'componentType':component,'count':len(arr),'type':kind}
  if limits:a.update(min=arr.min(axis=0).tolist(),max=arr.max(axis=0).tolist())
  self.accessors.append(a);return len(self.accessors)-1
 def save(self,path,art,bones,role):
  points,normals,uv,joints,weights,faces,img,projected,visibility,head,classes,mirror=art
  vtx={}
  for name,arr,kind,component in [('POSITION',points,'VEC3',5126),('NORMAL',normals,'VEC3',5126),('TEXCOORD_0',uv,'VEC2',5126),('JOINTS_0',joints,'VEC4',5123),('WEIGHTS_0',weights,'VEC4',5126)]:
   vtx[name]=self.acc(arr,kind,component,34962,name=='POSITION')
  index=self.acc(np.rint(255*head).astype('u1'),'SCALAR',5121,34962)
  self.accessors[index]['normalized']=True;vtx['_CAPTURE_HEAD']=index
  index=self.acc(np.rint(255*visibility).astype('u1'),'VEC4',5121,34962)
  self.accessors[index]['normalized']=True;vtx['_CAPTURE_VISIBILITY']=index
  for index,camera_uv in enumerate(projected,1):
   vtx[f'TEXCOORD_{index}']=self.acc(camera_uv,'VEC2',5126,34962)
  vtx['_SURFACE_CLASS']=self.acc(classes.astype('u1'),'SCALAR',5121,34962)
  vtx['_FACE_MIRROR_UV']=self.acc(mirror,'VEC2',5126,34962)
  idx=self.acc(faces.astype('u2' if len(points)<65536 else 'u4').ravel(),'SCALAR',5123 if len(points)<65536 else 5125,34963)
  nodes=[];matrices=[]
  joint_names=[*BONE_NAMES,*(name for name in bones if name not in BONE_NAMES)]
  parents={**PARENT_NAMES,**{k:v for k,v in casting_hand.parents().items() if k in bones}}
  for name in joint_names:
   parent=parents.get(name)
   pos=bones[name]-(bones[parent] if parent else 0)
   node={'name':name,'translation':pos.tolist()}
   children=[joint_names.index(k) for k,v in parents.items() if v==name]
   if children:node['children']=children
   nodes.append(node);m=np.eye(4,dtype='f');m[:3,3]=-bones[name];matrices.append(m.T.ravel())
  inv=self.acc(np.asarray(matrices,'f'),'MAT4',5126);image=self.view(img)
  nodes.append({'name':role+'-skin','mesh':0,'skin':0})
  j={'asset':{'version':'2.0','generator':'Daofa four-view character reconstruction'},'scene':0,'scenes':[{'nodes':[0,len(nodes)-1],'extras':{'rearCaptureDegrees':BACK_YAW.get(role,180),'sideCaptureDegrees':90+TORSO_YAW[role]}}],
     'nodes':nodes,'skins':[{'name':'Body','inverseBindMatrices':inv,'skeleton':0,'joints':list(range(len(joint_names)))}],
     'meshes':[{'name':role,'primitives':[{'attributes':vtx,'indices':idx,'material':0}]}],
     'materials':[{'name':'Painted silk and skin','pbrMetallicRoughness':{'baseColorTexture':{'index':0},'metallicFactor':0.0,'roughnessFactor':.85}}],
     'textures':[{'sampler':0,'source':0}],'samplers':[{'magFilter':9729,'minFilter':9987,'wrapS':33071,'wrapT':33071}],
     'images':[{'bufferView':image,'mimeType':'image/jpeg'}],'buffers':[{'byteLength':len(self.data)}],
     'bufferViews':self.views,'accessors':self.accessors}
  blob=json.dumps(j,separators=(',',':')).encode();blob+=b' '*(-len(blob)%4);self.data.extend(bytes(-len(self.data)%4))
  result=struct.pack('<4sII',b'glTF',2,28+len(blob)+len(self.data))+struct.pack('<I4s',len(blob),b'JSON')+blob+struct.pack('<I4s',len(self.data),b'BIN\x00')+self.data
  tmp=path.with_suffix('.tmp');tmp.write_bytes(result);tmp.replace(path)

def build(src,dst,role,clean_dir=None):
 print('fit',role,flush=True);m=Reconstruction(src,role,clean_dir);parts=[]
 if role=='sword':casting_hand.fit_wrist(m,HEIGHT)
 for prop in ([False,True] if m.pr is not None else [False]):
  for part,p,f in m.sculpt(prop):
   j,w=m.skin(p,part)
   parts.append((p,f,np.full(len(p),prop),j,w,np.zeros(len(p),'u1')))
 if role=='judge':
  from face_surface import judges_hat_wings
  for p,f in judges_hat_wings(m,HEIGHT):
   indices=np.zeros((len(p),4),'u2');indices[:,0]=BONE_NAMES.index('head')
   weights=np.zeros((len(p),4),'f');weights[:,0]=1
   parts.append((p,f,np.ones(len(p),bool),indices,weights,np.full(len(p),3,'u1')))
 if role=='corpse':
  for side in ('L','R'):
   p,f=m.claw(side);indices=np.zeros((len(p),4),'u2');indices[:,0]=BONE_NAMES.index('hand'+side)
   weights=np.zeros((len(p),4),'f');weights[:,0]=1
   parts.append((p,f,np.ones(len(p),bool),indices,weights,np.zeros(len(p),'u1')))
 if role=='sword':parts.append(casting_hand.anatomy(m,BONE_NAMES))
 if role in ('sword','ward'):
  p,f=carried_relic.scabbard(m,HEIGHT) if role=='sword' else carried_relic.lion(m,HEIGHT,reduce_closed_surface)
  j=np.zeros((len(p),4),'u2');w=np.zeros((len(p),4),'f')
  j[:,0]=BONE_NAMES.index('chest');w[:,0]=1
  parts.append((p,f,np.zeros(len(p),bool),j,w,np.full(len(p),12 if role=='ward' else 0,'u1')))
 for p,f,c in Head(m,HEIGHT,FEATURES[role]).generate():
  j=np.zeros((len(p),4),'u2');w=np.zeros((len(p),4),'f');bone='head'
  if c[0]==6:bone='neck'
  if c[0]==9:bone='handR'
  j[:,0]=BONE_NAMES.index(bone);w[:,0]=1
  if c[0]==6:
   t=np.clip((p[:,1]-(m.bones['neck'][1]-.07))/.10,0,1)
   j[:,1]=BONE_NAMES.index('chest');w[:,0]=t;w[:,1]=1-t
  parts.append((p,f,np.zeros(len(p),bool),j,w,c))
 p,f,flags,j,w,classes=parts[0]
 p=m.real_space(p)
 for b in parts[1:]:
  f=np.concatenate((f,b[1]+len(p)));p=np.concatenate((p,m.real_space(b[0])));flags=np.concatenate((flags,b[2]));j=np.concatenate((j,b[3]));w=np.concatenate((w,b[4]));classes=np.concatenate((classes,b[5]))
 keep=isolated_fragments(p,f)|(classes>0)
 if not keep.all():
  remap=np.cumsum(keep)-1
  f=remap[f[keep[f[:,0]]]]
  p,flags,j,w,classes=p[keep],flags[keep],j[keep],w[keep],classes[keep]
 m.prepare_projections(p,f[~flags[f[:,0]]])
 print('UV',role,len(f),'triangles',flush=True)
 art=paint(m,(p,f,flags,j,w,classes),role);GLB().save(dst/f'{role}.glb',art,{k:m.real_space(v) for k,v in m.bones.items()},role)
 print('saved',role,len(art[0]),(dst/f'{role}.glb').stat().st_size,flush=True)

if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('input',type=Path);parser.add_argument('output',type=Path)
 parser.add_argument('--body-output',type=Path,help='export clean RGBA plates for runtime directional textures')
 parser.add_argument('roles',nargs='*',metavar='ROLE')
 args=parser.parse_args();args.output.mkdir(exist_ok=True,parents=True)
 for role in args.roles or LANDMARKS:
  if role not in LANDMARKS:parser.error(f'unknown role {role}')
  build(args.input,args.output,role,args.body_output)
