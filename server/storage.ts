import { 
  users, clients, jobs, questions, candidates, selections, interviews, responses, apiConfigs, messageLogs,
  type User, type InsertUser, type Client, type InsertClient, type Job, type InsertJob,
  type Question, type InsertQuestion, type Candidate, type InsertCandidate,
  type Selection, type InsertSelection, type Interview, type InsertInterview,
  type Response, type InsertResponse, type ApiConfig, type InsertApiConfig,
  type MessageLog, type InsertMessageLog
} from "@shared/schema";

export interface IStorage {
  // Users
  getUserById(id: number): Promise<User | undefined>;
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
  deleteJob(id: number): Promise<void>;
  
  // Questions
  getQuestionsByJobId(jobId: number): Promise<Question[]>;
  createQuestion(question: InsertQuestion): Promise<Question>;
  updateQuestion(id: number, question: Partial<Question>): Promise<Question>;
  deleteQuestion(id: number): Promise<void>;
  
  // Candidates
  getCandidatesByClientId(clientId: number): Promise<Candidate[]>;
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

export class MemStorage implements IStorage {
  private users: Map<number, User> = new Map();
  private clients: Map<number, Client> = new Map();
  private jobs: Map<number, Job> = new Map();
  private questions: Map<number, Question> = new Map();
  private candidates: Map<number, Candidate> = new Map();
  private selections: Map<number, Selection> = new Map();
  private interviews: Map<number, Interview> = new Map();
  private responses: Map<number, Response> = new Map();
  private messageLogs: Map<number, MessageLog> = new Map();
  private apiConfig: ApiConfig | undefined;
  
  private userIdCounter = 1;
  private clientIdCounter = 1;
  private jobIdCounter = 1;
  private questionIdCounter = 1;
  private candidateIdCounter = 1;
  private selectionIdCounter = 1;
  private interviewIdCounter = 1;
  private responseIdCounter = 1;
  private messageLogIdCounter = 1;

  constructor() {
    // Initialize with master user
    this.users.set(1, {
      id: 1,
      email: "daniel@grupomaximuns.com.br",
      password: "$2b$10$RUhQimJpRo.m.uEQte7kReMSDsJoX3hOsHCBTBLmB7pEufmbV.61e", // hashed version of "daniel580190"
      role: "master",
      name: "Daniel Maximus",
      createdAt: new Date(),
    });
    this.userIdCounter = 2;
  }

  // Users
  async getUserById(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const user: User = { 
      ...insertUser, 
      id, 
      createdAt: new Date() 
    };
    this.users.set(id, user);
    return user;
  }

  // Clients
  async getClients(): Promise<Client[]> {
    return Array.from(this.clients.values());
  }

  async getClientById(id: number): Promise<Client | undefined> {
    return this.clients.get(id);
  }

  async getClientByEmail(email: string): Promise<Client | undefined> {
    return Array.from(this.clients.values()).find(client => client.email === email);
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const id = this.clientIdCounter++;
    const client: Client = { 
      ...insertClient, 
      id, 
      createdAt: new Date() 
    };
    this.clients.set(id, client);
    return client;
  }

  async updateClient(id: number, clientUpdate: Partial<Client>): Promise<Client> {
    const existing = this.clients.get(id);
    if (!existing) throw new Error("Client not found");
    
    const updated = { ...existing, ...clientUpdate };
    this.clients.set(id, updated);
    return updated;
  }

  async deleteClient(id: number): Promise<void> {
    this.clients.delete(id);
  }

  // Jobs
  async getJobsByClientId(clientId: number): Promise<Job[]> {
    return Array.from(this.jobs.values()).filter(job => job.clientId === clientId);
  }

  async getJobById(id: number): Promise<Job | undefined> {
    return this.jobs.get(id);
  }

  async createJob(insertJob: InsertJob): Promise<Job> {
    const id = this.jobIdCounter++;
    const job: Job = { 
      ...insertJob, 
      id, 
      createdAt: new Date() 
    };
    this.jobs.set(id, job);
    return job;
  }

