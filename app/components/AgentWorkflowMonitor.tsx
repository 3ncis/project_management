'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Background, Controls, MarkerType, MiniMap, Position, ReactFlow,
  type Edge, type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

type Run = Record<string, string | number | null>;
type Step = Record<string, string | number | null>;
type NodeStatus = 'waiting' | 'running' | 'success' | 'review' | 'error';
type FlowData = {
  label: string;
  subtitle: string;
  status: NodeStatus;
  icon: string;
  run?: Run;
  step?: Step;
};

function normalizeStatus(value: unknown): NodeStatus {
  const status = String(value ?? '').toUpperCase();
  if (status === 'FAILED' || status === 'ERROR') return 'error';
  if (status === 'NEEDS_REVIEW' || status === 'REVIEW') return 'review';
  if (status === 'PROCESSING' || status === 'QUEUED' || status === 'RUNNING') return 'running';
  if (status === 'COMPLETED' || status === 'SUCCESS') return 'success';
  return 'waiting';
}

function statusLabel(status: NodeStatus) {
  return { waiting: 'WAITING', running: 'RUNNING', success: 'SUCCESS', review: 'REVIEW', error: 'ERROR' }[status];
}

function nodeLabel(data: FlowData) {
  return <div className="automation-node-inner">
    <div className="automation-icon">{data.icon}</div>
    <div className="automation-copy"><strong>{data.label}</strong><small>{data.subtitle}</small></div>
    <span className={`automation-state ${data.status}`}>{statusLabel(data.status)}</span>
  </div>;
}

const blueprint = [
  ['trigger', 'Trigger', 'Manual / schedule / API', '▶', 20, 260],
  ['orchestrator', 'AI Orchestrator', 'Route task & context', 'AI', 260, 260],
  ['source', 'SPSE Discovery', 'Scan rotating INAPROC batch', '◎', 520, 110],
  ['nib', 'NIB / KBLI Reader', 'Provider capability profile', 'N', 520, 410],
  ['parser', 'Tender Parser', 'Normalize official package data', '{}', 780, 110],
  ['match', 'Matching Agent', 'Exact KBLI & active schedule', 'M', 780, 410],
] as const;

const edgePairs = [
  ['trigger','orchestrator'],
  ['orchestrator','source'],
  ['orchestrator','nib'],
  ['source','parser'],
  ['parser','match'],
  ['nib','match'],
  ['match','decision'],
  ['decision','tracker'],
  ['tracker','notify'],
] as const;

