import { pgTable, text, serial, integer, bigint, boolean, timestamp, jsonb, varchar, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table for authentication
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull(), // 'master', 'client'
  name: text("name").notNull(),
  clientId: text("client_id"), // Link to client for client users
  createdAt: timestamp("created_at").defaultNow(),
});

// Corporate clients
export const clients = pgTable("clients", {
  id: text("id").primaryKey(),
  companyName: text("company_name").notNull(),
  cnpj: text("cnpj").notNull().unique(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull(),
  monthlyLimit: integer("monthly_limit").notNull().default(100),
  additionalLimit: integer("additional_limit").default(0),
  additionalLimitExpiry: timestamp("additional_limit_expiry"),
  contractStart: timestamp("contract_start").notNull(),
  contractEnd: timestamp("contract_end"),
  status: text("status").notNull().default("active"),
  responsibleName: text("responsible_name").notNull(),
  responsiblePhone: text("responsible_phone").notNull(),
  responsibleEmail: text("responsible_email").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Jobs/Vagas
export const jobs = pgTable("jobs", {
  id: text("id").primaryKey(),
  clientId: text("client_id").references(() => clients.id).notNull(),
  nomeVaga: text("nome_vaga").notNull(),
  descricaoVaga: text("descricao_vaga").notNull(),
  status: text("status").notNull().default("ativo"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Questions for interviews
export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  vagaId: text("vaga_id").references(() => jobs.id).notNull(),
  perguntaCandidato: text("pergunta_candidato").notNull(),
  respostaPerfeita: text("resposta_perfeita").notNull(),
  numeroPergunta: integer("numero_pergunta").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Candidate lists
export const candidateLists = pgTable("candidate_lists", {
  id: serial("id").primaryKey(),
  clientId: text("client_id").references(() => clients.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Candidates
export const candidates = pgTable("candidates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  whatsapp: text("whatsapp").notNull(),
  clientId: text("client_id").references(() => clients.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Candidate list memberships
export const candidateListMemberships = pgTable("candidate_list_memberships", {
  id: serial("id").primaryKey(),
  candidateId: integer("candidate_id").references(() => candidates.id).notNull(),
  listId: integer("list_id").references(() => candidateLists.id).notNull(),
  clientId: text("client_id").references(() => clients.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Selection processes
export const selections = pgTable("selections", {
  id: serial("id").primaryKey(),
  clientId: text("client_id").references(() => clients.id).notNull(),
  jobId: text("job_id").references(() => jobs.id).notNull(),
  candidateListId: integer("candidate_list_id").references(() => candidateLists.id),
  name: text("name").notNull(),
  whatsappTemplate: text("whatsapp_template").notNull(),
  emailTemplate: text("email_template").notNull(),
  emailSubject: text("email_subject").notNull(),
  sendVia: text("send_via").notNull(),
  scheduledFor: timestamp("scheduled_for"),
  deadline: timestamp("deadline").notNull(),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Interview instances
export const interviews = pgTable("interviews", {
  id: serial("id").primaryKey(),
  selectionId: integer("selection_id").references(() => selections.id).notNull(),
  candidateId: integer("candidate_id").references(() => candidates.id).notNull(),
  token: text("token").notNull().unique(),
  status: text("status").notNull().default("pending"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  totalScore: integer("total_score"),
  aiAnalysis: jsonb("ai_analysis"),
  category: text("category"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Individual question responses
export const responses = pgTable("responses", {
  id: serial("id").primaryKey(),
  interviewId: integer("interview_id").references(() => interviews.id).notNull(),
  questionId: integer("question_id").references(() => questions.id).notNull(),
  audioUrl: text("audio_url"),
  transcription: text("transcription"),
  score: integer("score"),
  aiAnalysis: jsonb("ai_analysis"),
  recordingDuration: integer("recording_duration"),
  createdAt: timestamp("created_at").defaultNow(),
});

// API configurations
export const apiConfigs = pgTable("api_configs", {
  id: serial("id").primaryKey(),
  entityType: text("entity_type").notNull(), // 'master' or 'client'
  entityId: text("entity_id").notNull(),
  openaiVoice: text("openai_voice"),
  whatsappQrConnected: boolean("whatsapp_qr_connected"),
  whatsappQrCode: text("whatsapp_qr_code"),
  whatsappQrPhoneNumber: text("whatsapp_qr_phone_number"),
  whatsappQrLastConnection: timestamp("whatsapp_qr_last_connection"),
  firebaseProjectId: text("firebase_project_id"),
  firebaseServiceAccount: jsonb("firebase_service_account"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Report Folders
export const reportFolders = pgTable("report_folders", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  clientId: text("client_id").notNull(),
  color: text("color").default("#3b82f6"),
  position: integer("position").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Report assignments to folders
export const reportFolderAssignments = pgTable("report_folder_assignments", {
  id: text("id").primaryKey(),
  reportId: text("report_id").notNull(),
  folderId: text("folder_id").references(() => reportFolders.id).notNull(),
  clientId: text("client_id").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});

// Session storage table for authentication
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ 
  id: true, 
  createdAt: true 
});

export const insertClientSchema = createInsertSchema(clients).omit({ 
  id: true, 
  createdAt: true 
});

export const insertJobSchema = createInsertSchema(jobs).omit({ 
  id: true, 
  createdAt: true 
});

export const insertQuestionSchema = createInsertSchema(questions).omit({ 
  id: true, 
  createdAt: true 
});

export const insertCandidateSchema = createInsertSchema(candidates).omit({ 
  id: true, 
  createdAt: true 
});

export const insertCandidateListSchema = createInsertSchema(candidateLists).omit({ 
  id: true, 
  createdAt: true 
});

export const insertSelectionSchema = createInsertSchema(selections).omit({ 
  id: true, 
  createdAt: true 
});

export const insertInterviewSchema = createInsertSchema(interviews).omit({ 
  id: true, 
  createdAt: true 
});

export const insertResponseSchema = createInsertSchema(responses).omit({ 
  id: true, 
  createdAt: true 
});

export const insertApiConfigSchema = createInsertSchema(apiConfigs).omit({ 
  id: true, 
  updatedAt: true 
});

export const insertReportFolderSchema = createInsertSchema(reportFolders).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export const insertReportFolderAssignmentSchema = createInsertSchema(reportFolderAssignments).omit({ 
  id: true, 
  createdAt: true 
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;

export type Job = typeof jobs.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;

export type Question = typeof questions.$inferSelect;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;

export type Candidate = typeof candidates.$inferSelect;
export type InsertCandidate = z.infer<typeof insertCandidateSchema>;

export type CandidateList = typeof candidateLists.$inferSelect;
export type InsertCandidateList = z.infer<typeof insertCandidateListSchema>;

export type Selection = typeof selections.$inferSelect;
export type InsertSelection = z.infer<typeof insertSelectionSchema>;

export type Interview = typeof interviews.$inferSelect;
export type InsertInterview = z.infer<typeof insertInterviewSchema>;

export type Response = typeof responses.$inferSelect;
export type InsertResponse = z.infer<typeof insertResponseSchema>;

export type ApiConfig = typeof apiConfigs.$inferSelect;
export type InsertApiConfig = z.infer<typeof insertApiConfigSchema>;

export type ReportFolder = typeof reportFolders.$inferSelect;
export type InsertReportFolder = z.infer<typeof insertReportFolderSchema>;

export type ReportFolderAssignment = typeof reportFolderAssignments.$inferSelect;
export type InsertReportFolderAssignment = z.infer<typeof insertReportFolderAssignmentSchema>;