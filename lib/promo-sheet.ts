// Lê a planilha de promoção (.xlsx ou .csv).
// Colunas aceitas (o nome pode variar um pouco): EAN · Nome do produto · Preço de · Preço por · Validade
import ExcelJS from 'exceljs';
import { parsePrice } from './products';

export interface SheetRow {
  line: number;
  ean: string;
  name: string;
  priceFrom: number | null;
  priceTo: number | null;
  validUntil: string | null; // AAAA-MM-DD
  error?: string;
}

type Field = 'ean' | 'name' | 'priceFrom' | 'priceTo' | 'validUntil';
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
const COLS: Record<Field, string[]> = {
  ean: ['ean', 'gtin', 'codigodebarras', 'codbarras', 'codigo'],
  name: ['nome', 'nomedoproduto', 'produto', 'descricao'],
  priceFrom: ['precode', 'de', 'precoantigo', 'precoatual', 'precoregular'],
  priceTo: ['precopor', 'por', 'precopromocional', 'promocao', 'precopromo', 'preco'],
  validUntil: ['validade', 'validoate', 'ate', 'fim', 'datafim'],
};

export async function parseSheet(buf: ArrayBuffer, fileName = ''): Promise<SheetRow[]> {
  const table = /\.csv$/i.test(fileName) ? readCsv(buf) : await readXlsx(buf);
  if (table.length < 2) return [];

  // Descobre qual coluna é qual pelo cabeçalho
  const header = table[0].map((h) => norm(String(h ?? '')));
  const idx = (f: Field) => header.findIndex((h) => COLS[f].includes(h));
  const col = { ean: idx('ean'), name: idx('name'), priceFrom: idx('priceFrom'), priceTo: idx('priceTo'), validUntil: idx('validUntil') };
  const cell = (r: unknown[], i: number) => (i >= 0 ? r[i] : null);

  return table.slice(1, 201).map((r, i) => {
    const row: SheetRow = {
      line: i + 2,
      ean: String(cell(r, col.ean) ?? '').replace(/\D/g, ''),
      name: String(cell(r, col.name) ?? '').trim(),
      priceFrom: parsePrice(cell(r, col.priceFrom)),
      priceTo: parsePrice(cell(r, col.priceTo)),
      validUntil: toDate(cell(r, col.validUntil)),
    };
    if (!row.ean && !row.name) row.error = 'vazia';
    else if (!row.priceTo) row.error = 'Falta o preço da promoção ("por").';
    else if (row.priceFrom && row.priceFrom <= row.priceTo) row.error = 'O preço "de" precisa ser maior que o "por".';
    return row;
  }).filter((r) => r.error !== 'vazia');
}

async function readXlsx(buf: ArrayBuffer): Promise<unknown[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const out: unknown[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const vals: unknown[] = [];
    row.eachCell({ includeEmpty: true }, (c, n) => {
      const v = c.value as any;
      vals[n - 1] = v && typeof v === 'object' && !(v instanceof Date) ? (v.result ?? v.text ?? v.richText?.map((t: any) => t.text).join('') ?? '') : v;
    });
    out.push(vals);
  });
  return out;
}

/** CSV simples com ";" ou ",", aspas e BOM do Excel. */
function readCsv(buf: ArrayBuffer): string[][] {
  const text = new TextDecoder('utf-8').decode(buf).replace(/^﻿/, '');
  const first = text.split(/\r?\n/)[0] ?? '';
  const sep = (first.match(/;/g)?.length ?? 0) >= (first.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [], cur = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
    } else cur += ch;
  }
  row.push(cur);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

function toDate(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = String(v ?? '').trim();
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (br) {
    const y = br[3].length === 2 ? `20${br[3]}` : br[3];
    return `${y}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}
