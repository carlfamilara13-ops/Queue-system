import { useEffect, useRef, useState, useContext, useCallback } from 'react'; import { Html5Qrcode } from 'html5-qrcode';
import { ListOrdered, CalendarDays, ClipboardCheck, FileText, LayoutDashboard, Building2, Users, Flag, ScrollText, LogOut, HelpCircle, ScanLine, UserPlus, PhoneCall, ChevronUp, ChevronDown, Trash2, ImagePlus, Plus, Check, Download } from 'lucide-react';
import { api, Auth, connect, setWid, uploadImage, download } from './api';
import { Btn, Modal, Empty, Alert, Badge, StatusBadge, STATUS, Checklist, Tour, Help, Spinner, Field, Logos, useUI, cx, card, inp } from './ui';
const fmt = h => `${(h + 11) % 12 + 1}:00 ${h < 12 ? 'AM' : 'PM'}`;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const todayStr = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
const Name = a => a.student?.name || a.guestName;
const secs = a => Math.max(0, 300 - Math.floor((Date.now() - new Date(a.calledAt)) / 1000));
const useLoad = (path, deps = []) => {
  const [d, setD] = useState(null), [e, setE] = useState('');
  const load = useCallback(() => path ? api(path).then(x => { setD(x); setE(''); }).catch(x => setE(x.message)) : Promise.resolve(), [path, ...deps]);
  useEffect(() => { load(); }, [load]); return [d, load, e];
};
const useDebounced = (v, ms = 300) => { const [x, setX] = useState(v); useEffect(() => { const t = setTimeout(() => setX(v), ms); return () => clearTimeout(t); }, [v, ms]); return x; };
const Chip = ({ on, ...p }) => <button type="button" aria-pressed={on} {...p} className={cx('rounded-md border px-3 py-1.5 text-sm', on ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50')} />;
const Th = ({ children }) => <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{children}</th>;
const Table = ({ head, children }) => <div className={`${card} overflow-x-auto`}><table className="w-full text-sm"><thead className="border-b border-slate-200 bg-slate-50"><tr>{head.map(h => <Th key={h}>{h}</Th>)}</tr></thead><tbody className="divide-y divide-slate-100">{children}</tbody></table></div>;
const Td = ({ children, className }) => <td className={cx('px-4 py-2.5 align-middle', className)}>{children}</td>;
const Pager = ({ d, page, setPage }) => d && d.pages > 1 ? <div className="flex items-center justify-between text-sm text-slate-600"><span>{d.total} results</span><span className="flex items-center gap-2"><Btn v="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Btn>Page {page} of {d.pages}<Btn v="secondary" size="sm" disabled={page >= d.pages} onClick={() => setPage(page + 1)}>Next</Btn></span></div> : null;

function Scanner({ onScan }) {
  const [err, setErr] = useState('');
  useEffect(() => {
    const sc = new Html5Qrcode('qr-reader'); let dead = false, on = false;
    sc.start({ facingMode: 'environment' }, { fps: 10, qrbox: 220 }, x => onScan(x), () => { }).then(() => { on = true; if (dead) sc.stop().catch(() => { }); }).catch(() => setErr('The camera is not available. Close this window and paste the code instead.'));
    return () => { dead = true; if (on) sc.stop().then(() => sc.clear()).catch(() => { }); };
  }, []);
  return <div><div id="qr-reader" className="overflow-hidden rounded-md" />{err && <div className="mt-2"><Alert tone="error">{err}</Alert></div>}</div>;
}
function WalkIn({ onDone, onClose }) {
  const [svcs] = useLoad('/manage/services'), [name, setName] = useState(''), [sn, setSn] = useState(''), [course, setCourse] = useState(''), [courses] = useLoad('/courses'), [sid, setSid] = useState(''), [err, setErr] = useState('');
  return <Modal title="Add walk-in" onClose={onClose}><div className="space-y-3"><Field label="Name"><input className={inp} value={name} onChange={e => setName(e.target.value)} autoFocus /></Field>
    <Field label="Student number (optional)"><input className={inp} value={sn} onChange={e => setSn(e.target.value)} /></Field><Field label="Course (optional)">{courses?.length ? <select className={inp} value={course} onChange={e => setCourse(e.target.value)}><option value="">Select a course</option>{courses.map(c => <option key={c} value={c}>{c}</option>)}</select> : <input className={inp} value={course} onChange={e => setCourse(e.target.value)} />}</Field><Field label="Service"><select className={inp} value={sid} onChange={e => setSid(e.target.value)}><option value="">Select a service</option>{(svcs || []).filter(s => s.active).map(s => <option key={s._id} value={s._id}>{s.name}</option>)}</select></Field>
    <p className="text-xs text-slate-500">Walk-ins are served after students with booked appointments.</p><Alert tone="error">{err}</Alert></div>
    <div className="mt-5 flex justify-end gap-2"><Btn v="secondary" onClick={onClose}>Cancel</Btn><Btn onClick={() => api('/manage/walkin', 'POST', { name, studentNumber: sn, course, serviceId: sid }).then(onDone).catch(e => setErr(e.message))}>Add to queue</Btn></div></Modal>;
}
const Section = ({ title, count, children }) => count > 0 && <section><h3 className="mb-2 text-sm font-semibold text-slate-800">{title} <span className="font-normal text-slate-500">({count})</span></h3><ul className={`${card} divide-y divide-slate-100`}>{children}</ul></section>;
function QRow({ a, i, onReview, children }) {
  const n = a.reqSnapshot?.length || 0;
  return <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
    {i != null && <span className="w-6 text-sm font-semibold text-slate-400">{i + 1}</span>}<span className="w-20 font-mono text-sm font-semibold">{a.queueCode}</span>
    <span className="min-w-0 flex-1 text-sm"><span className="font-medium text-slate-900">{Name(a)}</span>{a.walkIn && <Badge tone="amber">Walk-in</Badge>}{a.rejoins > 0 && <Badge>Rejoined</Badge>}{a.rescheduleAllowed && <Badge tone="blue">Reschedule open</Badge>}<span className="block text-xs text-slate-500">{a.serviceName}, {fmt(a.hour)}</span></span>
    {a.status === 'called' && <span className="text-sm font-semibold text-amber-700">{Math.floor(secs(a) / 60)}:{String(secs(a) % 60).padStart(2, '0')}</span>}
    {n > 0 && <button className="text-xs font-medium text-blue-700 hover:underline" onClick={() => onReview(a._id)}>Checklist {a.verified?.length || 0}/{n}</button>}<span className="flex gap-2">{children}</span></li>;
}
function QueueTab({ wid, tick }) {
  const ui = useUI(), [d, load, e] = useLoad('/manage/queue', [wid, tick]);
  const [tok, setTok] = useState(''), [scan, setScan] = useState(false), [walk, setWalk] = useState(false), [review, setReview] = useState(null), [mode, setMode] = useState('in'), [res, setRes] = useState(null), [, tk] = useState(0);
  const modeRef = useRef('in'), last = useRef({ k: '', at: 0 });
  const setM = m => { modeRef.current = m; setMode(m); setRes(null); };
  useEffect(() => { const i = setInterval(() => tk(x => x + 1), 1000); return () => clearInterval(i); }, []);
  const act = async (path, body, okMsg) => { try { await api(path, 'POST', body); if (okMsg) ui.ok(okMsg); load(); return true; } catch (x) { ui.error(x.message); return false; } };
  const start = async a => { const miss = (a.reqSnapshot || []).some((r, i) => r.mandatory && !(a.verified || []).includes(i)); if (miss && !(await ui.confirm('Some required items have not been verified. Start service anyway?', { confirmText: 'Start service' }))) return; act(`/manage/${a._id}/start`); };
  const doScan = async (token, toast) => {
    const out = modeRef.current === 'out', key = modeRef.current + token, now = Date.now();
    if (last.current.k === key && now - last.current.at < 4000) return false; last.current = { k: key, at: now };
    try { const r = await api(out ? '/manage/scan-out' : '/manage/scan', 'POST', { token }); const text = `${r.queueCode} ${r.student?.name || ''} ${out ? 'checked out' : 'checked in'}`.replace(/\s+/g, ' '); setRes({ ok: true, text }); if (toast) ui.ok(text); load(); return true; }
    catch (x) { setRes({ ok: false, text: x.message }); if (toast) ui.error(x.message); return false; }
  };
  const L = d?.list || [], by = s => L.filter(a => s.includes(a.status)), ra = review && L.find(x => x._id === review);
  if (!d) return e ? <Alert tone="error">{e}</Alert> : <Spinner />;
  const tiles = [['Waiting', by(['checked_in']).length], ['Being served', by(['called', 'in_service']).length], ['Booked, not arrived', by(['reserved']).length], ['Missed', by(['missed']).length]];
  const Mode = () => <div className="inline-flex gap-1" role="group" aria-label="Scanner mode"><Chip on={mode === 'in'} onClick={() => setM('in')}>Check-in</Chip><Chip on={mode === 'out'} onClick={() => setM('out')}>Check-out</Chip></div>;
  return <div className="space-y-4">
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{tiles.map(([l, n]) => <div key={l} className={`${card} p-3`}><p className="text-2xl font-semibold text-slate-900">{n}</p><p className="text-xs text-slate-500">{l}</p></div>)}</div>
    <div className="flex flex-wrap items-center gap-2"><Btn v="success" onClick={() => act('/manage/call-next')}><PhoneCall size={16} />Call next student</Btn><Btn v="secondary" onClick={() => { setRes(null); setScan(true); }}><ScanLine size={16} />Scan QR code</Btn><Btn v="secondary" onClick={() => setWalk(true)}><UserPlus size={16} />Add walk-in</Btn>
      <div className="ml-auto flex flex-wrap items-center gap-2"><Mode /><form className="flex gap-2" onSubmit={ev => { ev.preventDefault(); doScan(tok.trim(), true).then(ok => ok && setTok('')); }}><input className={`${inp} w-48`} placeholder="Or paste a QR value" aria-label="QR value" value={tok} onChange={ev => setTok(ev.target.value)} /><Btn v="secondary" type="submit" disabled={!tok.trim()}>{mode === 'out' ? 'Check out' : 'Check in'}</Btn></form></div></div>
    {!L.length && <Empty title="The queue is empty" text="New check-ins appear here in real time." />}
    <Section title="Now serving" count={by(['called', 'in_service']).length}>{by(['called', 'in_service']).map(a => <QRow key={a._id} a={a} onReview={setReview}>{a.status === 'called' && <><Btn size="sm" onClick={() => start(a)}>Start service</Btn><Btn size="sm" v="secondary" onClick={() => act(`/manage/${a._id}/missed`)}>Mark missed</Btn></>}{a.status === 'in_service' && <Btn size="sm" v="success" onClick={() => act(`/manage/${a._id}/complete`, null, 'Service completed.')}>Complete</Btn>}</QRow>)}</Section>
    <Section title="Waiting in line" count={by(['checked_in']).length}>{by(['checked_in']).map((a, i) => <QRow key={a._id} a={a} i={i} onReview={setReview} />)}</Section>
    <Section title="Booked, not yet arrived" count={by(['reserved']).length}>{by(['reserved']).map(a => <QRow key={a._id} a={a} onReview={setReview} />)}</Section>
    <Section title="Missed" count={by(['missed']).length}>{by(['missed']).map(a => <QRow key={a._id} a={a} onReview={setReview}><Btn size="sm" v="secondary" onClick={() => act(`/manage/${a._id}/rejoin`)}>Approve rejoin (end of queue)</Btn></QRow>)}</Section>
    {scan && <Modal title="Scan QR code" onClose={() => setScan(false)}><div className="mb-3 flex items-center justify-between gap-2"><Mode /><p className="text-xs text-slate-500">{mode === 'out' ? 'Scan after service is finished' : 'Scan when the student arrives'}</p></div><Scanner onScan={x => doScan(x, false)} />{res && <div className="mt-3"><Alert tone={res.ok ? 'ok' : 'error'}>{res.text}</Alert></div>}<p className="mt-3 text-xs text-slate-500">The scanner stays open so you can scan several students in a row.</p></Modal>}
    {walk && <WalkIn onClose={() => setWalk(false)} onDone={() => { setWalk(false); ui.ok('Walk-in added to the queue.'); load(); }} />}
    {ra && <Modal title={`Requirements: ${ra.queueCode} ${Name(ra)}`} onClose={() => setReview(null)} wide><p className="mb-3 text-sm text-slate-600">Verify each item against what the student presents. Items the student has marked as prepared are indicated.</p><Checklist items={ra.reqSnapshot} prepared={ra.prepared || []} verified={ra.verified || []} mode="staff" onToggle={(i, on) => api(`/manage/${ra._id}/checklist`, 'POST', { index: i, verified: on }).then(load).catch(x => ui.error(x.message))} /></Modal>}
  </div>;
}

function ScheduleTab({ wid }) {
  const ui = useUI(), [w, loadW] = useLoad('/manage/window', [wid]), [cl, loadC] = useLoad('/manage/closures', [wid]);
  const [f, setF] = useState(null), [c, setC] = useState({ date: '', hour: '', reason: '' });
  useEffect(() => { if (w) setF({ days: w.days, hours: w.hours, capacity: w.capacity }); }, [w]);
  const tog = (k, v) => setF(x => ({ ...x, [k]: x[k].includes(v) ? x[k].filter(y => y !== v) : [...x[k], v] }));
  const save = async () => { try { await api('/manage/window', 'PATCH', f); ui.ok('Schedule saved. Students whose bookings changed can now reschedule.'); loadW(); } catch (x) { ui.error(x.message); } };
  const addC = async ev => { ev.preventDefault(); try { await api('/manage/closures', 'POST', c); setC({ date: '', hour: '', reason: '' }); ui.ok('Closure added. Affected students can now reschedule.'); loadC(); } catch (x) { ui.error(x.message); } };
  if (!f) return <Spinner />;
  return <div className="space-y-4">
    <section className={`${card} space-y-4 p-4`}><h2 className="font-semibold">Regular schedule</h2>
      <div><p className="mb-2 text-sm font-medium text-slate-700">Open days</p><div className="flex flex-wrap gap-2">{DAYS.map((d, i) => <Chip key={d} on={f.days.includes(i)} onClick={() => tog('days', i)}>{d}</Chip>)}</div></div>
      <div><p className="mb-2 text-sm font-medium text-slate-700">Open hours (each is a one-hour slot)</p><div className="flex flex-wrap gap-2">{Array.from({ length: 15 }, (_, i) => 6 + i).map(h => <Chip key={h} on={f.hours.includes(h)} onClick={() => tog('hours', h)}>{fmt(h)}</Chip>)}</div></div>
      <div className="max-w-40"><Field label="Students per slot"><input className={inp} type="number" min="1" max="500" value={f.capacity} onChange={e => setF({ ...f, capacity: +e.target.value })} /></Field></div>
      <div className="flex items-center gap-3"><Btn onClick={save}>Save schedule</Btn><p className="text-xs text-slate-500">If a change affects existing bookings, those students are allowed to reschedule automatically.</p></div></section>
    <section className={`${card} p-4`}><h2 className="mb-3 font-semibold">Closures</h2>
      <form className="grid gap-2 sm:grid-cols-5" onSubmit={addC}><input className={inp} type="date" min={todayStr()} value={c.date} onChange={e => setC({ ...c, date: e.target.value })} required aria-label="Date" />
        <select className={inp} value={c.hour} onChange={e => setC({ ...c, hour: e.target.value })} aria-label="Hour"><option value="">Whole day</option>{f.hours.map(h => <option key={h} value={h}>{fmt(h)}</option>)}</select>
        <input className={`${inp} sm:col-span-2`} placeholder="Reason (shown to students)" aria-label="Reason" value={c.reason} onChange={e => setC({ ...c, reason: e.target.value })} /><Btn type="submit"><Plus size={16} />Add closure</Btn></form>
      <ul className="mt-3 divide-y divide-slate-100">{(cl || []).map(x => <li key={x._id} className="flex items-center justify-between py-2 text-sm"><span>{x.date}, {x.hour == null ? 'whole day' : fmt(x.hour)}<span className="text-slate-500"> ({x.reason})</span></span><Btn v="ghost" size="sm" aria-label="Remove closure" onClick={() => api(`/manage/closures/${x._id}`, 'DELETE').then(loadC)}><Trash2 size={15} /></Btn></li>)}{cl && !cl.length && <li className="py-2 text-sm text-slate-500">No upcoming closures.</li>}</ul></section></div>;
}

function ReqItem({ r, i, n, up, del, move }) {
  const ui = useUI(), file = useRef(), [busy, setBusy] = useState(false);
  const pick = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; setBusy(true); try { up(i, { image: await uploadImage(f) }); } catch (x) { ui.error(x.message); } setBusy(false); };
  const type = r.name && r.image ? 'Text and image' : r.image ? 'Image' : 'Text';
  return <div className="rounded-md border border-slate-200 bg-slate-50/50 p-3"><div className="flex items-start gap-3">
    <div className="grid flex-1 gap-2"><input className={inp} placeholder="Requirement title (for example, Valid school ID)" aria-label="Title" value={r.name || ''} onChange={e => up(i, { name: e.target.value })} /><textarea className={inp} rows={2} placeholder="Details (optional)" aria-label="Details" value={r.note || ''} onChange={e => up(i, { note: e.target.value })} />
      <div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!r.mandatory} onChange={e => up(i, { mandatory: e.target.checked })} />Required</label><Badge tone="blue">{type}</Badge></div></div>
    <div className="w-28 shrink-0 text-center">{r.image ? <><img src={r.image} alt="" className="h-24 w-28 rounded border border-slate-200 object-cover" /><div className="mt-1 flex justify-center gap-1"><Btn v="secondary" size="sm" disabled={busy} onClick={() => file.current.click()}>Replace</Btn><Btn v="ghost" size="sm" aria-label="Remove image" onClick={() => up(i, { image: '' })}><Trash2 size={14} /></Btn></div></> : <button type="button" disabled={busy} onClick={() => file.current.click()} className="grid h-24 w-28 place-items-center rounded border-2 border-dashed border-slate-300 text-xs text-slate-500 hover:bg-white"><span className="flex flex-col items-center gap-1"><ImagePlus size={20} />{busy ? 'Uploading' : 'Add image'}</span></button>}<input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pick} /></div>
    <div className="flex flex-col"><Btn v="ghost" size="sm" disabled={i === 0} aria-label="Move up" onClick={() => move(i, -1)}><ChevronUp size={16} /></Btn><Btn v="ghost" size="sm" disabled={i === n - 1} aria-label="Move down" onClick={() => move(i, 1)}><ChevronDown size={16} /></Btn><Btn v="ghost" size="sm" aria-label="Remove item" onClick={() => del(i)}><Trash2 size={16} /></Btn></div></div></div>;
}
function ServiceEditor({ s, admin, reload }) {
  const ui = useUI(), [reqs, setReqs] = useState(s.requirements.map(r => ({ name: r.name, note: r.note, mandatory: r.mandatory, image: r.image }))), [name, setName] = useState(s.name), [active, setActive] = useState(s.active);
  const up = (i, p) => setReqs(r => r.map((x, j) => j === i ? { ...x, ...p } : x));
  const move = (i, k) => setReqs(r => { const a = [...r]; [a[i], a[i + k]] = [a[i + k], a[i]]; return a; });
  const save = () => api(`/manage/services/${s._id}`, 'PATCH', { requirements: reqs, ...(admin ? { name, active } : {}) }).then(() => { ui.ok('Checklist saved.'); reload(); }).catch(e => ui.error(e.message));
  return <section className={`${card} space-y-3 p-4`}>{admin ? <div className="flex items-center gap-3"><input className={inp} value={name} onChange={e => setName(e.target.value)} aria-label="Service name" /><label className="flex shrink-0 items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />Active</label></div> : <h3 className="font-semibold">{s.name}</h3>}
    {reqs.map((r, i) => <ReqItem key={i} r={r} i={i} n={reqs.length} up={up} del={i2 => setReqs(reqs.filter((_, j) => j !== i2))} move={move} />)}
    {!reqs.length && <p className="text-sm text-slate-500">No requirements yet. Each item can be text, an image, or both.</p>}
    <div className="flex gap-2"><Btn v="secondary" onClick={() => setReqs([...reqs, { name: '', note: '', mandatory: true, image: '' }])}><Plus size={16} />Add requirement</Btn><Btn onClick={save}>Save checklist</Btn></div></section>;
}
function RequirementsTab({ wid, admin }) {
  const ui = useUI(), [svcs, load, e] = useLoad('/manage/services', [wid]), [n, setN] = useState('');
  return <div className="space-y-4">{e && <Alert tone="error">{e}</Alert>}
    {admin && <form className="flex gap-2" onSubmit={ev => { ev.preventDefault(); api('/manage/services', 'POST', { name: n }).then(() => { setN(''); load(); }).catch(x => ui.error(x.message)); }}><input className={inp} placeholder="New service name for this window" aria-label="New service name" value={n} onChange={ev => setN(ev.target.value)} required /><Btn type="submit"><Plus size={16} />Add service</Btn></form>}
    {!svcs ? <Spinner /> : !svcs.length ? <Empty title="No services yet" text={admin ? 'Add the first service for this window above.' : 'Ask an administrator to add a service for your window.'} /> : svcs.map(s => <ServiceEditor key={s._id} s={s} admin={admin} reload={load} />)}</div>;
}

const tm = d => d ? new Date(d).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' }) : '';
const FINAL = ['completed', 'missed', 'cancelled', 'expired'];
function RecordsTab({ wid, tick, admin }) {
  const ui = useUI(), [date, setDate] = useState(todayStr()), [rows, load, e] = useLoad(`/manage/records?date=${date}`, [wid, tick]);
  const [exp, setExp] = useState(null), [busy, setBusy] = useState(false);
  const allow = (a, on) => api(`/manage/appointments/${a._id}/allow-reschedule`, 'POST', { allow: on }).then(load).catch(x => ui.error(x.message));
  const del = async a => { if (!(await ui.confirm(`Permanently delete the record ${a.queueCode || ''} for ${Name(a)}? This cannot be undone. Download an Excel copy first if you need it.`, { danger: true, confirmText: 'Delete record', title: 'Delete record' }))) return; try { await api(`/manage/records/${a._id}`, 'DELETE'); ui.ok('Record deleted.'); load(); } catch (x) { ui.error(x.message); } };
  const doExport = async () => { setBusy(true); try { await download(`/manage/records/export?from=${exp.from}&to=${exp.to}${exp.all ? '&scope=all' : ''}`, `records_${exp.from}_${exp.to}.xlsx`); setExp(null); } catch (x) { ui.error(x.message); } setBusy(false); };
  return <div className="space-y-3"><div className="flex flex-wrap items-end gap-3"><div className="max-w-48"><Field label="Date"><input className={inp} type="date" value={date} onChange={ev => setDate(ev.target.value)} /></Field></div><Btn className="ml-auto" v="secondary" onClick={() => setExp({ from: date, to: date, all: false })}><Download size={16} />Download Excel</Btn></div>{e && <Alert tone="error">{e}</Alert>}
    {!rows ? <Spinner /> : !rows.length ? <Empty title="No appointments on this date" /> : <Table head={['Time', 'Code', 'Name', 'Service', 'Status', 'Time in', 'Time out', 'Checklist', '']}>{rows.map(a => <tr key={a._id}><Td>{fmt(a.hour)}</Td><Td className="font-mono font-semibold">{a.queueCode || 'None'}</Td><Td>{Name(a)}{a.walkIn && <Badge tone="amber">Walk-in</Badge>}</Td><Td>{a.serviceName}</Td><Td><StatusBadge s={a.status} /></Td><Td>{tm(a.checkedInAt)}</Td><Td>{tm(a.completedAt)}</Td><Td>{a.reqSnapshot?.length ? `${a.verified?.length || 0} of ${a.reqSnapshot.length}` : 'None'}</Td>
      <Td className="whitespace-nowrap text-right">{a.status === 'reserved' && (a.rescheduleAllowed ? <Btn size="sm" v="secondary" onClick={() => allow(a, false)}>Revoke reschedule</Btn> : <Btn size="sm" v="secondary" onClick={() => allow(a, true)}>Allow reschedule</Btn>)}{FINAL.includes(a.status) && <Btn size="sm" v="ghost" className="text-red-700" aria-label="Delete record" onClick={() => del(a)}><Trash2 size={15} />Delete</Btn>}</Td></tr>)}</Table>}
    {exp && <Modal title="Download records as Excel" onClose={() => setExp(null)}><div className="space-y-3"><div className="grid grid-cols-2 gap-3"><Field label="From"><input className={inp} type="date" value={exp.from} onChange={ev => setExp({ ...exp, from: ev.target.value })} /></Field><Field label="To"><input className={inp} type="date" value={exp.to} min={exp.from} onChange={ev => setExp({ ...exp, to: ev.target.value })} /></Field></div>
      {admin && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={exp.all} onChange={ev => setExp({ ...exp, all: ev.target.checked })} />Include all windows</label>}<p className="text-xs text-slate-500">The file includes check-in, service start and check-out times, who recorded each step, and a summary sheet. Times are in Philippine time.</p></div>
      <div className="mt-5 flex justify-end gap-2"><Btn v="secondary" onClick={() => setExp(null)}>Cancel</Btn><Btn disabled={busy || !exp.from || !exp.to} onClick={doExport}>{busy ? 'Preparing' : 'Download'}</Btn></div></Modal>}</div>;
}

function Overview({ go, tick }) {
  const [s] = useLoad('/admin/stats', [tick]); if (!s) return <Spinner />;
  const todo = [['Create a department', s.departments > 0, 'org'], ['Add a window', s.windows > 0, 'org'], ['Add a service and its requirements (select a window, then Requirements)', s.services > 0, 'requirements'], ['Create a staff account and assign a window', (s.users.staff || 0) > 0, 'people']];
  return <div className="space-y-4"><section className={`${card} p-4`}><h2 className="mb-2 font-semibold">Setup checklist</h2>{todo.map(([x, ok, tab]) => <button key={x} onClick={() => go(tab)} className="flex w-full items-center gap-3 rounded-md p-2 text-left text-sm hover:bg-slate-50"><span className={cx('grid h-5 w-5 place-items-center rounded-full', ok ? 'bg-emerald-600 text-white' : 'border border-slate-300')}>{ok && <Check size={13} />}</span>{x}</button>)}</section>
    <section><h2 className="mb-2 font-semibold">Today</h2><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{Object.keys(STATUS).map(k => <div key={k} className={`${card} p-3`}><p className="text-2xl font-semibold">{s.today[k] || 0}</p><p className="text-xs text-slate-500">{STATUS[k][0]}</p></div>)}</div></section>
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[['Departments', s.departments], ['Windows', s.windows], ['Staff', s.users.staff || 0], ['Students', s.users.student || 0]].map(([l, n]) => <div key={l} className={`${card} p-3`}><p className="text-2xl font-semibold">{n}</p><p className="text-xs text-slate-500">{l}</p></div>)}</section></div>;
}

