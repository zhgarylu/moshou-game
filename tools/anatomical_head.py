"""Closed portrait heads with separately fitted hair, head dress and facial hair."""
from functools import lru_cache
import json
from pathlib import Path

import numpy as np
from scipy.interpolate import PchipInterpolator, CubicSpline

from face_surface import canonical_face_mesh, fit_face

# The two profile paintings expose different portions of tall hair and hats.
# Each ring records height, front centre/halfwidth, left/right centre and actual
# sagittal half-depth in metres. Hat wings, ribbons and hairpins are separate.
CROWNS = {
    'thunder':[(.046,.665,.051,.435,.551,.042),(.037,.669,.061,.446,.552,.047),(.027,.670,.044,.446,.548,.031),(.018,.675,.048,.465,.532,.036),(.006,.673,.037,.461,.539,.029),(.0008,.670,.017,.456,.544,.012)],
    'thunder-guard':[(.049,.376,.052,.435,.551,.042),(.035,.375,.052,.446,.552,.048),(.028,.373,.044,.446,.548,.034),(.019,.374,.045,.465,.532,.037),(.008,.377,.035,.462,.540,.030),(.001,.379,.015,.456,.544,.014)],
    'sword':[(.045,.658,.047,.673,.284,.043),(.034,.650,.050,.698,.255,.052),(.021,.649,.057,.691,.253,.066),(.010,.644,.053,.684,.260,.058),(.001,.638,.026,.677,.268,.030)],
    'ward':[(.035,.486,.033,.546,.454,.029),(.026,.481,.049,.553,.453,.037),(.015,.482,.047,.552,.450,.034),(.006,.489,.034,.546,.448,.030),(.001,.490,.019,.542,.457,.018)],
    'judge':[(.071,.514,.082,.535,.475,.091),(.063,.514,.091,.545,.464,.090),(.053,.518,.082,.552,.454,.077),(.036,.515,.081,.565,.447,.066),(.018,.504,.064,.577,.424,.055),(.002,.496,.049,.588,.412,.045)],
    'black':[(.085,.537,.092,.502,.564,.105),(.074,.538,.091,.506,.565,.099),(.056,.532,.084,.512,.553,.091),(.028,.526,.096,.526,.534,.100),(.002,.521,.092,.546,.519,.102)],
    'white':[(.097,.606,.071,.650,.335,.093),(.090,.617,.067,.658,.327,.082),(.073,.627,.056,.670,.316,.072),(.044,.648,.046,.694,.290,.054),(.020,.666,.034,.709,.269,.043),(.003,.684,.023,.718,.258,.031)],
    'corpse':[(.087,.349,.128,.819,.168,.101),(.080,.351,.135,.824,.174,.110),(.068,.351,.129,.830,.176,.106),(.052,.361,.103,.820,.171,.086),(.031,.370,.087,.819,.167,.070),(.023,.366,.022,.814,.171,.022),(.016,.362,.025,.820,.174,.024),(.008,.362,.022,.826,.173,.020),(.001,.361,.009,.823,.174,.009)],
}
# How much of the neck/collar survives below the new head, with front
# accessories held at the depth at which they are seen in the profile.
COLLARS={'thunder':.153,'thunder-guard':.160,'sword':.146,'ward':.139,
         'judge':.158,'black':.157,'white':.160,'corpse':.149}
PROTECT={
    'thunder':[(.385,.154),(.385,.122),(.409,.109),(.407,.085),(.447,.081),(.475,.124),(.477,.157)],
    'white':[(.22,.17),(.36,.17),(.37,.212),(.23,.218)],
}
MARK_PATH=Path(__file__).with_name('profile-landmarks.json')
SIDE_MARKS=json.loads(MARK_PATH.read_text())


