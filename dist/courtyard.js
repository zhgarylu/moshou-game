import * as THREE from './vendor/three.module.js';

const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const color = value => new THREE.Color(value);

function randomSource(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function texture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  return map;
}

function floorMap() {
  return texture(2048, 2048, (g, w, h) => {
    const random = randomSource(781);
    g.fillStyle = '#27383a';
    g.fillRect(0, 0, w, h);
    const row = 36;
    for (let y = -row; y < h; y += row) {
      for (let x = -145 * random(); x < w;) {
        const bw = 51 + random() * 78, v = 45 + Math.floor(random() * 24);
        const shade = g.createLinearGradient(x, y, x + bw * .7, y + row);
        shade.addColorStop(0, 'rgb(' + [v + 4, v + 23, v + 25] + ')');
        shade.addColorStop(.86, 'rgb(' + [v, v + 16, v + 19] + ')');
        shade.addColorStop(1, 'rgb(' + [v - 5, v + 10, v + 13] + ')');
        g.fillStyle = shade;
        g.beginPath();
        g.moveTo(x + 1 + random() * 3, y + 1);
        g.lineTo(x + bw - 4, y + random());
        g.lineTo(x + bw - 1, y + 3);
        g.lineTo(x + bw - 1, y + row - 3);
        g.lineTo(x + bw - 7, y + row - 1);
        g.lineTo(x + 3, y + row - 1);
        g.lineTo(x + 1, y + row - 4);
        g.closePath();
        g.fill();
        g.strokeStyle = 'rgba(184,202,201,.11)';
        g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(x + 5, y + row - 9); g.lineTo(x + 5, y + 5); g.lineTo(x + bw - 8, y + 3); g.stroke();
        if (random() < .16) {
          let cx = x + bw * random(), cy = y;
          g.strokeStyle = 'rgba(14,23,25,.43)';
          g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx, cy);
          for (let j = 0; j < 4; j++) { cx += random() * 21 - 10; cy += 4 + random() * 6; g.lineTo(cx, cy); }
          g.stroke();
        }
        x += bw;
      }
    }
    for (let i = 0; i < 42000; i++) {
      const v = random();
      g.fillStyle = v < .5 ? 'rgba(14,23,26,.18)' : 'rgba(180,192,194,.10)';
      g.fillRect(random() * w, random() * h, .5 + random() * 3, .5 + random());
    }
    for(let i=0;i<410;i++){
      const x=random()*w,y=random()*h,radius=30+random()*135;
      const wash=g.createRadialGradient(x,y,0,x,y,radius);
      wash.addColorStop(0,i%3?'rgba(13,29,26,.22)':'rgba(122,119,92,.15)');
      wash.addColorStop(1,'rgba(28,43,38,0)');g.fillStyle=wash;g.fillRect(x-radius,y-radius,radius*2,radius*2);
    }
    // The stone inlay remains visible between waves, even with every light effect off.
    const cx = w / 2, cy = h / 2, s = w / 46;
    g.save(); g.translate(cx, cy);
    const r = 5.55 * s;
    for (const [radius, weight] of [[r + 9, 3], [r, 6], [r - 32, 4], [r - 40, 2], [r * .47, 3]]) {
      g.strokeStyle = 'rgba(184,158,100,.53)'; g.lineWidth = weight;
      g.beginPath(); g.arc(0, 0, radius, 0, TAU); g.stroke();
    }
    const patterns = [7, 4, 2, 1, 0, 3, 5, 6];
    for (let i = 0; i < 8; i++) {
      g.save(); g.rotate(i * TAU / 8);
      g.strokeStyle = 'rgba(191,160,102,.60)'; g.lineWidth = 5.5;
      for (let j = 0; j < 3; j++) {
        const y = -r + 8 + 8 * j;
        g.beginPath(); g.moveTo(-20, y);
        if (patterns[i] & (1 << j)) { g.lineTo(-4, y); g.moveTo(4, y); }
        g.lineTo(20, y); g.stroke();
      }
      g.strokeStyle = 'rgba(181,163,122,.33)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, -r + 46); g.lineTo(20, -r * .58); g.lineTo(0, -r * .49); g.lineTo(-20, -r * .58); g.closePath(); g.stroke(); g.restore();
    }
    const yin = .42 * r;
    g.fillStyle = 'rgba(171,148,105,.30)'; g.beginPath();
    g.arc(0, 0, yin, -Math.PI / 2, Math.PI / 2);
    g.arc(0, yin / 2, yin / 2, Math.PI / 2, -Math.PI / 2);
    g.arc(0, -yin / 2, yin / 2, Math.PI / 2, -Math.PI / 2, true);
    g.fill();
    for (const k of [-1, 1]) {
      g.fillStyle = k > 0 ? 'rgba(53,66,72,.9)' : 'rgba(180,150,98,.7)';
      g.beginPath(); g.arc(0, k * yin / 2, yin * .12, 0, TAU); g.fill();
    }
    g.restore();
    // Wind accumulates old offerings in small recognizable clusters between the flagstones.
    for(let i=0;i<32;i++){
      const a=random()*TAU,r=180+random()*640,ox=cx+Math.cos(a)*r,oy=cy+Math.sin(a)*r;
      for(let j=0;j<2+random()*8;j++){
        g.save();g.translate(ox+(random()-.5)*70,oy+(random()-.5)*52);g.rotate(random()*TAU);
        const ww=3+random()*4,hh=ww*(1.55+random()*.65);
        g.fillStyle=i%3?'rgba(172,139,81,.72)':'rgba(182,164,119,.66)';g.fillRect(-ww/2,-hh/2,ww,hh);
        g.fillStyle='rgba(122,57,37,.78)';g.fillRect(-ww*.25,-hh*.23,ww*.48,hh*.14);g.fillRect(0,-hh*.12,ww*.13,hh*.36);g.restore();
      }
    }
  });
}

