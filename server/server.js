import 'dotenv/config';
import express from 'express'; import http from 'http'; import { Server } from 'socket.io'; import cors from 'cors';
import cookieParser from 'cookie-parser'; import rateLimit from 'express-rate-limit'; import jwt from 'jsonwebtoken';
import crypto from 'crypto'; import nodemailer from 'nodemailer'; import mongoose from 'mongoose';
import helmet from 'helmet'; import compression from 'compression'; import morgan from 'morgan'; import multer from 'multer';
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';
import { User, Department, Window, Service, Holiday, Otp, Counter, Appointment, Closure, AuditLog, Course, ACTIVE } from './models.js';
const { PORT = 4000, MONGO_URI, JWT_SECRET, CLIENT_URL = 'http://localhost:5173', GMAIL_USER, GMAIL_APP_PASSWORD, DEV_LOG_OTP, NODE_ENV, TRUST_PROXY, UPLOAD_DIR = './uploads' } = process.env;
const PROD = NODE_ENV === 'production';
const placeholder = v => !v || /^x+( x+)*$/i.test(v) || /^yourgmail/i.test(v);
const die = m => { console.error('Configuration error: ' + m); process.exit(1); };
if (!MONGO_URI || !JWT_SECRET) die('MONGO_URI and JWT_SECRET are required');
if (PROD && (JWT_SECRET.length < 32 || /change-me/i.test(JWT_SECRET))) die('JWT_SECRET must be a random string of at least 32 characters in production');
if (PROD && DEV_LOG_OTP === 'true') die('DEV_LOG_OTP must not be enabled in production');
if (PROD && (placeholder(GMAIL_USER) || placeholder(GMAIL_APP_PASSWORD))) die('GMAIL_USER and GMAIL_APP_PASSWORD are required in production');
const AHEAD = 14;
const app = express(), srv = http.createServer(app), io = new Server(srv, { cors: { origin: CLIENT_URL, credentials: true } });
if (TRUST_PROXY === 'true') app.set('trust proxy', 1);
app.disable('x-powered-by'); fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], imgSrc: ["'self'", 'data:', 'blob:'], connectSrc: ["'self'", 'ws:', 'wss:'], styleSrc: ["'self'", "'unsafe-inline'"], scriptSrc: ["'self'"], objectSrc: ["'none'"], frameAncestors: ["'none'"], upgradeInsecureRequests: process.env.HTTPS === 'true' ? [] : null } } }));
app.use(compression(), morgan(PROD ? 'combined' : 'dev'));
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d', immutable: true, index: false, dotfiles: 'deny' }));
app.use(cors({ origin: CLIENT_URL, credentials: true }), express.json({ limit: '100kb' }), cookieParser());
app.use('/api', rateLimit({ windowMs: 6e4, limit: 300 }));
app.use('/api', (q, s, n) => { const o = q.get('origin'); if (q.method !== 'GET' && o && o !== new URL(CLIENT_URL).origin) return s.status(403).json({ error: 'Origin not allowed' }); n(); });
app.get('/healthz', (q, s) => s.json({ ok: true }));
app.get('/readyz', (q, s) => mongoose.connection.readyState === 1 ? s.json({ ok: true }) : s.status(503).json({ ok: false }));
const QUIET = [/\/checklist$/, /\/auth\/otp$/, /\/auth\/logout$/];
app.use('/api', (q, s, n) => {
  if (q.method === 'GET' || q.method === 'OPTIONS') return n();
  s.on('finish', () => {
    const route = q.route?.path || q.originalUrl.split('?')[0]; if (QUIET.some(r => r.test(route))) return;
    AuditLog.create({ actor: q.user?._id, actorName: q.user?.name, actorRole: q.user?.role, action: `${q.method} ${route}`, target: q.params?.id, window: q.wid || q.user?.window, status: s.statusCode, ip: q.ip }).catch(() => { });
  }); n();
});
const mail = !placeholder(GMAIL_USER) && !placeholder(GMAIL_APP_PASSWORD) ? nodemailer.createTransport({ service: 'gmail', auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD } }) : null;
const fail = (status, message) => Object.assign(new Error(message), { status });
const h = fn => (q, s, n) => fn(q, s, n).catch(e => {
  let status = e.status, msg = e.message;
  if (!status) { if (e.code === 11000) { status = 409; msg = 'That record already exists'; } else if (e.name === 'ValidationError' || e.name === 'CastError') { status = 400; msg = 'Invalid data'; } }
  if (!status) console.error(e); s.status(status || 500).json({ error: status ? msg : 'Something went wrong. Please try again.' });
});
const hash = c => crypto.createHmac('sha256', JWT_SECRET).update(c).digest('hex');
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
const hourNow = () => +new Date().toLocaleString('en-GB', { timeZone: 'Asia/Manila', hour: '2-digit', hour12: false }) % 24;
const dayOf = d => new Date(d + 'T00:00:00Z').getUTCDay();
const addDays = (d, n) => new Date(new Date(d + 'T00:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10);
const ping = a => { if (a.student) io.to('user:' + a.student).emit('appointment:update', { id: a.id }); io.to('window:' + a.window).emit('queue:update'); };

async function sendOtp(key, email, payload, detail = '') {
  const old = await Otp.findOne({ key });
  if (old?.lastSent && Date.now() - old.lastSent < 3e4) throw fail(429, 'Please wait 30 seconds before requesting another code');
  const code = String(crypto.randomInt(0, 1e6)).padStart(6, '0');
  if (!mail && DEV_LOG_OTP !== 'true') throw fail(503, 'The email service is not configured');
  await Otp.findOneAndUpdate({ key }, { hash: hash(code), expiresAt: new Date(Date.now() + 3e5), attempts: 0, lastSent: new Date(), payload }, { upsert: true });
  const text = `Your verification code is ${code}.\nIt expires in 5 minutes and allows 3 attempts.\n${detail}\nIf you did not request this, you can ignore this email.`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden"><div style="background:#14305c;color:#fff;padding:14px 20px;font-size:16px;font-weight:bold"><span style="display:inline-block;background:#fff;border-radius:8px;padding:6px 10px;vertical-align:middle"><img src="${CLIENT_URL}/epila-logo.png" alt="ePila" height="34" style="vertical-align:middle"> <img src="${CLIENT_URL}/icct-seal.png" alt="ICCT Colleges Foundation" height="34" style="vertical-align:middle;margin-left:8px"></span><div style="margin-top:10px">Appointment and Queue Management</div></div><div style="padding:20px;color:#0f172a"><p style="margin:0 0 12px">Use this code to continue:</p><p style="font-size:32px;letter-spacing:8px;font-weight:bold;margin:0 0 12px">${code}</p><p style="margin:0 0 8px;color:#475569;font-size:14px">It expires in 5 minutes and allows 3 attempts. ${detail}</p><p style="margin:0;color:#94a3b8;font-size:12px">If you did not request this, you can ignore this email.</p></div></div>`;
  if (!mail) return console.log('DEV OTP', email, code);
  try { await mail.sendMail({ from: `"Appointment and Queue" <${GMAIL_USER}>`, to: email, subject: `${code} is your verification code`, text, html }); }
  catch (e) { console.error('Email send failed:', e.message); if (!PROD && DEV_LOG_OTP === 'true') return console.log('DEV OTP', email, code); throw fail(502, 'We could not send the email. Please try again shortly.'); }
}
async function checkOtp(key, code) {
  const o = await Otp.findOne({ key });
  if (!o || o.expiresAt < new Date()) throw fail(400, 'Code expired. Request a new one.');
  if (o.attempts >= 3) throw fail(429, 'No attempts left. Request a new code.');
  if (o.hash !== hash(String(code))) { o.attempts++; await o.save(); throw fail(400, `Incorrect code. ${3 - o.attempts} attempt(s) left.`); }
  await o.deleteOne(); return o.payload || {};
}

const pub = u => ({ id: u.id, email: u.email, name: u.name, studentNumber: u.studentNumber, course: u.course, role: u.role, window: u.window });
const auth = (...roles) => h(async (q, s, n) => {
  try { const t = jwt.verify(q.cookies.token, JWT_SECRET), u = await User.findById(t.id); if (u && (u.tokenVersion || 0) === (t.tv || 0)) q.user = u; } catch { }
  if (!q.user || q.user.active === false || (roles.length && !roles.includes(q.user.role))) throw fail(q.user ? 403 : 401, 'Not allowed'); n();
});
const lim = rateLimit({ windowMs: 6e4, limit: 15 });
app.post('/api/auth/otp', lim, h(async (q, s) => {
  const email = String(q.body.email || '').toLowerCase().trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw fail(400, 'Enter a valid email');
  const name = String(q.body.name || '').trim(), sn = String(q.body.studentNumber || '').trim();
  let course;
  if (!(await User.exists({ email }))) { if (!name || !sn) throw fail(404, 'New account: enter your name, student number and course'); course = await checkCourse(q.body.course); }
  await sendOtp('login:' + email, email, { name, sn, course }); s.json({ ok: true });
}));
app.post('/api/auth/verify', lim, h(async (q, s) => {
  const email = String(q.body.email || '').toLowerCase().trim(); const p = await checkOtp('login:' + email, q.body.code);
  const u = (await User.findOne({ email })) || (await User.create({ email, name: p.name, studentNumber: p.sn, course: p.course }));
  if (u.active === false) throw fail(403, 'This account is disabled'); q.user = u;
  s.cookie('token', jwt.sign({ id: u.id, tv: u.tokenVersion || 0 }, JWT_SECRET, { expiresIn: '8h' }), { httpOnly: true, sameSite: 'lax', secure: PROD && process.env.HTTPS !== 'false', maxAge: 288e5 }).json(pub(u));
}));
app.post('/api/auth/logout', h(async (q, s) => { try { const t = jwt.verify(q.cookies.token, JWT_SECRET); await User.updateOne({ _id: t.id }, { $inc: { tokenVersion: 1 } }); } catch { } s.clearCookie('token').json({ ok: true }); }));
app.get('/api/me', auth(), (q, s) => s.json(pub(q.user)));
const checkCourse = async v => {
  const c = String(v || '').trim().slice(0, 100), list = await Course.find({ active: true });
  if (list.length) { const hit = list.find(x => x.name === c); if (!hit) throw fail(400, 'Select your course from the list'); return hit.name; }
  if (!c) throw fail(400, 'Enter your course'); return c;
};
app.get('/api/courses', h(async (q, s) => s.json((await Course.find({ active: true }).sort('name')).map(c => c.name))));
app.post('/api/me/course', auth('student'), h(async (q, s) => { q.user.course = await checkCourse(q.body.course); await q.user.save(); s.json(pub(q.user)); }));

app.get('/api/catalog', auth(), h(async (q, s) => {
  const [deps, wins, svcs, hol] = await Promise.all([Department.find({ active: true }), Window.find().sort('number'), Service.find({ active: true }), Holiday.find()]);
  s.json({ deps, wins, svcs, hol });
}));
const getWin = async id => { const w = mongoose.isValidObjectId(id) && await Window.findById(id); if (!w?.active) throw fail(404, 'Window unavailable'); return w; };
app.get('/api/windows/:id/calendar', auth(), h(async (q, s) => {
  const w = await getWin(q.params.id); const [y, m] = String(q.query.month).split('-').map(Number); if (!y || !m) throw fail(400, 'month=YYYY-MM');
  const hol = new Set((await Holiday.find()).map(x => x.date)), t = today(), max = addDays(t, AHEAD), used = {};
  const shut = new Set((await Closure.find({ window: w.id, date: { $gte: t } })).filter(c => c.hour == null).map(c => c.date));
  (await Counter.find({ _id: new RegExp(`^slot:${w.id}:`) })).forEach(c => { const p = c._id.split(':'); if (w.hours.includes(+p[3])) used[p[2]] = (used[p[2]] || 0) + c.n; });
  const days = {};
  for (let d = 1; d <= new Date(y, m, 0).getDate(); d++) {
    const date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    days[date] = date < t || date > max || hol.has(date) || shut.has(date) || !w.days.includes(dayOf(date)) ? 'unavailable' : (used[date] || 0) >= w.hours.length * w.capacity ? 'full' : 'available';
  }
  s.json(days);
}));
app.get('/api/windows/:id/slots', auth(), h(async (q, s) => {
  const w = await getWin(q.params.id), date = String(q.query.date), out = [], shut = await Closure.find({ window: w.id, date });
  for (const hr of w.hours) {
    const c = await Counter.findById(`slot:${w.id}:${date}:${hr}`), left = w.capacity - (c?.n || 0);
    const closed = (date === today() && hr <= hourNow()) || shut.some(x => x.hour == null || x.hour === hr);
    out.push({ hour: hr, left, status: closed ? 'closed' : left > 0 ? 'open' : 'full' });
  }
  s.json(out);
}));

async function release(id, from, to) {
  const a = await Appointment.findOneAndUpdate({ _id: id, status: { $in: from } }, { status: to }, { new: true });
  if (a) await Counter.updateOne({ _id: `slot:${a.window}:${a.date}:${a.hour}` }, { $inc: { n: -1 } }); return a;
}
const mine = async q => { const a = mongoose.isValidObjectId(q.params.id) && await Appointment.findOne({ _id: q.params.id, student: q.user.id }); if (!a) throw fail(404, 'Not found'); return a; };
const order = { walkIn: 1, rejoins: 1, hour: 1, checkedInAt: 1 };
async function claimSlot(w, date, hour) {
  const t = today();
  if (!(date >= t && date <= addDays(t, AHEAD)) || !w.days.includes(dayOf(date)) || !w.hours.includes(hour) || (date === t && hour <= hourNow()) || await Holiday.exists({ date }) || await Closure.exists({ window: w.id, date, $or: [{ hour: null }, { hour }] })) throw fail(400, 'That slot cannot be booked');
  const key = `slot:${w.id}:${date}:${hour}`;
  const c = await Counter.findOneAndUpdate({ _id: key, n: { $lt: w.capacity } }, { $inc: { n: 1 } }, { upsert: true, new: true }).catch(e => { if (e.code === 11000) return null; throw e; });
  if (!c) throw fail(409, 'This slot just became full'); return key;
}
app.post('/api/appointments', auth('student'), h(async (q, s) => {
  const { windowId, serviceId, hour } = q.body, date = String(q.body.date);
  const w = await getWin(windowId), sv = mongoose.isValidObjectId(serviceId) && await Service.findOne({ _id: serviceId, window: w.id, active: true });
  if (!sv) throw fail(400, 'Invalid service for this window');
  const key = await claimSlot(w, date, hour);
  let a;
  try { a = await Appointment.create({ student: q.user.id, window: w.id, service: sv.id, serviceName: sv.name, reqSnapshot: sv.requirements, date, hour, holdUntil: new Date(Date.now() + 3e5) }); }
  catch (e) { await Counter.updateOne({ _id: key }, { $inc: { n: -1 } }); throw e.code === 11000 ? fail(409, 'You already have an active appointment') : e; }
  try { await sendOtp('appt:' + a.id, q.user.email, {}, `Reservation ${date}`); } catch (e) { await release(a.id, ['pending'], 'cancelled'); throw e; }
  s.json(a);
}));
app.post('/api/appointments/:id/reschedule', auth('student'), h(async (q, s) => {
  const a = await mine(q); if (a.status !== 'reserved' || !a.rescheduleAllowed) throw fail(403, 'Staff has not opened rescheduling for this appointment');
  const w = await getWin(a.window), date = String(q.body.date), key = await claimSlot(w, date, q.body.hour);
  const r = await Appointment.findOneAndUpdate({ _id: a.id, status: 'reserved', rescheduleAllowed: true }, { date, hour: q.body.hour, rescheduleAllowed: false, $unset: { rescheduleNote: 1 }, $inc: { reschedules: 1 } }, { new: true });
  if (!r) { await Counter.updateOne({ _id: key }, { $inc: { n: -1 } }); throw fail(409, 'Could not reschedule, try again'); }
  await Counter.updateOne({ _id: `slot:${a.window}:${a.date}:${a.hour}` }, { $inc: { n: -1 } }); ping(r); s.json(r);
}));
app.post('/api/appointments/:id/resend', auth('student'), h(async (q, s) => {
  const a = await mine(q); if (a.status !== 'pending' || a.holdUntil < new Date()) throw fail(400, 'Reservation expired');
  await sendOtp('appt:' + a.id, q.user.email, {}); s.json({ ok: true });
}));
app.post('/api/appointments/:id/verify', auth('student'), lim, h(async (q, s) => {
  const a = await mine(q); if (a.status !== 'pending' || a.holdUntil < new Date()) throw fail(400, 'Reservation expired');
  await checkOtp('appt:' + a.id, q.body.code);
  const w = await Window.findById(a.window), seq = (await Counter.findOneAndUpdate({ _id: `q:${a.window}:${a.date}` }, { $inc: { n: 1 } }, { upsert: true, new: true })).n;
  const r = await Appointment.findOneAndUpdate({ _id: a.id, status: 'pending' }, { status: 'reserved', queueCode: `${w.prefix}${w.number}-${String(seq).padStart(3, '0')}`, qrToken: crypto.randomBytes(16).toString('hex'), $unset: { holdUntil: 1 } }, { new: true });
  if (!r) throw fail(409, 'Reservation expired'); ping(r); s.json(r);
}));
app.get('/api/appointments/mine', auth('student'), h(async (q, s) => {
  const list = await Appointment.find({ student: q.user.id }).sort('-createdAt').limit(10).lean();
  for (const a of list) if (a.status === 'checked_in') a.ahead = await Appointment.countDocuments({ window: a.window, date: a.date, status: 'checked_in', walkIn: { $ne: true }, $or: [{ rejoins: { $lt: a.rejoins } }, { rejoins: a.rejoins, hour: { $lt: a.hour } }, { rejoins: a.rejoins, hour: a.hour, checkedInAt: { $lt: a.checkedInAt } }] });
  s.json(list);
}));
app.post('/api/appointments/:id/cancel', auth('student'), h(async (q, s) => {
  const a = await mine(q); const r = await release(a.id, ['pending', 'reserved'], 'cancelled'); if (!r) throw fail(400, `Cannot cancel (${a.status})`); ping(r); s.json(r);
}));
async function checkIn(a, by) {
  if (a.date !== today()) throw fail(400, `Check-in is only available on ${a.date}`);
  if (a.status === 'checked_in') return a;
  const r = await Appointment.findOneAndUpdate({ _id: a.id, status: 'reserved' }, { status: 'checked_in', checkedInAt: new Date(), checkedInBy: by?._id || null, checkInMethod: by ? 'staff_scan' : 'self' }, { new: true });
  if (!r) throw fail(400, `Cannot check in (${a.status})`); ping(r); return r;
}
const manila = d => d.toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', second: '2-digit' });
async function checkOut(a, by) {
  if (a.status === 'completed') throw fail(409, `Already checked out${a.completedAt ? ' at ' + manila(a.completedAt) : ''}`);
  if (!['called', 'in_service'].includes(a.status)) throw fail(409, a.status === 'checked_in' ? 'This student has not been called yet' : a.status === 'reserved' ? 'No check-in is recorded for this appointment' : `Cannot check out (${a.status})`);
  const r = await Appointment.findOneAndUpdate({ _id: a.id, status: { $in: ['called', 'in_service'] } }, { status: 'completed', completedAt: new Date(), completedBy: by._id }, { new: true });
  if (!r) throw fail(409, 'This appointment was already processed');
  await Window.updateOne({ _id: r.window, serving: r._id }, { serving: null }); ping(r); return r;
}
app.post('/api/appointments/:id/checkin', auth('student'), h(async (q, s) => s.json(await checkIn(await mine(q)))));

const IMG = /^\/uploads\/[0-9a-f-]{36}\.(jpg|png|webp)$/;
const sanitizeReqs = r => {
  if (!Array.isArray(r) || r.length > 30) throw fail(400, 'A checklist can have up to 30 items');
  return r.map(x => {
    const o = { name: String(x?.name || '').trim().slice(0, 150), note: String(x?.note || '').trim().slice(0, 500), mandatory: !!x?.mandatory };
    if (x?.image) { if (!IMG.test(x.image)) throw fail(400, 'Invalid image reference'); o.image = x.image; }
    if (!o.name && !o.image) { if (o.note) throw fail(400, 'Each checklist item needs a title or an image'); return null; }
    return o;
  }).filter(Boolean);
};
const intList = (a, lo, hi) => { if (!Array.isArray(a) || a.some(x => !Number.isInteger(x) || x < lo || x > hi)) throw fail(400, 'Invalid schedule values'); return [...new Set(a)].sort((x, y) => x - y); };
const DATE = /^\d{4}-\d{2}-\d{2}$/;
async function flagAffected(w, note) {
  const t = today(), shut = await Closure.find({ window: w.id, date: { $gte: t } });
  for (const a of await Appointment.find({ window: w.id, status: 'reserved', date: { $gte: t } })) {
    const bad = !w.days.includes(dayOf(a.date)) || !w.hours.includes(a.hour) || shut.some(c => c.date === a.date && (c.hour == null || c.hour === a.hour));
    if (bad && !a.rescheduleAllowed) { a.rescheduleAllowed = true; a.rescheduleNote = note; await a.save(); ping(a); }
  }
}
// staff: locked to their own window. admin: any window via X-Window header.
const mg = [auth('staff', 'admin'), h(async (q, s, n) => {
  q.wid = q.user.role === 'staff' ? String(q.user.window || '') : String(q.get('x-window') || '');
  if (!mongoose.isValidObjectId(q.wid) || !(await Window.exists({ _id: q.wid }))) throw fail(400, 'No window selected'); n();
})];
app.get('/api/manage/window', mg, h(async (q, s) => s.json(await Window.findById(q.wid).populate('department', 'name'))));
app.get('/api/manage/queue', mg, h(async (q, s) => {
  const window = await Window.findById(q.wid);
  const list = await Appointment.find({ window: q.wid, date: today(), status: { $in: ['reserved', 'checked_in', 'called', 'in_service', 'missed'] } }).populate('student', 'name studentNumber').sort(order);
  s.json({ window, list });
}));
app.get('/api/manage/records', mg, h(async (q, s) => s.json(await Appointment.find({ window: q.wid, date: DATE.test(q.query.date) ? q.query.date : today() }).populate('student', 'name studentNumber').sort({ hour: 1, createdAt: 1 }))));
const scanFlow = fn => h(async (q, s) => {
  const a = await Appointment.findOne({ qrToken: String(q.body.token || '') });
  if (!a) throw fail(404, 'Invalid QR code'); if (String(a.window) !== q.wid) throw fail(403, 'This appointment belongs to another window');
  const r = await fn(a, q.user); await r.populate('student', 'name studentNumber'); s.json(r);
});
app.post('/api/manage/scan', mg, scanFlow(checkIn));
app.post('/api/manage/scan-out', mg, scanFlow(checkOut));
const FINAL = ['completed', 'missed', 'cancelled', 'expired'];
app.delete('/api/manage/records/:id', mg, h(async (q, s) => {
  if (!mongoose.isValidObjectId(q.params.id)) throw fail(404, 'Not found');
  const r = await Appointment.deleteOne({ _id: q.params.id, window: q.wid, status: { $in: FINAL } });
  if (!r.deletedCount) throw fail(409, 'Only completed, missed, cancelled or expired records can be deleted'); s.json({ ok: true });
}));
const stamp = d => d ? new Date(d).toLocaleString('sv-SE', { timeZone: 'Asia/Manila' }) : '';
const safe = v => typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? "'" + v : v;
const mins = (a, b) => a && b ? Math.round((new Date(b) - new Date(a)) / 6e3) / 10 : '';
app.get('/api/manage/records/export', mg, rateLimit({ windowMs: 6e4, limit: 10 }), h(async (q, s) => {
  const from = String(q.query.from || ''), to = String(q.query.to || from);
  if (!DATE.test(from) || !DATE.test(to) || to < from) throw fail(400, 'Choose a valid date range');
  if ((new Date(to) - new Date(from)) / 864e5 > 366) throw fail(400, 'The date range cannot exceed one year');
  const f = { date: { $gte: from, $lte: to }, checkedInAt: { $ne: null } }; if (!(q.query.scope === 'all' && q.user.role === 'admin')) f.window = q.wid;
  const rows = await Appointment.find(f).sort({ date: 1, checkedInAt: 1 }).limit(50000).populate('student', 'name studentNumber course').lean();
  const wb = new ExcelJS.Workbook(); wb.created = new Date();
  const ws = wb.addWorksheet('Time log', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [['Time in', 12], ['Time out', 12], ['Name', 32], ['Student number', 18], ['Course', 32], ['Purpose', 38], ['Date', 14]].map(([header, width]) => ({ header, width }));
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF14305C' } }; ws.autoFilter = { from: 'A1', to: 'G1' }; ws.getColumn(7).numFmt = 'mmm d, yyyy';
  const clock = d => d ? new Date(d).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', hour12: true }) : '';
  for (const a of rows) ws.addRow([clock(a.checkedInAt), clock(a.completedAt), safe(a.student?.name || a.guestName || ''), safe(a.student?.studentNumber || a.guestStudentNumber || ''), safe(a.student?.course || a.guestCourse || ''), safe(a.serviceName || ''), new Date(a.date + 'T00:00:00Z')]);
  s.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); s.setHeader('Content-Disposition', `attachment; filename="time-log_${from}_${to}.xlsx"`);
  await wb.xlsx.write(s); s.end();
}));
app.post('/api/manage/walkin', mg, h(async (q, s) => {
  const w = await Window.findById(q.wid); if (!w.active) throw fail(400, 'Window is inactive');
  const name = String(q.body.name || '').trim().slice(0, 60); if (!name) throw fail(400, 'Enter the name of the walk-in');
  const sv = mongoose.isValidObjectId(q.body.serviceId) && await Service.findOne({ _id: q.body.serviceId, window: w.id, active: true }); if (!sv) throw fail(400, 'Pick a service');
  const seq = (await Counter.findOneAndUpdate({ _id: `q:${w.id}:${today()}` }, { $inc: { n: 1 } }, { upsert: true, new: true })).n;
  const a = await Appointment.create({ window: w.id, service: sv.id, serviceName: sv.name, reqSnapshot: sv.requirements, date: today(), hour: hourNow(), status: 'checked_in', checkedInAt: new Date(), walkIn: true, guestName: name, guestStudentNumber: String(q.body.studentNumber || '').trim().slice(0, 30), guestCourse: String(q.body.course || '').trim().slice(0, 100), queueCode: `W${w.number}-${String(seq).padStart(3, '0')}` });
  ping(a); s.json(a);
}));
app.post('/api/manage/call-next', mg, h(async (q, s) => {
  const next = await Appointment.findOne({ window: q.wid, date: today(), status: 'checked_in' }).sort(order);
  if (!next) throw fail(404, 'No eligible student in queue');
  if (!(await Window.findOneAndUpdate({ _id: q.wid, serving: null }, { serving: next.id }))) throw fail(409, 'Window is already serving someone');
  const a = await Appointment.findOneAndUpdate({ _id: next.id, status: 'checked_in' }, { status: 'called', calledAt: new Date(), calledBy: q.user._id }, { new: true });
  if (!a) { await Window.updateOne({ _id: q.wid }, { serving: null }); throw fail(409, 'Queue changed, try again'); }
  ping(a); s.json(a);
}));
const move = (from, to, extra = () => ({}), free = false) => h(async (q, s) => {
  if (!mongoose.isValidObjectId(q.params.id)) throw fail(404, 'Not found');
  const a = await Appointment.findOneAndUpdate({ _id: q.params.id, window: q.wid, status: from }, { status: to, ...extra(q) }, { new: true });
  if (!a) throw fail(409, 'Invalid state transition');
  if (free) await Window.updateOne({ _id: a.window, serving: a._id }, { serving: null });
  ping(a); s.json(a);
});
app.post('/api/manage/:id/start', mg, move('called', 'in_service', q => ({ startedAt: new Date(), startedBy: q.user._id })));
app.post('/api/manage/:id/complete', mg, move('in_service', 'completed', q => ({ completedAt: new Date(), completedBy: q.user._id }), true));
app.post('/api/manage/:id/missed', mg, move('called', 'missed', () => ({}), true));
app.post('/api/manage/:id/rejoin', mg, move('missed', 'checked_in', () => ({ checkedInAt: new Date(), $inc: { rejoins: 1 } })));
app.post('/api/manage/appointments/:id/allow-reschedule', mg, h(async (q, s) => {
  if (!mongoose.isValidObjectId(q.params.id)) throw fail(404, 'Not found');
  const allow = q.body.allow !== false;
  const a = await Appointment.findOneAndUpdate({ _id: q.params.id, window: q.wid, status: 'reserved' }, allow ? { rescheduleAllowed: true, rescheduleNote: String(q.body.note || 'Staff opened a reschedule for you').slice(0, 120) } : { rescheduleAllowed: false, $unset: { rescheduleNote: 1 } }, { new: true });
  if (!a) throw fail(409, 'Only reserved appointments can be rescheduled'); ping(a); s.json(a);
}));
app.patch('/api/manage/window', mg, h(async (q, s) => {
  const days = intList(q.body.days, 0, 6), hours = intList(q.body.hours, 5, 21), capacity = Number(q.body.capacity);
  if (!days.length || !hours.length) throw fail(400, 'Pick at least one day and one hour');
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500) throw fail(400, 'Capacity must be 1 to 500');
  const t = today(), peak = Math.max(0, ...(await Counter.find({ _id: new RegExp(`^slot:${q.wid}:`) })).filter(c => { const p = c._id.split(':'); return p[2] >= t && hours.includes(+p[3]); }).map(c => c.n));
  if (capacity < peak) throw fail(400, `Capacity can't go below ${peak} (already booked)`);
  const w = await Window.findByIdAndUpdate(q.wid, { days, hours, capacity }, { new: true });
  await flagAffected(w, 'The schedule changed'); s.json(w);
}));
app.get('/api/manage/closures', mg, h(async (q, s) => s.json(await Closure.find({ window: q.wid, date: { $gte: today() } }).sort('date hour'))));
app.post('/api/manage/closures', mg, h(async (q, s) => {
  const date = String(q.body.date || ''); if (!DATE.test(date) || date < today()) throw fail(400, 'Pick a valid future date');
  const hour = q.body.hour === '' || q.body.hour == null ? null : Number(q.body.hour); if (hour !== null && !Number.isInteger(hour)) throw fail(400, 'Invalid hour');
  const reason = String(q.body.reason || '').trim().slice(0, 120) || 'Closed by staff';
  const c = await Closure.create({ window: q.wid, date, hour, reason }); await flagAffected(await Window.findById(q.wid), reason); s.json(c);
}));
app.delete('/api/manage/closures/:id', mg, h(async (q, s) => { if (!mongoose.isValidObjectId(q.params.id)) throw fail(404, 'Not found'); await Closure.deleteOne({ _id: q.params.id, window: q.wid }); s.json({ ok: true }); }));
app.get('/api/manage/services', mg, h(async (q, s) => s.json(await Service.find({ window: q.wid }).sort('name'))));
app.post('/api/manage/services', mg, h(async (q, s) => {
  if (q.user.role !== 'admin') throw fail(403, 'Admins only'); const name = String(q.body.name || '').trim().slice(0, 120); if (!name) throw fail(400, 'Name required');
  s.json(await Service.create({ name, window: q.wid, requirements: [] }));
}));
app.patch('/api/manage/services/:id', mg, h(async (q, s) => {
  if (!mongoose.isValidObjectId(q.params.id)) throw fail(404, 'Not found');
  const set = { requirements: sanitizeReqs(q.body.requirements) };
  if (q.user.role === 'admin') { if (q.body.name) set.name = String(q.body.name).trim().slice(0, 120); if (typeof q.body.active === 'boolean') set.active = q.body.active; }
  const sv = await Service.findOneAndUpdate({ _id: q.params.id, window: q.wid }, set, { new: true }); if (!sv) throw fail(404, 'Not found'); s.json(sv);
}));

// ---- uploads and checklist ----
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024, files: 1 } });
const sniff = b => b.length < 12 ? null : (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) ? 'jpg' : b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ? 'png' : (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') ? 'webp' : null;
app.post('/api/manage/uploads', mg, rateLimit({ windowMs: 6e4, limit: 30 }), upload.single('image'), h(async (q, s) => {
  if (!q.file) throw fail(400, 'No image received'); const ext = sniff(q.file.buffer); if (!ext) throw fail(400, 'Only JPG, PNG or WebP images are allowed');
  const name = `${crypto.randomUUID()}.${ext}`; await fs.promises.writeFile(path.join(UPLOAD_DIR, name), q.file.buffer, { flag: 'wx' }); s.json({ url: `/uploads/${name}` });
}));
app.post('/api/appointments/:id/checklist', auth('student'), h(async (q, s) => {
  const a = await mine(q), i = q.body.index;
  if (!ACTIVE.includes(a.status) || !Number.isInteger(i) || i < 0 || i >= a.reqSnapshot.length) throw fail(400, 'Invalid checklist item');
  const r = await Appointment.findOneAndUpdate({ _id: a.id }, q.body.prepared ? { $addToSet: { prepared: i } } : { $pull: { prepared: i } }, { new: true }); s.json({ prepared: r.prepared });
}));
app.post('/api/manage/:id/checklist', mg, h(async (q, s) => {
  if (!mongoose.isValidObjectId(q.params.id)) throw fail(404, 'Not found'); const i = q.body.index;
  const a = await Appointment.findOne({ _id: q.params.id, window: q.wid, status: { $in: ['reserved', 'checked_in', 'called', 'in_service'] } });
  if (!a || !Number.isInteger(i) || i < 0 || i >= a.reqSnapshot.length) throw fail(400, 'Invalid checklist item');
  const r = await Appointment.findOneAndUpdate({ _id: a.id }, q.body.verified ? { $addToSet: { verified: i } } : { $pull: { verified: i } }, { new: true }); ping(r); s.json({ verified: r.verified });
}));

// ---- admin ----
const ad = auth('admin');
const str = (v, max, req = true) => { const x = String(v ?? '').trim().slice(0, max); if (req && !x) throw fail(400, 'A required field is empty'); return x; };
const oidv = v => { if (!mongoose.isValidObjectId(v)) throw fail(400, 'Invalid reference'); return v; };
const V = {
  departments: { name: v => str(v, 80), active: v => !!v },
  windows: { number: v => { const n = Number(v); if (!Number.isInteger(n) || n < 1 || n > 999) throw fail(400, 'Window number must be between 1 and 999'); return n; }, label: v => str(v, 80, false), prefix: v => str(v, 2).toUpperCase(), department: oidv, days: v => intList(v, 0, 6), hours: v => intList(v, 5, 21), capacity: v => { const n = Number(v); if (!Number.isInteger(n) || n < 1 || n > 500) throw fail(400, 'Capacity must be 1 to 500'); return n; }, active: v => !!v },
  services: { name: v => str(v, 120), window: oidv, active: v => !!v, requirements: sanitizeReqs },
  courses: { code: v => str(v, 20, false), name: v => str(v, 100), active: v => !!v },
  holidays: { date: v => { if (!DATE.test(String(v))) throw fail(400, 'Invalid date'); return String(v); }, name: v => str(v, 100) },
  users: { name: v => str(v, 80), course: v => str(v, 100, false), email: v => { const e = str(v, 120).toLowerCase(); if (!/^\S+@\S+\.\S+$/.test(e)) throw fail(400, 'Invalid email'); return e; }, role: v => { if (!['student', 'staff', 'admin'].includes(v)) throw fail(400, 'Invalid role'); return v; }, window: v => v ? oidv(v) : null, active: v => !!v, studentNumber: v => str(v, 30, false) },
};
const clean = (p, b) => { const o = {}; for (const [k, f] of Object.entries(V[p])) if (b?.[k] !== undefined) o[k] = f(b[k]); return o; };
const REQ = { departments: ['name'], courses: ['name'], windows: ['number', 'department'], services: ['name', 'window'], holidays: ['date', 'name'] };
const userOut = u => ({ _id: u.id, name: u.name, email: u.email, role: u.role, window: u.window || null, active: u.active !== false, studentNumber: u.studentNumber, course: u.course });
app.get('/api/admin/stats', ad, h(async (q, s) => {
  const [bs, us, windows, departments, services] = await Promise.all([Appointment.aggregate([{ $match: { date: today() } }, { $group: { _id: '$status', n: { $sum: 1 } } }]), User.aggregate([{ $group: { _id: '$role', n: { $sum: 1 } } }]), Window.countDocuments({ active: true }), Department.countDocuments({ active: true }), Service.countDocuments({ active: true })]);
  s.json({ today: Object.fromEntries(bs.map(x => [x._id, x.n])), users: Object.fromEntries(us.map(x => [x._id, x.n])), windows, departments, services });
}));
for (const [p, M, sort] of [['departments', Department, 'name'], ['windows', Window, 'number'], ['services', Service, 'name'], ['holidays', Holiday, 'date'], ['courses', Course, 'name']]) {
  app.get(`/api/admin/${p}`, ad, h(async (q, s) => s.json(await M.find().sort(sort))));
  app.post(`/api/admin/${p}`, ad, h(async (q, s) => {
    let d = clean(p, q.body); for (const k of REQ[p]) if (d[k] === undefined) throw fail(400, `${k} is required`);
    if (p === 'windows') { if (await Window.exists({ number: d.number })) throw fail(409, 'A window with that number already exists'); d = { days: [1, 2, 3, 4, 5], hours: [8, 9, 10, 11, 12, 14, 15, 16], capacity: 30, ...d }; }
    s.json(await M.create(d));
  }));
  app.patch(`/api/admin/${p}/:id`, ad, h(async (q, s) => {
    if (!mongoose.isValidObjectId(q.params.id)) throw fail(404, 'Not found'); const d = clean(p, q.body); if (!Object.keys(d).length) throw fail(400, 'Nothing to update');
    if (p === 'windows' && d.number !== undefined && await Window.exists({ number: d.number, _id: { $ne: q.params.id } })) throw fail(409, 'A window with that number already exists');
    const r = await M.findByIdAndUpdate(q.params.id, d, { new: true }); if (!r) throw fail(404, 'Not found'); s.json(r);
  }));
}
app.delete('/api/admin/holidays/:id', ad, h(async (q, s) => { if (!mongoose.isValidObjectId(q.params.id)) throw fail(404, 'Not found'); await Holiday.deleteOne({ _id: q.params.id }); s.json({ ok: true }); }));
const rx = t => new RegExp(String(t).trim().slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
app.get('/api/admin/users', ad, h(async (q, s) => {
  const f = {}, r = String(q.query.role || 'team'); if (r === 'team') f.role = { $in: ['staff', 'admin'] }; else if (r !== 'all') f.role = r;
  if (String(q.query.q || '').trim()) { const e = rx(q.query.q); f.$or = [{ name: e }, { email: e }, { studentNumber: e }]; }
  const page = Math.max(1, +q.query.page || 1), lim = 25;
  const [rows, total] = await Promise.all([User.find(f).sort('name').skip((page - 1) * lim).limit(lim), User.countDocuments(f)]);
  s.json({ rows: rows.map(userOut), total, page, pages: Math.max(1, Math.ceil(total / lim)) });
}));
app.post('/api/admin/users', ad, h(async (q, s) => {
  const d = clean('users', q.body); for (const k of ['name', 'email', 'role']) if (!d[k]) throw fail(400, `${k} is required`);
  if (d.role === 'staff' && !d.window) throw fail(400, 'Staff must be assigned to a window'); if (d.role !== 'staff') d.window = null;
  s.json(userOut(await User.create(d)));
}));
app.patch('/api/admin/users/:id', ad, h(async (q, s) => {
  if (!mongoose.isValidObjectId(q.params.id)) throw fail(404, 'Not found'); const u = await User.findById(q.params.id); if (!u) throw fail(404, 'Not found');
  const d = clean('users', q.body);
  if (u.id === q.user.id && ((d.role && d.role !== 'admin') || d.active === false)) throw fail(400, 'You cannot change your own role or deactivate your own account');
  Object.assign(u, d); if (u.role === 'staff' && !u.window) throw fail(400, 'Staff must be assigned to a window'); if (u.role !== 'staff') u.window = null;
  if (d.active === false || d.role || d.window !== undefined) u.tokenVersion = (u.tokenVersion || 0) + 1;
  await u.save(); s.json(userOut(u));
}));
app.get('/api/admin/audit', ad, h(async (q, s) => {
  const f = {}; if (String(q.query.q || '').trim()) { const e = rx(q.query.q); f.$or = [{ action: e }, { actorName: e }]; }
  if (q.query.outcome === 'ok') f.status = { $lt: 400 }; if (q.query.outcome === 'error') f.status = { $gte: 400 };
  const page = Math.max(1, +q.query.page || 1), lim = 50;
  const [rows, total] = await Promise.all([AuditLog.find(f).sort('-at').skip((page - 1) * lim).limit(lim).lean(), AuditLog.countDocuments(f)]);
  s.json({ rows, total, page, pages: Math.max(1, Math.ceil(total / lim)) });
}));

io.use((so, n) => { try { so.data.id = jwt.verify(/token=([^;]+)/.exec(so.handshake.headers.cookie || '')[1], JWT_SECRET).id; n(); } catch { n(new Error('auth')); } });
io.on('connection', async so => {
  const u = await User.findById(so.data.id); if (!u) return so.disconnect();
  so.join('user:' + u.id); if (u.role === 'staff' && u.window) so.join('window:' + u.window);
  so.on('watch', id => { if (u.role !== 'admin') return; for (const r of so.rooms) if (r.startsWith('window:')) so.leave(r); so.join('window:' + id); });
});
setInterval(async () => {
  try {
    for (const a of await Appointment.find({ status: 'pending', holdUntil: { $lt: new Date() } })) { const r = await release(a.id, ['pending'], 'expired'); if (r) ping(r); }
    for (const a of await Appointment.find({ status: 'called', calledAt: { $lt: new Date(Date.now() - 3e5) } })) {
      const r = await Appointment.findOneAndUpdate({ _id: a.id, status: 'called' }, { status: 'missed' }, { new: true });
      if (r) { await Window.updateOne({ _id: r.window, serving: r._id }, { serving: null }); ping(r); AuditLog.create({ action: 'SYSTEM call timeout', target: String(r._id), window: r.window, status: 200 }).catch(() => { }); }
    }
  } catch (e) { console.error('sweep', e.message); }
}, 1e4);
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../client/dist');
if (fs.existsSync(dist)) { app.use(express.static(dist, { maxAge: '1h', index: false })); app.get(/^(?!\/(api|uploads|socket\.io|healthz|readyz)).*/, (q, s) => s.sendFile(path.join(dist, 'index.html'))); }
app.use('/api', (q, s) => s.status(404).json({ error: 'Not found' }));
app.use((e, q, s, n) => {
  if (e.code === 'LIMIT_FILE_SIZE') return s.status(413).json({ error: 'The image is too large (maximum 4 MB)' });
  if (e.type === 'entity.parse.failed') return s.status(400).json({ error: 'Invalid request body' });
  console.error(e); s.status(500).json({ error: 'Something went wrong. Please try again.' });
});
await mongoose.connect(MONGO_URI); await Appointment.syncIndexes();
srv.listen(PORT, () => console.log(`API listening on ${PORT} (${PROD ? 'production' : 'development'})`));
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { srv.close(() => mongoose.disconnect().then(() => process.exit(0))); setTimeout(() => process.exit(1), 10000).unref(); });