function DeptRow({ d, patch }) { const [n, setN] = useState(d.name), [a, setA] = useState(d.active); return <tr><Td><input className={inp} value={n} onChange={e => setN(e.target.value)} aria-label="Department name" /></Td><Td><label className="flex items-center gap-2"><input type="checkbox" checked={a} onChange={e => setA(e.target.checked)} />Active</label></Td><Td className="text-right"><Btn size="sm" onClick={() => patch('departments', d._id, { name: n, active: a })}>Save</Btn></Td></tr>; }
function WinRow({ w, deps, patch }) {
  const [f, setF] = useState({ label: w.label || '', prefix: w.prefix, department: w.department, active: w.active });
  return <tr><Td className="font-semibold">{w.number}</Td><Td><input className={inp} value={f.label} onChange={e => setF({ ...f, label: e.target.value })} aria-label="Label" /></Td><Td className="w-20"><input className={inp} value={f.prefix} maxLength={2} onChange={e => setF({ ...f, prefix: e.target.value.toUpperCase() })} aria-label="Prefix" /></Td>
    <Td><select className={inp} value={f.department} onChange={e => setF({ ...f, department: e.target.value })} aria-label="Department">{deps.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}</select></Td><Td><label className="flex items-center gap-2"><input type="checkbox" checked={f.active} onChange={e => setF({ ...f, active: e.target.checked })} />Active</label></Td><Td className="text-right"><Btn size="sm" onClick={() => patch('windows', w._id, f)}>Save</Btn></Td></tr>;
}
function CourseRow({ c, save }) {
  const [f, setF] = useState({ code: c.code || '', name: c.name, active: c.active });
  return <tr><Td className="w-32"><input className={inp} value={f.code} onChange={e => setF({ ...f, code: e.target.value })} aria-label="Code" /></Td><Td><input className={inp} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} aria-label="Course name" /></Td><Td><label className="flex items-center gap-2"><input type="checkbox" checked={f.active} onChange={e => setF({ ...f, active: e.target.checked })} />Active</label></Td><Td className="text-right"><Btn size="sm" onClick={() => save(c._id, f)}>Save</Btn></Td></tr>;
}
function Org({ deps, wins, reload }) {
  const [courses, loadCourses] = useLoad('/admin/courses'), [cn, setCn] = useState({ code: '', name: '' });
  const ui = useUI(), [dn, setDn] = useState(''), [nw, setNw] = useState({ number: '', label: '', prefix: 'R', department: '' });
  const patch = (p, id, body) => api(`/admin/${p}/${id}`, 'PATCH', body).then(() => { ui.ok('Saved.'); reload(); }).catch(x => ui.error(x.message));
  return <div className="space-y-6">
    <section className="space-y-2"><h2 className="font-semibold">Departments</h2><Table head={['Name', 'Status', '']}>{deps.map(d => <DeptRow key={d._id + d.name + d.active} d={d} patch={patch} />)}</Table>
      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); api('/admin/departments', 'POST', { name: dn }).then(() => { setDn(''); ui.ok('Department added.'); reload(); }).catch(x => ui.error(x.message)); }}><input className={inp} placeholder="New department name" aria-label="New department name" value={dn} onChange={e => setDn(e.target.value)} required /><Btn type="submit"><Plus size={16} />Add</Btn></form></section>
    <section className="space-y-2"><h2 className="font-semibold">Windows</h2><p className="text-sm text-slate-500">Inactive windows appear to students as opening soon and cannot be booked.</p><Table head={['No.', 'Label', 'Prefix', 'Department', 'Status', '']}>{wins.map(w => <WinRow key={w._id + w.label + w.active + w.department} w={w} deps={deps} patch={patch} />)}</Table>
      <form className="grid gap-2 sm:grid-cols-5" onSubmit={e => { e.preventDefault(); api('/admin/windows', 'POST', { ...nw, number: +nw.number }).then(() => { setNw({ number: '', label: '', prefix: 'R', department: '' }); ui.ok('Window added.'); reload(); }).catch(x => ui.error(x.message)); }}>
        <input className={inp} type="number" min="1" placeholder="Number" aria-label="Window number" value={nw.number} onChange={e => setNw({ ...nw, number: e.target.value })} required /><input className={inp} placeholder="Label" aria-label="Label" value={nw.label} onChange={e => setNw({ ...nw, label: e.target.value })} />
        <select className={inp} value={nw.department} onChange={e => setNw({ ...nw, department: e.target.value })} required aria-label="Department"><option value="">Department</option>{deps.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}</select><input className={inp} maxLength={2} aria-label="Prefix" value={nw.prefix} onChange={e => setNw({ ...nw, prefix: e.target.value.toUpperCase() })} /><Btn type="submit"><Plus size={16} />Add window</Btn></form></section>
    <section className="space-y-2"><h2 className="font-semibold">Courses</h2><p className="text-sm text-slate-500">Students choose their course from this list when they register. If the list is empty, they type it in. Renaming a course does not change records that already exist.</p>
      {courses && courses.length > 0 && <Table head={['Code', 'Name', 'Status', '']}>{courses.map(c => <CourseRow key={c._id + c.name + c.active} c={c} save={(id, body) => api(`/admin/courses/${id}`, 'PATCH', body).then(() => { ui.ok('Saved.'); loadCourses(); }).catch(x => ui.error(x.message))} />)}</Table>}
      <form className="grid gap-2 sm:grid-cols-4" onSubmit={e => { e.preventDefault(); api('/admin/courses', 'POST', cn).then(() => { setCn({ code: '', name: '' }); ui.ok('Course added.'); loadCourses(); }).catch(x => ui.error(x.message)); }}><input className={inp} placeholder="Code (optional)" aria-label="Code" value={cn.code} onChange={e => setCn({ ...cn, code: e.target.value })} /><input className={`${inp} sm:col-span-2`} placeholder="Course name" aria-label="Course name" value={cn.name} onChange={e => setCn({ ...cn, name: e.target.value })} required /><Btn type="submit"><Plus size={16} />Add course</Btn></form></section></div>;
}

