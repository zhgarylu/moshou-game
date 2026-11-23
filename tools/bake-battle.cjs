// Run against the local game server. Build dependencies: playwright, three@0.170.0 and meshoptimizer@0.18.
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const base=process.env.GAME_URL||'http://127.0.0.1:4186';
const cast=['thunder','sword','ward','judge','corpse','black','white','priest'];
async function main(){
  const args=process.argv.slice(2),ids=args.length?args:cast;
  for(const id of ids)if(!cast.includes(id))throw new Error('Unknown role '+id);
  const files=new Map([
    ['battle-source.js',path.join(__dirname,'bake-battle.js')],
    ['exporter.js',require.resolve('three/addons/exporters/GLTFExporter.js')],
    ['simplifier.js',require.resolve('meshoptimizer/meshopt_simplifier.module.js')]
  ]);
  const imports={three:'/vendor/three.module.js','three/addons/exporters/GLTFExporter.js':'/exporter.js',meshoptimizer:'/simplifier.js'};
  const browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE||undefined});
  try{
    const page=await browser.newPage();page.on('console',m=>{if(m.type()==='log')console.log(m.text());});
    await page.route('**/battle-build',r=>r.fulfill({contentType:'text/html',body:'<link rel="icon" href="data:,"><script type="importmap">'+JSON.stringify({imports})+'</script>'}));
    for(const [key,file] of files)await page.route('**/'+key,r=>r.fulfill({contentType:'application/javascript',path:file}));
    const dest=path.join(root,'dist/art/battle');await fs.mkdir(dest,{recursive:true});
    for(const id of ids){
      await page.goto(new URL('/battle-build',base).href);
      const data=await page.evaluate(async id=>{
        const {bake}=await import('/battle-source.js');const bytes=await bake(id),blob=new Blob([bytes]);
        return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.onerror=reject;r.readAsDataURL(blob);});
      },id);
      await fs.writeFile(path.join(dest,id+'.glb'),Buffer.from(data,'base64'));
    }
  }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
