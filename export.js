export function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000)}
export function encodePNG(canvas){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not create PNG.')),'image/png'))}
export async function savePNG(canvas,name){download(await encodePNG(canvas),name+'.png')}
export function saveText(text,name){download(new Blob([text],{type:'text/plain;charset=utf-8'}),name+'.txt')}
