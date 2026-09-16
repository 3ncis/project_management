import { env } from 'cloudflare:workers';
import { maskUsername, sealCredential } from './security';
import { hashPassword } from './password';
import { searchOfficialSpse } from './spse';

type UserRow = { id: number; slug: string; name: string; email: string; role: 'admin' | 'user'; status: 'active' | 'inactive'; headline: string; location: string; profile_completion: number; last_login_at: string | null };
let setupPromise: Promise<void> | null = null;
function d1() { if (!env.DB) throw new Error('Database D1 belum tersedia.'); return env.DB; }
export function ensureDatabase() { if (!setupPromise) setupPromise = initializeDatabase().catch((error) => { setupPromise = null; throw error; }); return setupPromise; }

export class DuplicateKbliError extends Error {
  constructor(public readonly codes: string[]) { super('Data KBLI sudah ada.'); this.name = 'DuplicateKbliError'; }
}

async function initializeDatabase() {
  const db = d1(); const now = new Date().toISOString();
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, role TEXT NOT NULL CHECK(role IN ('admin','user')), status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')), username TEXT, password_hash TEXT, password_salt TEXT, password_updated_at TEXT, failed_login_count INTEGER NOT NULL DEFAULT 0, locked_until TEXT, headline TEXT NOT NULL DEFAULT '', location TEXT NOT NULL DEFAULT 'Indonesia', profile_completion INTEGER NOT NULL DEFAULT 0, last_login_at TEXT, created_at TEXT NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS applications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), company TEXT NOT NULL, role_title TEXT NOT NULL, stage TEXT NOT NULL, match_score INTEGER NOT NULL, next_action TEXT, next_action_at TEXT, source TEXT NOT NULL DEFAULT 'AI Recommendation', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS recommendations (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), company TEXT NOT NULL, role_title TEXT NOT NULL, location TEXT NOT NULL, work_mode TEXT NOT NULL, match_score INTEGER NOT NULL, salary_range TEXT NOT NULL, skills TEXT NOT NULL, created_at TEXT NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS procurement_opportunities (id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT NOT NULL, source_url TEXT NOT NULL, procurement_type TEXT NOT NULL CHECK(procurement_type IN ('Tender','Pengadaan Langsung')), tender_code TEXT NOT NULL, title TEXT NOT NULL, lpse TEXT NOT NULL, work_unit TEXT NOT NULL, region TEXT NOT NULL, category TEXT NOT NULL, hps_value INTEGER NOT NULL, hps_display TEXT NOT NULL, schedule_status TEXT NOT NULL, start_at TEXT, end_at TEXT, project_location TEXT NOT NULL, source_last_seen_at TEXT NOT NULL, fingerprint TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS procurement_sources (id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT NOT NULL, source_url TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')), created_by_admin_id INTEGER NOT NULL REFERENCES users(id), last_triggered_at TEXT, deleted_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS procurement_search_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), source_id INTEGER NOT NULL REFERENCES procurement_sources(id), status TEXT NOT NULL DEFAULT 'QUEUED' CHECK(status IN ('QUEUED','PROCESSING','COMPLETED','FAILED')), result_count INTEGER NOT NULL DEFAULT 0, correlation_id TEXT NOT NULL UNIQUE, error_message TEXT, triggered_at TEXT NOT NULL, completed_at TEXT)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS opportunity_matches (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), opportunity_id INTEGER NOT NULL REFERENCES procurement_opportunities(id), match_score INTEGER NOT NULL, confidence INTEGER NOT NULL, reasons TEXT NOT NULL, risk_flags TEXT NOT NULL DEFAULT '[]', decision TEXT NOT NULL DEFAULT 'REVIEW', rating INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, UNIQUE(user_id, opportunity_id))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS bid_tracker (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), opportunity_id INTEGER NOT NULL REFERENCES procurement_opportunities(id), stage TEXT NOT NULL, next_action TEXT, due_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(user_id, opportunity_id))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS opportunity_notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), opportunity_id INTEGER NOT NULL REFERENCES procurement_opportunities(id), is_read INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, UNIQUE(user_id, opportunity_id))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS nib_documents (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), object_key TEXT NOT NULL UNIQUE, original_filename TEXT NOT NULL, mime_type TEXT NOT NULL, size_bytes INTEGER NOT NULL, ocr_text TEXT NOT NULL, nib_number TEXT, status TEXT NOT NULL, extracted_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS user_kbli (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), nib_document_id INTEGER NOT NULL REFERENCES nib_documents(id), kbli_code TEXT NOT NULL, kbli_title TEXT NOT NULL DEFAULT '', confidence INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, UNIQUE(nib_document_id, kbli_code))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS activity_events (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), event_type TEXT NOT NULL, detail TEXT NOT NULL, created_at TEXT NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS openai_credentials (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), masked_username TEXT NOT NULL, password_secret_ref TEXT NOT NULL, encrypted_username TEXT, encrypted_password TEXT, encryption_version INTEGER NOT NULL DEFAULT 1, connection_status TEXT NOT NULL DEFAULT 'connected', verified_at TEXT, updated_at TEXT NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS admin_access_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, admin_user_id INTEGER NOT NULL REFERENCES users(id), action TEXT NOT NULL, target_user_id INTEGER REFERENCES users(id), purpose TEXT, correlation_id TEXT, created_at TEXT NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS monitoring_snapshots (id INTEGER PRIMARY KEY AUTOINCREMENT, metric_key TEXT NOT NULL, metric_value TEXT NOT NULL, unit TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('healthy','warning','critical')), captured_at TEXT NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS ai_agent_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), agent_name TEXT NOT NULL, task_type TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('QUEUED','PROCESSING','NEEDS_REVIEW','COMPLETED','FAILED')), progress INTEGER NOT NULL DEFAULT 0, model TEXT NOT NULL, prompt_version TEXT NOT NULL, token_in INTEGER NOT NULL DEFAULT 0, token_out INTEGER NOT NULL DEFAULT 0, estimated_cost TEXT NOT NULL DEFAULT '0', latency_ms INTEGER, error_code TEXT, result_summary TEXT, correlation_id TEXT NOT NULL, started_at TEXT NOT NULL, completed_at TEXT)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS user_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), token_hash TEXT NOT NULL UNIQUE, user_agent TEXT, created_at TEXT NOT NULL, last_seen_at TEXT NOT NULL, expires_at TEXT NOT NULL, revoked_at TEXT)`),
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_slug ON users(slug)`), db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)`), db.prepare(`CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, status)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_applications_user_updated ON applications(user_id, updated_at)`), db.prepare(`CREATE INDEX IF NOT EXISTS idx_applications_user_stage ON applications(user_id, stage)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_recommendations_user_match ON recommendations(user_id, match_score DESC)`), db.prepare(`CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_events(created_at DESC)`),
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_procurement_fingerprint ON procurement_opportunities(fingerprint)`), db.prepare(`CREATE INDEX IF NOT EXISTS idx_procurement_type_status ON procurement_opportunities(procurement_type, schedule_status)`), db.prepare(`CREATE INDEX IF NOT EXISTS idx_procurement_end ON procurement_opportunities(end_at)`),
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_procurement_sources_url ON procurement_sources(source_url)`), db.prepare(`CREATE INDEX IF NOT EXISTS idx_procurement_sources_status_updated ON procurement_sources(status,updated_at DESC)`),
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_procurement_search_runs_correlation ON procurement_search_runs(correlation_id)`), db.prepare(`CREATE INDEX IF NOT EXISTS idx_procurement_search_runs_user_triggered ON procurement_search_runs(user_id,triggered_at DESC)`), db.prepare(`CREATE INDEX IF NOT EXISTS idx_procurement_search_runs_status_triggered ON procurement_search_runs(status,triggered_at DESC)`),
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_opportunity_matches_user_opportunity ON opportunity_matches(user_id, opportunity_id)`), db.prepare(`CREATE INDEX IF NOT EXISTS idx_opportunity_matches_user_score ON opportunity_matches(user_id, match_score DESC)`),
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_bid_tracker_user_opportunity ON bid_tracker(user_id, opportunity_id)`), db.prepare(`CREATE INDEX IF NOT EXISTS idx_bid_tracker_user_stage ON bid_tracker(user_id, stage)`), db.prepare(`CREATE INDEX IF NOT EXISTS idx_bid_tracker_due ON bid_tracker(due_at)`),
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_user_opportunity ON opportunity_notifications(user_id, opportunity_id)`), db.prepare(`CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created ON opportunity_notifications(user_id, is_read, created_at DESC)`),
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_nib_documents_object_key ON nib_documents(object_key)`), db.prepare(`CREATE INDEX IF NOT EXISTS idx_nib_documents_user_created ON nib_documents(user_id, created_at DESC)`), db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_user_kbli_document_code ON user_kbli(nib_document_id, kbli_code)`), db.prepare(`CREATE INDEX IF NOT EXISTS idx_user_kbli_user_code ON user_kbli(user_id, kbli_code)`),
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_openai_credentials_user ON openai_credentials(user_id)`), db.prepare(`CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_access_logs(created_at DESC)`), db.prepare(`CREATE INDEX IF NOT EXISTS idx_monitoring_metric_captured ON monitoring_snapshots(metric_key, captured_at DESC)`),
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_agent_runs_correlation ON ai_agent_runs(correlation_id)`), db.prepare(`CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_user_started ON ai_agent_runs(user_id, started_at DESC)`), db.prepare(`CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_status_started ON ai_agent_runs(status, started_at DESC)`),
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token_hash)`), db.prepare(`CREATE INDEX IF NOT EXISTS idx_user_sessions_user_expires ON user_sessions(user_id, expires_at DESC)`),
  ]);
  await ensureProductionColumns();
  await db.prepare(`DELETE FROM user_kbli WHERE id NOT IN (SELECT MIN(id) FROM user_kbli GROUP BY user_id,kbli_code)`).run();
  await db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_user_kbli_user_code_unique ON user_kbli(user_id,kbli_code)`).run();
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO users (slug,name,email,role,status,headline,location,profile_completion,last_login_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind('admin','Administrator','admin@padmashri.tech','admin','active','System Administrator','Jakarta',100,now,now),
    db.prepare(`INSERT OR IGNORE INTO users (slug,name,email,role,status,headline,location,profile_completion,last_login_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind('padma','Padma','padma@padmashri.tech','user','active','Penyedia Jasa Konstruksi & Teknologi','Indonesia',82,now,now),
    db.prepare(`INSERT OR IGNORE INTO users (slug,name,email,role,status,headline,location,profile_completion,last_login_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind('ortyd','Ortyd','ortyd@padmashri.tech','user','active','Penyedia Barang & Solusi Digital','Indonesia',88,now,now),
  ]);
  await db.batch([
    db.prepare(`UPDATE procurement_sources SET status='inactive',updated_at=? WHERE source_url LIKE 'https://www.datalpse.com/%' AND status='active' AND deleted_at IS NULL`).bind(now),
    db.prepare(`INSERT OR IGNORE INTO procurement_sources (label,source_url,status,created_by_admin_id,created_at,updated_at) SELECT 'SPSE Kementerian Ketenagakerjaan','https://spse.inaproc.id/kemnaker','active',id,?,? FROM users WHERE slug='admin' AND NOT EXISTS (SELECT 1 FROM procurement_sources WHERE status='active' AND deleted_at IS NULL AND source_url LIKE 'https://spse.inaproc.id/%')`).bind(now,now),
    db.prepare(`UPDATE procurement_sources SET status='active',updated_at=? WHERE source_url='https://spse.inaproc.id/kemnaker' AND deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM procurement_sources WHERE status='active' AND deleted_at IS NULL AND source_url LIKE 'https://spse.inaproc.id/%')`).bind(now),
  ]);
  await db.batch([
    db.prepare(`UPDATE users SET headline='Penyedia Jasa Konstruksi & Teknologi',location='Indonesia',profile_completion=82 WHERE slug='padma'`),
    db.prepare(`UPDATE users SET headline='Penyedia Barang & Solusi Digital',location='Indonesia',profile_completion=88 WHERE slug='ortyd'`),
  ]);
  await ensureInitialPasswords(now);
  await removeSimulationData();
  const monitoringCount = await db.prepare(`SELECT COUNT(*) AS total FROM monitoring_snapshots`).first<{ total: number }>();
  if ((monitoringCount?.total ?? 0) === 0) {
    await db.batch([
      db.prepare(`INSERT INTO monitoring_snapshots (metric_key,metric_value,unit,status,captured_at) VALUES (?,?,?,?,?)`).bind('api_latency','184','ms','healthy',now),
      db.prepare(`INSERT INTO monitoring_snapshots (metric_key,metric_value,unit,status,captured_at) VALUES (?,?,?,?,?)`).bind('error_rate','0.3','%','healthy',now),
      db.prepare(`INSERT INTO monitoring_snapshots (metric_key,metric_value,unit,status,captured_at) VALUES (?,?,?,?,?)`).bind('queue_depth','2','jobs','healthy',now),
      db.prepare(`INSERT INTO monitoring_snapshots (metric_key,metric_value,unit,status,captured_at) VALUES (?,?,?,?,?)`).bind('ai_cost','1.84','USD','healthy',now),
    ]);
  }
  await db.prepare('PRAGMA optimize').run();
}

async function removeSimulationData() {
  const db = d1();
  await db.batch([
    db.prepare(`DELETE FROM opportunity_notifications WHERE opportunity_id IN (SELECT id FROM procurement_opportunities WHERE fingerprint LIKE 'datalpse:%' OR fingerprint LIKE 'simulation:%' OR tender_code LIKE 'PL-TEST-%')`),
    db.prepare(`DELETE FROM bid_tracker WHERE opportunity_id IN (SELECT id FROM procurement_opportunities WHERE fingerprint LIKE 'datalpse:%' OR fingerprint LIKE 'simulation:%' OR tender_code LIKE 'PL-TEST-%')`),
    db.prepare(`DELETE FROM opportunity_matches WHERE opportunity_id IN (SELECT id FROM procurement_opportunities WHERE fingerprint LIKE 'datalpse:%' OR fingerprint LIKE 'simulation:%' OR tender_code LIKE 'PL-TEST-%')`),
    db.prepare(`DELETE FROM procurement_opportunities WHERE fingerprint LIKE 'datalpse:%' OR fingerprint LIKE 'simulation:%' OR tender_code LIKE 'PL-TEST-%'`),
    db.prepare(`DELETE FROM ai_agent_runs WHERE prompt_version LIKE 'procurement-v2.0%'`),
    db.prepare(`UPDATE procurement_search_runs SET status='FAILED',error_message='Antrean versi lama dibatalkan.',completed_at=? WHERE status='QUEUED'`).bind(new Date().toISOString()),
  ]);
}

async function ensureProductionColumns() {
  const db = d1();
  const sourceColumns = await db.prepare(`PRAGMA table_info(procurement_sources)`).all<{ name: string }>();
  if (!sourceColumns.results.some((column)=>column.name==='deleted_at')) await db.prepare(`ALTER TABLE procurement_sources ADD COLUMN deleted_at TEXT`).run();
  const userColumns = await db.prepare(`PRAGMA table_info(users)`).all<{ name: string }>();
  const userNames = new Set(userColumns.results.map((column) => column.name));
  const userChanges = [
    ['username', `ALTER TABLE users ADD COLUMN username TEXT`],
    ['password_hash', `ALTER TABLE users ADD COLUMN password_hash TEXT`],
    ['password_salt', `ALTER TABLE users ADD COLUMN password_salt TEXT`],
    ['password_updated_at', `ALTER TABLE users ADD COLUMN password_updated_at TEXT`],
    ['failed_login_count', `ALTER TABLE users ADD COLUMN failed_login_count INTEGER NOT NULL DEFAULT 0`],
    ['locked_until', `ALTER TABLE users ADD COLUMN locked_until TEXT`],
  ].filter(([name]) => !userNames.has(name)).map(([, sql]) => db.prepare(sql));
  if (userChanges.length) await db.batch(userChanges);
  await db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)`).run();
  const matchColumns = await db.prepare(`PRAGMA table_info(opportunity_matches)`).all<{ name: string }>();
  const matchNames = new Set(matchColumns.results.map((column) => column.name));
  const matchChanges = [
    ['decision', `ALTER TABLE opportunity_matches ADD COLUMN decision TEXT NOT NULL DEFAULT 'REVIEW'`],
    ['rating', `ALTER TABLE opportunity_matches ADD COLUMN rating INTEGER NOT NULL DEFAULT 0`],
  ].filter(([name]) => !matchNames.has(name)).map(([, sql]) => db.prepare(sql));
  if (matchChanges.length) await db.batch(matchChanges);
  const credentialColumns = await db.prepare(`PRAGMA table_info(openai_credentials)`).all<{ name: string }>();
  const credentialNames = new Set(credentialColumns.results.map((column) => column.name));
  const credentialChanges = [
    ['encrypted_username', `ALTER TABLE openai_credentials ADD COLUMN encrypted_username TEXT`],
    ['encrypted_password', `ALTER TABLE openai_credentials ADD COLUMN encrypted_password TEXT`],
    ['encryption_version', `ALTER TABLE openai_credentials ADD COLUMN encryption_version INTEGER NOT NULL DEFAULT 1`],
    ['verified_at', `ALTER TABLE openai_credentials ADD COLUMN verified_at TEXT`],
  ].filter(([name]) => !credentialNames.has(name)).map(([, sql]) => db.prepare(sql));
  if (credentialChanges.length) await db.batch(credentialChanges);

  const auditColumns = await db.prepare(`PRAGMA table_info(admin_access_logs)`).all<{ name: string }>();
  const auditNames = new Set(auditColumns.results.map((column) => column.name));
  const auditChanges = [
    ['purpose', `ALTER TABLE admin_access_logs ADD COLUMN purpose TEXT`],
    ['correlation_id', `ALTER TABLE admin_access_logs ADD COLUMN correlation_id TEXT`],
  ].filter(([name]) => !auditNames.has(name)).map(([, sql]) => db.prepare(sql));
  if (auditChanges.length) await db.batch(auditChanges);
  const nibColumns = await db.prepare(`PRAGMA table_info(nib_documents)`).all<{ name: string }>();
  if (!nibColumns.results.some((column) => column.name === 'nib_number')) await db.prepare(`ALTER TABLE nib_documents ADD COLUMN nib_number TEXT`).run();
  const kbliColumns = await db.prepare(`PRAGMA table_info(user_kbli)`).all<{ name: string }>();
  if (!kbliColumns.results.some((column) => column.name === 'kbli_title')) await db.prepare(`ALTER TABLE user_kbli ADD COLUMN kbli_title TEXT NOT NULL DEFAULT ''`).run();
}

