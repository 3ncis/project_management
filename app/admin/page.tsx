import { redirect } from 'next/navigation';
import { AppNav } from '@/app/components/AppNav';
import { UserManagement } from '@/app/components/UserManagement';
import { OpenAIAccountCard } from '@/app/components/OpenAIAccountCard';
import { ProcurementSourceManager } from '@/app/components/ProcurementSourceManager';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getAdminDashboard } from '@/lib/database';
import { resolveViewer } from '@/lib/viewer';

export const dynamic = 'force-dynamic';

type DataRow = Record<string, string | number | null>;
type AgentMetrics = { total_runs?: number; active_runs?: number; failed_runs?: number; success_rate?: number; total_tokens?: number; total_cost?: number; average_latency?: number };

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const viewer = await resolveViewer(view);
  if (!viewer) redirect('/');
  if (viewer.role !== 'admin') redirect('/dashboard');

  const [data, chatGPTUser] = await Promise.all([getAdminDashboard(), getChatGPTUser()]);
  const metrics = data.metrics as { total_users?: number; active_users?: number; total_opportunities?: number; average_match?: number };
  const users = data.users as DataRow[];
  const activity = data.activity as DataRow[];
  const operations = data.operations as DataRow[];
  const audit = data.audit as DataRow[];
  const agentMetrics = data.agentMetrics as AgentMetrics;
  const agentRuns = data.agentRuns as DataRow[];
  const nibOverview = data.nibOverview as DataRow[];
  const searchSources = data.searchSources as DataRow[];
  const searchRuns = data.searchRuns as DataRow[];

  return <main className="app-shell admin-theme">
    <AppNav name="Administrator" role="admin" />
    <section className="workspace">
      <header className="topbar"><div><span className="kicker">PROCUREMENT ADMIN</span><h1>Tender control.</h1><p>Monitoring terpusat pengguna, peluang Tender/PL, dan Agen AI pengadaan.</p></div><div className="topbar-actions"><span className="live-badge">● Live monitoring</span><span className="avatar">AD</span></div></header>
      <section className="admin-alert"><div><span>ADMIN ONLY</span><strong>Monitoring lintas pengguna dan Agen AI dilindungi berdasarkan role.</strong></div><p>Identitas OpenAI mengikuti akun ChatGPT yang sedang aktif.</p></section>

      <ProcurementSourceManager sources={searchSources} view={view} />
      {searchRuns.length > 0 && <section className="data-panel search-run-monitor"><div className="section-heading"><div><span className="kicker">USER SEARCH QUEUE</span><h2>Trigger pencarian terbaru</h2></div><span className="record-count">{searchRuns.length} run</span></div><div className="activity-list">{searchRuns.map((run) => <div key={String(run.id)}><span className="activity-mark"/><strong>{String(run.user_name)}</strong><p>{String(run.label)} · {String(run.status)}</p><small>{new Date(String(run.triggered_at)).toLocaleString('id-ID')}</small></div>)}</div></section>}

      <section className="metric-grid admin-metrics" id="monitoring">
        <article><span>01</span><small>Total user</small><strong>{metrics.total_users ?? 0}</strong><em>Padma & Ortyd</em></article>
        <article><span>02</span><small>User aktif</small><strong>{metrics.active_users ?? 0}</strong><em>Status realtime</em></article>
        <article><span>03</span><small>Peluang Tender/PL</small><strong>{metrics.total_opportunities ?? 0}</strong><em>Snapshot + simulasi</em></article>
        <article className="yellow"><span>04</span><small>Rata-rata match</small><strong>{metrics.average_match ?? 0}%</strong><em>Kecocokan penyedia</em></article>
      </section>

      <section className="data-panel operations-panel"><div className="section-heading"><div><span className="kicker">OPERATIONAL HEALTH</span><h2>Monitoring operasional</h2></div><span className="record-count">Production</span></div><div className="operations-grid">{operations.map((item) => <article key={String(item.metric_key)}><span className={`health ${String(item.status)}`}>{String(item.status)}</span><strong>{String(item.metric_value)} <small>{String(item.unit)}</small></strong><p>{String(item.metric_key).replaceAll('_', ' ')}</p></article>)}</div></section>

      <section className="data-panel agent-monitoring" id="ai-monitoring">
        <div className="section-heading"><div><span className="kicker">AI PROCUREMENT OBSERVABILITY</span><h2>Monitoring Agen AI Tender/PL</h2><p>Discovery paket, kualifikasi penyedia, dokumen penawaran, risiko, model, token, biaya, latency, dan error.</p></div><span className="record-count">{agentMetrics.total_runs ?? 0} run</span></div>
        <div className="agent-metric-grid">
          <article><small>Run aktif</small><strong>{agentMetrics.active_runs ?? 0}</strong><span>Queued + processing</span></article>
          <article><small>Success rate</small><strong>{agentMetrics.success_rate ?? 0}%</strong><span>Run terminal</span></article>
          <article><small>Total token</small><strong>{Number(agentMetrics.total_tokens ?? 0).toLocaleString('id-ID')}</strong><span>Input + output</span></article>
          <article><small>Estimasi biaya</small><strong>${Number(agentMetrics.total_cost ?? 0).toFixed(4)}</strong><span>Akumulasi run</span></article>
          <article><small>Avg latency</small><strong>{Number(agentMetrics.average_latency ?? 0).toLocaleString('id-ID')}</strong><span>ms</span></article>
          <article className={Number(agentMetrics.failed_runs ?? 0) > 0 ? 'has-error' : ''}><small>Run gagal</small><strong>{agentMetrics.failed_runs ?? 0}</strong><span>Perlu ditinjau</span></article>
        </div>
        <div className="table-wrap agent-table"><table><thead><tr><th>User</th><th>Agen / Tugas</th><th>Status</th><th>Progress</th><th>Model & Usage</th><th>Latency</th><th>Detail</th></tr></thead><tbody>{agentRuns.map((run) => <tr key={String(run.id)}><td><strong>{String(run.user_name)}</strong><small className="cell-note">{new Date(String(run.started_at)).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</small></td><td><strong>{String(run.agent_name)}</strong><small className="cell-note">{String(run.task_type)}</small></td><td><span className={`agent-status ${String(run.status).toLowerCase()}`}>{String(run.status).replaceAll('_', ' ')}</span>{run.error_code && <small className="error-code">{String(run.error_code)}</small>}</td><td><div className="progress-line"><i style={{ width: `${Number(run.progress)}%` }} /></div><small className="cell-note">{Number(run.progress)}%</small></td><td><strong>{String(run.model)}</strong><small className="cell-note">{Number(run.token_in) + Number(run.token_out)} token · ${Number(run.estimated_cost).toFixed(4)}</small></td><td>{run.latency_ms ? `${Number(run.latency_ms).toLocaleString('id-ID')} ms` : '—'}</td><td><span className="run-summary">{String(run.result_summary ?? 'Belum ada hasil')}</span><small className="correlation" title={String(run.correlation_id)}>{String(run.correlation_id).slice(0, 8)}…</small></td></tr>)}</tbody></table></div>
      </section>

      <section className="data-panel user-management" id="users"><div className="section-heading"><div><span className="kicker">ACCESS CONTROL</span><h2>Kelola akun & password</h2><p>Admin dapat mengganti password akun. Perubahan password otomatis mengeluarkan seluruh sesi akun tersebut.</p></div><span className="record-count">{users.length} akun</span></div><div className="table-wrap"><table><thead><tr><th>User</th><th>Username / Role</th><th>Paket dilacak</th><th>Status</th><th>Aksi Admin</th></tr></thead><tbody>{users.map((user) => <tr key={String(user.id)}><td><div className="user-cell"><span>{String(user.name).slice(0, 2).toUpperCase()}</span><div><strong>{String(user.name)}</strong><small>{String(user.email)}</small></div></div></td><td><strong>{String(user.username ?? user.slug)}</strong><small className="cell-note">{String(user.role).toUpperCase()}</small></td><td>{Number(user.tracker_count)}</td><td><span className={`status-dot ${user.status === 'active' ? 'online' : ''}`}>{user.status === 'active' ? 'Aktif' : 'Nonaktif'}</span></td><td><UserManagement slug={String(user.slug)} status={String(user.status)} role={String(user.role)} /></td></tr>)}</tbody></table></div></section>

      <section className="dashboard-grid admin-bottom"><section className="data-panel activity-panel" id="activity"><div className="section-heading"><div><span className="kicker">USER ACTIVITY</span><h2>Aktivitas terbaru</h2></div></div><div className="activity-list">{activity.map((item) => <div key={String(item.id)}><span className="activity-mark"/><strong>{String(item.name)}</strong><p>{String(item.detail)}</p><small>{new Date(String(item.created_at)).toLocaleString('id-ID')}</small></div>)}</div></section><section className="data-panel activity-panel"><div className="section-heading"><div><span className="kicker">ADMIN AUDIT</span><h2>Audit mutasi</h2></div></div>{audit.length === 0 ? <p className="empty-copy">Belum ada mutasi Admin.</p> : <div className="audit-list">{audit.map((item) => <div key={String(item.id)}><span>{String(item.action)}</span><strong>{String(item.target_name ?? '-')}</strong><p>{String(item.purpose ?? 'Tanpa keterangan')}</p><small>{String(item.correlation_id ?? '')}</small></div>)}</div>}</section></section>
      <section className="data-panel nib-admin-overview"><div className="section-heading"><div><span className="kicker">NIB & KBLI MONITORING</span><h2>Data legal penyedia</h2></div></div><div className="operations-grid">{nibOverview.map((item)=><article key={String(item.name)}><span className="health">OCR DATA</span><strong>{Number(item.kbli_count)} <small>KBLI</small></strong><p>{String(item.name)} · {Number(item.document_count)} dokumen NIB</p></article>)}</div></section>
      <OpenAIAccountCard user={chatGPTUser}/>
    </section>
  </main>;
}
