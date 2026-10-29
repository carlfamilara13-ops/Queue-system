import { useState, useContext, useEffect } from 'react'; import { api, Auth } from './api'; import { Btn, Alert, Field, Logos, inp, useUI } from './ui';
export default function Login() {
  const { setUser } = useContext(Auth), ui = useUI();
  const [f, setF] = useState({ email: '', name: '', studentNumber: '', course: '', code: '' }), [step, setStep] = useState(0), [isNew, setNew] = useState(false), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [cool, setCool] = useState(0), [courses, setCourses] = useState([]);
  useEffect(() => { fetch('/api/courses').then(r => r.json()).then(x => Array.isArray(x) && setCourses(x)).catch(() => { }); }, []);
  useEffect(() => { if (!cool) return; const t = setTimeout(() => setCool(cool - 1), 1000); return () => clearTimeout(t); }, [cool]);
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const run = fn => async e => { e?.preventDefault(); setErr(''); setBusy(true); try { await fn(); } catch (x) { setErr(x.message); } setBusy(false); };
  const send = run(async () => { try { await api('/auth/otp', 'POST', f); setStep(1); setCool(30); } catch (x) { if (x.message.startsWith('New account')) setNew(true); throw x; } });
  const resend = run(async () => { await api('/auth/otp', 'POST', f); setCool(30); ui.ok('A new code was sent to your email.'); });
  const verify = run(async () => setUser(await api('/auth/verify', 'POST', f)));
  return <div className="min-h-screen lg:grid lg:grid-cols-2">
    <div className="relative hidden overflow-hidden bg-blue-900 text-white lg:block"><img src="/login-bg.jpg" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover blur-sm" /><div className="absolute inset-0 bg-blue-900/80" /><div className="relative flex h-full flex-col justify-between p-12"><div className="flex items-center gap-4"><Logos /><p className="text-lg font-semibold">Appointment and Queue Management</p></div>
      <div><h1 className="text-3xl font-semibold leading-tight">Book your visit.<br />Skip the guesswork.</h1><ul className="mt-6 space-y-2 text-blue-100"><li>See open dates and times for each service window</li><li>Know exactly what to bring before you go</li><li>Check in with a QR code and follow your place in line</li></ul></div><p className="text-sm text-gold-300">Cainta Main Campus</p></div></div>
    <div className="grid place-items-center p-6"><div className="w-full max-w-sm"><div className="mb-6 rounded-lg bg-blue-800 p-3 lg:hidden"><Logos /></div><form onSubmit={step ? verify : send} className="space-y-4">
      <div><h2 className="text-2xl font-semibold text-slate-900">{step ? 'Enter your code' : 'Sign in'}</h2><p className="mt-1 text-sm text-slate-600">{step ? `We sent a 6-digit code to ${f.email}. It expires in 5 minutes.` : 'Enter your email address. We will send you a one-time code. Staff and administrators sign in here too.'}</p></div>
      {!step && <>
        <Field label="Email address"><input className={inp} type="email" autoComplete="email" value={f.email} onChange={set('email')} required autoFocus /></Field>
        {isNew && <><Alert tone="info">No account was found for this email. Enter your details to create one.</Alert><Field label="Full name"><input className={inp} value={f.name} onChange={set('name')} required /></Field><Field label="Student number"><input className={inp} value={f.studentNumber} onChange={set('studentNumber')} required /></Field><Field label="Course">{courses.length ? <select className={inp} value={f.course} onChange={set('course')} required><option value="">Select your course</option>{courses.map(c => <option key={c} value={c}>{c}</option>)}</select> : <input className={inp} value={f.course} onChange={set('course')} placeholder="For example, BS Information Technology" required />}</Field></>}
      </>}
      {step === 1 && <Field label="Verification code"><input className={`${inp} text-center text-xl tracking-[0.4em]`} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={f.code} onChange={set('code')} required autoFocus /></Field>}
      <Alert tone="error">{err}</Alert>
      <Btn type="submit" block disabled={busy}>{busy ? 'Please wait' : step ? 'Verify and sign in' : 'Send code'}</Btn>
      {step === 1 && <div className="flex justify-between text-sm"><button type="button" className="text-blue-700 hover:underline" onClick={() => { setStep(0); setErr(''); }}>Use a different email</button><button type="button" disabled={cool > 0 || busy} className="text-blue-700 hover:underline disabled:text-slate-400 disabled:no-underline" onClick={resend}>{cool ? `Resend in ${cool}s` : 'Resend code'}</button></div>}
    </form></div></div></div>;
}