async function ensureInitialPasswords(now: string) {
  const db = d1();
  const accounts = [
    { slug: 'admin', username: 'admin', password: process.env.APP_ADMIN_INITIAL_PASSWORD },
    { slug: 'padma', username: 'padma', password: process.env.APP_PADMA_INITIAL_PASSWORD },
    { slug: 'ortyd', username: 'ortyd', password: process.env.APP_ORTYD_INITIAL_PASSWORD },
  ];
  for (const account of accounts) {
    const row = await db.prepare(`SELECT password_hash FROM users WHERE slug=?`).bind(account.slug).first<{ password_hash: string | null }>();
    if (row?.password_hash) {
      await db.prepare(`UPDATE users SET username=COALESCE(username,?) WHERE slug=?`).bind(account.username,account.slug).run();
      continue;
    }
    const password = account.password ?? (process.env.NODE_ENV !== 'production' ? `PST-${account.username}-Dev!2026` : '');
    if (!password) throw new Error(`Password awal ${account.slug} belum dikonfigurasi.`);
    const sealed = await hashPassword(password);
    await db.prepare(`UPDATE users SET username=?,password_hash=?,password_salt=?,password_updated_at=?,failed_login_count=0,locked_until=NULL WHERE slug=?`).bind(account.username,sealed.hash,sealed.salt,now,account.slug).run();
  }
}

