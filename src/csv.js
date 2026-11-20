// CSV parsing used by the build script (scripts/build.mjs).
// Handles quoted fields, escaped quotes (""), newlines inside quotes,
// Excel's UTF-8 BOM, and comma / semicolon / tab delimiters.

export function parseCSV(input) {
  let text = input.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const delim = detectDelimiter(text);
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let line = 1;
  let rowLine = 1;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        if (c === '\n') line++;
        field += c;
      }
      continue;
    }
    if (c === '"' && field.trim() === '') { inQuotes = true; field = ''; }
    else if (c === delim) { row.push(field); field = ''; }
    else if (c === '\n') {
      row.push(field);
      row.line = rowLine;
      rows.push(row);
      row = []; field = '';
      line++;
      rowLine = line;
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    row.line = rowLine;
    rows.push(row);
  }
  return rows;
}

function detectDelimiter(text) {
  const firstLine = text.split('\n', 1)[0];
  const counts = { ',': 0, ';': 0, '\t': 0 };
  let inQuotes = false;
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch in counts) counts[ch]++;
  }
  let best = ',';
  let max = 0;
  for (const [d, n] of Object.entries(counts)) if (n > max) { best = d; max = n; }
  return best;
}

const FRONT_HEADERS = new Set(['front', 'question', 'term', 'word', 'prompt', 'q']);
const BACK_HEADERS = new Set(['back', 'answer', 'definition', 'meaning', 'translation', 'a']);

// Turns parsed rows into cards: column 1 = front, column 2 = back, column 3 = optional hint.
export function rowsToCards(rows) {
  const cards = [];
  const warnings = [];
  let sawFirstRow = false;

  for (const row of rows) {
    const cells = row.map((c) => c.trim());
    if (cells.every((c) => c === '')) continue;

    if (!sawFirstRow) {
      sawFirstRow = true;
      const a = (cells[0] || '').toLowerCase();
      const b = (cells[1] || '').toLowerCase();
      if (FRONT_HEADERS.has(a) && BACK_HEADERS.has(b)) continue; // header row
    }

    const [front = '', back = '', hint = ''] = cells;
    if (!front || !back) {
      warnings.push(`line ${row.line}: needs both a front and a back, skipped`);
      continue;
    }
    cards.push(hint ? { front, back, hint } : { front, back });
  }
  return { cards, warnings };
}
