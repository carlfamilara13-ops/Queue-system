import { useEffect, useState, useContext, useCallback } from 'react'; import { QRCodeSVG } from 'qrcode.react';
import { ChevronLeft, ChevronRight, Search, HelpCircle, LogOut, Check, MapPin } from 'lucide-react';
import { api, Auth, connect } from './api'; import { Btn, Modal, Empty, Alert, StatusBadge, Checklist, Tour, Help, Spinner, Field, Logos, useUI, cx, card, inp } from './ui';
const pad = n => String(n).padStart(2, '0');
const fmt = h => `${(h + 11) % 12 + 1}:00 ${h < 12 ? 'AM' : 'PM'}`;
const range = h => `${fmt(h)} to ${fmt(h + 1)}`;
const ACTIVE = ['pending', 'reserved', 'checked_in', 'called', 'in_service'];
const todayStr = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
const STEPS = ['Service', 'Date', 'Time', 'Verify'];

function Verify({ a, onDone, onClose }) {
  const ui = useUI(), [code, setCode] = useState(''), [err, setErr] = useState(''), [left, setLeft] = useState(300), [busy, setBusy] = useState(false);
  useEffect(() => { const x = setInterval(() => setLeft(Math.max(0, Math.round((new Date(a.holdUntil) - Date.now()) / 1000))), 1000); return () => clearInterval(x); }, [a]);
  const go = async fn => { setBusy(true); setErr(''); try { await fn(); } catch (e) { setErr(e.message); } setBusy(false); };
  return <Modal title="Verify your reservation" onClose={onClose}>
    <p className="text-sm text-slate-600">We sent a 6-digit code to your email address. Check your spam folder if you do not see it.</p>
    <dl className="my-3 rounded-md bg-slate-50 p-3 text-sm"><div className="flex justify-between"><dt className="text-slate-500">Date</dt><dd>{a.date}</dd></div><div className="flex justify-between"><dt className="text-slate-500">Time</dt><dd>{range(a.hour)}</dd></div><div className="flex justify-between"><dt className="text-slate-500">Reservation held for</dt><dd className="font-semibold">{Math.floor(left / 60)}:{pad(left % 60)}</dd></div></dl>
    <Field label="Verification code"><input className={`${inp} text-center text-xl tracking-[0.4em]`} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e => setCode(e.target.value)} autoFocus /></Field>
    <div className="mt-2"><Alert tone="error">{err}</Alert></div>
    <div className="mt-4 flex flex-wrap justify-end gap-2"><Btn v="secondary" onClick={onClose}>Close</Btn><Btn v="secondary" disabled={busy || !left} onClick={() => go(async () => { await api(`/appointments/${a._id}/resend`, 'POST'); ui.ok('A new code was sent.'); })}>Resend code</Btn><Btn disabled={busy || code.length !== 6 || !left} onClick={() => go(async () => onDone(await api(`/appointments/${a._id}/verify`, 'POST', { code })))}>Verify reservation</Btn></div></Modal>;
}