export async function getUserDashboard(slug: 'padma' | 'ortyd') {
  await ensureDatabase(); const db = d1();
  const now = new Date().toISOString();
  const user = await db.prepare(`SELECT id,slug,name,email,role,status,headline,location,profile_completion,last_login_at FROM users WHERE slug=? AND role='user'`).bind(slug).first<UserRow>(); if (!user) throw new Error('User tidak ditemukan.');
  if (user.status !== 'active') throw new Error('Akun dinonaktifkan. Hubungi administrator.');
  await db.prepare(`UPDATE users SET last_login_at=? WHERE id=?`).bind(now, user.id).run();
  const [trackers, opportunities, credential, stats, notifications, nibDocuments, kbli, searchSource, searchRun] = await Promise.all([
    db.prepare(`SELECT b.id,b.stage,b.next_action,b.due_at,b.updated_at,o.tender_code,o.procurement_type,o.title,o.lpse,o.hps_display,m.match_score FROM bid_tracker b JOIN procurement_opportunities o ON o.id=b.opportunity_id LEFT JOIN opportunity_matches m ON m.user_id=b.user_id AND m.opportunity_id=b.opportunity_id WHERE b.user_id=? AND o.end_at IS NOT NULL AND datetime(o.end_at)>=datetime(?) ORDER BY CASE WHEN b.due_at IS NULL THEN 1 ELSE 0 END,b.due_at ASC,b.updated_at DESC LIMIT 5`).bind(user.id,now).all(),
    db.prepare(`SELECT o.id,o.source,o.source_url,o.procurement_type,o.tender_code,o.title,o.lpse,o.work_unit,o.region,o.category,o.hps_display,o.schedule_status,o.start_at,o.end_at,o.project_location,m.match_score,m.confidence,m.reasons,m.risk_flags,m.decision,m.rating FROM opportunity_matches m JOIN procurement_opportunities o ON o.id=m.opportunity_id WHERE m.user_id=? AND o.end_at IS NOT NULL AND datetime(o.end_at)>=datetime(?) ORDER BY CASE m.decision WHEN 'GO' THEN 0 WHEN 'REVIEW' THEN 1 ELSE 2 END,m.match_score DESC,o.end_at ASC LIMIT 50`).bind(user.id,now).all(),
    Promise.resolve(null),
    db.prepare(`SELECT COUNT(*) AS total, SUM(CASE WHEN o.procurement_type='Tender' THEN 1 ELSE 0 END) AS tenders, SUM(CASE WHEN o.procurement_type='Pengadaan Langsung' THEN 1 ELSE 0 END) AS direct_procurements, ROUND(AVG(m.match_score)) AS average_match FROM opportunity_matches m JOIN procurement_opportunities o ON o.id=m.opportunity_id WHERE m.user_id=? AND o.end_at IS NOT NULL AND datetime(o.end_at)>=datetime(?)`).bind(user.id,now).first(),
    db.prepare(`SELECT n.id,o.title,o.tender_code,o.procurement_type,o.created_at FROM opportunity_notifications n JOIN procurement_opportunities o ON o.id=n.opportunity_id WHERE n.user_id=? AND n.is_read=0 AND o.end_at IS NOT NULL AND datetime(o.end_at)>=datetime(?) ORDER BY n.created_at DESC LIMIT 5`).bind(user.id,now).all(),
    db.prepare(`SELECT id,original_filename,nib_number,status,extracted_at,created_at FROM nib_documents WHERE user_id=? ORDER BY created_at DESC LIMIT 3`).bind(user.id).all(),
    db.prepare(`SELECT kbli_code,MAX(kbli_title) AS kbli_title,MAX(confidence) AS confidence,MAX(created_at) AS created_at FROM user_kbli WHERE user_id=? GROUP BY kbli_code ORDER BY created_at DESC,kbli_code LIMIT 30`).bind(user.id).all(),
    db.prepare(`SELECT id,CASE WHEN (SELECT COUNT(*) FROM procurement_sources WHERE status='active' AND deleted_at IS NULL)=1 THEN label ELSE CAST((SELECT COUNT(*) FROM procurement_sources WHERE status='active' AND deleted_at IS NULL) AS TEXT)||' sumber SPSE aktif' END AS label,source_url,status,last_triggered_at,updated_at,(SELECT COUNT(*) FROM procurement_sources WHERE status='active' AND deleted_at IS NULL) AS active_count FROM procurement_sources WHERE status='active' AND deleted_at IS NULL ORDER BY updated_at DESC,id DESC LIMIT 1`).first(),
    db.prepare(`SELECT r.id,r.status,r.result_count,r.correlation_id,r.error_message,r.triggered_at,r.completed_at,s.label,s.source_url FROM procurement_search_runs r JOIN procurement_sources s ON s.id=r.source_id WHERE r.user_id=? ORDER BY r.triggered_at DESC,r.id DESC LIMIT 1`).bind(user.id).first(),
  ]);
  return { user, trackers: trackers.results, opportunities: opportunities.results, credential, stats, notifications: notifications.results, nibDocuments: nibDocuments.results, kbli: kbli.results, searchSource, searchRun };
}

