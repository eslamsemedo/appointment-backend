import 'dotenv/config';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import mongoose from 'mongoose';
import Tenant from '../src/models/Tenant.js';
import connectDB from '../src/config/db.js';

const run = async () => {
  const rl = readline.createInterface({ input, output });

  let name;
  let email;
  let password;

  try {
    name = (await rl.question('Business name: ')).trim();
    email = (await rl.question('Login email:   ')).trim().toLowerCase();
    password = (await rl.question('Password:      ')).trim();
  } finally {
    rl.close();
  }

  if (!name || !email || !password) {
    console.error('❌ name, email, and password are all required.');
    process.exit(1);
  }

  try {
    await connectDB(); // reads MONGO_URL + MONGO_DB_NAME from env

    const passwordHash = await bcrypt.hash(password, 12);
    const apiKey = nanoid(32);

    const tenant = await Tenant.create({
      name,
      email,
      passwordHash,
      apiKey,
      workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      workingHours: { start: '09:00', end: '18:00' },
      blockedTimes: [],
    });

    console.log('\n✅ Tenant created successfully');
    console.log(`Name:    ${tenant.name}`);
    console.log(`Email:   ${tenant.email}`);
    console.log(`API Key: ${apiKey}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to create tenant:', err.message);
    try {
      await mongoose.disconnect();
    } catch {
      /* ignore */
    }
    process.exit(1);
  }
};

run();
