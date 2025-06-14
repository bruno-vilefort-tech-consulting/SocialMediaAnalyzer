import {
  type User, type InsertUser, type Client, type InsertClient,
  type Job, type InsertJob, type Question, type InsertQuestion,
  type CandidateList, type InsertCandidateList, type Candidate, type InsertCandidate, 
  type Selection, type InsertSelection, type Interview, type InsertInterview, 
  type Response, type InsertResponse, type ApiConfig, type InsertApiConfig, 
  type MessageLog, type InsertMessageLog
} from "@shared/schema";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDocs, getDoc, updateDoc, deleteDoc, query, where, setDoc } from "firebase/firestore";
import { db as pgDb } from "./db";
import { eq } from "drizzle-orm";
import {
  users, clients, jobs, questions, candidates, selections, interviews, responses, apiConfigs, messageLogs
} from "@shared/schema";
import bcrypt from "bcrypt";

// Initialize Firebase
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const firebaseDb = getFirestore(app);

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

export class FirebaseStorage implements IStorage {
  private generateId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

  // Users
  async getUserById(id: number): Promise<User | undefined> {
    try {
      const userDoc = await getDoc(doc(firebaseDb, 'users', id.toString()));
      if (userDoc.exists()) {
        return { id: parseInt(userDoc.id), ...userDoc.data() } as User;
      }
      return undefined;
    } catch (error) {
      console.error('Erro ao buscar usuário por ID:', error);
      return undefined;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const q = query(collection(firebaseDb, 'users'), where('email', '==', email));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const docData = querySnapshot.docs[0];
        return { id: parseInt(docData.id), ...docData.data() } as User;
      }
      return undefined;
    } catch (error) {
      console.error('Erro ao buscar usuário por email:', error);
      return undefined;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      const id = parseInt(this.generateId());
      const userData = {
        ...insertUser,
        createdAt: new Date(),
      };
      await setDoc(doc(firebaseDb, 'users', id.toString()), userData);
      return { id, ...userData } as User;
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      throw error;
    }
  }

  // Clients
  async getClients(): Promise<Client[]> {
    try {
      const querySnapshot = await getDocs(collection(firebaseDb, 'clients'));
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: parseInt(doc.id),
          ...data,
          contractStart: data.contractStart ? new Date(data.contractStart) : null,
          additionalLimitExpiry: data.additionalLimitExpiry ? new Date(data.additionalLimitExpiry) : null,
          contractEnd: data.contractEnd ? new Date(data.contractEnd) : null,
          createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
        };
      }) as Client[];
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
      return [];
    }
  }

  async getClientById(id: number): Promise<Client | undefined> {
    try {
      const clientDoc = await getDoc(doc(firebaseDb, 'clients', id.toString()));
      if (clientDoc.exists()) {
        const data = clientDoc.data();
        return {
          id: parseInt(clientDoc.id),
          ...data,
          contractStart: data.contractStart ? new Date(data.contractStart) : null,
          additionalLimitExpiry: data.additionalLimitExpiry ? new Date(data.additionalLimitExpiry) : null,
          contractEnd: data.contractEnd ? new Date(data.contractEnd) : null,
          createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
        } as Client;
      }
      return undefined;
    } catch (error) {
      console.error('Erro ao buscar cliente por ID:', error);
      return undefined;
    }
  }

  async getClientByEmail(email: string): Promise<Client | undefined> {
    try {
      const q = query(collection(firebaseDb, 'clients'), where('email', '==', email));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const docData = querySnapshot.docs[0];
        return { id: parseInt(docData.id), ...docData.data() } as Client;
      }
      return undefined;
    } catch (error) {
      console.error('Erro ao buscar cliente por email:', error);
      return undefined;
    }
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    try {
      console.log('Firebase createClient iniciado com dados:', insertClient);

      // Gerar ID único baseado em timestamp
      const id = Date.now();

      // Converter datas para formato serializable
      const clientData = {
        id,
        companyName: insertClient.companyName,
        email: insertClient.email,
        password: insertClient.password,
        cnpj: insertClient.cnpj,
        phone: insertClient.phone,
        status: insertClient.status || 'active',
        monthlyLimit: insertClient.monthlyLimit || 100,
        additionalLimit: insertClient.additionalLimit || 0,
        additionalLimitExpiry: insertClient.additionalLimitExpiry ? 
          insertClient.additionalLimitExpiry.toISOString() : null,
        contractStart: insertClient.contractStart ? 
          insertClient.contractStart.toISOString() : new Date().toISOString(),
        contractEnd: insertClient.contractEnd ? 
          insertClient.contractEnd.toISOString() : null,
        responsibleName: insertClient.responsibleName || '',
        responsiblePhone: insertClient.responsiblePhone || '',
        responsibleEmail: insertClient.responsibleEmail || '',
        createdAt: new Date().toISOString(),
      };

      console.log('Dados processados para Firebase:', clientData);

      await setDoc(doc(firebaseDb, 'clients', id.toString()), clientData);
      console.log('Cliente salvo no Firebase com ID:', id);

      // Retornar com datas convertidas de volta para Date objects
      return {
        ...clientData,
        contractStart: clientData.contractStart ? new Date(clientData.contractStart) : null,
        additionalLimitExpiry: clientData.additionalLimitExpiry ? new Date(clientData.additionalLimitExpiry) : null,
        contractEnd: clientData.contractEnd ? new Date(clientData.contractEnd) : null,
        createdAt: new Date(clientData.createdAt),
      } as Client;
    } catch (error) {
      console.error('Erro detalhado ao criar cliente no Firebase:', error);
      throw new Error(`Falha ao criar cliente: ${error.message}`);
    }
  }

  async updateClient(id: number, clientUpdate: Partial<Client>): Promise<Client> {
    try {
      // Processar datas para formato ISO antes de salvar
      const processedUpdate = { ...clientUpdate };

      if (processedUpdate.contractStart && processedUpdate.contractStart instanceof Date) {
        processedUpdate.contractStart = processedUpdate.contractStart.toISOString() as any;
      }

      // Para contractEnd: se for null, manter null; se for Date, converter para ISO
      if (processedUpdate.contractEnd === null) {
        processedUpdate.contractEnd = null as any;
      } else if (processedUpdate.contractEnd && processedUpdate.contractEnd instanceof Date) {
        processedUpdate.contractEnd = processedUpdate.contractEnd.toISOString() as any;
      }

      if (processedUpdate.additionalLimitExpiry && processedUpdate.additionalLimitExpiry instanceof Date) {
        processedUpdate.additionalLimitExpiry = processedUpdate.additionalLimitExpiry.toISOString() as any;
      }

      console.log('Atualizando cliente com dados:', processedUpdate);

      await updateDoc(doc(firebaseDb, 'clients', id.toString()), processedUpdate);
      const updated = await this.getClientById(id);
      return updated as Client;
    } catch (error) {
      console.error('Erro ao atualizar cliente:', error);
      throw error;
    }
  }

  async deleteClient(id: number): Promise<void> {
    try {
      await deleteDoc(doc(firebaseDb, 'clients', id.toString()));
    } catch (error) {
      console.error('Erro ao deletar cliente:', error);
      throw error;
    }
  }

  // Jobs
  async getJobs(): Promise<Job[]> {
    try {
      const querySnapshot = await getDocs(collection(firebaseDb, 'jobs'));
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: parseInt(doc.id),
          ...data,
          createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
        };
      }) as Job[];
    } catch (error) {
      console.error('Erro ao buscar todas as vagas:', error);
      return [];
    }
  }

  async getJobsByClientId(clientId: number): Promise<Job[]> {
    try {
      const q = query(collection(firebaseDb, 'jobs'), where('clientId', '==', clientId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          clientId: data.clientId,
          nomeVaga: data.nomeVaga,
          descricaoVaga: data.descricaoVaga,
          status: data.status || 'ativo',
          perguntas: data.perguntas || [],
          createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt)) : new Date(),
        };
      }) as Job[];
    } catch (error) {
      console.error('Erro ao buscar jobs por cliente:', error);
      return [];
    }
  }

  async getJobById(id: string | number): Promise<Job | undefined> {
    try {
      const jobId = id.toString();
      const jobDoc = await getDoc(doc(firebaseDb, 'jobs', jobId));
      if (jobDoc.exists()) {
        const data = jobDoc.data();
        return {
          id: jobDoc.id,
          clientId: data.clientId,
          nomeVaga: data.nomeVaga,
          descricaoVaga: data.descricaoVaga,
          status: data.status || 'ativo',
          perguntas: data.perguntas || [],
          createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt)) : new Date(),
        } as Job;
      }
      return undefined;
    } catch (error) {
      console.error('Erro ao buscar job por ID:', error);
      return undefined;
    }
  }

  async createJob(insertJob: any): Promise<Job> {
    try {
      const id = this.generateId();
      const jobData = {
        clientId: insertJob.clientId,
        nomeVaga: insertJob.nomeVaga,
        descricaoVaga: insertJob.descricaoVaga || '',
        status: insertJob.status || 'ativo',
        perguntas: insertJob.perguntas || [],
        createdAt: new Date(),
      };
      
      console.log('Salvando vaga no Firebase:', jobData);
      await setDoc(doc(firebaseDb, 'jobs', id), jobData);
      return { id, ...jobData } as Job;
    } catch (error) {
      console.error('Erro ao criar job:', error);
      throw error;
    }
  }

  async updateJob(id: string | number, jobUpdate: any): Promise<Job> {
    try {
      const jobId = id.toString();
      console.log('Tentando atualizar job com ID:', jobId);
      
      // Listar todos os documentos para debug
      const allDocs = await getDocs(collection(firebaseDb, 'jobs'));
      console.log('Documentos existentes no Firebase:');
      allDocs.forEach(doc => {
        console.log('ID:', doc.id, 'Dados:', doc.data());
      });
      
      // Verificar se o documento existe
      const jobDoc = await getDoc(doc(firebaseDb, 'jobs', jobId));
      if (!jobDoc.exists()) {
        console.log(`Documento ${jobId} não encontrado. Tentando buscar por outros critérios...`);
        
        // Buscar documento que tenha o mesmo ID nos dados
        const querySnapshot = await getDocs(collection(firebaseDb, 'jobs'));
        let foundDoc: any = null;
        
        querySnapshot.forEach((docSnapshot) => {
          const data = docSnapshot.data();
          // Verificar se o ID do documento contém o jobId ou se o ID é igual
          if (docSnapshot.id.includes(jobId) || data.id === jobId || data.id === parseInt(jobId)) {
            foundDoc = docSnapshot;
            console.log('Encontrado documento alternativo:', docSnapshot.id);
          }
        });
        
        if (!foundDoc) {
          throw new Error(`Job com ID ${jobId} não encontrado em lugar algum`);
        }
        
        // Usar o ID do documento encontrado
        const realDocId = foundDoc.id;
        const existingData = foundDoc.data();
        const updatedData = {
          ...existingData,
          ...jobUpdate,
          id: jobId,
          createdAt: existingData.createdAt || new Date(),
        };
        
        await setDoc(doc(firebaseDb, 'jobs', realDocId), updatedData);
        const updated = await this.getJobById(realDocId);
        return updated as Job;
      }
      
      // Documento encontrado normalmente
      const existingData = jobDoc.data();
      const updatedData = {
        ...existingData,
        ...jobUpdate,
        id: jobId,
        createdAt: existingData.createdAt || new Date(),
      };
      
      await setDoc(doc(firebaseDb, 'jobs', jobId), updatedData);
      const updated = await this.getJobById(jobId);
      return updated as Job;
    } catch (error) {
      console.error('Erro ao atualizar job:', error);
      throw error;
    }
  }

  async deleteJob(id: string | number): Promise<void> {
    try {
      const jobId = id.toString();
      console.log('Tentando deletar job com ID:', jobId);
      
      // Primeiro, tentar encontrar o documento pelo ID exato
      const jobDoc = await getDoc(doc(firebaseDb, 'jobs', jobId));
      
      if (jobDoc.exists()) {
        await deleteDoc(doc(firebaseDb, 'jobs', jobId));
        console.log('Job deletado com sucesso:', jobId);
        return;
      }
      
      // Se não encontrou, buscar por documentos que contenham o ID base
      const allJobsSnapshot = await getDocs(collection(firebaseDb, 'jobs'));
      const foundDoc = allJobsSnapshot.docs.find(doc => {
        const docId = doc.id;
        return docId.startsWith(jobId) || docId.includes(jobId);
      });
      
      if (foundDoc) {
        console.log('Encontrado documento alternativo para deletar:', foundDoc.id);
        await deleteDoc(doc(firebaseDb, 'jobs', foundDoc.id));
        console.log('Job deletado com sucesso:', foundDoc.id);
        return;
      }
      
      console.log('Job não encontrado para deletar:', jobId);
      throw new Error('Job não encontrado');
    } catch (error) {
      console.error('Erro ao deletar job:', error);
      throw error;
    }
  }

  // Questions
  async getQuestionsByJobId(jobId: string | number): Promise<Question[]> {
    try {
      const jobIdStr = String(jobId);
      const q = query(collection(firebaseDb, 'questions'), where('vagaId', '==', jobIdStr));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: parseInt(doc.id),
          vagaId: data.vagaId,
          perguntaCandidato: data.perguntaCandidato,
          respostaPerfeita: data.respostaPerfeita,
          numeroPergunta: data.numeroPergunta,
          createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
        };
      }) as Question[];
    } catch (error) {
      console.error('Erro ao buscar questions por job:', error);
      return [];
    }
  }

  async createQuestion(insertQuestion: InsertQuestion): Promise<Question> {
    try {
      const id = parseInt(this.generateId());
      const questionData = {
        vagaId: insertQuestion.vagaId,
        perguntaCandidato: insertQuestion.perguntaCandidato,
        respostaPerfeita: insertQuestion.respostaPerfeita,
        numeroPergunta: insertQuestion.numeroPergunta,
        createdAt: new Date(),
      };
      await setDoc(doc(firebaseDb, 'questions', id.toString()), questionData);
      return { id, ...questionData } as Question;
    } catch (error) {
      console.error('Erro ao criar question:', error);
      throw error;
    }
  }

  async updateQuestion(id: number, questionUpdate: Partial<Question>): Promise<Question> {
    try {
      await updateDoc(doc(firebaseDb, 'questions', id.toString()), questionUpdate);
      const updated = await this.getQuestionById(id);
      return updated as Question;
    } catch (error) {
      console.error('Erro ao atualizar question:', error);
      throw error;
    }
  }

  async getQuestionById(id: number): Promise<Question | undefined> {
    try {
      const questionDoc = await getDoc(doc(firebaseDb, 'questions', id.toString()));
      if (questionDoc.exists()) {
        return { id: parseInt(questionDoc.id), ...questionDoc.data() } as Question;
      }
      return undefined;
    } catch (error) {
      console.error('Erro ao buscar question por ID:', error);
      return undefined;
    }
  }

  async deleteQuestion(id: number): Promise<void> {
    try {
      await deleteDoc(doc(firebaseDb, 'questions', id.toString()));
    } catch (error) {
      console.error('Erro ao deletar question:', error);
      throw error;
    }
  }

  // Candidate Lists
  async getCandidateListsByClientId(clientId: number): Promise<CandidateList[]> {
    try {
      const q = query(collection(firebaseDb, 'candidateLists'), where('clientId', '==', clientId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: parseInt(doc.id),
        ...doc.data()
      })) as CandidateList[];
    } catch (error) {
      console.error('Erro ao buscar listas de candidatos por cliente:', error);
      return [];
    }
  }

  async getCandidateListById(id: number): Promise<CandidateList | undefined> {
    try {
      const listDoc = await getDoc(doc(firebaseDb, 'candidateLists', id.toString()));
      if (listDoc.exists()) {
        return { id: parseInt(listDoc.id), ...listDoc.data() } as CandidateList;
      }
      return undefined;
    } catch (error) {
      console.error('Erro ao buscar lista de candidatos por ID:', error);
      return undefined;
    }
  }

  async createCandidateList(insertList: InsertCandidateList): Promise<CandidateList> {
    try {
      const id = parseInt(this.generateId());
      const listData = {
        ...insertList,
        createdAt: new Date(),
      };
      await setDoc(doc(firebaseDb, 'candidateLists', id.toString()), listData);
      return { id, ...listData } as CandidateList;
    } catch (error) {
      console.error('Erro ao criar lista de candidatos:', error);
      throw error;
    }
  }

  async updateCandidateList(id: number, listUpdate: Partial<CandidateList>): Promise<CandidateList> {
    try {
      await updateDoc(doc(firebaseDb, 'candidateLists', id.toString()), listUpdate);
      const updated = await this.getCandidateListById(id);
      return updated as CandidateList;
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
  async getCandidatesByClientId(clientId: number): Promise<Candidate[]> {
    try {
      const candidatesSnapshot = await getDocs(collection(firebaseDb, 'candidates'));
      const candidates = candidatesSnapshot.docs
        .map(doc => ({ id: parseInt(doc.id), ...doc.data() } as Candidate))
        .filter(candidate => candidate.clientId === clientId);
      return candidates;
    } catch (error) {
      console.error('Erro ao buscar candidates por clientId:', error);
      throw error;
    }
  }

  async getCandidatesByListId(listId: number): Promise<Candidate[]> {
    try {
      const candidatesSnapshot = await getDocs(collection(firebaseDb, 'candidates'));
      const candidates = candidatesSnapshot.docs
        .map(doc => ({ id: parseInt(doc.id), ...doc.data() } as Candidate))
        .filter(candidate => candidate.listId === listId);
      return candidates;
    } catch (error) {
      console.error('Erro ao buscar candidates por listId:', error);
      throw error;
    }
  }

  async getCandidateById(id: number): Promise<Candidate | undefined> {
    try {
      const candidateDoc = await getDoc(doc(firebaseDb, 'candidates', id.toString()));
      if (candidateDoc.exists()) {
        return { id: parseInt(candidateDoc.id), ...candidateDoc.data() } as Candidate;
      }
      return undefined;
    } catch (error) {
      console.error('Erro ao buscar candidate por ID:', error);
      return undefined;
    }
  }

  async createCandidate(insertCandidate: InsertCandidate): Promise<Candidate> {
    try {
      const id = parseInt(this.generateId());
      const candidateData = {
        ...insertCandidate,
        createdAt: new Date(),
      };
      await setDoc(doc(firebaseDb, 'candidates', id.toString()), candidateData);
      return { id, ...candidateData } as Candidate;
    } catch (error) {
      console.error('Erro ao criar candidate:', error);
      throw error;
    }
  }

  async createCandidates(insertCandidates: InsertCandidate[]): Promise<Candidate[]> {
    try {
      const candidates = [];
      for (const insertCandidate of insertCandidates) {
        const candidate = await this.createCandidate(insertCandidate);
        candidates.push(candidate);
      }
      return candidates;
    } catch (error) {
      console.error('Erro ao criar candidates em lote:', error);
      throw error;
    }
  }

  async updateCandidate(id: number, candidateUpdate: Partial<Candidate>): Promise<Candidate> {
    try {
      await updateDoc(doc(firebaseDb, 'candidates', id.toString()), candidateUpdate);
      const updated = await this.getCandidateById(id);
      return updated as Candidate;
    } catch (error) {
      console.error('Erro ao atualizar candidate:', error);
      throw error;
    }
  }

  async deleteCandidate(id: number): Promise<void> {
    try {
      await deleteDoc(doc(firebaseDb, 'candidates', id.toString()));
    } catch (error) {
      console.error('Erro ao deletar candidate:', error);
      throw error;
    }
  }

  // Selections
  async getSelectionsByClientId(clientId: number): Promise<Selection[]> {
    try {
      console.log(`Buscando selections para clientId: ${clientId}`);
      const q = query(collection(firebaseDb, 'selections'), where('clientId', '==', clientId));
      const querySnapshot = await getDocs(q);
      const selections = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: parseInt(doc.id),
          ...data,
          createdAt: data.createdAt ? new Date(data.createdAt.seconds * 1000) : new Date(),
          deadline: data.deadline ? new Date(data.deadline.seconds * 1000) : null,
          scheduledFor: data.scheduledFor ? new Date(data.scheduledFor.seconds * 1000) : null
        };
      }) as Selection[];
      console.log(`Encontradas ${selections.length} selections para cliente ${clientId}`);
      return selections;
    } catch (error) {
      console.error('Erro ao buscar selections por cliente:', error);
      return [];
    }
  }

  async getSelectionById(id: number): Promise<Selection | undefined> {
    try {
      const selectionDoc = await getDoc(doc(firebaseDb, 'selections', id.toString()));
      if (selectionDoc.exists()) {
        return { id: parseInt(selectionDoc.id), ...selectionDoc.data() } as Selection;
      }
      return undefined;
    } catch (error) {
      console.error('Erro ao buscar selection por ID:', error);
      return undefined;
    }
  }

  async createSelection(insertSelection: InsertSelection): Promise<Selection> {
    try {
      const id = parseInt(this.generateId());
      const selectionData = {
        ...insertSelection,
        status: insertSelection.status || 'draft',
        scheduledFor: insertSelection.scheduledFor || null,
        createdAt: new Date(),
      };
      await setDoc(doc(firebaseDb, 'selections', id.toString()), selectionData);
      return { id, ...selectionData } as Selection;
    } catch (error) {
      console.error('Erro ao criar selection:', error);
      throw error;
    }
  }

  async updateSelection(id: number, selectionUpdate: Partial<Selection>): Promise<Selection> {
    try {
      await updateDoc(doc(firebaseDb, 'selections', id.toString()), selectionUpdate);
      const updated = await this.getSelectionById(id);
      return updated as Selection;
    } catch (error) {
      console.error('Erro ao atualizar selection:', error);
      throw error;
    }
  }

  async deleteSelection(id: number): Promise<void> {
    try {
      await deleteDoc(doc(firebaseDb, 'selections', id.toString()));
    } catch (error) {
      console.error('Erro ao deletar selection:', error);
      throw error;
    }
  }

  // Interviews
  async getInterviewsBySelectionId(selectionId: number): Promise<Interview[]> {
    try {
      const q = query(collection(firebaseDb, 'interviews'), where('selectionId', '==', selectionId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: parseInt(doc.id),
        ...doc.data()
      })) as Interview[];
    } catch (error) {
      console.error('Erro ao buscar interviews por selection:', error);
      return [];
    }
  }

  async getInterviewById(id: number): Promise<Interview | undefined> {
    try {
      const interviewDoc = await getDoc(doc(firebaseDb, 'interviews', id.toString()));
      if (interviewDoc.exists()) {
        return { id: parseInt(interviewDoc.id), ...interviewDoc.data() } as Interview;
      }
      return undefined;
    } catch (error) {
      console.error('Erro ao buscar interview por ID:', error);
      return undefined;
    }
  }

  async getInterviewByToken(token: string): Promise<Interview | undefined> {
    try {
      const q = query(collection(firebaseDb, 'interviews'), where('token', '==', token));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const docData = querySnapshot.docs[0];
        return { id: parseInt(docData.id), ...docData.data() } as Interview;
      }
      return undefined;
    } catch (error) {
      console.error('Erro ao buscar interview por token:', error);
      return undefined;
    }
  }

  async createInterview(insertInterview: InsertInterview): Promise<Interview> {
    try {
      const id = parseInt(this.generateId());
      const interviewData = {
        ...insertInterview,
        status: insertInterview.status || 'pending',
        startedAt: insertInterview.startedAt || null,
        completedAt: insertInterview.completedAt || null,
        totalScore: insertInterview.totalScore || null,
        aiAnalysis: insertInterview.aiAnalysis || {},
        category: insertInterview.category || null,
        createdAt: new Date(),
      };
      await setDoc(doc(firebaseDb, 'interviews', id.toString()), interviewData);
      return { id, ...interviewData } as Interview;
    } catch (error) {
      console.error('Erro ao criar interview:', error);
      throw error;
    }
  }

  async updateInterview(id: number, interviewUpdate: Partial<Interview>): Promise<Interview> {
    try {
      await updateDoc(doc(firebaseDb, 'interviews', id.toString()), interviewUpdate);
      const updated = await this.getInterviewById(id);
      return updated as Interview;
    } catch (error) {
      console.error('Erro ao atualizar interview:', error);
      throw error;
    }
  }

  // Responses
  async getResponsesByInterviewId(interviewId: number): Promise<Response[]> {
    try {
      const q = query(collection(firebaseDb, 'responses'), where('interviewId', '==', interviewId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: parseInt(doc.id),
        ...doc.data()
      })) as Response[];
    } catch (error) {
      console.error('Erro ao buscar responses por interview:', error);
      return [];
    }
  }

  async createResponse(insertResponse: InsertResponse): Promise<Response> {
    try {
      const id = parseInt(this.generateId());
      const responseData = {
        ...insertResponse,
        aiAnalysis: insertResponse.aiAnalysis || {},
        audioUrl: insertResponse.audioUrl || null,
        transcription: insertResponse.transcription || null,
        score: insertResponse.score || null,
        recordingDuration: insertResponse.recordingDuration || null,
        createdAt: new Date(),
      };
      await setDoc(doc(firebaseDb, 'responses', id.toString()), responseData);
      return { id, ...responseData } as Response;
    } catch (error) {
      console.error('Erro ao criar response:', error);
      throw error;
    }
  }

  async updateResponse(id: number, responseUpdate: Partial<Response>): Promise<Response> {
    try {
      await updateDoc(doc(firebaseDb, 'responses', id.toString()), responseUpdate);
      const updated = await this.getResponseById(id);
      return updated as Response;
    } catch (error) {
      console.error('Erro ao atualizar response:', error);
      throw error;
    }
  }

  async getResponseById(id: number): Promise<Response | undefined> {
    try {
      const responseDoc = await getDoc(doc(firebaseDb, 'responses', id.toString()));
      if (responseDoc.exists()) {
        return { id: parseInt(responseDoc.id), ...responseDoc.data() } as Response;
      }
      return undefined;
    } catch (error) {
      console.error('Erro ao buscar response por ID:', error);
      return undefined;
    }
  }

  // API Config
  async getApiConfig(): Promise<ApiConfig | undefined> {
    try {
      const configDoc = await getDoc(doc(firebaseDb, 'configs', 'main'));
      if (configDoc.exists()) {
        return { id: 1, ...configDoc.data() } as ApiConfig;
      }
      return undefined;
    } catch (error) {
      console.error('Erro ao buscar config:', error);
      return undefined;
    }
  }

  async upsertApiConfig(config: InsertApiConfig): Promise<ApiConfig> {
    try {
      const configData = {
        ...config,
        updatedAt: new Date(),
      };
      await setDoc(doc(firebaseDb, 'configs', 'main'), configData);
      return { id: 1, ...configData } as ApiConfig;
    } catch (error) {
      console.error('Erro ao upsert config:', error);
      throw error;
    }
  }

  // Message Logs
  async createMessageLog(insertLog: InsertMessageLog): Promise<MessageLog> {
    try {
      const id = parseInt(this.generateId());
      const logData = {
        ...insertLog,
        sentAt: new Date(),
      };
      await setDoc(doc(firebaseDb, 'messageLogs', id.toString()), logData);
      return { id, ...logData } as MessageLog;
    } catch (error) {
      console.error('Erro ao criar log:', error);
      throw error;
    }
  }

  async getMessageLogsByInterviewId(interviewId: number): Promise<MessageLog[]> {
    try {
      const q = query(collection(firebaseDb, 'messageLogs'), where('interviewId', '==', interviewId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: parseInt(doc.id),
        ...doc.data()
      })) as MessageLog[];
    } catch (error) {
      console.error('Erro ao buscar logs por interview:', error);
      return [];
    }
  }

  // Statistics
  async getInterviewStats(): Promise<{
    totalClients: number;
    totalInterviews: number;
    pendingInterviews: number;
    avgScore: number;
  }> {
    try {
      const clientsSnapshot = await getDocs(collection(firebaseDb, 'clients'));
      const interviewsSnapshot = await getDocs(collection(firebaseDb, 'interviews'));

      const totalClients = clientsSnapshot.size;
      const totalInterviews = interviewsSnapshot.size;

      const interviews = interviewsSnapshot.docs.map(doc => doc.data());
      const pendingInterviews = interviews.filter(i => i.status === 'pending').length;

      const completedInterviews = interviews.filter(i => i.totalScore !== null && i.totalScore !== undefined);
      const avgScore = completedInterviews.length > 0 
        ? completedInterviews.reduce((sum, i) => sum + (i.totalScore || 0), 0) / completedInterviews.length
        : 0;

      return {
        totalClients,
        totalInterviews,
        pendingInterviews,
        avgScore
      };
    } catch (error) {
      console.error('Erro ao calcular estatísticas:', error);
      return { totalClients: 0, totalInterviews: 0, pendingInterviews: 0, avgScore: 0 };
    }
  }

  async getClientStats(clientId: number): Promise<{
    activeJobs: number;
    totalCandidates: number;
    monthlyInterviews: number;
    monthlyLimit: number;
    currentUsage: number;
  }> {
    try {
      const jobsSnapshot = await getDocs(query(collection(firebaseDb, 'jobs'), where('clientId', '==', clientId)));
      const candidatesSnapshot = await getDocs(query(collection(firebaseDb, 'candidates'), where('clientId', '==', clientId)));

      const jobs = jobsSnapshot.docs.map(doc => doc.data());
      const activeJobs = jobs.filter(job => job.status === 'active').length;
      const totalCandidates = candidatesSnapshot.size;

      const client = await this.getClientById(clientId);
      const monthlyLimit = client?.monthlyLimit || 100;

      const currentMonth = new Date();
      currentMonth.setDate(1);
      currentMonth.setHours(0, 0, 0, 0);

      const interviewsSnapshot = await getDocs(collection(firebaseDb, 'interviews'));
      const interviews = interviewsSnapshot.docs.map(doc => doc.data());
      const monthlyInterviews = interviews.filter(interview => {
        const interviewDate = new Date(interview.createdAt?.seconds ? interview.createdAt.seconds * 1000 : interview.createdAt);
        return interviewDate >= currentMonth;
      }).length;

      return {
        activeJobs,
        totalCandidates,
        monthlyInterviews,
        monthlyLimit,
        currentUsage: monthlyInterviews
      };
    } catch (error) {
      console.error('Erro ao calcular estatísticas do cliente:', error);
      return { activeJobs: 0, totalCandidates: 0, monthlyInterviews: 0, monthlyLimit: 100, currentUsage: 0 };
    }
  }
}

