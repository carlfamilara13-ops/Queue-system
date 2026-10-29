import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { X, Check, Info, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { TOURS, FAQ } from './content';
export const cx = (...a) => a.filter(Boolean).join(' ');
export const card = 'rounded-lg border border-slate-200 bg-white shadow-sm';
export const inp = 'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20 disabled:bg-slate-50 disabled:text-slate-500';
const VAR = { primary: 'bg-blue-700 text-white hover:bg-blue-800', secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50', danger: 'bg-red-600 text-white hover:bg-red-700', success: 'bg-emerald-600 text-white hover:bg-emerald-700', ghost: 'text-slate-600 hover:bg-slate-100' };
export const Btn = ({ v = 'primary', size = 'md', block, className, ...p }) => <button type="button" {...p} className={cx('inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition disabled:cursor-not-allowed disabled:opacity-50', size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm', block && 'w-full', VAR[v], className)} />;
export const Field = ({ label, hint, children }) => <label className="block text-sm"><span className="mb-1 block font-medium text-slate-700">{label}</span>{children}{hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}</label>;
const TONE = { blue: 'bg-blue-50 text-blue-800 ring-blue-200', indigo: 'bg-indigo-50 text-indigo-800 ring-indigo-200', emerald: 'bg-emerald-50 text-emerald-800 ring-emerald-200', amber: 'bg-amber-50 text-amber-800 ring-amber-200', red: 'bg-red-50 text-red-800 ring-red-200', slate: 'bg-slate-100 text-slate-700 ring-slate-200' };
export const Badge = ({ tone = 'slate', children, className }) => <span className={cx('ml-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset first:ml-0', TONE[tone], className)}>{children}</span>;
export const STATUS = { pending: ['Pending verification', 'amber'], reserved: ['Reserved', 'blue'], checked_in: ['Checked in', 'indigo'], called: ['Called', 'emerald'], in_service: ['In service', 'emerald'], completed: ['Completed', 'slate'], missed: ['Missed', 'red'], cancelled: ['Cancelled', 'slate'], expired: ['Expired', 'slate'] };
export const StatusBadge = ({ s }) => <Badge tone={STATUS[s]?.[1]}>{STATUS[s]?.[0] || s}</Badge>;
export const Spinner = () => <div className="flex justify-center p-6 text-slate-400" role="status" aria-label="Loading"><Loader2 className="animate-spin" size={22} /></div>;
export const Empty = ({ title, text }) => <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center"><p className="font-medium text-slate-800">{title}</p>{text && <p className="mt-1 text-sm text-slate-500">{text}</p>}</div>;
const ALERT = { error: ['border-red-200 bg-red-50 text-red-800', AlertTriangle], info: ['border-blue-200 bg-blue-50 text-blue-800', Info], ok: ['border-emerald-200 bg-emerald-50 text-emerald-800', CheckCircle2], warn: ['border-amber-200 bg-amber-50 text-amber-900', AlertTriangle] };
export const Alert = ({ tone = 'info', title, children }) => { if (!children && !title) return null; const [c, I] = ALERT[tone]; return <div role={tone === 'error' ? 'alert' : 'status'} className={cx('flex gap-2 rounded-md border p-3 text-sm', c)}><I size={18} className="mt-0.5 shrink-0" /><div>{title && <p className="font-semibold">{title}</p>}{children}</div></div>; };
export function Modal({ title, children, onClose, wide }) {
  useEffect(() => { const k = e => e.key === 'Escape' && onClose?.(); document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, [onClose]);
  return <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/50 p-4" onClick={onClose}><div role="dialog" aria-modal="true" aria-label={title} className={cx('max-h-[90vh] w-full overflow-auto rounded-lg bg-white shadow-xl', wide ? 'max-w-2xl' : 'max-w-md')} onClick={e => e.stopPropagation()}>
    {title && <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3"><h2 className="text-base font-semibold text-slate-900">{title}</h2><button aria-label="Close" onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100"><X size={18} /></button></div>}<div className="p-5">{children}</div></div></div>;
}
const Ctx = createContext(null); export const useUI = () => useContext(Ctx);
export function Feedback({ children }) {
  const [toasts, setToasts] = useState([]), [dlg, setDlg] = useState(null);
  const push = useCallback((kind, text) => { const id = Math.random(); setToasts(t => [...t, { id, kind, text }]); setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 5000); }, []);
  const ui = useRef({ ok: t => push('ok', t), error: t => push('error', t), confirm: (text, o = {}) => new Promise(res => setDlg({ text, ...o, res })) }).current;
  const close = v => { dlg.res(v); setDlg(null); };
  return <Ctx.Provider value={ui}>{children}
    <div className="fixed right-4 top-4 z-50 w-80 max-w-[calc(100vw-2rem)] space-y-2" aria-live="polite">{toasts.map(t => <Alert key={t.id} tone={t.kind}>{t.text}</Alert>)}</div>
    {dlg && <Modal title={dlg.title || 'Please confirm'} onClose={() => close(false)}><p className="text-sm text-slate-700">{dlg.text}</p><div className="mt-5 flex justify-end gap-2"><Btn v="secondary" onClick={() => close(false)}>{dlg.cancelText || 'Cancel'}</Btn><Btn v={dlg.danger ? 'danger' : 'primary'} onClick={() => close(true)}>{dlg.confirmText || 'Confirm'}</Btn></div></Modal>}</Ctx.Provider>;
}
export function Checklist({ items, prepared = [], verified = [], mode = 'view', onToggle }) {
  const [zoom, setZoom] = useState(null);
  if (!items?.length) return <p className="text-sm text-slate-500">No requirements are listed for this service.</p>;
  return <><ul className="divide-y divide-slate-100 rounded-md border border-slate-200 bg-white">{items.map((r, i) => {
    const on = mode === 'student' ? prepared.includes(i) : mode === 'staff' ? verified.includes(i) : false;
    return <li key={i} className="flex items-start gap-3 p-3">
      {mode !== 'view' && <button type="button" role="checkbox" aria-checked={on} aria-label={`Mark ${r.name || 'item'} as ${mode === 'staff' ? 'verified' : 'prepared'}`} onClick={() => onToggle(i, !on)} className={cx('mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border', on ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-400 bg-white')}>{on && <Check size={14} />}</button>}
      <div className="min-w-0 flex-1"><p className="text-sm font-medium text-slate-900">{r.name || 'See the attached image'}{r.mandatory && <span className="ml-2 text-xs font-normal text-red-600">Required</span>}</p>{r.note && <p className="text-sm text-slate-600">{r.note}</p>}{mode === 'staff' && <p className="text-xs text-slate-500">{prepared.includes(i) ? 'Student marked as prepared' : 'Not marked by the student'}</p>}</div>
      {r.image && <button type="button" onClick={() => setZoom(r)} className="shrink-0" aria-label="View image"><img src={r.image} alt={r.name || 'Requirement'} loading="lazy" className="h-14 w-14 rounded border border-slate-200 object-cover" /></button>}
    </li>; })}</ul>
    {zoom && <Modal title={zoom.name || 'Requirement image'} onClose={() => setZoom(null)} wide><img src={zoom.image} alt={zoom.name || 'Requirement'} className="max-h-[70vh] w-full rounded object-contain" />{zoom.note && <p className="mt-2 text-sm text-slate-600">{zoom.note}</p>}</Modal>}</>;
}
export function Tour({ role, onClose }) {
  const steps = TOURS[role], [i, setI] = useState(0), last = i === steps.length - 1;
  return <Modal title={`Quick guide (${i + 1} of ${steps.length})`} onClose={onClose}><h3 className="font-semibold text-slate-900">{steps[i][0]}</h3><p className="mt-1 text-sm text-slate-600">{steps[i][1]}</p>
    <div className="mt-5 flex items-center justify-between"><Btn v="ghost" onClick={onClose}>Skip</Btn><div className="flex gap-2">{i > 0 && <Btn v="secondary" onClick={() => setI(i - 1)}>Back</Btn>}<Btn onClick={() => last ? onClose() : setI(i + 1)}>{last ? 'Done' : 'Next'}</Btn></div></div></Modal>;
}
export function Help({ role, onClose }) {
  const list = role === 'admin' ? [...FAQ.staff, ...FAQ.admin] : FAQ[role];
  return <Modal title="Help" onClose={onClose}><div className="divide-y divide-slate-100">{list.map(([q, a]) => <details key={q} className="group py-2"><summary className="cursor-pointer text-sm font-medium text-slate-900">{q}</summary><p className="mt-1 text-sm text-slate-600">{a}</p></details>)}</div></Modal>;
}
export const Logos = ({ className }) => <div className={cx('inline-flex items-center gap-3 rounded-lg bg-white px-3 py-1.5', className)}><img src="/epila-logo.png" alt="ePila" className="h-9 w-auto" /><span className="h-8 w-px bg-slate-300" aria-hidden="true" /><img src="/icct-seal.png" alt="ICCT Colleges Foundation" className="h-9 w-9 object-contain" /></div>;