function UserRow({ u, wins, reload }) {
  const ui = useUI(), [f, setF] = useState({ role: u.role, window: u.window || '', active: u.active });
  return <tr><Td><span className="font-medium">{u.name}</span><span className="block text-xs text-slate-500">{u.email}{u.studentNumber ? `, ${u.studentNumber}` : ''}{u.course ? `, ${u.course}` : ''}</span></Td>
    <Td><select className={inp} value={f.role} onChange={e => setF({ ...f, role: e.target.value })} aria-label="Role">{['student', 'staff', 'admin'].map(r => <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>)}</select></Td>
    <Td><select className={inp} value={f.window} disabled={f.role !== 'staff'} onChange={e => setF({ ...f, window: e.target.value })} aria-label="Window"><option value="">No window</option>{wins.map(w => <option key={w._id} value={w._id}>Window {w.number}{w.label ? `: ${w.label}` : ''}</option>)}</select></Td>
    <Td><label className="flex items-center gap-2"><input type="checkbox" checked={f.active} onChange={e => setF({ ...f, active: e.target.checked })} />Active</label></Td>
    <Td className="text-right"><Btn size="sm" onClick={() => api(`/admin/users/${u._id}`, 'PATCH', { role: f.role, active: f.active, window: f.role === 'staff' ? f.window || null : null }).then(() => { ui.ok('Saved.'); reload(); }).catch(x => ui.error(x.message))}>Save</Btn></Td></tr>;
}
function People({ wins }) {
  const ui = useUI(), [role, setRole] = useState('team'), [q, setQ] = useState(''), [page, setPage] = useState(1), dq = useDebounced(q), [add, setAdd] = useState(false), [nu, setNu] = useState({ name: '', email: '', role: 'staff', window: '' });
  const [d, load, e] = useLoad(`/admin/users?role=${role}&q=${encodeURIComponent(dq)}&page=${page}`, []);
  useEffect(() => setPage(1), [role, dq]);
  return <div className="space-y-3"><div className="flex flex-wrap items-end gap-3"><div className="w-64"><Field label="Search"><input className={inp} placeholder="Name, email or student number" value={q} onChange={ev => setQ(ev.target.value)} /></Field></div>
    <Field label="Show"><select className={inp} value={role} onChange={ev => setRole(ev.target.value)}><option value="team">Staff and administrators</option><option value="student">Students</option><option value="all">Everyone</option></select></Field><Btn className="ml-auto" onClick={() => setAdd(true)}><UserPlus size={16} />Add staff or admin</Btn></div>
    {e && <Alert tone="error">{e}</Alert>}{!d ? <Spinner /> : !d.rows.length ? <Empty title="No users found" /> : <Table head={['User', 'Role', 'Window', 'Status', '']}>{d.rows.map(u => <UserRow key={u._id + u.role + u.window + u.active} u={u} wins={wins} reload={load} />)}</Table>}
    <Pager d={d} page={page} setPage={setPage} />
    {add && <Modal title="Add staff or administrator" onClose={() => setAdd(false)}><form className="space-y-3" onSubmit={ev => { ev.preventDefault(); api('/admin/users', 'POST', { ...nu, window: nu.role === 'staff' ? nu.window : null }).then(() => { setAdd(false); setNu({ name: '', email: '', role: 'staff', window: '' }); ui.ok('Account created. They can sign in with a one-time code sent to this email.'); load(); }).catch(x => ui.error(x.message)); }}>
      <Field label="Full name"><input className={inp} value={nu.name} onChange={ev => setNu({ ...nu, name: ev.target.value })} required /></Field><Field label="Email address"><input className={inp} type="email" value={nu.email} onChange={ev => setNu({ ...nu, email: ev.target.value })} required /></Field>
      <Field label="Role"><select className={inp} value={nu.role} onChange={ev => setNu({ ...nu, role: ev.target.value })}><option value="staff">Staff</option><option value="admin">Administrator</option></select></Field>
      {nu.role === 'staff' && <Field label="Assigned window"><select className={inp} value={nu.window} onChange={ev => setNu({ ...nu, window: ev.target.value })} required><option value="">Select a window</option>{wins.map(w => <option key={w._id} value={w._id}>Window {w.number}{w.label ? `: ${w.label}` : ''}</option>)}</select></Field>}
      <div className="flex justify-end gap-2"><Btn v="secondary" onClick={() => setAdd(false)}>Cancel</Btn><Btn type="submit">Create account</Btn></div></form></Modal>}</div>;
}

