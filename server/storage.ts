import { db as pgDb } from "./db";
import { eq, and } from "drizzle-orm";
import {
  users, clients, jobs, questions, candidates, selections, interviews, responses, 
  apiConfigs, messageLogs, candidateLists,
  type User, type InsertUser, type Client, type InsertClient,
  type Job, type InsertJob, type Question, type InsertQuestion,
  type Candidate, type InsertCandidate, type Selection, type InsertSelection,
  type Interview, type InsertInterview, type Response, type InsertResponse,
  type ApiConfig, type InsertApiConfig, type MessageLog, type InsertMessageLog,
  type CandidateList, type InsertCandidateList
} from "@shared/schema";

export interface IStorage {
  // Users
  getUserById(id: string | number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Clients
  getClients(): Promise<Client[]>;
  getClientById(id: number): Promise<Client | undefined>;
  getClientByEmail(email: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: number, client: Partial<Client>): Promise<Client>;
  deleteClient(id: number): Promise<void>;

  // Jobs
  getJobsByClientId(clientId: number): Promise<Job[]>;
  getJobById(id: number): Promise<Job | undefined>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: number, job: Partial<Job>): Promise<Job>;
  deleteJob(id: string | number): Promise<void>;

  // Questions
  getQuestionsByJobId(jobId: string | number): Promise<Question[]>;
  createQuestion(question: InsertQuestion): Promise<Question>;
  updateQuestion(id: number, question: Partial<Question>): Promise<Question>;
  deleteQuestion(id: number): Promise<void>;

  // Candidate Lists
  getCandidateListsByClientId(clientId: number): Promise<CandidateList[]>;
  getCandidateListById(id: number): Promise<CandidateList | undefined>;
  createCandidateList(list: InsertCandidateList): Promise<CandidateList>;
  updateCandidateList(id: number, list: Partial<CandidateList>): Promise<CandidateList>;
  deleteCandidateList(id: number): Promise<void>;

  // Candidates
  getCandidatesByClientId(clientId: number): Promise<Candidate[]>;
  getCandidatesByListId(listId: number): Promise<Candidate[]>;
  getCandidateById(id: number): Promise<Candidate | undefined>;
  createCandidate(candidate: InsertCandidate): Promise<Candidate>;
  createCandidates(candidates: InsertCandidate[]): Promise<Candidate[]>;
  updateCandidate(id: number, candidate: Partial<Candidate>): Promise<Candidate>;
  deleteCandidate(id: number): Promise<void>;

  // Selections
  getSelectionsByClientId(clientId: number): Promise<Selection[]>;
  getSelectionById(id: number): Promise<Selection | undefined>;
  createSelection(selection: InsertSelection): Promise<Selection>;
  updateSelection(id: number, selection: Partial<Selection>): Promise<Selection>;
  deleteSelection(id: number): Promise<void>;

  // Interviews
  getInterviewsBySelectionId(selectionId: number): Promise<Interview[]>;
  getInterviewById(id: number): Promise<Interview | undefined>;
  getInterviewByToken(token: string): Promise<Interview | undefined>;
  createInterview(interview: InsertInterview): Promise<Interview>;
  updateInterview(id: number, interview: Partial<Interview>): Promise<Interview>;

  // Responses
  getResponsesByInterviewId(interviewId: number): Promise<Response[]>;
  createResponse(response: InsertResponse): Promise<Response>;
  updateResponse(id: number, response: Partial<Response>): Promise<Response>;

  // API Config
  getApiConfig(): Promise<ApiConfig | undefined>;
  upsertApiConfig(config: InsertApiConfig): Promise<ApiConfig>;

  // Message Logs
  createMessageLog(log: InsertMessageLog): Promise<MessageLog>;
  getMessageLogsByInterviewId(interviewId: number): Promise<MessageLog[]>;

  // Global getters
  getAllCandidates(): Promise<Candidate[]>;
  getAllInterviews(): Promise<Interview[]>;
  getAllResponses(): Promise<Response[]>;
  getAllSelections(): Promise<Selection[]>;

