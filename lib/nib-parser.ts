export type KbliExtraction = { code: string; title: string; confidence: number };
export type NibExtraction = { nibNumber: string; kbli: KbliExtraction[] };

const KBLI_TITLES: Record<string, string> = {
  '46100': 'Perdagangan Besar Atas Dasar Balas Jasa (Fee) atau Kontrak',
  '58200': 'Penerbitan Piranti Lunak (Software)',
  '62012': 'Aktivitas Pengembangan Aplikasi Perdagangan Melalui Internet (E-Commerce)',
  '62013': 'Aktivitas Pemrograman dan Produksi Konten Media Imersif',
  '62015': 'Aktivitas Pemrograman Berbasis Kecerdasan Artifisial',
  '62019': 'Aktivitas Pemrograman Komputer Lainnya',
  '62021': 'Aktivitas Konsultasi Keamanan Informasi',
  '62022': 'Aktivitas Penyediaan Identitas Digital',
  '62024': 'Aktivitas Konsultasi dan Perancangan Internet of Things (IoT)',
  '62029': 'Aktivitas Konsultasi Komputer dan Manajemen Fasilitas Komputer Lainnya',
  '62090': 'Aktivitas Teknologi Informasi dan Jasa Komputer Lainnya',
  '63111': 'Aktivitas Pengolahan Data',
  '70202': 'Aktivitas Konsultansi Transportasi',
  '70209': 'Aktivitas Konsultasi Manajemen Lainnya',
  '73100': 'Periklanan',
  '73201': 'Penelitian Pasar',
  '85492': 'Jasa Pendidikan Komputer (Teknologi Informasi dan Komunikasi) Swasta',
  '85500': 'Kegiatan Penunjang Pendidikan',
};

function digitsFromOcr(value: string) {
  return value.toUpperCase().replace(/[OQ]/g, '0').replace(/[IL|]/g, '1').replace(/S/g, '5').replace(/[^0-9]/g, '');
}

function extractNibNumber(text: string) {
  const label = /(?:NOMOR\s+INDUK\s+BERUSAHA|\bNIB\b)\s*[:.\-]?\s*([0-9OQIL|S\s.-]{13,32})/gi;
  for (const match of text.replace(/\r/g, ' ').matchAll(label)) {
    const candidate = digitsFromOcr(match[1]).match(/\d{13}/)?.[0];
    if (candidate) return candidate;
  }
  return '';
}

function inferredTitle(text: string, code: string) {
  if (KBLI_TITLES[code]) return KBLI_TITLES[code];
  const lines = text.split(/\r?\n/);
  const lineIndex = lines.findIndex((value) => value.includes(code));
  const line = lines[lineIndex];
  if (!line) return `KBLI ${code} (hasil OCR)`;
  const tail = line.slice(line.indexOf(code) + code.length).replace(/^\s*[-:|]?\s*/, '').split(/\b(?:Lokasi\s+Usaha|Tingkat\s+Risiko|Perizinan\s+Berusaha|Kode\s+Pos)\b/i)[0].replace(/\s+/g, ' ').trim();
  if (tail.length >= 5) return tail.slice(0, 300);
  const continuation: string[] = [];
  for (const value of lines.slice(lineIndex + 1, lineIndex + 9)) {
    const cleaned = value.replace(/\s+/g, ' ').trim();
    if (!cleaned) continue;
    if (/^(?:SAMOfis|Lokasi|Kode\s+Pos|Nomor\s+Kegiatan|Kewenangan|NIB|Terbit|Izin|Rendah|Menengah|Tinggi|\d{1,2}\s+[0-9OQIL|S]{5}\b)/i.test(cleaned)) break;
    continuation.push(cleaned);
  }
  const joined = continuation.join(' ').trim();
  return joined.length >= 5 ? joined.slice(0, 300) : `KBLI ${code} (hasil OCR)`;
}

export function parseNibText(text: string): NibExtraction {
  const normalized = text.normalize('NFKC');
  const nibNumber = extractNibNumber(normalized);
  const hasKbliContext = /K[O0]DE\s+KB[L1I]|\bKB[L1I]\b/i.test(normalized);
  const tableStart = normalized.search(/K[O0]DE\s+KB[L1I]|JUDUL\s+KB[L1I]/i);
  const found = new Map<string, KbliExtraction>();
  if (hasKbliContext) {
    const tokenPattern = /(?<![0-9A-Z])([0-9OQIL|S]{5})(?![0-9A-Z])/gi;
    for (const match of normalized.matchAll(tokenPattern)) {
      const code = digitsFromOcr(match[1]);
      if (!/^\d{5}$/.test(code) || nibNumber.includes(code)) continue;
      const start = match.index ?? 0;
      const lineStart = normalized.lastIndexOf('\n', start) + 1;
      const lineEndCandidate = normalized.indexOf('\n', start);
      const lineEnd = lineEndCandidate === -1 ? normalized.length : lineEndCandidate;
      const line = normalized.slice(lineStart, lineEnd);
      const before = normalized.slice(Math.max(lineStart, start - 48), start);
      if (/K[O0]DE\s+P[O0]S\s*[:.\-]?\s*$/i.test(before) || /N[O0]M[O0]R\s+KEGIATAN\s+USAHA/i.test(line)) continue;
      const nearby = normalized.slice(Math.max(0, start - 220), Math.min(normalized.length, start + 220));
      const insideKbliTable = tableStart >= 0 && start >= tableStart;
      if (!insideKbliTable && !/KB[L1I]/i.test(nearby) && !KBLI_TITLES[code]) continue;
      found.set(code, { code, title: inferredTitle(normalized, code), confidence: KBLI_TITLES[code] ? 99 : 85 });
    }
  }
  return { nibNumber, kbli: [...found.values()].slice(0, 50) };
}
