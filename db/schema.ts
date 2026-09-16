import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  role: text('role', { enum: ['admin', 'user'] }).notNull(),
  status: text('status', { enum: ['active', 'inactive'] }).notNull().default('active'),
  username: text('username'),
  passwordHash: text('password_hash'),
  passwordSalt: text('password_salt'),
  passwordUpdatedAt: text('password_updated_at'),
  failedLoginCount: integer('failed_login_count').notNull().default(0),
  lockedUntil: text('locked_until'),
  headline: text('headline').notNull().default(''),
  location: text('location').notNull().default('Indonesia'),
  profileCompletion: integer('profile_completion').notNull().default(0),
  lastLoginAt: text('last_login_at'),
  createdAt: text('created_at').notNull(),
}, (table) => [
  uniqueIndex('idx_users_slug').on(table.slug),
  uniqueIndex('idx_users_email').on(table.email),
  uniqueIndex('idx_users_username').on(table.username),
  index('idx_users_role_status').on(table.role, table.status),
]);

export const applications = sqliteTable('applications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  company: text('company').notNull(),
  roleTitle: text('role_title').notNull(),
  stage: text('stage').notNull(),
  matchScore: integer('match_score').notNull(),
  nextAction: text('next_action'),
  nextActionAt: text('next_action_at'),
  source: text('source').notNull().default('AI Recommendation'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  index('idx_applications_user_updated').on(table.userId, table.updatedAt),
  index('idx_applications_user_stage').on(table.userId, table.stage),
]);

export const recommendations = sqliteTable('recommendations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  company: text('company').notNull(),
  roleTitle: text('role_title').notNull(),
  location: text('location').notNull(),
  workMode: text('work_mode').notNull(),
  matchScore: integer('match_score').notNull(),
  salaryRange: text('salary_range').notNull(),
  skills: text('skills').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => [index('idx_recommendations_user_match').on(table.userId, table.matchScore)]);

export const procurementOpportunities = sqliteTable('procurement_opportunities', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  source: text('source').notNull(),
  sourceUrl: text('source_url').notNull(),
  procurementType: text('procurement_type', { enum: ['Tender', 'Pengadaan Langsung'] }).notNull(),
  tenderCode: text('tender_code').notNull(),
  title: text('title').notNull(),
  lpse: text('lpse').notNull(),
  workUnit: text('work_unit').notNull(),
  region: text('region').notNull(),
  category: text('category').notNull(),
  hpsValue: integer('hps_value').notNull(),
  hpsDisplay: text('hps_display').notNull(),
  scheduleStatus: text('schedule_status').notNull(),
  startAt: text('start_at'),
  endAt: text('end_at'),
  projectLocation: text('project_location').notNull(),
  sourceLastSeenAt: text('source_last_seen_at').notNull(),
  fingerprint: text('fingerprint').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => [
  uniqueIndex('idx_procurement_fingerprint').on(table.fingerprint),
  index('idx_procurement_type_status').on(table.procurementType, table.scheduleStatus),
  index('idx_procurement_end').on(table.endAt),
]);

export const procurementSources = sqliteTable('procurement_sources', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  label: text('label').notNull(),
  sourceUrl: text('source_url').notNull(),
  status: text('status', { enum: ['active', 'inactive'] }).notNull().default('active'),
  createdByAdminId: integer('created_by_admin_id').notNull().references(() => users.id),
  lastTriggeredAt: text('last_triggered_at'),
  deletedAt: text('deleted_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  uniqueIndex('idx_procurement_sources_url').on(table.sourceUrl),
  index('idx_procurement_sources_status_updated').on(table.status, table.updatedAt),
]);

export const procurementSearchRuns = sqliteTable('procurement_search_runs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  sourceId: integer('source_id').notNull().references(() => procurementSources.id),
  status: text('status', { enum: ['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED'] }).notNull().default('QUEUED'),
  resultCount: integer('result_count').notNull().default(0),
  correlationId: text('correlation_id').notNull(),
  errorMessage: text('error_message'),
  triggeredAt: text('triggered_at').notNull(),
  completedAt: text('completed_at'),
}, (table) => [
  uniqueIndex('idx_procurement_search_runs_correlation').on(table.correlationId),
  index('idx_procurement_search_runs_user_triggered').on(table.userId, table.triggeredAt),
  index('idx_procurement_search_runs_status_triggered').on(table.status, table.triggeredAt),
]);

export const opportunityMatches = sqliteTable('opportunity_matches', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  opportunityId: integer('opportunity_id').notNull().references(() => procurementOpportunities.id),
  matchScore: integer('match_score').notNull(),
  confidence: integer('confidence').notNull(),
  reasons: text('reasons').notNull(),
  riskFlags: text('risk_flags').notNull().default('[]'),
  decision: text('decision', { enum: ['GO', 'NO_GO', 'REVIEW'] }).notNull().default('REVIEW'),
  rating: integer('rating').notNull().default(0),
  createdAt: text('created_at').notNull(),
}, (table) => [
  uniqueIndex('idx_opportunity_matches_user_opportunity').on(table.userId, table.opportunityId),
  index('idx_opportunity_matches_user_score').on(table.userId, table.matchScore),
]);