export async function getAdminDashboard() {
  await ensureDatabase(); const db = d1();
  const [metrics, users, activity, operations, audit, agentMetrics, agentRuns, credential, nibOverview, searchSources, searchRuns] = await Promise.all([
    db.prepare(`SELECT (SELECT COUNT(*) FROM users WHERE role='user') AS total_users, (SELECT COUNT(*) FROM users WHERE role='user' AND status='active') AS active_users, (SELECT COUNT(*) FROM procurement_opportunities WHERE end_at IS NOT NULL AND datetime(end_at)>=datetime('now') AND fingerprint LIKE 'spse:%') AS total_opportunities, (SELECT ROUND(AVG(m.match_score)) FROM opportunity_matches m JOIN procurement_opportunities o ON o.id=m.opportunity_id WHERE o.end_at IS NOT NULL AND datetime(o.end_at)>=datetime('now') AND o.fingerprint LIKE 'spse:%') AS average_match`).first(),
    db.prepare(`SELECT u.id,u.slug,u.name,u.email,u.username,u.role,u.status,u.headline,u.location,u.profile_completion,u.password_updated_at,u.last_login_at,COUNT(b.id) AS tracker_count FROM users u LEFT JOIN bid_tracker b ON b.user_id=u.id GROUP BY u.id ORDER BY CASE WHEN u.role='admin' THEN 0 ELSE 1 END,u.name`).all(),
    db.prepare(`SELECT e.id,u.name,e.event_type,e.detail,e.created_at FROM activity_events e JOIN users u ON u.id=e.user_id WHERE e.event_type IN ('procurement','openai','admin') ORDER BY e.created_at DESC LIMIT 8`).all(),
    db.prepare(`SELECT metric_key,metric_value,unit,status,captured_at FROM monitoring_snapshots WHERE id IN (SELECT MAX(id) FROM monitoring_snapshots GROUP BY metric_key) ORDER BY metric_key`).all(),
    db.prepare(`SELECT l.id,a.name AS admin_name,u.name AS target_name,l.action,l.purpose,l.correlation_id,l.created_at FROM admin_access_logs l JOIN users a ON a.id=l.admin_user_id LEFT JOIN users u ON u.id=l.target_user_id ORDER BY l.created_at DESC LIMIT 8`).all(),
    db.prepare(`SELECT COUNT(*) AS total_runs, SUM(CASE WHEN status IN ('QUEUED','PROCESSING') THEN 1 ELSE 0 END) AS active_runs, SUM(CASE WHEN status='FAILED' THEN 1 ELSE 0 END) AS failed_runs, ROUND(100.0 * SUM(CASE WHEN status='COMPLETED' THEN 1 ELSE 0 END) / NULLIF(SUM(CASE WHEN status IN ('COMPLETED','FAILED') THEN 1 ELSE 0 END),0)) AS success_rate, SUM(token_in + token_out) AS total_tokens, ROUND(SUM(CAST(estimated_cost AS REAL)),4) AS total_cost, ROUND(AVG(CASE WHEN latency_ms IS NOT NULL THEN latency_ms END)) AS average_latency FROM ai_agent_runs WHERE task_type LIKE 'procurement_%'`).first(),
    db.prepare(`SELECT r.id,u.name AS user_name,r.agent_name,r.task_type,r.status,r.progress,r.model,r.prompt_version,r.token_in,r.token_out,r.estimated_cost,r.latency_ms,r.error_code,r.result_summary,r.correlation_id,r.started_at,r.completed_at FROM ai_agent_runs r JOIN users u ON u.id=r.user_id WHERE r.task_type LIKE 'procurement_%' ORDER BY r.started_at DESC,r.id DESC LIMIT 12`).all(),
    db.prepare(`SELECT c.masked_username,c.connection_status,c.updated_at FROM openai_credentials c JOIN users u ON u.id=c.user_id WHERE u.role='admin' LIMIT 1`).first(),
    db.prepare(`SELECT u.name,COUNT(DISTINCT d.id) AS document_count,COUNT(k.id) AS kbli_count,MAX(d.extracted_at) AS last_extracted_at FROM users u LEFT JOIN nib_documents d ON d.user_id=u.id LEFT JOIN user_kbli k ON k.nib_document_id=d.id WHERE u.role='user' GROUP BY u.id ORDER BY u.name`).all(),
    db.prepare(`SELECT s.id,s.label,s.source_url,s.status,s.last_triggered_at,s.created_at,s.updated_at,u.name AS admin_name FROM procurement_sources s JOIN users u ON u.id=s.created_by_admin_id WHERE s.deleted_at IS NULL ORDER BY s.updated_at DESC,s.id DESC LIMIT 20`).all(),
    db.prepare(`SELECT r.id,r.status,r.result_count,r.correlation_id,r.error_message,r.triggered_at,r.completed_at,u.name AS user_name,s.label,s.source_url FROM procurement_search_runs r JOIN users u ON u.id=r.user_id JOIN procurement_sources s ON s.id=r.source_id ORDER BY r.triggered_at DESC,r.id DESC LIMIT 10`).all(),
  ]);
  return { metrics, users: users.results, activity: activity.results, operations: operations.results, audit: audit.results, agentMetrics, agentRuns: agentRuns.results, credential, nibOverview: nibOverview.results, searchSources: searchSources.results, searchRuns: searchRuns.results };
}

