
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const store={get(k,d){try{const v=localStorage.getItem('kd_'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem('kd_'+k,JSON.stringify(v))}catch(e){}}};
const rnd=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
const pressGroup=(els,pred)=>els.forEach(el=>el.setAttribute('aria-pressed',pred(el)?'true':'false'));

/* ---------- Tabs ---------- */
function showTab(name){
  $$('.tab').forEach(t=>t.setAttribute('aria-selected',t.dataset.tab===name));
  ['board','column','tools'].forEach(n=>$('#p-'+n).hidden=n!==name);
  store.set('tab',name);
  if(name==='board') requestAnimationFrame(()=>{fitBoard();resizeBoard()});
}
$$('.tab').forEach(t=>t.addEventListener('click',()=>showTab(t.dataset.tab)));

/* ================= BOARD ================= */
const BOARDS={
  white:{bg:'#FFFFFF',rgb:'30,80,190',a1:.42,a2:.24,ink:'#1B2233'},
  green:{bg:'#25473A',rgb:'255,255,255',a1:.38,a2:.2,ink:'#F4F1E6'},
  dark:{bg:'#1B1F27',rgb:'165,190,235',a1:.4,a2:.22,ink:'#F2F4F8'}
};
function lineTheme(){const t=BOARDS[B.board],k=B.lineK;return{bg:t.bg,line:`rgba(${t.rgb},${Math.min(1,t.a1*k)})`,line2:`rgba(${t.rgb},${Math.min(1,t.a2*k)})`,w:.7+.4*k}}
const FONTS={calli:'"Marck Script", "Bad Script", cursive',local:'"KDPropysyLocal", "Marck Script", cursive',user:'"KDUserFont", "Marck Script", cursive',
  vibes:'"Great Vibes", "Marck Script", cursive',caveat:'"Caveat", "Bad Script", cursive',simple:'"Bad Script", cursive',neucha:'"Neucha", "Bad Script", cursive',
  print:'"Shantell Sans", "Nunito", sans-serif',pacifico:'"Pacifico", "Marck Script", cursive',lobster:'"Lobster", "Marck Script", cursive'};
const FONT_LABEL={calli:'Käsikiri',local:'Käsikiri arvutist',user:'Minu font',vibes:'Pidulik kalligraafia',caveat:'Käsikirjaline',simple:'Lihtne käsikiri',neucha:'Lastekiri',print:'Trükitud',pacifico:'Ümmargune paks',lobster:'Pealkirjadele'};
function ensureFont(k){if(!FONTS[k])return;if(document.fonts&&document.fonts.load)document.fonts.load('40px '+FONTS[k],'Mägi õun õis ülikool').then(()=>{ratioCache={};redraw()}).catch(()=>{})}
const B={ruling:store.get('ruling','slant'),board:store.get('board','white'),tool:'pen',color:'auto',width:store.get('width',4),size:store.get('size',30),font:store.get('pfont','calli'),lineK:store.get('lineK',1.8)};
const bgC=$('#bgC'),txC=$('#txtC'),drC=$('#drawC'),bgx=bgC.getContext('2d'),txx=txC.getContext('2d'),drx=drC.getContext('2d'),cwrap=$('#cwrap');
let objs=store.get('objs',[]),insts=store.get('insts',[]);
let selMark=null,mdrag=null;
let cw=0,ch=0,dpr=1,strokes=store.get('texts',[]),redoStack=[],cur=null,sel=null,editing=null,drag=null;

function resizeBoard(){
  const r=cwrap.getBoundingClientRect(); if(!r.width||!r.height) return;
  dpr=Math.min(window.devicePixelRatio||1,2.5); cw=r.width; ch=r.height;
  [bgC,txC,drC].forEach(c=>{c.width=Math.round(cw*dpr);c.height=Math.round(ch*dpr)});
  drawBg(); redraw();
}
new ResizeObserver(resizeBoard).observe(cwrap);

function drawBg(){
  const g=bgx,w=cw,h=ch,s=B.size,th=lineTheme(),W=th.w;
  g.setTransform(dpr,0,0,dpr,0,0); g.fillStyle=th.bg; g.fillRect(0,0,w,h);
  const hl=(y,col,lw,dash)=>{g.strokeStyle=col;g.lineWidth=(lw||1)*W;g.setLineDash(dash||[]);g.beginPath();g.moveTo(0,Math.round(y)+.5);g.lineTo(w,Math.round(y)+.5);g.stroke();g.setLineDash([])};
  if(B.ruling==='cells'){
    g.strokeStyle=th.line2; g.lineWidth=W; g.beginPath();
    for(let x=s;x<w;x+=s){g.moveTo(Math.round(x)+.5,0);g.lineTo(Math.round(x)+.5,h)}
    for(let y=s;y<h;y+=s){g.moveTo(0,Math.round(y)+.5);g.lineTo(w,Math.round(y)+.5)}
    g.stroke();
  } else if(B.ruling==='lines'){
    for(let y=s*1.4;y<h;y+=s*1.4) hl(y,th.line);
  } else if(B.ruling==='narrow'){
    const hh=s*.75; for(let y=s;y<h;y+=hh+s*.85){hl(y,th.line);hl(y+hh,th.line)}
  } else if(B.ruling==='slant'){
    const hh=s*.8, H=hh*3, gap=s*.7, dx=H/Math.tan(65*Math.PI/180), step=hh*1.15;
    for(let y=s*.6;y<h;y+=H+gap){
      g.save(); g.beginPath(); g.rect(0,y,w,H); g.clip();
      g.strokeStyle=th.line2; g.lineWidth=W; g.beginPath();
      for(let x=-dx;x<w+dx;x+=step){g.moveTo(x,y+H);g.lineTo(x+dx,y)}
      g.stroke(); g.restore();
      hl(y,th.line2,1,[5,4]); hl(y+hh,th.line,1.4); hl(y+2*hh,th.line,1.4); hl(y+H,th.line2,1,[5,4]);
    }
  }
}

/* rows of the current ruling: baseline + letter body height */
function rowsGeom(){
  const s=B.size,h=Math.max(ch,400),out=[];
  if(B.ruling==='slant'){const hh=s*.8,H=hh*3,gap=s*.7;for(let y=s*.6;y+2*hh<h;y+=H+gap)out.push({base:y+2*hh,xh:hh})}
  else if(B.ruling==='narrow'){const hh=s*.75;for(let y=s;y+hh<h;y+=hh+s*.85)out.push({base:y+hh,xh:hh})}
  else if(B.ruling==='lines'){const st=s*1.4;for(let y=st*2;y<h;y+=st)out.push({base:y,xh:st*.4})}
  else if(B.ruling==='cells'){for(let y=s*2;y<h;y+=s*2)out.push({base:y,xh:s*.75})}
  else{const st=s*1.6;for(let y=st*1.5;y<h;y+=st*1.3)out.push({base:y,xh:st*.42})}
  return out;
}
function rowInfo(){const r=rowsGeom();return{rows:r,xh:r.length?r[0].xh:B.size*.8,pitch:r.length>1?r[1].base-r[0].base:B.size*2}}
function snapY(y){const r=rowsGeom();if(!r.length)return y;let best=r[0].base;r.forEach(x=>{if(Math.abs(x.base-y)<Math.abs(best-y))best=x.base});
  if(y>r.at(-1).base){const p=rowInfo().pitch;best=r.at(-1).base+Math.round((y-r.at(-1).base)/p)*p}return best}
let ratioCache={};
function ratio(f){if(ratioCache[f])return ratioCache[f];txx.font='100px '+FONTS[f];const m=txx.measureText('х').actualBoundingBoxAscent||45;const v=m/100;ratioCache[f]=v;return v}
const fsOf=o=>rowInfo().xh/ratio(o.font)*(o.k||1);
const isText=s=>s.kind==='text';

function textBox(o){
  const {pitch}=rowInfo(),fs=fsOf(o);txx.font=`${fs}px ${FONTS[o.font]}`;
  let w=0;o.lines.forEach(l=>w=Math.max(w,txx.measureText(l.t||' ').width));
  return{x:o.x-8,y:o.y-fs*1.05,w:w+16,h:(o.lines.length-1)*pitch+fs*1.5};
}
function drawTexts(){
  txx.setTransform(dpr,0,0,dpr,0,0);txx.clearRect(0,0,cw,ch);
  const {pitch}=rowInfo();
  strokes.forEach(o=>{
    if(!isText(o)||o===editing)return;
    const fs=fsOf(o);txx.font=`${fs}px ${FONTS[o.font]}`;txx.textBaseline='alphabetic';txx.fillStyle=inkOf(o.color);
    o.lines.forEach((l,i)=>{if(!l.t)return;txx.globalAlpha=l.st==='light'?.28:1;txx.fillText(l.t,o.x,o.y+i*pitch)});
    txx.globalAlpha=1;
  });
  positionSel();
}
const inkOf=c=>c==='auto'?BOARDS[B.board].ink:c;
function styleFor(g,s){
  g.lineCap='round';g.lineJoin='round';g.lineWidth=s.w;g.globalAlpha=1;g.globalCompositeOperation='source-over';
  if(s.tool==='eraser'){g.globalCompositeOperation='destination-out';g.strokeStyle='#000';g.fillStyle='#000'}
  else{g.strokeStyle=g.fillStyle=inkOf(s.color); if(s.tool==='marker') g.globalAlpha=.35}
}
function drawStroke(g,s){
  g.save(); styleFor(g,s); const p=s.pts;
  if(p.length===1){g.beginPath();g.arc(p[0].x,p[0].y,s.w/2,0,7);g.fill()}
  else{g.beginPath();g.moveTo(p[0].x,p[0].y);
    if(p.length===2||s.poly){for(let i=1;i<p.length;i++)g.lineTo(p[i].x,p[i].y)}
    else{for(let i=1;i<p.length-1;i++){const mx=(p[i].x+p[i+1].x)/2,my=(p[i].y+p[i+1].y)/2;g.quadraticCurveTo(p[i].x,p[i].y,mx,my)} g.lineTo(p.at(-1).x,p.at(-1).y)}
    g.stroke()}
  g.restore();
}
function redraw(){
  drawTexts();
  drx.setTransform(dpr,0,0,dpr,0,0);drx.clearRect(0,0,cw,ch);
  strokes.forEach(s=>{if(!isText(s)&&s.kind!=='mark')drawStroke(drx,s)});if(cur&&cur.kind!=='mark')drawStroke(drx,cur);
  renderMarks();
}
function saveTexts(){store.set('texts',strokes.filter(s=>isText(s)||s.kind==='mark').map(s=>s.kind==='mark'?{kind:'mark',id:s.id,k:s.k,x:s.x,y:s.y,w:s.w,h:s.h,color:s.color,sw:s.sw}:{kind:s.kind,x:s.x,y:s.y,lines:s.lines,color:s.color,font:s.font,k:s.k}))}
function resnap(){strokes.forEach(o=>{if(isText(o))o.y=snapY(o.y)});saveTexts()}
const widthFor=t=>t==='marker'?B.width*3+8:t==='eraser'?B.width*4+12:B.width;
const pt=e=>{const r=drC.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}};
function hitText(p){for(let i=strokes.length-1;i>=0;i--){const o=strokes[i];if(!isText(o))continue;const b=textBox(o);if(p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h)return o}return null}

drC.addEventListener('pointerdown',e=>{
  if(e.button>0) return;
  const p=pt(e);
  if(B.tool==='text'){e.preventDefault();const o=hitText(p);openEditor(o,p);return}
  if(editing) commitEditor();
  drC.setPointerCapture(e.pointerId);
  if(B.tool==='move'){const o=hitText(p);sel=o;drag=o?{o,dx:p.x-o.x,dy:p.y-o.y}:null;drC.style.cursor=o?'grabbing':'grab';redraw();return}
  if(selMark){selMark=null;renderMarks()}
  if(B.tool==='morph'){morphStart(p);return}
  cur={tool:B.tool,color:B.color,w:widthFor(B.tool),pts:B.tool==='line'?[p,p]:[p]};
  snapStart(cur,p);if(cur.snap)showMeasure(cur.pts[0],cur.pts[1]);
  redraw();
});
drC.addEventListener('pointermove',e=>{
  if(drag){const p=pt(e);drag.o.x=Math.max(0,p.x-drag.dx);drag.o.y=p.y-drag.dy;redraw();return}
  if(!cur) return;
  if(cur.kind==='mark'){morphUpdate(pt(e));return}
  if(cur.snap){cur.pts[1]=projEdge(cur.snap,pt(e),cur.w);showMeasure(cur.pts[0],cur.pts[1]);redraw();return}
  if(cur.tool==='line'){cur.pts[1]=pt(e);showMeasure(cur.pts[0],cur.pts[1]);redraw();return}
  const evs=e.getCoalescedEvents?e.getCoalescedEvents():[e];
  for(const ev of evs){const p=pt(ev),l=cur.pts.at(-1); if(Math.hypot(p.x-l.x,p.y-l.y)<1) continue; cur.pts.push(p)}
  redraw();
});
const endStroke=()=>{
  if(drag){drag.o.y=snapY(drag.o.y);drag=null;drC.style.cursor='grab';saveTexts();redraw();return}
  hideMeasure();if(cur&&cur.kind==='mark'){morphEnd();return}if(!cur)return;const sn=cur.snap;delete cur.snap;strokes.push(cur);redoStack=[];cur=null;redraw();
  if(sn){const st=strokes.at(-1);toast('Lõigu pikkus: '+cmTxt(Math.hypot(st.pts[1].x-st.pts[0].x,st.pts[1].y-st.pts[0].y)))}
};
drC.addEventListener('pointerup',endStroke); drC.addEventListener('pointercancel',endStroke);

/* ---- typing directly on the board ---- */
const ed=$('#txtEdit');
function openEditor(o,p){
  commitEditor();
  const info=rowInfo();
  if(!o) o={kind:'text',x:p.x,y:snapY(p.y+info.xh*.6),lines:[{t:'',st:'solid'}],color:B.color,font:B.font,k:1,isNew:true};
  editing=o;sel=null;
  const fs=fsOf(o);
  ed.value=o.lines.map(l=>l.t).join('\n');
  ed.style.font=`${fs}px/${info.pitch}px ${FONTS[o.font]}`;
  ed.style.color=inkOf(o.color);
  ed.style.left=(o.x-6)+'px';ed.style.top=(o.y-info.pitch/2-fs*.32)+'px';
  ed.hidden=false;sizeEditor();redraw();
  try{ed.focus({preventScroll:true})}catch(_){}
  setTimeout(()=>{ed.focus();ed.setSelectionRange(ed.value.length,ed.value.length)},0);
}
function sizeEditor(){
  if(!editing)return;const fs=fsOf(editing);txx.font=`${fs}px ${FONTS[editing.font]}`;
  let w=0;ed.value.split('\n').forEach(l=>w=Math.max(w,txx.measureText(l).width));
  ed.style.width=Math.min(cw-editing.x+6,Math.max(w+fs*1.2,180))+'px';
  ed.style.height='auto';ed.style.height=ed.scrollHeight+'px';
}
function commitEditor(){
  if(!editing)return;const o=editing;editing=null;ed.hidden=true;
  const raw=ed.value.replace(/\s+$/,'').split('\n');
  const old=o.lines;o.lines=raw.map((t,i)=>({t,st:(old[i]&&old[i].st)||(old[0]&&old[0].st)||'solid'}));
  const empty=!raw.join('').trim();
  if(empty){strokes=strokes.filter(s=>s!==o)}
  else if(o.isNew){delete o.isNew;strokes.push(o);redoStack=[]}
  saveTexts();redraw();
}
ed.addEventListener('input',sizeEditor);
ed.addEventListener('blur',()=>setTimeout(commitEditor,0));
ed.addEventListener('keydown',e=>{if(e.key==='Escape'||(e.key==='Enter'&&(e.ctrlKey||e.metaKey))){e.preventDefault();ed.blur()}});

