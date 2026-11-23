"""A skinned, five-finger left hand fitted inside the swordsman's leather cuff."""
import numpy as np
from skimage.measure import marching_cubes
import fast_simplification


WRIST_V = .459
NAMES = ('Thumb', 'Index', 'Middle', 'Ring', 'Little')


def parents():
    result = {}
    for digit in NAMES:
        knuckle = 'seal' + digit
        result[knuckle] = 'handL'
        result[knuckle + 'Tip'] = knuckle
    return result


def fit_wrist(model, height):
    wrist = model.bones['handL']
    wrist[0] = (.926 - model.pelvis) * model.aspect * height
    wrist[1] = (1 - WRIST_V) * height


def anatomy(model, bone_names):
    # Across the knuckles, along the middle finger, and out through the palm.
    lengthwise = np.array([.19, -.979, -.072])
    lengthwise /= np.linalg.norm(lengthwise)
    across = np.array([.48, 0., -.88])
    across -= (across @ lengthwise) * lengthwise
    across /= np.linalg.norm(across)
    palmar = np.cross(across, lengthwise)
    basis = np.stack([across, lengthwise, palmar])
    wrist = model.real_space(model.bones['handL'])

    def capture_space(local):
        p = np.asarray(local) @ basis + wrist
        p[..., 2] = model.sagittal(p)
        return p.astype('f')

    # MCP, PIP, DIP and fingertip positions. The thumb sits lower on the
    # palm and opposes the other fingers. The fingertips form a shallow arc.
    paths = [
        [(-.022,.020,.004),(-.039,.039,.009),(-.043,.054,.018),(-.042,.065,.025)],
        [(-.022,.060,0),(-.026,.085,.002),(-.027,.106,.008),(-.025,.122,.016)],
        [(-.006,.065,0),(-.006,.095,.004),(-.004,.117,.013),(-.002,.130,.023)],
        [(.011,.063,0),(.014,.090,.006),(.015,.108,.016),(.015,.119,.026)],
        [(.025,.054,0),(.031,.075,.006),(.031,.088,.014),(.029,.098,.023)],
    ]
    radii = np.array([.011, .0084, .0088, .0080, .0069])
    paths = np.asarray(paths)
    model.hand_frame = (wrist, basis, paths, radii)
    lo = np.array([-.059, -.043, -.028])
    step = .0022
    grid = np.moveaxis(np.indices((51, 88, 34), dtype='f'), 0, -1) * step + lo

    def segments(q, path, radius):
        gap = []
        for i, (a, b) in enumerate(zip(path, path[1:])):
            ab = b - a
            t = np.clip(((q-a) @ ab) / (ab @ ab), 0, 1)
            r = radius * (1.06 - .12*(i+t) + .065*np.cos(2*np.pi*t))
            gap.append(np.linalg.norm(q-a-t[...,None]*ab, axis=-1)-r)
        return np.min(gap, axis=0)

    x, y, z = np.moveaxis(grid,-1,0)
    stations = [-.034, -.019, .007, .033, .051, .060, .065, .068]
    width = np.interp(y, stations, [.007,.022,.024,.032,.033,.030,.019,.004])
    depth = np.interp(y, stations, [.006,.014,.015,.017,.016,.012,.008,.003])
    palm = (np.sqrt((x/width)**2 + ((z-.001)/depth)**2) - 1)*depth
    field = np.maximum(palm, np.maximum(-.034-y,y-.068))
    for path, radius in zip(paths,radii):
        digit = segments(grid, path, radius)
        overlap = np.maximum(.004-abs(field-digit),0.)
        field = np.minimum(field,digit)-overlap**2/.016
    p, f, _, _ = marching_cubes(field.astype('f'), level=0, allow_degenerate=False)
    p, f = fast_simplification.simplify(p*step+lo,f,target_count=4300)
    # The scalar field is negative inside. Face winding must agree with the
    # rest of the exported body so individual fingers render from both sides.
    if np.einsum('ij,ij->i',p[f[:,0]],np.cross(p[f[:,1]],p[f[:,2]])).sum() < 0:
        f = f[:,::-1].copy()
    distances = np.stack([segments(p,path,r) for path,r in zip(paths,radii)],axis=1)
    closest = np.argmin(distances,axis=1)
    j = np.zeros((len(p),4),'u2')
    w = np.zeros((len(p),4),'f')
    j[:,0] = bone_names.index('handL')
    order = [*bone_names,*parents()]
    def smooth(t):
        t = np.clip(t,0,1)
        return t*t*(3-2*t)
    for i,(digit,path) in enumerate(zip(NAMES,paths)):
        knuckle = 'seal'+digit
        model.bones[knuckle] = capture_space(path[0])
        model.bones[knuckle+'Tip'] = capture_space(path[1])
        owns = closest == i
        y = p[owns,1]
        proximal = smooth((y-path[0,1]+.005)/.017)
        distal = smooth((y-path[1,1]+.005)/.013)
        j[owns,1] = order.index(knuckle)
        j[owns,2] = order.index(knuckle+'Tip')
        w[owns,0] = 1-proximal
        w[owns,1] = proximal*(1-distal)
        w[owns,2] = proximal*distal
    return capture_space(p), np.asarray(f,'i'), np.zeros(len(p),bool), j,w,np.full(len(p),10,'u1')


