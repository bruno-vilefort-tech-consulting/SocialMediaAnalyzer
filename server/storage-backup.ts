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
  // Users
  getUserById(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  validateUserPassword(email: string, password: string): Promise<User | null>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<User>): Promise<User>;
  deleteUser(id: string): Promise<void>;
  getUsers(): Promise<User[]>;

  // Clients
  getClients(): Promise<Client[]>;
  getClientById(id: string): Promise<Client | undefined>;
  getClientByEmail(email: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, client: Partial<Client>): Promise<Client>;
  deleteClient(id: string): Promise<void>;

  // Jobs
  getJobsByClientId(clientId: string): Promise<Job[]>;
  getJobById(id: string): Promise<Job | undefined>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: string, job: Partial<Job>): Promise<Job>;
  deleteJob(id: string): Promise<void>;

  // Questions
  getQuestionsByJobId(jobId: string): Promise<Question[]>;
  createQuestion(question: InsertQuestion): Promise<Question>;
  updateQuestion(id: number, question: Partial<Question>): Promise<Question>;
  deleteQuestion(id: number): Promise<void>;

  // Candidate Lists
  getAllCandidateLists(): Promise<CandidateList[]>;
  getCandidateListsByClientId(clientId: string): Promise<CandidateList[]>;
  getCandidateListById(id: number): Promise<CandidateList | undefined>;
  createCandidateList(candidateList: InsertCandidateList): Promise<CandidateList>;
  updateCandidateList(id: number, candidateList: Partial<CandidateList>): Promise<CandidateList>;
  deleteCandidateList(id: number): Promise<void>;

  // Candidates
  getCandidatesByClientId(clientId: string): Promise<Candidate[]>;
  getCandidateById(id: number): Promise<Candidate | undefined>;
  getCandidatesByListId(listId: number): Promise<Candidate[]>;
  createCandidate(candidate: InsertCandidate): Promise<Candidate>;
  updateCandidate(id: number, candidate: Partial<Candidate>): Promise<Candidate>;
  deleteCandidate(id: number): Promise<void>;

  // Selections
  getSelectionsByClientId(clientId: string): Promise<Selection[]>;
  getSelectionById(id: number): Promise<Selection | undefined>;
  createSelection(selection: InsertSelection): Promise<Selection>;
  updateSelection(id: number, selection: Partial<Selection>): Promise<Selection>;
  deleteSelection(id: number): Promise<void>;

  // Interviews
  getInterviewsBySelectionId(selectionId: number): Promise<Interview[]>;
  getInterviewById(id: number): Promise<Interview | undefined>;
  createInterview(interview: InsertInterview): Promise<Interview>;
  updateInterview(id: number, interview: Partial<Interview>): Promise<Interview>;
  deleteInterview(id: number): Promise<void>;

  // Responses
  getResponsesByInterviewId(interviewId: number): Promise<Response[]>;
  createResponse(response: InsertResponse): Promise<Response>;
  updateResponse(id: number, response: Partial<Response>): Promise<Response>;
  deleteResponse(id: number): Promise<void>;

  // API Configurations
  getApiConfigsByEntityId(entityId: string): Promise<ApiConfig[]>;
  createApiConfig(config: InsertApiConfig): Promise<ApiConfig>;
  updateApiConfig(id: number, config: Partial<ApiConfig>): Promise<ApiConfig>;

  // Report Folders
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

  // Users (usando PostgreSQL para autenticação)
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

  // Método para validar senha (específico para login)
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

  // Continua com métodos Firebase para outros dados do sistema
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
      
      await setDoc(doc(firebaseDb, 'users', id), userData);
      return { id, ...userData } as User;
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      throw error;
    }
  }

  async updateUser(id: string, user: Partial<User>): Promise<User> {
    try {
      await updateDoc(doc(firebaseDb, 'users', id), user);
      const updated = await this.getUserById(id);
      if (!updated) throw new Error('Usuário não encontrado após atualização');
      return updated;
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      throw error;
    }
  }

  async deleteUser(id: string): Promise<void> {
    try {
      await deleteDoc(doc(firebaseDb, 'users', id));
    } catch (error) {
      console.error('Erro ao deletar usuário:', error);
      throw error;
    }
  }

  // Clients
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

  // Jobs
  async getJobsByClientId(clientId: string): Promise<Job[]> {
    try {
      const jobsQuery = query(collection(firebaseDb, 'jobs'), where('clientId', '==', clientId));
      const querySnapshot = await getDocs(jobsQuery);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Job));
    } catch (error) {
      console.error('Erro ao buscar vagas:', error);
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
      console.error('Erro ao buscar vaga:', error);
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
      console.error('Erro ao criar vaga:', error);
      throw error;
    }
  }

  async updateJob(id: string, job: Partial<Job>): Promise<Job> {
    try {
      await updateDoc(doc(firebaseDb, 'jobs', id), job);
      const updated = await this.getJobById(id);
      if (!updated) throw new Error('Vaga não encontrada após atualização');
      return updated;
    } catch (error) {
      console.error('Erro ao atualizar vaga:', error);
      throw error;
    }
  }

  async deleteJob(id: string): Promise<void> {
    try {
      await deleteDoc(doc(firebaseDb, 'jobs', id));
    } catch (error) {
      console.error('Erro ao deletar vaga:', error);
      throw error;
    }
  }

  // Questions
  async getQuestionsByJobId(jobId: string): Promise<Question[]> {
    try {
      const questionsQuery = query(collection(firebaseDb, 'questions'), where('vagaId', '==', jobId));
      const querySnapshot = await getDocs(questionsQuery);
      return querySnapshot.docs.map(doc => ({
        id: parseInt(doc.id),
        ...doc.data()
      } as Question));
    } catch (error) {
      console.error('Erro ao buscar perguntas:', error);
      return [];
    }
  }

  async createQuestion(question: InsertQuestion): Promise<Question> {
    try {
      const id = this.generateNumericId();
      const questionData = {
        ...question,
        createdAt: new Date()
      };
      
      await setDoc(doc(firebaseDb, 'questions', id.toString()), questionData);
      return { id, ...questionData } as Question;
    } catch (error) {
      console.error('Erro ao criar pergunta:', error);
      throw error;
    }
  }

  async updateQuestion(id: number, question: Partial<Question>): Promise<Question> {
    try {
      await updateDoc(doc(firebaseDb, 'questions', id.toString()), question);
      const questionDoc = await getDoc(doc(firebaseDb, 'questions', id.toString()));
      if (!questionDoc.exists()) throw new Error('Pergunta não encontrada após atualização');
      return { id, ...questionDoc.data() } as Question;
    } catch (error) {
      console.error('Erro ao atualizar pergunta:', error);
      throw error;
    }
  }

  async deleteQuestion(id: number): Promise<void> {
    try {
      await deleteDoc(doc(firebaseDb, 'questions', id.toString()));
    } catch (error) {
      console.error('Erro ao deletar pergunta:', error);
      throw error;
    }
  }

  // Candidate Lists
  async getAllCandidateLists(): Promise<CandidateList[]> {
    try {
      const listsSnapshot = await getDocs(collection(firebaseDb, 'candidateLists'));
      return listsSnapshot.docs.map(doc => ({
        id: parseInt(doc.id),
        ...doc.data()
      } as CandidateList));
    } catch (error) {
      console.error('Erro ao buscar listas de candidatos:', error);
      return [];
    }
  }

  async getCandidateListsByClientId(clientId: string): Promise<CandidateList[]> {
    try {
      const listsQuery = query(collection(firebaseDb, 'candidateLists'), where('clientId', '==', clientId));
      const querySnapshot = await getDocs(listsQuery);
      return querySnapshot.docs.map(doc => ({
        id: parseInt(doc.id),
        ...doc.data()
      } as CandidateList));
    } catch (error) {
      console.error('Erro ao buscar listas de candidatos por cliente:', error);
      return [];
    }
  }

  async getCandidateListById(id: number): Promise<CandidateList | undefined> {
    try {
      const listDoc = await getDoc(doc(firebaseDb, 'candidateLists', id.toString()));
      if (listDoc.exists()) {
        return { id, ...listDoc.data() } as CandidateList;
      }
      return undefined;
    } catch (error) {
      console.error('Erro ao buscar lista de candidatos:', error);
      return undefined;
    }
  }

  async createCandidateList(candidateList: InsertCandidateList): Promise<CandidateList> {
    try {
      const id = this.generateNumericId();
      const listData = {
        ...candidateList,
        createdAt: new Date()
      };
      
      await setDoc(doc(firebaseDb, 'candidateLists', id.toString()), listData);
      return { id, ...listData } as CandidateList;
    } catch (error) {
      console.error('Erro ao criar lista de candidatos:', error);
      throw error;
    }
  }

  async updateCandidateList(id: number, candidateList: Partial<CandidateList>): Promise<CandidateList> {
    try {
      await updateDoc(doc(firebaseDb, 'candidateLists', id.toString()), candidateList);
      const updated = await this.getCandidateListById(id);
      if (!updated) throw new Error('Lista não encontrada após atualização');
      return updated;
    } catch (error) {
      console.error('Erro ao atualizar lista de candidatos:', error);
      throw error;
    }
  }

  async deleteCandidateList(id: number): Promise<void> {
    try {
      await deleteDoc(doc(firebaseDb, 'candidateLists', id.toString()));
    } catch (error) {
      console.error('Erro ao deletar lista de candidatos:', error);
      throw error;
    }
  }

  // Candidates
  async getCandidatesByClientId(clientId: string): Promise<Candidate[]> {
    try {
      const candidatesQuery = query(collection(firebaseDb, 'candidates'), where('clientId', '==', clientId));
      const querySnapshot = await getDocs(candidatesQuery);
      return querySnapshot.docs.map(doc => ({
        id: parseInt(doc.id),
        ...doc.data()
      } as Candidate));
    } catch (error) {
      console.error('Erro ao buscar candidatos por cliente:', error);
      return [];
    }
  }

  async getCandidateById(id: number): Promise<Candidate | undefined> {
    try {
      const candidateDoc = await getDoc(doc(firebaseDb, 'candidates', id.toString()));
      if (candidateDoc.exists()) {
        return { id, ...candidateDoc.data() } as Candidate;
      }
      return undefined;
    } catch (error) {
      console.error('Erro ao buscar candidato:', error);
      return undefined;
    }
  }

  async getCandidatesByListId(listId: number): Promise<Candidate[]> {
    try {
      // Get candidate memberships for this list
      const membershipsQuery = query(
        collection(firebaseDb, 'candidateListMemberships'), 
        where('listId', '==', listId)
      );
      const membershipsSnapshot = await getDocs(membershipsQuery);
      
      const candidateIds = membershipsSnapshot.docs.map(doc => doc.data().candidateId);
      
      if (candidateIds.length === 0) return [];

      // Get candidates by IDs
      const candidates: Candidate[] = [];
      for (const candidateId of candidateIds) {
        const candidate = await this.getCandidateById(candidateId);
        if (candidate) candidates.push(candidate);
      }
      
      return candidates;
    } catch (error) {
      console.error('Erro ao buscar candidatos por lista:', error);
      return [];
    }
  }

  async createCandidate(candidate: InsertCandidate): Promise<Candidate> {
    try {
      const id = this.generateNumericId();
      const candidateData = {
        ...candidate,
        createdAt: new Date()
      };
      
      await setDoc(doc(firebaseDb, 'candidates', id.toString()), candidateData);
      return { id, ...candidateData } as Candidate;
    } catch (error) {
      console.error('Erro ao criar candidato:', error);
      throw error;
    }
  }

  async updateCandidate(id: number, candidate: Partial<Candidate>): Promise<Candidate> {
    try {
      await updateDoc(doc(firebaseDb, 'candidates', id.toString()), candidate);
      const updated = await this.getCandidateById(id);
      if (!updated) throw new Error('Candidato não encontrado após atualização');
      return updated;
    } catch (error) {
      console.error('Erro ao atualizar candidato:', error);
      throw error;
    }
  }

  async deleteCandidate(id: number): Promise<void> {
    try {
      await deleteDoc(doc(firebaseDb, 'candidates', id.toString()));
    } catch (error) {
      console.error('Erro ao deletar candidato:', error);
      throw error;
    }
  }

  // Selections
  async getSelectionsByClientId(clientId: string): Promise<Selection[]> {
    try {
      const selectionsQuery = query(collection(firebaseDb, 'selections'), where('clientId', '==', clientId));
      const querySnapshot = await getDocs(selectionsQuery);
      return querySnapshot.docs.map(doc => ({
        id: parseInt(doc.id),
        ...doc.data()
      } as Selection));
    } catch (error) {
      console.error('Erro ao buscar seleções:', error);
      return [];
    }
  }

  async getSelectionById(id: number): Promise<Selection | undefined> {
    try {
      const selectionDoc = await getDoc(doc(firebaseDb, 'selections', id.toString()));
      if (selectionDoc.exists()) {
        return { id, ...selectionDoc.data() } as Selection;
      }
      return undefined;
    } catch (error) {
      console.error('Erro ao buscar seleção:', error);
      return undefined;
    }
  }

  async createSelection(selection: InsertSelection): Promise<Selection> {
    try {
      const id = this.generateNumericId();
      const selectionData = {
        ...selection,
        createdAt: new Date()
      };
      
      await setDoc(doc(firebaseDb, 'selections', id.toString()), selectionData);
      return { id, ...selectionData } as Selection;
    } catch (error) {
      console.error('Erro ao criar seleção:', error);
      throw error;
    }
  }

  async updateSelection(id: number, selection: Partial<Selection>): Promise<Selection> {
    try {
      await updateDoc(doc(firebaseDb, 'selections', id.toString()), selection);
      const updated = await this.getSelectionById(id);
      if (!updated) throw new Error('Seleção não encontrada após atualização');
      return updated;
    } catch (error) {
      console.error('Erro ao atualizar seleção:', error);
      throw error;
    }
  }

  async deleteSelection(id: number): Promise<void> {
    try {
      await deleteDoc(doc(firebaseDb, 'selections', id.toString()));
    } catch (error) {
      console.error('Erro ao deletar seleção:', error);
      throw error;
    }
  }

  // Interviews
  async getInterviewsBySelectionId(selectionId: number): Promise<Interview[]> {
    try {
      const interviewsQuery = query(collection(firebaseDb, 'interviews'), where('selectionId', '==', selectionId));
      const querySnapshot = await getDocs(interviewsQuery);
      return querySnapshot.docs.map(doc => ({
        id: parseInt(doc.id),
        ...doc.data()
      } as Interview));
    } catch (error) {
      console.error('Erro ao buscar entrevistas:', error);
      return [];
    }
  }

  async getInterviewById(id: number): Promise<Interview | undefined> {
    try {
      const interviewDoc = await getDoc(doc(firebaseDb, 'interviews', id.toString()));
      if (interviewDoc.exists()) {
        return { id, ...interviewDoc.data() } as Interview;
      }
      return undefined;
    } catch (error) {
      console.error('Erro ao buscar entrevista:', error);
      return undefined;
    }
  }

  async createInterview(interview: InsertInterview): Promise<Interview> {
    try {
      const id = this.generateNumericId();
      const interviewData = {
        ...interview,
        createdAt: new Date()
      };
      
      await setDoc(doc(firebaseDb, 'interviews', id.toString()), interviewData);
      return { id, ...interviewData } as Interview;
    } catch (error) {
      console.error('Erro ao criar entrevista:', error);
      throw error;
    }
  }

  async updateInterview(id: number, interview: Partial<Interview>): Promise<Interview> {
    try {
      await updateDoc(doc(firebaseDb, 'interviews', id.toString()), interview);
      const updated = await this.getInterviewById(id);
      if (!updated) throw new Error('Entrevista não encontrada após atualização');
      return updated;
    } catch (error) {
      console.error('Erro ao atualizar entrevista:', error);
      throw error;
    }
  }

  async deleteInterview(id: number): Promise<void> {
    try {
      await deleteDoc(doc(firebaseDb, 'interviews', id.toString()));
    } catch (error) {
      console.error('Erro ao deletar entrevista:', error);
      throw error;
    }
  }

  // Responses
  async getResponsesByInterviewId(interviewId: number): Promise<Response[]> {
    try {
      const responsesQuery = query(collection(firebaseDb, 'responses'), where('interviewId', '==', interviewId));
      const querySnapshot = await getDocs(responsesQuery);
      return querySnapshot.docs.map(doc => ({
        id: parseInt(doc.id),
        ...doc.data()
      } as Response));
    } catch (error) {
      console.error('Erro ao buscar respostas:', error);
      return [];
    }
  }

  async createResponse(response: InsertResponse): Promise<Response> {
    try {
      const id = this.generateNumericId();
      const responseData = {
        ...response,
        createdAt: new Date()
      };
      
      await setDoc(doc(firebaseDb, 'responses', id.toString()), responseData);
      return { id, ...responseData } as Response;
    } catch (error) {
      console.error('Erro ao criar resposta:', error);
      throw error;
    }
  }

  async updateResponse(id: number, response: Partial<Response>): Promise<Response> {
    try {
      await updateDoc(doc(firebaseDb, 'responses', id.toString()), response);
      const responseDoc = await getDoc(doc(firebaseDb, 'responses', id.toString()));
      if (!responseDoc.exists()) throw new Error('Resposta não encontrada após atualização');
      return { id, ...responseDoc.data() } as Response;
    } catch (error) {
      console.error('Erro ao atualizar resposta:', error);
      throw error;
    }
  }

  async deleteResponse(id: number): Promise<void> {
    try {
      await deleteDoc(doc(firebaseDb, 'responses', id.toString()));
    } catch (error) {
      console.error('Erro ao deletar resposta:', error);
      throw error;
    }
  }

  // API Configurations
  async getApiConfigsByEntityId(entityId: string): Promise<ApiConfig[]> {
    try {
      const configsQuery = query(collection(firebaseDb, 'apiConfigs'), where('entityId', '==', entityId));
      const querySnapshot = await getDocs(configsQuery);
      return querySnapshot.docs.map(doc => ({
        id: parseInt(doc.id),
        ...doc.data()
      } as ApiConfig));
    } catch (error) {
      console.error('Erro ao buscar configurações de API:', error);
      return [];
    }
  }

  async createApiConfig(config: InsertApiConfig): Promise<ApiConfig> {
    try {
      const id = this.generateNumericId();
      const configData = {
        ...config,
        updatedAt: new Date()
      };
      
      await setDoc(doc(firebaseDb, 'apiConfigs', id.toString()), configData);
      return { id, ...configData } as ApiConfig;
    } catch (error) {
      console.error('Erro ao criar configuração de API:', error);
      throw error;
    }
  }

  async updateApiConfig(id: number, config: Partial<ApiConfig>): Promise<ApiConfig> {
    try {
      const updateData = {
        ...config,
        updatedAt: new Date()
      };
      
      await updateDoc(doc(firebaseDb, 'apiConfigs', id.toString()), updateData);
      const configDoc = await getDoc(doc(firebaseDb, 'apiConfigs', id.toString()));
      if (!configDoc.exists()) throw new Error('Configuração não encontrada após atualização');
      return { id, ...configDoc.data() } as ApiConfig;
    } catch (error) {
      console.error('Erro ao atualizar configuração de API:', error);
      throw error;
    }
  }

  // Report Folders
  async getReportFoldersByClientId(clientId: string): Promise<ReportFolder[]> {
    try {
      const foldersQuery = query(collection(firebaseDb, 'reportFolders'), where('clientId', '==', clientId));
      const querySnapshot = await getDocs(foldersQuery);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ReportFolder));
    } catch (error) {
      console.error('Erro ao buscar pastas de relatórios:', error);
      return [];
    }
  }

  async createReportFolder(folder: InsertReportFolder): Promise<ReportFolder> {
    try {
      const id = this.generateId();
      const folderData = {
        ...folder,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await setDoc(doc(firebaseDb, 'reportFolders', id), folderData);
      return { id, ...folderData } as ReportFolder;
    } catch (error) {
      console.error('Erro ao criar pasta de relatórios:', error);
      throw error;
    }
  }

  async updateReportFolder(id: string, folder: Partial<ReportFolder>): Promise<ReportFolder> {
    try {
      const updateData = {
        ...folder,
        updatedAt: new Date()
      };
      
      await updateDoc(doc(firebaseDb, 'reportFolders', id), updateData);
      const folderDoc = await getDoc(doc(firebaseDb, 'reportFolders', id));
      if (!folderDoc.exists()) throw new Error('Pasta não encontrada após atualização');
      return { id, ...folderDoc.data() } as ReportFolder;
    } catch (error) {
      console.error('Erro ao atualizar pasta de relatórios:', error);
      throw error;
    }
  }

  async deleteReportFolder(id: string): Promise<void> {
    try {
      await deleteDoc(doc(firebaseDb, 'reportFolders', id));
    } catch (error) {
      console.error('Erro ao deletar pasta de relatórios:', error);
      throw error;
    }
  }
}

export const storage = new FirebaseStorage();