function wetFlagstones() {
  const map=floorMap();
  const mat=new THREE.MeshStandardMaterial({map,bumpMap:map,bumpScale:.012,roughness:.74,metalness:.055});
  // Reflect the fixed porch openings analytically in the wet patches. Reflections
  // follow the third-person camera without a second render of every combat actor.
  mat.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 courtGround;\n'+shader.vertexShader.replace('#include <project_vertex>',
      '#include <project_vertex>\n courtGround=(modelMatrix*vec4(transformed,1.)).xyz;');
    shader.fragmentShader=`varying vec3 courtGround;
      float slabHash(vec2 p){ vec3 a=fract(p.xyx*vec3(.1031,.1030,.0973)); a+=dot(a,a.yzx+33.33);return fract((a.x+a.y)*a.z);}
      float slabNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(slabHash(i),slabHash(i+vec2(1,0)),f.x),mix(slabHash(i+vec2(0,1)),slabHash(i+vec2(1)),f.x),f.y);}
      `+shader.fragmentShader.replace('#include <opaque_fragment>',`
      vec2 p=courtGround.xz;
      float fine=slabNoise(p*vec2(9.2,54.));
      float damp=slabNoise(p*vec2(.32,.6))*.55+slabNoise(p*vec2(1.6,.74))*.31+fine*.14;
      float wet=smoothstep(.35,.67,damp);
      float speck=mix(.48,1.,fine);
      vec3 ray=reflect(normalize(courtGround-cameraPosition),vec3(0,1,0));
      float forward=step(.001,-ray.z)*step(-15.45,p.y);
      vec2 hit=courtGround.xy+ray.xy*((-15.5-p.y)/min(-.06,ray.z));
      hit.x+=(fine-.5)*1.12+(slabNoise(p*5.)-.5)*.42;
      hit.y+=(slabNoise(p*vec2(2.,29.))-.5)*.88;
      float sx=abs(hit.x);
      float windowX=max(1.-smoothstep(.82,1.22,abs(sx-2.68)),1.-smoothstep(.82,1.22,abs(sx-5.36)));
      float windowY=1.-smoothstep(.84,1.32,abs(hit.y-2.45));
      float lantern=exp(-2.3*abs(sx-3.32)-1.8*abs(hit.y-3.7))+exp(-2.3*abs(sx-5.93)-1.8*abs(hit.y-3.8));
      float fire=exp(-1.55*abs(sx-7.15)-1.17*abs(hit.y-1.55));
      float arch=forward*(windowX*windowY*.12+lantern*.50+fire*.88);
      vec3 skyTint=mix(vec3(.018,.064,.068),vec3(.064,.168,.185),smoothstep(-.06,.50,ray.y));
      float fresnel=pow(1.-clamp(ray.y,0.,1.),2.);
      float moonPath=exp(-3.2*abs(p.x+.31*p.y-3.7))*smoothstep(-16.,5.,-p.y+7.);
      outgoingLight*=mix(.97,.73,wet);
      outgoingLight+=wet*speck*(skyTint*(.09+.49*fresnel)+vec3(.34,.70,.78)*moonPath*.13);
      outgoingLight+=vec3(1.65,.38,.063)*arch*wet*speck;
      #include <opaque_fragment>`);
  };
  return mat;
}

