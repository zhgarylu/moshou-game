import * as THREE from './vendor/three.module.js';

// Blur only the brightest pixels in quarter resolution. The lightning, bronze
// seals and lanterns can share one glow pass, independent of the particle count.
export function makeAtmosphere(renderer){
  // Native GPU pipeline states also depend on the render target's pixel
  // format and sample count. Warm the actual battlefield framebuffer.
  async function prepare(world,camera,target){
    const previous=renderer.getRenderTarget();
    try{
      renderer.setRenderTarget(target);
      await renderer.compileAsync(world,camera);
      renderer.render(world,camera);
    }finally{renderer.setRenderTarget(previous);}
  }
  if(!renderer.extensions.has('EXT_color_buffer_float'))return {
    resize(){},prepare:(world,camera)=>prepare(world,camera,null),render:(world,camera)=>renderer.render(world,camera)
  };
  const image=new THREE.WebGLRenderTarget(2,2,{type:THREE.HalfFloatType,depthBuffer:true,samples:0});
  const gl=renderer.getContext();
  const colorSamples=gl.getInternalformatParameter(gl.RENDERBUFFER,gl.RGBA16F,gl.SAMPLES);
  const depthSamples=gl.getInternalformatParameter(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,gl.SAMPLES);
  const supported=Array.from(colorSamples || []).filter(n=>n>=2 && n<=4 && Array.from(depthSamples || []).includes(n));
  const samples=supported.length ? Math.min(...supported) : 0;
  const horizontal=new THREE.WebGLRenderTarget(2,2,{type:THREE.HalfFloatType,depthBuffer:false});
  const vertical=horizontal.clone();
  const quadScene=new THREE.Scene(),ortho=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  const vertexShader='varying vec2 uv0; void main(){uv0=uv;gl_Position=vec4(position.xy,0.,1.);}';
  const blur=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{source:{value:null},direction:{value:new THREE.Vector2()},extract:{value:0}},
    vertexShader,fragmentShader:`varying vec2 uv0;uniform sampler2D source;uniform vec2 direction;uniform float extract;
    vec3 sampleGlow(vec2 uv){vec3 c=texture2D(source,uv).rgb;float x=max(max(c.r,c.g),c.b);return c*mix(1.,smoothstep(.83,1.72,x),extract);}
    void main(){vec3 c=sampleGlow(uv0)*.227; c+=(sampleGlow(uv0+direction*1.385)+sampleGlow(uv0-direction*1.385))*.316;
      c+=(sampleGlow(uv0+direction*3.23)+sampleGlow(uv0-direction*3.23))*.07;gl_FragColor=vec4(c,1.);}`});
  const final=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{sceneMap:{value:image.texture},lightMap:{value:vertical.texture},pixel:{value:new THREE.Vector2()},surge:{value:0}},vertexShader,
    fragmentShader:`varying vec2 uv0;uniform sampler2D sceneMap,lightMap;uniform vec2 pixel;uniform float surge;
    void main(){vec3 base=texture2D(sceneMap,uv0).rgb;vec3 glow=texture2D(lightMap,uv0).rgb;
    vec2 x=vec2(pixel.x,0.),y=vec2(0.,pixel.y);
    vec3 nearColor=.25*(texture2D(sceneMap,uv0+x).rgb+texture2D(sceneMap,uv0-x).rgb
                       +texture2D(sceneMap,uv0+y).rgb+texture2D(sceneMap,uv0-y).rgb);
    const vec3 luma=vec3(.2126,.7152,.0722);
    float brightness=dot(base,luma);
    float detail=(brightness-dot(nearColor,luma))/max(brightness,.028);
    base*=1.+.32*clamp(detail,-.18,.24);
    vec2 off=(uv0-.5)*vec2(.91,1.07);float edge=smoothstep(.12,.67,length(off));
    base*=mix(1.,.85,edge);vec3 c=base+glow*(.36+min(1.,surge)*.48);
    gl_FragColor=vec4(c,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`});
  const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),blur);quad.frustumCulled=false;quadScene.add(quad);
  let w=1,h=1;
  return{
    prepare:(world,camera)=>prepare(world,camera,image),
    resize(width,height){
      // A retina framebuffer already downsamples when composed on screen. At
      // smaller resolutions MSAA preserves thin sleeves, chains and sword tips.
      image.samples=width*height<=2400000 ? samples : 0;
      image.setSize(width,height);
      final.uniforms.pixel.value.set(1/Math.max(1,width),1/Math.max(1,height));
      w=Math.max(2,Math.round(width/4));h=Math.max(2,Math.round(height/4));
      horizontal.setSize(w,h);vertical.setSize(w,h);
    },
    render(world,camera,surge=0){renderer.setRenderTarget(image);renderer.render(world,camera);
      quad.material=blur;blur.uniforms.source.value=image.texture;blur.uniforms.extract.value=1;blur.uniforms.direction.value.set(1.8/w,0);
      renderer.setRenderTarget(horizontal);renderer.render(quadScene,ortho);
      blur.uniforms.source.value=horizontal.texture;blur.uniforms.extract.value=0;blur.uniforms.direction.value.set(0,1.8/h);
      renderer.setRenderTarget(vertical);renderer.render(quadScene,ortho);
      quad.material=final;final.uniforms.surge.value=surge;renderer.setRenderTarget(null);renderer.render(quadScene,ortho);}
  };
}