export default function Student() {
  const ui = useUI(), { user, setUser } = useContext(Auth);
  const [cat, setCat] = useState(null), [dep, setDep] = useState(''), [win, setWin] = useState(''), [svc, setSvc] = useState(null);
  const [month, setMonth] = useState(() => { const d = new Date(); return [d.getFullYear(), d.getMonth() + 1]; });
  const [days, setDays] = useState({}), [date, setDate] = useState(''), [slots, setSlots] = useState([]), [mine, setMine] = useState(null);
  const [pick, setPick] = useState(null), [verify, setVerify] = useState(null), [find, setFind] = useState(true), [busy, setBusy] = useState(false), [q, setQ] = useState(''), [chosen, setChosen] = useState(null);
  const [rs, setRs] = useState(false), [help, setHelp] = useState(false), [, tk] = useState(0), [courses, setCourses] = useState([]), [cv, setCv] = useState(''), [cdone, setCdone] = useState(false);
  useEffect(() => { if (!user.course) api('/courses').then(setCourses).catch(() => { }); }, []);
  const saveCourse = () => api('/me/course', 'POST', { course: cv }).then(u => { setUser(u); ui.ok('Course saved.'); }).catch(e => ui.error(e.message));
  const [tour, setTour] = useState(() => { try { return !localStorage.getItem('tour_student'); } catch { return false; } });
  const closeTour = () => { try { localStorage.setItem('tour_student', '1'); } catch { } setTour(false); };
  const loadMine = useCallback(() => api('/appointments/mine').then(setMine).catch(() => { }), []);
  useEffect(() => { api('/catalog').then(setCat).catch(e => ui.error(e.message)); loadMine(); const so = connect(); so.on('appointment:update', loadMine); so.on('connect', loadMine); return () => so.close(); }, [loadMine]);
  useEffect(() => { const i = setInterval(() => tk(x => x + 1), 1000); return () => clearInterval(i); }, []);
  const [y, m] = month;
  const refresh = useCallback(() => {
    if (!win) return; api(`/windows/${win}/calendar?month=${y}-${pad(m)}`).then(setDays).catch(e => ui.error(e.message));
    if (date) api(`/windows/${win}/slots?date=${date}`).then(setSlots).catch(e => ui.error(e.message));
  }, [win, y, m, date]);
  useEffect(refresh, [refresh]);
  const W = id => cat?.wins.find(w => w._id === id), D = id => cat?.deps.find(d => d._id === id)?.name;
  const wsv = cat?.svcs.filter(s => s.window === win) || [];
  const service = svc && svc.window === win ? svc : wsv.length === 1 ? wsv[0] : null;
  const act = mine?.find(a => ACTIVE.includes(a.status)), aw = act && W(act.window);
  useEffect(() => { if (act?.status === 'called') navigator.vibrate?.([300, 100, 300]); }, [act?.status]);
  const shift = k => setMonth(([yy, mm]) => { const d = new Date(yy, mm - 1 + k, 1); return [d.getFullYear(), d.getMonth() + 1]; });
  const choose = s => { const w = W(s.window); setDep(w.department); setWin(w._id); setSvc(s); setDate(''); setSlots([]); setFind(false); };
  const startRs = () => { setDep(W(act.window).department); setWin(act.window); setSvc(null); setDate(''); setSlots([]); setRs(true); };
  const submit = async () => {
    setBusy(true);
    try {
      if (rs) { await api(`/appointments/${act._id}/reschedule`, 'POST', { date, hour: pick }); setRs(false); setDate(''); setPick(null); ui.ok('Your appointment was moved.'); loadMine(); }
      else { const a = await api('/appointments', 'POST', { windowId: win, serviceId: service._id, date, hour: pick }); setPick(null); setVerify(a); loadMine(); }
    } catch (e) { ui.error(e.message); setPick(null); refresh(); } setBusy(false);
  };
  const doAct = (path, okMsg) => api(path, 'POST').then(() => { if (okMsg) ui.ok(okMsg); loadMine(); refresh(); }).catch(e => ui.error(e.message));
  const toggleReq = (i, on) => api(`/appointments/${act._id}/checklist`, 'POST', { index: i, prepared: on }).then(loadMine).catch(e => ui.error(e.message));
  const first = new Date(y, m - 1, 1).getDay(), n = new Date(y, m, 0).getDate();
  const hits = cat ? cat.svcs.filter(s => W(s.window)?.active && s.name.toLowerCase().includes(q.toLowerCase())) : [];
  const step = act?.status === 'pending' ? 4 : date ? 3 : win && service ? 2 : 1;
  const mh = cat?.hol.filter(h => h.date.startsWith(`${y}-${pad(m)}`)) || [];
  const left = act?.calledAt ? Math.max(0, 300 - Math.floor((Date.now() - new Date(act.calledAt)) / 1000)) : 0;
  const logout = () => api('/auth/logout', 'POST').then(() => setUser(null));
  if (!cat || !mine) return <Spinner />;
  return <div className="min-h-screen">
    <header className="sticky top-0 z-20 border-b-2 border-gold-400 bg-blue-800 text-white"><div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5"><Logos /><div className="hidden sm:block"><p className="text-sm font-semibold">Appointment and Queue</p><p className="text-xs text-gold-300">Cainta Main Campus</p></div>
      <div className="ml-auto flex items-center gap-2"><span className="hidden text-sm text-blue-100 sm:inline">{user.name}</span><Btn v="secondary" size="sm" onClick={() => setHelp(true)}><HelpCircle size={15} />Help</Btn><Btn v="secondary" size="sm" onClick={logout}><LogOut size={15} />Sign out</Btn></div></div></header>
    <main className="mx-auto grid max-w-6xl gap-4 p-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {act?.status === 'called' && <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4"><p className="text-base font-semibold text-emerald-900">You are being called</p><p className="text-sm text-emerald-800">Please proceed to Window {aw?.number} now. Time remaining: {Math.floor(left / 60)}:{pad(left % 60)}. If you do not arrive in time, your place may be forfeited.</p></div>}
        {act?.rescheduleAllowed && act.status === 'reserved' && <Alert tone="warn" title="Rescheduling is open for your appointment">{act.rescheduleNote}<div className="mt-2">{rs ? <Btn v="secondary" size="sm" onClick={() => { setRs(false); setDate(''); }}>Cancel reschedule</Btn> : <Btn size="sm" onClick={startRs}>Choose a new time</Btn>}</div></Alert>}
        <section className={`${card} p-4`}>
          <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-lg font-semibold text-slate-900">{rs ? 'Reschedule your appointment' : 'Book an appointment'}</h1><Btn v="secondary" size="sm" onClick={() => setFind(true)}><Search size={15} />Find a service</Btn></div>
          <ol className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">{STEPS.map((s, i) => { const k = i + 1; return <li key={s} className="flex items-center gap-2 text-xs"><span className={cx('grid h-6 w-6 place-items-center rounded-full font-semibold', k < step ? 'bg-blue-700 text-white' : k === step ? 'border-2 border-blue-700 text-blue-700' : 'border border-slate-300 text-slate-400')}>{k < step ? <Check size={13} /> : k}</span><span className={k <= step ? 'font-medium text-slate-800' : 'text-slate-400'}>{s}</span>{i < 3 && <span className="h-px w-6 bg-slate-300" />}</li>; })}</ol>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Department"><select className={inp} value={dep} disabled={rs} onChange={e => { setDep(e.target.value); setWin(''); setSvc(null); setDate(''); }}><option value="">Select a department</option>{cat.deps.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}</select></Field>
            <Field label="Window"><select className={inp} value={win} disabled={!dep || rs} onChange={e => { setWin(e.target.value); setDate(''); }}><option value="">Select a window</option>{cat.wins.filter(x => x.department === dep).map(x => <option key={x._id} value={x._id} disabled={!x.active}>Window {x.number}{x.active ? (x.label ? `: ${x.label}` : '') : ' (opening soon)'}</option>)}</select></Field></div>
          {win && !service && wsv.length > 1 && <div className="mt-3"><Field label="Service"><select className={inp} onChange={e => setSvc(wsv.find(s => s._id === e.target.value))}><option value="">Select a service</option>{wsv.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}</select></Field></div>}
          {service && !rs && <div className="mt-4"><h3 className="text-sm font-semibold text-slate-900">{service.name}</h3><p className="mb-2 flex items-center gap-1 text-xs text-slate-500"><MapPin size={13} />{D(W(win).department)}, Window {W(win).number}</p><p className="mb-1 text-sm font-medium text-slate-700">Requirements checklist</p><Checklist items={service.requirements} /></div>}
        </section>
        <section className={`${card} p-4`}>
          <div className="mb-3 flex items-center justify-between"><button aria-label="Previous month" className="rounded p-1.5 hover:bg-slate-100" onClick={() => shift(-1)}><ChevronLeft size={18} /></button><h2 className="text-sm font-semibold">{new Date(y, m - 1).toLocaleString('en', { month: 'long', year: 'numeric' })}</h2><button aria-label="Next month" className="rounded p-1.5 hover:bg-slate-100" onClick={() => shift(1)}><ChevronRight size={18} /></button></div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs">{'Su Mo Tu We Th Fr Sa'.split(' ').map(d => <div key={d} className="py-1 font-medium text-slate-500">{d}</div>)}{Array.from({ length: first }).map((_, i) => <div key={'b' + i} />)}
            {Array.from({ length: n }, (_, i) => { const dt = `${y}-${pad(m)}-${pad(i + 1)}`, st = days[dt] || 'unavailable'; return <button key={dt} disabled={st !== 'available'} aria-label={`${dt}, ${st}`} onClick={() => setDate(dt)} className={cx('aspect-square rounded-md border text-sm', dt === date ? 'border-transparent bg-gradient-to-br from-blue-800 to-gold-400 text-white' : st === 'available' ? 'border-slate-300 bg-white hover:border-blue-700 hover:bg-blue-50' : st === 'full' ? 'border-red-100 bg-red-50 text-red-400' : 'border-transparent bg-slate-50 text-slate-300')}>{i + 1}</button>; })}</div>
          <p className="mt-3 text-xs text-slate-500">Bordered dates are open. Red dates are full. Grey dates are not available. New dates open every 12:00 AM.</p>
          {!win && <div className="mt-3"><Alert tone="info">Select a department and window, or use Find a service, to see available dates.</Alert></div>}
          {mh.length > 0 && <div className="mt-3 border-t border-slate-100 pt-2"><p className="text-xs font-semibold text-slate-700">Holidays and campus events</p>{mh.map(h => <p key={h._id} className="text-xs text-slate-600">{h.date.slice(5)}: {h.name}</p>)}</div>}
        </section>
        {date && <section className={`${card} p-4`}><h2 className="mb-3 text-sm font-semibold">Available times on {date}</h2>
          {act && !rs && <div className="mb-3"><Alert tone="info">You already have an active appointment. Cancel it before booking another.</Alert></div>}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{Array.from({ length: 10 }, (_, i) => 8 + i).map(hr => { const s = slots.find(x => x.hour === hr), ok = s?.status === 'open' && (rs || (!act && service)); return <button key={hr} disabled={!ok} onClick={() => setPick(hr)} className={cx('rounded-md border p-2.5 text-left text-sm', ok ? 'border-slate-300 bg-white hover:border-blue-700 hover:bg-blue-50' : 'border-slate-100 bg-slate-50 text-slate-400')}><span className="block font-medium">{fmt(hr)}</span><span className="block text-xs">{!s || s.status === 'closed' ? 'Unavailable' : s.status === 'full' ? 'Full' : `${s.left} available`}</span></button>; })}</div></section>}
      </div>
      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <section className={`${card} p-4`}><h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">My appointment</h2>
          {!act ? <div className="mt-3"><Empty title="No active appointment" text="Choose a service to book one." /></div> : <div className="mt-3 space-y-3">
            <div className="flex items-start justify-between gap-2"><div><p className="font-semibold text-slate-900">{act.serviceName}</p><p className="text-sm text-slate-600">{act.date}, {range(act.hour)}</p><p className="text-sm text-slate-600">{aw && D(aw.department)}, Window {aw?.number}</p></div><StatusBadge s={act.status} /></div>
            {act.queueCode && <div className="rounded-md bg-slate-50 p-3 text-center"><p className="text-xs text-slate-500">Queue code</p><p className="font-mono text-2xl font-bold tracking-wider text-slate-900">{act.queueCode}</p></div>}
            {act.status === 'checked_in' && <p className="text-sm text-slate-700">People ahead of you: <b>{act.ahead ?? 0}</b></p>}
            {act.qrToken && ['reserved', 'checked_in'].includes(act.status) && <div className="flex flex-col items-center gap-1 rounded-md border border-slate-200 p-3"><QRCodeSVG value={act.qrToken} size={150} /><p className="text-xs text-slate-500">Show this code at the window</p></div>}
            {act.reqSnapshot?.length > 0 && <div><p className="mb-1 text-sm font-medium text-slate-700">Requirements ({act.prepared?.length || 0} of {act.reqSnapshot.length} prepared)</p><Checklist items={act.reqSnapshot} prepared={act.prepared || []} verified={act.verified || []} mode="student" onToggle={toggleReq} /></div>}
            <div className="space-y-2">{act.status === 'pending' && <Btn block onClick={() => setVerify(act)}>Enter verification code</Btn>}
              {act.status === 'reserved' && <><Btn block v="success" disabled={act.date !== todayStr()} onClick={() => doAct(`/appointments/${act._id}/checkin`, 'You are checked in.')}>Check in</Btn>{act.date !== todayStr() && <p className="text-center text-xs text-slate-500">Check-in opens on {act.date}.</p>}</>}
              {['pending', 'reserved'].includes(act.status) && <Btn block v="secondary" className="text-red-700" onClick={async () => (await ui.confirm('Cancel this reservation? This cannot be undone.', { danger: true, confirmText: 'Cancel reservation', cancelText: 'Keep it' })) && doAct(`/appointments/${act._id}/cancel`, 'Reservation cancelled.')}>Cancel reservation</Btn>}</div></div>}</section>
        {mine.filter(a => a !== act).length > 0 && <section className={`${card} p-4`}><h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Recent</h2><ul className="divide-y divide-slate-100">{mine.filter(a => a !== act).slice(0, 5).map(a => <li key={a._id} className="flex items-center justify-between gap-2 py-2 text-sm"><span className="min-w-0"><span className="block truncate">{a.serviceName}</span><span className="text-xs text-slate-500">{a.date}</span></span><StatusBadge s={a.status} /></li>)}</ul></section>}
      </aside>
    </main>
    {tour && <Tour role="student" onClose={closeTour} />}{help && <Help role="student" onClose={() => setHelp(false)} />}
    {!user.course && !tour && !cdone && <Modal title="Complete your profile" onClose={() => setCdone(true)}><p className="mb-3 text-sm text-slate-600">Select your course. It appears on your visit record.</p><Field label="Course">{courses.length ? <select className={inp} value={cv} onChange={e => setCv(e.target.value)}><option value="">Select your course</option>{courses.map(c => <option key={c} value={c}>{c}</option>)}</select> : <input className={inp} value={cv} onChange={e => setCv(e.target.value)} placeholder="For example, BS Information Technology" />}</Field><div className="mt-5 flex justify-end gap-2"><Btn v="secondary" onClick={() => setCdone(true)}>Later</Btn><Btn disabled={!cv.trim()} onClick={saveCourse}>Save</Btn></div></Modal>}
    {find && !tour && (user.course || cdone) && !act && <Modal title="Welcome! How can we help you today?" onClose={() => setFind(false)}>
      <p className="mb-3 text-sm text-slate-600">Find the document or service you need. We will guide you to the right department and window.</p>
      <div className="relative"><Search size={16} className="absolute left-3 top-3 text-slate-400" /><input className={`${inp} pl-9`} placeholder="Search for a document or service" aria-label="Search for a document or service" aria-autocomplete="list" value={q} onChange={e => { setQ(e.target.value); setChosen(null); }} onKeyDown={e => e.key === 'Enter' && hits[0] && !chosen && (setChosen(hits[0]), setQ(hits[0].name))} autoFocus /></div>
      {!chosen && q && <ul role="listbox" className="mt-1 max-h-48 overflow-auto rounded-md border border-slate-200">{hits.length ? hits.map(s => <li key={s._id}><button role="option" className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50" onClick={() => { setChosen(s); setQ(s.name); }}>{s.name}</button></li>) : <li className="px-3 py-2 text-sm text-slate-500">No matching service. Try a different word.</li>}</ul>}
      {chosen && <div className="mt-4 space-y-2"><p className="text-sm">Go to <b>{D(W(chosen.window).department)}, Window {W(chosen.window).number}</b></p><Checklist items={chosen.requirements} /><Btn block onClick={() => choose(chosen)}>Continue to calendar</Btn></div>}
      <button className="mt-4 w-full text-center text-sm text-slate-500 hover:underline" onClick={() => setFind(false)}>Skip for now</button></Modal>}
    {pick !== null && <Modal title={rs ? 'Move to this time?' : 'Confirm reservation'} onClose={() => setPick(null)}><dl className="space-y-1 text-sm"><div className="flex justify-between"><dt className="text-slate-500">Service</dt><dd>{rs ? act.serviceName : service.name}</dd></div><div className="flex justify-between"><dt className="text-slate-500">Location</dt><dd>{D(W(win).department)}, Window {W(win).number}</dd></div><div className="flex justify-between"><dt className="text-slate-500">Date</dt><dd>{date}</dd></div><div className="flex justify-between"><dt className="text-slate-500">Time</dt><dd>{range(pick)}</dd></div><div className="flex justify-between"><dt className="text-slate-500">Booking as</dt><dd>{user.email}</dd></div></dl>
      {!rs && <p className="mt-3 text-xs text-slate-500">We will email a code to confirm. The slot is held for 5 minutes.</p>}<div className="mt-5 flex justify-end gap-2"><Btn v="secondary" onClick={() => setPick(null)}>Back</Btn><Btn disabled={busy} onClick={submit}>{rs ? 'Move appointment' : 'Reserve slot'}</Btn></div></Modal>}
    {verify && <Verify a={verify} onClose={() => setVerify(null)} onDone={a => { setVerify(null); ui.ok(`Reservation confirmed. Your queue code is ${a.queueCode}.`); loadMine(); refresh(); }} />}
  </div>;
}
