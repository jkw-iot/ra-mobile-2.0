#!/usr/bin/env node
// Blocks commits that contain known secret patterns in tracked files.
// Run automatically via the husky pre-commit hook, or manually:
//   node scripts/check-no-secrets.mjs
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PATTERNS = [
  { name: 'Google API key', re: /AIza[0-9A-Za-z_-]{35}/ },
  { name: 'AWS access key', re: /AKIA[0-9A-Z]{16}/ },
  { name: 'Private key block', re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
];

const ALLOWLIST = new Set(['scripts/check-no-secrets.mjs', '.env.example']);

function stagedFiles() {
  try {
    return execSync('git diff --cached --name-only --diff-filter=ACM', {
      encoding: 'utf8',
    })
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

const files = stagedFiles();
let failed = false;

for (const file of files) {
  if (ALLOWLIST.has(file)) continue;
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  for (const { name, re } of PATTERNS) {
    if (re.test(content)) {
      console.error(`\n✖ Secret detected (${name}) in ${file}`);
      console.error('  Remove the value and use .env (local) or EAS env (CI builds).\n');
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
}
