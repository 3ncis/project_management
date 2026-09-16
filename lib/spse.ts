export type SpseOpportunity = {
  source: string;
  sourceUrl: string;
  procurementType: 'Tender' | 'Pengadaan Langsung';
  tenderCode: string;
  title: string;
  lpse: string;
  workUnit: string;
  region: string;
  category: string;
  hpsValue: number;
  hpsDisplay: string;
  scheduleStatus: string;
  startAt: string;
  endAt: string;
  projectLocation: string;
  matchedKbli: string[];
};

const MONTHS: Record<string, number> = { januari:0, februari:1, maret:2, april:3, mei:4, juni:5, juli:6, agustus:7, september:8, oktober:9, november:10, desember:11 };
const USER_AGENT = 'Mozilla/5.0 (compatible; PadmaShriTenderMonitor/1.0; +https://padmashri.tech)';

export function normalizeSpseSource(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== 'https:' || url.hostname !== 'spse.inaproc.id' || url.username || url.password) return null;
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length < 1 || parts.length > 2 || (parts[1] && !['lelang','nontender'].includes(parts[1]))) return null;
  if (!/^[a-z0-9-]+$/i.test(parts[0])) return null;
  return `https://spse.inaproc.id/${parts[0].toLowerCase()}`;
}

function decodeHtml(value: string) {
  return value.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/\s+/g,' ').trim();
}

export function parseIndonesianDate(value: string) {
  const match = value.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s+(\d{1,2}):(\d{2})/i);
  if (!match) return null;
  const month = MONTHS[match[2].toLowerCase()];
  if (month === undefined) return null;
  return new Date(Date.UTC(Number(match[3]), month, Number(match[1]), Number(match[4]) - 7, Number(match[5])));
}

function tableRows(html: string) {
  return [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) => decodeHtml(match[1])).filter(Boolean);
}

function field(rows: string[], label: string) {
  const row = rows.find((value) => value.toLowerCase().startsWith(label.toLowerCase()));
  return row ? row.slice(label.length).trim() : '';
}

function rupiahValue(value: string) {
  const amount = value.match(/Rp\.?\s*([\d.]+(?:,\d+)?)/i)?.[1] ?? '';
  return Number(amount.replaceAll('.','').replace(',','.').split('.')[0]) || 0;
}

export function parseSpseDetail(html: string) {
  const rows = tableRows(html);
  const allText = decodeHtml(html);
  const hpsRow = rows.find((value) => /Nilai HPS Paket/i.test(value)) ?? '';
  const hpsDisplay = hpsRow.match(/Nilai HPS Paket\s*(Rp\.?\s*[\d.,]+)/i)?.[1] ?? 'Rp. 0';
  return {
    title: field(rows,'Nama Tender') || field(rows,'Nama Paket'),
    lpse: field(rows,'K/L/PD/Instansi Lainnya'),
    workUnit: field(rows,'Satuan Kerja'),
    category: field(rows,'Jenis Pengadaan'),
    projectLocation: field(rows,'Lokasi Pekerjaan'),
    hpsDisplay,
    hpsValue: rupiahValue(hpsDisplay),
    kbli: [...new Set([...allText.matchAll(/\bKBLI\s*[:.-]?\s*(\d{5})\b/gi)].map((match) => match[1]))],
  };
}

export function parseSpseSchedule(html: string) {
  const rows = tableRows(html);
  const dates = rows.flatMap((row) => [...row.matchAll(/\d{1,2}\s+[A-Za-z]+\s+\d{4}\s+\d{1,2}:\d{2}/g)].map((match) => parseIndonesianDate(match[0])).filter((value): value is Date => Boolean(value)));
  if (!dates.length) return null;
  return { startAt: new Date(Math.min(...dates.map((value) => value.getTime()))), endAt: new Date(Math.max(...dates.map((value) => value.getTime()))) };
}

function cookies(response: Response) {
  const values = 'getSetCookie' in response.headers ? (response.headers as Headers & { getSetCookie(): string[] }).getSetCookie() : [];
  if (values.length) return values.map((value) => value.split(';',1)[0]).filter(Boolean).join('; ');
  const raw = response.headers.get('set-cookie') ?? '';
  return [...raw.matchAll(/(?:^|,)\s*([^=;,\s]+)=([^;,]*)/g)].map((match) => `${match[1]}=${match[2]}`).join('; ');
}

async function mapConcurrent<T,R>(items: T[], concurrency: number, task: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({length:Math.min(concurrency,items.length)},async()=>{
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]);
    }
  }));
  return results;
}

