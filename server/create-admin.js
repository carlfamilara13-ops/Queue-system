import 'dotenv/config'; import mongoose from 'mongoose'; import { User } from './models.js';
const [email, ...n] = process.argv.slice(2);
if (!email) { console.error('Usage: npm run create-admin -- email@example.com "Full Name"'); process.exit(1); }
await mongoose.connect(process.env.MONGO_URI);
await User.updateOne({ email: email.toLowerCase() }, { $set: { role: 'admin', active: true, name: n.join(' ') || 'Administrator' }, $unset: { window: 1 } }, { upsert: true });
console.log('Admin ready:', email.toLowerCase()); process.exit();
