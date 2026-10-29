export function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000)}
export function savePNG(canvas,name){return new Promise((resolve,reject)=>canvas.toBlob(blob=>{if(!blob){reject(new Error('Could not create PNG.'));return}download(blob,name+'.png');resolve()},'image/png'))}
export function saveText(text,name){download(new Blob([text],{type:'text/plain;charset=utf-8'}),name+'.txt')}