async function scanRoute(baseUrl: string, route: 'lelang'|'nontender', userKbli: Set<string>, now: Date) {
  const year = new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Jakarta',year:'numeric'}).format(now);
  const pageUrl = `${baseUrl}/${route}?tahun=${year}`;
  const page = await fetch(pageUrl,{headers:{accept:'text/html','user-agent':USER_AGENT}});
  if (!page.ok) throw new Error(`Sumber SPSE tidak dapat dibuka (${page.status}).`);
  const pageHtml = await page.text();
  const token = pageHtml.match(/authenticityToken\s*=\s*'([^']+)'/)?.[1];
  const endpoint = pageHtml.match(/url\s*:\s*"([^"]+\/dt\/(?:lelang|pl)\?tahun=\d+)"/)?.[1];
  if (!token || !endpoint) throw new Error('Format sumber SPSE belum dikenali.');
  const params = new URLSearchParams({draw:'1',start:'0',length:'100','search[value]':'','search[regex]':'false',authenticityToken:token});
  const cookie = cookies(page);
  const listing = await fetch(new URL(endpoint,baseUrl),{method:'POST',headers:{accept:'application/json','content-type':'application/x-www-form-urlencoded; charset=UTF-8','x-requested-with':'XMLHttpRequest','user-agent':USER_AGENT,referer:pageUrl,...(cookie?{cookie}:{})},body:params});
  if (!listing.ok) throw new Error(`Daftar paket SPSE gagal dibaca (${listing.status}).`);
  const payload = await listing.json() as { data?: unknown[][] };
  const rows = (payload.data ?? []).filter((row) => !/(sudah selesai|batal|tidak ada jadwal)/i.test(String(row[3] ?? ''))).slice(0,30);
  const detailPath = route === 'lelang' ? 'pengumumanlelang' : 'pengumumanpl';
  const opportunities = await mapConcurrent(rows,3,async (row) => {
    const code = String(row[0] ?? '');
    if (!/^\d{6,14}$/.test(code)) return null;
    const basePath = `${baseUrl}/${route}/${code}`;
    const headers = {accept:'text/html','user-agent':USER_AGENT,referer:pageUrl,...(cookie?{cookie}:{})};
    const [detailResponse,scheduleResponse] = await Promise.all([fetch(`${basePath}/${detailPath}`,{headers}),fetch(`${basePath}/jadwal`,{headers})]);
    if (!detailResponse.ok || !scheduleResponse.ok) return null;
    const [detailHtml,scheduleHtml] = await Promise.all([detailResponse.text(),scheduleResponse.text()]);
    const detail = parseSpseDetail(detailHtml);
    const schedule = parseSpseSchedule(scheduleHtml);
    if (!schedule || schedule.endAt.getTime() < now.getTime()) return null;
    const matchedKbli = detail.kbli.filter((codeValue) => userKbli.has(codeValue));
    if (!matchedKbli.length) return null;
    const title = detail.title || String(row[1] ?? '');
    const projectLocation = detail.projectLocation || 'Indonesia';
    return {
      source:`SPSE INAPROC — data resmi ${year}`,
      sourceUrl:`${basePath}/${detailPath}`,
      procurementType:route === 'nontender' ? 'Pengadaan Langsung' : 'Tender',
      tenderCode:code,
      title,
      lpse:detail.lpse || String(row[2] ?? 'SPSE INAPROC'),
      workUnit:detail.workUnit || String(row[2] ?? '-'),
      region:projectLocation.split(' - ').at(-1) ?? 'Indonesia',
      category:detail.category || String(row[route === 'lelang' ? 8 : 6] ?? '-'),
      hpsValue:detail.hpsValue,
      hpsDisplay:detail.hpsDisplay,
      scheduleStatus:String(row[3] ?? 'Aktif'),
      startAt:schedule.startAt.toISOString(),
      endAt:schedule.endAt.toISOString(),
      projectLocation,
      matchedKbli,
    } satisfies SpseOpportunity;
  });
  return opportunities.filter((value): value is SpseOpportunity => Boolean(value));
}

export async function searchOfficialSpse(sourceUrl: string, kbliCodes: string[], now = new Date()) {
  const baseUrl = normalizeSpseSource(sourceUrl);
  if (!baseUrl) throw new Error('Gunakan URL resmi LPSE berbentuk https://spse.inaproc.id/nama-lpse.');
  const userKbli = new Set(kbliCodes);
  if (!userKbli.size) throw new Error('Upload NIB terlebih dahulu agar pencarian dapat dicocokkan dengan KBLI.');
  const [tenders,direct] = await Promise.all([scanRoute(baseUrl,'lelang',userKbli,now),scanRoute(baseUrl,'nontender',userKbli,now)]);
  return [...tenders,...direct];
}
