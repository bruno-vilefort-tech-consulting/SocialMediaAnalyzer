import {
  type User, type InsertUser, type Client, type InsertClient,
  type Job, type InsertJob, type Question, type InsertQuestion,
  type CandidateList, type InsertCandidateList, type Candidate, type InsertCandidate, 
  type Selection, type InsertSelection, type Interview, type InsertInterview, 
  type Response, type InsertResponse, type ApiConfig, type InsertApiConfig, 
  type MessageLog, type InsertMessageLog
} from "@shared/schema";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDocs, getDoc, updateDoc, deleteDoc, query, where, setDoc, addDoc, orderBy, writeBatch } from "firebase/firestore";
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
export const firebaseDb = getFirestore(app);

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
  getJobs(): Promise<Job[]>;

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
  
  // Users
  async getUserById(id: string | number): Promise<User | undefined> {
    const docRef = doc(firebaseDb, "users", String(id));
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as User : undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const usersQuery = query(collection(firebaseDb, "users"), where("email", "==", email));
    const querySnapshot = await getDocs(usersQuery);
    if (querySnapshot.empty) return undefined;
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as User;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const userId = Date.now().toString();
    const userData = {
      ...insertUser,
      id: userId,
      createdAt: new Date()
    };
    await setDoc(doc(firebaseDb, "users", userId), userData);
    return userData as User;
  }

  // Clients
  async getClients(): Promise<Client[]> {
    const snapshot = await getDocs(collection(firebaseDb, "clients"));
    return snapshot.docs.map(doc => ({ id: parseInt(doc.id), ...doc.data() } as Client));
  }

  async getClientById(id: number): Promise<Client | undefined> {
    const docRef = doc(firebaseDb, "clients", String(id));
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: parseInt(docSnap.id), ...docSnap.data() } as Client : undefined;
  }

  async getClientByEmail(email: string): Promise<Client | undefined> {
    const clientsQuery = query(collection(firebaseDb, "clients"), where("email", "==", email));
    const querySnapshot = await getDocs(clientsQuery);
    if (querySnapshot.empty) return undefined;
    const doc = querySnapshot.docs[0];
    return { id: parseInt(doc.id), ...doc.data() } as Client;
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const clientId = Date.now();
    const clientData = {
      ...insertClient,
      id: clientId,
      createdAt: new Date()
    };
    await setDoc(doc(firebaseDb, "clients", String(clientId)), clientData);
    return clientData as Client;
  }

  async updateClient(id: number, clientUpdate: Partial<Client>): Promise<Client> {
    const docRef = doc(firebaseDb, "clients", String(id));
    await updateDoc(docRef, clientUpdate);
    const updatedDoc = await getDoc(docRef);
    return { id, ...updatedDoc.data() } as Client;
  }

  async deleteClient(id: number): Promise<void> {
    console.log(`🗑️ Storage: Deletando cliente ID ${id} do Firebase`);
    const docRef = doc(firebaseDb, "clients", String(id));
    
    // Verificar se o documento existe antes de deletar
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      console.log(`❌ Cliente ID ${id} não encontrado no Firebase`);
      throw new Error(`Cliente com ID ${id} não encontrado`);
    }
    
    console.log(`✅ Cliente encontrado, deletando: ${JSON.stringify(docSnap.data())}`);
    await deleteDoc(docRef);
    console.log(`✅ Cliente ID ${id} deletado com sucesso do Firebase`);
  }

  // Jobs
  async getJobsByClientId(clientId: number): Promise<Job[]> {
    console.log(`🔍 Buscando vagas do cliente ID: ${clientId}`);
    const snapshot = await getDocs(collection(firebaseDb, "jobs"));
    const allJobs = snapshot.docs.map(doc => {
      const data = doc.data();
      console.log(`📄 Vaga encontrada: ID=${doc.id}, clientId=${data.clientId}, nome=${data.nomeVaga}`);
      return { 
        id: doc.id, 
        ...data,
        perguntas: data.perguntas || []
      } as Job;
    });
    
    const filteredJobs = allJobs.filter(job => job.clientId === clientId);
    console.log(`📋 Vagas filtradas para cliente ${clientId}: ${filteredJobs.length}`);
    return filteredJobs;
  }

  async getJobs(): Promise<Job[]> {
    console.log('🔍 Buscando todas as vagas no Firebase...');
    const snapshot = await getDocs(collection(firebaseDb, "jobs"));
    const jobs = snapshot.docs.map(doc => {
      const data = doc.data();
      console.log(`📄 Vaga: ID=${doc.id}, cliente=${data.clientId}, nome=${data.nomeVaga}`);
      return { 
        id: doc.id, 
        ...data,
        perguntas: data.perguntas || []
      } as Job;
    });
    console.log(`📊 Total de vagas encontradas: ${jobs.length}`);
    return jobs;
  }

  async getJobById(id: string): Promise<Job | undefined> {
    const docRef = doc(firebaseDb, "jobs", id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return undefined;
    return { 
      id: docSnap.id, 
      ...docSnap.data(),
      perguntas: docSnap.data().perguntas || []
    } as Job;
  }

  async createJob(insertJob: InsertJob): Promise<Job> {
    const jobId = Date.now().toString();
    const jobData = {
      ...insertJob,
      id: jobId,
      createdAt: new Date(),
      perguntas: []
    };
    await setDoc(doc(firebaseDb, "jobs", jobId), jobData);
    return jobData as Job;
  }

  async updateJob(id: string, jobUpdate: Partial<Job>): Promise<Job> {
    const docRef = doc(firebaseDb, "jobs", id);
    await updateDoc(docRef, jobUpdate);
    const updatedDoc = await getDoc(docRef);
    return { id, ...updatedDoc.data() } as Job;
  }

  async deleteJob(id: string): Promise<void> {
    console.log(`🗑️ Tentando deletar vaga Firebase ID: ${id}`);
    
    // Verificar se a vaga existe antes de deletar
    const docRef = doc(firebaseDb, "jobs", id);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      console.log(`❌ Vaga ${id} não encontrada no Firebase`);
      return;
    }
    
    console.log(`📄 Vaga encontrada: ${JSON.stringify(docSnap.data())}`);
    
    // Deletar do Firebase
    await deleteDoc(docRef);
    console.log(`✅ Vaga ${id} deletada do Firebase`);
    
    // Verificar se foi deletada
    const checkDoc = await getDoc(docRef);
    if (!checkDoc.exists()) {
      console.log(`✅ Confirmado: Vaga ${id} removida do Firebase`);
    } else {
      console.log(`❌ ERRO: Vaga ${id} ainda existe no Firebase após exclusão!`);
    }
  }

  // Questions
  async getQuestionsByJobId(jobId: string): Promise<Question[]> {
    const jobDoc = await this.getJobById(jobId);
    return jobDoc?.perguntas || [];
  }

  async createQuestion(insertQuestion: InsertQuestion): Promise<Question> {
    const questionId = Date.now();
    const questionData = {
      ...insertQuestion,
      id: questionId,
      createdAt: new Date()
    };

    // Update job with new question
    const jobDoc = await this.getJobById(insertQuestion.vagaId);
    if (jobDoc) {
      const updatedPerguntas = [...(jobDoc.perguntas || []), questionData];
      await updateDoc(doc(firebaseDb, "jobs", insertQuestion.vagaId), {
        perguntas: updatedPerguntas
      });
    }

    return questionData as Question;
  }

  async updateQuestion(id: number, questionUpdate: Partial<Question>): Promise<Question> {
    // Implementation for updating questions within job document
    throw new Error("Method not implemented");
  }

  async deleteQuestion(id: number): Promise<void> {
    // Implementation for deleting questions within job document
    throw new Error("Method not implemented");
  }

  // Candidate Lists
  async getCandidateListsByClientId(clientId: number): Promise<CandidateList[]> {
    const snapshot = await getDocs(collection(firebaseDb, "candidateLists"));
    return snapshot.docs
      .map(doc => ({ id: parseInt(doc.id), ...doc.data() } as CandidateList))
      .filter(list => list.clientId === clientId);
  }

  async getCandidateListById(id: number): Promise<CandidateList | undefined> {
    const docRef = doc(firebaseDb, "candidateLists", String(id));
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: parseInt(docSnap.id), ...docSnap.data() } as CandidateList : undefined;
  }

  async createCandidateList(insertList: InsertCandidateList): Promise<CandidateList> {
    const listId = Date.now();
    const listData = {
      ...insertList,
      id: listId,
      createdAt: new Date()
    };
    await setDoc(doc(firebaseDb, "candidateLists", String(listId)), listData);
    return listData as CandidateList;
  }

  async updateCandidateList(id: number, listUpdate: Partial<CandidateList>): Promise<CandidateList> {
    const docRef = doc(firebaseDb, "candidateLists", String(id));
    await updateDoc(docRef, listUpdate);
    const updatedDoc = await getDoc(docRef);
    return { id, ...updatedDoc.data() } as CandidateList;
  }

  async deleteCandidateList(id: number): Promise<void> {
    await deleteDoc(doc(firebaseDb, "candidateLists", String(id)));
  }

  // Candidates
  async getCandidatesByClientId(clientId: number): Promise<Candidate[]> {
    const snapshot = await getDocs(collection(firebaseDb, "candidates"));
    const allCandidates = snapshot.docs.map(doc => ({ id: parseInt(doc.id), ...doc.data() } as Candidate));
    
    // Filter candidates by clientId
    return allCandidates.filter(candidate => {
      // Check if candidate belongs to this client directly or through a list
      return candidate.clientId === clientId || candidate.clientId === `clientId=${clientId}`;
    });
  }

  async getCandidatesByListId(listId: number): Promise<Candidate[]> {
    const snapshot = await getDocs(collection(firebaseDb, "candidates"));
    return snapshot.docs
      .map(doc => ({ id: parseInt(doc.id), ...doc.data() } as Candidate))
      .filter(candidate => candidate.listId === listId);
  }

  async getCandidateById(id: number): Promise<Candidate | undefined> {
    const docRef = doc(firebaseDb, "candidates", String(id));
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: parseInt(docSnap.id), ...docSnap.data() } as Candidate : undefined;
  }

  async createCandidate(insertCandidate: InsertCandidate): Promise<Candidate> {
    // Generate unique candidate ID
    const candidateId = Date.now() + Math.floor(Math.random() * 1000);
    const candidateData = {
      ...insertCandidate,
      id: candidateId,
      createdAt: new Date()
    };
    await setDoc(doc(firebaseDb, "candidates", String(candidateId)), candidateData);
    return candidateData as Candidate;
  }

  async createCandidates(insertCandidates: InsertCandidate[]): Promise<Candidate[]> {
    const batch = writeBatch(firebaseDb);
    const candidates: Candidate[] = [];

    for (const insertCandidate of insertCandidates) {
      const candidateId = Date.now() + Math.floor(Math.random() * 1000) + candidates.length;
      const candidateData = {
        ...insertCandidate,
        id: candidateId,
        createdAt: new Date()
      };
      
      const candidateRef = doc(firebaseDb, "candidates", String(candidateId));
      batch.set(candidateRef, candidateData);
      candidates.push(candidateData as Candidate);
    }

    await batch.commit();
    return candidates;
  }

  async updateCandidate(id: number, candidateUpdate: Partial<Candidate>): Promise<Candidate> {
    const docRef = doc(firebaseDb, "candidates", String(id));
    await updateDoc(docRef, candidateUpdate);
    const updatedDoc = await getDoc(docRef);
    return { id, ...updatedDoc.data() } as Candidate;
  }

  async deleteCandidate(id: number): Promise<void> {
    await deleteDoc(doc(firebaseDb, "candidates", String(id)));
  }

  // Selections
  async getSelectionsByClientId(clientId: number): Promise<Selection[]> {
    const snapshot = await getDocs(collection(firebaseDb, "selections"));
    return snapshot.docs
      .map(doc => ({ id: parseInt(doc.id), ...doc.data() } as Selection))
      .filter(selection => selection.clientId === clientId);
  }

  async getSelectionById(id: number): Promise<Selection | undefined> {
    const docRef = doc(firebaseDb, "selections", String(id));
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: parseInt(docSnap.id), ...docSnap.data() } as Selection : undefined;
  }

  async createSelection(insertSelection: InsertSelection): Promise<Selection> {
    const selectionId = Date.now();
    const selectionData = {
      ...insertSelection,
      id: selectionId,
      createdAt: new Date()
    };
    await setDoc(doc(firebaseDb, "selections", String(selectionId)), selectionData);
    return selectionData as Selection;
  }

  async updateSelection(id: number, selectionUpdate: Partial<Selection>): Promise<Selection> {
    const docRef = doc(firebaseDb, "selections", String(id));
    await updateDoc(docRef, selectionUpdate);
    const updatedDoc = await getDoc(docRef);
    return { id, ...updatedDoc.data() } as Selection;
  }

  async deleteSelection(id: number): Promise<void> {
    await deleteDoc(doc(firebaseDb, "selections", String(id)));
  }

  // Interviews
  async getInterviewsBySelectionId(selectionId: number): Promise<Interview[]> {
    const snapshot = await getDocs(collection(firebaseDb, "interviews"));
    return snapshot.docs
      .map(doc => ({ id: parseInt(doc.id), ...doc.data() } as Interview))
      .filter(interview => interview.selectionId === selectionId);
  }

  async getInterviewById(id: number): Promise<Interview | undefined> {
    const docRef = doc(firebaseDb, "interviews", String(id));
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: parseInt(docSnap.id), ...docSnap.data() } as Interview : undefined;
  }

  async getInterviewByToken(token: string): Promise<Interview | undefined> {
    const interviewsQuery = query(collection(firebaseDb, "interviews"), where("token", "==", token));
    const querySnapshot = await getDocs(interviewsQuery);
    if (querySnapshot.empty) return undefined;
    const doc = querySnapshot.docs[0];
    return { id: parseInt(doc.id), ...doc.data() } as Interview;
  }

  async createInterview(insertInterview: InsertInterview): Promise<Interview> {
    const interviewId = Date.now();
    const interviewData = {
      ...insertInterview,
      id: interviewId,
      createdAt: new Date()
    };
    await setDoc(doc(firebaseDb, "interviews", String(interviewId)), interviewData);
    return interviewData as Interview;
  }

  async updateInterview(id: number, interviewUpdate: Partial<Interview>): Promise<Interview> {
    const docRef = doc(firebaseDb, "interviews", String(id));
    await updateDoc(docRef, interviewUpdate);
    const updatedDoc = await getDoc(docRef);
    return { id, ...updatedDoc.data() } as Interview;
  }

  // Responses
  async getResponsesByInterviewId(interviewId: number): Promise<Response[]> {
    const snapshot = await getDocs(collection(firebaseDb, "responses"));
    const interviewIdStr = String(interviewId);
    
    const responses = snapshot.docs
      .map(doc => ({ id: parseInt(doc.id), ...doc.data() } as Response))
      .filter(response => {
        // Comparar tanto como string quanto como número para máxima compatibilidade
        const responseInterviewId = String(response.interviewId);
        const match = responseInterviewId === interviewIdStr || 
                     response.interviewId === interviewId;
        
        if (match) {
          console.log(`🎯 Resposta encontrada para entrevista ${interviewId}:`, {
            responseId: doc.id,
            interviewId: response.interviewId,
            questionText: response.questionText?.substring(0, 50) + '...'
          });
        }
        
        return match;
      });
    
    console.log(`📋 Total de respostas para entrevista ${interviewId}: ${responses.length}`);
    return responses;
  }

  async createResponse(insertResponse: InsertResponse): Promise<Response> {
    const responseId = Date.now();
    const responseData = {
      ...insertResponse,
      id: responseId,
      createdAt: new Date()
    };
    await setDoc(doc(firebaseDb, "responses", String(responseId)), responseData);
    return responseData as Response;
  }

  async updateResponse(id: number, responseUpdate: Partial<Response>): Promise<Response> {
    const docRef = doc(firebaseDb, "responses", String(id));
    await updateDoc(docRef, responseUpdate);
    const updatedDoc = await getDoc(docRef);
    return { id, ...updatedDoc.data() } as Response;
  }

  // API Config
  async getApiConfig(): Promise<ApiConfig | undefined> {
    const docRef = doc(firebaseDb, "config", "api");
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: 1, ...docSnap.data() } as ApiConfig : undefined;
  }

  async upsertApiConfig(config: InsertApiConfig): Promise<ApiConfig> {
    const configData = { ...config, id: 1 };
    await setDoc(doc(firebaseDb, "config", "api"), configData);
    return configData as ApiConfig;
  }

  // Message Logs
  async createMessageLog(insertLog: InsertMessageLog): Promise<MessageLog> {
    const logId = Date.now();
    const logData = {
      ...insertLog,
      id: logId,
      createdAt: new Date()
    };
    await setDoc(doc(firebaseDb, "messageLogs", String(logId)), logData);
    return logData as MessageLog;
  }

  async getMessageLogsByInterviewId(interviewId: number): Promise<MessageLog[]> {
    const snapshot = await getDocs(collection(firebaseDb, "messageLogs"));
    return snapshot.docs
      .map(doc => ({ id: parseInt(doc.id), ...doc.data() } as MessageLog))
      .filter(log => log.interviewId === interviewId);
  }

  // Global getters
  async getAllCandidates(): Promise<Candidate[]> {
    const snapshot = await getDocs(collection(firebaseDb, "candidates"));
    return snapshot.docs.map(doc => ({ id: parseInt(doc.id), ...doc.data() } as Candidate));
  }

  async getAllInterviews(): Promise<Interview[]> {
    const snapshot = await getDocs(collection(firebaseDb, "interviews"));
    return snapshot.docs.map(doc => ({ id: parseInt(doc.id), ...doc.data() } as Interview));
  }

  async getAllResponses(): Promise<Response[]> {
    const snapshot = await getDocs(collection(firebaseDb, "responses"));
    return snapshot.docs.map(doc => ({ id: parseInt(doc.id), ...doc.data() } as Response));
  }

  async getAllSelections(): Promise<Selection[]> {
    const snapshot = await getDocs(collection(firebaseDb, "selections"));
    return snapshot.docs.map(doc => ({ id: parseInt(doc.id), ...doc.data() } as Selection));
  }

  // Statistics
  async getInterviewStats(): Promise<{
    totalClients: number;
    totalInterviews: number;
    pendingInterviews: number;
    avgScore: number;
  }> {
    const [clientsSnapshot, interviewsSnapshot] = await Promise.all([
      getDocs(collection(firebaseDb, "clients")),
      getDocs(collection(firebaseDb, "interviews"))
    ]);

    const interviews = interviewsSnapshot.docs.map(doc => doc.data());
    const pendingInterviews = interviews.filter(i => i.status === 'pending').length;
    const completedInterviews = interviews.filter(i => i.status === 'completed');
    const avgScore = completedInterviews.length > 0 
      ? completedInterviews.reduce((sum, i) => sum + (i.totalScore || 0), 0) / completedInterviews.length 
      : 0;

    return {
      totalClients: clientsSnapshot.size,
      totalInterviews: interviewsSnapshot.size,
      pendingInterviews,
      avgScore: Math.round(avgScore)
    };
  }

  async getClientStats(clientId: number): Promise<{
    activeJobs: number;
    totalCandidates: number;
    monthlyInterviews: number;
    monthlyLimit: number;
    currentUsage: number;
  }> {
    const [jobs, candidates, interviews, client] = await Promise.all([
      this.getJobsByClientId(clientId),
      this.getCandidatesByClientId(clientId),
      this.getAllInterviews(),
      this.getClientById(clientId)
    ]);

    const activeJobs = jobs.filter(j => j.status === 'ativo').length;
    const clientInterviews = interviews.filter(i => {
      // Need to check if interview belongs to this client via job
      return jobs.some(j => j.id === i.selectionId?.toString());
    });

    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyInterviews = clientInterviews.filter(i => 
      new Date(i.createdAt || '') >= thisMonth
    ).length;

    return {
      activeJobs,
      totalCandidates: candidates.length,
      monthlyInterviews,
      monthlyLimit: client?.monthlyLimit || 100,
      currentUsage: Math.round((monthlyInterviews / (client?.monthlyLimit || 100)) * 100)
    };
  }
}

export const storage = new FirebaseStorage();