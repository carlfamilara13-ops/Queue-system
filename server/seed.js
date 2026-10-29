import 'dotenv/config'; import mongoose from 'mongoose';
import { User, Department, Window, Service, Holiday, Appointment, Counter, Otp, Closure } from './models.js';
if (process.env.NODE_ENV === 'production' && !process.argv.includes('--force')) { console.error('Refusing to wipe data in production. Use: npm run create-admin -- email "Name"'); process.exit(1); }
await mongoose.connect(process.env.MONGO_URI);
await Promise.all([User, Department, Window, Service, Holiday, Appointment, Counter, Otp, Closure].map(M => M.deleteMany({})));
const dep = await Department.create({ name: 'Registrar' });
for (const n of [1, 3, 6, 7, 8, 9, 11, 12]) await Window.create({ number: n, department: dep.id, active: false });
const w = await Window.create({ number: 15, label: 'Summary of Grades', department: dep.id, days: [1, 2, 3, 4, 5], hours: [8, 9, 10, 11, 12, 14, 15, 16], capacity: 30 });
const r = [{ name: '[DEMO] Valid school ID', mandatory: true }, { name: '[DEMO] Request form', mandatory: true, note: 'Demo data, replace with real requirements' }];
await Service.create([{ name: 'Processing & Release of Summary of Grades', window: w.id, requirements: r }, { name: '[DEMO] Certificate of Enrollment', window: w.id, requirements: r }, { name: '[DEMO] Transcript of Records', window: w.id, requirements: r }]);
await Holiday.create([{ date: '2026-10-31', name: "All Saints' Day Eve" }, { date: '2026-11-01', name: "All Saints' Day" }]);
await User.create([{ email: process.env.STAFF_EMAIL, name: 'Staff Demo', role: 'staff', window: w.id }, { email: process.env.ADMIN_EMAIL, name: 'Admin Demo', role: 'admin' }]);
console.log('Seeded'); process.exit();
