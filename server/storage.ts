import {
  type User, type InsertUser, type Client, type InsertClient,
  type Job, type InsertJob, type Question, type InsertQuestion,
  type CandidateList, type InsertCandidateList, type Candidate, type InsertCandidate,
  type Selection, type InsertSelection, type Interview, type InsertInterview, 
  type Response, type InsertResponse, type ApiConfig, type InsertApiConfig,
  type ReportFolder, type InsertReportFolder,
  type ReportFolderAssignment, type InsertReportFolderAssignment
} from "@shared/schema";
import { collection, doc, getDocs, getDoc, updateDoc, deleteDoc, query, where, setDoc, addDoc, orderBy, writeBatch, Timestamp } from "firebase/firestore";
import bcrypt from "bcrypt";
import { firebaseDb, db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import admin from "firebase-admin";

export interface IStorage {
  // Users (PostgreSQL para autenticação)
  getUserById(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  validateUserPassword(email: string, password: string): Promise<User | null>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<User>): Promise<User>;
  deleteUser(id: string): Promise<void>;
  getUsers(): Promise<User[]>;

  // Clients (Firebase)
  getClients(): Promise<Client[]>;
  getClientById(id: string): Promise<Client | undefined>;
  getClientByEmail(email: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, client: Partial<Client>): Promise<Client>;
  deleteClient(id: string): Promise<void>;

  // Jobs (Firebase)
  getJobsByClientId(clientId: string): Promise<Job[]>;
  getJobById(id: string): Promise<Job | undefined>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: string, job: Partial<Job>): Promise<Job>;
  deleteJob(id: string): Promise<void>;

  // Questions (Firebase)
  getQuestionsByJobId(jobId: string): Promise<Question[]>;
  createQuestion(question: InsertQuestion): Promise<Question>;
  updateQuestion(id: number, question: Partial<Question>): Promise<Question>;
  deleteQuestion(id: number): Promise<void>;

  // Candidate Lists (Firebase)
  getCandidateListsByClientId(clientId: string): Promise<CandidateList[]>;
  getCandidateListById(id: string): Promise<CandidateList | undefined>;
  createCandidateList(list: InsertCandidateList): Promise<CandidateList>;
  updateCandidateList(id: string, list: Partial<CandidateList>): Promise<CandidateList>;
  deleteCandidateList(id: string): Promise<void>;

  // Candidates (Firebase)
  getCandidatesByClientId(clientId: string): Promise<Candidate[]>;
  getCandidatesByListId(listId: string): Promise<Candidate[]>;
  getCandidateById(id: string): Promise<Candidate | undefined>;
  createCandidate(candidate: InsertCandidate): Promise<Candidate>;
  updateCandidate(id: string, candidate: Partial<Candidate>): Promise<Candidate>;
  deleteCandidate(id: string): Promise<void>;

  // Selections (Firebase)
  getSelectionsByClientId(clientId: string): Promise<Selection[]>;
  createSelection(selection: InsertSelection): Promise<Selection>;
  updateSelection(id: string, selection: Partial<Selection>): Promise<Selection>;
  deleteSelection(id: string): Promise<void>;

  // Interviews (Firebase)
  getInterviewsBySelectionId(selectionId: string): Promise<Interview[]>;
  createInterview(interview: InsertInterview): Promise<Interview>;
  updateInterview(id: string, interview: Partial<Interview>): Promise<Interview>;
  deleteInterview(id: string): Promise<void>;

  // Responses (Firebase)
  getResponsesByInterviewId(interviewId: string): Promise<Response[]>;
  createResponse(response: InsertResponse): Promise<Response>;
  updateResponse(id: number, response: Partial<Response>): Promise<Response>;
  deleteResponse(id: number): Promise<void>;

  // API Configurations (Firebase)
  getApiConfigsByEntityId(entityId: string): Promise<ApiConfig[]>;
  createApiConfig(config: InsertApiConfig): Promise<ApiConfig>;
  updateApiConfig(id: number, config: Partial<ApiConfig>): Promise<ApiConfig>;

  // Report Folders (Firebase)
  getReportFoldersByClientId(clientId: string): Promise<ReportFolder[]>;
  createReportFolder(folder: InsertReportFolder): Promise<ReportFolder>;
  updateReportFolder(id: string, folder: Partial<ReportFolder>): Promise<ReportFolder>;
  deleteReportFolder(id: string): Promise<void>;
}

