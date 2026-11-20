// Build step (run by Vercel on every push):
//   1. finds every .csv in decks/ (subfolders become groups)
//   2. turns them into dist/decks.json
//   3. copies the site files from src/ into dist/
import { readdir, readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCSV, rowsToCards } from '../src/csv.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DECKS_DIR = path.join(root, 'decks');
const SRC_DIR = path.join(root, 'src');
const OUT_DIR = path.join(root, 'dist');

async function listCsvFiles(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  const files = [];
  for (const e of entries) {
    // Files/folders starting with "." or "_" are ignored (handy for drafts).
    if (e.name.startsWith('.') || e.name.startsWith('_')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...(await listCsvFiles(full)));
    else if (e.isFile() && e.name.toLowerCase().endsWith('.csv')) files.push(full);
  }
  return files;
}

// "01-spanish_verbs" -> "Spanish Verbs" (a leading number is only used for ordering)
function prettify(name) {
  const pretty = name
    .replace(/^\d+[\s._-]+/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(^|\s)(\p{Ll})/gu, (_, s, c) => s + c.toUpperCase());
  return pretty || name;
}

function slugify(rel) {
  return rel
    .replace(/\.csv$/i, '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split('/')
    .map((part) => part.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'deck')
    .join('/');
}

// Short stable id per card so study progress survives reordering the CSV.
function hashId(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

async function build() {
  const files = await listCsvFiles(DECKS_DIR);
  const rels = files
    .map((f) => path.relative(DECKS_DIR, f).split(path.sep).join('/'))
    .sort((a, b) => {
      const da = a.includes('/') ? 1 : 0;
      const db = b.includes('/') ? 1 : 0;
      return da - db || a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });

  const decks = [];
  const usedSlugs = new Set();
  let problems = 0;

  for (const rel of rels) {
    const text = await readFile(path.join(DECKS_DIR, rel), 'utf8');
    const { cards, warnings } = rowsToCards(parseCSV(text));

    const parts = rel.split('/');
    const fileName = parts.pop().replace(/\.csv$/i, '');
    const group = parts.map(prettify).join(' / ');

    let slug = slugify(rel);
    for (let n = 2; usedSlugs.has(slug); n++) slug = `${slugify(rel)}-${n}`;
    usedSlugs.add(slug);

    const seen = new Map();
    for (const card of cards) {
      const base = hashId(`${card.front}␟${card.back}`);
      const count = (seen.get(base) || 0) + 1;
      seen.set(base, count);
      card.id = count === 1 ? base : `${base}~${count}`;
    }

    decks.push({ slug, name: prettify(fileName), group, file: `decks/${rel}`, cards });

    console.log(`  ${cards.length ? '✓' : '!'} decks/${rel}: ${cards.length} card${cards.length === 1 ? '' : 's'}`);
    for (const w of warnings) console.log(`      warning: ${w}`);
    if (!cards.length) console.log('      warning: no cards found, check the file has two columns (front,back)');
    problems += warnings.length + (cards.length ? 0 : 1);
  }

  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });
  await cp(SRC_DIR, OUT_DIR, { recursive: true });
  await writeFile(
    path.join(OUT_DIR, 'decks.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), decks })
  );

  console.log(`\nBuilt ${decks.length} deck${decks.length === 1 ? '' : 's'} into dist/` +
    (problems ? ` (${problems} warning${problems === 1 ? '' : 's'}, see above)` : ''));
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
