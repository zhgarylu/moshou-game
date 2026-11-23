"""Fit the lacquer scabbard and the existing carved lion seal onto a carrier."""
from functools import lru_cache
from io import BytesIO
import json
from pathlib import Path
import struct

import numpy as np
from PIL import Image
from anatomical_head import rings_mesh


def scabbard(model,height):
    # The mouth and its brass lip rise above the shoulder seen in the drawing.
    # The lacquered box runs diagonally across the back, beneath the shoulder strap.
    coords=[(.446,.095,.912,.079,.029,.022),(.447,.100,.909,.082,.032,.025),
            (.449,.107,.907,.084,.032,.025),(.451,.110,.902,.090,.028,.021),
            (.510,.171,.860,.121,.028,.021),(.598,.273,.787,.191,.025,.018),
            (.667,.375,.723,.249,.019,.016),(.681,.402,.712,.265,.012,.009)]
    corners=np.array([[-.79,-1],[.79,-1],[1,-.73],[1,.73],[.79,1],[-.79,1],[-1,.73],[-1,-.73]])
    rings=[]
    for u,v,left,right,width,deep in coords:
        sg=np.mean([(value-model.axes[k])*height*model.views[k].w/model.views[k].h*d for k,value,d in [('left',left,-1),('right',right,1)]])
        x=(u-model.pelvis)*model.aspect*height+corners[:,0]*width
        rings.append(np.stack([x,(1-v)*height+corners[:,0]*width*.31,corners[:,1]*deep+sg],axis=1))
    return rings_mesh(rings)


@lru_cache(maxsize=1)
def lion_source():
    path=Path(__file__).resolve().parents[1]/'dist/art/ward-lion-seal.glb'
    b=path.read_bytes();n=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+n]);buf=b[n+28:]
    prim=g['meshes'][0]['primitives'][0]
    def array(key):
        idx=prim['indices'] if key=='ind' else prim['attributes'][key]
        ac=g['accessors'][idx];v=g['bufferViews'][ac['bufferView']]
        typ={5123:'<u2',5125:'<u4',5126:'<f4'}[ac['componentType']]
        return np.frombuffer(buf,dtype=typ,count=ac['count']*(3 if key=='POSITION' else 1),offset=v.get('byteOffset',0))
    raw=array('POSITION').reshape(-1,3);p,remap=np.unique(raw,axis=0,return_inverse=True)
    f=remap[array('ind')].reshape(-1,3)
    image=g['bufferViews'][g['images'][0]['bufferView']];start=image.get('byteOffset',0)
    atlas=np.asarray(Image.open(BytesIO(buf[start:start+image['byteLength']])).convert('RGB'))
    return p,f,np.array(g['scenes'][0]['extras']['captureExtent']),atlas


def lion(model,height,reducer):
    p,f,extent,atlas=lion_source();p,f=reducer(p,f,2700)
    size=np.array([.229,.510,.224]);yaw=np.radians(-148)
    rotation=np.array([[np.cos(yaw),0,np.sin(yaw)],[0,1,0],[-np.sin(yaw),0,np.cos(yaw)]])
    x=(.253-model.pelvis)*model.aspect*height
    sg=np.mean([(value-model.axes[k])*height*model.views[k].w/model.views[k].h*d for k,value,d in [('left',.848,-1),('right',.112,1)]])
    center=model.real_space([x,height*(1-.077)-size[1],sg])
    model.carved_lion=(center,size,rotation,atlas)
    world=(p/extent*size)@rotation.T+center
    world[:,2]=model.sagittal(world)
    return world.astype('f'),f


def carve_pack(model,field,u,v,z,cm,height):
    x=(u-model.pelvis)*model.aspect*height
    # The frontal image already contains the seal. Remove that posterior
    # overlap from the coat before attaching the actual stone geometry.
    rear=(-.080-z)[None,None,:]
    side=(-.134-x)[:,:,None]
    high=((.395-v)*height)[:,:,None]
    clear=np.minimum(np.minimum(rear,side),high)/cm
    return np.minimum(field,-clear)


def sample_lion(model,p,n):
    origin,size,rotation,atlas=model.carved_lion
    local=(p-origin)@rotation/size
    norm=(n@rotation)*size;norm/=np.maximum(1e-12,np.linalg.norm(norm,axis=1,keepdims=True))
    directions=np.stack([norm[:,2],norm[:,0],-norm[:,2],-norm[:,0]],axis=1)
    weights=np.maximum(directions+.06,0)**5+.0001
    color=np.zeros_like(p)
    for i,x in enumerate([local[:,0],-local[:,2],-local[:,0],local[:,2]]):
        u=(i%2+np.clip(.5+x,.001,.999))*.5;v=(i//2+np.clip(1-local[:,1],.001,.999))*.5
        color+=weights[:,i,None]*model.sample(atlas,np.column_stack([u,v]))
    return color/weights.sum(axis=1,keepdims=True)
