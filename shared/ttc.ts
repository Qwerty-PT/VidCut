// Fontes em coleção (.ttc / .otc): separa uma das variantes num ficheiro de fonte normal.
// O browser só usa a 1.ª variante de uma coleção — sem isto, escolher "Avenir Heavy" daria "Avenir Book".

const tag = (v: DataView, o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));

export const isCollection = (b: Uint8Array): boolean => b.length > 12 && tag(new DataView(b.buffer, b.byteOffset, b.byteLength), 0) === 'ttcf';

interface Table { tag: string; checksum: number; offset: number; length: number }

function tablesAt(v: DataView, off: number): { version: number; tables: Table[] } {
  const version = v.getUint32(off);
  const n = v.getUint16(off + 4);
  const tables: Table[] = [];
  for (let i = 0; i < n; i++) {
    const r = off + 12 + i * 16;
    tables.push({ tag: tag(v, r), checksum: v.getUint32(r + 4), offset: v.getUint32(r + 8), length: v.getUint32(r + 12) });
  }
  return { version, tables };
}

/** Nomes da variante (tabela "name"): id 6 = PostScript, id 4 = nome completo */
function faceNames(v: DataView, tables: Table[]): string[] {
  const t = tables.find((x) => x.tag === 'name');
  if (!t) return [];
  const count = v.getUint16(t.offset + 2);
  const strOff = t.offset + v.getUint16(t.offset + 4);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const r = t.offset + 6 + i * 12;
    const platform = v.getUint16(r), nameId = v.getUint16(r + 6), len = v.getUint16(r + 8), o = strOff + v.getUint16(r + 10);
    if (nameId !== 6 && nameId !== 4) continue;
    let s = '';
    if (platform === 0 || platform === 3) { for (let k = 0; k + 1 < len; k += 2) s += String.fromCharCode(v.getUint16(o + k)); }
    else { for (let k = 0; k < len; k++) s += String.fromCharCode(v.getUint8(o + k)); }
    if (s) out.push(s);
  }
  return out;
}

/** Quantas variantes tem a coleção e os nomes de cada uma */
export function collectionFaces(b: Uint8Array): string[][] {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const num = v.getUint32(8);
  const faces: string[][] = [];
  for (let i = 0; i < num; i++) faces.push(faceNames(v, tablesAt(v, v.getUint32(12 + i * 4)).tables));
  return faces;
}

/**
 * Extrai a variante com este nome (PostScript ou completo) como fonte simples (.ttf/.otf).
 * Se não encontrar o nome, extrai a primeira.
 */
export function extractFace(b: Uint8Array, name?: string): Uint8Array {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const num = v.getUint32(8);
  let pick = 0;
  if (name) {
    for (let i = 0; i < num; i++) {
      if (faceNames(v, tablesAt(v, v.getUint32(12 + i * 4)).tables).includes(name)) { pick = i; break; }
    }
  }
  const { version, tables } = tablesAt(v, v.getUint32(12 + pick * 4));
  const n = tables.length;
  const headerLen = 12 + n * 16;
  const pad = (x: number) => (x + 3) & ~3;
  const total = headerLen + tables.reduce((s, t) => s + pad(t.length), 0);
  const out = new Uint8Array(total);
  const w = new DataView(out.buffer);
  // cabeçalho SFNT
  let es = 0; while ((1 << (es + 1)) <= n) es++;
  w.setUint32(0, version);
  w.setUint16(4, n);
  w.setUint16(6, (1 << es) * 16);
  w.setUint16(8, es);
  w.setUint16(10, n * 16 - (1 << es) * 16);
  // tabelas (por ordem de etiqueta, como manda a especificação) com dados alinhados a 4 bytes
  const sorted = [...tables].sort((a, z) => (a.tag < z.tag ? -1 : a.tag > z.tag ? 1 : 0));
  let pos = headerLen;
  sorted.forEach((t, i) => {
    const r = 12 + i * 16;
    for (let k = 0; k < 4; k++) w.setUint8(r + k, t.tag.charCodeAt(k));
    w.setUint32(r + 4, t.checksum);
    w.setUint32(r + 8, pos);
    w.setUint32(r + 12, t.length);
    out.set(b.subarray(t.offset, t.offset + t.length), pos);
    pos += pad(t.length);
  });
  return out;
}

/** Formato de uma fonte pelos primeiros bytes */
export function sniffFormat(b: Uint8Array): 'woff2' | 'woff' | 'opentype' | 'truetype' | 'collection' {
  const s = String.fromCharCode(b[0], b[1], b[2], b[3]);
  if (s === 'wOF2') return 'woff2';
  if (s === 'wOFF') return 'woff';
  if (s === 'OTTO') return 'opentype';
  if (s === 'ttcf') return 'collection';
  return 'truetype';
}