/* ---- selection box for moving / editing a text ---- */
const selBox=$('#selBox'),selBar=$('#selBar');
function positionSel(){
  if(!sel||B.tool!=='move'||editing||!strokes.includes(sel)){selBox.hidden=true;return}
  const b=textBox(sel);selBox.hidden=false;
  Object.assign(selBox.style,{left:b.x+'px',top:b.y+'px',width:b.w+'px',height:b.h+'px'});
  selBar.style.top=b.y<56?(b.h+8)+'px':'-48px';
}
selBar.addEventListener('pointerdown',e=>e.stopPropagation());
selBar.addEventListener('click',e=>{
  const a=e.target.closest('button');if(!a||!sel)return;const k=a.dataset.sa;
  if(k==='minus')sel.k=Math.max(.5,(sel.k||1)/1.15);
  if(k==='plus')sel.k=Math.min(3,(sel.k||1)*1.15);
  if(k==='light'){const toLight=sel.lines.some(l=>l.st!=='light');sel.lines.forEach(l=>l.st=toLight?'light':'solid')}
  if(k==='edit'){const o=sel;B.tool='text';syncBoardUI();openEditor(o);return}
  if(k==='copy'){const c=JSON.parse(JSON.stringify(sel));c.y=snapY(sel.y+rowInfo().pitch*sel.lines.length);strokes.push(c);sel=c}
  if(k==='del'){strokes=strokes.filter(s=>s!==sel);sel=null}
  saveTexts();redraw();
});

function undo(){if(editing)return;if(strokes.length){redoStack.push(strokes.pop());sel=null;saveTexts();redraw()}}
function redo(){if(redoStack.length){strokes.push(redoStack.pop());saveTexts();redraw()}}
$('#undoB').onclick=undo; $('#redoB').onclick=redo;
document.addEventListener('keydown',e=>{
  if($('#p-board').hidden||editing)return;
  const ae=document.activeElement;
  if(ae&&(ae.isContentEditable||/^(INPUT|TEXTAREA|SELECT|IFRAME)$/.test(ae.tagName)))return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();return}
  const tag=(document.activeElement||{}).tagName;
  if(selMark&&(e.key==='Delete'||e.key==='Backspace')){e.preventDefault();strokes=strokes.filter(s=>s!==selMark);selMark=null;saveTexts();renderMarks();return}
  if(sel&&B.tool==='move'&&(e.key==='Delete'||e.key==='Backspace')&&tag!=='INPUT'&&tag!=='TEXTAREA'){e.preventDefault();strokes=strokes.filter(s=>s!==sel);sel=null;saveTexts();redraw()}
});
let clearArm=null;
$('#clearB').onclick=function(){
  if(clearArm){clearTimeout(clearArm);clearArm=null;strokes=[];redoStack=[];sel=null;saveTexts();clearObjs();redraw();this.textContent='Puhasta';this.style.cssText='';return}
  this.textContent=objs.length?'Veel üks kord — kustuta kõik ja materjalid':'Veel üks kord, et kõik kustutada';this.style.cssText='background:var(--err-soft);color:var(--err);border-color:var(--err)';
  clearArm=setTimeout(()=>{clearArm=null;this.textContent='Puhasta';this.style.cssText=''},2500);
};
$('#fsB').onclick=()=>{const st=$('#stage');if(document.fullscreenElement){document.exitFullscreen().catch(()=>{})}else if(st.requestFullscreen){st.requestFullscreen().catch(()=>{})}};
document.addEventListener('fullscreenchange',()=>{const fs=!!document.fullscreenElement;$('#fsB').title=fs?'Välju täisekraanist':'Täisekraan';$('#fsB span').textContent=fs?'Välju':'Täisekraan';fitBoard();setTimeout(resizeBoard,60)});

/* ---- board fills the window; toolbar can be collapsed or hidden ---- */
const stage=$('#stage');
function fitBoard(){
  if(document.fullscreenElement){cwrap.style.height='';return}
  const top=cwrap.getBoundingClientRect().top+window.scrollY;
  const h=Math.max(380,Math.round(window.innerHeight-top-14));
  if(cwrap.style.height!==h+'px')cwrap.style.height=h+'px';
}
window.addEventListener('resize',()=>requestAnimationFrame(fitBoard));
function closePops(){['#addPop','#fontPop','#instPop','#langPop'].forEach(x=>{const el=$(x);if(el)el.hidden=true});$('#addMenuB').setAttribute('aria-expanded','false');const f=$('#fontPickB');if(f)f.setAttribute('aria-expanded','false')}
$('#fontPickB').onclick=e=>{e.stopPropagation();const open=$('#fontPop').hidden;closePops();$('#fontPop').hidden=!open;$('#fontPickB').setAttribute('aria-expanded',open)};
function setTb(mode){
  stage.dataset.tb=mode;store.set('tb',mode);
  $('#tbMore').hidden=mode!=='full';
  $('#tbMoreB').setAttribute('aria-expanded',mode==='full');$('#tbMoreB').classList.toggle('hot',mode==='full');
  $('#tbMini').hidden=mode!=='hidden';
  if(mode==='hidden'){closePops();['#propysP','#addP'].forEach(s=>$(s).hidden=true)}
  requestAnimationFrame(()=>{fitBoard();resizeBoard()});
}
$('#tbMoreB').onclick=()=>setTb(stage.dataset.tb==='full'?'compact':'full');
$('#tbHideB').onclick=()=>setTb('hidden');
$('#tbShowB').onclick=()=>setTb('compact');
$('[data-act-undo]').onclick=()=>undo();
$('#addMenuB').onclick=e=>{e.stopPropagation();const open=$('#addPop').hidden;closePops();$('#addPop').hidden=!open;$('#addMenuB').setAttribute('aria-expanded',open)};
$('#addPop').addEventListener('click',e=>{if(e.target.closest('button'))closePops()});
document.addEventListener('pointerdown',e=>{if(!e.target.closest('.pop'))closePops()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closePops()});
setTb(store.get('tb','compact')==='hidden'?'hidden':store.get('tb','compact'));

const CURSORS={move:'grab',text:'text'};
function syncBoardUI(){
  pressGroup($$('[data-ruling]'),el=>el.dataset.ruling===B.ruling);
  pressGroup($$('[data-board]'),el=>el.dataset.board===B.board);
  pressGroup($$('[data-tool]'),el=>el.dataset.tool===B.tool);
  pressGroup($$('[data-color]'),el=>el.dataset.color===B.color);
  pressGroup($$('[data-pf]'),el=>el.dataset.pf===B.font);
  pressGroup($$('[data-morph]'),el=>B.tool==='morph'&&el.dataset.morph===B.morph);
  $('#langMenuB').classList.toggle('hot',B.tool==='morph');
  const fpn=$('#fontPickB .fp-name');if(fpn){fpn.textContent=FONT_LABEL[B.font]||'Kirjutis';fpn.style.fontFamily=FONTS[B.font]}
  $('#sizeR').value=B.size; $('#widthR').value=B.width; $('#lineR').value=B.lineK;
  drC.style.cursor=CURSORS[B.tool]||'crosshair';
  cwrap.classList.toggle('interact',B.tool==='move');
  $('#boardHint').textContent=B.tool==='morph'?(B.morph==='end'?'Lõpp: joonista tähed raamiga ümber — lohista vasakust ülemisest nurgast paremasse alumisse.':B.morph==='zero'?'Nulllõpp: klõpsa kohe sõna järel.':B.morph==='base'?'Alus: joonista sõna all esimese ja viimase tähe vahel.':MORPH[B.morph]+': joonista tähtede kohal vasakult paremale — märge ilmub automaatselt. Klõpsa märget, et seda liigutada, venitada või kustutada.')
    :B.tool==='text'?'Kiri: klõpsa real ja kirjuta klaviatuurilt. Enter — uus rida. Klõpsa tekstist väljaspool, et lõpetada.'
    :B.tool==='move'?(objs.length?'Klõpsake video, mängude ja märkmete peal. Lohistage materjale ülemisest ribast, suurust muutke alumisel paremal nurgal.':'Lohista teksti. See joondub automaatselt lähima reale. Valitud teksti saab suurendada, muuta või kustutada.')
    :insts.length&&(B.tool==='pen'||B.tool==='marker')?'Joonista pliiatsiga joonlaua või kolmnurga serva mööda — joon on sirge ja pikkus näidatakse sentimeetrites. 1 cm = 2 ruutu.'
    :objs.length?'Pliiatsiga saab kirjutada materjalide peale. Videote või mängude klõpsamiseks vali «Kursor».':'';
  $('#boardHint').hidden=!$('#boardHint').textContent;
}
$$('[data-ruling]').forEach(b=>b.onclick=()=>{B.ruling=b.dataset.ruling;store.set('ruling',B.ruling);syncBoardUI();drawBg();resnap();redraw()});
$$('[data-board]').forEach(b=>b.onclick=()=>{B.board=b.dataset.board;store.set('board',B.board);syncBoardUI();drawBg();redraw()});
$$('[data-tool]').forEach(b=>b.onclick=()=>{commitEditor();B.tool=b.dataset.tool;if(B.tool!=='move')sel=null;
  if(B.tool==='text'&&B.ruling==='plain'){B.ruling='slant';store.set('ruling','slant');drawBg();resnap()}
  syncBoardUI();redraw()});
$$('[data-color]').forEach(b=>b.onclick=()=>{B.color=b.dataset.color;
  if(sel&&B.tool==='move'){sel.color=B.color;saveTexts()}
  else if(B.tool==='eraser'||B.tool==='move')B.tool='pen';
  syncBoardUI();redraw()});
$('#sizeR').oninput=e=>{B.size=+e.target.value;store.set('size',B.size);drawBg();resnap();redraw();renderInsts()};
$('#widthR').oninput=e=>{B.width=+e.target.value;store.set('width',B.width)};
$('#lineR').oninput=e=>{B.lineK=+e.target.value;store.set('lineK',B.lineK);drawBg()};

/* ---------- Propys generator ---------- */
let pMode=store.get('pmode','triple');
const pPanel=$('#propysP'),pBtn=$('#propysB');
function showPanel(name){
  const ap=$('#addP'),wasOpen=name==='propys'?!pPanel.hidden:(!ap.hidden&&ap.dataset.mode===name);
  pPanel.hidden=true;ap.hidden=true;
  [pBtn,$('#addLinkB'),$('#addRefB')].forEach(b=>{b.classList.remove('hot');b.setAttribute('aria-expanded','false')});
  if(!wasOpen){
    if(name==='propys'){pPanel.hidden=false;pBtn.classList.add('hot');pBtn.setAttribute('aria-expanded','true')}
    else{ap.hidden=false;ap.dataset.mode=name;$('#addLinkBox').hidden=name!=='link';$('#addRefBox').hidden=name!=='ref';
      const b=name==='link'?$('#addLinkB'):$('#addRefB');b.classList.add('hot');b.setAttribute('aria-expanded','true');
      if(name==='link')setTimeout(()=>$('#linkIn').focus(),0)}
  }
  requestAnimationFrame(resizeBoard);
}
pBtn.onclick=()=>showPanel('propys');
function syncPM(){pressGroup($$('[data-pm]'),el=>el.dataset.pm===pMode)}
$$('[data-pm]').forEach(b=>b.onclick=()=>{pMode=b.dataset.pm;store.set('pmode',pMode);syncPM()});
$$('[data-pf]').forEach(b=>b.onclick=()=>{B.font=b.dataset.pf;store.set('pfont',B.font);if(sel){sel.font=B.font;saveTexts()}ensureFont(B.font);closePops();syncBoardUI();redraw()});
if(!FONTS[B.font])B.font='calli';
[...new Set([B.font,...strokes.filter(isText).map(o=>o.font)])].forEach(ensureFont);
$$('[data-q]').forEach(b=>b.onclick=()=>{$('#pText').value=b.dataset.q;$('#pRepeat').checked=b.dataset.q.length<8});
$('#pWrite').onclick=()=>{
  if(B.ruling==='plain'){B.ruling='slant';store.set('ruling','slant');syncBoardUI();drawBg()}
  const info=rowInfo(),o={kind:'text',x:Math.max(B.size*1.4,24),y:0,lines:[],color:B.color,font:B.font,k:1};
  const fs=fsOf(o),maxW=cw-o.x-16;txx.font=`${fs}px ${FONTS[o.font]}`;
  const segs=[];
  $('#pText').value.split('\n').forEach(line=>{
    line=line.trim();if(!line){segs.push('');return}
    if($('#pRepeat').checked){let t=line;while(txx.measureText(t+'   '+line).width<=maxW)t+='   '+line;segs.push(t);return}
    let c='';line.split(/\s+/).forEach(w=>{const t=c?c+' '+w:w;if(txx.measureText(t).width>maxW&&c){segs.push(c);c=w}else c=t});if(c)segs.push(c);
  });
  segs.forEach(t=>{
    if(pMode==='triple'&&t)o.lines.push({t,st:'solid'},{t,st:'light'},{t:'',st:'solid'});
    else o.lines.push({t,st:pMode==='light'?'light':'solid'});
    if($('#pSkip').checked)o.lines.push({t:'',st:'solid'});
  });
  while(o.lines.length&&!o.lines.at(-1).t)o.lines.pop();
  if(!o.lines.length)return;
  let bottom=-Infinity;strokes.forEach(s=>{if(isText(s))bottom=Math.max(bottom,s.y+(s.lines.length-1)*info.pitch)});
  o.y=bottom===-Infinity?info.rows[0].base:snapY(bottom+info.pitch);
  strokes.push(o);redoStack=[];sel=o;B.tool='move';syncBoardUI();saveTexts();redraw();
};
$('#pRemove').onclick=()=>{strokes=strokes.filter(s=>!isText(s));sel=null;saveTexts();redraw()};
syncPM();syncBoardUI();
if(document.fonts&&document.fonts.load)Promise.all([document.fonts.load('40px "Marck Script"','Ema ja isa'),document.fonts.load('40px "Bad Script"','Ema ja isa')]).then(()=>{ratioCache={};redraw()}).catch(()=>{});

/* ---------- Materials on the board: files, images, video, games, notes, reflection ---------- */
const layer=$('#objLayer');
const idb=(()=>{let p=null;
  const db=()=>p||(p=new Promise((res,rej)=>{try{const r=indexedDB.open('klasna-doshka',1);r.onupgradeneeded=()=>r.result.createObjectStore('files');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}catch(e){rej(e)}}));
  const tx=(mode,fn)=>db().then(d=>new Promise((res,rej)=>{const t=d.transaction('files',mode),st=t.objectStore('files'),q=fn(st);t.oncomplete=()=>res(q&&q.result);t.onerror=()=>rej(t.error)}));
  return{put:(k,v)=>tx('readwrite',s=>s.put(v,k)),get:k=>tx('readonly',s=>s.get(k)),del:k=>tx('readwrite',s=>s.delete(k)).catch(()=>{})};
})();
const urls=new Map();
let zTop=objs.reduce((m,o)=>Math.max(m,o.z||0),10);
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const clampN=(v,a,b)=>Math.min(Math.max(v,a),Math.max(a,b));
const fmtSize=n=>n>=1048576?(n/1048576).toFixed(1).replace('.',',')+' МБ':Math.max(1,Math.round(n/1024))+' КБ';
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function saveObjs(){store.set('objs',objs)}
function toast(m){const t=$('#bToast');t.textContent=m;t.hidden=false;clearTimeout(t._t);t._t=setTimeout(()=>t.hidden=true,4200)}
function place(el,o){Object.assign(el.style,{left:o.x+'px',top:o.y+'px',width:o.w+'px',height:o.h+'px',zIndex:o.z})}
function bringFront(o,el){if(o.z!==zTop){o.z=++zTop;el.style.zIndex=o.z;saveObjs()}}

