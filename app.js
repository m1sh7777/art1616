import {loadFile,exampleImage} from './images.js';
import {textEffects} from './characters.js';
import {savePNG,saveText} from './export.js';
import {supportsColorAdjustments} from './color.js';
import {DEFAULT_SETTINGS} from './settings.js';
import {ProcessedPreview} from './preview-state.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const groups=[['DITHERING',[['bayer','Bayer Ordered Dithering','An ordered pattern, a limited palette. A classic for a reason.'],['floyd','Floyd–Steinberg','Error diffusion with the original 7/16, 3/16, 5/16, 1/16 weights.'],['atkinson','Atkinson','Six-neighbor diffusion, inspired by early Macintosh graphics.'],['web','Web-Safe Palette','Nearest-color quantization to the historical 216-color web palette.'],['webdither','Web-Safe + Dithering','216 web-safe colors with Floyd–Steinberg error diffusion.'],['onebit','1-Bit Black & White','Two colors. Floyd–Steinberg diffusion. Every pixel counts.']]],['CHARACTER & TEXT',[['ascii','Classic ASCII','Brightness mapped to a character ramp, with corrected cell proportions.'],['dense','Dense ASCII','A longer character ramp for intricate, tightly packed text art.'],['ansi','ANSI-style Color','Character rendering with the 16-color terminal palette.'],['sjis','Shift-JIS-inspired','Wide Japanese glyphs. Unicode text; not Shift-JIS encoded.'],['petscii','PETSCII-inspired','Commodore palette and Unicode block glyphs; not PETSCII encoding.'],['braille','Unicode Braille','Actual Unicode Braille cells, each encoding a 2 × 4 dot pattern.']]],['VINTAGE COMPUTERS',[['teletext','Teletext-inspired','Six-block mosaic cells with black and one foreground color per cell.'],['zx','ZX Spectrum','256 × 192 pixels. Two colors per 8 × 8 cell, with shared brightness.']]]];
const effects=groups.flatMap(g=>g[1]),defaults=DEFAULT_SETTINGS;let settings={...defaults},effect='bayer',source=exampleImage(),view='processed',text='',name='landscape',timer,requestId=0,pending=new Map(),sourceRevision=0;
const worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});worker.onmessage=({data:r})=>{const p=pending.get(r.id);if(!p){r.bitmap?.close();return}pending.delete(r.id);r.error?p.reject(new Error(r.error)):p.resolve(r)};worker.onerror=e=>{for(const p of pending.values())p.reject(new Error(e.message||'Image processing failed.'));pending.clear()};
function compute(input,selected,s){return createImageBitmap(input).then(bitmap=>new Promise((resolve,reject)=>{const id=++requestId;pending.set(id,{resolve,reject});worker.postMessage({id,bitmap,effect:selected,s},[bitmap])}))}
function status(s){$('#status').textContent=s}function dialog(title,body){$('#dialogTitle').textContent=title;$('#dialogBody').textContent=body;if(!$('#dialog').open)$('#dialog').showModal()}
function drawBitmap(canvas,bitmap){canvas.width=bitmap.width;canvas.height=bitmap.height;canvas.getContext('2d').drawImage(bitmap,0,0);bitmap.close()}
const preview = new ProcessedPreview(
  () => ({source, effect, settings}),
  compute,
  result => {
    const canvas = $('#output');
    canvas.width = result.canvas.width; canvas.height = result.canvas.height;
    canvas.getContext('2d').drawImage(result.canvas, 0, 0);
    text = result.text;
    $('#resolution').textContent = `${result.grid ? result.grid + ' · ' : ''}${canvas.width} × ${canvas.height} processed / PNG · zoom is display only`;
    $('#dimensions').textContent = `${result.source.width} × ${result.source.height} px`;
    $('#statusEffect').textContent = effects.find(e => e[0] === result.effect)?.[1] || 'Original';
    applyZoom();
  }
);
async function process(){
  clearTimeout(timer); timer = null;
  const revision = ++sourceRevision;
  $('#busy').hidden = false; status('Processing…');
  try { await preview.ensureCurrent(); status('Ready · processed locally'); return true; }
  catch(error){ status('Processing failed'); dialog('Could not process image', error.message); return false; }
  finally { if(revision === sourceRevision) $('#busy').hidden = true; }
}
function queue(){clearTimeout(timer);status('Settings changed · updating…');timer=setTimeout(process,160)}
function selectEffect(id){effect=id;settings={...defaults};if(id==='dense'){settings.density=180;settings.fontSize=7}if(id==='ansi'||id==='petscii')settings.color=true;if(id==='sjis')settings.density=70;$('#mobileEffect').value=id;$$('[data-effect]').forEach(b=>b.classList.toggle('active',b.dataset.effect===id));$('#effectName').textContent=effects.find(e=>e[0]===id)?.[1]||'Original';$('#effectDescription').textContent=effects.find(e=>e[0]===id)?.[2]||'The unmodified source image.';renderControls();process()}
function formatSetting(key,value){return key==='hue'?`${value}°`:key==='saturation'?`${value}%`:String(value)}
function range(key,label,min,max,step=1){return `<div class="control"><label for="${key}">${label}<output id="${key}Value">${formatSetting(key,settings[key])}</output></label><input id="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${settings[key]}" data-setting="${key}"></div>`}
function select(key,label,options){return `<div class="control"><label for="${key}">${label}</label><select id="${key}" data-setting="${key}">${options.map(([v,l])=>`<option value="${v}" ${String(settings[key])===String(v)?'selected':''}>${l}</option>`).join('')}</select></div>`}
function renderControls(){
  const isText=textEffects.includes(effect),isVintage=['zx','teletext'].includes(effect);
  let html=range('brightness','Brightness',-100,100)+range('contrast','Contrast',-100,100);
  if(isText){
    html+=range('density','Character columns',20,220)+range('fontSize','Font size',6,24);
    html+=`<div class="control"><label><span>Invert luminance</span><input type="checkbox" data-setting="invert" ${settings.invert?'checked':''}></label><label><span>Terminal color</span><input type="checkbox" data-setting="color" ${settings.color?'checked':''}></label></div><div class="control"><label for="background">Background</label><input id="background" type="color" data-setting="background" value="${settings.background}"></div>`;
    if(effect!=='braille')html+=select('charset','Character set',[['default','Effect default'],['custom','Custom density ramp']])+`<div class="control"><label for="ramp">Dark → light ramp</label><input type="text" id="ramp" data-setting="ramp" maxlength="100"></div>`;
    else html+=range('threshold','Dot threshold',0,255);
  }else if(!isVintage){
    if(effect!=='original')html+=range('pixelSize','Pixel size · px',1,8);
    if(!['web','original'].includes(effect))html+=range('strength','Dithering strength',0,100);
    if(!['web','webdither','onebit','original'].includes(effect))html+=select('palette','Palette',[['mono','Black & white'],['green','Green phosphor'],['amber','Amber terminal'],['cga','CGA · 4 colors'],['ansi','ANSI · 16 colors']]);
    if(effect==='bayer')html+=select('matrix','Bayer matrix',[[2,'2 × 2'],[4,'4 × 4'],[8,'8 × 8']]);
    if(effect==='onebit')html+=range('threshold','Threshold',0,255);
  }else html+=select('enlarge','Nearest-neighbor enlargement',[[1,'Native · 1×'],[2,'2×'],[3,'3×'],[4,'4×']]);
  if(!isText&&!isVintage)html+=select('exportSize','Processing resolution',[['original','Original resolution'],['preview','Reduced · max 1200 px']]);
  html+=`<details class="color-adjustments"><summary>Color adjustments</summary><div class="adjustment-controls">${range('hue','Hue Shift',-180,180)}${range('saturation','Saturation',0,200)}<div class="control invert-control"><label><span>Invert Colors</span><input type="checkbox" data-setting="invertColors" ${settings.invertColors?'checked':''}></label></div></div><small id="colorHint"></small></details>`;
  $('#controls').innerHTML=html;
  if($('#ramp'))$('#ramp').value=settings.ramp;
  $('#textActions').hidden=!isText;
  $$('[data-action=copy],[data-action=txt]').forEach(b=>b.disabled=!isText);
  syncColorControls();
  $$('[data-setting]').forEach(input=>input.addEventListener('input',()=>{
    const key=input.dataset.setting;
    settings[key]=input.type==='checkbox'?input.checked:input.type==='range'?+input.value:input.value;
    if(key==='invert'){settings.background=input.checked?'#ffffff':'#111111';$('#background').value=settings.background}
    if($(`#${key}Value`))$(`#${key}Value`).textContent=formatSetting(key,input.value);
    syncColorControls(); queue();
  }));
}
function syncColorControls(){
  const enabled=supportsColorAdjustments(effect,settings);
  for(const key of ['hue','saturation']){
    $('#'+key).disabled=!enabled;
    $('#'+key).closest('.control').classList.toggle('disabled-control',!enabled);
  }
  $('#colorHint').textContent=enabled?'Applied before the selected effect.':'Hue and saturation are inactive for monochrome output.';
}
function applyZoom(){const z=$('#zoom').value;$('#dropzone').classList.toggle('zoomed',z!=='fit');$('#zoom').title='Display zoom only; PNG pixels stay unchanged.';const vp=$('#dropzone'),availableW=Math.max(40,vp.clientWidth-(innerWidth<=600?28:56)),availableH=Math.max(40,vp.clientHeight-72);$$('.canvas-row canvas').forEach(c=>{const scale=z==='fit'?Math.min(1,(availableW/(view==='split'?2:1)-(view==='split'?10:0))/c.width,availableH/c.height):+z;c.style.width=c.width*scale+'px';c.style.height=c.height*scale+'px';c.style.maxWidth='none';c.style.maxHeight='none'});$('#canvasRow').style.width=z==='fit'?'100%':'max-content';$('#canvasRow').style.height=z==='fit'?'100%':'auto'}
function setView(v){view=v;$$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===v));$('#originalFigure').hidden=v==='processed';$('#output').parentElement.hidden=v==='original';$('#outputCaption').hidden=v!=='split';$('#canvasRow').classList.toggle('split',v==='split');applyZoom()}
function showSource(){const c=$('#original');c.width=source.width;c.height=source.height;c.getContext('2d').drawImage(source,0,0);$('#filename').textContent=name+'.'+(name==='landscape'?'bmp':'image');$('#filemeta').textContent=`${source.width} × ${source.height} · LOCAL FILE`}
async function openFile(file){if(!file)return;try{status('Opening image…');const loaded=await loadFile(file);source=loaded;name=file.name.replace(/\.[^.]+$/,'');showSource();$('#filename').textContent=file.name;await process()}catch(e){dialog('Could not open image',e.message);status('Ready')}}
async function exportPNG(){
  clearTimeout(timer); timer = null;
  status('Preparing PNG…'); $('#busy').hidden = false;
  $$('[data-action=save]').forEach(button => button.disabled = true);
  try {
    // Encode exactly the immutable processed canvas used for the visible preview.
    // No second processing pass, resolution change or rescaling at export time.
    const result = await preview.ensureCurrent();
    await savePNG(result.canvas, `${name}-${result.effect}`);
    status(`Saved ${result.canvas.width} × ${result.canvas.height} PNG`);
  } catch(error){dialog('Export failed',error.message);status('Export failed')}
  finally{$('#busy').hidden=true;$$('[data-action=save]').forEach(button=>button.disabled=false)}
}
const actions = {
  open: () => $('#file').click(),
  save: exportPNG,
  reset: () => {
    effect='original'; settings={...defaults}; $('#mobileEffect').value='original';
    $$('[data-effect]').forEach(button=>button.classList.remove('active'));
    $('#effectName').textContent='Original image';
    $('#effectDescription').textContent='Your source pixels, unchanged.';
    renderControls(); setView('processed'); process();
  },
  example: () => {source=exampleImage();name='landscape';showSource();process()},
  copy: async () => {
    if(!textEffects.includes(effect))return;
    clearTimeout(timer);timer=null;
    try{
      const result=await preview.ensureCurrent();
      if(!textEffects.includes(result.effect))return;
      await navigator.clipboard.writeText(result.text);status('Character art copied');
    }catch(error){dialog('Could not copy text',error.message+'\nUse Export TXT if clipboard access is unavailable.')}
  },
  txt: async () => {
    if(!textEffects.includes(effect))return;
    clearTimeout(timer);timer=null;
    try{
      const result=await preview.ensureCurrent();
      if(!textEffects.includes(result.effect))return;
      saveText(result.text,name+'-'+result.effect);status('Text file saved');
    }catch(error){dialog('Could not export text',error.message)}
  },
  about: () => dialog('About art1616','art1616\nImage Processing Studio\n\nA little browser-based tool for dithering, ASCII art, and experimental computer graphics.\n\nmade by mesh3al'),
  help: () => dialog('Using art1616',
    '1. Open or drop a JPG, PNG, or WebP image.\n2. Pick an effect and adjust its settings.\n3. Export PNG, or copy / export character art as TXT.\n\n'+
    'Fit and 100% change display size only. PNG saves the exact processed pixels shown in the editor. Pixel size is measured in output-image pixels.\n\n'+
    'Processing resolution applies to both the preview and PNG: Original preserves source dimensions (up to 24 MP). Reduced explicitly limits the longest edge to 1,200 px. Character art uses its character grid. Historical modes use their native grid and the selected nearest-neighbor enlargement.\n\n'+
    'Color adjustments are applied before the effect. Hue and saturation are inactive for monochrome output. Invert Colors changes RGB colors; Invert luminance is the separate character-density option. Original source data is always preserved.\n\n'+
    'Shift-JIS, PETSCII, ANSI and Teletext modes are visual interpretations, not historical file encoders.\n\nShortcuts: Ctrl/⌘+O to open; Ctrl/⌘+S to export.'),
  fit: () => {$('#zoom').value='fit';applyZoom()},
  expand: () => document.body.classList.toggle('expanded'),
  original: () => setView('original'), processed: () => setView('processed'),
  split: () => setView('split'), web: () => selectEffect('web'),
  webdither: () => selectEffect('webdither')
};
groups.forEach(([title,list])=>{const h=document.createElement('div');h.className='category-title';h.textContent=title;$('#effects').append(h);const optgroup=document.createElement('optgroup');optgroup.label=title;list.forEach(([id,label])=>{const b=document.createElement('button');b.dataset.effect=id;b.textContent=label;b.onclick=()=>selectEffect(id);$('#effects').append(b);const o=document.createElement('option');o.value=id;o.textContent=label;optgroup.append(o)});$('#mobileEffect').append(optgroup)});const originalOption=new Option('Original image','original');$('#mobileEffect').prepend(originalOption);
const menus=[['File',[['Open image…','open'],['Save PNG…','save'],['Load example','example']]],['Edit',[['Reset to original','reset'],['Copy character text','copy']]],['View',[['Fit to workspace','fit'],['Original','original'],['Processed','processed'],['Side by side','split'],['Expand workspace','expand']]],['Effects',[['Web-Safe Palette','web'],['Web-Safe Dithered','webdither']]],['Help',[['How to use','help'],['About art1616','about']]]];menus.forEach(([title,items])=>{const d=document.createElement('div');d.className='menu';const b=document.createElement('button');b.textContent=title;b.setAttribute('aria-expanded','false');const pop=document.createElement('div');pop.className='menu-pop';pop.hidden=true;items.forEach(([label,action])=>{const item=document.createElement('button');item.textContent=label;item.dataset.action=action;pop.append(item)});b.onclick=()=>{const show=pop.hidden;$$('.menu-pop').forEach(p=>p.hidden=true);$$('.menu>button').forEach(p=>p.setAttribute('aria-expanded','false'));pop.hidden=!show;b.setAttribute('aria-expanded',String(show))};d.append(b,pop);$('.menubar').append(d)});
document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b){actions[b.dataset.action]?.();$$('.menu-pop').forEach(p=>p.hidden=true)}if(!e.target.closest('.menu')){$$('.menu-pop').forEach(p=>p.hidden=true);$$('.menu>button').forEach(p=>p.setAttribute('aria-expanded','false'))}});$$('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));$('#mobileEffect').onchange=e=>e.target.value==='original'?actions.reset():selectEffect(e.target.value);$('#restore').onclick=()=>effect==='original'?actions.reset():selectEffect(effect);$('#zoom').onchange=applyZoom;$('#file').onchange=e=>{openFile(e.target.files[0]);e.target.value=''};$('#aboutTitle').onclick=actions.about;
document.addEventListener('dragover',e=>{e.preventDefault();$('#dropzone').classList.add('dragover')});document.addEventListener('dragleave',e=>{if(!e.relatedTarget)$('#dropzone').classList.remove('dragover')});document.addEventListener('drop',e=>{e.preventDefault();$('#dropzone').classList.remove('dragover');openFile(e.dataTransfer.files[0])});document.addEventListener('keydown',e=>{if(e.key==='Escape'){$$('.menu-pop').forEach(p=>p.hidden=true)}if((e.ctrlKey||e.metaKey)&&['o','s'].includes(e.key.toLowerCase())){e.preventDefault();actions[e.key.toLowerCase()==='o'?'open':'save']()}});
function closeDialog(){$('#dialog').close();try{localStorage.setItem('art1616-welcome','1')}catch{}}$('#dialogOK').onclick=closeDialog;$('#closeDialog').onclick=closeDialog;$('#dialog').addEventListener('cancel',closeDialog);
new ResizeObserver(()=>requestAnimationFrame(applyZoom)).observe($('#dropzone'));
showSource();selectEffect('bayer');try{if(!localStorage.getItem('art1616-welcome'))dialog('Welcome to art1616','Welcome to art1616.\n\nA tiny image-processing studio for retro digital art.\n\nOpen an image to begin.')}catch{dialog('Welcome to art1616','Welcome to art1616.\n\nA tiny image-processing studio for retro digital art.\n\nOpen an image to begin.')}