function gradientSprite() {
  return texture(128, 128, (g, w) => {
    const grad = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(.16, 'rgba(255,255,255,.64)');
    grad.addColorStop(.45, 'rgba(255,255,255,.16)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, w, w);
  });
}

function plaqueMap(text) {
  return texture(512, 176, (g, w, h) => {
    g.fillStyle = '#201b1b'; g.fillRect(0, 0, w, h);
    const rand = randomSource(43);
    for (let i = 0; i < 190; i++) { g.fillStyle = 'rgba(128,82,45,.19)'; g.fillRect(rand() * w, rand() * h, rand() * 180, 1 + rand()); }
    g.strokeStyle = '#ac8650'; g.lineWidth = 5; g.strokeRect(8, 8, w - 16, h - 16);
    g.lineWidth = 2; g.strokeRect(17, 17, w - 34, h - 34);
    for (const x of [31, w - 31]) for (const y of [31, h - 31]) { g.beginPath(); g.arc(x, y, 5, 0, TAU); g.fillStyle = '#b5965d'; g.fill(); }
    g.font = 'bold 104px STKaiti, KaiTi, "Songti SC", "Noto Serif CJK SC", serif';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#caa56e';
    g.shadowColor = '#060709'; g.shadowBlur = 4; g.fillText(text, w / 2, h / 2 + 4);
  });
}

export function buildCourtyard(scene) {
  const random = randomSource(43017);
  const environment = new THREE.Group();
  environment.name = '槐阴义庄';
  scene.add(environment);
  const geometry = {
    box: new THREE.BoxGeometry(), cylinder: new THREE.CylinderGeometry(1, 1, 1, 12),
    oct: new THREE.CylinderGeometry(1, 1, 1, 8), sphere: new THREE.SphereGeometry(1, 10, 8),
    rock: new THREE.IcosahedronGeometry(1, 0), leaf: new THREE.OctahedronGeometry(1, 0),
    cone: new THREE.ConeGeometry(1, 1, 8)
  };
  const solid = new THREE.MeshStandardMaterial({ roughness: .9 });
  const copper = new THREE.MeshStandardMaterial({ roughness: .62, metalness: .31 });
  const ink = new THREE.MeshStandardMaterial({ roughness: .87, flatShading: true });
  const groups = new Map(), dummy = new THREE.Object3D();
  let parentMatrix = new THREE.Matrix4();
  const temp = new THREE.Matrix4();
  function put(key, point, size, tint, mat = solid, rotation = null) {
    dummy.position.set(...point); dummy.scale.set(...size);
    dummy.rotation.set(0, 0, 0);
    if (rotation?.isQuaternion) dummy.quaternion.copy(rotation);
    else if (rotation) dummy.rotation.set(...rotation);
    dummy.updateMatrix();
    temp.multiplyMatrices(parentMatrix, dummy.matrix);
    const id = key + mat.uuid;
    if (!groups.has(id)) groups.set(id, { geometry: geometry[key], mat, items: [] });
    groups.get(id).items.push([temp.clone(), color(tint)]);
  }
  const box = (x, y, z, w, h, d, c, mat = solid, rot = null) => put('box', [x,y,z], [w,h,d], c, mat, rot);
  const cyl = (x, y, z, r, h, c, mat = solid, key = 'cylinder') => put(key, [x,y,z],[r,h,r],c,mat);
  function stick(a, b, radius, tint, mat = solid, key = 'oct') {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), axis = vb.clone().sub(va);
    const len = axis.length();
    if (len < .001) return;
    const q = new THREE.Quaternion().setFromUnitVectors(UP, axis.divideScalar(len));
    put(key, va.lerp(vb, .5).toArray(), [radius, len, radius], tint, mat, q);
  }
  function local(x, z, ry, f) {
    const before = parentMatrix;
    const tr = new THREE.Matrix4().makeRotationY(ry);
    tr.setPosition(x, 0, z); parentMatrix = before.clone().multiply(tr);
    f(); parentMatrix = before;
  }
  const toWorld = (x, y, z) => new THREE.Vector3(x,y,z).applyMatrix4(parentMatrix);
  function surface(mesh) {
    mesh.updateMatrix(); mesh.matrix.premultiply(parentMatrix); mesh.matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
    environment.add(mesh); return mesh;
  }
  const halo = gradientSprite();
  const halos = [];
  function glow(x, y, z, r, c, opacity) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({map:halo, color:c, opacity, depthWrite:false, transparent:true,
      blending:THREE.AdditiveBlending, toneMapped:false}));
    s.position.copy(toWorld(x,y,z)); s.scale.set(r,r,1);
    environment.add(s); halos.push({ sprite:s, opacity, phase:random()*TAU }); return s;
  }

  scene.background = color('#214451');
  scene.fog = new THREE.FogExp2(0x213d46, .018);
  const hemi = new THREE.HemisphereLight(0x93c6d4, 0x384d4b, .83); scene.add(hemi);
  const moonlight = new THREE.DirectionalLight(0xbbe7ec, 2.32);
  moonlight.position.set(17, 19, -24); moonlight.target.position.set(0,0,-1);
  moonlight.castShadow = true;
  Object.assign(moonlight.shadow.camera,{left:-26,right:26,top:25,bottom:-25, near:1,far:82});
  moonlight.shadow.mapSize.set(1024,1024);
  moonlight.shadow.normalBias = .035; moonlight.shadow.bias = -.00028;
  scene.add(moonlight, moonlight.target);
  const fill = new THREE.DirectionalLight(0x8ebdb8, .6);
  fill.position.set(-15, 6, 11); scene.add(fill);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(145,48,20), new THREE.ShaderMaterial({
    side:THREE.BackSide, depthWrite:false, uniforms:{},
    vertexShader:'varying vec3 viewRay; void main(){viewRay=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 viewRay;
    float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
    void main(){vec3 d=normalize(viewRay);float y=max(0.,d.y);
    vec3 c=mix(vec3(.125,.24,.265),vec3(.014,.053,.095),smoothstep(0.,.72,y));
    vec2 p=d.xz/max(.12,y+.11);
    float n=noise(p*1.7)*.55+noise(p*3.7)*.27+noise(p*9.1)*.18;
    c=mix(c,vec3(.23,.37,.39),smoothstep(.46,.8,n)*exp(-y*1.6)*.54);
    float star=step(.9983,hash(floor(d.xz/max(.14,d.y)*158.)));
    c+=vec3(.21,.25,.28)*star*smoothstep(.12,.48,y)*(1.-n);
    vec3 md=normalize(vec3(.45,.435,-1.));float angle=length(d-md);
    c+=vec3(.29,.30,.24)*exp(-angle*17.);
    float disk=1.-smoothstep(.034,.037,angle);
    c=mix(c,vec3(.95,.94,.79)*(1.-.11*noise(d.xz*260.)),disk);
    gl_FragColor=vec4(c,1.);}`
  }));
  sky.renderOrder=-5; sky.frustumCulled=false; environment.add(sky);
  // Silhouette ranges encircle the playable court to preserve the horizon on camera turns.
  for (let layer = 0; layer < 3; layer++) {
    const pos = [], ix = [], n = 132, radius = 54 + layer * 14;
    for(let i=0;i<=n;i++){
      const a = i/n * TAU;
      const peak = 7 + layer * 3 + Math.sin(a*4+layer)*3 + Math.sin(a*9+layer*1.8)*2.4 +
        Math.sin(a*21+.8)*1.1 + Math.sin(a*35)*.65;
      pos.push(radius*Math.sin(a),-5,radius*Math.cos(a), radius*Math.sin(a),peak,radius*Math.cos(a));
      if(i<n){const k=i*2; ix.push(k,k+1,k+2,k+1,k+3,k+2);}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setIndex(ix);
    const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:['#465962','#536871','#637e87'][layer],side:THREE.DoubleSide}));
    environment.add(m);
  }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(46,46),wetFlagstones());
  floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; environment.add(floor);
  box(0,-.18,0,76,.30,76,'#414b4c');
  for (const s of [-1,1]) {
    box(s*15.4,.035,0,.45,.07,30,'#6c6860');
    box(0,.035,s*13.62,30.8,.07,.44,'#6c6860');
  }

  const red = '#803e31', wood = '#51372f', dark = '#342f30', gold = '#b29560';
  // Bent eaves are built in strips so the pan tiles follow the actual roof profile.
  function roof(w,d,y,rise) {
    const c = new THREE.Color(), verts=[],col=[],inds=[];
    const mat = new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.7,metalness:.12});
    const ridge = Math.max(.2,w - 1.55*d);
    function profile(u,t,side) {
      const x = u*(ridge/2+(w-ridge)*t/2), z = side*t*d/2;
      const lift = Math.pow(Math.abs(u),5)*Math.pow(t,2.6)*.63;
      return [x,y+rise*Math.pow(1-t,1.53)+lift,z];
    }
    const faces=38,rows=8;
    for (const side of [-1,1]) {
      const start=verts.length/3;
      for(let j=0;j<=rows;j++)for(let i=0;i<=faces;i++){
        const u=i/faces*2-1,t=j/rows; verts.push(...profile(u,t,side));
        c.set('#475c5b').multiplyScalar(.79+random()*.36+(i%2)*.035);col.push(c.r,c.g,c.b);
        if(j<rows&&i<faces){
          const a=start+j*(faces+1)+i,b=a+faces+1; inds.push(a,b,a+1,b,b+1,a+1);
        }
      }
      for(let i=0;i<=faces;i++){
        const u=2*i/faces-1, rib=i%2===0?'#5b6d66':'#465953';
        for(let j=0;j<4;j++){
          const a=profile(u,j/4,side),b=profile(u,(j+1)/4,side);a[1]+=.035;b[1]+=.035;
          stick(a,b,.048,rib);
        }
        const e=profile(u,1,side);
        put('sphere',e,[.082,.083,.085],i%4===0?'#9b906e':'#657973');
      }
      for(let j=1;j<=7;j++){
        const t=j/7;
        for(let i=0;i<6;i++){
          const a=profile(i/3-1,t,side),b=profile((i+1)/3-1,t,side);
          stick(a,b,j===7?.10:.025,j===7?'#48554a':'#56625a');
        }
      }
    }
    for (const s of [-1,1]) {
      const a=[s*ridge/2,y+rise,0],b=[s*w/2,y+.63,d/2],e=[s*w/2,y+.63,-d/2];
      const start=verts.length/3;
      for(const v of [a,b,e]){verts.push(...v);c.set('#4d605b');col.push(c.r,c.g,c.b);}
      inds.push(start,start+1,start+2);
      for (const side of [-1,1]) {
        const p=profile(s,1,side),p2=[p[0]+s*.37,p[1]+.38,p[2]+side*.12],p3=[p2[0]+s*.10,p2[1]+.35,p2[2]];
        stick(p,p2,.107,'#718077');stick(p2,p3,.066,'#8a8c78');
      }
    }
    stick([-ridge/2-.16,y+rise+.08,0],[ridge/2+.16,y+rise+.08,0],.17,'#68766b');
    for(const s of [-1,1]){
      put('sphere',[s*(ridge/2+.1),y+rise+.16,0],[.2,.21,.2],gold,copper);
      stick([s*ridge/2,y+rise+.12,0],[s*(ridge/2+.40),y+rise+.47,0],.11,'#697767');
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
    geo.setAttribute('color',new THREE.Float32BufferAttribute(col,3));geo.setIndex(inds);geo.computeVertexNormals();
    const m=surface(new THREE.Mesh(geo,mat));m.castShadow=true;m.receiveShadow=true;
  }
  function lantern(x,y,z,r=.46,white=false) {
    const shell=white?'#f2d499':'#ff7443';
    put('sphere',[x,y,z],[r,r*1.10,r],shell, lanternMat);
    for(let i=0;i<8;i++){
      const a=i/8*TAU;
      const p=[x+Math.cos(a)*r*.96,y,z+Math.sin(a)*r*.96];
      for(const sign of [-1,1])stick(p,[x+Math.cos(a)*r*.64,y+sign*r*.83,z+Math.sin(a)*r*.64],.013,white?'#ab9568':'#ad5840');
    }
    for(const s of [-1,1]){
      cyl(x,y+s*r*.90,z,r*.70,.08,'#8a7047',copper);
      cyl(x,y+s*r*1.02,z,r*.46,.07,'#ac8b53',copper);
    }
    stick([x,y+r,z],[x,y+r+.29,z],.022,'#c29e65');
    stick([x,y-r,z],[x,y-r-.22,z],.029,'#b08048');
    put('cone',[x,y-r-.32,z],[.061,.23,.061],white?'#816848':'#9e4735');
    glow(x,y,z,r*5.5,white?'#f6db9d':'#ff7348',white?.23:.49);
  }
  const lanternMat=new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false});
  function building(w,d,y,main=false){
    const h=y, front=d/2;
    box(0,.23,0,w+.85,.46,d+.65,'#626563');
    box(0,.51,0,w+.44,.15,d+.43,'#85827a');
    box(0,h/2+.38,-d*.13,w-.5,h-.45,d*.68,'#8d8f7d');
    // Three inset porch doors and timber lattice bays.
    const frontWall=d*.22;
    const count=main?5:3,bay=(w-.75)/count;
    for(let i=0;i<count;i++){
      const x=(i-(count-1)/2)*bay, middle=i===(count-1)/2;
      box(x,h*.48,frontWall,bay-.14,h*.74,.16,middle?'#5b302c':'#65503d');
      if(middle){
        for(const side of [-1,1]){
          box(x+side*bay*.23,h*.48,frontWall+.11,bay*.42,h*.69,.09,'#6f3930');
          for(let j=0;j<4;j++)box(x+side*bay*.23,h*(.23+j*.15),frontWall+.18,bay*.35,.035,.035,'#48342d');
          put('sphere',[x+side*.12,h*.45,frontWall+.22],[.06,.08,.04],gold,copper);
        }
      }else{
        box(x,h*.57,frontWall+.12,bay*.77,h*.45,.04,main?'#edaa58':'#bda26d',windowMat);
        for(let j=-2;j<=2;j++)box(x+j*bay*.14,h*.57,frontWall+.17,.042,h*.48,.04,'#503f35');
        for(const v of [-.14,0,.14])box(x,h*(.57+v),frontWall+.18,bay*.82,.05,.04,'#503f35');
      }
    }
    for(const s of [-1,1]) {
      box(0,h*.96,s*front,w+.15,.22,.21,wood);
      box(0,h*.89,s*front,w+.07,.12,.24,'#87714e');
      for(let i=0;i<=count;i++) {
        const x=(i/count-.5)*(w-.45);
        cyl(x,h*.53,s*front,.14,h*.86,red);
        cyl(x,.62,s*front,.25,.23,'#74756b',solid,'oct');
        cyl(x,h*.89,s*front,.20,.17,wood,solid,'oct');
        box(x,h*.935,s*front,.68,.15,.39,'#804e37');
        box(x,h*.985,s*front,.96,.13,.56,'#997a50');
      }
    }
    for(const side of [-1,1]) {
      box(side*(w-.45)/2,h*.96,0,.24,.23,d+.15,wood);
      box(side*(w-.45)/2,h*.51,0,.15,h*.67,d*.67,'#786b5e');
    }
    roof(w+1.75,d+1.8,h+.18,main?2.55:1.8);
    if(main){
      // The central doorway is framed by a pavilion roof visible beyond the lanterns.
      box(0,h+1.50,-.24,4.65,2.50,2.2,'#665246');
      for(const x of [-1.8,0,1.8])box(x,h+2.08,.90,.14,1.24,.14,red);
      roof(6.55,3.7,h+2.67,1.40);
      const p=new THREE.Mesh(new THREE.PlaneGeometry(3.35,1.15),new THREE.MeshStandardMaterial({map:plaqueMap('義  莊'),roughness:.72,emissive:0x231c12,emissiveIntensity:.35}));
      p.position.set(0,h-.51,front+.19);surface(p);
      for(const side of [-1,1]){
        box(side*1.09,2.31,frontWall+.20,.25,2.68,.025,'#9c412c');
        for(let j=0;j<7;j++){
          const y=1.29+j*.335;
          box(side*1.09,y,frontWall+.224,.15,.022,.013,'#be975a');
          box(side*1.09+.013,y+.015,frontWall+.226,.021,.114,.012,'#be975a');
        }
      }
      for(const s of [-1,1]){lantern(s*3.32,h-.88,front+.04,.47);lantern(s*5.93,h-.77,front+.04,.41);}
    }else for(const s of [-1,1])lantern(s*w*.27,h-.77,front+.04,.32,true);
    for(let i=0;i<3;i++)box(0,.09+i*.12,front+.95-i*.35,(main?5.1:3.8)-i*.19,.18+i*.05,.51,'#838176');
  }
  const windowMat=new THREE.MeshBasicMaterial({color:0xdad4c3});
  local(0,-18.35,0,()=>building(14.2,5.5,4.65,true));
  local(-19.25,-2.4,Math.PI/2,()=>building(9.2,4.8,3.85));
  local(19.25,-4.2,-Math.PI/2,()=>building(9.2,4.8,3.85));
  // Boundary walls sit behind the side porches and have individual coping tiles.
  function wall(w) {
    box(0,1.25,0,w,2.5,.61,'#aa9f88');box(0,.37,.02,w,.72,.69,'#5d6867');
    box(0,2.54,0,w+.15,.16,.81,'#586260');
    for(let j=0;j<3;j++){
      const z=.354,first=-w/2+.02;
      box(0,.16+j*.21,z,w,.025,.012,'#515d5c');
      for(let x=first+((j%2)*.56);x<w/2;x+=1.14)box(x,.26+j*.21,z,.026,.19,.012,'#525d5a');
    }
    for(let i=0;i<w*1.6;i++){
      const x=(random()-.5)*(w-.4), length=.04+random()*.27;
      box(x,2.45-length/2,.31,.025+random()*.026,length,.009,'#92917f');
    }
    for(let x=-w/2;x<w/2;x+=.42){cyl(x,2.67,0,.20,.86,'#556764',solid,'oct');}
    for(let x=-w/2;x<w/2+.01;x+=w/Math.max(1,Math.round(w/3.6))){
      box(x,1.4,.03,.66,2.8,.77,'#7e7b6c');box(x,2.87,0,.92,.14,.94,'#596562');
    }
  }
  for(const x of [-1,1]){
    local(x*14.7,-18.9,0,()=>wall(12.2));
    local(x*21.7,8.4,Math.PI/2,()=>wall(15));
    local(x*13.3,16.4,0,()=>wall(14));
  }
  local(0,18.5,Math.PI,()=>{
    for(const s of [-1,1]){
      box(s*3.2,1.7,0,.65,3.4,.8,wood);box(s*3.2,.44,0,.91,.88,1.03,'#68706c');
      lantern(s*2.5,2.65,.15,.32);
    }
    box(0,3.5,0,7.3,.46,.67,red);roof(8.4,2.2,3.78,1.14);
  });

  function crookedTree(x,z,scale,twist) {
    local(x,z,twist,()=>{
      const branchColor=['#453d39','#4d4039','#58483e'];
      function branch(start,direction,len,r,level){
        const a=new THREE.Vector3(...start),d=new THREE.Vector3(...direction).normalize(),b=a.clone().addScaledVector(d,len);
        const mid=a.clone().lerp(b,.53);mid.x+=(random()-.5)*len*.22;mid.z+=(random()-.5)*len*.2;
        const tint=branchColor[Math.floor(random()*branchColor.length)];
        stick(a.toArray(),mid.toArray(),r,tint,ink);stick(mid.toArray(),b.toArray(),r*.78,tint,ink);
        put('rock',mid.toArray(),[r*1.08,r*1.1,r*1.08],tint,ink);
        if(level>0){
          const off=(random()-.5)*.48;
          branch(b.toArray(),[d.x*.70+off,d.y*.80+.05,d.z*.70+(random()-.5)*.44],len*.70,r*.66,level-1);
          const theta=random()*TAU;
          branch(b.toArray(),[Math.cos(theta)*.83+d.x*.18,.15+random()*.75,Math.sin(theta)*.83+d.z*.18],len*.62,r*.47,level-1);
          if(level>=2)branch(mid.toArray(),[-d.x*.22+Math.cos(theta+2.3)*.8,.3+random()*.55,Math.sin(theta+2.3)*.8],len*.75,r*.42,level-1);
        } else {
          for(let k=0;k<7;k++){
            const p=b.clone().add(new THREE.Vector3((random()-.5)*len*.89,(random()-.35)*len*.6,(random()-.5)*len*.9));
            const s=(.13+random()*.24)*scale;
            put('leaf',p.toArray(),[s*1.45,s*.44,s],['#724739','#8d5740','#86634a','#5a5140','#705b44'][k%5],ink,[random(),random()*TAU,random()*.5]);
          }
        }
      }
      branch([0,0,0],[-.17,1,.10],2.9*scale,.56*scale,4);
      for(let i=0;i<8;i++){
        const a=i*TAU/8+.28;
        stick([0,.46*scale,0],[Math.cos(a)*scale*1.42,.03,Math.sin(a)*scale*1.25],.20*scale,'#574c40',ink);
      }
    });
  }
  crookedTree(-13.4,-15.4,1.49,-.57);
  crookedTree(13.3,-15.6,1.17,1.1);
  crookedTree(18.5,10.5,1.10,-2.1);
  crookedTree(-20,10.5,.82,-.5);
  for(let i=0;i<110;i++){
    const a=random()*TAU,r=26+random()*14;
    const xx=Math.cos(a)*r,zz=Math.sin(a)*r,s=.5+random()*1.2;
    const lean=(random()-.5)*.8;
    stick([xx,0,zz],[xx+lean,3.4*s,zz],.13*s,'#424c49');
    for(let j=0;j<4;j++){
      const rr=s*(1.35-j*.21),dx=(random()-.5)*rr*.48,dz=(random()-.5)*rr*.48;
      put('cone',[xx+lean*.23*j+dx,s*(1.55+j*.90),zz+dz],[rr,s*(2.34-j*.23),rr*.91],
        ['#364947','#394f4b','#415750','#4c6056'][j],ink,[0,random()*TAU,(random()-.5)*.12]);
    }
  }
  function coffin(){
    box(0,.30,0,1.13,.21,2.39,'#322d29');
    box(0,.66,0,1.10,.57,2.17,'#624336');
    box(0,.98,0,1.31,.19,2.43,'#43362d');
    box(0,1.10,0,1.12,.10,2.25,'#76513c');
    for (const k of [-1,1]){
      box(0,1.165,k*.66,1.13,.018,.09,'#a08453',copper);
      box(0,.73,k*1.105,.30,.27,.05,'#a28550',copper);
    }
  }
  for(const s of [-1,1])for(let j=0;j<3;j++)local(s*(16.40+j%2*.65),3.8+j*2.85,s*.23,coffin);
  function stoneLamp(x,z) {
    cyl(x,.18,z,.56,.34,'#64685f',solid,'oct');
    cyl(x,.49,z,.36,.4,'#8b8875',solid,'oct');cyl(x,.87,z,.23,.5,'#6c766e',solid,'oct');
    cyl(x,1.19,z,.45,.21,'#8c8f7f',solid,'oct');
    box(x,1.47,z,.53,.49,.53,'#d3b478',windowMat);
    for(const sx of [-1,1])for(const sz of [-1,1])box(x+sx*.275,1.49,z+sz*.275,.09,.54,.09,'#747c70');
    put('cone',[x,1.87,z],[.61,.42,.61],'#717969',solid);put('sphere',[x,2.15,z],[.11,.13,.11],'#7d8070');
    glow(x,1.51,z,1.4,'#efd499',.26);
  }
  for(const s of [-1,1])for(const z of [-12,-1,11])stoneLamp(s*15.65,z);
  // Bronze paper-burning bowls light both the porch and the local flagstones.
  const flameLayers = [];
  const fireGeo = new THREE.SphereGeometry(1,7,8);
  const firePos = fireGeo.getAttribute('position');
  for(let i=0;i<firePos.count;i++){
    const y=firePos.getY(i), taper=1.0-.49*Math.max(0,y);
    firePos.setXYZ(i,firePos.getX(i)*taper+.24*y*y,y,firePos.getZ(i)*taper);
  }
  fireGeo.computeVertexNormals();
  function warmPool(x,z,r) {
    const mat=new THREE.MeshBasicMaterial({map:halo,color:'#f4833b',transparent:true,opacity:.24,
      depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
    const pool=new THREE.Mesh(new THREE.PlaneGeometry(r,r),mat);
    pool.rotation.x=-Math.PI/2;pool.position.set(x,.042,z);surface(pool);
  }
  for(const s of [-1,1]){
    const x=s*7.15,z=-14.03;
    cyl(x,.14,z,.42,.25,'#69736c',solid,'oct');cyl(x,.28,z,.29,.17,'#897d62',copper,'oct');
    for(let i=0;i<3;i++){
      const a=i*TAU/3;
      stick([x+Math.sin(a)*.28,.24,z+Math.cos(a)*.28],[x+Math.sin(a)*.42,.86,z+Math.cos(a)*.42],.066,'#92724e',copper);
    }
    put('sphere',[x,.91,z],[.55,.19,.55],'#806549',copper);cyl(x,1.02,z,.54,.085,'#b18a50',copper);
    for(let i=0;i<4;i++){
      const a=i*TAU/4,rr=i===0?0:.20,xx=x+Math.cos(a)*rr,zz=z+Math.sin(a)*rr;
      const h=i===0?.57:.36+random()*.1;
      const m=new THREE.Mesh(fireGeo,new THREE.MeshBasicMaterial({color:i===0?'#ffe3a0':'#f7a35c',toneMapped:false}));
      m.position.set(xx,1.12+h*.37,zz);m.scale.set(.14,h,.13);environment.add(m);
      flameLayers.push({m,h,p:random()*TAU});
    }
    glow(x,1.4,z,3.65,'#ff8a41',.57);warmPool(x,z,8.4);
    const light=new THREE.PointLight(0xff8642,54,13,2);light.position.set(x,1.63,z);environment.add(light);
  }
  // Two carved guardians give the entryway a recognizable silhouette at player eye level.
  for(const s of [-1,1])local(s*5.83,-13.92,s*-.18,()=>{
    const jade='#667466',shadow='#536056',edge='#909783';
    box(0,.21,0,1.08,.42,.94,shadow);box(0,.48,0,1.20,.14,1.04,edge);
    put('rock',[0,.98,-.07],[.42,.59,.42],jade,ink);
    put('rock',[0,1.39,.19],[.44,.43,.40],jade,ink);
    put('rock',[0,1.42,.5],[.31,.20,.23],edge,ink);
    for(const side of [-1,1]){
      put('rock',[side*.29,1.72,.1],[.125,.146,.09],edge,ink);
      put('rock',[side*.21,1.52,.482],[.085,.07,.065],'#48534a',ink);
      put('rock',[side*.28,.72,.3],[.15,.24,.19],jade,ink);
      put('rock',[side*.29,.59,.42],[.18,.09,.21],edge,ink);
    }
    for(let i=0;i<9;i++){
      const a=i/9*TAU;put('rock',[Math.cos(a)*.36,1.43+Math.sin(a)*.31,.22],[.15,.15,.13],shadow,ink);
    }
    box(0,1.11,.39,.45,.15,.062,'#9e4934');
    box(-.12,.94,.40,.14,.29,.046,'#a85035',solid,[0,0,-.16]);
  });
  for(const side of [-1,1]){
    const from=new THREE.Vector3(side*15.65,4.48,-1.7),to=new THREE.Vector3(side*13.45,5.0,-14.1);
    const sag=t=>from.clone().lerp(to,t).add(new THREE.Vector3(0,-Math.sin(t*Math.PI)*.83,0));
    for(let i=0;i<14;i++){
      const p=sag(i/14),q=sag((i+1)/14);
      stick(p.toArray(),q.toArray(),.018,'#8c7251');
      if(i===0)continue;
      const len=.21+random()*.32;
      box(p.x,p.y-len/2,p.z,.19,len,.022,i%4===0?'#904a34':'#af9673',solid,[.09,side*.8,(random()-.5)*.24]);
    }
  }
  // Tall funeral streamers flutter in silhouette on either side of the mortuary.
  const streamerMap = texture(96,320,(g,w,h)=>{
    g.fillStyle='#b6a184';g.fillRect(0,0,w,h);
    g.fillStyle='#5a4334';g.fillRect(7,4,3,h-12);g.fillRect(w-10,4,3,h-12);
    g.font='bold 59px STKaiti,KaiTi,"Songti SC",serif';g.textAlign='center';g.textBaseline='middle';
    ['鎮','魂','幡'].forEach((v,i)=>g.fillText(v,w/2,67+i*87));
  });
  const bannerMat = new THREE.MeshStandardMaterial({map:streamerMap,side:THREE.DoubleSide,roughness:1});
  for(const sign of [-1,1]){
    const x=sign*8.3,z=-14.9;
    cyl(x,.25,z,.42,.44,'#696e63',solid,'oct');cyl(x,2.25,z,.075,4.5,'#786047');
    stick([x-.63,4.37,z],[x+.63,4.37,z],.064,'#9b8255');
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(.86,2.92,1,8),bannerMat);
    banner.position.set(x,2.81,z+.06);banner.rotation.y=sign*.23;surface(banner);
  }
  for(let i=0;i<190;i++){
    const a=random()*TAU,edge=random()>.23;
    const r=edge?12.1+random()*5.4:2+random()*11;
    const x=Math.cos(a)*r*1.15,z=Math.sin(a)*r*.85;
    put('leaf',[x,.038,z],[.065+random()*.07,.012,.04],['#82583d','#93613e','#5b5247'][i%3],ink,[0,random()*TAU,0]);
  }
  for(const group of groups.values()){
    const mesh=new THREE.InstancedMesh(group.geometry,group.mat,group.items.length);
    group.items.forEach(([m,c],i)=>{mesh.setMatrixAt(i,m);mesh.setColorAt(i,c);});
    mesh.castShadow=group.mat!==lanternMat && group.mat!==windowMat;mesh.receiveShadow=mesh.castShadow;
    mesh.computeBoundingSphere(); environment.add(mesh);
  }
  // Moving dust is intentionally sparse, leaving spell particles readable.
  const motePos=new Float32Array(144*3),phases=[];
  for(let i=0;i<motePos.length/3;i++){
    motePos[i*3]=(random()-.5)*41;motePos[i*3+1]=.45+random()*7.5;motePos[i*3+2]=(random()-.5)*39;
    phases.push(random()*TAU);
  }
  const dustGeo=new THREE.BufferGeometry();
  const originals=motePos.slice();
  dustGeo.setAttribute('position',new THREE.BufferAttribute(motePos,3));
  const dust=new THREE.Points(dustGeo,new THREE.PointsMaterial({color:0xf2d7a3,map:halo,size:.088,
    opacity:.66,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
  environment.add(dust);
  let surge=0, previousTime=0;
  return {
    setSurge(value){surge=THREE.MathUtils.clamp(Number(value)||0,0,1);},
    update(dt,time){
      const t=Number.isFinite(time)?time:previousTime+dt;
      previousTime=t;
      moonlight.intensity=2.32+surge*1.65;
      hemi.intensity=.83+surge*.54;
      for(const h of halos)h.sprite.material.opacity=h.opacity*(.92+.08*Math.sin(t*2.4+h.phase))*(1-surge*.25);
      for(const f of flameLayers){
        f.m.scale.y=f.h*(.94+.11*Math.sin(t*6+f.p)+.04*Math.sin(t*13+f.p));
        f.m.rotation.z=.09*Math.sin(t*3.8+f.p);
      }
      for(let i=0;i<phases.length;i++){
        motePos[i*3]=originals[i*3]+Math.sin(t*.19+phases[i])*.49;
        motePos[i*3+1]=originals[i*3+1]+Math.sin(t*.30+phases[i])*.30;
        motePos[i*3+2]=originals[i*3+2]+Math.cos(t*.11+phases[i])*.34;
      }
      dustGeo.attributes.position.needsUpdate=true;
    }
  };
}