const SV=p=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const ICON={open:SV('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/>'),
  max:SV('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  del:SV('<path d="M6 6l12 12M18 6L6 18"/>'),reset:SV('<path d="M4 12a8 8 0 108-8 8 8 0 00-6 2.7L4 9"/><path d="M4 4v5h5"/>')};
const NOTE_COLORS={yellow:'#FFF1A8',green:'#D2F0C8',pink:'#FFD6E0',blue:'#D3E5FF'};
const REF={
  mood:{title:'Reflektsioon: tuju',q:'Kuidas sa pärast tundi tunned?',items:['Suurepärane','Hea','Nii-nii','Murelik']},
  light:{title:'Reflektsioon: valgusfoor',q:'Kui hästi sa aine teemast aru said?',items:['Kõik on selge','On küsimusi','Vajan abi'],colors:['#2FA866','#F2B705','#E5484D']},
  ladder:{title:'Reflektsioon: eduastmed',q:'Millisel astmel sa oled?',items:['Võin teistele selgitada','Mõistan, aga teen veel vigu','Veel ei saa aru'],colors:['#2FA866','#7FB2FF','#F2B705']},
  sent:{title:'Reflektsioon: lõpetamata laused',q:'Jätka lauset',items:['Täna õppisin…','Mul oli raske…','Mulle meeldis…','Ma soovin veel…']}
};
const FACE_C=['#2FA866','#8CC63F','#F2B705','#F2645A'];
const FACE_M=['M15 29 Q26 42 37 29','M16 31 Q26 38 36 31','M17 33 L35 33','M16 37 Q26 28 36 37'];
const face=i=>`<svg viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24" fill="${FACE_C[i]}"/><circle cx="19" cy="21" r="3.2" fill="#1F2430"/><circle cx="33" cy="21" r="3.2" fill="#1F2430"/><path d="${FACE_M[i]}" stroke="#1F2430" stroke-width="3.2" fill="none" stroke-linecap="round"/></svg>`;
const titleOf=o=>({image:o.name||'Pilt',pdf:o.name||'PDF',file:o.name||'Fail',media:o.name||'Video',video:'Video',web:o.host||'Veebileht',note:'Märge',morph:'Sõna struktuur',reflect:(REF[o.tpl]||{}).title}[o.type]||'Materjal');

function withUrl(o,body,cb){
  if(urls.has(o.id))return cb(urls.get(o.id));
  body.innerHTML='<div class="obj-wait">Laen…</div>';
  idb.get(o.id).then(b=>{if(!b)throw 0;const u=URL.createObjectURL(b);urls.set(o.id,u);cb(u)})
    .catch(()=>{body.innerHTML='<div class="obj-wait">Faili ei leitud selles brauseris. Lisa see uuesti.</div>'});
}
const IFR=t=>`<iframe title="${esc(t)}" allow="autoplay; fullscreen; encrypted-media; picture-in-picture; clipboard-write; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;

function fillBody(o,body,el){
  const t=o.type;
  if(t==='image')return withUrl(o,body,u=>{body.innerHTML=`<img alt="${esc(o.name)}" draggable="false">`;body.firstChild.src=u});
  if(t==='pdf')return withUrl(o,body,u=>{body.innerHTML=IFR(o.name);body.firstChild.src=u;const a=el.querySelector('[data-fileopen]');if(a)a.href=u});
  if(t==='media')return withUrl(o,body,u=>{body.innerHTML=o.audio?'<audio controls></audio>':'<video controls playsinline></video>';body.firstChild.src=u});
  if(t==='file')return withUrl(o,body,u=>{
    const ext=(o.name.match(/\.([a-z0-9]{1,5})$/i)||[,'fail'])[1];
    body.innerHTML=`<div class="fcard"><div class="fext">${esc(ext)}</div><b>${esc(o.name)}</b><span class="muted">${fmtSize(o.size||0)}</span><a class="btn ghost" target="_blank" rel="noopener">Ava fail</a><p class="muted">Word, PowerPoint ja Excel avanevad arvutis selle rakenduses. Kui soovid dokumenti lihtsalt tahvlil näidata, salvesta see PDF-vormingusse või lisa Google Drive'i link.</p></div>`;
    const a=body.querySelector('a');a.href=u;a.download=o.name;const h=el.querySelector('[data-fileopen]');if(h){h.href=u;h.download=o.name}});
  if(t==='video'||t==='web'){
    body.innerHTML=IFR(titleOf(o))+(t==='web'?`<div class="obj-tip"><span>Tühi? Mõned veebilehed ei luba natiivselt teiste lehtede peal kuvamist.</span><a target="_blank" rel="noopener">Ava eraldi</a></div>`:'');
    body.querySelector('iframe').src=o.src;const a=body.querySelector('.obj-tip a');if(a)a.href=o.open;return;
  }
  if(t==='morph')return fillMorph(o,body,el);
  if(t==='note'){
    body.innerHTML='<div class="note-body" contenteditable="true" spellcheck="false" data-ph="Kirjuta märge…"></div>';
    const nb=body.firstChild;nb.textContent=o.text||'';nb.style.fontSize=(o.fs||20)+'px';
    nb.addEventListener('input',()=>{o.text=nb.innerText.replace(/\n$/,'');if(!o.text.trim())nb.innerHTML='';saveObjs()});return;
  }
  if(t==='reflect'){
    const R=REF[o.tpl];if(!R){body.innerHTML='<div class="obj-wait">Tundmatu mall</div>';return}
    if(o.tpl==='sent'){
      o.answers=o.answers||R.items.map(()=>'');
      body.innerHTML=`<div class="rf"><div class="rf-q">${R.q}</div>${R.items.map((s,i)=>`<label class="sent"><b>${s}</b><div contenteditable="true" spellcheck="false" data-i="${i}"></div></label>`).join('')}</div>`;
      body.querySelectorAll('[data-i]').forEach(d=>{d.textContent=o.answers[+d.dataset.i]||'';d.addEventListener('input',()=>{o.answers[+d.dataset.i]=d.innerText;saveObjs()})});return;
    }
    o.counts=o.counts||R.items.map(()=>0);
    const total=o.counts.reduce((a,b)=>a+b,0);
    const items=o.tpl==='mood'
      ?`<div class="faces">${R.items.map((s,i)=>`<button class="face" data-i="${i}" title="Klõps — lisa häält, parem klõps — vähenda">${face(i)}<span>${s}</span><b class="cnt">${o.counts[i]}</b></button>`).join('')}</div>`
      :`<div class="${o.tpl==='ladder'?'ladder':''}" style="display:flex;flex-direction:column;gap:8px">${R.items.map((s,i)=>`<button class="lrow" data-i="${i}" title="Klõps — lisa häält, parem klõps — vähenda"><span class="dot" style="background:${R.colors[i]}"></span><span>${s}</span><b class="cnt">${o.counts[i]}</b></button>`).join('')}</div>`;
    body.innerHTML=`<div class="rf"><div class="rf-q">${R.q}</div>${items}<div class="rf-total">Hääli kokku: ${total}</div></div>`;
    const bump=(i,d)=>{o.counts[i]=Math.max(0,o.counts[i]+d);saveObjs();fillBody(o,body,el)};
    body.querySelectorAll('[data-i]').forEach(b=>{b.onclick=()=>bump(+b.dataset.i,1);b.oncontextmenu=e=>{e.preventDefault();bump(+b.dataset.i,-1)}});
  }
}

function renderObj(o){
  const el=document.createElement('div');el.className='obj obj-'+o.type+(o.audio?' audio':'');el.dataset.id=o.id;
  if(o.type==='note')el.style.background=NOTE_COLORS[o.color]||NOTE_COLORS.yellow;
  let btns='';
  if(o.type==='note')btns+=Object.keys(NOTE_COLORS).map(c=>`<button class="ndot" data-nc="${c}" style="background:${NOTE_COLORS[c]}" aria-label="Märkme värv"></button>`).join('')+`<button class="obj-btn" data-act="fminus" title="Väiksem font" style="font-weight:800;font-size:12px">A−</button><button class="obj-btn" data-act="fplus" title="Suurem font" style="font-weight:800;font-size:13px">A+</button>`;
  if(o.type==='reflect'&&o.tpl!=='sent')btns+=`<button class="obj-btn" data-act="reset" title="Nulli hääled">${ICON.reset}</button>`;
  if(o.open)btns+=`<a class="obj-btn" href="${esc(o.open)}" target="_blank" rel="noopener" title="Ava uuel vahelehel">${ICON.open}</a>`;
  if(o.type==='pdf'||o.type==='file')btns+=`<a class="obj-btn" data-fileopen target="_blank" rel="noopener" title="Ava fail eraldi">${ICON.open}</a>`;
  btns+=`<button class="obj-btn" data-act="max" title="Täislehel / tagasi">${ICON.max}</button><button class="obj-btn" data-act="del" title="Eemalda tahvlist">${ICON.del}</button>`;
  el.innerHTML=`<div class="obj-h"><span class="obj-t" title="${esc(titleOf(o))}">${esc(titleOf(o))}</span>${btns}</div><div class="obj-b"></div><span class="obj-rz" title="Muuda suurust"></span>`;
  const body=el.querySelector('.obj-b'),hd=el.querySelector('.obj-h');
  fillBody(o,body,el);place(el,o);layer.appendChild(el);
  el.addEventListener('pointerdown',()=>bringFront(o,el),true);
  hd.addEventListener('pointerdown',e=>{if(e.target.closest('button,a'))return;startDrag(e,o,el,'move',hd)});
  const rz=el.querySelector('.obj-rz');rz.addEventListener('pointerdown',e=>startDrag(e,o,el,'size',rz));
  hd.addEventListener('dblclick',e=>{if(!e.target.closest('button,a'))toggleMax(o,el)});
  hd.addEventListener('click',e=>{
    const b=e.target.closest('[data-act],[data-nc]');if(!b)return;
    if(b.dataset.nc){o.color=b.dataset.nc;el.style.background=NOTE_COLORS[o.color];saveObjs();return}
    const a=b.dataset.act;
    if(a==='del')removeObj(o,el);
    else if(a==='max')toggleMax(o,el);
    else if(a==='reset'){o.counts=o.counts.map(()=>0);saveObjs();fillBody(o,body,el)}
    else if(a==='fplus'||a==='fminus'){o.fs=clampN((o.fs||20)+(a==='fplus'?4:-4),12,72);body.firstChild.style.fontSize=o.fs+'px';saveObjs()}
  });
  return el;
}
function toggleMax(o,el){
  if(o.prev){Object.assign(o,o.prev);delete o.prev}
  else{o.prev={x:o.x,y:o.y,w:o.w,h:o.h};Object.assign(o,{x:6,y:6,w:cw-12,h:ch-12})}
  bringFront(o,el);place(el,o);saveObjs();
}
function startDrag(e,o,el,mode,handle){
  if(e.button>0)return;e.preventDefault();
  const sx=e.clientX,sy=e.clientY,ox=o.x,oy=o.y,ow=o.w,oh=o.h;
  layer.classList.add('dragging');try{handle.setPointerCapture(e.pointerId)}catch(_){}
  const mv=ev=>{const dx=ev.clientX-sx,dy=ev.clientY-sy;
    if(mode==='move'){o.x=clampN(ox+dx,-o.w+80,cw-80);o.y=clampN(oy+dy,0,ch-34)}
    else{o.w=clampN(ow+dx,150,cw-o.x+40);o.h=clampN(oh+dy,90,ch-o.y+40)}
    delete o.prev;place(el,o)};
  const up=()=>{handle.removeEventListener('pointermove',mv);handle.removeEventListener('pointerup',up);handle.removeEventListener('pointercancel',up);layer.classList.remove('dragging');saveObjs()};
  handle.addEventListener('pointermove',mv);handle.addEventListener('pointerup',up);handle.addEventListener('pointercancel',up);
}
function removeObj(o,el){
  objs=objs.filter(x=>x!==o);el.remove();
  if(urls.has(o.id)){URL.revokeObjectURL(urls.get(o.id));urls.delete(o.id)}
  idb.del(o.id);saveObjs();syncBoardUI();
}
function clearObjs(){objs.slice().forEach(o=>{const el=layer.querySelector(`[data-id="${o.id}"]`);el?removeObj(o,el):idb.del(o.id)});objs=[];layer.innerHTML='';saveObjs();syncBoardUI()}
function addObj(o){
  o.id=o.id||uid();o.z=++zTop;
  o.w=Math.round(Math.min(o.w,Math.max(160,cw-20)));o.h=Math.round(Math.min(o.h,Math.max(100,ch-20)));
  const n=objs.length%6;
  o.x=Math.round(clampN((cw-o.w)/2-50+n*26,8,cw-o.w-8));o.y=Math.round(clampN((ch-o.h)/2-50+n*26,8,ch-o.h-8));
  objs.push(o);saveObjs();renderObj(o);
  if(B.tool!=='move'){commitEditor();B.tool='move';sel=null}
  syncBoardUI();redraw();
}

function addFile(file){
  if(!file)return;
  if(file.size>300*1048576){toast('Fail on liiga suur (üle 300 MB). Lisa selle asemel link.');return}
  const id=uid(),mime=file.type||'',name=file.name||'Fail';
  const isImg=mime.startsWith('image/'),isPdf=mime==='application/pdf'||/\.pdf$/i.test(name);
  const isVid=mime.startsWith('video/'),isAud=mime.startsWith('audio/');
  urls.set(id,URL.createObjectURL(file));
  idb.put(id,file).catch(()=>toast('Fail on nähtav, kuid brauser ei suutnud seda salvestada. Pärast lehe uuesti laadimist lisa see uuesti.'));
  if(isImg){
    const im=new Image();
    im.onload=()=>{const k=Math.min(1,(cw*.55)/im.naturalWidth,(ch*.7)/im.naturalHeight);addObj({id,type:'image',name,w:Math.max(160,im.naturalWidth*k),h:Math.max(100,im.naturalHeight*k+35)})};
    im.onerror=()=>addObj({id,type:'image',name,w:380,h:300});im.src=urls.get(id);return;
  }
  if(isVid)return addObj({id,type:'media',name,w:Math.min(560,cw*.6),h:Math.min(560,cw*.6)*9/16+35});
  if(isAud)return addObj({id,type:'media',audio:true,name,w:360,h:110});
  if(isPdf)return addObj({id,type:'pdf',name,size:file.size,w:Math.min(620,cw*.62),h:ch*.92});
  addObj({id,type:'file',name,size:file.size,w:320,h:300});
}