export class DatabaseStorage implements IStorage {
  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await pgDb.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await pgDb.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await pgDb
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  // Clients
  async getClients(): Promise<Client[]> {
    return await pgDb.select().from(clients);
  }

  async getClientById(id: number): Promise<Client | undefined> {
    const [client] = await pgDb.select().from(clients).where(eq(clients.id, id));
    return client || undefined;
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

  // Jobs
  async getJobsByClientId(clientId: number): Promise<Job[]> {
    return await pgDb.select().from(jobs).where(eq(jobs.clientId, clientId));
  }

  async getJobById(id: number): Promise<Job | undefined> {
    const [job] = await pgDb.select().from(jobs).where(eq(jobs.id, id));
    return job || undefined;
  }

  async createJob(insertJob: InsertJob): Promise<Job> {
    const [job] = await pgDb
      .insert(jobs)
      .values(insertJob)
      .returning();
    return job;
  }

  async updateJob(id: number, jobUpdate: Partial<Job>): Promise<Job> {
    const [job] = await pgDb
      .update(jobs)
      .set(jobUpdate)
      .where(eq(jobs.id, id))
      .returning();
    return job;
  }

  async deleteJob(id: number): Promise<void> {
    await pgDb.delete(jobs).where(eq(jobs.id, id));
  }

  // Questions
  async getQuestionsByJobId(jobId: number): Promise<Question[]> {
    return await pgDb.select().from(questions).where(eq(questions.jobId, jobId));
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

  // Candidates
  async getCandidatesByClientId(clientId: number): Promise<Candidate[]> {
    return await pgDb.select().from(candidates).where(eq(candidates.clientId, clientId));
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
    const createdCandidates = await pgDb
      .insert(candidates)
      .values(insertCandidates)
      .returning();
    return createdCandidates;
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

  // Selections
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

  // Interviews
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

  // Responses
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

  // API Config
  async getApiConfig(): Promise<ApiConfig | undefined> {
    const [config] = await pgDb.select().from(apiConfigs);
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

  // Message Logs
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

  // Statistics
  async getInterviewStats(): Promise<{
    totalClients: number;
    totalInterviews: number;
    pendingInterviews: number;
    avgScore: number;
  }> {
    const allClients = await pgDb.select().from(clients);
    const allInterviews = await pgDb.select().from(interviews);

    const totalClients = allClients.length;
    const totalInterviews = allInterviews.length;
    const pendingInterviews = allInterviews.filter((i: any) => i.status === 'pending').length;

    const completedInterviews = allInterviews.filter((i: any) => i.totalScore !== null);
    const avgScore = completedInterviews.length > 0 
      ? completedInterviews.reduce((sum: any, i: any) => sum + (i.totalScore || 0), 0) / completedInterviews.length
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
    const clientJobs = await pgDb.select().from(jobs).where(eq(jobs.clientId, clientId));
    const activeJobs = clientJobs.filter((job: any) => job.status === 'active').length;

    const clientCandidates = await pgDb.select().from(candidates).where(eq(candidates.clientId, clientId));
    const totalCandidates = clientCandidates.length;

    const client = await this.getClientById(clientId);
    const monthlyLimit = client?.monthlyLimit || 100;

    // Count interviews from current month
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    const allInterviews = await pgDb.select().from(interviews);
    const monthlyInterviews = allInterviews.filter((interview: any) => {
      const interviewDate = new Date(interview.createdAt || '');
      return interviewDate >= currentMonth;
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

// Initialize storage and create master user if needed
export const storage = new FirebaseStorage();

// Create master user on startup
const initializeStorage = async () => {
  try {
    const masterUser = await storage.getUserByEmail('daniel@grupomaximuns.com.br');
    if (!masterUser) {
      const hashedPassword = await bcrypt.hash('daniel580190', 10);
      await storage.createUser({
        name: 'Daniel - Grupo Maximus',
        email: 'daniel@grupomaximuns.com.br',
        password: hashedPassword,
        role: 'master'
      });
      console.log('✅ Usuário master criado no Firebase');
    } else {
      console.log('✅ Usuário master já existe no Firebase');
    }
  } catch (error) {
    console.error('❌ Erro ao inicializar storage:', error);
  }
};

initializeStorage();