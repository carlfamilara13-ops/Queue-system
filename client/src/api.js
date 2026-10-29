import { createContext } from 'react'; import { io } from 'socket.io-client';
export const Auth = createContext();
export const connect = () => io({ withCredentials: true });
let WID = ''; export const setWid = v => { WID = v || ''; };
export const api = async (path, method = 'GET', body) => {
  const headers = {}; if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json'; if (WID) headers['X-Window'] = WID;
  const r = await fetch('/api' + path, { method, credentials: 'include', headers, body: body instanceof FormData ? body : body && JSON.stringify(body) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Request failed'); return j;
};
export async function shrink(file, max = 1280) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Use a JPG, PNG or WebP image');
  const bmp = await createImageBitmap(file), k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('Could not process the image')), 'image/jpeg', 0.85));
}
export async function uploadImage(file) { const fd = new FormData(); fd.append('image', await shrink(file), 'upload.jpg'); return (await api('/manage/uploads', 'POST', fd)).url; }
export async function download(path, filename) {
  const headers = {}; if (WID) headers['X-Window'] = WID;
  const r = await fetch('/api' + path, { credentials: 'include', headers });
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || 'Download failed'); }
  const u = URL.createObjectURL(await r.blob()), l = document.createElement('a'); l.href = u; l.download = filename; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 1000);
}