def cut_neck(model, field, u, v, z, cm, height, polygon_mask):
    """Remove the crossed head hull. Keep the actual collar and nearby objects."""
    cutoff=COLLARS[model.role]
    neck=model.bones['neck'][0]/(height*model.aspect)+model.pelvis
    span=.120 if model.role in ('ward','judge') else .082
    roof=cutoff+.013*np.exp(-((u-neck)/span)**2)
    # High at the nape, open over the throat. A rounded intersection follows
    # the folded collar instead of slicing a single plane through a shoulder.
    forward=np.clip((z+.12)/.23,0,1)
    roof3=roof[:,:,None]-.015+.031*forward[None,None,:]
    outside=np.clip((np.abs(u-neck)-span*.86)/.15,0,1)
    roof3+=.011*outside[:,:,None]
    support=(v[:,:,None]-roof3)*height/cm
    if model.role in PROTECT:
        im=model.front
        yy=np.clip(np.rint(v*(im.h-1)).astype(int),0,im.h-1)
        xx=np.clip(np.rint(u*(im.w-1)).astype(int),0,im.w-1)
        from scipy import ndimage as ndi
        mask=polygon_mask(im,PROTECT[model.role])[yy,xx]
        sdf=ndi.distance_transform_edt(mask)-ndi.distance_transform_edt(~mask)
        # Keep the raised palm and staff hand ahead of the collar.
        center,half={'thunder':(.156,.053),'white':(.18,.13)}[model.role]
        section=np.sqrt(np.clip((sdf+.6)/4,0,1))
        item=np.minimum(sdf[:,:,None],(half*section[:,:,None]-abs(z[None,None,:]-center))/cm)
        support=np.maximum(support,item)
    k=3.0
    return np.minimum(field,support)-np.maximum(k-abs(field-support),0)**2/(4*k)


def closed(points,faces):
    points=np.asarray(points,'f');faces=np.asarray(faces,'i');tri=points[faces]
    if np.einsum('ij,ij->i',tri[:,0],np.cross(tri[:,1],tri[:,2])).sum()<0:
        faces=faces[:,[0,2,1]].copy()
    return points,faces


def rings_mesh(rings):
    rings=np.asarray(rings)
    steps,n=rings.shape[:2];p=np.vstack([rings.reshape(-1,3),rings[0].mean(0),rings[-1].mean(0)])
    f=[]
    for i in range(steps-1):
        for j in range(n):
            a=i*n+j;b=i*n+(j+1)%n
            f.extend([(a,b,b+n),(a,b+n,a+n)])
    for j in range(n):
        k=(j+1)%n
        f.extend([(len(p)-2,k,j),(len(p)-1,(steps-1)*n+j,(steps-1)*n+k)])
    return closed(p,f)


@lru_cache(maxsize=1)
def skin_topology():
    p,f=canonical_face_mesh();edges=np.concatenate([f[:,[0,1]],f[:,[1,2]],f[:,[2,0]]])
    _,inverse,n=np.unique(np.sort(edges,axis=1),axis=0,return_inverse=True,return_counts=True)
    boundary=edges[n[inverse]==1]
    chain=dict(boundary);ring=[boundary[0,0]]
    while chain[ring[-1]]!=ring[0]:ring.append(chain[ring[-1]])
    start=p[ring];theta=np.arctan2(start[:,0],(start[:,1]+.6)*.85)
    prev=np.array(ring);points=[p];faces=list(f);n=len(ring)
    # Continue the actual temple, jaw, forehead and zygomatic boundary around
    # the parietal and occipital bones. The face is never cut into horizontal rows.
    for k in range(1,21):
        t=k/21
        lat=theta
        # Five continuous sections run from the mandibular angle and hairline
        # to the occiput. PCHIP avoids a narrowed waist behind the temple.
        radii=PchipInterpolator([0,.15,.34,.55,.75,.91,1],[8.0,8.28,8.36,7.84,6.25,3.94,0])(t)
        up=PchipInterpolator([0,.15,.34,.55,.75,.91,1],[8.35,10.35,11.21,10.92,9.0,5.75,0])(t)
        down=PchipInterpolator([0,.15,.34,.55,.75,.91,1],[9.4,8.65,7.65,6.9,5.8,3.7,0])(t)
        center=1.0*t
        cc=np.cos(lat)
        shape=np.column_stack([np.sin(lat)*radii,center+cc*np.where(cc>=0,up,down),
                               (start[:,2]+2.9)*(1-t)**3-2.9-8.9*np.sin(t*np.pi/2)])
        base=np.column_stack([np.sin(lat)*8,cc*np.where(cc>=0,8.35,9.4),start[:,2]])
        shape[:,:2]+=(start-base)[:,:2]*(1-t)**4
        cur=len(p)+np.arange((k-1)*n,k*n)
        for j in range(n):
            a,b=prev[j],prev[(j+1)%n];c,d=cur[j],cur[(j+1)%n]
            faces.extend([(b,a,c),(b,c,d)])
        points.append(shape);prev=cur
    cap=len(p)+20*n
    for j in range(n):faces.append((prev[(j+1)%n],prev[j],cap))
    points.append([[0,1.4,-11.8]])
    pp,ff=closed(np.vstack(points),faces)
    return pp,ff,len(p)


