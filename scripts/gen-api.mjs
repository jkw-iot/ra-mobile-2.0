#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════
// gen-api — generates src/services/api/schema.ts from the Hono
// server's OpenAPI spec (Scalar + Zod).
//
// Handles a known issue where some endpoints in the web repo's
// OpenAPI spec contain unresolved `$ref`s (circular references in
// Zod schemas). Those endpoints are stripped before generation and
// logged to the console. The real fix belongs in the web repo's
// server/api-spec/*.js — when resolved, the filtering is a no-op.
//
// Usage:
//   node scripts/gen-api.mjs [source-url]
//
// Default source: $API_SPEC_URL or http://localhost:3001/api/docs/openapi.json
// ══════════════════════════════════════════════════════════════
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SOURCE =
  process.argv[2] ||
  process.env.API_SPEC_URL ||
  'http://localhost:3001/api/docs/openapi.json';

const OUTPUT = 'src/services/api/schema.ts';

async function fetchSpec(url) {
  if (url.startsWith('http')) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch spec: ${res.status} ${res.statusText}`);
    return res.json();
  }
  // Treat as file path
  const fs = await import('node:fs/promises');
  return JSON.parse(await fs.readFile(url, 'utf8'));
}

function stripBrokenRefs(spec) {
  const removed = [];
  for (const path of Object.keys(spec.paths ?? {})) {
    for (const method of Object.keys(spec.paths[path])) {
      const txt = JSON.stringify(spec.paths[path][method]);
      // Detect $ref that openapi-typescript can't resolve (circular
      // Zod schemas that never landed in components.schemas).
      if (txt.includes('"$ref"')) {
        removed.push(`${method.toUpperCase()} ${path}`);
        delete spec.paths[path][method];
      }
    }
    if (Object.keys(spec.paths[path]).length === 0) {
      delete spec.paths[path];
    }
  }
  return removed;
}

function runOpenapiTypescript(inputFile, outputFile) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'npx',
      ['--yes', 'openapi-typescript', inputFile, '-o', outputFile],
      { stdio: 'inherit' },
    );
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`openapi-typescript exited with code ${code}`));
    });
  });
}

async function main() {
  console.log(`▶ Fetching OpenAPI spec from: ${SOURCE}`);
  const spec = await fetchSpec(SOURCE);

  const removed = stripBrokenRefs(spec);
  if (removed.length > 0) {
    console.warn(
      `⚠ Removed ${removed.length} endpoint(s) with unresolved $ref (circular Zod schemas):`,
    );
    for (const ep of removed) console.warn(`  - ${ep}`);
    console.warn(
      '  Fix these in the web repo (server/api-spec/*.js) so they resolve in the OpenAPI output.',
    );
  }

  const tmpFile = join(tmpdir(), `roomalyzer-openapi-${Date.now()}.json`);
  writeFileSync(tmpFile, JSON.stringify(spec));

  console.log(`▶ Generating types → ${OUTPUT}`);
  await runOpenapiTypescript(tmpFile, OUTPUT);
  console.log('✓ Done.');
}

main().catch((err) => {
  console.error('✗ gen-api failed:', err.message);
  process.exit(1);
});