function parseEmbed(input){
  let s=(input||'').trim();if(!s)return null;
  const m=s.match(/<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["']/i);if(m)s=m[1].replace(/&amp;/g,'&');
  if(s.startsWith('//'))s='https:'+s;
  if(!/^https?:\/\//i.test(s))s='https://'+s;
  let u;try{u=new URL(s)}catch(e){return null}
  if(!/\./.test(u.hostname))return null;
  const host=u.hostname.replace(/^(www|m)\./,''),open=m?null:u.href;
  if(/(^|\.)youtube(-nocookie)?\.com$/.test(host)||host==='youtu.be'){
    const id=host==='youtu.be'?u.pathname.slice(1).split('/')[0]:(u.searchParams.get('v')||(u.pathname.match(/\/(embed|shorts|live|v)\/([\w-]{6,})/)||[])[2]);
    if(id){let st=0;const t=u.searchParams.get('t')||u.searchParams.get('start');
      if(t){const q=t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);if(q)st=(+q[1]||0)*3600+(+q[2]||0)*60+(+q[3]||0)}
      return{type:'video',src:`https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1${st?'&start='+st:''}`,open:`https://www.youtube.com/watch?v=${id}${st?'&t='+st+'s':''}`}}
    const list=u.searchParams.get('list');
    if(list)return{type:'video',src:`https://www.youtube-nocookie.com/embed/videoseries?list=${list}`,open:u.href};
  }
  if(host==='vimeo.com'){const v=u.pathname.match(/\/(\d+)/);if(v)return{type:'video',src:`https://player.vimeo.com/video/${v[1]}`,open:u.href}}
  if(host==='player.vimeo.com')return{type:'video',src:u.href,open:u.href};
  if(host==='docs.google.com'){
    const g=u.pathname.match(/^\/(document|presentation|spreadsheets)\/d\/([^/]+)/);
    if(g&&g[2]!=='e')return{type:'web',host:'Google '+({document:'Dokument',presentation:'Esitlus',spreadsheets:'Tabel'}[g[1]]),src:`https://docs.google.com/${g[1]}/d/${g[2]}/${g[1]==='presentation'?'embed?start=false&loop=false':'preview'}`,open:open||u.href};
    if(/^\/forms\//.test(u.pathname)){u.searchParams.set('embedded','true');return{type:'web',host:'Google Vorm',src:u.href,open:open||u.href}}
  }
  if(host==='drive.google.com'){const f=u.pathname.match(/\/file\/d\/([^/]+)/);if(f)return{type:'web',host:'Google Drive',src:`https://drive.google.com/file/d/${f[1]}/preview`,open:open||u.href}}
  if(host==='canva.com'&&/\/design\//.test(u.pathname)){const p=u.pathname.replace(/\/(edit|watch)$/,'/view');return{type:'web',host:'Canva',src:`https://www.canva.com${p.endsWith('/view')?p:p.replace(/\/$/,'')+'/view'}?embed`,open:open||u.href}}
  if(host==='learningapps.org'){const a=u.pathname.match(/^\/(\d+)$/);if(a)return{type:'web',host:'LearningApps',src:`https://learningapps.org/watch?app=${a[1]}`,open:open||u.href}}
  return{type:'web',host,src:u.href,open:open||u.href};
}
function addLink(text){
  const r=parseEmbed(text);if(!r)return false;
  if(r.type==='video'){const w=Math.min(640,cw*.62);addObj({type:'video',src:r.src,open:r.open,w,h:w*9/16+35})}
  else addObj({type:'web',src:r.src,open:r.open,host:r.host,w:Math.min(820,cw*.78),h:Math.min(560,ch*.88)});
  return true;
}

/* toolbar, panels, paste, drag and drop */
$('#addImgB').onclick=()=>$('#fImg').click();
$('#addFileB').onclick=()=>$('#fAny').click();
['#fImg','#fAny'].forEach(s=>$(s).addEventListener('change',e=>{[...e.target.files].forEach(addFile);e.target.value=''}));
$('#addLinkB').onclick=()=>showPanel('link');
$('#addRefB').onclick=()=>showPanel('ref');
$('#addNoteB').onclick=()=>{addObj({type:'note',color:['yellow','green','pink','blue'][objs.filter(o=>o.type==='note').length%4],text:'',w:250,h:200});
  const el=layer.lastElementChild;const nb=el&&el.querySelector('.note-body');if(nb)setTimeout(()=>nb.focus(),0)};
function doLinkAdd(){
  const v=$('#linkIn').value,err=$('#linkErr');
  if(!v.trim()){err.textContent='Sisesta link, näiteks https://www.youtube.com/watch?v=…';err.hidden=false;return}
  if(!addLink(v)){err.textContent='See ei paista olevat link. Klooni aadress brauserist või "Embed" kood.';err.hidden=false;return}
  err.hidden=true;$('#linkIn').value='';showPanel('link');
}
$('#linkAddB').onclick=doLinkAdd;
$('#linkIn').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();doLinkAdd()}});
$$('[data-tpl]').forEach(b=>b.onclick=()=>{const t=b.dataset.tpl;
  addObj({type:'reflect',tpl:t,w:t==='mood'?440:t==='sent'?420:400,h:t==='mood'?250:t==='sent'?400:t==='ladder'?280:270});showPanel('ref')});
document.addEventListener('paste',e=>{
  if($('#p-board').hidden||editing)return;
  const ae=document.activeElement;if(ae&&(ae.isContentEditable||/^(INPUT|TEXTAREA)$/.test(ae.tagName)))return;
  const cd=e.clipboardData;if(!cd)return;
  const files=[...cd.files];if(files.length){e.preventDefault();files.forEach(addFile);return}
  const t=(cd.getData('text')||'').trim();
  if(t&&/^(https?:\/\/|www\.|<iframe)/i.test(t)){e.preventDefault();addLink(t)}
  else if(t){e.preventDefault();addObj({type:'note',color:'yellow',text:t.slice(0,2000),w:280,h:200})}
});
let dragDepth=0;
const isOurDrag=e=>[...(e.dataTransfer?.types||[])].some(t=>t==='Files'||t==='text/uri-list');
cwrap.addEventListener('dragenter',e=>{if(!isOurDrag(e))return;e.preventDefault();dragDepth++;cwrap.classList.add('drop')});
cwrap.addEventListener('dragover',e=>{if(isOurDrag(e))e.preventDefault()});
cwrap.addEventListener('dragleave',()=>{if(--dragDepth<=0){dragDepth=0;cwrap.classList.remove('drop')}});
cwrap.addEventListener('drop',e=>{
  dragDepth=0;cwrap.classList.remove('drop');if(!isOurDrag(e))return;e.preventDefault();
  const files=[...e.dataTransfer.files];if(files.length){files.forEach(addFile);return}
  const t=e.dataTransfer.getData('text/uri-list')||e.dataTransfer.getData('text');if(t)addLink(t.split('\n')[0]);
});
objs.forEach(renderObj);
syncBoardUI();


/* ---- teacher's own copybook font ---- */
async function loadUserFont(buf,save){
  const ff=new FontFace('KDUserFont',buf);await ff.load();document.fonts.add(ff);
  ratioCache={};$$('[data-pf="user"]').forEach(b=>b.hidden=false);
  if(save){try{await idb.put('font:user',buf)}catch(e){toast('Font töötab, kuid brauser ei suutnud seda salvestada. Laadi järgmine kord uuesti üles.')}}
}
$('#fontUpB').onclick=()=>$('#fFont').click();
$('#fFont').addEventListener('change',async e=>{
  const f=e.target.files[0];e.target.value='';if(!f)return;
  try{await loadUserFont(await f.arrayBuffer(),true);B.font='user';store.set('pfont','user');
    if(sel){sel.font='user';saveTexts()}syncBoardUI();redraw();toast('Font «'+f.name+'» on ühendatud. Kiri kirjutatakse nüüd sellega.')}
  catch(err){toast('Fonti ei õnnestunud avada. Vajalik on TTF, OTF või WOFF fail.')}
});
(function detectLocalPropysy(){
  const names=['Propisi','Propisi Regular','Propisi-Regular','Propisi Est','PropisiEst','EstPropisi','Estonian Propisi','Propis','Propisy','Propysy','Propisi A','Propisi_A'];
  try{new FontFace('KDPropysyLocal',names.map(n=>`local("${n}")`).join(', ')).load().then(ff=>{document.fonts.add(ff);$$('[data-pf="local"]').forEach(b=>b.hidden=false);ratioCache={};redraw()}).catch(()=>{})}catch(e){}
})();
idb.get('font:user').then(b=>{if(b)return loadUserFont(b,false).then(()=>redraw())}).catch(()=>{});
/* ---------- Креслярські інструменти: лінійка, косинці, транспортир, циркуль ---------- */
const instSvg=$('#instSvg'),measureEl=$('#measure');
const ppc=()=>B.size*2;               /* 1 см = 2 клітинки, як у зошиті */
const cmTxt=px=>(px/ppc()).toFixed(1).replace('.',',')+' см';
const D2R=Math.PI/180;
function saveInsts(){store.set('insts',insts)}
function toWorld(o,lx,ly){const a=(o.rot||0)*D2R,c=Math.cos(a),s=Math.sin(a);return{x:o.x+lx*c-ly*s,y:o.y+lx*s+ly*c}}
function toLocal(o,p){const a=-(o.rot||0)*D2R,c=Math.cos(a),s=Math.sin(a),dx=p.x-o.x,dy=p.y-o.y;return{x:dx*c-dy*s,y:dx*s+dy*c}}

/* геометрія в локальних координатах (центр обертання = 0,0) */
function geom(o){
  const k=ppc();
  if(o.type==='ruler'){
    const pad=16,len=Math.max(3,Math.min(o.cm||15,Math.floor((cw*.92-2*pad)/k))),L=len*k+2*pad,H=Math.max(52,Math.min(70,k*.9));
    return{len,pad,L,H,poly:[[-L/2,-H/2],[L/2,-H/2],[L/2,H/2],[-L/2,H/2]],edges:[[0,1],[2,3]],knob:[L/2+20,0]};
  }
  if(o.type==='square'){
    const a=Math.max(60,Math.min(10*k,ch*.62,cw*.45)*(o.s||1)),b=o.kind==='60'?a*Math.tan(30*D2R):a;
    const cx=a/3,cy=-b/3;           /* центр ваги трикутника */
    return{a,b,poly:[[-cx,-cy],[a-cx,-cy],[-cx,-b-cy]],edges:[[0,1],[0,2],[1,2]],knob:[a/5-cx,-b/5-cy]};
  }
  if(o.type==='protractor'){
    const R=Math.max(90,Math.max(150,Math.min(4.5*k,ch*.42,cw*.3))*(o.s||1)),pts=[];
    for(let i=0;i<=36;i++){const t=Math.PI+i*Math.PI/36;pts.push([Math.cos(t)*(R+14),Math.sin(t)*(R+14)])}
    return{R,poly:[[-R-14,16],[R+14,16],...pts.reverse()],edges:[[0,1]],knob:[0,-R*.42],base:16};
  }
  return null;
}
function worldEdges(){
  const out=[];
  insts.forEach(o=>{const g=geom(o);if(!g||!g.edges)return;
    const W=g.poly.map(([x,y])=>toWorld(o,x,y));
    g.edges.forEach(([i,j])=>{
      let a=W[i],b=W[j];
      const dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy);let nx=-dy/l,ny=dx/l;
      const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;if((mx-o.x)*nx+(my-o.y)*ny<0){nx=-nx;ny=-ny}
      out.push({a,b,nx,ny,inst:o});
    });
  });
  return out;
}
function projEdge(e,p,w){
  const dx=e.b.x-e.a.x,dy=e.b.y-e.a.y,l2=dx*dx+dy*dy;
  const t=clampN(((p.x-e.a.x)*dx+(p.y-e.a.y)*dy)/l2,0,1),off=(w||2)/2+1;
  return{x:e.a.x+dx*t+e.nx*off,y:e.a.y+dy*t+e.ny*off};
}
function snapStart(c,p){
  if(c.tool!=='pen'&&c.tool!=='marker')return;
  let best=null,bd=26;
  worldEdges().forEach(e=>{const q=projEdge(e,p,0),d=Math.hypot(q.x-p.x,q.y-p.y);
    const dx=e.b.x-e.a.x,dy=e.b.y-e.a.y,t=((p.x-e.a.x)*dx+(p.y-e.a.y)*dy)/(dx*dx+dy*dy);
    if(t>-.02&&t<1.02&&d<bd){bd=d;best=e}});
  if(best){c.snap=best;const q=projEdge(best,p,c.w);c.pts=[q,{...q}]}
}
function showMeasure(a,b,extra){
  const l=Math.hypot(b.x-a.x,b.y-a.y);
  measureEl.textContent=extra||cmTxt(l);measureEl.hidden=false;
  measureEl.style.left=clampN(b.x+14,4,cw-90)+'px';measureEl.style.top=clampN(b.y-38,4,ch-34)+'px';
}
function hideMeasure(){measureEl.hidden=true}

/* малювання інструментів */
const PLASTIC='rgba(255,224,120,.82)',PLASTIC2='rgba(170,215,255,.78)',INK='#1F2430';
function svgRuler(o,g){
  const k=ppc(),x0=-g.L/2+g.pad,top=-g.H/2;let m='',n='';
  const step=k/10>=3.2?1:k/10>=1.6?2:5;
  for(let i=0;i<=g.len*10;i+=step){const x=x0+i*k/10,len=i%10===0?g.H*.38:i%5===0?g.H*.26:g.H*.16;m+=`M${x.toFixed(1)} ${top}v${len.toFixed(1)}`;
    if(i%10===0)n+=`<text x="${x.toFixed(1)}" y="${(top+g.H*.38+13).toFixed(1)}">${i/10}</text>`}
  return `<polygon points="${g.poly.join(' ')}" fill="${PLASTIC}" stroke="${INK}" stroke-width="1.2"/>
  <path d="${m}" stroke="${INK}" stroke-width="1"/><g class="inst-num">${n}</g>
  <text class="inst-unit" x="${(g.L/2-48).toFixed(1)}" y="${(g.H/2-12).toFixed(1)}">см</text>`;
}
function svgSquare(o,g){
  const k=ppc(),[A,Bp,C]=g.poly;let m='',n='';
  const step=k/10>=3.2?1:k/10>=1.6?2:5,maxmm=Math.floor(g.a/k*10)-3;
  for(let i=0;i<=maxmm;i+=step){const x=A[0]+i*k/10,len=i%10===0?16:i%5===0?11:7;m+=`M${x.toFixed(1)} ${A[1]}v${-len}`;
    if(i%10===0&&i>0)n+=`<text x="${x.toFixed(1)}" y="${(A[1]-26).toFixed(1)}">${i/10}</text>`}
  const hole=[[A[0]+g.a*.22,A[1]-g.b*.12],[A[0]+g.a*.55,A[1]-g.b*.12],[A[0]+g.a*.22,A[1]-g.b*.45]];
  return `<polygon points="${g.poly.join(' ')}" fill="${PLASTIC2}" stroke="${INK}" stroke-width="1.2"/>
  <polygon points="${hole.join(' ')}" fill="rgba(255,255,255,.35)" stroke="${INK}" stroke-width="1"/>
  <path d="${m}" stroke="${INK}" stroke-width="1"/><g class="inst-num">${n}</g>
  <path d="M${A[0]+14} ${A[1]}v-14h-14" fill="none" stroke="${INK}" stroke-width="1.2"/>
  <text class="inst-unit" x="${(A[0]+g.a*.62).toFixed(1)}" y="${(A[1]-g.b*.2).toFixed(1)}">${o.kind==='60'?'30° · 60°':'45°'}</text>`;
}
function svgProtractor(o,g){
  const R=g.R;let m='',n='';
  for(let d=0;d<=180;d++){const t=Math.PI+d*D2R,c=Math.cos(t),s=Math.sin(t),len=d%10===0?16:d%5===0?11:6;
    m+=`M${(c*R).toFixed(1)} ${(s*R).toFixed(1)}L${(c*(R-len)).toFixed(1)} ${(s*(R-len)).toFixed(1)}`;
    if(d%10===0){n+=`<text x="${(c*(R-28)).toFixed(1)}" y="${(s*(R-28)+4).toFixed(1)}">${d}</text>`;
      if(R>170)n+=`<text class="inner" x="${(c*(R-48)).toFixed(1)}" y="${(s*(R-48)+4).toFixed(1)}">${180-d}</text>`}}
  return `<polygon points="${g.poly.map(p=>p.map(v=>v.toFixed(1))).join(' ')}" fill="${PLASTIC2}" stroke="${INK}" stroke-width="1.2"/>
  <path d="${m}" stroke="${INK}" stroke-width="1"/><g class="inst-num">${n}</g>
  <path d="M${-R-14} 0H${R+14}M0 -10V10" stroke="${INK}" stroke-width="1.4"/><circle r="3" fill="${INK}"/>`;
}
const KNOB=(x,y)=>`<g class="inst-knob" data-h="rot" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle r="15"/><path d="M-6 3a7 7 0 1 0 2-8M-4-8v4h4" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/></g>`;
const XBTN=(x,y)=>`<g class="inst-x" data-h="del" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle r="11"/><path d="M-4-4l8 8M4-4l-8 8" stroke="#fff" stroke-width="2" stroke-linecap="round"/></g>`;

