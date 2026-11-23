"""Fit the MediaPipe canonical face to a character's measured eye, nose and jaw."""
from functools import lru_cache
from pathlib import Path

import numpy as np
from scipy.optimize import least_squares
from scipy.spatial.transform import Rotation


@lru_cache(maxsize=1)
def canonical_face_mesh():
    """The measured metric face has one outer edge around jaw and forehead."""
    vertices, triangles = [], []
    source = Path(__file__).with_name('face-geometry') / 'canonical_face_model.obj'
    for line in source.read_text().splitlines():
        words = line.split()
        if words and words[0] == 'v':
            vertices.append([float(value) for value in words[1:4]])
        if words and words[0] == 'f':
            triangles.append([int(value.split('/')[0]) - 1 for value in words[1:4]])
    return np.array(vertices), np.array(triangles)


def fit_face(model, marks, height, width, nose_depth):
    p, _ = canonical_face_mesh()
    anchors = np.array([p[1], (p[133]+p[33])*.5, (p[263]+p[362])*.5,
                        (p[13]+p[14])*.5, p[152]])
    target = np.column_stack([[(x-model.pelvis)*width for x,y in marks],[(1-y)*height for x,y in marks]])
    origin = target[0]
    target = target-origin
    eye_height = (target[1,1]+target[2,1])*.5 - target[4,1]
    scale = np.clip(eye_height/12, .0065, .015)
    def basis(params):
        yaw,pitch,roll,size,stretch_y = params
        R = Rotation.from_euler('YXZ',[yaw,pitch,roll]).as_matrix()
        return R @ np.diag([scale*size,scale*size*stretch_y,scale*size])
    def error(params):
        fitted = (anchors-anchors[0])@basis(params).T
        # Anchor the tip exactly; both eyes resolve the yaw and roll that a
        # three-quarter portrait would otherwise bake diagonally into the cheek.
        return np.r_[(100*(fitted[:,:2]-target)).ravel(),(params[3]-1)*.55,(params[4]-1)*.55]
    fitted = least_squares(error,[.55,0,0,1,1],bounds=([-.70,-.52,-.58,.72,.76],[1.1,.52,.58,1.48,1.32]))
    matrix = basis(fitted.x)
    nose_z = (nose_depth-origin[0]*model.side_sin)/model.side_cos
    translate = np.array([origin[0],origin[1],nose_z]) - matrix@anchors[0]
    return np.linalg.inv(matrix), translate, scale*fitted.x[3]


def judges_hat_wings(model, height):
    """Closed, tapered ornaments following the painted crown's sloping band."""
    # Each section records horizontal position and the upper/lower edge in
    # the front plate. The outer edges curve backwards around the crown.
    left = [(0.503,.061,.070),(.452,.059,.069),(.416,.049,.065),
            (.377,.037,.065),(.357,.034,.061),(.347,.037,.054)]
    right = [(.543,.073,.081),(.592,.079,.086),(.622,.078,.091),
             (.646,.075,.095),(.657,.077,.094),(.666,.080,.089)]
    for sections in (left, right):
        rings = []
        for j,(u,top,bottom) in enumerate(sections):
            x = (u-model.pelvis)*height*model.aspect
            center_x = (.524-model.pelvis)*height*model.aspect
            real_z = .002 - (x-center_x)*.74 - .012*(j/(len(sections)-1))**2
            angles = np.arange(8)*np.pi/4
            y = height*(1-.5*(top+bottom)) + height*.5*(bottom-top)*np.cos(angles)
            z = real_z + (.0045+.003*np.sin(np.pi*j/(len(sections)-1)))*np.sin(angles)
            rings.append(np.column_stack([np.full(8,x),y,x*model.side_sin+z*model.side_cos]))
        p = np.vstack(rings)
        faces = []
        for j in range(len(rings)-1):
            for k in range(8):
                a,b = 8*j+k,8*j+(k+1)%8
                faces += [(a,b,b+8),(a,b+8,a+8)]
        last = len(p)-8
        for k in range(1,7):
            faces += [(0,k+1,k),(last,last+k,last+k+1)]
        f = np.array(faces,'i')
        tri = p[f]
        if np.einsum('ij,ij->i',tri[:,0],np.cross(tri[:,1],tri[:,2])).sum()<0:
            f = f[:,[0,2,1]]
        yield p.astype('f'),f