  async updateJob(id: number, jobUpdate: Partial<Job>): Promise<Job> {
    const existing = this.jobs.get(id);
    if (!existing) throw new Error("Job not found");
    
    const updated = { ...existing, ...jobUpdate };
    this.jobs.set(id, updated);
    return updated;
  }

  async deleteJob(id: number): Promise<void> {
    this.jobs.delete(id);
  }

  // Questions
  async getQuestionsByJobId(jobId: number): Promise<Question[]> {
    return Array.from(this.questions.values())
      .filter(q => q.jobId === jobId)
      .sort((a, b) => a.order - b.order);
  }

  async createQuestion(insertQuestion: InsertQuestion): Promise<Question> {
    const id = this.questionIdCounter++;
    const question: Question = { 
      ...insertQuestion, 
      id, 
      createdAt: new Date() 
    };
    this.questions.set(id, question);
    return question;
  }

  async updateQuestion(id: number, questionUpdate: Partial<Question>): Promise<Question> {
    const existing = this.questions.get(id);
    if (!existing) throw new Error("Question not found");
    
    const updated = { ...existing, ...questionUpdate };
    this.questions.set(id, updated);
    return updated;
  }

  async deleteQuestion(id: number): Promise<void> {
    this.questions.delete(id);
  }

  // Candidates
  async getCandidatesByClientId(clientId: number): Promise<Candidate[]> {
    return Array.from(this.candidates.values()).filter(c => c.clientId === clientId);
  }

  async getCandidateById(id: number): Promise<Candidate | undefined> {
    return this.candidates.get(id);
  }

  async createCandidate(insertCandidate: InsertCandidate): Promise<Candidate> {
    const id = this.candidateIdCounter++;
    const candidate: Candidate = { 
      ...insertCandidate, 
      id, 
      createdAt: new Date() 
    };
    this.candidates.set(id, candidate);
    return candidate;
  }

  async createCandidates(insertCandidates: InsertCandidate[]): Promise<Candidate[]> {
    const candidates: Candidate[] = [];
    for (const insertCandidate of insertCandidates) {
      const candidate = await this.createCandidate(insertCandidate);
      candidates.push(candidate);
    }
    return candidates;
  }

  async updateCandidate(id: number, candidateUpdate: Partial<Candidate>): Promise<Candidate> {
    const existing = this.candidates.get(id);
    if (!existing) throw new Error("Candidate not found");
    
    const updated = { ...existing, ...candidateUpdate };
    this.candidates.set(id, updated);
    return updated;
  }

  async deleteCandidate(id: number): Promise<void> {
    this.candidates.delete(id);
  }

  // Selections
  async getSelectionsByClientId(clientId: number): Promise<Selection[]> {
    return Array.from(this.selections.values()).filter(s => s.clientId === clientId);
  }

  async getSelectionById(id: number): Promise<Selection | undefined> {
    return this.selections.get(id);
  }

  async createSelection(insertSelection: InsertSelection): Promise<Selection> {
    const id = this.selectionIdCounter++;
    const selection: Selection = { 
      ...insertSelection, 
      id, 
      createdAt: new Date() 
    };
    this.selections.set(id, selection);
    return selection;
  }

  async updateSelection(id: number, selectionUpdate: Partial<Selection>): Promise<Selection> {
    const existing = this.selections.get(id);
    if (!existing) throw new Error("Selection not found");
    
    const updated = { ...existing, ...selectionUpdate };
    this.selections.set(id, updated);
    return updated;
  }

  async deleteSelection(id: number): Promise<void> {
    this.selections.delete(id);
  }

  // Interviews
  async getInterviewsBySelectionId(selectionId: number): Promise<Interview[]> {
    return Array.from(this.interviews.values()).filter(i => i.selectionId === selectionId);
  }

  async getInterviewById(id: number): Promise<Interview | undefined> {
    return this.interviews.get(id);
  }

  async getInterviewByToken(token: string): Promise<Interview | undefined> {
    return Array.from(this.interviews.values()).find(i => i.token === token);
  }