function compassGeom(o){
  const r=(o.rcm||3)*ppc(),a=o.ang||0,P={x:o.x+Math.cos(a)*r,y:o.y+Math.sin(a)*r};
  const leg=Math.max(r/2+40,170),h=Math.sqrt(Math.max(leg*leg-(r/2)**2,400));
  let nx=-Math.sin(a),ny=Math.cos(a);if(ny>0){nx=-nx;ny=-ny}   /* шарнір завжди вгору */
  const M={x:(o.x+P.x)/2,y:(o.y+P.y)/2},Hn={x:M.x+nx*h,y:M.y+ny*h},K={x:Hn.x+nx*26,y:Hn.y+ny*26};
  return{r,P,H:Hn,K};
}
function svgCompass(o){
  const g=compassGeom(o),f=v=>v.toFixed(1);
  return `<g class="inst" data-id="${o.id}">
   <circle cx="${f(o.x)}" cy="${f(o.y)}" r="${f(g.r)}" fill="none" stroke="var(--accent)" stroke-width="1" stroke-dasharray="4 6" opacity=".55" pointer-events="none"/>
   <line x1="${f(o.x)}" y1="${f(o.y)}" x2="${f(g.P.x)}" y2="${f(g.P.y)}" stroke="var(--accent)" stroke-width="1.4" stroke-dasharray="5 4" pointer-events="none"/>
   <line x1="${f(g.H.x)}" y1="${f(g.H.y)}" x2="${f(o.x)}" y2="${f(o.y)}" stroke="#5B6987" stroke-width="9" stroke-linecap="round" data-h="move"/>
   <line x1="${f(g.H.x)}" y1="${f(g.H.y)}" x2="${f(g.P.x)}" y2="${f(g.P.y)}" stroke="#7D8AA6" stroke-width="9" stroke-linecap="round" data-h="move"/>
   <line x1="${f(g.H.x)}" y1="${f(g.H.y)}" x2="${f(g.K.x)}" y2="${f(g.K.y)}" stroke="#5B6987" stroke-width="6" stroke-linecap="round" pointer-events="none"/>
   <circle class="inst-pt" cx="${f(o.x)}" cy="${f(o.y)}" r="9" data-h="move"><title>Neel: lohistage, et kompassi teisaldada</title></circle>
   <circle class="inst-pencil" cx="${f(g.P.x)}" cy="${f(g.P.y)}" r="10" data-h="radius"><title>Pliiats: lohistage, et raadiust muuta</title></circle>
   <g class="inst-knob draw" data-h="draw" transform="translate(${f(g.K.x)} ${f(g.K.y)})"><circle r="17"/><path d="M-7 2a7 7 0 1 0 3-8" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><path d="M-4-9l1 4 4-1" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><title>Keerake kätt — kompass joonistab</title></g>
   <g class="inst-label" transform="translate(${f(g.H.x+24)} ${f(g.H.y)})"><rect x="0" y="-15" width="${f(78+String(o.rcm).length*2)}" height="30" rx="8"/><text x="10" y="5">r = ${String(+(o.rcm||3).toFixed(1)).replace('.',',')} cm</text></g>
   <g class="inst-chipbtn" data-h="circle" transform="translate(${f(g.H.x+24)} ${f(g.H.y+22)})"><rect x="0" y="0" width="78" height="28" rx="8"/><text x="11" y="19">Ring</text></g>
   ${XBTN(g.H.x-24,g.H.y)}
  </g>`;
}
const SIZEH=(o,g)=>{const p=o.type==='ruler'?[g.L/2,g.H/2]:o.type==='square'?g.poly[1]:[g.R+14,16];
  return`<g class="inst-size" data-h="size" transform="translate(${p[0].toFixed(1)} ${p[1].toFixed(1)})"><rect x="-10" y="-10" width="20" height="20" rx="4"/><path d="M-4 4L4-4M0 4h4V0" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/><title>${o.type==='ruler'?'Lohista, et muuta joonlauda pikemaks või lühemaks':'Lohista, et suurust muuta'}</title></g>`};
function renderInsts(){
  let h='';
  insts.forEach(o=>{
    if(o.type==='compass'){h+=svgCompass(o);return}
    const g=geom(o),body=o.type==='ruler'?svgRuler(o,g):o.type==='square'?svgSquare(o,g):svgProtractor(o,g);
    const xb=o.type==='ruler'?[-g.L/2-18,0]:o.type==='square'?[g.poly[0][0]+16,g.poly[0][1]-g.b*.62]:[0,-g.R*.7];
    h+=`<g class="inst" data-id="${o.id}" transform="translate(${o.x.toFixed(1)} ${o.y.toFixed(1)}) rotate(${(o.rot||0).toFixed(2)})"><g data-h="move">${body}</g>${KNOB(...g.knob)}${XBTN(...xb)}${SIZEH(o,g)}${o.showLen?`<g class="inst-label" transform="translate(${(g.L/2-60).toFixed(1)} ${(-g.H/2-24).toFixed(1)})"><rect x="0" y="-15" width="70" height="30" rx="8"/><text x="10" y="5">${g.len} см</text></g>`:''}${o.showAng?`<g class="inst-label" transform="translate(${g.knob[0]+22} ${g.knob[1]}) rotate(${-(o.rot||0)})"><rect x="0" y="-15" width="58" height="30" rx="8"/><text x="10" y="5">${Math.round(((o.rot%360)+360)%360)}°</text></g>`:''}</g>`;
  });
  instSvg.innerHTML=h;
  pressGroup($$('[data-inst]'),el=>insts.some(o=>instKey(o)===el.dataset.inst));
}
const instKey=o=>o.type==='square'?'square'+o.kind:o.type;
function toggleInst(key){
  const ex=insts.find(o=>instKey(o)===key);
  if(ex){insts=insts.filter(o=>o!==ex)}
  else{
    const id=uid(),n=insts.length;
    const base={id,x:cw/2+n*24,y:ch/2+n*24,rot:0};
    if(key==='ruler')insts.push({...base,type:'ruler',cm:15});
    else if(key==='square45'||key==='square60')insts.push({...base,type:'square',kind:key==='square60'?'60':'45'});
    else if(key==='protractor')insts.push({...base,type:'protractor',y:Math.min(ch-24,Math.max(ch*.62,geom({type:'protractor'}).R+40))});
    else if(key==='compass')insts.push({...base,type:'compass',rcm:3,ang:0,x:cw/2-60,y:ch*.6});
    if(['move','text','eraser','morph'].includes(B.tool)){B.tool='pen'}
  }
  saveInsts();renderInsts();syncBoardUI();
}

/* перетягування, обертання, креслення циркулем */
let idrag=null;
instSvg.addEventListener('pointerdown',e=>{
  const hEl=e.target.closest('[data-h]'),gEl=e.target.closest('.inst');if(!hEl||!gEl)return;
  e.preventDefault();e.stopPropagation();
  const o=insts.find(x=>x.id===gEl.dataset.id);if(!o)return;
  const h=hEl.dataset.h,p=ptI(e);
  if(h==='del'){insts=insts.filter(x=>x!==o);saveInsts();renderInsts();syncBoardUI();return}
  if(h==='circle'){compassStroke(o,o.ang||0,(o.ang||0)+Math.PI*2);return}
  instSvg.setPointerCapture(e.pointerId);
  idrag={o,h,sx:p.x,sy:p.y,ox:o.x,oy:o.y,os:o.s||1,orot:o.rot||0,a0:Math.atan2(p.y-o.y,p.x-o.x)};
  if(h==='draw'){idrag.stroke={tool:'pen',color:B.color==='auto'?'auto':B.color,w:Math.max(2,B.width),pts:[compassGeom(o).P]};idrag.lastAng=o.ang||0;idrag.pAng=Math.atan2(p.y-o.y,p.x-o.x)}
});
const ptI=e=>{const r=instSvg.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}};
instSvg.addEventListener('pointermove',e=>{
  if(!idrag)return;const d=idrag,o=d.o,p=ptI(e);
  if(d.h==='move'){o.x=clampN(d.ox+p.x-d.sx,-50,cw+50);o.y=clampN(d.oy+p.y-d.sy,-50,ch+50)}
  else if(d.h==='size'){
    if(o.type==='ruler'){const g=geom(o),lp=toLocal(o,p);o.cm=clampN(Math.round((2*lp.x-2*g.pad)/ppc()),3,40);o.showLen=true}
    else{const d0=Math.hypot(d.sx-o.x,d.sy-o.y)||1;o.s=clampN((d.os||1)*Math.hypot(p.x-o.x,p.y-o.y)/d0,.45,2.6)}
  }
  else if(d.h==='rot'){let r=d.orot+(Math.atan2(p.y-o.y,p.x-o.x)-d.a0)/D2R;const s=Math.round(r/15)*15;if(Math.abs(r-s)<3)r=s;o.rot=r;o.showAng=true}
  else if(d.h==='radius'){let r=Math.hypot(p.x-o.x,p.y-o.y)/ppc();r=Math.round(r*10)/10;if(Math.abs(r-Math.round(r*2)/2)<.08)r=Math.round(r*2)/2;o.rcm=clampN(r,.5,20);o.ang=Math.atan2(p.y-o.y,p.x-o.x)}
  else if(d.h==='draw'){
    const a=Math.atan2(p.y-o.y,p.x-o.x);let da=a-d.pAng;if(da>Math.PI)da-=2*Math.PI;if(da<-Math.PI)da+=2*Math.PI;d.pAng=a;
    const steps=Math.max(1,Math.ceil(Math.abs(da)/(2*D2R)));
    for(let i=1;i<=steps;i++){o.ang=(o.ang||0)+da/steps;d.stroke.pts.push(compassGeom(o).P)}
    cur=d.stroke;redraw();
  }
  renderInsts();
});
const endI=()=>{if(!idrag)return;const d=idrag;idrag=null;
  if(d.h==='draw'&&d.stroke.pts.length>2){cur=null;strokes.push(d.stroke);redoStack=[];redraw()}else if(d.h==='draw'){cur=null;redraw()}
  if(d.o.showAng){delete d.o.showAng}
  if(d.o.showLen){delete d.o.showLen}
  saveInsts();renderInsts()};
instSvg.addEventListener('pointerup',endI);instSvg.addEventListener('pointercancel',endI);
function compassStroke(o,a0,a1){
  const st={tool:'pen',color:B.color,w:Math.max(2,B.width),pts:[]},n=Math.max(48,Math.round((o.rcm||3)*ppc()/3));
  for(let i=0;i<=n;i++){o.ang=a0+(a1-a0)*i/n;st.pts.push(compassGeom(o).P)}
  o.ang=a0;strokes.push(st);redoStack=[];saveInsts();renderInsts();redraw();
}

/* меню «Креслення» */
$('#instMenuB').onclick=e=>{e.stopPropagation();const open=$('#instPop').hidden;closePops();$('#instPop').hidden=!open;$('#instMenuB').setAttribute('aria-expanded',open)};
$$('[data-inst]').forEach(b=>b.onclick=()=>{toggleInst(b.dataset.inst);closePops()});
$('#instClearB').onclick=()=>{insts=[];saveInsts();renderInsts();syncBoardUI();closePops()};
new ResizeObserver(()=>renderInsts()).observe(cwrap);
renderInsts();
/* ---------- Будова слова: позначки на дошці та картка ---------- */
const MORPH={pref:'Eesliide',root:'Juur',suf:'Järelliide',end:'Lõpp',zero:'Nulllõpp',base:'Alus',post:'Pärastliide'};
/* форма позначки між x1 і x2 на висоті y; h — висота малих літер у рядку */
function morphPaths(k,x1,y1,x2,y2,h){
  const xa=Math.min(x1,x2),xb=Math.max(x1,x2),w=Math.max(xb-xa,8),y=y1,t=Math.max(8,h*.45);
  if(k==='root'){const hh=Math.min(Math.max(w*.28,10),h*1.1),pts=[];for(let i=0;i<=40;i++){const a=Math.PI*i/40;pts.push({x:xa+w*(1-Math.cos(a))/2,y:y-Math.sin(a)*hh})}return[pts]}
  if(k==='pref')return[[{x:xa,y},{x:xb,y},{x:xb,y:y+t}]];
  if(k==='post')return[[{x:xa,y:y+t},{x:xa,y},{x:xb,y}]];
  if(k==='suf'){const hh=Math.min(Math.max(w*.35,10),h*.9);return[[{x:xa,y},{x:(xa+xb)/2,y:y-hh},{x:xb,y}]]}
  if(k==='base')return[[{x:xa,y:y-t},{x:xa,y},{x:xb,y},{x:xb,y:y-t}]];
  if(k==='end'||k==='zero'){
    let ya=Math.min(y1,y2),yb=Math.max(y1,y2);
    if(k==='zero'){const s=Math.max(h*.9,16);return[[{x:x1,y:y1-s},{x:x1+s*.8,y:y1-s},{x:x1+s*.8,y:y1},{x:x1,y:y1},{x:x1,y:y1-s}]]}
    if(yb-ya<h*.8){ya=y-h*1.25;yb=y+h*.3}
    return[[{x:xa,y:ya},{x:xb,y:ya},{x:xb,y:yb},{x:xa,y:yb},{x:xa,y:ya}]];
  }
  return[];
}
const MORPH_ICON={
  pref:'<path d="M3 8h14v8"/>',root:'<path d="M3 17C5 6 19 6 21 17"/>',suf:'<path d="M4 17l8-10 8 10"/>',
  end:'<rect x="4" y="6" width="16" height="12" rx="1"/>',zero:'<rect x="8" y="8" width="8" height="8" rx="1"/>',
  base:'<path d="M3 9v8h18V9"/>',post:'<path d="M5 16V8h15"/>'};

