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
  phone: text("phone"),
  monthlyLimit: integer("monthly_limit").notNull().default(100),
  extraCredits: integer("extra_credits").default(0),
  creditsValidUntil: timestamp("credits_valid_until"),
  contractStart: timestamp("contract_start"),
  contractEnd: timestamp("contract_end"),
  status: text("status").notNull().default("active"), // 'active', 'inactive', 'suspended'
  createdAt: timestamp("created_at").defaultNow(),
});

// Job positions
export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("active"), // 'active', 'inactive'
  createdAt: timestamp("created_at").defaultNow(),
});

// Interview questions for each job
export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").references(() => jobs.id).notNull(),
  questionText: text("question_text").notNull(),
  idealAnswer: text("ideal_answer").notNull(),
  maxTime: integer("max_time").notNull().default(180), // seconds
  order: integer("order").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Candidates
export const candidates = pgTable("candidates", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  whatsapp: text("whatsapp").notNull(),
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
export const insertJobSchema = createInsertSchema(jobs).omit({ id: true, createdAt: true });
export const insertQuestionSchema = createInsertSchema(questions).omit({ id: true, createdAt: true });
export const insertCandidateSchema = createInsertSchema(candidates).omit({ id: true, createdAt: true });
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
