#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════
// set-network — switch EXPO_PUBLIC_API_BASE_URL between named
// network profiles (home / work / …).
//
// Why: the mobile app talks to a local Hono dev server over the
// LAN, so the Mac's IP changes every time you move between
// networks. Hard-coding it in `.env` means a stale IP after every
// commute and a `Network request failed` from `AuthProvider`.
//
// Profiles live in `.dev-networks.json` at the repo root. The file
// is git-ignored (LAN IPs are user-specific). Each entry maps a
// short name → full base URL.
//
// Usage:
//   node scripts/set-network.mjs home
//   node scripts/set-network.mjs work
//   node scripts/set-network.mjs auto    # use the current Mac LAN IP
//   node scripts/set-network.mjs list    # show all profiles
//   node scripts/set-network.mjs save <name> [url]
//
// `save` without a URL captures the current Mac LAN IP under the
// given name — handy for "I'm on a new network, remember this one".
//
// After switching, restart Metro with `--clear` so the new value
// is re-inlined into the bundle (EXPO_PUBLIC_* are baked at build
// time, not read at runtime).
// ══════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const ENV_PATH = resolve(ROOT, '.env');
const PROFILES_PATH = resolve(ROOT, '.dev-networks.json');
const ENV_KEY = 'EXPO_PUBLIC_API_BASE_URL';
const PORT = 3001;

const DEFAULT_PROFILES = {
  home: 'http://192.168.111.45:3001',
  work: 'http://10.0.1.15:3001',
};

function loadProfiles() {
  if (!existsSync(PROFILES_PATH)) {
    writeFileSync(PROFILES_PATH, JSON.stringify(DEFAULT_PROFILES, null, 2) + '\n', 'utf8');
    return { ...DEFAULT_PROFILES };
  }
  try {
    return JSON.parse(readFileSync(PROFILES_PATH, 'utf8'));
  } catch (err) {
    console.error(`Could not parse ${PROFILES_PATH}:`, err.message);
    process.exit(1);
  }
}

function saveProfiles(profiles) {
  writeFileSync(PROFILES_PATH, JSON.stringify(profiles, null, 2) + '\n', 'utf8');
}

function detectLanIp() {
  for (const iface of ['en0', 'en1', 'en2']) {
    try {
      const ip = execSync(`ipconfig getifaddr ${iface}`, { stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .trim();
      if (ip) return ip;
    } catch {
      // try next interface
    }
  }
  return null;
}

function updateEnv(url) {
  if (!existsSync(ENV_PATH)) {
    console.error(`No .env at ${ENV_PATH} — copy .env.example first.`);
    process.exit(1);
  }
  const original = readFileSync(ENV_PATH, 'utf8');
  const line = `${ENV_KEY}=${url}`;
  const re = new RegExp(`^${ENV_KEY}=.*$`, 'm');
  const next = re.test(original) ? original.replace(re, line) : original.trimEnd() + `\n${line}\n`;
  if (next === original) return false;
  writeFileSync(ENV_PATH, next, 'utf8');
  return true;
}

function isMetroRunning() {
  try {
    execSync('lsof -nP -iTCP:8081 -sTCP:LISTEN', { stdio: ['ignore', 'pipe', 'ignore'] });
    return true;
  } catch {
    return false;
  }
}

function printUsage() {
  console.log(`Usage:
  node scripts/set-network.mjs <profile>      # e.g. home, work
  node scripts/set-network.mjs auto           # use current Mac LAN IP
  node scripts/set-network.mjs list
  node scripts/set-network.mjs save <name> [url]
`);
}

const [, , cmd, arg2, arg3] = process.argv;

if (!cmd || cmd === '--help' || cmd === '-h') {
  printUsage();
  process.exit(cmd ? 0 : 1);
}

const profiles = loadProfiles();

if (cmd === 'list') {
  const max = Math.max(0, ...Object.keys(profiles).map((k) => k.length));
  for (const [name, url] of Object.entries(profiles)) {
    console.log(`  ${name.padEnd(max)}  ${url}`);
  }
  process.exit(0);
}

if (cmd === 'save') {
  const name = arg2;
  if (!name) {
    console.error('save: missing profile name');
    process.exit(1);
  }
  let url = arg3;
  if (!url) {
    const ip = detectLanIp();
    if (!ip) {
      console.error('save: could not detect Mac LAN IP — pass URL explicitly.');
      process.exit(1);
    }
    url = `http://${ip}:${PORT}`;
  }
  profiles[name] = url;
  saveProfiles(profiles);
  console.log(`Saved profile "${name}" → ${url}`);
  process.exit(0);
}

let url;
if (cmd === 'auto') {
  const ip = detectLanIp();
  if (!ip) {
    console.error('auto: no LAN IP found on en0/en1/en2.');
    process.exit(1);
  }
  url = `http://${ip}:${PORT}`;
} else if (profiles[cmd]) {
  url = profiles[cmd];
} else {
  console.error(`Unknown profile "${cmd}". Known: ${Object.keys(profiles).join(', ') || '(none)'}`);
  printUsage();
  process.exit(1);
}

const changed = updateEnv(url);
console.log(`${ENV_KEY}=${url}${changed ? '' : '   (unchanged)'}`);

if (changed && isMetroRunning()) {
  console.log('\nMetro is currently running on :8081 — restart it with `--clear` so the new');
  console.log('IP is re-inlined into the bundle:');
  console.log('  Ctrl+C in the Metro terminal, then: npm start -- --clear');
}
