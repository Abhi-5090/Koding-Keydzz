import mongoose from 'mongoose';
import dns from 'node:dns';
import { env } from './env.js';

// Reliable public resolvers that correctly answer SRV/TXT records. Home-router
// DNS (and some ISP/captive-portal DNS) often refuse SRV lookups, which breaks
// `mongodb+srv://` with "querySrv ECONNREFUSED". We fall back to these on a DNS
// error so an Atlas connection survives a flaky local resolver.
const PUBLIC_DNS = ['1.1.1.1', '8.8.8.8', '1.0.0.1', '8.8.4.4'];
const MAX_ATTEMPTS = Number(process.env.MONGO_MAX_RETRIES || 5);

const isSrvUri = (uri) => /^mongodb\+srv:\/\//i.test(uri || '');
const isDnsError = (err) => {
  const blob = `${err?.code || ''} ${err?.syscall || ''} ${err?.message || ''}`.toLowerCase();
  return /querysrv|querytxt|econnrefused|enotfound|eai_again|etimeout|servfail|getaddrinfo|\bdns\b/.test(
    blob
  );
};

let dnsFallbackApplied = false;
function applyPublicDns() {
  if (dnsFallbackApplied || process.env.MONGO_DNS_FALLBACK === 'off') return;
  try {
    const current = dns.getServers();
    // Try the reliable resolvers first, keep the system ones as backups.
    dns.setServers([...PUBLIC_DNS, ...current.filter((s) => !PUBLIC_DNS.includes(s))]);
    dnsFallbackApplied = true;
    console.warn('[db] DNS/SRV lookup failed — switching to public DNS (1.1.1.1 / 8.8.8.8) and retrying…');
  } catch (e) {
    console.warn('[db] could not override DNS servers:', e.message);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function connectDB() {
  mongoose.set('strictQuery', true);
  let lastErr;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const conn = await mongoose.connect(env.MONGO_URI, {
        serverSelectionTimeoutMS: 8000,
      });
      console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
      return conn;
    } catch (err) {
      lastErr = err;
      console.error(`MongoDB connection attempt ${attempt}/${MAX_ATTEMPTS} failed: ${err.message}`);

      // A DNS/SRV failure on an Atlas URI is almost always the local resolver
      // refusing SRV — switch to public DNS and retry immediately.
      if (isSrvUri(env.MONGO_URI) && isDnsError(err)) applyPublicDns();

      if (attempt < MAX_ATTEMPTS) await sleep(Math.min(1000 * attempt, 5000));
    }
  }

  console.error(
    '[db] Could not reach MongoDB after retries.\n' +
      '     • If Atlas keeps failing on this network, set MONGO_URI to your local DB in .env:\n' +
      '         MONGO_URI=mongodb://127.0.0.1:27017/koding_keydzz\n' +
      '     • Or force public DNS by leaving MONGO_DNS_FALLBACK unset (default on).'
  );
  throw lastErr;
}

export async function disconnectDB() {
  await mongoose.disconnect();
}

export default connectDB;
