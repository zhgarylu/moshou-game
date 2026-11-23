const palette={ritual:['#dca84c','#ffe8ab','#4a3128'],blade:['#9bd7c9','#dbfff5','#17382f'],stars:['#90cfcb','#efffcd','#1e3840'],swordrain:['#8ee9d2','#e1ffea','#123631'],seal:['#deb780','#ffe0b6','#422c20'],altars:['#ecbb75','#fff0b1','#492f26'],lionseal:['#e6a776','#ffecbf','#472821'],thunder:['#9bc7e1','#e7f7ff','#183441'],summon:['#e3a56b','#ffcf8d','#49291f'],mark:['#e3c685','#fae4a0','#393324'],chain:['#9cdad1','#cdffed','#173a38'],dodge:['#c6d0a4','#eef4d1','#2b392e'],rice:['#d8cfb4','#fffaf0','#2f2b25']};
export function drawRune(canvas,type){
  const g=canvas.getContext('2d'),[line,bright,bg]=palette[type]; g.save();g.scale(canvas.width/80,canvas.height/80);
  g.clearRect(0,0,80,80);g.fillStyle=bg;g.fillRect(1,1,78,78);
  const path=(pts,fill=false)=>{g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));if(fill){g.closePath();g.fill();}else g.stroke();};
  g.strokeStyle=line;g.lineWidth=1.1;g.globalAlpha=.7;g.strokeRect(2.5,2.5,75,75);
  for(let i=0;i<4;i++){g.save();g.translate(40,40);g.rotate(i*Math.PI/2);path([[-32,-22],[-32,-32],[-22,-32]]);g.restore();}
  g.translate(40,40);g.globalAlpha=.35;g.beginPath();g.arc(0,0,26,0,Math.PI*2);g.stroke();
  for(let i=0;i<8;i++){g.save();g.rotate(i*Math.PI/4);path([[-5,-29],[5,-29]]);g.restore();}
  g.globalAlpha=1;g.strokeStyle=bright;g.fillStyle=bright;g.lineWidth=2.7;g.lineCap='round';g.lineJoin='round';g.shadowBlur=5;g.shadowColor=line;
  if(type==='thunder'){path([[8,-26],[-15,3],[-3,2],[-11,24],[17,-9],[4,-6]],true);g.lineWidth=1.3;path([[-12,-15],[-22,-5],[-18,-4],[-25,6]]);path([[18,0],[11,12],[18,9],[13,19]]);}
  if(type==='summon'){path([[-20,20],[-20,-9],[-8,-17],[0,-21],[8,-17],[20,-9],[20,20]]);path([[-24,-9],[-14,-12],[0,-22],[14,-12],[24,-9]]);path([[-13,17],[-13,-6],[13,-6],[13,17]]);path([[-18,20],[18,20]]);path([[-4,11],[0,-12],[4,11],[0,18]],true);path([[-7,10],[7,10]]);}
  if(type==='mark'){g.rotate(.2);g.strokeRect(-12,-23,24,46);path([[-7,-13],[5,-13],[-2,-8],[6,-6],[-7,1],[6,1],[-3,6],[5,8],[-6,14]]);}
  if(type==='chain'){path([[-22,10],[-8,-12],[-7,-3],[3,-9],[2,-2],[21,-16],[9,2],[9,-4],[-6,12],[-6,4],[-22,16]],true);for(const [x,y] of [[-20,12],[19,-15],[0,0]]){g.beginPath();g.arc(x,y,3,0,6.3);g.stroke();}}
  if(type==='blade'||type==='swordrain'){
    const sword=(x,y,angle,scale)=>{g.save();g.translate(x,y);g.rotate(angle);g.scale(scale,scale);
      path([[0,-24],[-3,-12],[-2,9],[0,12],[2,9],[3,-12],[0,-24]],true);path([[-8,8],[0,12],[8,8]]);path([[0,11],[0,21],[-3,23],[3,23]]);g.restore();};
    if(type==='swordrain'){sword(-13,0,-.37,.72);sword(13,0,.37,.72);}sword(0,1,type==='blade'?.6:0,1.05);
  }
  if(type==='stars'){const stars=[[-22,-7],[-12,-18],[-2,-13],[-4,-2],[4,7],[13,9],[21,21]];path(stars);for(const [x,y] of stars){g.beginPath();g.arc(x,y,2.8,0,6.29);g.fill();}}
  if(type==='seal'||type==='lionseal'){path([[-18,5],[18,5],[18,18],[-18,18],[-18,5]]);path([[-14,21],[14,21]]);if(type==='lionseal'){path([[-12,4],[-15,-8],[-14,-19],[-7,-15],[0,-18],[7,-15],[14,-20],[15,-8],[11,4]]);path([[-8,-8],[-4,-7]]);path([[8,-8],[4,-7]]);path([[-3,-3],[0,0],[3,-3]]);}else{path([[-7,5],[-7,-8],[0,-16],[7,-8],[7,5]]);}}
  if(type==='altars'){path([[0,-19],[20,0],[0,19],[-20,0],[0,-19]]);for(const [x,y] of [[0,-19],[20,0],[0,19],[-20,0]]){g.fillRect(x-3,y-5,6,9);}path([[-5,0],[0,-5],[5,0],[0,5],[-5,0]]);}
  if(type==='ritual'){
    g.rotate(.16);path([[-12,-21],[11,-21],[13,17],[-10,21],[-12,-21]]);
    path([[-7,-12],[-1,-16],[5,-10],[2,-5],[8,0],[-4,5],[4,10],[-4,13]]);
    for(const [x,y] of [[-18,-8],[-21,2],[-18,11],[17,-17],[21,-13],[19,-5],[15,-8]]){g.beginPath();g.arc(x,y,1.6,0,Math.PI*2);g.fill();}
  }
  if(type==='rice'){
    path([[-20,4],[20,4]]);g.beginPath();g.moveTo(-18,4);g.quadraticCurveTo(0,30,18,4);g.stroke();path([[-7,20],[7,20]]);
    for(const [x,y,a] of [[-10,-4,.4],[-2,-9,-.3],[7,-5,.8],[13,-14,.2],[-14,-15,-.6],[3,-20,.5],[-6,-26,.1],[17,-24,-.4]]){g.save();g.translate(x,y);g.rotate(a);g.beginPath();g.ellipse(0,0,1.7,3.4,0,0,6.29);g.fill();g.restore();}
  }
  if(type==='dodge'){path([[-23,10],[-9,6],[2,-1],[13,-15],[19,-19],[15,-6],[1,7],[-9,10]]);path([[-17,16],[-3,13],[16,3]]);path([[-16,-3],[-6,-5],[3,-14]]);}
  g.restore();
}
const shapes={sound:'<path d="M3 9h4l4-4v14l-4-4H3z M15 8q4 4 0 8 M18 5q7 7 0 14"/>',mute:'<path d="M3 9h4l4-4v14l-4-4H3z M16 9l6 6m0-6-6 6"/>',help:'<circle cx="12" cy="12" r="9"/><path d="M9.6 9a2.5 2.5 0 0 1 5 .3c0 2-2.6 2.3-2.6 4.4m0 2.6v.2"/>',pause:'<path d="M8 5v14m8-14v14" stroke-width="3"/>'};
export function drawIcon(el,name){el.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+shapes[name]+'</svg>';}
