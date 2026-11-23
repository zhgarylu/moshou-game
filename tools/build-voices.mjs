// 按 tools/voices.json 生成 dist/voice/*.mp3 与 index.json。
// 需要 macOS 的 say 和 ffmpeg。用法：node tools/build-voices.mjs [只生成的 key ...]
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const table=JSON.parse(readFileSync(join(root,'tools/voices.json'),'utf8'));
const out=join(root,'dist/voice');mkdirSync(out,{recursive:true});
const indexFile=join(out,'index.json');
const index=existsSync(indexFile)?JSON.parse(readFileSync(indexFile,'utf8')):{};
const only=new Set(process.argv.slice(2));

// say renders 22.05 kHz; pitch shifts below are relative to that rate.
const chains={
  master:'highpass=f=110,acompressor=threshold=-20dB:ratio=3:attack=5:release=80,aecho=0.85:0.5:38|71:0.16|0.09',
  deity:'asetrate=22050*0.78,aresample=24000,atempo=1.12,lowshelf=g=6:f=160,highpass=f=60,aecho=0.8:0.75:70|140|260:0.34|0.24|0.14',
  ghost:'asetrate=22050*0.88,aresample=24000,atempo=0.92,highpass=f=180,tremolo=f=5.5:d=0.35,aecho=0.8:0.9:120|260|420:0.42|0.3|0.2',
  elder:'highpass=f=90,aecho=0.85:0.6:55|110:0.22|0.12',
};

const work=mkdtempSync(join(tmpdir(),'daofa-voice-'));
try{
  for(const [key,line] of Object.entries(table)){
    if(key.startsWith('_')||(only.size&&!only.has(key)))continue;
    const raw=join(work,key+'.aiff'),file=key.replace(/\./g,'-')+'.mp3';
    execFileSync('say',['-v',line.voice,'-r',String(line.rate||180),'-o',raw,line.text]);
    execFileSync('ffmpeg',['-y','-loglevel','error','-i',raw,'-af',
      chains[line.fx||'master']+',silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,apad=pad_dur=0.25,loudnorm=I=-15:TP=-1.5,aresample=24000,aformat=sample_fmts=s16',
      '-ac','1','-b:a','56k',join(out,file)]);
    const dur=Number(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','csv=p=0',join(out,file)]).toString());
    index[key]={file,dur:Math.round(dur*1000)/1000,text:line.text};
    console.log(key.padEnd(18),line.text,dur.toFixed(2)+'s');
  }
}finally{rmSync(work,{recursive:true,force:true});}
writeFileSync(indexFile,JSON.stringify(index,null,1)+'\n');