class FirebaseStorage implements IStorage {
  private generateId(): string {
    return Date.now().toString();
  }

  private generateNumericId(): number {
    return Date.now();
  }

  // Users (PostgreSQL para autenticação)
  async getUserById(id: string): Promise<User | undefined> {
    try {
      if (!db) {
        console.error('Database connection not available');
        return undefined;
      }
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user || undefined;
    } catch (error) {
      console.error('Erro ao buscar usuário:', error);
      return undefined;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      if (!db) {
        console.error('Database connection not available');
        return undefined;
      }
      const [user] = await db.select().from(users).where(eq(users.email, email));
      return user || undefined;
    } catch (error) {
      console.error('Erro ao buscar usuário por email:', error);
      return undefined;
    }
  }

  async validateUserPassword(email: string, password: string): Promise<User | null> {
    try {
      const user = await this.getUserByEmail(email);
      if (!user) return null;
      
      const isValid = await bcrypt.compare(password, user.password);
      return isValid ? user : null;
    } catch (error) {
      console.error('Erro ao validar senha:', error);
      return null;
    }
  }

  async createUser(user: InsertUser): Promise<User> {
    try {
      if (!db) throw new Error('Database connection not available');
      
      const hashedPassword = await bcrypt.hash(user.password, 10);
      const id = this.generateId();
      
      const newUser = {
        id,
        ...user,
        password: hashedPassword,
        createdAt: new Date(),
      };

      await db.insert(users).values(newUser);
      return newUser as User;
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      throw error;
    }
  }

  async updateUser(id: string, user: Partial<User>): Promise<User> {
    try {
      if (!db) throw new Error('Database connection not available');
      
      if (user.password) {
        user.password = await bcrypt.hash(user.password, 10);
      }

      const [updatedUser] = await db
        .update(users)
        .set(user)
        .where(eq(users.id, id))
        .returning();
      
      return updatedUser;
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      throw error;
    }
  }

  async deleteUser(id: string): Promise<void> {
    try {
      if (!db) throw new Error('Database connection not available');
      await db.delete(users).where(eq(users.id, id));
    } catch (error) {
      console.error('Erro ao deletar usuário:', error);
      throw error;
    }
  }

  async getUsers(): Promise<User[]> {
    try {
      if (!db) {
        console.error('Database connection not available');
        return [];
      }
      return await db.select().from(users);
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      return [];
    }
  }