/* позначки будови слова — окремі фігури: можна рухати, розтягувати, видаляти */
function markBox(k,x1,y1,x2,y2,xh){
  const xa=Math.min(x1,x2),w=Math.max(Math.abs(x2-x1),12);
  if(k==='zero'){const s=Math.max(xh*.9,16);return{x:x1,y:y1-s,w:s*.8,h:s}}
  if(k==='end'){let ya=Math.min(y1,y2),yb=Math.max(y1,y2);if(yb-ya<xh*.8){ya=y1-xh*1.25;yb=y1+xh*.3}return{x:xa,y:ya,w,h:yb-ya}}
  if(k==='root'){const h=Math.min(Math.max(w*.28,10),xh*1.1);return{x:xa,y:y1-h,w,h}}
  if(k==='suf'){const h=Math.min(Math.max(w*.35,10),xh*.9);return{x:xa,y:y1-h,w,h}}
  if(k==='base'){const h=Math.max(8,xh*.45);return{x:xa,y:y1-h,w,h}}
  const h=Math.max(8,xh*.45);return{x:xa,y:y1,w,h};          /* eesliide, järelliide */
}
function markPath(k,w,h){
  const f=v=>(+v).toFixed(1);
  if(k==='root')return`M0 ${f(h)}A${f(w/2)} ${f(h)} 0 0 1 ${f(w)} ${f(h)}`;
  if(k==='pref')return`M0 0H${f(w)}V${f(h)}`;
  if(k==='post')return`M0 ${f(h)}V0H${f(w)}`;
  if(k==='suf')return`M0 ${f(h)}L${f(w/2)} 0L${f(w)} ${f(h)}`;
  if(k==='base')return`M0 0V${f(h)}H${f(w)}V0`;
  return`M0 0H${f(w)}V${f(h)}H0Z`;
}
function renderMarks(){
  const svg=document.getElementById('markSvg');if(!svg)return;
  const list=strokes.filter(s=>s.kind==='mark');if(cur&&cur.kind==='mark')list.push(cur);
  svg.innerHTML=list.map(m=>{
    const d=markPath(m.k,m.w,m.h),on=m===selMark;
    return`<g class="mk${on?' on':''}" data-mid="${m.id}" transform="translate(${m.x.toFixed(1)} ${m.y.toFixed(1)})">
      <path class="mk-hit" d="${d}"/><path class="mk-line" d="${d}" stroke="${inkOf(m.color)}" stroke-width="${m.sw||3}"/>
      ${on?`<rect class="mk-box" x="-8" y="-8" width="${(m.w+16).toFixed(1)}" height="${(m.h+16).toFixed(1)}" rx="6"/>
      <circle class="mk-h" data-mh="w" cx="${(m.w+8).toFixed(1)}" cy="${(m.h/2).toFixed(1)}" r="9"><title>Lohista, et muuta laiemaks või kitsamaks</title></circle>
      <circle class="mk-h" data-mh="h" cx="${(m.w/2).toFixed(1)}" cy="${(m.k==='pref'||m.k==='post'?m.h+8:-8).toFixed(1)}" r="9"><title>Lohista, et kõrgust muuta</title></circle>
      <circle class="mk-h" data-mh="wh" cx="${(m.w+8).toFixed(1)}" cy="${(m.h+8).toFixed(1)}" r="9"><title>Lohista, et suurust muuta</title></circle>
      <g class="inst-x" data-mh="del" transform="translate(-20 -20)"><circle r="11"/><path d="M-4-4l8 8M4-4l-8 8" stroke="#fff" stroke-width="2" stroke-linecap="round"/></g>`:''}
    </g>`}).join('');
}
function morphStart(p){
  selMark=null;
  cur={kind:'mark',id:uid(),k:B.morph,color:B.color,sw:Math.max(2.5,B.width*.8),p0:p,x:p.x,y:p.y,w:12,h:12};morphUpdate(p);
}
function morphUpdate(p){const b=markBox(cur.k,cur.p0.x,cur.p0.y,p.x,p.y,rowInfo().xh);Object.assign(cur,b);renderMarks()}
function morphEnd(){
  if(!cur)return;const c=cur;cur=null;
  if(c.k!=='zero'&&c.k!=='end'&&c.w<14){renderMarks();toast('Joonista märk üle sõna osale — alates esimesest tähe-st kuni viimase täheni.');return}
  delete c.p0;strokes.push(c);redoStack=[];selMark=c;saveTexts();renderMarks();
}
const markSvgEl=$('#markSvg');
const ptM=e=>{const r=markSvgEl.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}};
markSvgEl.addEventListener('pointerdown',e=>{
  const g=e.target.closest('[data-mid]');if(!g)return;
  const m=strokes.find(s=>s.kind==='mark'&&s.id===g.dataset.mid);if(!m)return;
  e.preventDefault();e.stopPropagation();
  const h=e.target.closest('[data-mh]'),mode=h?h.dataset.mh:'move';
  if(mode==='del'){strokes=strokes.filter(s=>s!==m);selMark=null;saveTexts();renderMarks();return}
  selMark=m;const p=ptM(e);markSvgEl.setPointerCapture(e.pointerId);
  mdrag={m,mode,sx:p.x,sy:p.y,o:{x:m.x,y:m.y,w:m.w,h:m.h}};renderMarks();
});
markSvgEl.addEventListener('pointermove',e=>{
  if(!mdrag)return;const {m,mode,sx,sy,o}=mdrag,p=ptM(e),dx=p.x-sx,dy=p.y-sy;
  if(mode==='move'){m.x=o.x+dx;m.y=o.y+dy}
  if(mode==='w'||mode==='wh')m.w=Math.max(10,o.w+dx);
  if(mode==='wh')m.h=Math.max(6,o.h+dy);
  if(mode==='h'){if(m.k==='pref'||m.k==='post')m.h=Math.max(6,o.h+dy);else{const nh=Math.max(6,o.h-dy);m.y=o.y+o.h-nh;m.h=nh}}
  renderMarks();
});
const endM=()=>{if(mdrag){mdrag=null;saveTexts()}};
markSvgEl.addEventListener('pointerup',endM);markSvgEl.addEventListener('pointercancel',endM);
renderMarks();