function Holidays() {
  const ui = useUI(), [hs, load] = useLoad('/admin/holidays'), [f, setF] = useState({ date: '', name: '' });
  return <div className="space-y-3"><form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); api('/admin/holidays', 'POST', f).then(() => { setF({ date: '', name: '' }); load(); }).catch(x => ui.error(x.message)); }}><input className={`${inp} max-w-44`} type="date" aria-label="Date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} required /><input className={`${inp} flex-1`} placeholder="Holiday or event name" aria-label="Name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} required /><Btn type="submit"><Plus size={16} />Add</Btn></form>
    {!hs ? <Spinner /> : !hs.length ? <Empty title="No holidays or events" text="Dates added here are closed for booking on every window." /> : <Table head={['Date', 'Name', '']}>{hs.map(h => <tr key={h._id}><Td>{h.date}</Td><Td>{h.name}</Td><Td className="text-right"><Btn v="ghost" size="sm" aria-label="Remove" onClick={() => api(`/admin/holidays/${h._id}`, 'DELETE').then(load)}><Trash2 size={15} /></Btn></Td></tr>)}</Table>}</div>;
}

const ACTIONS = { 'POST /api/appointments': 'Appointment reserved', 'POST /api/appointments/:id/verify': 'Reservation verified', 'POST /api/appointments/:id/cancel': 'Appointment cancelled', 'POST /api/appointments/:id/reschedule': 'Appointment rescheduled', 'POST /api/appointments/:id/checkin': 'Student check-in', 'POST /api/appointments/:id/resend': 'Verification code resent', 'POST /api/auth/verify': 'Sign in', 'POST /api/manage/scan': 'QR check-in', 'POST /api/manage/scan-out': 'QR check-out', 'DELETE /api/manage/records/:id': 'Record deleted', 'POST /api/manage/walkin': 'Walk-in added', 'POST /api/manage/call-next': 'Student called', 'POST /api/manage/:id/start': 'Service started', 'POST /api/manage/:id/complete': 'Service completed', 'POST /api/manage/:id/missed': 'Marked as missed', 'POST /api/manage/:id/rejoin': 'Rejoin approved', 'POST /api/manage/appointments/:id/allow-reschedule': 'Reschedule permission changed', 'PATCH /api/manage/window': 'Schedule updated', 'POST /api/manage/closures': 'Closure added', 'DELETE /api/manage/closures/:id': 'Closure removed', 'POST /api/manage/services': 'Service created', 'PATCH /api/manage/services/:id': 'Service or checklist updated', 'POST /api/manage/uploads': 'Image uploaded', 'SYSTEM call timeout': 'Call timed out (automatic)' };
const describe = a => ACTIONS[a] || a.replace(/^(\w+) \/api\/admin\//, (_, v) => ({ POST: 'Created ', PATCH: 'Updated ', DELETE: 'Deleted ' }[v] || v + ' ')).replace(/\/:id/g, '');
function Audit() {
  const [q, setQ] = useState(''), [outcome, setOutcome] = useState(''), [page, setPage] = useState(1), dq = useDebounced(q);
  const [d, , e] = useLoad(`/admin/audit?q=${encodeURIComponent(dq)}&outcome=${outcome}&page=${page}`, []);
  useEffect(() => setPage(1), [dq, outcome]);
  return <div className="space-y-3"><div className="flex flex-wrap items-end gap-3"><div className="w-64"><Field label="Search"><input className={inp} placeholder="Action or person" value={q} onChange={ev => setQ(ev.target.value)} /></Field></div><Field label="Outcome"><select className={inp} value={outcome} onChange={ev => setOutcome(ev.target.value)}><option value="">All</option><option value="ok">Succeeded</option><option value="error">Failed or denied</option></select></Field></div>
    {e && <Alert tone="error">{e}</Alert>}{!d ? <Spinner /> : !d.rows.length ? <Empty title="No activity recorded" /> : <Table head={['Time', 'Person', 'Action', 'Result', 'IP address']}>{d.rows.map(r => <tr key={r._id}><Td className="whitespace-nowrap">{new Date(r.at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</Td><Td>{r.actorName || 'Anonymous'}{r.actorRole && <Badge>{r.actorRole}</Badge>}</Td><Td>{describe(r.action)}</Td><Td><Badge tone={r.status < 400 ? 'emerald' : 'red'}>{r.status < 400 ? 'Succeeded' : `Failed (${r.status})`}</Badge></Td><Td className="text-slate-500">{r.ip || ''}</Td></tr>)}</Table>}
    <Pager d={d} page={page} setPage={setPage} /></div>;
}

export default function Dashboard() {
  const { user, setUser } = useContext(Auth), admin = user.role === 'admin';
  const [tab, setTab] = useState(admin ? 'overview' : 'queue'), [wins, setWins] = useState([]), [deps, setDeps] = useState([]), [wid, setW] = useState(user.window || ''), [tick, setTick] = useState(0), [help, setHelp] = useState(false);
  const [tour, setTour] = useState(() => { try { return !localStorage.getItem('tour_' + user.role); } catch { return false; } }), sock = useRef(null);
  setWid(wid);
  const loadOrg = useCallback(() => { if (admin) Promise.all([api('/admin/windows'), api('/admin/departments')]).then(([w, d]) => { setWins(w); setDeps(d); setW(x => x || w.find(y => y.active)?._id || ''); }); }, [admin]);
  useEffect(loadOrg, [loadOrg]);
  useEffect(() => { const so = connect(); sock.current = so; so.on('queue:update', () => setTick(x => x + 1)); so.on('connect', () => { if (admin && wid) so.emit('watch', wid); setTick(x => x + 1); }); return () => so.close(); }, []);
  useEffect(() => { if (admin && wid) sock.current?.emit('watch', wid); }, [wid, admin]);
  const [info] = useLoad(wid ? '/manage/window' : null, [wid]);
  const closeTour = () => { try { localStorage.setItem('tour_' + user.role, '1'); } catch { } setTour(false); };
  const ops = [['queue', 'Queue', ListOrdered], ['schedule', 'Schedule', CalendarDays], ['requirements', 'Requirements', ClipboardCheck], ['records', 'Records', FileText]];
  const adm = [['overview', 'Overview', LayoutDashboard], ['org', 'Organization', Building2], ['people', 'People', Users], ['holidays', 'Holidays', Flag], ['audit', 'Audit log', ScrollText]];
  const nav = admin ? [adm[0], ...ops, ...adm.slice(1)] : ops;
  const needsWin = ops.some(o => o[0] === tab), title = nav.find(n => n[0] === tab)[1];
  const NavBtn = ([k, l, I], row) => <button key={k} onClick={() => setTab(k)} aria-current={tab === k ? 'page' : undefined} className={cx('flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium', tab === k ? 'bg-blue-50 text-blue-800' : 'text-slate-600 hover:bg-slate-100', !row && 'w-full')}><I size={17} />{l}</button>;
  return <div className="min-h-screen lg:flex">
    <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-3 lg:flex"><div className="-mx-3 -mt-3 mb-4 border-b-2 border-gold-400 bg-blue-800 px-4 py-3"><Logos /><p className="mt-2 text-sm font-semibold text-white">Appointment and Queue</p><p className="text-xs text-gold-300">{admin ? 'Administration' : 'Staff'}</p></div>
      <nav className="space-y-1">{nav.map(n => NavBtn(n))}</nav><div className="mt-auto space-y-1 border-t border-slate-100 pt-3"><p className="px-3 text-sm font-medium text-slate-800">{user.name}</p><button onClick={() => setHelp(true)} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"><HelpCircle size={17} />Help</button><button onClick={() => api('/auth/logout', 'POST').then(() => setUser(null))} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"><LogOut size={17} />Sign out</button></div></aside>
    <div className="min-w-0 flex-1">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white"><div className="flex flex-wrap items-center gap-3 px-4 py-3"><h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        {needsWin && (admin ? <label className="ml-auto flex items-center gap-2 text-sm text-slate-600">Window<select className={`${inp} w-64`} value={wid} onChange={e => setW(e.target.value)}><option value="">Select a window</option>{wins.map(w => <option key={w._id} value={w._id}>Window {w.number}{w.label ? `: ${w.label}` : ''}{w.active ? '' : ' (inactive)'}</option>)}</select></label> : info && <span className="ml-auto text-sm text-slate-600">Window {info.number}{info.label ? `: ${info.label}` : ''}, {info.department?.name}</span>)}
        <div className="ml-auto flex gap-2 lg:hidden"><Btn v="secondary" size="sm" onClick={() => setHelp(true)}>Help</Btn><Btn v="secondary" size="sm" onClick={() => api('/auth/logout', 'POST').then(() => setUser(null))}>Sign out</Btn></div></div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2 lg:hidden">{nav.map(n => NavBtn(n, true))}</nav></header>
      <main className="mx-auto max-w-5xl p-4">
        {needsWin && !wid ? <Empty title="Select a window" text="Use the window selector at the top to continue." /> : <>
          {tab === 'overview' && <Overview go={setTab} tick={tick} />}{tab === 'queue' && <QueueTab wid={wid} tick={tick} />}{tab === 'schedule' && <ScheduleTab wid={wid} />}
          {tab === 'requirements' && <RequirementsTab wid={wid} admin={admin} />}{tab === 'records' && <RecordsTab wid={wid} tick={tick} admin={admin} />}
          {tab === 'org' && <Org deps={deps} wins={wins} reload={loadOrg} />}{tab === 'people' && <People wins={wins} />}{tab === 'holidays' && <Holidays />}{tab === 'audit' && <Audit />}</>}
      </main></div>
    {tour && <Tour role={user.role} onClose={closeTour} />}{help && <Help role={user.role} onClose={() => setHelp(false)} />}
  </div>;
}