  // Clients (Firebase) - implementações básicas
  async getClients(): Promise<Client[]> {
    try {
      const clientsSnapshot = await getDocs(collection(firebaseDb, 'clients'));
      return clientsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Client));
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
      return [];
    }
  }

  async getClientById(id: string): Promise<Client | undefined> {
    try {
      const clientDoc = await getDoc(doc(firebaseDb, 'clients', id));
      if (clientDoc.exists()) {
        return { id, ...clientDoc.data() } as Client;
      }
      return undefined;
    } catch (error) {
      console.error('Erro ao buscar cliente:', error);
      return undefined;
    }
  }

  async getClientByEmail(email: string): Promise<Client | undefined> {
    try {
      const clientsQuery = query(collection(firebaseDb, 'clients'), where('email', '==', email));
      const querySnapshot = await getDocs(clientsQuery);
      
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        return { id: doc.id, ...doc.data() } as Client;
      }
      return undefined;
    } catch (error) {
      console.error('Erro ao buscar cliente por email:', error);
      return undefined;
    }
  }

  async createClient(client: InsertClient): Promise<Client> {
    try {
      const id = this.generateId();
      const clientData = {
        ...client,
        createdAt: new Date()
      };
      
      await setDoc(doc(firebaseDb, 'clients', id), clientData);
      return { id, ...clientData } as Client;
    } catch (error) {
      console.error('Erro ao criar cliente:', error);
      throw error;
    }
  }

  async updateClient(id: string, client: Partial<Client>): Promise<Client> {
    try {
      await updateDoc(doc(firebaseDb, 'clients', id), client);
      const updated = await this.getClientById(id);
      if (!updated) throw new Error('Cliente não encontrado após atualização');
      return updated;
    } catch (error) {
      console.error('Erro ao atualizar cliente:', error);
      throw error;
    }
  }

  async deleteClient(id: string): Promise<void> {
    try {
      await deleteDoc(doc(firebaseDb, 'clients', id));
    } catch (error) {
      console.error('Erro ao deletar cliente:', error);
      throw error;
    }
  }

  // Jobs (Firebase) - implementações básicas
  async getJobsByClientId(clientId: string): Promise<Job[]> {
    try {
      const jobsQuery = query(collection(firebaseDb, 'jobs'), where('clientId', '==', clientId));
      const querySnapshot = await getDocs(jobsQuery);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Job));
    } catch (error) {
      console.error('Erro ao buscar jobs:', error);
      return [];
    }
  }

  async getJobById(id: string): Promise<Job | undefined> {
    try {
      const jobDoc = await getDoc(doc(firebaseDb, 'jobs', id));
      if (jobDoc.exists()) {
        return { id, ...jobDoc.data() } as Job;
      }
      return undefined;
    } catch (error) {
      console.error('Erro ao buscar job:', error);
      return undefined;
    }
  }

  async createJob(job: InsertJob): Promise<Job> {
    try {
      const id = this.generateId();
      const jobData = {
        ...job,
        createdAt: new Date()
      };
      
      await setDoc(doc(firebaseDb, 'jobs', id), jobData);
      return { id, ...jobData } as Job;
    } catch (error) {
      console.error('Erro ao criar job:', error);
      throw error;
    }
  }

  async updateJob(id: string, job: Partial<Job>): Promise<Job> {
    try {
      await updateDoc(doc(firebaseDb, 'jobs', id), job);
      const updated = await this.getJobById(id);
      if (!updated) throw new Error('Job não encontrado após atualização');
      return updated;
    } catch (error) {
      console.error('Erro ao atualizar job:', error);
      throw error;
    }
  }

  async deleteJob(id: string): Promise<void> {
    try {
      await deleteDoc(doc(firebaseDb, 'jobs', id));
    } catch (error) {
      console.error('Erro ao deletar job:', error);
      throw error;
    }
  }

  // Candidates (Firebase) - implementações básicas
  async getCandidatesByClientId(clientId: string): Promise<Candidate[]> {
    try {
      const candidatesQuery = query(collection(firebaseDb, 'candidates'), where('clientId', '==', clientId));
      const querySnapshot = await getDocs(candidatesQuery);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Candidate));
    } catch (error) {
      console.error('Erro ao buscar candidatos:', error);
      return [];
    }
  }

  async getCandidatesByListId(listId: string): Promise<Candidate[]> {
    try {
      const candidatesQuery = query(collection(firebaseDb, 'candidates'), where('listId', '==', listId));
      const querySnapshot = await getDocs(candidatesQuery);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Candidate));
    } catch (error) {
      console.error('Erro ao buscar candidatos por lista:', error);
      return [];
    }
  }

  async getCandidateById(id: string): Promise<Candidate | undefined> {
    try {
      const candidateDoc = await getDoc(doc(firebaseDb, 'candidates', id));
      if (candidateDoc.exists()) {
        return { id, ...candidateDoc.data() } as Candidate;
      }
      return undefined;
    } catch (error) {
      console.error('Erro ao buscar candidato:', error);
      return undefined;
    }
  }

  async createCandidate(candidate: InsertCandidate): Promise<Candidate> {
    try {
      const id = this.generateId();
      const candidateData = {
        ...candidate,
        createdAt: new Date()
      };
      
      await setDoc(doc(firebaseDb, 'candidates', id), candidateData);
      return { id, ...candidateData } as Candidate;
    } catch (error) {
      console.error('Erro ao criar candidato:', error);
      throw error;
    }
  }

  async updateCandidate(id: string, candidate: Partial<Candidate>): Promise<Candidate> {
    try {
      await updateDoc(doc(firebaseDb, 'candidates', id), candidate);
      const updated = await this.getCandidateById(id);
      if (!updated) throw new Error('Candidato não encontrado após atualização');
      return updated;
    } catch (error) {
      console.error('Erro ao atualizar candidato:', error);
      throw error;
    }
  }

  async deleteCandidate(id: string): Promise<void> {
    try {
      await deleteDoc(doc(firebaseDb, 'candidates', id));
    } catch (error) {
      console.error('Erro ao deletar candidato:', error);
      throw error;
    }
  }

  // Métodos stub para as outras entidades
  async getQuestionsByJobId(jobId: string): Promise<Question[]> { return []; }
  async createQuestion(question: InsertQuestion): Promise<Question> { return {} as Question; }
  async updateQuestion(id: number, question: Partial<Question>): Promise<Question> { return {} as Question; }
  async deleteQuestion(id: number): Promise<void> {}

  async getCandidateListsByClientId(clientId: string): Promise<CandidateList[]> { return []; }
  async getCandidateListById(id: string): Promise<CandidateList | undefined> { return undefined; }
  async createCandidateList(list: InsertCandidateList): Promise<CandidateList> { return {} as CandidateList; }
  async updateCandidateList(id: string, list: Partial<CandidateList>): Promise<CandidateList> { return {} as CandidateList; }
  async deleteCandidateList(id: string): Promise<void> {}

  async getSelectionsByClientId(clientId: string): Promise<Selection[]> { return []; }
  async createSelection(selection: InsertSelection): Promise<Selection> { return {} as Selection; }
  async updateSelection(id: string, selection: Partial<Selection>): Promise<Selection> { return {} as Selection; }
  async deleteSelection(id: string): Promise<void> {}

  async getInterviewsBySelectionId(selectionId: string): Promise<Interview[]> { return []; }
  async createInterview(interview: InsertInterview): Promise<Interview> { return {} as Interview; }
  async updateInterview(id: string, interview: Partial<Interview>): Promise<Interview> { return {} as Interview; }
  async deleteInterview(id: string): Promise<void> {}

  async getResponsesByInterviewId(interviewId: string): Promise<Response[]> { return []; }
  async createResponse(response: InsertResponse): Promise<Response> { return {} as Response; }
  async updateResponse(id: number, response: Partial<Response>): Promise<Response> { return {} as Response; }
  async deleteResponse(id: number): Promise<void> {}

  async getApiConfigsByEntityId(entityId: string): Promise<ApiConfig[]> { return []; }
  async createApiConfig(config: InsertApiConfig): Promise<ApiConfig> { return {} as ApiConfig; }
  async updateApiConfig(id: number, config: Partial<ApiConfig>): Promise<ApiConfig> { return {} as ApiConfig; }

  async getReportFoldersByClientId(clientId: string): Promise<ReportFolder[]> { return []; }
  async createReportFolder(folder: InsertReportFolder): Promise<ReportFolder> { return {} as ReportFolder; }
  async updateReportFolder(id: string, folder: Partial<ReportFolder>): Promise<ReportFolder> { return {} as ReportFolder; }
  async deleteReportFolder(id: string): Promise<void> {}
}

export const storage = new FirebaseStorage();