export const opportunityNotifications = sqliteTable('opportunity_notifications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  opportunityId: integer('opportunity_id').notNull().references(() => procurementOpportunities.id),
  isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
}, (table) => [
  uniqueIndex('idx_notifications_user_opportunity').on(table.userId, table.opportunityId),
  index('idx_notifications_user_read_created').on(table.userId, table.isRead, table.createdAt),
]);

export const nibDocuments = sqliteTable('nib_documents', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  objectKey: text('object_key').notNull(),
  originalFilename: text('original_filename').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  ocrText: text('ocr_text').notNull(),
  nibNumber: text('nib_number'),
  status: text('status').notNull(),
  extractedAt: text('extracted_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  uniqueIndex('idx_nib_documents_object_key').on(table.objectKey),
  index('idx_nib_documents_user_created').on(table.userId, table.createdAt),
]);

export const userKbli = sqliteTable('user_kbli', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  nibDocumentId: integer('nib_document_id').notNull().references(() => nibDocuments.id),
  kbliCode: text('kbli_code').notNull(),
  kbliTitle: text('kbli_title').notNull().default(''),
  confidence: integer('confidence').notNull().default(0),
  createdAt: text('created_at').notNull(),
}, (table) => [
  uniqueIndex('idx_user_kbli_document_code').on(table.nibDocumentId, table.kbliCode),
  index('idx_user_kbli_user_code').on(table.userId, table.kbliCode),
  uniqueIndex('idx_user_kbli_user_code_unique').on(table.userId, table.kbliCode),
]);

export const bidTracker = sqliteTable('bid_tracker', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  opportunityId: integer('opportunity_id').notNull().references(() => procurementOpportunities.id),
  stage: text('stage').notNull(),
  nextAction: text('next_action'),
  dueAt: text('due_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  uniqueIndex('idx_bid_tracker_user_opportunity').on(table.userId, table.opportunityId),
  index('idx_bid_tracker_user_stage').on(table.userId, table.stage),
  index('idx_bid_tracker_due').on(table.dueAt),
]);

export const activityEvents = sqliteTable('activity_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  eventType: text('event_type').notNull(),
  detail: text('detail').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => [index('idx_activity_created').on(table.createdAt)]);

export const openaiCredentials = sqliteTable('openai_credentials', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  maskedUsername: text('masked_username').notNull(),
  passwordSecretRef: text('password_secret_ref').notNull(),
  encryptedUsername: text('encrypted_username'),
  encryptedPassword: text('encrypted_password'),
  encryptionVersion: integer('encryption_version').notNull().default(1),
  connectionStatus: text('connection_status').notNull().default('connected'),
  verifiedAt: text('verified_at'),
  updatedAt: text('updated_at').notNull(),
}, (table) => [uniqueIndex('idx_openai_credentials_user').on(table.userId)]);

export const adminAccessLogs = sqliteTable('admin_access_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  adminUserId: integer('admin_user_id').notNull().references(() => users.id),
  action: text('action').notNull(),
  targetUserId: integer('target_user_id').references(() => users.id),
  purpose: text('purpose'),
  correlationId: text('correlation_id'),
  createdAt: text('created_at').notNull(),
}, (table) => [index('idx_admin_logs_created').on(table.createdAt)]);

export const monitoringSnapshots = sqliteTable('monitoring_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  metricKey: text('metric_key').notNull(),
  metricValue: text('metric_value').notNull(),
  unit: text('unit').notNull(),
  status: text('status', { enum: ['healthy', 'warning', 'critical'] }).notNull(),
  capturedAt: text('captured_at').notNull(),
}, (table) => [index('idx_monitoring_metric_captured').on(table.metricKey, table.capturedAt)]);

export const aiAgentRuns = sqliteTable('ai_agent_runs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  agentName: text('agent_name').notNull(),
  taskType: text('task_type').notNull(),
  status: text('status', { enum: ['QUEUED', 'PROCESSING', 'NEEDS_REVIEW', 'COMPLETED', 'FAILED'] }).notNull(),
  progress: integer('progress').notNull().default(0),
  model: text('model').notNull(),
  promptVersion: text('prompt_version').notNull(),
  tokenIn: integer('token_in').notNull().default(0),
  tokenOut: integer('token_out').notNull().default(0),
  estimatedCost: text('estimated_cost').notNull().default('0'),
  latencyMs: integer('latency_ms'),
  errorCode: text('error_code'),
  resultSummary: text('result_summary'),
  correlationId: text('correlation_id').notNull(),
  startedAt: text('started_at').notNull(),
  completedAt: text('completed_at'),
}, (table) => [
  uniqueIndex('idx_ai_agent_runs_correlation').on(table.correlationId),
  index('idx_ai_agent_runs_user_started').on(table.userId, table.startedAt),
  index('idx_ai_agent_runs_status_started').on(table.status, table.startedAt),
]);

export const userSessions = sqliteTable('user_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  tokenHash: text('token_hash').notNull(),
  userAgent: text('user_agent'),
  createdAt: text('created_at').notNull(),
  lastSeenAt: text('last_seen_at').notNull(),
  expiresAt: text('expires_at').notNull(),
  revokedAt: text('revoked_at'),
}, (table) => [
  uniqueIndex('idx_user_sessions_token').on(table.tokenHash),
  index('idx_user_sessions_user_expires').on(table.userId, table.expiresAt),
]);
