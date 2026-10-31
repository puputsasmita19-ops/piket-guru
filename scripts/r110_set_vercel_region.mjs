#!/usr/bin/env node
/**
 * R110: opt-in deployment region alignment after verifying the Firestore location.
 * Usage: node scripts/r110_set_vercel_region.mjs --firestore-location asia-southeast2 [--apply]
 * Default is DRY RUN. Never guesses Firestore location from the project ID.
 */
import fs from 'node:fs';
import path from 'node:path';

export const FIRESTORE_TO_VERCEL = Object.freeze({
  'asia-southeast2': 'sin1',  // Jakarta Firestore -> nearest available Vercel: Singapore
  'asia-southeast1': 'sin1',  // Singapore Firestore
  'asia-east1': 'hkg1',      // Taiwan -> Hong Kong
  'asia-northeast1': 'hnd1', // Tokyo
});

export function proposeRegion(location) {
  const key = String(location || '').trim().toLowerCase();
  if (!Object.hasOwn(FIRESTORE_TO_VERCEL, key)) {
    throw new Error('Firestore location is not in the verified mapping. Check Firebase Console and set Vercel region manually if needed.');
  }
  return FIRESTORE_TO_VERCEL[key];
}

export function configureRegion(input, location) {
  const region = proposeRegion(location);
  const original = JSON.parse(input);
  if (!original || typeof original !== 'object' || Array.isArray(original)) throw new Error('Invalid vercel.json configuration');
  if (original.regions != null && !(
    Array.isArray(original.regions) && original.regions.length === 1 && original.regions[0] === region
  )) {
    throw new Error('vercel.json already sets a different region; review it manually before changing.');
  }
  if (original.functions && typeof original.functions === 'object') {
    for (const spec of Object.values(original.functions)) {
      if (spec && typeof spec === 'object' && Object.hasOwn(spec, 'regions')) {
        throw new Error('Function-specific regions already exist; review overrides manually.');
      }
    }
  }
  return { region, output: `${JSON.stringify({ ...original, regions: [region] }, null, 2)}\n` };
}

const directInvocation = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (directInvocation) {
  try {
    const args = process.argv.slice(2);
    const idx = args.indexOf('--firestore-location');
    if (idx < 0 || !args[idx + 1]) throw new Error('Usage: node scripts/r110_set_vercel_region.mjs --firestore-location asia-southeast2 [--apply]');
    const location = args[idx + 1];
    const configFile = path.resolve('vercel.json');
    const { region, output } = configureRegion(fs.readFileSync(configFile, 'utf8'), location);
    console.log(`Firestore (${location}) => Vercel Functions (${region}).`);
    if (args.includes('--apply')) {
      fs.writeFileSync(configFile, output);
      console.log('Updated vercel.json. Review diff and deploy API; compare 3–5 logins.');
    } else {
      console.log('DRY RUN: no changes. Use --apply only after confirming database location in Firebase Console.');
    }
  } catch (err) {
    console.error('R110 region configuration:', err.message);
    process.exitCode = 1;
  }
}