export async function saveOpenAICredential(slug: string, username: string, password: string) {
  await ensureDatabase(); const db = d1(); const user = await db.prepare(`SELECT id FROM users WHERE slug=? AND role='admin'`).bind(slug).first<{ id: number }>(); if (!user) throw new Error('Admin tidak ditemukan.');
  if (username.length < 3 || password.length < 8) throw new Error('Username atau password belum valid.');
  const [encryptedUsername, encryptedPassword] = await Promise.all([sealCredential(username.trim()), sealCredential(password)]); const masked = maskUsername(username); const secretReference = `sealed://openai/${slug}/${crypto.randomUUID()}`; const now = new Date().toISOString();
  await db.prepare(`INSERT INTO openai_credentials (user_id,masked_username,password_secret_ref,encrypted_username,encrypted_password,encryption_version,connection_status,verified_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET masked_username=excluded.masked_username,password_secret_ref=excluded.password_secret_ref,encrypted_username=excluded.encrypted_username,encrypted_password=excluded.encrypted_password,encryption_version=1,connection_status='connected',verified_at=excluded.verified_at,updated_at=excluded.updated_at`).bind(user.id,masked,secretReference,encryptedUsername,encryptedPassword,1,'connected',now,now).run();
  await db.prepare(`INSERT INTO activity_events (user_id,event_type,detail,created_at) VALUES (?,?,?,?)`).bind(user.id,'openai','Menghubungkan akun OpenAI',now).run();
}
export async function deleteOpenAICredential(slug: string) { await ensureDatabase(); const db=d1(); const user=await db.prepare(`SELECT id FROM users WHERE slug=? AND role='admin'`).bind(slug).first<{id:number}>(); if(!user) throw new Error('Admin tidak ditemukan.'); await db.prepare(`DELETE FROM openai_credentials WHERE user_id=?`).bind(user.id).run(); }
export async function saveNibDocument(slug: string, file: { objectKey: string; name: string; type: string; size: number }, ocrText: string, nibNumber: string, kbli: { code: string; title: string; confidence: number }[]) {
  await ensureDatabase(); const db=d1(); const user=await db.prepare(`SELECT id FROM users WHERE slug=? AND role='user'`).bind(slug).first<{id:number}>(); if(!user) throw new Error('User tidak ditemukan.');
  const codes=[...new Set(kbli.map((item)=>item.code))];
  const placeholders=codes.map(()=>'?').join(',');
  const existing=codes.length?await db.prepare(`SELECT kbli_code FROM user_kbli WHERE user_id=? AND kbli_code IN (${placeholders}) ORDER BY kbli_code`).bind(user.id,...codes).all<{kbli_code:string}>():{results:[]};
  if(existing.results.length)throw new DuplicateKbliError(existing.results.map((item)=>item.kbli_code));
  const now=new Date().toISOString();
  await db.batch([
    db.prepare(`INSERT INTO nib_documents (user_id,object_key,original_filename,mime_type,size_bytes,ocr_text,nib_number,status,extracted_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(user.id,file.objectKey,file.name,file.type,file.size,ocrText,nibNumber,'OCR_COMPLETED',now,now,now),
    ...kbli.map((item)=>db.prepare(`INSERT INTO user_kbli (user_id,nib_document_id,kbli_code,kbli_title,confidence,created_at) SELECT ?,id,?,?,?,? FROM nib_documents WHERE object_key=?`).bind(user.id,item.code,item.title,item.confidence,now,file.objectKey)),
    db.prepare(`INSERT INTO activity_events (user_id,event_type,detail,created_at) VALUES (?,?,?,?)`).bind(user.id,'procurement',`Mengunggah NIB ${nibNumber} dan menemukan ${kbli.length} kode KBLI`,now),
  ]);
  const document=await db.prepare(`SELECT id FROM nib_documents WHERE object_key=?`).bind(file.objectKey).first<{id:number}>(); if(!document) throw new Error('Dokumen NIB gagal disimpan.');
  return { documentId: document.id, nibNumber, kbli };
}
export async function markNotificationsRead(slug:string){await ensureDatabase();const db=d1();const user=await db.prepare(`SELECT id FROM users WHERE slug=? AND role='user'`).bind(slug).first<{id:number}>();if(!user)throw new Error('User tidak ditemukan.');await db.prepare(`UPDATE opportunity_notifications SET is_read=1 WHERE user_id=?`).bind(user.id).run();}

export async function saveProcurementSource(adminSlug: string, input: { sourceId: number | null; label: string; sourceUrl: string; status: 'active' | 'inactive' }, correlationId: string) {
  await ensureDatabase();
  const db = d1();
  const admin = await db.prepare(`SELECT id FROM users WHERE slug=? AND role='admin'`).bind(adminSlug).first<{ id: number }>();
  if (!admin) throw new Error('Akses khusus Admin.');
  const now = new Date().toISOString();
  const duplicate = await db.prepare(`SELECT id FROM procurement_sources WHERE source_url=? AND deleted_at IS NULL AND (? IS NULL OR id<>?) LIMIT 1`).bind(input.sourceUrl,input.sourceId,input.sourceId).first<{ id: number }>();
  if (duplicate) throw new Error('URL SPSE tersebut sudah terdaftar. Edit sumber yang sudah ada.');
  if (input.sourceId) {
    const existing = await db.prepare(`SELECT id FROM procurement_sources WHERE id=? AND deleted_at IS NULL`).bind(input.sourceId).first<{ id: number }>();
    if (!existing) throw new Error('Sumber pencarian tidak ditemukan.');
    await db.prepare(`UPDATE procurement_sources SET label=?,source_url=?,status=?,created_by_admin_id=?,updated_at=? WHERE id=?`).bind(input.label,input.sourceUrl,input.status,admin.id,now,input.sourceId).run();
  } else {
    const archived = await db.prepare(`SELECT id FROM procurement_sources WHERE source_url=? AND deleted_at IS NOT NULL`).bind(input.sourceUrl).first<{ id: number }>();
    if (archived) await db.prepare(`UPDATE procurement_sources SET label=?,status=?,created_by_admin_id=?,deleted_at=NULL,updated_at=? WHERE id=?`).bind(input.label,input.status,admin.id,now,archived.id).run();
    else await db.prepare(`INSERT INTO procurement_sources (label,source_url,status,created_by_admin_id,created_at,updated_at) VALUES (?,?,?,?,?,?)`).bind(input.label,input.sourceUrl,input.status,admin.id,now,now).run();
  }
  await db.batch([
    db.prepare(`INSERT INTO admin_access_logs (admin_user_id,action,purpose,correlation_id,created_at) VALUES (?,?,?,?,?)`).bind(admin.id,input.sourceId?'edit_procurement_source':'add_procurement_source',`${input.label} · ${input.status}`,correlationId,now),
    db.prepare(`INSERT INTO activity_events (user_id,event_type,detail,created_at) VALUES (?,?,?,?)`).bind(admin.id,'admin',`${input.sourceId?'Memperbarui':'Menambahkan'} sumber Tender/PL: ${input.sourceUrl}`,now),
  ]);
}

export async function deleteProcurementSource(adminSlug: string, sourceId: number, correlationId: string) {
  await ensureDatabase();
  const db = d1();
  const admin = await db.prepare(`SELECT id FROM users WHERE slug=? AND role='admin'`).bind(adminSlug).first<{ id: number }>();
  const source = await db.prepare(`SELECT id,label,source_url FROM procurement_sources WHERE id=? AND deleted_at IS NULL`).bind(sourceId).first<{ id: number; label: string; source_url: string }>();
  if (!admin || !source) throw new Error('Sumber pencarian tidak ditemukan.');
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(`UPDATE procurement_sources SET status='inactive',deleted_at=?,updated_at=? WHERE id=?`).bind(now,now,source.id),
    db.prepare(`INSERT INTO admin_access_logs (admin_user_id,action,purpose,correlation_id,created_at) VALUES (?,?,?,?,?)`).bind(admin.id,'delete_procurement_source',source.label,correlationId,now),
    db.prepare(`INSERT INTO activity_events (user_id,event_type,detail,created_at) VALUES (?,?,?,?)`).bind(admin.id,'admin',`Menghapus sumber Tender/PL: ${source.source_url}`,now),
  ]);
}

export async function triggerProcurementSearch(userSlug: string, correlationId: string) {
  await ensureDatabase();
  const db = d1();
  const user = await db.prepare(`SELECT id,status FROM users WHERE slug=? AND role='user'`).bind(userSlug).first<{ id: number; status: string }>();
  if (!user || user.status !== 'active') throw new Error('User tidak aktif atau tidak ditemukan.');
  const sourceRows = await db.prepare(`SELECT id,label,source_url FROM procurement_sources WHERE status='active' AND deleted_at IS NULL ORDER BY updated_at DESC,id DESC`).all<{ id: number; label: string; source_url: string }>();
  const sources = sourceRows.results;
  if (!sources.length) throw new Error('Admin belum mengaktifkan sumber pencarian Tender/PL.');
  const primarySource = sources[0];
  const sourceLabel = `${sources.length} sumber SPSE aktif`;
  const recent = await db.prepare(`SELECT id,status,triggered_at FROM procurement_search_runs WHERE user_id=? AND status='PROCESSING' ORDER BY triggered_at DESC LIMIT 1`).bind(user.id).first<{ id: number; status: string; triggered_at: string }>();
  if (recent && Date.now() - new Date(recent.triggered_at).getTime() < 120000) return { runId: recent.id, status: recent.status, sourceLabel, sourceUrl: primarySource.source_url, duplicate: true };
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(`INSERT INTO procurement_search_runs (user_id,source_id,status,result_count,correlation_id,triggered_at) VALUES (?,?,?,?,?,?)`).bind(user.id,primarySource.id,'PROCESSING',0,correlationId,now),
    ...sources.map((source)=>db.prepare(`UPDATE procurement_sources SET last_triggered_at=?,updated_at=? WHERE id=?`).bind(now,now,source.id)),
    db.prepare(`INSERT INTO ai_agent_runs (user_id,agent_name,task_type,status,progress,model,prompt_version,token_in,token_out,estimated_cost,result_summary,correlation_id,started_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(user.id,'Tender Discovery Agent','procurement_discovery','PROCESSING',10,'rule-engine','procurement-v3.1-spse-multi-source',0,0,'0',`Membaca Tender dan Pengadaan Langsung dari ${sourceLabel}`,correlationId,now),
    db.prepare(`INSERT INTO activity_events (user_id,event_type,detail,created_at) VALUES (?,?,?,?)`).bind(user.id,'procurement',`Memicu pencarian Tender/PL dari ${sourceLabel}`,now),
  ]);
  const run = await db.prepare(`SELECT id FROM procurement_search_runs WHERE correlation_id=?`).bind(correlationId).first<{ id: number }>();
  const startedAt = Date.now();
  try {
    const kbliRows = await db.prepare(`SELECT DISTINCT kbli_code FROM user_kbli WHERE user_id=? ORDER BY kbli_code`).bind(user.id).all<{ kbli_code: string }>();
    const kbliCodes = kbliRows.results.map((row)=>row.kbli_code);
    if (!kbliCodes.length) throw new Error('Upload NIB terlebih dahulu agar pencarian dapat dicocokkan dengan KBLI.');
    const scans = await Promise.allSettled(sources.map(async(source)=>({source,opportunities:await searchOfficialSpse(source.source_url,kbliCodes,new Date())})));
    const successfulScans = scans.filter((scan): scan is PromiseFulfilledResult<{ source: typeof primarySource; opportunities: Awaited<ReturnType<typeof searchOfficialSpse>> }>=>scan.status==='fulfilled').map((scan)=>scan.value);
    const failedCount = scans.length-successfulScans.length;
    if (!successfulScans.length) throw new Error('Seluruh sumber SPSE gagal dipindai. Coba kembali atau periksa URL sumber pada Admin.');
    const opportunities = successfulScans.flatMap(({source,opportunities:items})=>items.map((opportunity)=>({source,opportunity})));
    const seenAt = new Date().toISOString();
    for (const {source,opportunity} of opportunities) {
      const fingerprint = `spse:${new URL(source.source_url).pathname.split('/').filter(Boolean)[0]}:${opportunity.procurementType}:${opportunity.tenderCode}`;
      const reasons = JSON.stringify(opportunity.matchedKbli.map((code)=>`KBLI ${code} cocok persis dengan profil NIB`));
      await db.batch([
        db.prepare(`INSERT INTO procurement_opportunities (source,source_url,procurement_type,tender_code,title,lpse,work_unit,region,category,hps_value,hps_display,schedule_status,start_at,end_at,project_location,source_last_seen_at,fingerprint,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(fingerprint) DO UPDATE SET source=excluded.source,source_url=excluded.source_url,title=excluded.title,lpse=excluded.lpse,work_unit=excluded.work_unit,region=excluded.region,category=excluded.category,hps_value=excluded.hps_value,hps_display=excluded.hps_display,schedule_status=excluded.schedule_status,start_at=excluded.start_at,end_at=excluded.end_at,project_location=excluded.project_location,source_last_seen_at=excluded.source_last_seen_at`).bind(opportunity.source,opportunity.sourceUrl,opportunity.procurementType,opportunity.tenderCode,opportunity.title,opportunity.lpse,opportunity.workUnit,opportunity.region,opportunity.category,opportunity.hpsValue,opportunity.hpsDisplay,opportunity.scheduleStatus,opportunity.startAt,opportunity.endAt,opportunity.projectLocation,seenAt,fingerprint,seenAt),
        db.prepare(`INSERT INTO opportunity_matches (user_id,opportunity_id,match_score,confidence,reasons,risk_flags,decision,rating,created_at) SELECT ?,id,98,100,?,'[]','GO',5,? FROM procurement_opportunities WHERE fingerprint=? ON CONFLICT(user_id,opportunity_id) DO UPDATE SET match_score=excluded.match_score,confidence=excluded.confidence,reasons=excluded.reasons,risk_flags='[]',decision='GO',rating=5`).bind(user.id,reasons,seenAt,fingerprint),
        db.prepare(`INSERT OR IGNORE INTO opportunity_notifications (user_id,opportunity_id,is_read,created_at) SELECT ?,id,0,? FROM procurement_opportunities WHERE fingerprint=?`).bind(user.id,seenAt,fingerprint),
      ]);
    }
    const completedAt = new Date().toISOString();
    const summary = `${opportunities.length} paket aktif dengan KBLI cocok ditemukan dari ${successfulScans.length} sumber SPSE${failedCount?`; ${failedCount} sumber gagal dipindai`:''}.`;
    await db.batch([
      db.prepare(`UPDATE procurement_search_runs SET status='COMPLETED',result_count=?,completed_at=?,error_message=NULL WHERE correlation_id=?`).bind(opportunities.length,completedAt,correlationId),
      db.prepare(`UPDATE ai_agent_runs SET status='COMPLETED',progress=100,latency_ms=?,result_summary=?,completed_at=? WHERE correlation_id=?`).bind(Date.now()-startedAt,summary,completedAt,correlationId),
      db.prepare(`INSERT INTO activity_events (user_id,event_type,detail,created_at) VALUES (?,?,?,?)`).bind(user.id,'procurement',summary,completedAt),
    ]);
    return { runId: run?.id, status: 'COMPLETED', resultCount: opportunities.length, sourceLabel, sourceUrl: primarySource.source_url, duplicate: false };
  } catch (error) {
    const completedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message : 'Sumber SPSE gagal dipindai.';
    await db.batch([
      db.prepare(`UPDATE procurement_search_runs SET status='FAILED',error_message=?,completed_at=? WHERE correlation_id=?`).bind(message,completedAt,correlationId),
      db.prepare(`UPDATE ai_agent_runs SET status='FAILED',progress=100,latency_ms=?,error_code='SOURCE_FETCH_FAILED',result_summary=?,completed_at=? WHERE correlation_id=?`).bind(Date.now()-startedAt,message,completedAt,correlationId),
    ]);
    throw error;
  }
}

export async function setUserStatus(adminSlug: string, targetSlug: string, status: 'active'|'inactive', purpose: string, correlationId: string) { await ensureDatabase(); const db=d1(); const admin=await db.prepare(`SELECT id FROM users WHERE slug=? AND role='admin'`).bind(adminSlug).first<{id:number}>(); const target=await db.prepare(`SELECT id FROM users WHERE slug=? AND role='user'`).bind(targetSlug).first<{id:number}>(); if(!admin||!target) throw new Error('Akun tidak ditemukan.'); const now=new Date().toISOString(); await db.batch([db.prepare(`UPDATE users SET status=? WHERE id=?`).bind(status,target.id),db.prepare(`INSERT INTO admin_access_logs (admin_user_id,action,target_user_id,purpose,correlation_id,created_at) VALUES (?,?,?,?,?,?)`).bind(admin.id,`set_status:${status}`,target.id,purpose,correlationId,now),db.prepare(`INSERT INTO activity_events (user_id,event_type,detail,created_at) VALUES (?,?,?,?)`).bind(target.id,'admin',`Status akun diubah menjadi ${status}`,now)]); }

export async function resetUserPassword(adminSlug: string, targetSlug: string, newPassword: string, purpose: string, correlationId: string) {
  await ensureDatabase();
  if (newPassword.length < 12 || !/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) throw new Error('Password minimal 12 karakter dan harus berisi huruf besar, huruf kecil, angka, serta simbol.');
  const db = d1();
  const admin = await db.prepare(`SELECT id FROM users WHERE slug=? AND role='admin'`).bind(adminSlug).first<{ id: number }>();
  const target = await db.prepare(`SELECT id FROM users WHERE slug=?`).bind(targetSlug).first<{ id: number }>();
  if (!admin || !target) throw new Error('Akun tidak ditemukan.');
  const now = new Date().toISOString();
  const sealed = await hashPassword(newPassword);
  await db.batch([
    db.prepare(`UPDATE users SET password_hash=?,password_salt=?,password_updated_at=?,failed_login_count=0,locked_until=NULL WHERE id=?`).bind(sealed.hash,sealed.salt,now,target.id),
    db.prepare(`UPDATE user_sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL`).bind(now,target.id),
    db.prepare(`INSERT INTO admin_access_logs (admin_user_id,action,target_user_id,purpose,correlation_id,created_at) VALUES (?,?,?,?,?,?)`).bind(admin.id,'reset_password',target.id,purpose,correlationId,now),
    db.prepare(`INSERT INTO activity_events (user_id,event_type,detail,created_at) VALUES (?,?,?,?)`).bind(target.id,'admin','Password akun diubah oleh Administrator',now),
  ]);
}
