import * as THREE from './vendor/three.module.js';
import {registerCaptureCoordinates} from './register-captures.js';
import {headRegistration} from './art/actors/head-scanlines.js';
import {faceBounds} from './art/actors/face-bounds.js';

const loader = new THREE.TextureLoader();

// The four observations describe one albedo. All UVs and pigment ownership
// are registered on the bind-pose surface before a character is ever drawn.
export async function addReferenceColors(scene,id) {
  const meshes = [];
  scene.traverse(node=>{
    if (node.isMesh && node.geometry.hasAttribute('texcoord_4')) meshes.push(node);
  });
  if (!meshes.length) return;
  const rect = faceBounds[id];
  const yaw = THREE.MathUtils.degToRad(scene.userData.rearCaptureDegrees ?? 180);
  const sideYaw = THREE.MathUtils.degToRad(scene.userData.sideCaptureDegrees ?? 90);
  
  const url = suffix => new URL('./art/actors/'+id+suffix,import.meta.url).href;
  const sculpted = meshes.some(mesh => mesh.geometry.hasAttribute('_surface_class'));
  const [texture, face, scalp, headMaterials, undercoat] = await Promise.all([
    loader.loadAsync(url('-views.webp')),
    rect ? loader.loadAsync(url('-face.webp')) : null,
    loader.loadAsync(url('-cranial.webp')),
    sculpted ? loader.loadAsync(url('-head-materials.webp')) : null,
    loader.loadAsync(url('-undercoat.webp'))
  ]);
  if (face) {
    face.colorSpace = THREE.SRGBColorSpace;
    face.flipY = false; face.anisotropy = 8;
  }
  undercoat.colorSpace=THREE.SRGBColorSpace;
  undercoat.flipY=false; undercoat.anisotropy=8;
  if (headMaterials) {
    headMaterials.colorSpace=THREE.SRGBColorSpace;
    headMaterials.flipY=false; headMaterials.anisotropy=8;
  }
  scalp.colorSpace=THREE.SRGBColorSpace;scalp.flipY=false;scalp.anisotropy=8;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false; texture.anisotropy = 8;
  const materials = new Set();
  scene.updateMatrixWorld(true);
  for (const mesh of meshes) {
    registerCaptureCoordinates(mesh, id, sideYaw, yaw);
    for (const mat of [].concat(mesh.material)) materials.add(mat);
  }
  for (const material of materials) {
    const studio = {value:0};
    material.userData.studioLight = studio;
    material.onBeforeCompile = shader=>{
      shader.uniforms.captureMap = {value:texture};
      shader.uniforms.lowerGarmentMap = {value:undercoat};
      shader.uniforms.headMap={value:scalp};
      if (sculpted) {
        shader.defines.USE_HEAD_MATERIALS=1;
        shader.uniforms.headMaterials={value:headMaterials};
      }
      shader.uniforms.headArea={value:headRegistration[id].rects.map(rect=>new THREE.Vector4(...rect))};
      shader.uniforms.studioLight = studio;
      if (face) {
        shader.defines.USE_CAPTURE_FACE = 1;
        shader.uniforms.captureFace = {value:face};
        shader.uniforms.captureFaceBounds = {value:new THREE.Vector4(...rect)};
      }
      if (id === 'white') shader.defines.USE_STAFF_CAPTURE = 1;
      if (id === 'ward') shader.defines.USE_SHAVED_SCALP = 1;
      shader.vertexShader = shader.vertexShader.replace('#include <common>',`
        #include <common>
        attribute vec2 captureFront, captureBack, captureLeft, captureRight;
        attribute vec4 surfacePigment;
        attribute vec4 pigmentRegion;
        #ifdef USE_HEAD_MATERIALS
          attribute vec3 mirroredFace;
          varying vec3 vMirrorFace;
        #endif
        varying vec4 vAxialUV, vFlankUV, vCaptureScore;
        varying vec4 vRegion;
        #ifdef USE_STAFF_CAPTURE
          attribute vec3 staffPigment;
          varying vec3 vStaffSide;
        #endif
      `).replace('#include <uv_vertex>',`
        #include <uv_vertex>
        vAxialUV = vec4(captureFront, captureBack);
        vFlankUV = vec4(captureLeft, captureRight);
        vCaptureScore = surfacePigment;
        vRegion = pigmentRegion;
        #ifdef USE_HEAD_MATERIALS
          vMirrorFace = mirroredFace;
        #endif
        #ifdef USE_STAFF_CAPTURE
          vStaffSide = staffPigment;
        #endif
      `);
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>',`
        #include <common>
        uniform sampler2D captureMap;
        uniform float studioLight;
        #ifdef USE_STAFF_CAPTURE
          varying vec3 vStaffSide;
        #endif
        #ifdef USE_CAPTURE_FACE
          uniform sampler2D captureFace;
          uniform vec4 captureFaceBounds;
        #endif
        varying vec4 vAxialUV, vFlankUV, vCaptureScore;
        varying vec4 vRegion;
        #ifdef USE_HEAD_MATERIALS
          varying vec3 vMirrorFace;
          uniform sampler2D headMaterials;
        #endif
        uniform sampler2D lowerGarmentMap;
        uniform sampler2D headMap;
        uniform vec4 headArea[4];
        vec4 clothBehindSleeve(vec2 uv,vec2 tile) {
          vec2 crop=vec2(uv.x,(uv.y-.12)/.71);
          return texture2D(lowerGarmentMap,.5*(tile+clamp(crop,.0015,.9985)),-.25);
        }
        float undercoatHeight(float y) {
          return smoothstep(.12,.145,y)*(1.-smoothstep(.81,.83,y));
        }
        vec4 observe(vec2 uv,vec2 tile,vec4 rect){
          float vHeadAmount=vRegion.x;
          vec4 source=vec4(0.);
          if (vHeadAmount<.999) {
            vec2 edge=min(uv,1.-uv);
            source=texture2D(captureMap,(tile+clamp(uv,.0005,.9995))*.5,-.35);
            source.a*=smoothstep(-.002,.002,min(edge.x,edge.y));
            float robe=vRegion.w*undercoatHeight(uv.y);
            if (robe>.001) {
              vec4 lining=clothBehindSleeve(uv,tile);
              float clothCoverage=robe*clamp((lining.a*255.-128.)/127.,0.,1.);
              source.rgb=mix(source.rgb,lining.rgb,clothCoverage);
              source.a=max(source.a,clothCoverage);
            }
          }
          if (vHeadAmount>.001) {
            vec2 local=clamp((uv-rect.xy)/(rect.zw-rect.xy),.0015,.9985);
            vec4 pigment;
            #ifdef USE_HEAD_MATERIALS
              float part=vRegion.y;
              bool scalpOrCrown=part>1.5 && part<3.5 || part>6.5 && part<8.5;
              if (scalpOrCrown || abs(part-4.)<.4 || abs(part-6.)<.4) {
                float row=scalpOrCrown ? ((abs(part-3.)<.4 || abs(part-7.)<.4) ? 3. : 0.) : (part<5. ? 1. : 2.);
                vec2 materialUV=(vec2(tile.x+2.*tile.y,row)+local)/4.;
                pigment=vec4(texture2D(headMaterials,materialUV,-.35).rgb,1.);
                #ifdef USE_SHAVED_SCALP
                  if (abs(part-2.)<.4 || abs(part-8.)<.4) {
                    float longitude=atan(vMirrorFace.x,vMirrorFace.y)/6.2831853+.5;
                    vec2 stubbleUV=vec2(fract(longitude),.002+.246*clamp(vAxialUV.y/.13,0.,1.));
                    vec3 stubble=texture2D(headMaterials,stubbleUV,-.1).rgb;
                    vec2 rootsUV=(vec2(tile.x+2.*tile.y,3.)+local)/4.;
                    vec3 observation=texture2D(headMaterials,rootsUV,-.35).rgb;
                    // Gold rings and red ribbons have separate physical meshes.
                    // Only charcoal hair and its cool highlights meet the stubble.
                    float value=dot(observation,vec3(.2126,.7152,.0722));
                    vec3 roots=mix(observation,vec3(.91,.96,1.)*value,.78);
                    roots*=min(1.,.073/max(.0001,value));
                    float rootDensity=smoothstep(.025,.97,vMirrorFace.z);
                    pigment.rgb=mix(stubble*(.83+.13*vMirrorFace.y-.13*vMirrorFace.x),roots,rootDensity);
                  }
                #endif
              } else
            #endif
              pigment=texture2D(headMap,.5*(tile+local),-.35);
            source=mix(source,pigment,vHeadAmount);
          }
          return source;
        }
        // Sample an actual coarser mip even on magnified portraits. Limit the
        // luminance correction so cutout edges retain their original colour.
        const vec3 pigmentWeights = vec3(.2126,.7152,.0722);
        vec4 detailSample(sampler2D pigment, vec2 coords) {
          vec2 size = vec2(textureSize(pigment,0));
          vec2 dx = dFdx(coords)*size, dy = dFdy(coords)*size;
          float lod = .5*log2(max(1.,max(dot(dx,dx),dot(dy,dy))));
          vec4 ink = texture2D(pigment,coords,-.35);
          vec4 broad = textureLod(pigment,coords,lod+1.15);
          float luminance = dot(ink.rgb,pigmentWeights);
          float relief = (luminance-dot(broad.rgb,pigmentWeights))/max(.025,luminance);
          ink.rgb *= 1.+.53*clamp(relief,-.28,.27)*min(ink.a,broad.a);
          return ink;
        }
      `).replace('#include <map_fragment>',`
        vec4 baseSample = detailSample(map,vMapUv);
        #ifdef USE_STAFF_CAPTURE
          baseSample.rgb = mix(baseSample.rgb,texture2D(map,vStaffSide.xy).rgb,vStaffSide.z);
        #endif
        vec3 paintedColor=baseSample.rgb;
        float vCaptureBlend=0.;
        #ifdef USE_HEAD_MATERIALS
          if (abs(vRegion.y-6.)<.4) {
            float longitude=atan(vMirrorFace.x,vMirrorFace.y)/6.2831853+.5;
            vec2 skinUV=vec2(fract(longitude),.5+clamp(vMirrorFace.z,.002,.998)*.25);
            paintedColor=texture2D(headMaterials,skinUV,-.2).rgb;
            vCaptureBlend=1.;
          } else
        #endif
        if (vAxialUV.x < 1.6 && abs(vRegion.y-10.)>.4 && abs(vRegion.y-12.)>.4) {
          vec4 front=vec4(0.), back=vec4(0.), left=vec4(0.), right=vec4(0.);
          // Below this weight the opaque base atlas already supplies the pixel.
          // Most covered surfaces have a single observation or a single seam.
          if (vCaptureScore.x>.0004) front=observe(vAxialUV.xy,vec2(0.,0.),headArea[0]);
          if (vCaptureScore.y>.0004) back=observe(vAxialUV.zw,vec2(1.,0.),headArea[1]);
          if (vCaptureScore.z>.0004) left=observe(vFlankUV.xy,vec2(0.,1.),headArea[2]);
          if (vCaptureScore.w>.0004) right=observe(vFlankUV.zw,vec2(1.,1.),headArea[3]);
          #ifdef USE_CAPTURE_FACE
            vec2 faceUV = (vAxialUV.xy-captureFaceBounds.xy)/(captureFaceBounds.zw-captureFaceBounds.xy);
            vec2 edge = min(faceUV,1.-faceUV);
            bool belongsToFace=vRegion.x>.34;
            #ifdef USE_HEAD_MATERIALS
              belongsToFace=abs(vRegion.y-1.)<.4;
            #endif
            if (belongsToFace && min(edge.x,edge.y)>0. && vCaptureScore.x>.005) {
              vec4 portrait=detailSample(captureFace,faceUV);
              front.rgb=mix(front.rgb,portrait.rgb,portrait.a);
            }
          #endif
          #ifdef USE_HEAD_MATERIALS
            if (vMirrorFace.z>.001 && abs(vRegion.y-1.)<.4) {
              vec4 twin=observe(vMirrorFace.xy,vec2(0.),headArea[0]);
              #ifdef USE_CAPTURE_FACE
                vec2 mirroredUV=(vMirrorFace.xy-captureFaceBounds.xy)/(captureFaceBounds.zw-captureFaceBounds.xy);
                if (all(greaterThan(mirroredUV,vec2(0.))) && all(lessThan(mirroredUV,vec2(1.)))) {
                  vec4 sampleFace=detailSample(captureFace,mirroredUV);
                  twin.rgb=mix(twin.rgb,sampleFace.rgb,sampleFace.a);
                }
              #endif
              front.rgb=mix(front.rgb,twin.rgb,vMirrorFace.z);
            }
          #endif
          vec4 score = vCaptureScore*vec4(front.a,back.a,left.a,right.a);
          float best = max(max(score.x,score.y),max(score.z,score.w));
          // Near a view seam favour the colour of one observation. Averaging
          // drawings that disagree about a sleeve edge would create two edges.
          vec4 weights = pow(score/max(.0001,best),vec4(5.));
          weights /= max(.00001,dot(weights,vec4(1.)));
          vec3 coat = front.rgb*weights.x+back.rgb*weights.y+left.rgb*weights.z+right.rgb*weights.w;
          vCaptureBlend=smoothstep(.006,.06,best);
          float hiddenRobe=vRegion.w*undercoatHeight(vAxialUV.y);
          if (vCaptureBlend<.998 && hiddenRobe>.001) {
            // Every chart stores real fabric outside its observed silhouette
            // as well. A surface hidden under both arms must never fall back
            // to an image of the occluding fingers on the old base atlas.
            float dominant=max(max(vCaptureScore.x,vCaptureScore.y),max(vCaptureScore.z,vCaptureScore.w));
            vec4 clean;
            if (vCaptureScore.x>=dominant) clean=clothBehindSleeve(vAxialUV.xy,vec2(0.,0.));
            else if (vCaptureScore.y>=dominant) clean=clothBehindSleeve(vAxialUV.zw,vec2(1.,0.));
            else if (vCaptureScore.z>=dominant) clean=clothBehindSleeve(vFlankUV.xy,vec2(0.,1.));
            else clean=clothBehindSleeve(vFlankUV.zw,vec2(1.));
            paintedColor=mix(paintedColor,clean.rgb,hiddenRobe);
          }
          paintedColor=mix(paintedColor,coat,vCaptureBlend);
        }
        #ifdef USE_HEAD_MATERIALS
          if (abs(vRegion.y-6.)<.4) paintedColor*=vRegion.z;
        #endif
        float pigmentLuma = dot(paintedColor,pigmentWeights);
        paintedColor *= mix(1.34,1.025,smoothstep(.025,.64,pigmentLuma));
        diffuseColor *= vec4(paintedColor,baseSample.a);
      `).replace('#include <emissivemap_fragment>',`
        #ifdef USE_EMISSIVEMAP
          totalEmissiveRadiance *= paintedColor;
        #endif
      `).replace('#include <opaque_fragment>',`
        float studioMix=studioLight*(.42+.52*vCaptureBlend);
        #ifdef USE_HEAD_MATERIALS
          // Unpainted anatomical shading stays under the same studio key as
          // the folds and cheekbones drawn into the neighbouring portrait.
          if (abs(vRegion.y-6.)<.4) studioMix*=.12;
          if (abs(vRegion.y-5.)<.4) studioMix*=.78;
          if (abs(vRegion.y-4.)<.4) studioMix*=.72;
          #ifdef USE_SHAVED_SCALP
            if (abs(vRegion.y-2.)<.4 || abs(vRegion.y-8.)<.4) studioMix*=mix(.27,.72,vMirrorFace.z);
          #endif
        #endif
        outgoingLight = mix(outgoingLight,paintedColor,studioMix);
        #include <opaque_fragment>
      `);
    };
    material.customProgramCacheKey=()=> 'daofa-bind-albedo-'+(sculpted?'sculpt-':'')+(face ? 'portrait' : 'body')+(id==='white' ? '-staff' : id==='ward' ? '-stubble' : '');
    material.needsUpdate=true;
  }
}