  async createInterview(insertInterview: InsertInterview): Promise<Interview> {
    const id = this.interviewIdCounter++;
    const interview: Interview = { 
      ...insertInterview, 
      id, 
      createdAt: new Date() 
    };
    this.interviews.set(id, interview);
    return interview;
  }

  async updateInterview(id: number, interviewUpdate: Partial<Interview>): Promise<Interview> {
    const existing = this.interviews.get(id);
    if (!existing) throw new Error("Interview not found");
    
    const updated = { ...existing, ...interviewUpdate };
    this.interviews.set(id, updated);
    return updated;
  }

  // Responses
  async getResponsesByInterviewId(interviewId: number): Promise<Response[]> {
    return Array.from(this.responses.values()).filter(r => r.interviewId === interviewId);
  }

  async createResponse(insertResponse: InsertResponse): Promise<Response> {
    const id = this.responseIdCounter++;
    const response: Response = { 
      ...insertResponse, 
      id, 
      createdAt: new Date() 
    };
    this.responses.set(id, response);
    return response;
  }

  async updateResponse(id: number, responseUpdate: Partial<Response>): Promise<Response> {
    const existing = this.responses.get(id);
    if (!existing) throw new Error("Response not found");
    
    const updated = { ...existing, ...responseUpdate };
    this.responses.set(id, updated);
    return updated;
  }

  // API Config
  async getApiConfig(): Promise<ApiConfig | undefined> {
    return this.apiConfig;
  }

  async upsertApiConfig(config: InsertApiConfig): Promise<ApiConfig> {
    const apiConfig: ApiConfig = {
      ...config,
      id: 1,
      updatedAt: new Date()
    };
    this.apiConfig = apiConfig;
    return apiConfig;
  }

  // Message Logs
  async createMessageLog(insertLog: InsertMessageLog): Promise<MessageLog> {
    const id = this.messageLogIdCounter++;
    const log: MessageLog = { 
      ...insertLog, 
      id, 
      sentAt: new Date() 
    };
    this.messageLogs.set(id, log);
    return log;
  }

  async getMessageLogsByInterviewId(interviewId: number): Promise<MessageLog[]> {
    return Array.from(this.messageLogs.values()).filter(l => l.interviewId === interviewId);
  }

  // Statistics
  async getInterviewStats(): Promise<{
    totalClients: number;
    totalInterviews: number;
    pendingInterviews: number;
    avgScore: number;
  }> {
    const totalClients = this.clients.size;
    const allInterviews = Array.from(this.interviews.values());
    const totalInterviews = allInterviews.length;
    const pendingInterviews = allInterviews.filter(i => i.status === 'pending').length;
    const completedInterviews = allInterviews.filter(i => i.status === 'completed' && i.totalScore);
    const avgScore = completedInterviews.length > 0 
      ? Math.round(completedInterviews.reduce((sum, i) => sum + (i.totalScore || 0), 0) / completedInterviews.length)
      : 0;

    return {
      totalClients,
      totalInterviews,
      pendingInterviews,
      avgScore
    };
  }

  async getClientStats(clientId: number): Promise<{
    activeJobs: number;
    totalCandidates: number;
    monthlyInterviews: number;
    monthlyLimit: number;
    currentUsage: number;
  }> {
    const clientJobs = Array.from(this.jobs.values()).filter(j => j.clientId === clientId);
    const activeJobs = clientJobs.filter(j => j.status === 'active').length;
    const totalCandidates = Array.from(this.candidates.values()).filter(c => c.clientId === clientId).length;
    
    const client = await this.getClientById(clientId);
    const monthlyLimit = client?.monthlyLimit || 0;
    
    // Calculate current month interviews
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyInterviews = Array.from(this.interviews.values()).filter(i => {
      const selection = this.selections.get(i.selectionId);
      return selection?.clientId === clientId && i.createdAt && i.createdAt >= startOfMonth;
    }).length;

    return {
      activeJobs,
      totalCandidates,
      monthlyInterviews,
      monthlyLimit,
      currentUsage: monthlyInterviews
    };
  }
}

export const storage = new MemStorage();