def ellipsoid(center,radii,orientation=None,detail=34):
    lat=np.linspace(-np.pi/2+.018,np.pi/2-.018,max(12,detail//2))
    theta=np.arange(detail)*2*np.pi/detail
    sphere=np.stack(np.broadcast_arrays(np.cos(lat[:,None])*np.cos(theta),np.sin(lat[:,None]),np.cos(lat[:,None])*np.sin(theta)),axis=2)
    sphere*=radii
    if orientation is not None:sphere=sphere@orientation.T
    return rings_mesh(sphere+center)


def sweep(knots,width,depth,n=12,guide=None):
    """Closed oval tube along a spline, with continuously transported rings."""
    knots=np.asarray(knots);s=np.r_[0,np.cumsum(np.linalg.norm(np.diff(knots,axis=0),axis=1))];s/=s[-1]
    t=np.linspace(0,1,len(knots)*4)
    centers=CubicSpline(s,knots,axis=0,bc_type='natural')(t);tangent=np.gradient(centers,axis=0);tangent/=np.linalg.norm(tangent,axis=1)[:,None]
    seed=np.asarray(guide if guide is not None else [1,0,0],float)
    if abs(seed@tangent[0])>.91:seed=np.array([0,0,1])
    a=seed;axes=[]
    for axis in tangent:
        a=a-axis*(axis@a);a/=max(np.linalg.norm(a),1e-10);axes.append(a)
    axes=np.array(axes);other=np.cross(tangent,axes);theta=np.arange(n)*2*np.pi/n
    w=PchipInterpolator(s,width)(t);d=PchipInterpolator(s,depth)(t)
    return rings_mesh(centers[:,None,:]+(axes*w[:,None])[:,None,:]*np.cos(theta)[None,:,None]+(other*d[:,None])[:,None,:]*np.sin(theta)[None,:,None])


class Head:
    def __init__(self,model,H,marks):
        self.m=model;self.H=H;self.W=H*model.aspect
        side=SIDE_MARKS[model.role]
        depth=self.sag(side[0][1][0],side[1][1][0])
        inv,self.origin,self.scale=fit_face(model,marks,H,self.W,depth)
        self.basis=np.linalg.inv(inv)
        model.face_inverse=inv;model.face_origin=self.origin
        self.parts=[]
        self.skull_delta=np.zeros(3)
        role=self.m.role
        if role in ('sword','ward','thunder','thunder-guard'):
            v,u,rx,left,right,rz=CROWNS[role][0]
            desired=self.m.real_space(self.camera_point(u,v,left,right))
            anchor=np.array([0,8.6,-7.0])
            offset=desired-(anchor@self.basis.T+self.origin)
            self.skull_delta=np.clip(offset,[-.045,-.025,-.085],[.045,.048,.085])

    def sag(self,left,right):
        m=self.m
        return np.mean([(c-m.axes[k])*self.H*m.views[k].w/m.views[k].h*sgn for k,c,sgn in [('left',left,-1),('right',right,1)]])

    def camera_point(self,ux,v,ul,ur):
        return np.array([(ux-self.m.pelvis)*self.W,(1-v)*self.H,self.sag(ul,ur)])

    def world(self,local):
        local=np.asarray(local);a,b,c=np.moveaxis(local,-1,0)
        # The tied scalp may project considerably farther back than the nose
        # fit would suggest. Anchor its occipital volume to the measured bun;
        # anterior features retain their exact approved frontal projection.
        def ease(x):
            t=np.clip(x,0,1);return t*t*(3-2*t)
        swept=ease((4.5-c)/11.2)*ease((b+5.8)/14)
        return local@self.basis.T+self.origin+.45*swept[...,None]*self.skull_delta

    def add_world(self,points,faces,klass):
        p=np.asarray(points).copy()
        p[:,2]=self.m.sagittal(points)
        sem=np.broadcast_to(klass,len(p)).astype('u1')
        self.parts.append((p.astype('f'),np.asarray(faces,'i'),sem))

    def local(self,mesh,klass):
        p,f=mesh;self.add_world(self.world(p),f,klass)

    def append(self,mesh,klass):
        p,f=mesh;self.add_world(self.m.real_space(p),f,klass)

    def skin(self):
        p,f,n=skin_topology();p=p.copy();classes=np.full(len(p),8,'u1');classes[:n]=1
        a,b,c=p.T
        if self.m.role=='ward':
            # A shaved dome reflects skylight continuously from the temporal
            # ridge over the parietal vault. The topknot sits on, rather than
            # replacing, this curved surface.
            above=np.clip((b-3.0)/6.3,0,1)
            p[:,1]+=2.05*above**2*np.exp(-((c+3.75)/4.0)**2-(a/6.0)**2)
            p[:,0]*=1-.082*above**2
        jaw,nose,cheek,brow={
            'sword':(-.06,-.06,.20,.12),'ward':(.12,.17,.43,.65),
            'judge':(.13,.19,.55,.69),'black':(.045,-.03,-.21,.43),
            'white':(-.11,-.12,-.27,-.07),'corpse':(.018,-.06,-.88,.49),
            'thunder':(-.04,-.02,.18,.29),'thunder-guard':(-.04,-.02,.18,.29)}[self.m.role]
        facing=np.clip((c+2.6)/3.5,0,1)
        p[:,0]*=1+jaw*np.exp(-((b+6.0)/3.4)**2)*facing
        p[:,0]*=1+nose*np.exp(-((b+1.5)/1.25)**2-(a/2.1)**2)*facing
        p[:,2]+=cheek*np.exp(-((abs(a)-4.3)/1.9)**2-((b+.8)/1.7)**2)*facing
        p[:,2]+=brow*np.exp(-((abs(a)-3.1)/1.8)**2-((b-3.76)/.75)**2)*facing
        if self.m.role=='corpse':p[:,2]-=.48*np.exp(-((abs(a)-3.05)/1.3)**2-((b-2.3)/.75)**2)*facing
        angle=np.arctan2(p[:,0],p[:,2]+2.4);near=np.cos(angle)
        hairline=-.55+5.1*near+2.9*np.maximum(near,0)**4+.46*np.sin(3*angle+.7)
        if self.m.role=='ward':hairline+=1.6
        if self.m.role in ('white','judge'):hairline-=.48
        mask=np.clip((p[:,1]-hairline)/1.1,0,1)
        from build_actors import normals_for
        normals=normals_for(p,f)
        wiggle=.1*np.sin(angle*16+p[:,1]*.33)+.08*np.sin(angle*9-.45*p[:,1])
        p+=normals*(mask*(.48+wiggle))[:,None]
        classes[mask>.40]=2
        self.local((p,f),classes)
        # The neck follows the angled mandible, then broadens at the collar.
        hi=self.world(np.array([0,-6.1,-4.1]))
        base=self.m.real_space(self.m.bones['neck']);low=base.copy()
        low[1]=(1-COLLARS[self.m.role]-.052)*self.H
        low[2]=.38*hi[2]+.62*low[2]-.012
        axis_x=self.basis[:,0].copy();axis_x[1]=0;axis_x/=np.linalg.norm(axis_x)
        axis_z=np.cross(axis_x,[0,1,0])
        theta=np.arange(46)*2*np.pi/46;co,si=np.cos(theta),np.sin(theta)
        grid=[];thick=1.12 if self.m.role in ('ward','judge') else .94 if self.m.role=='white' else 1.0
        for t in np.linspace(0,1,25):
            center=low*(1-t)+hi*t
            # Sternomastoids join the mastoid processes immediately behind
            # the ear. At the base they flare into the clavicle and trapezius.
            upper_w=min(.052,self.scale*4.80)*thick
            upper_d=min(.049,self.scale*4.65)*thick
            width=upper_w + .066*(1-t)**3 + .004*np.sin(t*np.pi)
            depth=upper_d + .039*(1-t)**3 + .002*np.sin(t*np.pi)
            relief=.0035*np.exp(-((abs(si)-(.42+.39*t))/.15)**2)*np.maximum(0,co)
            side=(width+relief)*si;fore=(depth+relief)*co
            y=center[1]+(1.65*self.scale*(1-co)*t-.011*np.abs(si)*(1-t))
            ring=center+side[:,None]*axis_x+fore[:,None]*axis_z
            ring[:,1]=y;grid.append(ring)
        self.add_world(*rings_mesh(grid),6)
        # The cloth opens in a V at the front and rises over the nape.
        # Build both faces of that turned collar around the actual neck.
        collar=[]
        for t,inner in [(0,False),(.31,False),(.72,False),(1,False),(1,True),(0,True)]:
            breadth=upper_w+(.082*(1-t)**1.7)+(.010 if not inner else .005)
            depth=upper_d+(.060*(1-t)**1.3)+(.011 if not inner else .004)
            low_v=COLLARS[self.m.role]+.058+.018*co
            high_v=COLLARS[self.m.role]-.009+.023*co+.012*np.maximum(0,co)**3
            y=self.H*(1-((1-t)*low_v+t*high_v))
            blend=np.clip((y-low[1])/max(.01,hi[1]-low[1]),0,1)
            centers=low[None,:]*(1-blend[:,None])+hi[None,:]*blend[:,None]
            ring=centers+breadth*si[:,None]*axis_x+depth*co[:,None]*axis_z
            ring[:,1]=y;collar.append(ring)
        g=np.asarray(collar);ss,nn=g.shape[:2];ff=[]
        for i in range(ss):
            for k in range(nn):
                a=i*nn+k;b=i*nn+(k+1)%nn;c=((i+1)%ss)*nn+k;d=((i+1)%ss)*nn+(k+1)%nn
                ff.extend([(a,b,d),(a,d,c)])
        self.add_world(*closed(g.reshape(-1,3),ff),11)
        for s in (-1,1):
            # Shallow pinna with a curved helix and inset bowl; ear has its own
            # side pigment, never an extra eye or nose projected onto the temple.
            yy=np.linspace(-1,1,14);angle=np.arange(28)*2*np.pi/28
            rows=[]
            for t in yy:
                r=np.sqrt(max(.0001,1-t*t));outer=np.cos(angle)
                e=np.column_stack([s*(7.45+r*(.63+.47*outer)-.28*t),np.full(len(angle),.3+2.65*t),-2.8+r*(1.54+.24*t)*np.sin(angle)-.35*t])
                rows.append(e)
            self.local(rings_mesh(rows),5)
            curve=np.array([[7.65,-1.5,-2.3],[8.13,-.5,-1.93],[8.29,1.10,-2.12],[8.03,2.2,-2.97],[7.67,1.25,-3.85],[7.62,.0,-3.96]])
            curve[:,0]*=s
            self.local(sweep(curve,[.06,.21,.25,.23,.19,.05],[.08,.20,.20,.20,.15,.045],8),5)

    def hair(self):
        role=self.m.role
        # An inclined hairline clears the eyes and ears and drops at the nape.
        long=role in ('white','judge','thunder','thunder-guard')
        if role in ('sword','ward','thunder','thunder-guard'):
            v,u,_,left,right,_=CROWNS[role][0]
            root=self.m.real_space(self.camera_point(u,v,left,right))
            root[1]+=.006
            start=self.world(np.array([0,3.8,-4.3]));back=self.world(np.array([0,5.6,-7.5]))
            top=back*.48+root*.52;top[1]+=.005
            wide=.054 if role in ('thunder','thunder-guard') else .056
            # Gather the thick hair into the bun with broad oval sections,
            # progressively tightening only near the pin. The cranium keeps
            # its round dome even where the painting puts the knot well aft.
            if role=='ward':
                scalp=self.m.real_space(self.parts[0][0]);d=np.linalg.norm(scalp-root,axis=1)
                near=scalp[d.argmin()];stem=near*(.50)+root*.50
                self.add_world(*sweep([near+np.array([0,-.008,0]),stem,root],
                                      [.026,.025,.020],[.026,.024,.018],24,self.basis[:,0]),2)
            else:
                self.add_world(*sweep([start,back,top,root],[wide*.82,wide,wide*.74,.021],
                                     [.034,.043,.040,.022],32,self.basis[:,0]),2)
        if role in ('sword','thunder','thunder-guard','white','judge'):
            for s in (-1,1):
                # One swept temple lock per side; a separate tapered strand
                # skirts the cheek and returns toward the ear.
                chain=np.array([[s*3.2,8.6,3.0],[s*6.0,6.25,2.6],[s*7.1,3.5,1.7],[s*7.28,.9,1.63],[s*6.9,-2.45,2.18],[s*6.15,-4.15,2.8]])
                self.local(sweep(chain,[.05,.63,.64,.45,.23,.035],[.04,.48,.40,.27,.15,.025],10),2)
        if role in ('white','judge','thunder','thunder-guard'):
            self.hair_curtain()
        if long or role=='corpse':
            # Locks on the far side of the face extend behind the shoulders.
            n=8 if role not in ('corpse','white') else 6
            for j,theta in enumerate(np.linspace(1.27,5.02,n)):
                sn,cs=np.sin(theta),np.cos(theta)
                length={'judge':19,'white':31,'corpse':15}.get(role,15)
                width=1.10 if role=='white' else 1.55
                off=(.5+.5*np.sin(j*2.32))*.8
                chain=np.array([[7.15*sn,4.35,-2.7+7.2*cs],[7.73*sn,.10,-2.7+8.4*cs],
                                [6.7*sn,-5.8,-4.1+7.4*cs],[6.9*sn,-10.1,-5.4+7.0*cs],
                                [(7.5+off)*sn,-length*(.85+.15*off),-6.4+6.5*cs]])
                self.local(sweep(chain,[.1,width,width*1.15,width*.78,.055],[.08,width*.68,width*.8,.70,.04],10),2)

    def hair_curtain(self):
        role=self.m.role
        extent={'white':.246,'judge':.236,'thunder':.193,'thunder-guard':.201}[role]
        th=np.linspace(.99,2*np.pi-.99,51);sn,cs=np.sin(th),np.cos(th)
        top=self.world(np.stack([7.5*sn,np.full(len(th),3.9),-2.6+8.45*cs],axis=1))
        jaw=self.world(np.stack([7.3*sn,np.full(len(th),-4.9),-3.+7.95*cs],axis=1))
        part=[]
        for t in np.linspace(0,1,26):
            a=np.clip(t/.39,0,1);a=a*a*(3-2*a)
            drape=top*(1-a)+jaw*a
            lower=np.clip((t-.23)/.77,0,1);blend=lower*lower*(3-2*lower)
            floors=self.H*(1-extent)+(.024*np.sin(7*th+.35)+.016*abs(sn))*blend
            end=jaw.copy()
            end[:,0]+=(.018*sn-.039 if role=='white' else .031*sn-.011)
            end[:,2]+=-.033+.018*cs
            end[:,1]=floors
            outer=drape*(1-blend)+end*blend
            outward=self.basis[:,0].copy();outward/=np.linalg.norm(outward)
            forward=self.basis[:,2].copy();forward/=np.linalg.norm(forward)
            normal=sn[:,None]*outward+cs[:,None]*forward
            outer+=normal*(.003+.005*np.sin(th*13+.9*t)*np.sin(t*np.pi))[:,None]
            thick=(.010 if role=='white' else .012)*max(.035,np.sin(np.pi*(.08+.91*t))**.55)
            inner=outer-normal*thick
            part.append(np.vstack([outer,inner[::-1]]))
        self.add_world(*rings_mesh(part),2)

    def crown(self):
        m=self.m;role=m.role;spec=np.array(CROWNS[role]); count=len(spec)
        bare=role in ('sword','ward','thunder','thunder-guard')
        t=np.linspace(0,count-1,4*(count-1)+1);values=PchipInterpolator(np.arange(count),spec,axis=0)(t)
        th=np.arange(52)*2*np.pi/52;rings=[]
        tilt={'judge':(-.17,-.07),'white':(.23,.13),'black':(.06,.10),'corpse':(.26,.30)}.get(role,(.04,-.04))
        v0,u0,_,l0,r0,_=spec[0]
        base=self.m.real_space(self.camera_point(u0,v0,l0,r0))
        seat=self.world(np.array([0,5.25,-3.05]))
        seat_shift=seat-base if not bare else np.zeros(3)
        seat_shift=np.clip(seat_shift,[-.043,-.040,-.083],[.043,.053,.083])
        for v,u,rx,left,right,rz in values:
            center=self.camera_point(u,v,left,right)
            # Fit the head opening to the actual temples. The top follows the
            # characteristic lean seen in the painting independently.
            if not bare:
                t=np.clip(v/v0,0,1);t=t*t*(3-2*t)
                center+=t*np.array([seat_shift[0],seat_shift[1],self.m.sagittal(seat_shift)])
            sx=max(rx*self.W,.002);lrad=np.sqrt(max((sx*.68)**2,sx*sx-(rz*m.side_sin)**2))/m.side_cos
            grain=1+.024*np.sin(9*th+.6)+.012*np.sin(16*th+.3) if bare else 1+.009*np.cos(8*th)
            sag=rz*np.cos(th)*grain;x=lrad*np.sin(th)*m.side_cos+ sag*m.side_sin
            y=tilt[0]*x+tilt[1]*sag
            top_fade=np.clip(v/.032,0,1)
            row=center+np.column_stack([x,y*top_fade,sag])
            if not bare and v>.60*v0:
                actual=self.m.real_space(row);local=(actual-self.origin)@self.m.face_inverse.T
                brow=np.clip((local[:,2]+1.8)/4,0,1)*np.clip((v/v0-.6)/.4,0,1)
                row[:,1]+=brow*np.clip((4.9-local[:,1])*self.scale,0,.044)
            if not bare:
                skull=self.m.real_space(self.parts[0][0])
                for i,vertex in enumerate(row):
                    direction=self.m.real_space(vertex)-self.m.real_space(center);direction=direction[[0,2]]
                    radius=np.linalg.norm(direction);direction/=max(radius,1e-8)
                    slice_=skull[abs(skull[:,1]-vertex[1])<.009]
                    if not len(slice_):continue
                    rel=slice_[:,[0,2]]-self.m.real_space(center)[[0,2]]
                    forward=rel@direction;across=abs(rel[:,0]*direction[1]-rel[:,1]*direction[0])
                    near=(forward>0)&(across<.017)
                    if near.any():
                        extension=np.clip(forward[near].max()+.004-radius,0,.046)
                        row[i,0]+=direction[0]*extension
                        row[i,2]+=(direction[0]*self.m.side_sin+direction[1]*self.m.side_cos)*extension
            rings.append(row)
        if role in ('sword','ward'):
            center=np.mean(np.array(rings),axis=0).mean(axis=0)
            horizontal=CROWNS[role][2][2]*self.W
            vertical=(spec[0,0]-spec[-1,0])*self.H*.54
            sagittal=max(spec[:,5])*.89
            real=self.m.real_space(center)
            knot,faces=ellipsoid(real,[horizontal,vertical,sagittal],detail=48)
            relative=knot-real;unit=relative/np.maximum(1e-8,np.linalg.norm(relative,axis=1,keepdims=True))
            az=np.arctan2(unit[:,0],unit[:,2])
            furrow=.0018*np.sin(9*az+unit[:,1]*6)+.0009*np.sin(17*az+unit[:,1]*9)
            self.add_world(knot+unit*furrow[:,None],faces,2)
        else:self.append(rings_mesh(rings),3)
        if bare:
            # Pins through the tied hair sit in front of or behind the skull
            # on the same axis as their two ends in the turnaround.
            u=spec[1,1];v=spec[1,0];center=self.camera_point(u,v,spec[1,3],spec[1,4]);d=np.array([.054,.008,-.078]) if role=='sword' else np.array([.051,-.005,-.054])
            self.append(sweep([center-d,center-.23*d,center+.55*d,center+d],[.0015,.0036,.003,.001],[.0014,.0035,.003,.001],10),7)

    def beard(self):
        role=self.m.role
        if role not in ('judge','ward','black','thunder','thunder-guard'):return
        long=role=='judge';short=role in ('thunder','thunder-guard','black')
        if not short:
            angular=np.arange(76)*2*np.pi/76;s=np.sin(angular);c=np.cos(angular)
            near=np.maximum(c,0);back=np.maximum(-c,0);side=np.abs(s);levels=[]
            # A single soft beard mass curves under the chin. The curls lie
            # on its surface and taper into individual ends near the hem.
            first=-5.35+3.9*side+1.1*back
            last=(-18.0+6.7*side+5.3*back) if long else (-10.75+5.1*side+3.0*back)
            for t in np.linspace(0,1,28):
                waves=np.sin(angular*12+4.5*t)*(.22 if long else .075)*np.sin(np.pi*t)
                wid=(6.5+.65*np.sin(t*np.pi)-2.85*t**2) if long else (6.65-.45*t-2.35*t**2)
                x=(wid+waves)*s
                y=first*(1-t)+last*t + (.42 if long else .13)*np.sin(angular*11+.3)*t**2
                z=(5.33+1.22*np.sin(np.pi*t)+waves)*near-1.28*back-.48*side + (2.6*t if long else -.80*t)
                levels.append(np.column_stack([x,y,z]))
            self.local(rings_mesh(levels),4)
            if long:
                for i,a in enumerate(np.linspace(-1.44,1.44,11)):
                    sn,cs=np.sin(a),np.cos(a);width=.85
                    chain=[[6.25*sn,-5.6+2.1*abs(sn),5.01*cs],[6.77*sn,-8+2.1*abs(sn),5.89*cs+.69],
                           [6.35*sn+.25*np.sin(i),-11.4+2.9*abs(sn),6.0*cs+1.62],[4.3*sn+.38*np.sin(i*.8),-17.7+5.8*abs(sn)+.55*np.sin(i),5.05*cs+2.58]]
                    self.local(sweep(chain,[.12,width,width*.95,.052],[.10,.66,.62,.03],10),4)
        else:
            self.local(sweep([[0,-7.8,4.55],[0,-8.8,4.70],[.08,-10.0,4.28],[.15,-10.8,4.39]],
                             [1.55,1.45,.68,.055],[.26,.42,.28,.055],14),4)
        for side in (-1,1):
            c=np.array([[.30,-3.25,6.2],[1.0,-3.15,5.82],[2.4,-3.48,5.5],[3.5,-3.7,4.65],[4.25,-4.15,4.28]])
            c[:,0]*=side
            self.local(sweep(c,[.18,.49,.46,.32,.04],[.19,.44,.37,.29,.03],10),4)

    def ornaments(self):
        role=self.m.role
        if role in ('thunder','thunder-guard','ward','black'):
            spec=CROWNS[role]
            c=self.camera_point(spec[0][1],spec[0][0],spec[0][3],spec[0][4])
            direction={'thunder':-.12,'thunder-guard':.20,'ward':-.18,'black':-.22}[role]
            for j in range(2):
                f=1 if j==0 else .70
                path=c+np.array([[0,0,0],[.16*direction,-.028,-.027],[.49*direction,-.075*f,-.078],
                              [.74*direction,-.125*f,-.133],[direction,-.174*f,-.172]])*(1-j*.10)
                path[2:,0]+=.018*j;path[3:,1]+=.033*j
                self.append(sweep(path,[.003,.009,.010,.008,.001],[.0008,.0017,.0015,.0017,.0008],8),7)
        if role=='corpse':
            # Paper charm drapes from the officer's hat in front of the brow
            # and nose. Its actual upper and lower edges appear in both profiles.
            pts=[self.camera_point(u,v,l,r) for u,v,l,r in [(.415,.041,.702,.310),(.433,.060,.694,.318),(.459,.083,.666,.341),(.487,.104,.642,.364)]]
            self.append(sweep(pts,[.018,.019,.019,.018],[.002,.002,.002,.0014],8),7)
        if role=='thunder':
            # The held yellow charm has no corresponding side capture in the
            # guard pose. Give the paper a thin, continuous profile of its own.
            knots=np.array([[(.452-self.m.pelvis)*self.W,(1-.030)*self.H,.176],[(.442-self.m.pelvis)*self.W,(1-.056)*self.H,.173],[(.434-self.m.pelvis)*self.W,(1-.081)*self.H,.166],[(.421-self.m.pelvis)*self.W,(1-.111)*self.H,.157]])
            self.append(sweep(knots,[.013,.015,.014,.012],[.0015,.0015,.0013,.0013],8),9)

    def generate(self):
        self.skin();self.hair();self.crown();self.beard();self.ornaments()
        return self.parts
