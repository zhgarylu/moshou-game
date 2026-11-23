// 按 tools/voices.json 用火山引擎豆包语音 2.0 生成 dist/voice/*.mp3 与 index.json。
// 用法：node tools/build-voices.mjs [只生成的 key ...]    需要 ffmpeg 与网络。
// 密钥：环境变量 VOLC_TTS_KEY，或 VOLC_KEY_FILE 指向的文件中「豆包语音key：」后的那一段
// （默认 ~/aiCode/lemo-opuscar/火山引擎key.txt）。密钥只在本机读取，不写入仓库。
// 接口返回的原始音频按 音色+语速+台词 缓存在 tools/.voice-cache，只调后期不会重复计费。
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync,existsSync,renameSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {tmpdir,homedir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const {speakers,lines}=JSON.parse(readFileSync(join(root,'tools/voices.json'),'utf8'));
const out=join(root,'dist/voice'),cache=join(root,'tools/.voice-cache');
mkdirSync(out,{recursive:true});mkdirSync(cache,{recursive:true});
const indexFile=join(out,'index.json');
const index=existsSync(indexFile)?JSON.parse(readFileSync(indexFile,'utf8')):{};
const only=new Set(process.argv.slice(2));

const URL='https://openspeech.bytedance.com/api/v3/tts/unidirectional',RESOURCE='seed-tts-2.0',SR=24000;
function apiKey(){
  if(process.env.VOLC_TTS_KEY)return process.env.VOLC_TTS_KEY.trim();
  const file=process.env.VOLC_KEY_FILE||join(homedir(),'aiCode/lemo-opuscar/火山引擎key.txt');
  let text;try{text=readFileSync(file,'utf8');}catch{throw new Error('没有找到火山密钥：请设置 VOLC_TTS_KEY 或 VOLC_KEY_FILE');}
  const m=text.match(/豆包语音\s*key\s*[:：]\s*([A-Za-z0-9_\-]{16,})/i);
  if(!m)throw new Error('密钥文件中没有「豆包语音key：」一行');
  return m[1];
}
async function synth(text,speaker,rate,key){
  const body={req_params:{text,speaker,audio_params:{format:'mp3',sample_rate:SR,speech_rate:Math.max(-50,Math.min(100,rate))}}};
  let last;
  for(let attempt=0;attempt<3;attempt++){
    try{
      const r=await fetch(URL,{method:'POST',headers:{'X-Api-Key':key,'X-Api-Resource-Id':RESOURCE,'Content-Type':'application/json'},body:JSON.stringify(body)});
      const logid=r.headers.get('x-tt-logid')||'';
      if(!r.ok)throw new Error('HTTP '+r.status+' '+(await r.text()).slice(0,200)+' logid='+logid);
      const chunks=[];
      for(const row of (await r.text()).split('\n')){
        if(!row.trim())continue;const d=JSON.parse(row),code=d.code||0;
        if(code===0&&d.data)chunks.push(Buffer.from(d.data,'base64'));
        else if(code===20000000)break;
        else if(code>0){const e=new Error('code '+code+': '+d.message+' logid='+logid);e.fatal=true;throw e;}
      }
      if(!chunks.length)throw new Error('接口没有返回音频');
      return Buffer.concat(chunks);
    }catch(e){if(e.fatal)throw e;last=e;await new Promise(r=>setTimeout(r,1500*(attempt+1)));}
  }
  throw last;
}

// Natural voices need only a touch of room; the spirits keep their colour.
const chains={
  master:'highpass=f=80,aecho=0.9:0.4:32|61:0.10|0.06',
  deity:`asetrate=${SR}*0.86,aresample=${SR},atempo=1.08,lowshelf=g=5:f=150,aecho=0.8:0.7:70|140|260:0.30|0.20|0.12`,
  ghost:`asetrate=${SR}*0.93,aresample=${SR},atempo=0.96,highpass=f=150,tremolo=f=5:d=0.25,aecho=0.8:0.85:110|240|400:0.36|0.26|0.16`,
  elder:'highpass=f=70,aecho=0.85:0.5:50|100:0.16|0.09',
};

const key=apiKey(),work=mkdtempSync(join(tmpdir(),'daofa-voice-'));
try{
  for(const [id,line] of Object.entries(lines)){
    if(only.size&&!only.has(id))continue;
    const speaker=speakers[id.split('.')[0]];if(!speaker)throw new Error(id+' 没有对应的 speakers 音色');
    const rate=line.rate||0,raw=join(cache,createHash('sha1').update(JSON.stringify([speaker,rate,line.text,RESOURCE])).digest('hex').slice(0,16)+'.mp3');
    if(!existsSync(raw)){writeFileSync(raw+'.part',await synth(line.text,speaker,rate,key));renameSync(raw+'.part',raw);}
    const file=id.replace(/\./g,'-')+'.mp3',wav=join(work,'a.wav');
    execFileSync('ffmpeg',['-y','-loglevel','error','-i',raw,'-ar',String(SR),'-ac','1',wav]);
    execFileSync('ffmpeg',['-y','-loglevel','error','-i',wav,'-af',
      'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,'+
      chains[line.fx||'master']+`,apad=pad_dur=0.2,loudnorm=I=-15:TP=-1.5,aresample=${SR},aformat=sample_fmts=s16`,
      '-ac','1','-b:a','64k',join(out,file)]);
    const dur=Number(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','csv=p=0',join(out,file)]).toString());
    index[id]={file,dur:Math.round(dur*1000)/1000,text:line.text};
    console.log(id.padEnd(18),line.text,dur.toFixed(2)+'s');
  }
}finally{rmSync(work,{recursive:true,force:true});}
writeFileSync(indexFile,JSON.stringify(index,null,1)+'\n');