/* картка «Будова слова» */
function fillMorph(o,body,el){
  o.marks=o.marks||[];
  body.innerHTML=`<div class="mw">
    <div class="mw-top"><input class="field mw-in" value="${esc(o.word||'')}" placeholder="Kirjuta sõna" aria-label="Sõna" spellcheck="false"><button class="chip mw-hide">${o.hidden?'Näita jaotust':'Peida jaotus'}</button></div>
    <div class="mw-stage"><svg class="mw-svg"></svg><div class="mw-word" style="font-family:${FONTS[o.font||'print']}"></div></div>
    <div class="mw-btns">${['pref','root','suf','end','zero','base','post'].map(k=>`<button class="chip" data-mk="${k}" title="${MORPH[k]}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${MORPH_ICON[k]}</svg>${MORPH[k]}</button>`).join('')}
      <button class="chip mw-clr">Kustuta märgid</button></div>
    <p class="mw-tip">Vali tähed hiirega või sõrmega, seejärel klõpsa, milline see sõna osa on.</p></div>`;
  const inp=body.querySelector('.mw-in'),wd=body.querySelector('.mw-word'),svg=body.querySelector('.mw-svg');
  let selA=null,selB=null;
  const letters=()=>[...wd.children];
  function drawWord(){
    wd.innerHTML=[...(o.word||'')].map((ch,i)=>`<span data-i="${i}">${esc(ch)}</span>`).join('');
    paint();
  }
  function paint(){
    const L=letters(),sr=wd.parentElement.getBoundingClientRect();
    L.forEach((s,i)=>s.classList.toggle('sel',selA!=null&&i>=Math.min(selA,selB)&&i<=Math.max(selA,selB)));
    if(!L.length||o.hidden){svg.innerHTML='';return}
    const rs=L.map(s=>{const r=s.getBoundingClientRect();return{l:r.left-sr.left,r:r.right-sr.left,t:r.top-sr.top,b:r.bottom-sr.top}});
    const top=Math.min(...rs.map(r=>r.t))+rs[0].b*0.0, bh=rs[0].b-rs[0].t, yTop=Math.min(...rs.map(r=>r.t))+bh*.12, yBot=Math.max(...rs.map(r=>r.b))-bh*.08, h=bh*.35;
    let d='';
    o.marks.forEach(m=>{
      const a=rs[Math.min(m.from,rs.length-1)],b=rs[Math.min(m.to,rs.length-1)];if(!a||!b)return;
      let paths;
      if(m.k==='end')paths=morphPaths('end',a.l-2,yTop+bh*.08,b.r+2,yBot,h);
      else if(m.k==='zero')paths=morphPaths('zero',b.r+6,yBot,0,0,bh*.55);
      else if(m.k==='base')paths=morphPaths('base',a.l,yBot+8,b.r,yBot+8,h);
      else paths=morphPaths(m.k,a.l+1,yTop,b.r-1,yTop,h);
      paths.forEach(pt=>d+=`<path d="M${pt.map(q=>q.x.toFixed(1)+' '+q.y.toFixed(1)).join('L')}"/>`);
    });
    svg.innerHTML=d;
  }
  wd.addEventListener('pointerdown',e=>{const s=e.target.closest('[data-i]');if(!s)return;e.preventDefault();selA=selB=+s.dataset.i;paint();
    const mv=ev=>{const t=document.elementFromPoint(ev.clientX,ev.clientY);const q=t&&t.closest&&t.closest('.mw-word [data-i]');if(q&&wd.contains(q)){selB=+q.dataset.i;paint()}};
    const up=()=>{document.removeEventListener('pointermove',mv);document.removeEventListener('pointerup',up)};
    document.addEventListener('pointermove',mv);document.addEventListener('pointerup',up)});
  body.querySelectorAll('[data-mk]').forEach(b=>b.onclick=()=>{
    if(!(o.word||'').length)return;
    let a=selA,z=selB;
    if(a==null){if(b.dataset.mk==='zero'||b.dataset.mk==='base'){a=0;z=o.word.length-1}else{toast('Vali kõigepealt selle sõnaosa tähed.');return}}
    const from=Math.min(a,z),to=Math.max(a,z),k=b.dataset.mk;
    if(k==='zero'){o.marks=o.marks.filter(m=>m.k!=='zero'&&m.k!=='end');o.marks.push({k,from:o.word.length-1,to:o.word.length-1})}
    else{if(k==='end')o.marks=o.marks.filter(m=>m.k!=='zero');o.marks=o.marks.filter(m=>!(m.k===k&&m.from===from&&m.to===to));o.marks.push({k,from,to})}
    o.hidden=false;body.querySelector('.mw-hide').textContent='Peida jaotus';selA=selB=null;saveObjs();paint();
  });
  body.querySelector('.mw-clr').onclick=()=>{
    if(selA!=null){const f=Math.min(selA,selB),t=Math.max(selA,selB);o.marks=o.marks.filter(m=>m.to<f||m.from>t)}else o.marks=[];
    selA=selB=null;saveObjs();paint()};
  body.querySelector('.mw-hide').onclick=e=>{o.hidden=!o.hidden;e.target.textContent=o.hidden?'Näita jaotust':'Peida jaotus';saveObjs();paint()};
  inp.addEventListener('input',()=>{o.word=inp.value.trim();o.marks=[];selA=selB=null;saveObjs();drawWord()});
  new ResizeObserver(()=>paint()).observe(wd);
  drawWord();
  if(document.fonts)document.fonts.ready.then(paint);
}

/* меню «Мова» */
$('#langMenuB').onclick=e=>{e.stopPropagation();const open=$('#langPop').hidden;closePops();$('#langPop').hidden=!open;$('#langMenuB').setAttribute('aria-expanded',open)};
$$('[data-morph]').forEach(b=>b.onclick=()=>{commitEditor();B.tool='morph';B.morph=b.dataset.morph;sel=null;closePops();syncBoardUI();redraw()});
$('#morphCardB').onclick=()=>{closePops();addObj({type:'morph',word:'lumikelluke',font:'print',marks:[{k:'pref',from:0,to:2},{k:'root',from:3,to:6},{k:'suf',from:7,to:9},{k:'zero',from:9,to:9},{k:'base',from:0,to:9}],w:Math.min(640,cw*.7),h:340})};
function toastAction(msg,label,fn){
  const el=$('#bToast');el.innerHTML='';const sp=document.createElement('span');sp.textContent=msg;el.appendChild(sp);
  const b=document.createElement('button');b.className='toast-btn';b.textContent=label;b.onclick=()=>{fn();el.hidden=true};el.appendChild(b);
  el.hidden=false;clearTimeout(el._t);el._t=setTimeout(()=>el.hidden=true,7000);
}
/* ================= COLUMN ================= */
const C={op:store.get('op','add'),lvl:store.get('lvl',1),rem:false,live:false,a:0,b:0,lay:null,solved:false,stars:store.get('stars',0)};
const OPSIGN={add:'+',sub:'−',mul:'×',div:':'};
const LVLHINT={
  add:['kahekohalised arvud','kolmekohalised arvud','nelja-viiekohalised arvud'],
  sub:['kahekohalised arvud','kolmekohalised arvud','nelja-viiekohalised arvud'],
  mul:['kahekohaline × ühekohaline','kolmekohaline × ühekohaline','kolmekohaline × kahekohaline'],
  div:['ühekohalisele, kahekohtne jagatis','ühekohalisele, kolmekohaline jagatis','kahekohalisele arvule']
};
const nd=n=>rnd(10**(n-1),10**n-1);
function gen(){
  const {op,lvl}=C;
  if(op==='add'){const n=[2,3,4][lvl];return[nd(lvl===2?rnd(4,5):n),nd(n)]}
  if(op==='sub'){const n=[2,3,4][lvl];let a,b;do{a=nd(lvl===2?rnd(4,5):n);b=nd(n)}while(a<=b);return[a,b]}
  if(op==='mul'){if(lvl===0)return[nd(2),rnd(2,9)];if(lvl===1)return[nd(3),rnd(2,9)];return[nd(3),rnd(1,9)*10+rnd(1,9)]}
  let d,q;
  if(lvl===0){d=rnd(2,9);q=rnd(12,99)} else if(lvl===1){d=rnd(2,9);q=rnd(102,999)} else {d=rnd(12,48);q=rnd(12,240)}
  let N=d*q; if(C.rem) N+=rnd(1,d-1); return[N,d];
}

function newLay(dir){return{cells:new Map(),under:[],vline:null,rows:0,cols:0,dir}}
function put(L,r,end,str,t){for(let k=0;k<str.length;k++){const c=end-(str.length-1-k);L.cells.set(r+','+c,{t,v:str[k]});L.rows=Math.max(L.rows,r+1);L.cols=Math.max(L.cols,c+1)}}
function sign(L,r,c,v,cls){L.cells.set(r+','+c,{t:'sign',v,cls});L.rows=Math.max(L.rows,r+1)}

function buildAS(a,b,op){
  const A=String(a),B2=String(b),R=String(op==='add'?a+b:a-b);
  const w=Math.max(A.length,B2.length,R.length),end=w,L=newLay('left');
  const sc=end-Math.max(A.length,B2.length);
  for(let c=Math.max(sc,1);c<end;c++) L.cells.set('0,'+c,{t:'carry'});
  put(L,1,end,A,'fix'); put(L,2,end,B2,'fix'); sign(L,1,sc,OPSIGN[op],'down');
  L.under.push({r:2,c1:Math.min(sc,end-R.length+1),c2:end});
  put(L,3,end,R,'in'); L.rows=4; L.cols=end+1; return L;
}
function buildMul(a,b){
  const A=String(a),B2=String(b),P=String(a*b),L=newLay('left');
  const parts=[...B2].reverse().map(d=>String(a*+d));
  const w=Math.max(A.length+1,B2.length+1,P.length,...parts.map((p,j)=>p.length+j)),end=w;
  const sc=end-Math.max(A.length,B2.length);
  for(let c=Math.max(1,end-A.length);c<end;c++) L.cells.set('0,'+c,{t:'carry'});
  put(L,1,end,A,'fix'); put(L,2,end,B2,'fix'); sign(L,1,sc,'×','down');
  const firstUsed=end-w+1;
  L.under.push({r:2,c1:Math.min(sc,end-Math.max(P.length,parts[0].length)+1),c2:end});
  if(parts.length===1){put(L,3,end,P,'in');L.rows=4}
  else{
    parts.forEach((p,j)=>put(L,3+j,end-j,p,'in'));
    const s0=Math.min(end-parts[0].length+1,end-1-parts[1].length+1)-1;
    sign(L,3,Math.max(0,s0),'+','down');
    const last=3+parts.length-1;
    L.under.push({r:last,c1:Math.max(firstUsed,end-P.length+1),c2:end});
    put(L,last+1,end,P,'in'); L.rows=last+2;
  }
  L.cols=end+1; return L;
}
function buildDiv(N,d){
  const S=String(N),D=String(d),n=S.length,L=newLay('right');
  put(L,0,n,S,'fix'); const dc=n+1; put(L,0,dc+D.length-1,D,'fix');
  let q='',i=0,cur=0;
  while(i<n&&cur<d){cur=cur*10+ +S[i];i++}
  let end=i,r=1,rem=0;
  while(true){
    const qd=Math.floor(cur/d); q+=qd; const prod=qd*d, ps=String(prod), cs=String(cur);
    put(L,r,end,ps,'in');
    const pS=end-ps.length+1,cS=end-cs.length+1;
    sign(L,r,Math.min(pS,cS)-1,'−','up');
    L.under.push({r,c1:Math.min(pS,cS),c2:end});
    rem=cur-prod; r++;
    if(i>=n){put(L,r,end,String(rem),'in');break}
    cur=rem*10+ +S[i]; i++; end=i;
    while(cur<d&&i<n){q+='0';cur=cur*10+ +S[i];i++;end=i}
    if(cur<d){q+='0';put(L,r,end,String(cur),'in');rem=cur;break}
    put(L,r,end,String(cur),'in'); r++;
  }
  put(L,1,dc+q.length-1,q,'in');
  const qw=Math.max(D.length,q.length);
  L.under.push({r:0,c1:dc,c2:dc+qw-1});
  L.vline={c:dc,r1:0,r2:1};
  L.cols=Math.max(L.cols,dc+qw); L.rows=Math.max(L.rows,2);
  L.q=q; L.rem=rem; return L;
}

function setProblem(a,b,focus){
  C.a=a;C.b=b;C.solved=false;
  const L=C.op==='div'?buildDiv(a,b):C.op==='mul'?buildMul(a,b):buildAS(a,b,C.op);
  C.lay=L; renderLay(L);
  let ex=`${a} ${OPSIGN[C.op]} ${b}`;
  if(C.op==='div'&&L.rem) ex+=' (jääkidega)';
  $('#expr').textContent=ex;
  $('#legend').textContent=C.op==='div'
    ? 'Kirjuta jagatis jagaja alla ja jagatavast allpool osad korrutised ja jääk. Sisesta numbrid vasakult paremale.'
    : C.op==='sub' ? 'Ülemine rida on koht, kus "laenad" kümneid (ei kontrollita). Kirjuta vastus paremalt vasakule.'
    : 'Ülemine rida on koht, kus hoiad numbreid peas (ei kontrollita). Kirjuta vastus paremalt vasakule.';
  $('#fb').textContent=''; $('#fb').className='feedback';
  if(focus){const f=firstInput();f&&f.focus()}
}
function renderLay(L){
  const nb=$('#nb'); nb.innerHTML=''; nb.style.gridTemplateColumns=`repeat(${L.cols},var(--cell))`;
  const und=new Set(); L.under.forEach(u=>{for(let c=u.c1;c<=u.c2;c++)und.add(u.r+','+c)});
  for(let r=0;r<L.rows;r++)for(let c=0;c<L.cols;c++){
    const k=r+','+c,info=L.cells.get(k),el=document.createElement('div'); el.className='cell';
    if(und.has(k)) el.classList.add('u');
    if(L.vline&&c===L.vline.c&&r>=L.vline.r1&&r<=L.vline.r2) el.classList.add('vl');
    if(info){
      if(info.t==='fix'){el.innerHTML=`<span class="fix">${info.v}</span>`}
      else if(info.t==='sign'){el.innerHTML=`<span class="sign ${info.cls}">${info.v}</span>`}
      else{
        const inp=document.createElement('input'); inp.id=`cl-${r}-${c}`; inp.maxLength=1; inp.inputMode='numeric'; inp.autocomplete='off';
        inp.dataset.r=r; inp.dataset.c=c;
        if(info.t==='carry'){inp.className='carry';inp.setAttribute('aria-label','pea meeles, veerg '+c)}
        else{inp.dataset.exp=info.v;inp.setAttribute('aria-label',`рядок ${r}, клітинка ${c}`)}
        el.appendChild(inp);
      }
    }
    nb.appendChild(el);
  }
}
const inputsAll=()=>$$('#nb input');
function firstInput(){
  const ins=inputsAll().filter(i=>i.dataset.exp);
  if(C.lay.dir==='right') return ins[0];
  const maxR=Math.min(...ins.map(i=>+i.dataset.r)); const row=ins.filter(i=>+i.dataset.r===maxR);
  return row.at(-1);
}
function findInput(r,c,dr,dc){
  const ins=inputsAll();
  if(dc){const row=ins.filter(i=>+i.dataset.r===r&&(dc<0?+i.dataset.c<c:+i.dataset.c>c));row.sort((x,y)=>dc<0?y.dataset.c-x.dataset.c:x.dataset.c-y.dataset.c);return row[0]}
  const rows=ins.filter(i=>dr<0?+i.dataset.r<r:+i.dataset.r>r); if(!rows.length)return null;
  const tr=dr<0?Math.max(...rows.map(i=>+i.dataset.r)):Math.min(...rows.map(i=>+i.dataset.r));
  const cand=rows.filter(i=>+i.dataset.r===tr); cand.sort((x,y)=>Math.abs(x.dataset.c-c)-Math.abs(y.dataset.c-c)); return cand[0];
}
function markOne(inp){inp.classList.remove('ok','err','shown');if(!inp.dataset.exp||!inp.value)return;inp.classList.add(inp.value===inp.dataset.exp?'ok':'err')}
const nb=$('#nb');
nb.addEventListener('input',e=>{
  const inp=e.target; const v=inp.value.replace(/\D/g,''); inp.value=v.slice(-1);
  inp.classList.remove('ok','err','shown'); if(C.live) markOne(inp);
  if(inp.value&&!inp.classList.contains('carry')){
    const nx=findInput(+inp.dataset.r,+inp.dataset.c,0,C.lay.dir==='left'?-1:1);
    if(nx&&!nx.classList.contains('carry')) nx.focus();
  }
  if(C.live&&inputsAll().filter(i=>i.dataset.exp).every(i=>i.value===i.dataset.exp)) doCheck();
});
nb.addEventListener('keydown',e=>{
  const inp=e.target; if(inp.tagName!=='INPUT')return; const r=+inp.dataset.r,c=+inp.dataset.c; let nx=null;
  if(e.key==='ArrowLeft')nx=findInput(r,c,0,-1); else if(e.key==='ArrowRight')nx=findInput(r,c,0,1);
  else if(e.key==='ArrowUp')nx=findInput(r,c,-1,0); else if(e.key==='ArrowDown')nx=findInput(r,c,1,0);
  else if(e.key==='Backspace'&&!inp.value){nx=findInput(r,c,0,C.lay.dir==='left'?1:-1); if(nx&&nx.classList.contains('carry'))nx=null; if(nx){nx.value='';nx.classList.remove('ok','err','shown')}}
  if(nx){e.preventDefault();nx.focus();nx.select()}
});
nb.addEventListener('focusin',e=>{if(e.target.tagName==='INPUT')e.target.select()});

let lastNumericTarget=null;
function isNumericTarget(target){
  return !!target && target.matches && target.matches('#ownA, #ownB, #nb input');
}
function getActiveNumericTarget(){
  const active=document.activeElement;
  if(isNumericTarget(active)) return active;
  return lastNumericTarget && isNumericTarget(lastNumericTarget) ? lastNumericTarget : null;
}
function useNumericPad(target){
  if(!isNumericTarget(target)) return;
  lastNumericTarget=target;
  target.focus();
  if(target.tagName==='INPUT' && typeof target.select==='function') target.select();
}
function writeNumericValue(value){
  const active=getActiveNumericTarget();
  if(!active || !isNumericTarget(active)) return;
  const isCell=active.matches('#nb input');
  if(value==='clear'){active.value='';}
  else if(value==='backspace'){active.value=isCell?'':active.value.slice(0,-1);}
  else if(isCell){active.value=value;}
  else{
    const limit=Number(active.maxLength) || 7;
    const next=(active.value+value).replace(/\D/g,'').slice(0,limit);
    active.value=next;
  }
  active.focus();
  if(typeof active.select==='function') active.select();
  active.dispatchEvent(new Event('input',{bubbles:true}));
}

document.addEventListener('focusin',e=>{ if(isNumericTarget(e.target)) { lastNumericTarget=e.target; useNumericPad(e.target); } });

document.addEventListener('click',e=>{
  const key=e.target.closest('[data-number]');
  if(key){writeNumericValue(key.dataset.number); return;}
  const action=e.target.closest('[data-action]');
  if(action){writeNumericValue(action.dataset.action);}
});

function doCheck(){
  const ins=inputsAll().filter(i=>i.dataset.exp); let wrong=0,empty=0;
  ins.forEach(i=>{i.classList.remove('ok','err','shown');if(!i.value){empty++;return}const ok=i.value===i.dataset.exp;i.classList.add(ok?'ok':'err');if(!ok)wrong++});
  const fb=$('#fb');
  if(!wrong&&!empty){
    let msg='Kõik on õigesti! Tubli!';
    if(C.op==='div'&&C.lay.rem) msg+=` Vastus: ${C.lay.q} (jääk ${C.lay.rem}).`;
    fb.textContent=msg; fb.className='feedback ok';
    if(!C.solved){C.solved=true;C.stars++;store.set('stars',C.stars);$('#starN').textContent=C.stars}
  } else {
    const parts=[]; if(wrong)parts.push(`vigade arv: ${wrong}`); if(empty)parts.push(`tühjad lahtrid: ${empty}`);
    fb.textContent=`Peaaegu! ${parts.join(', ')}. Paranda punased lahtrid.`; fb.className='feedback err';
  }
}
$('#checkB').onclick=doCheck;
$('#newB').onclick=()=>{const[a,b]=gen();setProblem(a,b,true)};
$('#wipeB').onclick=()=>{inputsAll().forEach(i=>{i.value='';i.classList.remove('ok','err','shown')});$('#fb').textContent=''};
$('#showB').onclick=()=>{inputsAll().forEach(i=>{if(i.dataset.exp&&i.value!==i.dataset.exp){i.value=i.dataset.exp;i.classList.remove('ok','err');i.classList.add('shown')}});C.solved=true;$('#fb').textContent='Siin on õige lahendus. Proovi ise uuesti uut ülesannet.';$('#fb').className='feedback'};
$('#liveC').onchange=e=>{C.live=e.target.checked;inputsAll().forEach(i=>C.live?markOne(i):i.classList.remove('ok','err'))};
$('#remC').onchange=e=>{C.rem=e.target.checked;const[a,b]=gen();setProblem(a,b)};

function syncColUI(){
  pressGroup($$('[data-op]'),el=>el.dataset.op===C.op);
  pressGroup($$('[data-lvl]'),el=>+el.dataset.lvl===C.lvl);
  $('#lvlHint').textContent=LVLHINT[C.op][C.lvl];
  $('#remWrap').hidden=C.op!=='div'; $('#ownSign').textContent=OPSIGN[C.op];
}
$$('[data-op]').forEach(b=>b.onclick=()=>{C.op=b.dataset.op;store.set('op',C.op);syncColUI();$('#ownErr').hidden=true;const[a,c]=gen();setProblem(a,c)});
$$('[data-lvl]').forEach(b=>b.onclick=()=>{C.lvl=+b.dataset.lvl;store.set('lvl',C.lvl);syncColUI();const[a,c]=gen();setProblem(a,c)});
$('#ownBtn').onclick=()=>{
  const ea=$('#ownErr'),sa=$('#ownA').value.trim(),sb=$('#ownB').value.trim();
  const err=m=>{ea.textContent=m;ea.hidden=false};
  if(!/^\d{1,7}$/.test(sa)||!/^\d{1,7}$/.test(sb)) return err('Sisesta kaks täisarvu (kuni 7 kohta).');
  const a=+sa,b=+sb;
  if(C.op==='sub'&&a<b) return err('Vähendatav peab olema suurem või võrdne lahutatava väärtusega.');
  if(C.op==='div'&&b===0) return err('Nulliga jagada ei saa.');
  if(C.op==='div'&&a<b) return err('Jagatav peab olema suurem või võrdne jagajaga.');
  if(C.op==='mul'&&String(b).length>3) return err('Teine tegur võib olla kuni 3 kohta.');
  ea.hidden=true; setProblem(a,b,true);
};
$('#starN').textContent=C.stars;
syncColUI(); setProblem(...(C.op==='div'?[756,4]:gen()));

/* ================= TOOLS ================= */
/* Timer */
const T={mode:'timer',total:180000,left:180000,sw:0,run:false,t0:0,base:0,iv:null};
let actx=null;
const fmt=(ms,tenths)=>{const s=Math.floor(ms/1000),m=Math.floor(s/60);let o=String(m).padStart(2,'0')+':'+String(s%60).padStart(2,'0');if(tenths)o+='.'+Math.floor(ms%1000/100);return o};
function tShow(){$('#tDisp').textContent=T.mode==='timer'?fmt(Math.ceil(T.left/1000)*1000):fmt(T.sw,true);$('#tStart').textContent=T.run?'Paus':'Start'}
function tTick(){const el=Date.now()-T.t0;if(T.mode==='timer'){T.left=Math.max(0,T.base-el);if(!T.left){tStop();tDone()}}else T.sw=T.base+el;tShow()}
function tStop(){T.run=false;clearInterval(T.iv);tShow()}
function beep(){if(!actx)return;[0,.45,.9].forEach(t=>{const o=actx.createOscillator(),g=actx.createGain();o.frequency.value=880;o.connect(g);g.connect(actx.destination);const s=actx.currentTime+t;g.gain.setValueAtTime(.0001,s);g.gain.exponentialRampToValueAtTime(.3,s+.02);g.gain.exponentialRampToValueAtTime(.0001,s+.35);o.start(s);o.stop(s+.4)})}
function tDone(){const t=$('#timerT');t.classList.remove('ring');void t.offsetWidth;t.classList.add('ring');beep();$('#tDisp').textContent='00:00'}
$('#tStart').onclick=()=>{
  try{actx=actx||new (window.AudioContext||window.webkitAudioContext)();actx.resume&&actx.resume()}catch(e){}
  if(T.run){tStop();return}
  if(T.mode==='timer'&&!T.left)T.left=T.total;
  T.run=true;T.t0=Date.now();T.base=T.mode==='timer'?T.left:T.sw;T.iv=setInterval(tTick,100);$('#timerT').classList.remove('ring');tShow();
};
$('#tReset').onclick=()=>{tStop();T.left=T.total;T.sw=0;$('#timerT').classList.remove('ring');tShow()};
$$('[data-min]').forEach(b=>b.onclick=()=>{tStop();T.mode='timer';T.total=T.left=+b.dataset.min*60000;syncT();tShow()});
$$('[data-add]').forEach(b=>b.onclick=()=>{if(T.mode!=='timer')return;const was=T.run;tStop();T.left=Math.max(10000,T.left+ +b.dataset.add*1000);T.total=T.left;tShow();if(was)$('#tStart').click()});
function syncT(){pressGroup($$('[data-tmode]'),el=>el.dataset.tmode===T.mode);$('#tPresets').hidden=T.mode!=='timer'}
$$('[data-tmode]').forEach(b=>b.onclick=()=>{tStop();T.mode=b.dataset.tmode;syncT();tShow()});
tShow();

/* Picker */
const SAMPLE='Andres\nKati\nMarten\nLiisa\nRasmus\nEva\nJoosep\nMaria\nPeeter\nAnni\nKaire\nTõnis';
const namesEl=$('#names'); namesEl.value=store.get('names',SAMPLE);
let used=new Set();
namesEl.addEventListener('input',()=>store.set('names',namesEl.value));
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
$('#pickB').onclick=()=>{
  const names=namesEl.value.split('\n').map(s=>s.trim()).filter(Boolean),out=$('#pickOut');
  if(!names.length){out.textContent='Lisa nimed loendisse';out.className='picked';return}
  const pool=$('#noRep').checked?names.filter(n=>!used.has(n)):names;
  if(!pool.length){out.textContent='Kõik on juba valitud. Vajuta «Lähtesta»';out.className='picked';return}
  const pick=pool[rnd(0,pool.length-1)]; used.add(pick);
  if(reduce){out.textContent=pick;out.className='picked final';return}
  let i=0;const steps=14;out.className='picked';
  (function spin(){if(i<steps){out.textContent=names[rnd(0,names.length-1)];i++;setTimeout(spin,40+i*i*2)}else{out.textContent=pick;out.className='picked final'}})();
};
$('#pickReset').onclick=()=>{used.clear();$('#pickOut').textContent='Loend lähtestatud';$('#pickOut').className='picked'};

/* Dice */
const PIPS={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
let diceN=2;
function roll(anim){
  const box=$('#dice');box.innerHTML='';let sum=0;
  for(let k=0;k<diceN;k++){const v=k===0&&!anim?3:k===1&&!anim?4:rnd(1,6);sum+=v;const d=document.createElement('div');d.className='die'+(anim?' roll':'');d.setAttribute('aria-label','täring: '+v);
    for(let p=0;p<9;p++){const i=document.createElement('i');if(PIPS[v].includes(p))i.className='on';d.appendChild(i)} box.appendChild(d)}
  $('#diceSum').textContent=diceN>1?'Summa: '+sum:'Said: '+sum;
}
$$('[data-n]').forEach(b=>b.onclick=()=>{diceN=+b.dataset.n;pressGroup($$('[data-n]'),el=>+el.dataset.n===diceN);roll(true)});
$('#rollB').onclick=()=>roll(true); roll(false);
$('#rB').onclick=()=>{let a=parseInt($('#rFrom').value),b=parseInt($('#rTo').value);if(isNaN(a)||isNaN(b)){$('#rOut').textContent='?';return}if(a>b)[a,b]=[b,a];$('#rOut').textContent=rnd(a,b)};

/* Multiplication table */
const mt=$('#mt');let mtSel=null;const revealed=new Set();
function buildMT(){
  let h='<tr><th>×</th>'+Array.from({length:10},(_,i)=>`<th data-c="${i+1}">${i+1}</th>`).join('')+'</tr>';
  for(let r=1;r<=10;r++){h+=`<tr><th data-r="${r}">${r}</th>`;for(let c=1;c<=10;c++)h+=`<td data-r="${r}" data-c="${c}"></td>`;h+='</tr>'}
  mt.innerHTML=h; paintMT();
}
function paintMT(){
  const hide=$('#mtHide').checked;
  mt.querySelectorAll('td').forEach(td=>{const r=+td.dataset.r,c=+td.dataset.c,k=r+'x'+c;
    td.textContent=hide&&!revealed.has(k)?'':r*c;
    td.classList.toggle('sel',!!mtSel&&mtSel[0]===r&&mtSel[1]===c);
    td.classList.toggle('hl',!!mtSel&&(mtSel[0]===r||mtSel[1]===c)&&!(mtSel[0]===r&&mtSel[1]===c)&&(r<=mtSel[0]&&c<=mtSel[1]))});
  mt.querySelectorAll('th').forEach(th=>th.classList.toggle('hl',!!mtSel&&(+th.dataset.r===mtSel[0]||+th.dataset.c===mtSel[1])));
}
mt.addEventListener('click',e=>{const td=e.target.closest('td');if(!td)return;const r=+td.dataset.r,c=+td.dataset.c;mtSel=[r,c];revealed.add(r+'x'+c);$('#mtOut').textContent=`${r} × ${c} = ${r*c}`;paintMT()});
$('#mtHide').onchange=()=>{revealed.clear();mtSel=null;$('#mtOut').textContent='Puuduta lahtrit';paintMT()};
buildMT();

/* Sound scheme */
const VOW='aeiouõäöüy',FRONT_VOW='eiyäöü',ESTONIAN_LETTERS=new Set('abcdefghijklmnopqrsšzžtuvõäöüxy'.split(''));
const APOS="'’ʼ`";
function normalizeWord(word){
  const lower=word.toLowerCase().trim();
  let out='';
  for(const ch of lower){
    if(APOS.includes(ch) || ESTONIAN_LETTERS.has(ch)) out+=ch;
  }
  return out;
}
function classifyConsonant(ch,next){
  if(/[gbdkpt]/.test(ch)) return 'blocked';
  if(ch==='j') return 'open';
  const frontVowel=next&&/[eiyäöü]/.test(next);
  if(frontVowel && /[lnrmlvfhcšzž]/.test(ch)) return 'open';
  return 'open';
}
function analyze(word){
  const w=normalizeWord(word),out=[];
  for(let i=0;i<w.length;i++){
    const ch=w[i],next=w[i+1];
    if(APOS.includes(ch)){out.push({l:'’',s:[]});continue}
    if(/[aeiouõäöüy]/.test(ch)){out.push({l:ch,s:['vowel']});continue}
    out.push({l:ch,s:[classifyConsonant(ch,next)]});
  }
  return out;
}
function countSyllables(word){
  const w=normalizeWord(word);
  let count=0;
  for(let i=0;i<w.length;i++){
    if(!/[aeiouõäöüy]/.test(w[i])) continue;
    if(i===0){count++;continue;}
    const prev=w[i-1];
    if(!/[aeiouõäöüy]/.test(prev)){
      count++;
      continue;
    }
    if(/[iu]/.test(prev) && !/[iu]/.test(w[i])){
      count++;
    }
  }
  return count;
}
function countSounds(word){
  const w=normalizeWord(word).replace(/[’'ʼ`]/g,'');
  let count=0;
  for(let i=0;i<w.length;i++){
    if(i===0 || w[i]!==w[i-1]) count++;
  }
  return count;
}
let scheme=[];
function drawScheme(){
  const box=$('#scheme');box.innerHTML='';
  scheme.forEach((t,ti)=>{const lt=document.createElement('div');lt.className='lt';
    lt.innerHTML=`<b>${t.l}</b>`;const row=document.createElement('div');row.className='sq-row';
    if(!t.s.length) row.innerHTML='<span class="none">—</span>';
    t.s.forEach((s,si)=>{const label=s==='vowel'?'täishäälik':s==='open'?'sulguta kaashäälik':'sulghäälik';const b=document.createElement('button');b.className='sq '+s;b.setAttribute('aria-label',`${t.l}: ${label}`);
      b.onclick=()=>{const order=['vowel','open','blocked'];t.s[si]=order[(order.indexOf(s)+1)%3];drawScheme()};row.appendChild(b)});
    lt.appendChild(row);box.appendChild(lt)});
  const wordText=$('#word').value || '';
  const letters=normalizeWord(wordText).replace(/[’'ʼ`]/g,'').length;
  const sounds=countSounds(wordText),syl=countSyllables(wordText);
  $('#wStat').innerHTML=scheme.length?`<span>Tähti: ${letters}</span><span>Häälikuid: ${sounds}</span><span>Silpe: ${syl}</span>`:'';
}
function buildWord(){scheme=analyze($('#word').value);if(!scheme.length){$('#scheme').innerHTML='<p class="muted">Sisesta sõna eesti tähtedega</p>';$('#wStat').innerHTML='';return}drawScheme()}
$('#wordB').onclick=buildWord;$('#word').addEventListener('keydown',e=>{if(e.key==='Enter')buildWord()});buildWord();

/* Number composition */
let hN=6;
const hBox=$('#houseN');
for(let n=2;n<=10;n++){const b=document.createElement('button');b.className='chip';b.textContent=n;b.dataset.h=n;b.onclick=()=>{hN=n;buildHouse()};hBox.appendChild(b)}
function buildHouse(){
  pressGroup($$('[data-h]'),el=>+el.dataset.h===hN);$('#roof').textContent=hN;
  const f=$('#floors');f.innerHTML='';
  for(let k=1;k<hN;k++){const hideLeft=Math.random()<.5,pair=[k,hN-k];
    pair.forEach((v,side)=>{const d=document.createElement('div');
      if((side===0)===hideLeft){const inp=document.createElement('input');inp.inputMode='numeric';inp.maxLength=2;inp.id=`h-${k}-${side}`;inp.setAttribute('aria-label',`${hN}: пропущене число`);
        inp.oninput=()=>{inp.value=inp.value.replace(/\D/g,'');inp.classList.remove('ok','err');if(inp.value)inp.classList.add(+inp.value===v?'ok':'err')};d.appendChild(inp)}
      else d.textContent=v;f.appendChild(d)})}
}
$('#houseB').onclick=buildHouse;buildHouse();

/* Clock */
const NOM=['kaksteist','üks','kaks','kolm','neli','viis','kuus','seitse','kaheksa','üheksa','kümme','üheteistkümme','kaksteist'];
const ACC=['kaksteistkuut','üht','kaks','kolm','neli','viit','kuut','seitsmet','kaheksat','üheksat','kümmet','üheteistkümmet','kaksteistkuut'];
const MW={5:'viis minutit',10:'kümme minutit',20:'kakskümmend minutit',25:'kakskümmend viis minutit'};
const plur=n=>{const a=n%10,b=n%100;return a===1&&b!==11?'minut':a>=2&&a<=4&&(b<12||b>14)?'minutit':'minutit'};
const minW=n=>MW[n]||`${n} ${plur(n)}`;
function timeWords(tm){
  const H=Math.floor(tm/60)||12,M=tm%60,nx=H%12+1;let s;
  if(M===0)s=`${NOM[H]} koht`;else if(M===30)s=`pool ${ACC[nx]}`;else if(M===15)s=`veerand ${ACC[nx]}`;
  else if(M===45)s=`veerand läbi ${NOM[nx]}`;else if(M<30)s=`${minW(M)} ${ACC[nx]}`;else s=`${minW(60-M)} ${NOM[nx]}`;
  return s[0].toUpperCase()+s.slice(1);
}
const digT=tm=>`${Math.floor(tm/60)||12}:${String(tm%60).padStart(2,'0')}`;
const K={tm:3*60+15,mode:'free',step:store.get('ckstep',15),target:0,drag:null};
const clk=$('#clock');
(function buildClock(){
  let s='<circle class="face" cx="110" cy="110" r="102"/>';
  for(let i=0;i<60;i++){const a=i*6*Math.PI/180,h=i%5===0,r1=h?88:93;s+=`<line class="tick${h?' h':''}" x1="${110+Math.sin(a)*r1}" y1="${110-Math.cos(a)*r1}" x2="${110+Math.sin(a)*98}" y2="${110-Math.cos(a)*98}"/>`}
  for(let n=1;n<=12;n++){const a=n*30*Math.PI/180;s+=`<text x="${110+Math.sin(a)*74}" y="${110-Math.cos(a)*74}">${n}</text>`}
  s+='<line class="hh" id="hh" x1="110" y1="118" x2="110" y2="58"/><line class="mh" id="mh" x1="110" y1="122" x2="110" y2="30"/><circle class="hub" cx="110" cy="110" r="6"/>';
  clk.innerHTML=s;
})();
function drawClock(){
  $('#hh').setAttribute('transform',`rotate(${K.tm*.5} 110 110)`);
  $('#mh').setAttribute('transform',`rotate(${(K.tm%60)*6} 110 110)`);
  const free=K.mode==='free';
  $('#ckDig').textContent=digT(K.tm);$('#ckWrd').textContent=timeWords(K.tm);
  $('#ckDig').hidden=!(free&&$('#ckDigC').checked);$('#ckWrd').hidden=!(free&&$('#ckWrdC').checked);
}
function angAt(e){const r=clk.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*220-110,y=(e.clientY-r.top)/r.height*220-110;let a=Math.atan2(x,-y)*180/Math.PI;if(a<0)a+=360;return{a,rr:Math.hypot(x,y)}}
const adiff=(a,b)=>{const d=Math.abs(a-b)%360;return d>180?360-d:d};
clk.addEventListener('pointerdown',e=>{if(K.mode==='read')return;clk.setPointerCapture(e.pointerId);const{a,rr}=angAt(e);
  K.drag=(rr<64&&adiff(a,K.tm*.5)<adiff(a,(K.tm%60)*6))?'h':'m';moveHand(e)});
clk.addEventListener('pointermove',e=>{if(K.drag)moveHand(e)});
['pointerup','pointercancel'].forEach(t=>clk.addEventListener(t,()=>K.drag=null));
function moveHand(e){
  const{a}=angAt(e);
  if(K.drag==='m'){const snap=K.mode==='free'?1:Math.min(K.step,5);let nm=Math.round(a/6/snap)*snap%60,d=nm-K.tm%60;if(d>30)d-=60;if(d<-30)d+=60;K.tm=(K.tm+d+720)%720}
  else K.tm=Math.round(a*2/5)*5%720;
  $('#ckFb').textContent='';drawClock();
}
function setT(tm){K.tm=(tm+720)%720;drawClock()}
$('#ckHm').onclick=()=>setT(K.tm-60);$('#ckHp').onclick=()=>setT(K.tm+60);
$('#ckNow').onclick=()=>{const d=new Date();setT((d.getHours()%12)*60+d.getMinutes())};
function newTask(){
  const st=K.step,slots=720/st;K.target=rnd(0,slots-1)*st;
  $('#ckFb').textContent='';$('#ckFb').className='feedback';
  if(K.mode==='read'){K.tm=K.target;$('#ckH').value='';$('#ckM').value='';$('#ckQ').textContent='Millist kellaaega kell näitab?'}
  else{K.tm=0;$('#ckQ').textContent=`Sea: ${digT(K.target)} — ${timeWords(K.target).toLowerCase()}`}
  drawClock();
}
function syncClockUI(){
  pressGroup($$('[data-ck]'),el=>el.dataset.ck===K.mode);pressGroup($$('[data-cl]'),el=>+el.dataset.cl===K.step);
  const free=K.mode==='free';
  $('#ckLvl').hidden=free;$('#ckQ').hidden=free;$('#ckAns').hidden=K.mode!=='read';$('#ckShow').hidden=!free;
  $('#ckCheck').hidden=$('#ckNext').hidden=free;$('#ckNow').hidden=!free;$('#ckHm').hidden=$('#ckHp').hidden=K.mode==='read';
  clk.style.cursor=K.mode==='read'?'default':'grab';
}
$$('[data-ck]').forEach(b=>b.onclick=()=>{K.mode=b.dataset.ck;syncClockUI();$('#ckFb').textContent='';if(K.mode!=='free')newTask();else drawClock()});
$$('[data-cl]').forEach(b=>b.onclick=()=>{K.step=+b.dataset.cl;store.set('ckstep',K.step);syncClockUI();newTask()});
$('#ckNext').onclick=newTask;
$('#ckCheck').onclick=()=>{
  const fb=$('#ckFb');let ok;
  if(K.mode==='read'){const h=parseInt($('#ckH').value),m=parseInt($('#ckM').value||'0');
    if(isNaN(h)){fb.textContent='Sisesta tunnid ja minutid.';fb.className='feedback err';return}
    ok=((h%12)*60+m)%720===K.target;
    fb.textContent=ok?`Õige! ${digT(K.target)} — ${timeWords(K.target).toLowerCase()}.`:'Vaata uuesti: lühike nool näitab tunde, pikk nool minuteid.';}
  else{ok=K.tm===K.target;fb.textContent=ok?'Õige! Nooled on täpselt õigesti.' :`Praegu näitavad nooled ${digT(K.tm)}. Proovi uuesti.`}
  fb.className='feedback '+(ok?'ok':'err');
};
$('#ckDigC').onchange=drawClock;$('#ckWrdC').onchange=drawClock;
syncClockUI();drawClock();

/* Start */
const h=location.hash.replace('#','');
showTab(['board','column','tools'].includes(h)?h:store.get('tab','board'));
