import 'dotenv/config';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import mongoose from 'mongoose';
import Tenant from '../src/models/Tenant.js';
import connectDB from '../src/config/db.js';
import { encrypt } from '../src/utils/crypto.js';

const run = async () => {
  const rl = readline.createInterface({ input, output });

  let name;
  let email;
  let password;
  let senderEmail;
  let senderAppPassword;

  try {
    name = (await rl.question('Business name:       ')).trim();
    email = (await rl.question('Login email:         ')).trim().toLowerCase();
    password = (await rl.question('Password:            ')).trim();
    console.log('\nOutbound email — the mailbox this tenant sends booking emails from.');
    console.log('(Gmail: use an App Password, not your normal password. Leave blank to skip.)');
    senderEmail = (await rl.question('Sender email:        ')).trim().toLowerCase();
    senderAppPassword = (await rl.question('Sender app password: ')).trim();
  } finally {
    rl.close();
  }

  if (!name || !email || !password) {
    console.error('❌ name, email, and password are all required.');
    process.exit(1);
  }

  if (senderAppPassword && !senderEmail) {
    console.error('❌ A sender app password also needs a sender email.');
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
      // App password is encrypted at rest (decrypted only when sending mail).
      senderEmail: senderEmail || undefined,
      senderName: senderEmail ? name : undefined,
      senderAppPassword: senderAppPassword ? encrypt(senderAppPassword) : undefined,
      workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      workingHours: { start: '09:00', end: '18:00' },
      blockedTimes: [],
    });

    console.log('\n✅ Tenant created successfully');
    console.log(`Name:    ${tenant.name}`);
    console.log(`Email:   ${tenant.email}`);
    console.log(`Sender:  ${tenant.senderEmail || '(none — emails disabled until configured)'}`);
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
