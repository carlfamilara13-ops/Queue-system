import { useEffect, useState, useContext, useCallback } from 'react'; import { api, Auth, connect } from './api'; import { Btn, Err } from './ui';
const fmt = h => `${(h + 11) % 12 + 1}:00 ${h < 12 ? 'AM' : 'PM'}`;
export default function Staff() {
  const { user, setUser } = useContext(Auth);
  const [d, setD] = useState(null), [err, setErr] = useState(''), [tok, setTok] = useState(''), [, tick] = useState(0);
  const load = useCallback(() => api('/staff/queue').then(setD).catch(e => setErr(e.message)), []);
  useEffect(() => { load(); const so = connect(); so.on('queue:update', load); so.on('connect', load); const t = setInterval(() => tick(x => x + 1), 1000); return () => { so.close(); clearInterval(t); }; }, [load]);
  const act = (path, body) => { setErr(''); return api(path, 'POST', body).then(load).catch(e => setErr(e.message)); };
  const secs = a => Math.max(0, 300 - Math.floor((Date.now() - new Date(a.calledAt)) / 1000));
  return <div className="mx-auto max-w-2xl space-y-3 p-4">
    <div className="flex items-center justify-between"><h1 className="text-lg font-semibold">Window {d?.window.number} — {d?.window.label}</h1><button className="text-sm underline" onClick={() => api('/auth/logout', 'POST').then(() => setUser(null))}>Logout ({user.name})</button></div>
    <Err>{err}</Err>
    <form className="flex gap-2" onSubmit={e => { e.preventDefault(); act('/staff/scan', { token: tok.trim() }).then(() => setTok('')); }}><input className="flex-1 rounded border p-2 text-sm" placeholder="Scan or paste appointment QR value" value={tok} onChange={e => setTok(e.target.value)} /><button className="rounded bg-[#12305a] px-3 text-sm text-white">Check in</button></form>
    <Btn onClick={() => act('/staff/call-next')}>Call next student</Btn>
    <ul className="space-y-2">{d?.list.map(a => <li key={a._id} className="rounded border bg-white p-2 text-sm">
      <div className="flex justify-between"><b>{a.queueCode} · {a.student?.name}</b><span>{fmt(a.hour)} · {a.status.replace('_', ' ')}{a.rejoins ? ' (rejoined)' : ''}</span></div>
      {a.status === 'called' && <p className="text-orange-600">Respond within {Math.floor(secs(a) / 60)}:{String(secs(a) % 60).padStart(2, '0')}</p>}
      <div className="mt-1 flex gap-2">
        {a.status === 'called' && <><button className="underline" onClick={() => act(`/staff/${a._id}/start`)}>Start service</button><button className="underline" onClick={() => act(`/staff/${a._id}/missed`)}>Mark missed</button></>}
        {a.status === 'in_service' && <button className="underline" onClick={() => act(`/staff/${a._id}/complete`)}>Complete</button>}
        {a.status === 'missed' && <button className="underline" onClick={() => act(`/staff/${a._id}/rejoin`)}>Approve rejoin (goes to end)</button>}
      </div></li>)}
      {d && !d.list.length && <li className="text-sm text-slate-500">No appointments in the queue today.</li>}</ul>
  </div>;
}
