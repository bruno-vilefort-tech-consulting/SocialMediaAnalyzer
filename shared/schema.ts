import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table for authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull(), // 'master', 'client', 'candidate'
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Corporate clients
export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull(),
  cnpj: text("cnpj").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  phone: text("phone").notNull(),
  monthlyLimit: integer("monthly_limit").notNull().default(100),
  additionalLimit: integer("additional_limit").default(0),
  additionalLimitExpiry: timestamp("additional_limit_expiry"),
  contractStart: timestamp("contract_start").notNull(),
  contractEnd: timestamp("contract_end"),
  status: text("status").notNull().default("active"), // 'active', 'inactive'
  responsibleName: text("responsible_name").notNull(),
  responsiblePhone: text("responsible_phone").notNull(),
  responsibleEmail: text("responsible_email").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Vagas de emprego (presets para entrevistas)
export const jobs = pgTable("vagas_preset", {
  id: text("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  nomeVaga: text("nome_vaga").notNull(), // Nome da vaga
  descricaoVaga: text("descricao_vaga").notNull(), // Descrição para uso interno
  status: text("status").notNull().default("ativo"), // 'ativo', 'inativo'
  createdAt: timestamp("created_at").defaultNow(),
});

// Perguntas da entrevista para cada vaga
export const questions = pgTable("perguntas_entrevista", {
  id: serial("id").primaryKey(),
  vagaId: text("vaga_id").references(() => jobs.id).notNull(),
  perguntaCandidato: text("pergunta_candidato").notNull(), // Pergunta ao candidato (max 100 caracteres)
  respostaPerfeita: text("resposta_perfeita").notNull(), // Resposta perfeita (max 1000 caracteres)
  numeroPergunta: integer("numero_pergunta").notNull(), // Número da pergunta (1-10)
  createdAt: timestamp("created_at").defaultNow(),
});

// Candidate lists
export const candidateLists = pgTable("candidate_lists", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Candidates
export const candidates = pgTable("candidates", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  listId: integer("list_id").references(() => candidateLists.id).notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Selection processes
export const selections = pgTable("selections", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  jobId: integer("job_id").references(() => jobs.id).notNull(),
  name: text("name").notNull(),
  whatsappTemplate: text("whatsapp_template").notNull(),
  emailTemplate: text("email_template").notNull(),
  emailSubject: text("email_subject").notNull(),
  sendVia: text("send_via").notNull(), // 'whatsapp', 'email', 'both'
  scheduledFor: timestamp("scheduled_for"),
  deadline: timestamp("deadline").notNull(),
  status: text("status").notNull().default("draft"), // 'draft', 'active', 'completed'
  createdAt: timestamp("created_at").defaultNow(),
});

// Interview instances
export const interviews = pgTable("interviews", {
  id: serial("id").primaryKey(),
  selectionId: integer("selection_id").references(() => selections.id).notNull(),
  candidateId: integer("candidate_id").references(() => candidates.id).notNull(),
  token: text("token").notNull().unique(),
  status: text("status").notNull().default("pending"), // 'pending', 'started', 'completed', 'expired'
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  totalScore: integer("total_score"),
  aiAnalysis: jsonb("ai_analysis"),
  category: text("category"), // 'high', 'medium', 'low'
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
  recordingDuration: integer("recording_duration"), // seconds
  createdAt: timestamp("created_at").defaultNow(),
});

// API configurations
export const apiConfigs = pgTable("api_configs", {
  id: serial("id").primaryKey(),
  openaiApiKey: text("openai_api_key"),
  openaiModel: text("openai_model").default("tts-1"),
  openaiVoice: text("openai_voice").default("nova"),
  firebaseProjectId: text("firebase_project_id"),
  firebaseServiceAccount: jsonb("firebase_service_account"),
  whatsappToken: text("whatsapp_token"),
  whatsappPhoneId: text("whatsapp_phone_id"),
  globalMonthlyLimit: integer("global_monthly_limit").default(10000),
  maxInterviewTime: integer("max_interview_time").default(1800), // seconds
  maxFileSize: integer("max_file_size").default(52428800), // bytes (50MB)
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Message logs
export const messageLogs = pgTable("message_logs", {
  id: serial("id").primaryKey(),
  interviewId: integer("interview_id").references(() => interviews.id).notNull(),
  type: text("type").notNull(), // 'invitation', 'reminder', 'confirmation'
  channel: text("channel").notNull(), // 'whatsapp', 'email'
  status: text("status").notNull(), // 'sent', 'failed', 'delivered'
  sentAt: timestamp("sent_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertClientSchema = createInsertSchema(clients).omit({ id: true, createdAt: true });
export const insertJobSchema = z.object({
  nomeVaga: z.string().min(1, "Nome da vaga é obrigatório").max(100, "Nome deve ter no máximo 100 caracteres"),
  descricaoVaga: z.string().max(500, "Descrição deve ter no máximo 500 caracteres").optional(),
  clientId: z.number().int().positive(),
  status: z.enum(['ativo', 'inativo', 'pausado']).default('ativo'),
});
export const insertQuestionSchema = z.object({
  vagaId: z.union([z.string(), z.number()]).transform(val => String(val)),
  perguntaCandidato: z.string().min(1, "Pergunta é obrigatória").max(100, "Máximo 100 caracteres"),
  respostaPerfeita: z.string().min(1, "Resposta perfeita é obrigatória").max(1000, "Máximo 1000 caracteres"),
  numeroPergunta: z.number().min(1).max(10),
});
export const insertCandidateListSchema = createInsertSchema(candidateLists).omit({ id: true, createdAt: true });
export const insertCandidateSchema = createInsertSchema(candidates).omit({ id: true, createdAt: true }).extend({
  email: z.string().email("Email inválido"),
  phone: z.string().regex(/^[1-9]{2}[0-9]{8,9}$/, "Celular deve estar no formato brasileiro (ex: 11987654321)")
});
export const insertSelectionSchema = createInsertSchema(selections).omit({ id: true, createdAt: true });
export const insertInterviewSchema = createInsertSchema(interviews).omit({ id: true, createdAt: true });
export const insertResponseSchema = createInsertSchema(responses).omit({ id: true, createdAt: true });
export const insertApiConfigSchema = createInsertSchema(apiConfigs).omit({ id: true, updatedAt: true });
export const insertMessageLogSchema = createInsertSchema(messageLogs).omit({ id: true, sentAt: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Job = typeof jobs.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Question = typeof questions.$inferSelect;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type CandidateList = typeof candidateLists.$inferSelect;
export type InsertCandidateList = z.infer<typeof insertCandidateListSchema>;
export type Candidate = typeof candidates.$inferSelect;
export type InsertCandidate = z.infer<typeof insertCandidateSchema>;
export type Selection = typeof selections.$inferSelect;
export type InsertSelection = z.infer<typeof insertSelectionSchema>;
export type Interview = typeof interviews.$inferSelect;
export type InsertInterview = z.infer<typeof insertInterviewSchema>;
export type Response = typeof responses.$inferSelect;
export type InsertResponse = z.infer<typeof insertResponseSchema>;
export type ApiConfig = typeof apiConfigs.$inferSelect;
export type InsertApiConfig = z.infer<typeof insertApiConfigSchema>;
export type MessageLog = typeof messageLogs.$inferSelect;
export type InsertMessageLog = z.infer<typeof insertMessageLogSchema>;