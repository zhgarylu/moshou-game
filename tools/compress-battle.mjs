// 压缩实战 GLB：PNG 贴图转 WebP（EXT_texture_webp），法线、UV、蒙皮权重量化
// （KHR_mesh_quantization）。动画与位置保持 float，蒙皮结果不变。
// 用法：node tools/compress-battle.mjs dist/art/battle/*.glb   （需要 PATH 中有 cwebp）
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const FLOAT=5126,BYTE=5120,UBYTE=5121,USHORT=5123;
const align4=n=>(n+3)&~3;

function readGlb(file){
  const b=readFileSync(file);
  if(b.readUInt32LE(0)!==0x46546c67)throw new Error(file+' 不是 GLB');
  const jsonLength=b.readUInt32LE(12);
  const json=JSON.parse(b.subarray(20,20+jsonLength).toString('utf8'));
  const binStart=20+jsonLength;
  const bin=b.subarray(binStart+8,binStart+8+b.readUInt32LE(binStart));
  return {json,bin};
}

function writeGlb(file,json,chunks){
  const views=[];let offset=0;const parts=[];
  for(const chunk of chunks){
    const pad=align4(offset)-offset;if(pad)parts.push(Buffer.alloc(pad));offset+=pad;
    views.push({...chunk.view,buffer:0,byteOffset:offset,byteLength:chunk.data.byteLength});
    parts.push(Buffer.from(chunk.data.buffer,chunk.data.byteOffset,chunk.data.byteLength));offset+=chunk.data.byteLength;
  }
  const binPad=align4(offset)-offset;if(binPad)parts.push(Buffer.alloc(binPad));
  const bin=Buffer.concat(parts);
  json.bufferViews=views;json.buffers=[{byteLength:bin.length}];
  let text=Buffer.from(JSON.stringify(json));
  text=Buffer.concat([text,Buffer.alloc(align4(text.length)-text.length,0x20)]);
  const header=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(12+8+text.length+8+bin.length,8);
  jh.writeUInt32LE(text.length,0);jh.writeUInt32LE(0x4e4f534a,4);
  bh.writeUInt32LE(bin.length,0);bh.writeUInt32LE(0x004e4942,4);
  writeFileSync(file,Buffer.concat([header,jh,text,bh,bin]));
}

function floats(json,bin,index){
  const a=json.accessors[index],v=json.bufferViews[a.bufferView];
  const n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type];
  if(a.componentType!==FLOAT||(v.byteStride&&v.byteStride!==n*4))return null;
  const start=(v.byteOffset||0)+(a.byteOffset||0);
  return {n,count:a.count,data:new Float32Array(bin.buffer.slice(bin.byteOffset+start,bin.byteOffset+start+a.count*n*4))};
}

function compress(file){
  const {json,bin}=readGlb(file);
  const before=readFileSync(file).length;
  if(json.extensionsUsed?.includes('EXT_texture_webp'))return console.log(file,'已压缩，跳过');
  // Each accessor gets its own buffer view so replaced attributes can change stride.
  const chunks=[],viewOf=new Map();
  const slice=v=>bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength);
  const replaced=new Map();
  for(const mesh of json.meshes)for(const prim of mesh.primitives){
    const at=prim.attributes;
    if(at.NORMAL!==undefined&&!replaced.has(at.NORMAL)){
      const src=floats(json,bin,at.NORMAL);
      if(src){const out=new Int8Array(src.count*4);
        for(let i=0;i<src.count;i++)for(let k=0;k<3;k++)out[i*4+k]=Math.round(Math.max(-1,Math.min(1,src.data[i*3+k]))*127);
        replaced.set(at.NORMAL,{data:out,componentType:BYTE,normalized:true,stride:4});}
    }
    if(at.TEXCOORD_0!==undefined&&!replaced.has(at.TEXCOORD_0)){
      const src=floats(json,bin,at.TEXCOORD_0);
      if(src&&src.data.every(x=>x>=0&&x<=1)){const out=new Uint16Array(src.count*2);
        for(let i=0;i<out.length;i++)out[i]=Math.round(src.data[i]*65535);
        replaced.set(at.TEXCOORD_0,{data:out,componentType:USHORT,normalized:true,stride:4});}
    }
    if(at.WEIGHTS_0!==undefined&&!replaced.has(at.WEIGHTS_0)){
      const src=floats(json,bin,at.WEIGHTS_0);
      if(src){const out=new Uint8Array(src.count*4);
        for(let i=0;i<src.count;i++){
          const w=[0,1,2,3].map(k=>src.data[i*4+k]),sum=w.reduce((a,b)=>a+b,0)||1;
          const q=w.map(x=>Math.round(x/sum*255));let big=q.indexOf(Math.max(...q));
          q[big]+=255-q.reduce((a,b)=>a+b,0);q.forEach((x,k)=>out[i*4+k]=x);
        }
        replaced.set(at.WEIGHTS_0,{data:out,componentType:UBYTE,normalized:true,stride:4});}
    }
  }
  json.bufferViews.forEach((v,i)=>{
    const owners=json.accessors.map((a,k)=>a.bufferView===i?k:-1).filter(k=>k>=0);
    if(owners.length&&owners.every(k=>replaced.has(k)))return; // dropped, replaced below
    viewOf.set(i,chunks.length);
    const view={};if(v.byteStride)view.byteStride=v.byteStride;if(v.target)view.target=v.target;
    chunks.push({view,data:slice(v)});
  });
  for(const [k,r] of replaced){
    const a=json.accessors[k];
    viewOf.set('q'+k,chunks.length);
    chunks.push({view:{byteStride:r.stride,target:34962},data:r.data});
    a.componentType=r.componentType;a.normalized=r.normalized;a.byteOffset=0;delete a.min;delete a.max;
  }
  json.accessors.forEach((a,k)=>{
    if(a.bufferView===undefined)return;
    a.bufferView=replaced.has(k)?viewOf.get('q'+k):viewOf.get(a.bufferView);
  });
  // Textures: PNG → WebP. Base colour is perceptual; roughness/metal keeps more bits.
  const dir=mkdtempSync(join(tmpdir(),'battle-webp-'));
  try{
    const colorImages=new Set(json.materials.map(m=>m.pbrMetallicRoughness?.baseColorTexture?.index).filter(i=>i!==undefined).map(i=>json.textures[i].source));
    json.images.forEach((img,i)=>{
      const view=json.bufferViews[img.bufferView];
      const png=join(dir,i+'.png'),webp=join(dir,i+'.webp');
      writeFileSync(png,slice(view));
      execFileSync('cwebp',['-quiet','-q',colorImages.has(i)?'86':'92','-m','6','-sharp_yuv',png,'-o',webp]);
      const index=viewOf.get(img.bufferView);
      chunks[index]={view:{},data:readFileSync(webp)};
      img.mimeType='image/webp';
    });
  }finally{rmSync(dir,{recursive:true,force:true});}
  json.images.forEach(img=>{img.bufferView=viewOf.get(img.bufferView);});
  json.textures=json.textures.map(t=>({sampler:t.sampler,extensions:{EXT_texture_webp:{source:t.source}}}));
  for(const ext of ['EXT_texture_webp','KHR_mesh_quantization']){
    json.extensionsUsed=[...new Set([...(json.extensionsUsed||[]),ext])];
    json.extensionsRequired=[...new Set([...(json.extensionsRequired||[]),ext])];
  }
  writeGlb(file,json,chunks);
  console.log(file,(before/1024|0)+'KB →',(readFileSync(file).length/1024|0)+'KB');
}

for(const file of process.argv.slice(2))compress(file);