def pigment(mesh, points, normals):
    # Borrow skin from the uncovered back of the hand. Stray pixels from the
    # dark bracer at newly separated fingers must never enter the hand atlas.
    uv = mesh.project('front',points)
    sample = mesh.sample(mesh.front.color,uv).astype('f')
    origin = mesh.sample(mesh.front.color,np.array([[.942,.474],[.948,.485],[.925,.469]]))
    base = np.median(origin,axis=0)+[12.,2.,-3.]
    valid = (sample[:,0] > sample[:,1]*1.045) & (sample[:,1]>sample[:,2]*1.025) & (sample[:,0]>base[0]*.59)
    pigment = base + np.clip(sample-base,-38,32)*(.62*valid[:,None])
    wrist,basis,paths,radii = mesh.hand_frame
    q = (points-wrist) @ basis.T
    normal = normals @ basis.T
    dorsal = np.clip(-normal[:,2],0,1)
    pigment *= (.95+.095*normals[:,1:2]+.035*normals[:,0:1]+.065*dorsal[:,None])
    for path,r in zip(paths,radii):
        # Paint a translucent nail onto the dorsal distal phalanx. Its bed
        # follows the fingertip, including its contact shading and pale rim.
        along = path[-1]-path[-2]
        along /= np.linalg.norm(along)
        outward = np.array([0.,0.,-1.])
        outward -= (outward@along)*along
        outward /= np.linalg.norm(outward)
        across = np.cross(along,outward)
        d = q-(path[-1]-.004*along)
        nail = ((d@across)/(.59*r))**2+((d@along)/(.83*r))**2
        exposure = np.clip((normal@outward-.24)/.38,0,1)
        exposure *= np.clip((r*1.35-np.abs(d@outward-r*.54))/(r*.5),0,1)
        edge = np.clip((1.24-nail)*3,0,1)*exposure
        mask = (np.clip((1.-nail)*5,0,1)*exposure)[:,None]
        pigment *= (1.-.19*edge)[:,None]
        nail_color=base+[25.,14.,13.]+13.*np.clip((d@along-.002)/.003,0,1)[:,None]
        pigment = pigment*(1-mask)+nail_color*mask
        # Joint creases wrap only the finger they belong to.
        for pivot in path[1:3]:
            delta=q-pivot
            distance=np.linalg.norm(delta,axis=1)
            crease=np.exp(-((delta@along+.001)/.00125)**2)*np.clip((1.65*r-distance)/(.65*r),0,1)
            pigment *= (1.-crease*(.06+.10*(1.-dorsal)))[:,None]
    return pigment