  // Statistics
  getInterviewStats(): Promise<{
    totalClients: number;
    totalInterviews: number;
    pendingInterviews: number;
    avgScore: number;
  }>;

  getClientStats(clientId: number): Promise<{
    activeJobs: number;
    totalCandidates: number;
    monthlyInterviews: number;
    monthlyLimit: number;
    currentUsage: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  async getUserById(id: string | number): Promise<User | undefined> {
    try {
      const [user] = await pgDb.select().from(users).where(eq(users.id, String(id)));
      return user || undefined;
    } catch (error) {
      console.log('Error fetching user by ID:', error);
      return undefined;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const [user] = await pgDb.select().from(users).where(eq(users.email, email));
      return user || undefined;
    } catch (error) {
      console.log('Error fetching user by email:', error);
      return undefined;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = Date.now().toString();
    const [user] = await pgDb
      .insert(users)
      .values({ ...insertUser, id })
      .returning();
    return user;
  }

  async getClients(): Promise<Client[]> {
    return await pgDb.select().from(clients);
  }

  async getClientById(id: number): Promise<Client | undefined> {
    try {
      const numericId = typeof id === 'string' ? parseInt(id) : id;
      if (isNaN(numericId) || numericId < 1 || numericId > 2147483647) {
        return undefined;
      }
      const [client] = await pgDb.select().from(clients).where(eq(clients.id, numericId));
      return client || undefined;
    } catch (error) {
      console.log('Error fetching client by ID:', error);
      return undefined;
    }
  }

  async getClientByEmail(email: string): Promise<Client | undefined> {
    const [client] = await pgDb.select().from(clients).where(eq(clients.email, email));
    return client || undefined;
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const [client] = await pgDb
      .insert(clients)
      .values(insertClient)
      .returning();
    return client;
  }

  async updateClient(id: number, clientUpdate: Partial<Client>): Promise<Client> {
    const [client] = await pgDb
      .update(clients)
      .set(clientUpdate)
      .where(eq(clients.id, id))
      .returning();
    return client;
  }

  async deleteClient(id: number): Promise<void> {
    await pgDb.delete(clients).where(eq(clients.id, id));
  }

  async getJobsByClientId(clientId: number): Promise<Job[]> {
    return await pgDb.select().from(jobs).where(eq(jobs.clientId, clientId));
  }

  async getJobById(id: number): Promise<Job | undefined> {
    const [job] = await pgDb.select().from(jobs).where(eq(jobs.id, String(id)));
    return job || undefined;
  }

  async createJob(insertJob: InsertJob): Promise<Job> {
    const id = Date.now().toString();
    const [job] = await pgDb
      .insert(jobs)
      .values({ ...insertJob, id })
      .returning();
    return job;
  }

  async updateJob(id: number, jobUpdate: Partial<Job>): Promise<Job> {
    const [job] = await pgDb
      .update(jobs)
      .set(jobUpdate)
      .where(eq(jobs.id, String(id)))
      .returning();
    return job;
  }

  async deleteJob(id: string | number): Promise<void> {
    await pgDb.delete(jobs).where(eq(jobs.id, String(id)));
  }

  async getQuestionsByJobId(jobId: string | number): Promise<Question[]> {
    return await pgDb.select().from(questions).where(eq(questions.vagaId, String(jobId)));
  }

  async createQuestion(insertQuestion: InsertQuestion): Promise<Question> {
    const [question] = await pgDb
      .insert(questions)
      .values(insertQuestion)
      .returning();
    return question;
  }

  async updateQuestion(id: number, questionUpdate: Partial<Question>): Promise<Question> {
    const [question] = await pgDb
      .update(questions)
      .set(questionUpdate)
      .where(eq(questions.id, id))
      .returning();
    return question;
  }

  async deleteQuestion(id: number): Promise<void> {
    await pgDb.delete(questions).where(eq(questions.id, id));
  }

  async getCandidateListsByClientId(clientId: number): Promise<CandidateList[]> {
    return await pgDb.select().from(candidateLists).where(eq(candidateLists.clientId, clientId));
  }

  async getCandidateListById(id: number): Promise<CandidateList | undefined> {
    const [list] = await pgDb.select().from(candidateLists).where(eq(candidateLists.id, id));
    return list || undefined;
  }

  async createCandidateList(insertList: InsertCandidateList): Promise<CandidateList> {
    const [list] = await pgDb
      .insert(candidateLists)
      .values(insertList)
      .returning();
    return list;
  }

  async updateCandidateList(id: number, listUpdate: Partial<CandidateList>): Promise<CandidateList> {
    const [list] = await pgDb
      .update(candidateLists)
      .set(listUpdate)
      .where(eq(candidateLists.id, id))
      .returning();
    return list;
  }

  async deleteCandidateList(id: number): Promise<void> {
    await pgDb.delete(candidateLists).where(eq(candidateLists.id, id));
  }

  async getCandidatesByClientId(clientId: number): Promise<Candidate[]> {
    return await pgDb.select().from(candidates).where(eq(candidates.clientId, clientId));
  }

  async getCandidatesByListId(listId: number): Promise<Candidate[]> {
    return await pgDb.select().from(candidates).where(eq(candidates.listId, listId));
  }

  async getCandidateById(id: number): Promise<Candidate | undefined> {
    const [candidate] = await pgDb.select().from(candidates).where(eq(candidates.id, id));
    return candidate || undefined;
  }

  async createCandidate(insertCandidate: InsertCandidate): Promise<Candidate> {
    const [candidate] = await pgDb
      .insert(candidates)
      .values(insertCandidate)
      .returning();
    return candidate;
  }

  async createCandidates(insertCandidates: InsertCandidate[]): Promise<Candidate[]> {
    const candidates_result = await pgDb
      .insert(candidates)
      .values(insertCandidates)
      .returning();
    return candidates_result;
  }

  async updateCandidate(id: number, candidateUpdate: Partial<Candidate>): Promise<Candidate> {
    const [candidate] = await pgDb
      .update(candidates)
      .set(candidateUpdate)
      .where(eq(candidates.id, id))
      .returning();
    return candidate;
  }

  async deleteCandidate(id: number): Promise<void> {
    await pgDb.delete(candidates).where(eq(candidates.id, id));
  }

  async getSelectionsByClientId(clientId: number): Promise<Selection[]> {
    return await pgDb.select().from(selections).where(eq(selections.clientId, clientId));
  }

  async getSelectionById(id: number): Promise<Selection | undefined> {
    const [selection] = await pgDb.select().from(selections).where(eq(selections.id, id));
    return selection || undefined;
  }

  async createSelection(insertSelection: InsertSelection): Promise<Selection> {
    const [selection] = await pgDb
      .insert(selections)
      .values(insertSelection)
      .returning();
    return selection;
  }

  async updateSelection(id: number, selectionUpdate: Partial<Selection>): Promise<Selection> {
    const [selection] = await pgDb
      .update(selections)
      .set(selectionUpdate)
      .where(eq(selections.id, id))
      .returning();
    return selection;
  }

  async deleteSelection(id: number): Promise<void> {
    await pgDb.delete(selections).where(eq(selections.id, id));
  }

  async getInterviewsBySelectionId(selectionId: number): Promise<Interview[]> {
    return await pgDb.select().from(interviews).where(eq(interviews.selectionId, selectionId));
  }

  async getInterviewById(id: number): Promise<Interview | undefined> {
    const [interview] = await pgDb.select().from(interviews).where(eq(interviews.id, id));
    return interview || undefined;
  }

  async getInterviewByToken(token: string): Promise<Interview | undefined> {
    const [interview] = await pgDb.select().from(interviews).where(eq(interviews.token, token));
    return interview || undefined;
  }

  async createInterview(insertInterview: InsertInterview): Promise<Interview> {
    const [interview] = await pgDb
      .insert(interviews)
      .values(insertInterview)
      .returning();
    return interview;
  }

  async updateInterview(id: number, interviewUpdate: Partial<Interview>): Promise<Interview> {
    const [interview] = await pgDb
      .update(interviews)
      .set(interviewUpdate)
      .where(eq(interviews.id, id))
      .returning();
    return interview;
  }

  async getResponsesByInterviewId(interviewId: number): Promise<Response[]> {
    return await pgDb.select().from(responses).where(eq(responses.interviewId, interviewId));
  }

  async createResponse(insertResponse: InsertResponse): Promise<Response> {
    const [response] = await pgDb
      .insert(responses)
      .values(insertResponse)
      .returning();
    return response;
  }

  async updateResponse(id: number, responseUpdate: Partial<Response>): Promise<Response> {
    const [response] = await pgDb
      .update(responses)
      .set(responseUpdate)
      .where(eq(responses.id, id))
      .returning();
    return response;
  }

  async getApiConfig(): Promise<ApiConfig | undefined> {
    const [config] = await pgDb.select().from(apiConfigs).limit(1);
    return config || undefined;
  }

  async upsertApiConfig(config: InsertApiConfig): Promise<ApiConfig> {
    const existing = await this.getApiConfig();
    if (existing) {
      const [updated] = await pgDb
        .update(apiConfigs)
        .set(config)
        .where(eq(apiConfigs.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await pgDb
        .insert(apiConfigs)
        .values(config)
        .returning();
      return created;
    }
  }

  async createMessageLog(insertLog: InsertMessageLog): Promise<MessageLog> {
    const [log] = await pgDb
      .insert(messageLogs)
      .values(insertLog)
      .returning();
    return log;
  }

  async getMessageLogsByInterviewId(interviewId: number): Promise<MessageLog[]> {
    return await pgDb.select().from(messageLogs).where(eq(messageLogs.interviewId, interviewId));
  }

  async getAllCandidates(): Promise<Candidate[]> {
    return await pgDb.select().from(candidates);
  }

  async getAllInterviews(): Promise<Interview[]> {
    return await pgDb.select().from(interviews);
  }

  async getAllResponses(): Promise<Response[]> {
    return await pgDb.select().from(responses);
  }

  async getAllSelections(): Promise<Selection[]> {
    return await pgDb.select().from(selections);
  }

  async getInterviewStats(): Promise<{
    totalClients: number;
    totalInterviews: number;
    pendingInterviews: number;
    avgScore: number;
  }> {
    const totalClients = await pgDb.select().from(clients);
    const totalInterviews = await pgDb.select().from(interviews);
    const pendingInterviews = await pgDb.select().from(interviews).where(eq(interviews.status, 'pending'));
    const allResponses = await pgDb.select().from(responses);
    
    const avgScore = allResponses.length > 0 
      ? allResponses.reduce((sum, r) => sum + (r.score || 0), 0) / allResponses.length 
      : 0;

    return {
      totalClients: totalClients.length,
      totalInterviews: totalInterviews.length,
      pendingInterviews: pendingInterviews.length,
      avgScore: Math.round(avgScore * 100) / 100
    };
  }

  async getClientStats(clientId: number): Promise<{
    activeJobs: number;
    totalCandidates: number;
    monthlyInterviews: number;
    monthlyLimit: number;
    currentUsage: number;
  }> {
    const activeJobs = await pgDb.select().from(jobs).where(
      and(eq(jobs.clientId, clientId), eq(jobs.status, "ativo"))
    );
    const totalCandidates = await pgDb.select().from(candidates).where(eq(candidates.clientId, clientId));
    const client = await this.getClientById(clientId);
    
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyInterviews = await pgDb.select().from(interviews).where(
      and(
        eq(interviews.candidateId, clientId), // This needs to be fixed to properly join with candidates
        eq(interviews.createdAt, monthStart)
      )
    );

    return {
      activeJobs: activeJobs.length,
      totalCandidates: totalCandidates.length,
      monthlyInterviews: monthlyInterviews.length,
      monthlyLimit: client?.monthlyLimit || 0,
      currentUsage: monthlyInterviews.length
    };
  }
}

export const storage = new DatabaseStorage();