export function AgentWorkflowMonitor({ runs, view }: { runs: Run[]; view?: string }) {
  const [liveRuns, setLiveRuns] = useState<Run[]>(runs);
  const [steps, setSteps] = useState<Step[]>([]);
  const [selectedRun, setSelectedRun] = useState<Run | null>(runs[0] ?? null);
  const [selectedStep, setSelectedStep] = useState<Step | null>(null);
  const [connection, setConnection] = useState<'connecting'|'live'|'offline'>('connecting');
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);

  useEffect(() => {
    const stream = new EventSource(
      view 
      ? `/api/admin/ai-agent-stream?view=${
        encodeURIComponent(view)}` 
      : '/api/admin/ai-agent-stream');
    stream.onopen = () => setConnection('live');
    stream.onerror = () => setConnection('connecting');
    const onSnapshot = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as { runs?: Run[]; steps?: Step[]; serverTime?: string };
        if (payload.runs) {
          setLiveRuns(payload.runs);
          setSelectedRun((current) => {
            if (!current) return payload.runs?.[0] ?? null;
            return payload.runs?.find((item) => item.id === current.id) ?? current;
          });
        }
        if (payload.steps) setSteps(payload.steps);
        setLastEventAt(payload.serverTime ?? new Date().toISOString());
        setConnection('live');
      } catch {
        setConnection('offline');
      }
    };
    stream.addEventListener('snapshot', onSnapshot as EventListener);
    return () => {
      stream.removeEventListener('snapshot', onSnapshot as EventListener);
      stream.close();
      setConnection('offline');
    };
  }, [view]);

  const aggregate = liveRuns[0];
  const activeCorrelation = String(aggregate?.correlation_id ?? '');
  const activeSteps = useMemo(() => steps.filter((step) => String(step.correlation_id) === activeCorrelation), [steps, activeCorrelation]);
  const stepByKey = useMemo(() => new Map(activeSteps.map((step) => [String(step.node_key), step])), [activeSteps]);
  const flowNodes = useMemo<Node[]>(() => {
    const base = blueprint.map(([id, label, subtitle, icon, x, y]) => {
      const step = stepByKey.get(id);
      const status = step ? normalizeStatus(step.status) : 'waiting' as NodeStatus;
      const raw: FlowData = { label, subtitle, icon, run: aggregate, step, status };
      return {
        id, position: { x, y }, className: `automation-flow-node ${status}`,
        sourcePosition: Position.Right, targetPosition: Position.Left,
        style: { width: 205, minHeight: 82, padding: 0, background: '#202733', border: '1px solid #3d4b61', borderRadius: 7, color: '#eaf0f8' },
        data: { label: nodeLabel(raw), raw },
      };
    });
    const special = (id: string, label: string, subtitle: string, icon: string, x: number, y: number) => {
      const step = stepByKey.get(id);
      const status = step ? normalizeStatus(step.status) : 'waiting' as NodeStatus;
      const raw = { label, subtitle, icon, run:aggregate, step, status };
      return {
        id, position:{x,y}, className:`automation-flow-node ${status}`,
        sourcePosition:Position.Right, targetPosition:Position.Left,
        style:{ width:205, minHeight:82, padding:0, background:'#202733', border:'1px solid #3d4b61', borderRadius:7, color:'#eaf0f8' },
        data:{label:nodeLabel(raw), raw}
      };
    };
    return [
      ...base,
      special('decision','Decision Engine','GO for exact KBLI matches','◆',1040,260),
      special('tracker','Opportunity Tracker','Persist matched package','▣',1300,260),
      special('notify','Notification','Dashboard alert / follow-up','●',1560,260),
    ];
  }, [aggregate, stepByKey]);

  const statusMap = useMemo(() => new Map(flowNodes.map((node) => [node.id, (node.data.raw as FlowData).status])), [flowNodes]);
  const flowEdges = useMemo<Edge[]>(() => edgePairs.map(([source,target]) => {
    const sourceStatus = statusMap.get(source) ?? 'waiting';
    const targetStatus = statusMap.get(target) ?? 'waiting';
    const visualStatus = targetStatus !== 'waiting' ? targetStatus : sourceStatus;
    return {
      id:`e-${source}-${target}`, source, target,
      animated: sourceStatus === 'running' || targetStatus === 'running',
      markerEnd:{type:MarkerType.ArrowClosed},
      className:`automation-edge edge-${visualStatus}`,
    };
  }), [statusMap]);

  const active = liveRuns.filter((run) => ['PROCESSING', 'QUEUED'].includes(String(run.status))).length;
  const failed = liveRuns.filter((run) => String(run.status) === 'FAILED').length;
  const review = liveRuns.filter((run) => String(run.status) === 'NEEDS_REVIEW').length;

  const inspectNode = (node: Node) => {
    const raw = (node.data as { raw?: FlowData }).raw;
    setSelectedRun(raw?.run ?? null);
    setSelectedStep(raw?.step ?? null);
  };

  return <section className="data-panel workflow-monitor automation-monitor" id="ai-workflow">
    <div className="section-heading workflow-heading">
      <div>
        <span className="kicker">LIVE AUTOMATION CANVAS</span>
        <h2>AI Agent Workflow</h2>
        <p>Live stream tanpa reload halaman. Status node berubah otomatis ketika proses backend berpindah tahap.</p>
      </div>
      <div className="workflow-actions">
        <span className={`live-stream-badge ${connection}`}>● {connection === 'live' ? 'LIVE SSE' : connection === 'connecting' ? 'RECONNECTING' : 'OFFLINE'}</span>
        <span className="live-badge">● {active} running</span>
        {lastEventAt && <span className="stream-time">{new Date(lastEventAt).toLocaleTimeString('id-ID')}</span>}
      </div>
    </div>

    <div className="workflow-summary">
      <article><small>Running</small><strong>{active}</strong></article>
      <article><small>Needs review</small><strong>{review}</strong></article>
      <article className={failed ? 'danger' : ''}><small>Failed</small><strong>{failed}</strong></article>
      <article><small>Visible runs</small><strong>{liveRuns.length}</strong></article>
    </div>

    <div className="automation-canvas">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.35}
        maxZoom={1.8}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        onNodeClick={(_, node) => inspectNode(node)}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={22} size={1} />
        <MiniMap pannable zoomable nodeStrokeWidth={2} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>

    <div className="workflow-lower-grid">
      <div className="workflow-runs">
        <div className="mini-heading"><div><span className="kicker">RECENT EXECUTIONS</span><h3>Execution log</h3></div><span>{liveRuns.length} run</span></div>
        <div className="workflow-run-list">
          {liveRuns.length === 0 ? <p className="empty-copy">Belum ada eksekusi Agen AI.</p> : liveRuns.slice(0,12).map((run) => <button type="button" key={String(run.id)} className={selectedRun?.id === run.id ? 'selected' : ''} onClick={() => { setSelectedRun(run); setSelectedStep(null); }}>
            <span className={`run-dot ${normalizeStatus(run.status)}`} />
            <span><strong>{String(run.agent_name ?? 'AI Agent')}</strong><small>{String(run.task_type ?? 'Task')}</small></span>
            <span className="run-meta"><b>{String(run.status).replaceAll('_',' ')}</b><small>{Number(run.progress ?? 0)}%</small></span>
          </button>)}
        </div>
      </div>

      <aside className="run-inspector">
        {selectedStep ? <>
          <div className="mini-heading"><div><span className="kicker">NODE DETAIL</span><h3>{String(selectedStep.node_label ?? selectedStep.node_key)}</h3></div><span className={`agent-status ${normalizeStatus(selectedStep.status)}`}>{String(selectedStep.status)}</span></div>
          <dl className="run-detail-grid">
            <div><dt>Progress</dt><dd>{Number(selectedStep.progress ?? 0)}%</dd></div>
            <div><dt>Duration</dt><dd>{selectedStep.duration_ms ? `${Number(selectedStep.duration_ms).toLocaleString('id-ID')} ms` : '—'}</dd></div>
            <div><dt>Started</dt><dd>{selectedStep.started_at ? new Date(String(selectedStep.started_at)).toLocaleTimeString('id-ID') : '—'}</dd></div>
            <div><dt>Updated</dt><dd>{selectedStep.updated_at ? new Date(String(selectedStep.updated_at)).toLocaleTimeString('id-ID') : '—'}</dd></div>
          </dl>
          <div className="inspector-block"><small>Live state</small><p>{String(selectedStep.detail ?? 'Belum ada detail dari node ini.')}</p></div>
          <div className="progress-line inspector-progress"><i style={{ width: `${Number(selectedStep.progress ?? 0)}%` }} /></div>
        </> : !selectedRun ? <p className="empty-copy">Klik node atau run untuk melihat detail.</p> : <>
          <div className="mini-heading"><div><span className="kicker">RUN DETAIL</span><h3>{String(selectedRun.agent_name ?? 'AI Agent')}</h3></div><span className={`agent-status ${String(selectedRun.status).toLowerCase()}`}>{String(selectedRun.status).replaceAll('_',' ')}</span></div>
          <dl className="run-detail-grid">
            <div><dt>Task</dt><dd>{String(selectedRun.task_type ?? '—')}</dd></div>
            <div><dt>Progress</dt><dd>{Number(selectedRun.progress ?? 0)}%</dd></div>
            <div><dt>Model</dt><dd>{String(selectedRun.model ?? '—')}</dd></div>
            <div><dt>Latency</dt><dd>{selectedRun.latency_ms ? `${Number(selectedRun.latency_ms).toLocaleString('id-ID')} ms` : '—'}</dd></div>
            <div><dt>Tokens</dt><dd>{Number(selectedRun.token_in ?? 0) + Number(selectedRun.token_out ?? 0)}</dd></div>
            <div><dt>Cost</dt><dd>${Number(selectedRun.estimated_cost ?? 0).toFixed(4)}</dd></div>
          </dl>
          <div className="inspector-block"><small>Result / state</small><p>{String(selectedRun.result_summary ?? 'Belum ada hasil dari run ini.')}</p></div>
          {selectedRun.error_code && <div className="inspector-block error"><small>Error</small><p>{String(selectedRun.error_code)}</p></div>}
          <div className="inspector-block mono"><small>Correlation ID</small><p>{String(selectedRun.correlation_id ?? '—')}</p></div>
        </>}
      </aside>
    </div>
  </section>;
}
