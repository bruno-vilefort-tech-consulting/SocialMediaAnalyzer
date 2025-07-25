import {
  type User, type InsertUser, type Client, type InsertClient,
  type Job, type InsertJob, type Question, type InsertQuestion,
  type CandidateList, type InsertCandidateList, type Candidate, type InsertCandidate, 
  type CandidateListMembership, type InsertCandidateListMembership,
  type Selection, type InsertSelection, type Interview, type InsertInterview, 
  type Response, type InsertResponse, type ApiConfig, type InsertApiConfig,
  type ClientVoiceSetting, type InsertClientVoiceSetting,
  type MasterSettings, type InsertMasterSettings,
  type MessageLog, type InsertMessageLog,
  type Report, type InsertReport,
  type ReportFolder, type InsertReportFolder,
  type ReportFolderAssignment, type InsertReportFolderAssignment,
  candidates
} from "@shared/schema";
import { collection, doc, getDocs, getDoc, updateDoc, deleteDoc, query, where, setDoc, addDoc, orderBy, writeBatch, Timestamp } from "firebase/firestore";
import bcrypt from "bcrypt";
import { firebaseDb } from "./db";
import admin from "firebase-admin";

export interface IStorage {
  // Users
  getUserById(id: string | number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<User>): Promise<User>;
  deleteUser(id: number): Promise<void>;

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
  getAllCandidateLists(): Promise<CandidateList[]>;
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

  // Candidate List Memberships (muitos-para-muitos)
  addCandidateToList(candidateId: number, listId: number, clientId: number): Promise<CandidateListMembership>;
  removeCandidateFromList(candidateId: number, listId: number): Promise<void>;
  getCandidateListMemberships(candidateId: number): Promise<CandidateListMembership[]>;
  getAllCandidateListMemberships(): Promise<CandidateListMembership[]>;
  getCandidateListMembershipsByClientId(clientId: number): Promise<CandidateListMembership[]>;
  getCandidatesInList(listId: number): Promise<Candidate[]>;
  getCandidatesByMultipleClients(clientIds: number[]): Promise<Candidate[]>;

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
  getResponsesBySelectionAndCandidate(selectionId: string, candidateId: number, clientId: number): Promise<Response[]>;
  createResponse(response: InsertResponse): Promise<Response>;
  createResponseWithSelection(response: InsertResponse & { selectionId: string; clientId: number }): Promise<Response>;
  updateResponse(id: number, response: Partial<Response>): Promise<Response>;

  // Master Settings - configurações OpenAI globais compartilhadas entre todos os masters
  getMasterSettings(): Promise<MasterSettings | undefined>;
  upsertMasterSettings(settings: InsertMasterSettings): Promise<MasterSettings>;

  // API Config - configurações específicas por cliente/master (voz TTS + WhatsApp QR)
  getApiConfig(entityType: string, entityId: string): Promise<ApiConfig | undefined>;
  upsertApiConfig(config: InsertApiConfig): Promise<ApiConfig>;

  // Client Voice Settings - DEPRECATED - mantido para compatibilidade
  getClientVoiceSetting(clientId: number): Promise<ClientVoiceSetting | undefined>;
  upsertClientVoiceSetting(setting: InsertClientVoiceSetting): Promise<ClientVoiceSetting>;

  // Message Logs
  createMessageLog(log: InsertMessageLog): Promise<MessageLog>;
  getMessageLogsByInterviewId(interviewId: number): Promise<MessageLog[]>;

  // Password reset tokens
  createResetToken(email: string, token: string): Promise<void>;
  getResetToken(token: string): Promise<{ email: string; createdAt: Date } | undefined>;
  deleteResetToken(token: string): Promise<void>;
  updateUserPassword(email: string, hashedPassword: string): Promise<void>;

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

  // Reports - Independent system
  getReportsByClientId(clientId: number): Promise<Report[]>;
  getReportById(id: string): Promise<Report | undefined>;
  createReport(report: InsertReport): Promise<Report>;
  deleteReport(id: string): Promise<void>;

  // Report Folders
  getReportFoldersByClientId(clientId: string): Promise<ReportFolder[]>;
  getReportFolderById(id: string): Promise<ReportFolder | undefined>;
  createReportFolder(folder: InsertReportFolder): Promise<ReportFolder>;
  updateReportFolder(id: string, folder: Partial<ReportFolder>): Promise<ReportFolder>;
  deleteReportFolder(id: string): Promise<void>;

  // Report Folder Assignments
  getAllReportFolderAssignments(): Promise<ReportFolderAssignment[]>;
  getAllReportFolderAssignmentsByClientId(clientId: string): Promise<ReportFolderAssignment[]>;
  getReportFolderAssignments(folderId: string): Promise<ReportFolderAssignment[]>;
  createReportFolderAssignment(assignment: InsertReportFolderAssignment): Promise<ReportFolderAssignment>;
  deleteReportFolderAssignment(reportId: string): Promise<void>;
  updateReportFolder(id: string, folder: Partial<ReportFolder>): Promise<ReportFolder>;
  deleteReportFolder(id: string): Promise<void>;

  // Report Folder Assignments
  getReportFolderAssignments(folderId: string): Promise<ReportFolderAssignment[]>;
  getReportFolderAssignmentByReportId(reportId: string): Promise<ReportFolderAssignment | undefined>;
  assignReportToFolder(assignment: InsertReportFolderAssignment): Promise<ReportFolderAssignment>;
  removeReportFromFolder(reportId: string): Promise<void>;
  moveReportToFolder(reportId: string, folderId: string): Promise<void>;
  createReportFromSelection(selectionId: number): Promise<Report>;

  // Candidate Categories - para relatórios
  getCandidateCategory(reportId: string, candidateId: string): Promise<any>;
  setCandidateCategory(reportId: string, candidateId: string, category: string, clientId: number): Promise<any>;
  getCategoriesByReportId(reportId: string): Promise<any[]>;
  getCandidateCategories(selectionId: string): Promise<any[]>;

  // Função para buscar candidatos de uma seleção com dados de entrevista
  getSelectionCandidatesWithInterviews(selectionId: number): Promise<any[]>;
  // Alias para compatibilidade com a rota /api/interview-stats
  getInterviewCandidatesBySelectionId(selectionId: number): Promise<any[]>;
}

export class FirebaseStorage implements IStorage {
  private db: admin.firestore.Firestore;

  constructor() {
    // Initialize db lazily to avoid initialization order issues
    this.db = null as any;
  }
    createResponseWithSelection(response: InsertResponse & { selectionId: string; clientId: number; }): Promise<Response> {
        throw new Error("Method not implemented.");
    }
    getReportById(id: string): Promise<Report | undefined> {
        throw new Error("Method not implemented.");
    }
    createReportFromSelection(selectionId: number): Promise<Report> {
        throw new Error("Method not implemented.");
    }

  private getDb(): admin.firestore.Firestore {
    if (!this.db) {
      try {
        // Use firebaseDb from db.ts which is already initialized
        return firebaseDb as any;
      } catch (error) {
        console.error('Error getting Firebase db:', error);
        throw error;
      }
    }
    return this.db;
  }

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

  async updateUser(id: number, user: Partial<User>): Promise<User> {
    const docRef = doc(firebaseDb, "users", String(id));
    await updateDoc(docRef, user);
    const updatedDoc = await getDoc(docRef);
    return { id: updatedDoc.id, ...updatedDoc.data() } as User;
  }

  async deleteUser(id: number): Promise<void> {
    await deleteDoc(doc(firebaseDb, "users", String(id)));
  }



  // Clients
  async getClients(): Promise<Client[]> {
    const snapshot = await getDocs(collection(firebaseDb, "clients"));
    return snapshot.docs.map(doc => {
      const data = doc.data();

      // Remover campos que não fazem parte do schema oficial
      const { isIndefiniteContract, ...cleanData } = data;

      // Converter Firebase Timestamps para Date objects
      if (cleanData.contractStart && typeof cleanData.contractStart === 'object' && cleanData.contractStart.seconds) {
        cleanData.contractStart = new Date(cleanData.contractStart.seconds * 1000);
      }
      if (cleanData.contractEnd && typeof cleanData.contractEnd === 'object' && cleanData.contractEnd.seconds) {
        cleanData.contractEnd = new Date(cleanData.contractEnd.seconds * 1000);
      }
      if (cleanData.createdAt && typeof cleanData.createdAt === 'object' && cleanData.createdAt.seconds) {
        cleanData.createdAt = new Date(cleanData.createdAt.seconds * 1000);
      }

      return { id: parseInt(doc.id), ...cleanData } as Client;
    });
  }

  async getClientById(id: number): Promise<Client | undefined> {
    const docRef = doc(firebaseDb, "clients", String(id));
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return undefined;

    const data = docSnap.data();

    // Converter Firebase Timestamps para Date objects
    if (data.contractStart && typeof data.contractStart === 'object' && data.contractStart.seconds) {
      data.contractStart = new Date(data.contractStart.seconds * 1000);
    }
    if (data.contractEnd && typeof data.contractEnd === 'object' && data.contractEnd.seconds) {
      data.contractEnd = new Date(data.contractEnd.seconds * 1000);
    }
    if (data.createdAt && typeof data.createdAt === 'object' && data.createdAt.seconds) {
      data.createdAt = new Date(data.createdAt.seconds * 1000);
    }

    return { id: parseInt(docSnap.id), ...data } as Client;
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
    console.log(`🔄 FirebaseStorage.updateClient - ID: ${id}`);
    console.log(`📝 Dados para atualização:`, JSON.stringify(clientUpdate, null, 2));

    const docRef = doc(firebaseDb, "clients", String(id));

    try {
      await updateDoc(docRef, clientUpdate);
      console.log(`✅ UpdateDoc executado com sucesso no Firebase`);

      const updatedDoc = await getDoc(docRef);
      const data = updatedDoc.data();

      // Converter Firebase Timestamps para Date objects
      if (data && data.contractStart && typeof data.contractStart === 'object' && data.contractStart.seconds) {
        data.contractStart = new Date(data.contractStart.seconds * 1000);
      }
      if (data && data.contractEnd && typeof data.contractEnd === 'object' && data.contractEnd.seconds) {
        data.contractEnd = new Date(data.contractEnd.seconds * 1000);
      }
      if (data && data.createdAt && typeof data.createdAt === 'object' && data.createdAt.seconds) {
        data.createdAt = new Date(data.createdAt.seconds * 1000);
      }

      const finalData = { id, ...data } as Client;

      console.log(`📋 Dados finais com timestamps convertidos:`, JSON.stringify({
        contractStart: finalData.contractStart,
        contractEnd: finalData.contractEnd
      }, null, 2));

      return finalData;
    } catch (error) {
      console.error(`❌ Erro ao atualizar cliente no Firebase:`, error);
      throw error;
    }
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
        clientId: data.clientId,
        nomeVaga: data.nomeVaga,
        descricaoVaga: data.descricaoVaga,
        status: data.status,
        createdAt: data.createdAt,
        perguntas: data.perguntas || []
      } as Job;
    });

    const filteredJobs = allJobs.filter(job => {
      const jobClientId = typeof job.clientId === 'string' ? parseInt(job.clientId) : job.clientId;
      const match = jobClientId === clientId;
      if (match) {
        console.log(`✅ Vaga matched: ${job.nomeVaga} (clientId: ${job.clientId})`);
      }
      return match;
    });
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
        clientId: data.clientId,
        nomeVaga: data.nomeVaga,
        descricaoVaga: data.descricaoVaga,
        status: data.status,
        createdAt: data.createdAt,
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
    const data = docSnap.data();
    return { 
      id: docSnap.id, 
      clientId: data.clientId,
      nomeVaga: data.nomeVaga,
      descricaoVaga: data.descricaoVaga,
      status: data.status,
      createdAt: data.createdAt,
      perguntas: data.perguntas || []
    } as Job;
  }

  async createJob(insertJob: InsertJob): Promise<Job> {
    console.log('💾 Criando nova vaga no Firebase:', insertJob);
    console.log('📝 Perguntas recebidas:', insertJob.perguntas);

    const jobId = Date.now().toString();
    const jobData = {
      ...insertJob,
      id: jobId,
      createdAt: new Date(),
      // Preservar as perguntas vindas do frontend em vez de forçar array vazio
      perguntas: insertJob.perguntas || []
    };

    console.log('💾 Dados finais da vaga para salvar:', jobData);
    await setDoc(doc(firebaseDb, "jobs", jobId), jobData);
    console.log('✅ Vaga salva no Firebase com ID:', jobId);

    return jobData as Job;
  }

  async updateJob(id: string, jobUpdate: Partial<Job>): Promise<Job> {
    console.log('📝 Atualizando vaga no Firebase:', id, jobUpdate);
    console.log('📝 Perguntas na atualização:', jobUpdate.perguntas);

    const docRef = doc(firebaseDb, "jobs", id);
    await updateDoc(docRef, jobUpdate);

    const updatedDoc = await getDoc(docRef);
    const result = { id, ...updatedDoc.data() } as Job;

    console.log('✅ Vaga atualizada no Firebase:', result);
    return result;
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
  async getAllCandidateLists(): Promise<CandidateList[]> {
    const snapshot = await getDocs(collection(firebaseDb, "candidateLists"));
    return snapshot.docs
      .map(doc => ({ id: parseInt(doc.id), ...doc.data() } as CandidateList));
  }

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
  async getAllCandidates(): Promise<Candidate[]> {
    console.log('🔍 Storage: Buscando TODOS os candidatos no Firebase...');
    const snapshot = await getDocs(collection(firebaseDb, "candidates"));
    const candidates = snapshot.docs.map(doc => {
      const data = doc.data();

      // Ensure clientId is properly parsed as number
      let clientId = data.clientId;
      if (typeof clientId === 'string') {
        clientId = parseInt(clientId);
      }

      const candidate = {
        id: data.id || parseInt(doc.id),
        name: data.name,
        email: data.email,
        whatsapp: data.whatsapp,
        clientId: clientId || 0, // Ensure clientId is never undefined
        createdAt: data.createdAt?.toDate() || null
      } as Candidate;

      console.log(`✅ Candidato processado:`, candidate);
      return candidate;
    });
    console.log('📋 Storage: Total candidatos encontrados:', candidates.length);
    return candidates;
  }

  async getCandidatesByClientId(clientId: number): Promise<Candidate[]> {
    console.log(`🔍 Storage: Buscando candidatos do cliente ${clientId}`);
    const snapshot = await getDocs(collection(firebaseDb, "candidates"));
    const allCandidates = snapshot.docs.map(doc => {
      const data = doc.data();

      // Ensure clientId is properly parsed as number
      let candidateClientId = data.clientId;
      if (typeof candidateClientId === 'string') {
        candidateClientId = parseInt(candidateClientId);
      }

      return {
        id: data.id || parseInt(doc.id),
        name: data.name,
        email: data.email,
        whatsapp: data.whatsapp,
        clientId: candidateClientId || 0, // Ensure clientId is never undefined
        createdAt: data.createdAt?.toDate() || null
      } as Candidate;
    });

    // Filter candidates by clientId
    const filteredCandidates = allCandidates.filter(candidate => {
      const match = candidate.clientId === clientId;
      return match;
    });

    return filteredCandidates;
  }

  async getCandidatesByListId(listId: number): Promise<Candidate[]> {
    console.log(`🔍 getCandidatesByListId: Buscando candidatos para lista ${listId}`);

    // Busca memberships da lista
    const membershipsSnapshot = await getDocs(collection(firebaseDb, "candidateListMemberships"));
    console.log(`📋 Total de memberships no banco: ${membershipsSnapshot.docs.length}`);

    const allMemberships = membershipsSnapshot.docs.map(doc => {
      const data = doc.data();
      return { 
        id: doc.id, 
        candidateId: Number(data.candidateId),
        listId: Number(data.listId),
        clientId: Number(data.clientId),
        createdAt: data.createdAt
      };
    });

    console.log('🔍 Todos os memberships:', allMemberships);

    const memberships = allMemberships.filter(membership => {
      const match = membership.listId === Number(listId);
      console.log(`🔍 Comparando ${membership.listId} === ${Number(listId)}: ${match}`);
      return match;
    });
    console.log(`🎯 Memberships para lista ${listId}:`, memberships);

    // Busca candidatos baseado nos IDs encontrados
    const candidateIds = memberships.map(m => m.candidateId);
    console.log(`👥 IDs de candidatos encontrados:`, candidateIds);

    if (candidateIds.length === 0) {
      console.log('❌ Nenhum candidato encontrado para esta lista');
      return [];
    }

    const candidatesSnapshot = await getDocs(collection(firebaseDb, "candidates"));
    const allCandidates = candidatesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: Number(data.id || doc.id),
        name: data.name,
        email: data.email,
        whatsapp: data.whatsapp,
        clientId: Number(data.clientId),
        createdAt: data.createdAt
      } as Candidate;
    });
    console.log(`👤 Total de candidatos no banco: ${allCandidates.length}`);

    const filteredCandidates = allCandidates.filter(candidate => {
      const isIncluded = candidateIds.includes(candidate.id);
      return isIncluded;
    });
    console.log(`✅ Candidatos filtrados para lista ${listId}:`, filteredCandidates);

    return filteredCandidates;
  }

  async getCandidateById(id: number): Promise<Candidate | undefined> {
    const docRef = doc(firebaseDb, "candidates", String(id));
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: parseInt(docSnap.id), ...docSnap.data() } as Candidate : undefined;
  }

  async createCandidate(insertCandidate: InsertCandidate): Promise<Candidate> {
    console.log('🔍 createCandidate chamado com dados:', insertCandidate);

    // Generate unique candidate ID
    const candidateId = Date.now() + Math.floor(Math.random() * 1000);

    // Extract listId and clientId from insertCandidate
    const { listId, clientId, ...candidateFields } = insertCandidate;

    console.log('📋 Campos extraídos - listId:', listId, 'clientId:', clientId, 'fields:', candidateFields);

    // IMPORTANTE: Incluir clientId diretamente no candidato conforme especificado
    const candidateData = {
      ...candidateFields,
      clientId: clientId, // ClientId vai direto no candidato
      id: candidateId,
      createdAt: new Date()
    };

    console.log('💾 Salvando candidato COM clientId:', candidateData);
    // Create candidate
    await setDoc(doc(firebaseDb, "candidates", String(candidateId)), candidateData);

    // Create membership automatically para relacionamento muitos-para-muitos
    if (listId && clientId) {
      const membershipId = `${candidateId}_${listId}`;
      const membershipData = {
        candidateId,
        listId,
        clientId,
        createdAt: new Date()
      };
      console.log('🔗 Criando membership automaticamente:', membershipData, 'com ID:', membershipId);
      await setDoc(doc(firebaseDb, "candidateListMemberships", membershipId), membershipData);
      console.log('✅ Membership criada automaticamente com sucesso');
    } else {
      console.log('❌ Membership não criada - listId:', listId, 'clientId:', clientId);
    }

    return candidateData as Candidate;
  }

  async createCandidates(insertCandidates: any[]): Promise<Candidate[]> {
    console.log('📥 createCandidates chamado com', insertCandidates.length, 'candidatos');
    console.log('🔍 Primeiro candidato para debug:', insertCandidates[0]);

    const batch = writeBatch(firebaseDb);
    const candidates: Candidate[] = [];

    for (const insertCandidate of insertCandidates) {
      const candidateId = Date.now() + Math.floor(Math.random() * 1000) + candidates.length;

      // Extract listId (opcional) and clientId from insertCandidate
      const { listId, clientId, ...candidateFields } = insertCandidate;

      console.log(`📋 Processando candidato: ${candidateFields.name} - listId: ${listId || 'N/A'}, clientId: ${clientId}`);

      if (!clientId) {
        console.error(`❌ ERRO CRÍTICO: Candidato ${candidateFields.name} sem clientId!`);
        throw new Error(`Candidato ${candidateFields.name} deve ter clientId válido`);
      }

      const candidateData = {
        ...candidateFields,
        clientId: clientId, // CRÍTICO: Incluir clientId no candidato
        id: candidateId,
        createdAt: new Date()
      };

      console.log(`💾 Salvando candidato ${candidateFields.name} com clientId: ${clientId}`);

      const candidateRef = doc(firebaseDb, "candidates", String(candidateId));
      batch.set(candidateRef, candidateData);
      candidates.push(candidateData as Candidate);

      // Create membership automatically
      if (listId && clientId) {
        const membershipId = `${candidateId}_${listId}`;
        const membershipData = {
          candidateId,
          listId,
          clientId,
          createdAt: new Date()
        };

        console.log(`🔗 Preparando membership: candidato ${candidateId} → lista ${listId} → cliente ${clientId}`);
        const membershipRef = doc(firebaseDb, "candidateListMemberships", membershipId);
        batch.set(membershipRef, membershipData);
      } else {
        console.log(`❌ Membership não criada - listId: ${listId}, clientId: ${clientId} para candidato ${candidateId}`);
      }
    }

    console.log(`🚀 Executando batch com ${candidates.length} candidatos`);
    await batch.commit();
    console.log('✅ Batch commit executado com sucesso');

    return candidates;
  }

  async updateCandidate(id: number, candidateUpdate: Partial<Candidate>): Promise<Candidate> {
    try {
      console.log(`🔧 Atualizando candidato ${id} com dados:`, candidateUpdate);

      const docRef = doc(firebaseDb, "candidates", String(id));

      // Verificar se o candidato existe
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        throw new Error(`Candidato com ID ${id} não encontrado`);
      }

      // Atualizar com timestamp
      const updateData = {
        ...candidateUpdate,
        updatedAt: new Date()
      };

      await updateDoc(docRef, updateData);

      // Buscar dados atualizados
      const updatedDoc = await getDoc(docRef);
      const candidate = { id, ...updatedDoc.data() } as Candidate;

      console.log(`✅ Candidato ${id} atualizado com sucesso:`, candidate);
      return candidate;
    } catch (error) {
      console.error(`❌ Erro ao atualizar candidato ${id}:`, error);
      throw new Error(`Falha ao atualizar candidato: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async deleteCandidate(id: number): Promise<void> {
    try {
      console.log(`🗑️ Deletando candidato ${id} e seus memberships...`);

      // Deletar candidato
      await deleteDoc(doc(firebaseDb, "candidates", String(id)));
      console.log(`✅ Candidato ${id} deletado`);

      // Deletar todos os memberships do candidato
      const membershipsSnapshot = await getDocs(collection(firebaseDb, "candidateListMemberships"));
      const candidateMemberships = membershipsSnapshot.docs.filter(doc => {
        const data = doc.data();
        return data.candidateId === id;
      });

      if (candidateMemberships.length > 0) {
        const batch = writeBatch(firebaseDb);
        candidateMemberships.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`✅ ${candidateMemberships.length} memberships deletados`);
      }

    } catch (error) {
      console.error(`❌ Erro ao deletar candidato ${id}:`, error);
      throw error;
    }
  }

  // Selections
  async getSelectionsByClientId(clientId: number): Promise<Selection[]> {
    const snapshot = await getDocs(collection(firebaseDb, "selections"));
    const selections = snapshot.docs
      .map(doc => ({ id: parseInt(doc.id), ...doc.data() } as Selection))
      .filter(selection => selection.clientId === clientId);

    // Para cada seleção, calcular estatísticas de candidatos
    const selectionsWithStats = await Promise.all(
      selections.map(async (selection) => {
        try {
          // Buscar candidatos da lista da seleção
          const candidateListsSnapshot = await getDocs(collection(firebaseDb, "candidateListMemberships"));
          const candidatesInList = candidateListsSnapshot.docs
            .map(doc => doc.data())
            .filter(membership => membership.listId === selection.candidateListId);

          // Buscar entrevistas desta seleção
          const interviewsSnapshot = await getDocs(collection(firebaseDb, "interviews"));
          const selectionInterviews = interviewsSnapshot.docs
            .map(doc => doc.data())
            .filter(interview => interview.selectionId === selection.id.toString());

          // Contar entrevistas finalizadas (que têm respostas completas)
          let completedInterviews = 0;
          for (const interview of selectionInterviews) {
            const responsesSnapshot = await getDocs(collection(firebaseDb, "responses"));
            const interviewResponses = responsesSnapshot.docs
              .map(doc => doc.data())
              .filter(response => response.interviewId === interview.id);

            // Verificar se tem respostas com transcrição
            const completedResponses = interviewResponses.filter(response => 
              response.transcription && 
              response.transcription !== 'Aguardando resposta via WhatsApp' &&
              response.transcription.trim() !== ''
            );

            if (completedResponses.length > 0) {
              completedInterviews++;
            }
          }

          return {
            ...selection,
            totalCandidates: candidatesInList.length,
            completedInterviews
          };
        } catch (error) {
          console.error(`Erro ao calcular estatísticas para seleção ${selection.id}:`, error);
          return {
            ...selection,
            totalCandidates: 0,
            completedInterviews: 0
          };
        }
      })
    );

    return selectionsWithStats;
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

  // Métodos adicionais para o sistema de relatórios

  // Função para buscar candidatos de uma seleção com dados de entrevista
  async getSelectionCandidatesWithInterviews(selectionId: number): Promise<any[]> {
    try {
      console.log(`🔍 Buscando candidatos da seleção ${selectionId} com dados de entrevista`);

      // Buscar a seleção para obter o listId
      const { firebaseDb } = require('./db.js');
      const selectionDoc = await firebaseDb.collection('selections').doc(selectionId.toString()).get();
      if (!selectionDoc.exists) {
        console.log(`❌ Seleção ${selectionId} não encontrada`);
        return [];
      }

      const selectionData = selectionDoc.data();
      const listId = selectionData?.listId;

      if (!listId) {
        console.log(`❌ Seleção ${selectionId} não tem listId`);
        return [];
      }

      // Buscar candidatos da lista
      const candidatesSnapshot = await firebaseDb.collection('candidateListMemberships')
        .where('listId', '==', listId)
        .get();

      if (candidatesSnapshot.empty) {
        console.log(`❌ Nenhum candidato encontrado na lista ${listId}`);
        return [];
      }

      const candidates = [];

      for (const memberDoc of candidatesSnapshot.docs) {
        const memberData = memberDoc.data();

        // Buscar dados do candidato
        const candidateDoc = await firebaseDb.collection('candidates').doc(memberData.candidateId.toString()).get();
        if (!candidateDoc.exists) continue;

        const candidateData = candidateDoc.data();

        // 🔥 CORREÇÃO CRÍTICA: Buscar respostas usando múltiplas estratégias
        console.log(`🔍 [DEBUG] Buscando respostas para candidato ${candidateData.name}, telefone: ${candidateData.whatsapp}, seleção: ${selectionId}`);
        
        // Estratégia 1: Buscar por candidatePhone
        let responsesSnapshot = await firebaseDb.collection('responses')
          .where('candidatePhone', '==', candidateData.whatsapp)
          .where('selectionId', '==', selectionId.toString())
          .get();
        
        console.log(`📊 [DEBUG] Estratégia 1 (candidatePhone): ${responsesSnapshot.size} documentos`);
        
        // Estratégia 2: Se não encontrou, buscar por phone
        if (responsesSnapshot.size === 0) {
          responsesSnapshot = await firebaseDb.collection('responses')
            .where('phone', '==', candidateData.whatsapp)
            .where('selectionId', '==', selectionId.toString())
            .get();
          console.log(`📊 [DEBUG] Estratégia 2 (phone): ${responsesSnapshot.size} documentos`);
        }
        
        // Estratégia 3: Se ainda não encontrou, buscar por candidateId
        if (responsesSnapshot.size === 0) {
          responsesSnapshot = await firebaseDb.collection('responses')
            .where('candidateId', '==', candidateData.id.toString())
            .where('selectionId', '==', selectionId.toString())
            .get();
          console.log(`📊 [DEBUG] Estratégia 3 (candidateId): ${responsesSnapshot.size} documentos`);
        }

        const responses = responsesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Criar dados de entrevista baseados nas respostas
        const interviewData = {
          candidateId: memberData.candidateId,
          selectionId: selectionId,
          status: responses.length > 0 ? 'in_progress' : 'pending'
        };

        candidates.push({
          candidate: {
            id: candidateData.id,
            name: candidateData.name,
            email: candidateData.email,
            phone: candidateData.whatsapp || candidateData.phone || ''
          },
          interview: interviewData ? {
            id: interviewSnapshot.docs[0].id,
            status: interviewData.status,
            createdAt: interviewData.createdAt,
            completedAt: interviewData.completedAt,
            totalScore: interviewData.totalScore || 0
          } : {
            id: `pending_${candidateData.id}`,
            status: 'pending',
            createdAt: null,
            completedAt: null,
            totalScore: 0
          },
          responses: responses,
          calculatedScore: 0
        });
      }

      console.log(`✅ Encontrados ${candidates.length} candidatos para seleção ${selectionId}`);
      return candidates;

    } catch (error) {
      console.error('Erro ao buscar candidatos da seleção com entrevistas:', error);
      return [];
    }
  }

  // Alias para compatibilidade com a rota /api/interview-stats
  async getInterviewCandidatesBySelectionId(selectionId: number): Promise<any[]> {
    return this.getSelectionCandidatesWithInterviews(selectionId);
  }



  async getInterviewsByCandidateId(candidateId: number): Promise<any[]> {
    try {
      const interviewsRef = collection(firebaseDb, 'interviews');
      const q = query(interviewsRef, where('candidateId', '==', candidateId));
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.log('❌ Erro ao buscar entrevistas por candidato:', error.message);
      return [];
    }
  }





  async getResponsesBySelectionAndCandidate(selectionId: string, candidateId: number, clientId: number): Promise<any[]> {
    try {
      console.log(`🔍 [DEBUG_NOVA_SELEÇÃO] STORAGE - Buscando respostas para seleção ${selectionId}, candidato ${candidateId}, cliente ${clientId}`);

      // Buscar candidato para obter telefone
      const candidate = await this.getCandidateById(candidateId);
      if (!candidate) {
        console.log(`❌ Candidato ${candidateId} não encontrado`);
        return [];
      }

      const candidatePhone = candidate.whatsapp;
      console.log(`📱 Telefone do candidato: ${candidatePhone}`);

      // Formatos possíveis de candidateId:
      // 1. ID real: candidateId (número)
      // 2. Formato isolado: candidate_selectionId_phone
      const possibleCandidateIds = [
        candidateId.toString(),
        `candidate_${selectionId}_${candidatePhone}`
      ];

      console.log(`🔍 Buscando por candidateIds possíveis:`, possibleCandidateIds);

      // Buscar todas as respostas da seleção para verificar matches
      const allResponsesQuery = query(
        collection(firebaseDb, 'responses'),
        where('selectionId', '==', selectionId)
      );
      const allResponsesSnapshot = await getDocs(allResponsesQuery);

      const matchingResponses: any[] = [];
      allResponsesSnapshot.forEach(doc => {
        const data = doc.data();

        // Verificar se candidateId coincide com algum formato possível
        const isMatch = possibleCandidateIds.includes(data.candidateId);

        console.log(`🔍 [ISOLAMENTO] Verificando resposta ${doc.id}:`, {
          selectionId: data.selectionId,
          candidateId: data.candidateId,
          possibleIds: possibleCandidateIds,
          match: isMatch
        });

        if (isMatch) {
          matchingResponses.push({
            id: doc.id,
            ...data
          });
        }
      });

      console.log(`📄 [SELECTION_FILTER] Respostas ESPECÍFICAS da seleção ${selectionId}:`, matchingResponses.length);

      // FILTRO FINAL: Garantir que todas as respostas pertencem à seleção correta
      const filteredResponses = matchingResponses.filter(response => {
        const belongsToSelection = response.selectionId === selectionId || 
                                 response.selectionId === selectionId.toString() ||
                                 response.id.includes(`_${selectionId}_`);

        if (!belongsToSelection) {
          console.log(`🚫 [FILTER_OUT] Removendo resposta de seleção diferente: ${response.selectionId} (esperado: ${selectionId})`);
        }

        return belongsToSelection;
      });

      console.log(`🎯 [FINAL_FILTER] Respostas após filtro: ${filteredResponses.length} (removidas: ${matchingResponses.length - filteredResponses.length})`);

      if (matchingResponses.length === 0) {
        console.log(`🔍 [FALLBACK] Buscando transcrições ESPECÍFICAS para seleção ${selectionId} + candidato ${candidatePhone}...`);

        // Buscar apenas respostas desta seleção específica
        const allResponsesSnapshot = await getDocs(collection(firebaseDb, 'responses'));

        allResponsesSnapshot.forEach(doc => {
          const data = doc.data();

          // FILTRO RIGOROSO: Apenas respostas desta seleção específica
          const belongsToThisSelection = data.selectionId === selectionId || 
                                       data.selectionId === selectionId.toString();

          const candidateIdMatch = data.candidateId === candidateId.toString() || 
                                   data.candidateId?.includes(candidatePhone);

          if (belongsToThisSelection && candidateIdMatch && 
              data.transcription && 
              data.transcription !== 'Aguardando resposta via WhatsApp' && 
              data.transcription.trim() !== '') {

            console.log(`📝 [SPECIFIC_DATA] Seleção ${selectionId}: "${data.transcription.substring(0, 50)}..."`);
            console.log(`📊 [SCORE_DEBUG] Score encontrado no Firebase: ${data.score} (tipo: ${typeof data.score})`);

            // Criar URL do áudio baseado na estrutura correta
            const audioUrl = data.audioUrl || `/uploads/audio_${candidatePhone}_${selectionId}_R${data.questionId}.ogg`;

            // Usar score real calculado pela IA (salvo no banco após transcrição)
            let responseScore = data.score;
            if (responseScore === undefined || responseScore === null || responseScore === 0) {
              // Scores 0 ou null significa que ainda não foi processado pela IA ou houve erro
              responseScore = null; // Não exibir score até ser calculado pela IA
              console.log(`📊 [SCORE_PENDING] Score ainda não calculado pela IA para esta resposta`);
            } else {
              console.log(`📊 [SCORE_REAL] Score IA encontrado: ${responseScore}/100`);
            }

            matchingResponses.push({
              id: doc.id,
              ...data,
              audioUrl,
              questionText: data.questionText || `Pergunta ${data.questionId}`,
              score: responseScore,
              recordingDuration: data.recordingDuration || 0
            });
          }
        });

        // Se ainda não encontrou respostas específicas desta seleção, buscar perguntas do job para criar estrutura base
        if (matchingResponses.length === 0) {
          console.log(`🔍 [EMPTY_INTERVIEW] Criando estrutura base para seleção ${selectionId}...`);

          // Buscar job da seleção
          const selection = await this.getSelectionById(selectionId);
          if (selection) {
            const questions = await this.getQuestionsByJobId(selection.jobId);

            // Criar estrutura base com perguntas sem respostas
            questions.forEach((question, index) => {
              matchingResponses.push({
                id: `pending_${selectionId}_${candidateId}_${index + 1}`,
                candidateId: candidateId.toString(),
                selectionId: selectionId,
                questionId: index + 1,
                questionText: question.questionText || question.pergunta || `Pergunta ${index + 1}`,
                transcription: 'Aguardando resposta via WhatsApp',
                audioUrl: '',
                score: 0,
                recordingDuration: 0,
                aiAnalysis: 'Análise IA pendente'
              });
            });

            console.log(`📋 [STRUCTURE] Criadas ${questions.length} perguntas base para seleção ${selectionId}`);
          }
        }

        if (matchingResponses.length === 0) {
          console.log(`🔒 [ISOLAMENTO] Nenhuma resposta encontrada para seleção ${selectionId} + candidato ${candidateId}`);
          console.log(`✅ [ISOLAMENTO] Retornando array vazio - sem misturar dados de outras seleções`);
          return [];
        }
      }

      // Processar respostas encontradas
      const processedResponses = await Promise.all(matchingResponses.map(async (resp) => {
        let audioUrl = '';
        
        // Verificar várias possibilidades de arquivo de áudio
        if (resp.audioFile) {
          audioUrl = `/uploads/${resp.audioFile.split('/').pop()}`;
        } else if (resp.audioUrl) {
          audioUrl = resp.audioUrl;
        } else {
          // Tentar encontrar arquivo existente baseado no padrão
          const fs = await import('fs');
          const path = await import('path');
          
          const candidatePhone = candidate?.whatsapp || resp.candidatePhone || '';
          const possibleFiles = [
            `audio_${candidatePhone}_${selectionId}_R${resp.questionId}.ogg`,
            `audio_5511984316526_${selectionId}_R${resp.questionId}.ogg`, // Telefone conhecido que tem arquivos
            `audio_${candidatePhone.replace(/\D/g, '')}_${selectionId}_R${resp.questionId}.ogg`
          ];
          
          for (const fileName of possibleFiles) {
            const filePath = path.join('uploads', fileName);
            try {
              await fs.access(filePath, fs.constants.F_OK);
              audioUrl = `/uploads/${fileName}`;
              console.log(`✅ [AUDIO_FOUND] Arquivo encontrado: ${fileName}`);
              break;
            } catch (error) {
              // Arquivo não existe, continuar tentando
            }
          }
          
          if (!audioUrl) {
            console.log(`❌ [AUDIO_NOT_FOUND] Nenhum arquivo encontrado para seleção ${selectionId}, pergunta ${resp.questionId}`);
          }
        }
        
        return {
          id: resp.id,
          questionId: resp.questionId,
          questionText: resp.questionText || `Pergunta ${resp.questionId}`,
          transcription: resp.transcription || resp.responseText || 'Transcrição via Whisper em processamento',
          audioUrl: audioUrl,
          score: resp.score !== undefined && resp.score !== null ? resp.score : 0,
          recordingDuration: resp.recordingDuration || 0,
          aiAnalysis: resp.aiAnalysis || 'Análise IA pendente',
          ...resp
        };
      }));

      console.log(`✅ [ISOLAMENTO] Processadas ${processedResponses.length} respostas da seleção ${selectionId}`);
      console.log(`📋 [DEBUG_NOVA_SELEÇÃO] STORAGE FINAL - Total de respostas para seleção ${selectionId}:`, {
        candidateId: candidateId,
        responsesCount: processedResponses.length,
        withAudio: processedResponses.filter(r => r.audioUrl).length,
        withTranscription: processedResponses.filter(r => r.transcription && r.transcription !== 'Aguardando resposta via WhatsApp').length
      });

      return processedResponses.sort((a, b) => (a.questionId || 0) - (b.questionId || 0));
    } catch (error) {
      console.error('Erro ao buscar respostas por seleção/candidato:', error);
      return [];
    }
  }



  async updateResponse(responseId: string, updates: any): Promise<void> {
    try {
      const docRef = doc(firebaseDb, 'responses', responseId);
      await updateDoc(docRef, updates);
    } catch (error) {
      console.log('❌ Erro ao atualizar resposta:', error.message);
      throw error;
    }
  }

  // API Config - configurações específicas por cliente/master (voz TTS + WhatsApp QR)
  async getApiConfig(entityType: string, entityId: string): Promise<ApiConfig | undefined> {
    console.log(`🔍 [API-CONFIG] Buscando configuração para: ${entityType}/${entityId}`);
    
    const configsSnapshot = await getDocs(collection(firebaseDb, "apiConfigs"));
    console.log(`📊 [API-CONFIG] Total de configurações no Firebase: ${configsSnapshot.docs.length}`);

    for (const configDoc of configsSnapshot.docs) {
      const data = configDoc.data();
      console.log(`🔍 [API-CONFIG] Verificando doc: entityType="${data.entityType}", entityId="${data.entityId}", openaiVoice="${data.openaiVoice}"`);

      if (data.entityType === entityType && data.entityId === entityId) {
        const config = { id: parseInt(configDoc.id) || Date.now(), ...data } as ApiConfig;
        console.log(`✅ [API-CONFIG] Configuração encontrada:`, config);
        return config;
      }
    }

    console.log(`❌ [API-CONFIG] Nenhuma configuração encontrada para ${entityType}/${entityId}`);
    console.log(`🔍 [API-CONFIG] Todas as configurações disponíveis:`);
    configsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      console.log(`  - Doc ID: ${doc.id}, entityType: "${data.entityType}", entityId: "${data.entityId}", openaiVoice: "${data.openaiVoice}"`);
    });
    
    return undefined;
  }

  async upsertApiConfig(config: InsertApiConfig): Promise<ApiConfig> {
    console.log(`💾 [UPSERT-CONFIG] Iniciando upsert para ${config.entityType}/${config.entityId}`);
    console.log(`💾 [UPSERT-CONFIG] Dados recebidos:`, config);
    
    // Busca configuração existente
    const existingConfig = await this.getApiConfig(config.entityType, config.entityId);
    console.log(`💾 [UPSERT-CONFIG] Configuração existente:`, existingConfig);

    // IMPORTANTE: Preservar campos existentes que não estão sendo atualizados
    const configData = { 
      ...existingConfig, // Preserva todos os campos existentes primeiro
      ...config,         // Sobrescreve apenas os campos fornecidos
      id: existingConfig?.id || Date.now(), 
      updatedAt: new Date() 
    };
    console.log(`💾 [UPSERT-CONFIG] Dados finais para salvar:`, configData);

    // Se existe, usa mesmo documento. Se não existe, cria novo
    const docId = existingConfig ? 
      `${config.entityType}_${config.entityId}` : 
      `${config.entityType}_${config.entityId}_${Date.now()}`;
    
    console.log(`💾 [UPSERT-CONFIG] Document ID usado: "${docId}"`);

    await setDoc(doc(firebaseDb, "apiConfigs", docId), configData);
    console.log(`✅ [UPSERT-CONFIG] Configuração salva com sucesso no Firebase`);
    
    return configData as ApiConfig;
  }

  // Client Voice Settings
  async getClientVoiceSetting(clientId: number): Promise<ClientVoiceSetting | undefined> {
    const snapshot = await getDocs(collection(firebaseDb, "clientVoiceSettings"));
    const setting = snapshot.docs
      .map(doc => ({ id: parseInt(doc.id), ...doc.data() } as ClientVoiceSetting))
      .find(setting => setting.clientId === clientId);
    return setting;
  }

  async upsertClientVoiceSetting(setting: InsertClientVoiceSetting): Promise<ClientVoiceSetting> {
    // Buscar configuração existente
    const existing = await this.getClientVoiceSetting(setting.clientId);

    if (existing) {
      // Atualizar existente
      const updatedData = {
        ...existing,
        ...setting,
        updatedAt: new Date()
      };
      await setDoc(doc(firebaseDb, "clientVoiceSettings", String(existing.id)), updatedData);
      return updatedData as ClientVoiceSetting;
    } else {
      // Criar novo
      const settingId = Date.now();
      const settingData = {
        ...setting,
        id: settingId,
        updatedAt: new Date()
      };
      await setDoc(doc(firebaseDb, "clientVoiceSettings", String(settingId)), settingData);
      return settingData as ClientVoiceSetting;
    }
  }

  // Master Settings - configurações OpenAI globais compartilhadas entre todos os masters
  async getMasterSettings(): Promise<MasterSettings | undefined> {
    const docRef = doc(firebaseDb, "masterSettings", "global");
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: 1, ...docSnap.data() } as MasterSettings : undefined;
  }

  async upsertMasterSettings(settings: InsertMasterSettings): Promise<MasterSettings> {
    const settingsData = { 
      ...settings, 
      id: 1, 
      updatedAt: new Date() 
    };
    await setDoc(doc(firebaseDb, "masterSettings", "global"), settingsData);
    return settingsData as MasterSettings;
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

  async getAllCandidateListMemberships(): Promise<any[]> {
    const snapshot = await getDocs(collection(firebaseDb, "candidateListMemberships"));
    return snapshot.docs.map(doc => ({ id: parseInt(doc.id), ...doc.data() }));
  }

  // Criar configuração padrão de API para novo cliente
  async createDefaultClientApiConfig(clientId: string): Promise<void> {
    const docId = `client_${clientId}`;
    const apiConfigData = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      entityType: "client",
      entityId: clientId,
      openaiVoice: "nova", // Voz padrão brasileira
      whatsappQrConnected: false,
      whatsappQrPhoneNumber: null,
      whatsappQrLastConnection: null,
      firebaseProjectId: null,
      firebaseServiceAccount: null,
      updatedAt: new Date()
    };

    await setDoc(doc(firebaseDb, "apiConfigs", docId), apiConfigData);
    console.log(`✅ Configuração padrão criada para cliente ${clientId}: ${docId}`);
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

  // Password reset operations
  async createPasswordResetToken(email: string, userType: string): Promise<string> {
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    const tokenData = {
      email,
      token,
      userType,
      expiresAt,
      used: false,
      createdAt: new Date(),
    };

    await addDoc(collection(firebaseDb, 'passwordResetTokens'), tokenData);
    return token;
  }

  async validatePasswordResetToken(token: string): Promise<{ email: string; userType: string } | null> {
    const q = query(
      collection(firebaseDb, 'passwordResetTokens'),
      where('token', '==', token),
      where('used', '==', false),
      where('expiresAt', '>', new Date())
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    const data = doc.data();

    // Mark token as used
    await doc.ref.update({ used: true });

    return {
      email: data.email,
      userType: data.userType,
    };
  }

  async updateUserPassword(email: string, userType: string, newPasswordHash: string): Promise<boolean> {
    try {
      if (userType === 'master') {
        const q = query(
          collection(firebaseDb, 'users'),
          where('email', '==', email),
          where('role', '==', 'master')
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          await updateDoc(snapshot.docs[0].ref, { password: newPasswordHash });
          return true;
        }
      } else if (userType === 'client') {
        const q = query(
          collection(firebaseDb, 'clients'),
          where('email', '==', email)
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          await updateDoc(snapshot.docs[0].ref, { password: newPasswordHash });
          return true;
        }

      }

      return false;
    } catch (error) {
      console.error('Error updating password:', error);
      return false;
    }
  }

  async findUserByEmail(email: string): Promise<{ userType: string; name: string } | null> {
    // Check master users
    const masterQuery = query(
      collection(firebaseDb, 'users'),
      where('email', '==', email),
      where('role', '==', 'master')
    );
    const masterSnapshot = await getDocs(masterQuery);

    if (!masterSnapshot.empty) {
      const data = masterSnapshot.docs[0].data();
      return { userType: 'master', name: data.name };
    }

    // Check clients
    const clientQuery = query(
      collection(firebaseDb, 'clients'),
      where('email', '==', email)
    );
    const clientSnapshot = await getDocs(clientQuery);

    if (!clientSnapshot.empty) {
      const data = clientSnapshot.docs[0].data();
      return { userType: 'client', name: data.companyName };
    }



    return null;
  }

  // Password reset tokens
  async createResetToken(email: string, token: string): Promise<void> {
    await setDoc(doc(firebaseDb, 'resetTokens', token), {
      email,
      createdAt: new Date(),
    });
  }

  async getResetToken(token: string): Promise<{ email: string; createdAt: Date } | undefined> {
    const docRef = doc(firebaseDb, 'resetTokens', token);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        email: data.email,
        createdAt: data.createdAt.toDate()
      };
    }

    return undefined;
  }

  async deleteResetToken(token: string): Promise<void> {
    await deleteDoc(doc(firebaseDb, 'resetTokens', token));
  }

  async updateUserPassword(email: string, hashedPassword: string): Promise<void> {
    // Check if it's a master user
    const masterQuery = query(
      collection(firebaseDb, 'users'),
      where('email', '==', email)
    );
    const masterSnapshot = await getDocs(masterQuery);

    if (!masterSnapshot.empty) {
      const userDoc = masterSnapshot.docs[0];
      await updateDoc(userDoc.ref, { password: hashedPassword });
      return;
    }

    // Check if it's a client
    const clientQuery = query(
      collection(firebaseDb, 'clients'),
      where('email', '==', email)
    );
    const clientSnapshot = await getDocs(clientQuery);

    if (!clientSnapshot.empty) {
      const clientDoc = clientSnapshot.docs[0];
      await updateDoc(clientDoc.ref, { password: hashedPassword });
      return;
    }



    throw new Error('Usuário não encontrado');
  }

  // Candidate List Memberships (muitos-para-muitos)
  async addCandidateToList(candidateId: number, listId: number, clientId: number): Promise<CandidateListMembership> {
    const membershipId = Date.now() + Math.floor(Math.random() * 1000);
    const membershipData = {
      id: membershipId,
      candidateId,
      listId,
      clientId,
      createdAt: new Date()
    };
    await setDoc(doc(firebaseDb, "candidateListMemberships", String(membershipId)), membershipData);
    return membershipData as CandidateListMembership;
  }

  async removeCandidateFromList(candidateId: number, listId: number): Promise<void> {
    console.log(`🗑️ Removendo candidato ${candidateId} da lista ${listId}`);
    const snapshot = await getDocs(collection(firebaseDb, "candidateListMemberships"));
    const membership = snapshot.docs.find(doc => {
      const data = doc.data();
      return data.candidateId === candidateId && data.listId === listId;
    });

    if (membership) {
      console.log(`✅ Encontrado membership para remover: ${membership.id}`);
      await deleteDoc(membership.ref);
      console.log(`✅ Membership removido com sucesso: ${membership.id}`);
    } else {
      console.log(`⚠️ Nenhum membership encontrado para candidato ${candidateId} na lista ${listId}`);
    }
  }

  async getCandidateListMemberships(candidateId: number): Promise<CandidateListMembership[]> {
    const snapshot = await getDocs(collection(firebaseDb, "candidateListMemberships"));
    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as CandidateListMembership))
      .filter(membership => membership.candidateId === candidateId);
  }

  async getAllCandidateListMemberships(): Promise<CandidateListMembership[]> {
    console.log('🔍 Buscando TODOS os candidateListMemberships no Firebase...');
    const snapshot = await getDocs(collection(firebaseDb, "candidateListMemberships"));
    const memberships = snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    } as CandidateListMembership));
    console.log(`📋 Total de memberships encontrados: ${memberships.length}`);
    return memberships;
  }

  async getCandidateListMembershipsByClientId(clientId: number): Promise<CandidateListMembership[]> {
    console.log(`🔍 Buscando candidateListMemberships para clientId: ${clientId}`);

    const membershipsRef = collection(firebaseDb, 'candidateListMemberships');
    const q = query(membershipsRef, where('clientId', '==', clientId));
    const querySnapshot = await getDocs(q);

    const memberships = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: data.id || doc.id,
        candidateId: data.candidateId,
        listId: data.listId,
        clientId: data.clientId,
        createdAt: data.createdAt?.toDate() || null
      } as CandidateListMembership;
    });

    console.log(`📋 Memberships encontrados para cliente ${clientId}: ${memberships.length}`);
    console.log(`🔍 Cliente danielmoreirabraga@gmail.com buscando memberships do clientId ${clientId}: ${memberships.length} encontrados`);

    return memberships;
  }

  async getCandidatesInList(listId: number): Promise<Candidate[]> {
    return this.getCandidatesByListId(listId);
  }

  async getCandidatesByMultipleClients(clientIds: number[]): Promise<Candidate[]> {
    // Busca memberships de todos os clientes especificados
    const membershipsSnapshot = await getDocs(collection(firebaseDb, "candidateListMemberships"));
    const memberships = membershipsSnapshot.docs
      .map(doc => ({ id: parseInt(doc.id), ...doc.data() } as CandidateListMembership))
      .filter(membership => clientIds.includes(membership.clientId));

    // Busca candidatos únicos baseado nos IDs encontrados
    const candidateIds = [...new Set(memberships.map(m => m.candidateId))];
    if (candidateIds.length === 0) return [];

    const candidatesSnapshot = await getDocs(collection(firebaseDb, "candidates"));
    return candidatesSnapshot.docs
      .map(doc => ({ id: parseInt(doc.id), ...doc.data() } as Candidate))
      .filter(candidate => candidateIds.includes(candidate.id));
  }

  // Client Users Management
  async createClientUser(userData: {
    name: string;
    email: string;
    password: string;
    role: string;
    clientId: number;
  }): Promise<any> {
    console.log('🔧 Storage: Criando usuário cliente com dados:', {
      name: userData.name,
      email: userData.email,
      role: userData.role,
      clientId: userData.clientId
    });

    const userId = Date.now().toString();
    const userDoc = {
      id: userId,
      name: userData.name,
      email: userData.email,
      password: userData.password,
      role: userData.role,
      clientId: userData.clientId,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log('💾 Storage: Salvando usuário no Firebase com ID:', userId);
    await setDoc(doc(firebaseDb, 'users', userId), userDoc);

    console.log('✅ Storage: Usuário criado com sucesso');
    return userDoc;
  }

  async getClientUsers(clientId: number): Promise<any[]> {
    console.log('🔍 Storage: Buscando usuários do cliente:', clientId);
    const q = query(
      collection(firebaseDb, 'users'),
      where('clientId', '==', clientId),
      where('role', '==', 'client')
    );
    const snapshot = await getDocs(q);

    const users = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`📋 Storage: Encontrados ${users.length} usuários para o cliente ${clientId}`);
    return users;
  }

  async fixClientUsersWithoutClientId(clientId: number): Promise<void> {
    // Este método pode ser usado para corrigir usuários antigos sem clientId se necessário
    console.log('🔧 Storage: Verificando usuários sem clientId para cliente:', clientId);
  }

  async updateCandidate(candidateId: number, updates: { name?: string; email?: string; whatsapp?: string }): Promise<any> {
    const candidatesRef = collection(firebaseDb, 'candidates');
    const q = query(candidatesRef, where('id', '==', candidateId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      throw new Error('Candidate not found');
    }

    const doc = snapshot.docs[0];
    const candidateData = { ...doc.data(), ...updates };

    await updateDoc(doc.ref, candidateData);

    return {
      id: candidateData.id,
      name: candidateData.name,
      email: candidateData.email,
      whatsapp: candidateData.whatsapp,
      clientId: candidateData.clientId,
      createdAt: candidateData.createdAt?.toDate() || null
    };
  }

  async deleteCandidate(candidateId: number): Promise<void> {
    const candidatesRef = collection(firebaseDb, 'candidates');
    const q = query(candidatesRef, where('id', '==', candidateId));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
    }
  }

  async removeCandidateFromAllLists(candidateId: number): Promise<void> {
    const membershipsRef = collection(firebaseDb, 'candidateListMemberships');
    const q = query(membershipsRef, where('candidateId', '==', candidateId));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
    }
  }

  async addCandidateToList(candidateId: number, listId: number, clientId: number): Promise<void> {
    console.log(`🔗 Adicionando candidato ${candidateId} à lista ${listId} do cliente ${clientId}`);

    // Check if membership already exists
    const membershipsRef = collection(firebaseDb, 'candidateListMemberships');
    const existingQuery = query(
      membershipsRef,
      where('candidateId', '==', candidateId),
      where('listId', '==', listId)
    );

    const existingSnapshot = await getDocs(existingQuery);
    console.log(`🔍 Verificação de duplicata: encontrados ${existingSnapshot.docs.length} memberships existentes`);

    if (!existingSnapshot.empty) {
      console.log(`⚠️ Membership já existe para candidato ${candidateId} na lista ${listId} - retornando sucesso`);
      return; // Already exists, but return success for UI consistency
    }

    // Create new membership with timestamp ID for uniqueness
    const membershipData = {
      id: Date.now(),
      candidateId,
      listId,
      clientId,
      createdAt: new Date()
    };

    console.log(`✅ Criando novo membership:`, membershipData);
    await addDoc(membershipsRef, membershipData);
    console.log(`✅ Membership criado com sucesso para candidato ${candidateId} na lista ${listId}`);
  }

  async removeCandidateFromList(candidateId: number, listId: number): Promise<void> {
    const membershipsRef = collection(firebaseDb, 'candidateListMemberships');
    const q = query(
      membershipsRef,
      where('candidateId', '==', candidateId),
      where('listId', '==', listId)
    );

    const snapshot = await getDocs(q);
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
  }

  async getInterviewsBySelection(selectionId: number): Promise<any[]> {
    try {
      console.log(`🔍 Buscando entrevistas para seleção ${selectionId}`);

      const db = this.getDb();
      const interviewsSnapshot = await db.collection('interviews')
        .where('selectionId', '==', selectionId)
        .get();

      const interviews = interviewsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log(`📋 Encontradas ${interviews.length} entrevistas para seleção ${selectionId}`);
      return interviews;
    } catch (error) {
      console.error('Erro ao buscar entrevistas por seleção:', error);
      return [];
    }
  }




  // === MÉTODOS PARA RELATÓRIOS INDEPENDENTES ===

  async createReport(reportData: any): Promise<any> {
    try {
      const reportId = `report_${reportData.selectionId}_${Date.now()}`;
      const report = {
        ...reportData,
        id: reportId,
        createdAt: new Date(),
        generatedAt: new Date()
      };

      await setDoc(doc(firebaseDb, "reports", reportId), report);
      console.log(`✅ Relatório criado: ${reportId}`);
      return report;
    } catch (error) {
      console.error('Erro ao criar relatório:', error);
      throw error;
    }
  }

  async createReportCandidate(candidateData: any): Promise<any> {
    try {
      const candidateId = `${candidateData.reportId}_${candidateData.originalCandidateId}`;
      const candidate = {
        ...candidateData,
        id: candidateId,
        createdAt: new Date()
      };

      await setDoc(doc(firebaseDb, "report_candidates", candidateId), candidate);
      return candidate;
    } catch (error) {
      console.error('Erro ao criar candidato do relatório:', error);
      throw error;
    }
  }

  async createReportResponse(responseData: any): Promise<any> {
    try {
      const responseId = `${responseData.reportId}_${responseData.reportCandidateId}_R${responseData.questionNumber}`;
      const response = {
        ...responseData,
        id: responseId,
        createdAt: new Date()
      };

      await setDoc(doc(firebaseDb, "report_responses", responseId), response);
      return response;
    } catch (error) {
      console.error('Erro ao criar resposta do relatório:', error);
      throw error;
    }
  }

  async getAllReports(): Promise<any[]> {
    try {
      const snapshot = await getDocs(collection(firebaseDb, "reports"));
      const reports = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Ordenar do mais recente para o mais antigo
      return reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      console.error('Erro ao buscar relatórios:', error);
      return [];
    }
  }

  async getReportsByClientId(clientId: number): Promise<any[]> {
    try {
      const q = query(
        collection(firebaseDb, "reports"),
        where("clientId", "==", clientId)
      );
      const snapshot = await getDocs(q);
      const reports = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      console.error('Erro ao buscar relatórios por cliente:', error);
      return [];
    }
  }

  async getReportCandidates(reportId: string): Promise<any[]> {
    try {
      const q = query(
        collection(firebaseDb, "report_candidates"),
        where("reportId", "==", reportId)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Erro ao buscar candidatos do relatório:', error);
      return [];
    }
  }

  async getReportResponses(reportCandidateId: string): Promise<any[]> {
    try {
      const q = query(
        collection(firebaseDb, "report_responses"),
        where("reportCandidateId", "==", reportCandidateId)
      );
      const snapshot = await getDocs(q);
      const responses = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return responses.sort((a, b) => a.questionNumber - b.questionNumber);
    } catch (error) {
      console.error('Erro ao buscar respostas do relatório:', error);
      return [];
    }
  }

  async deleteReport(reportId: string): Promise<void> {
    try {
      // Deletar o relatório principal
      await deleteDoc(doc(firebaseDb, "reports", reportId));

      // Deletar todos os candidatos do relatório
      const candidatesQuery = query(
        collection(firebaseDb, "report_candidates"),
        where("reportId", "==", reportId)
      );
      const candidatesSnapshot = await getDocs(candidatesQuery);

      const batch = writeBatch(firebaseDb);
      candidatesSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Deletar todas as respostas do relatório
      const responsesQuery = query(
        collection(firebaseDb, "report_responses"),
        where("reportId", "==", reportId)
      );
      const responsesSnapshot = await getDocs(responsesQuery);

      responsesSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log(`✅ Relatório ${reportId} deletado completamente`);
    } catch (error) {
      console.error('Erro ao deletar relatório:', error);
      throw error;
    }
  }

  async generateReportFromSelection(selectionId: string): Promise<string> {
    try {
      console.log(`🔄 Gerando relatório para seleção ${selectionId}...`);

      // Buscar dados da seleção
      const selection = await this.getSelectionById(parseInt(selectionId));
      if (!selection) {
        throw new Error('Seleção não encontrada');
      }

      console.log(`📋 Seleção encontrada: ${selection.name}`);

      // Buscar dados do job
      const job = await this.getJobById(selection.jobId);
      if (!job) {
        console.log(`❌ Job ${selection.jobId} não encontrado`);
        throw new Error('Job não encontrado');
      }

      console.log(`💼 Job encontrado: ${job.nomeVaga}`);

      // Buscar dados do cliente
      const client = await this.getClientById(selection.clientId);
      if (!client) {
        console.log(`❌ Cliente ${selection.clientId} não encontrado`);
        throw new Error('Cliente não encontrado');
      }

      console.log(`🏢 Cliente encontrado: ${client.companyName}`);

      // Buscar dados da lista de candidatos
      const candidateList = await this.getCandidateListById(selection.candidateListId);
      if (!candidateList) {
        console.log(`❌ Lista ${selection.candidateListId} não encontrada`);
        throw new Error('Lista de candidatos não encontrada');
      }

      console.log(`📝 Lista encontrada: ${candidateList.name}`);

      // Buscar candidatos da seleção
      const candidates = await this.getCandidatesInList(selection.candidateListId);
      console.log(`👥 ${candidates.length} candidatos encontrados na lista`);

      // Criar relatório principal
      const report = await this.createReport({
        selectionId: selectionId,
        selectionName: selection.name,
        jobName: job.nomeVaga,
        clientId: selection.clientId,
        clientName: client.companyName,
        candidateListName: candidateList.name,
        totalCandidates: candidates.length,
        completedInterviews: 0 // Será atualizado após processar candidatos
      });

      console.log(`📊 Relatório principal criado: ${report.id}`);

      let completedCount = 0;

      // Processar cada candidato
      for (const candidate of candidates) {
        console.log(`👤 Processando candidato: ${candidate.name} (${candidate.id})`);

        // Buscar respostas do candidato para esta seleção - usando múltiplos formatos de ID
        const responses = await this.getResponsesBySelectionAndCandidate(
          selectionId,
          candidate.id,
          selection.clientId
        );

        console.log(`📝 ${responses.length} respostas encontradas para ${candidate.name}`);

        const status = responses.length > 0 ? 'completed' : 'invited';
        if (status === 'completed') completedCount++;

        // Criar candidato do relatório
        const reportCandidate = await this.createReportCandidate({
          reportId: report.id,
          originalCandidateId: candidate.id.toString(),
          name: candidate.name,
          email: candidate.email,
          whatsapp: candidate.whatsapp,
          status: status,
          totalScore: responses.length > 0 ? Math.round(responses.reduce((sum, r) => sum + (r.score || 0), 0) / responses.length) : 0,
          completedAt: status === 'completed' ? new Date() : null
        });

        console.log(`👤 Candidato do relatório criado: ${reportCandidate.id}`);

        // Criar respostas do relatório com nova nomenclatura de áudio
        if (responses.length > 0) {
          for (const response of responses) {
            // Nova nomenclatura: audio_[whatsapp]_[selectionId]_R[numero].ogg
            const cleanPhone = candidate.whatsapp.replace(/\D/g, '');
            const newAudioFileName = response.audioFile ? 
              `audio_${cleanPhone}_${selectionId}_R${response.questionId || 1}.ogg` : 
              '';

            await this.createReportResponse({
              reportId: report.id,
              reportCandidateId: reportCandidate.id,
              questionNumber: response.questionId || 1,
              questionText: response.questionText || `Pergunta ${response.questionId}`,
              transcription: response.transcription,
              audioFile: newAudioFileName, // Nova nomenclatura aplicada
              score: response.score || 0,
              recordingDuration: response.recordingDuration || 0,
              aiAnalysis: response.aiAnalysis
            });

            console.log(`📝 Resposta do relatório criada: pergunta ${response.questionId}`);
          }
        }
      }

      // Atualizar contador de entrevistas completadas
      await updateDoc(doc(firebaseDb, "reports", report.id), {
        completedInterviews: completedCount
      });

      console.log(`✅ Relatório ${report.id} gerado com ${candidates.length} candidatos, ${completedCount} completos`);
      return report.id;

    } catch (error) {
      console.error('❌ Erro ao gerar relatório:', error);
      console.error('Stack trace:', error.stack);
      throw error;
    }
  }

  // Candidate Categories - para relatórios
  async getCandidateCategory(reportId: string, candidateId: string): Promise<any> {
    try {
      const categoryId = `${reportId}_${candidateId}`;
      const categoryRef = doc(firebaseDb, "candidateCategories", categoryId);
      const categoryDoc = await getDoc(categoryRef);

      if (categoryDoc.exists()) {
        return { id: categoryDoc.id, ...categoryDoc.data() };
      }
      return null;
    } catch (error) {
      console.error('❌ Erro ao buscar categoria do candidato:', error);
      return null;
    }
  }

  async setCandidateCategory(reportId: string, candidateId: string, category: string, clientId: number): Promise<any> {
    try {
      const categoryId = `${reportId}_${candidateId}`;
      const categoryData = {
        reportId,
        candidateId: candidateId.toString(), // Garantir que sempre seja string
        category,
        clientId,
        updatedAt: new Date()
      };

      const categoryRef = doc(firebaseDb, "candidateCategories", categoryId);
      const existingDoc = await getDoc(categoryRef);

      if (existingDoc.exists()) {
        await updateDoc(categoryRef, categoryData);
      } else {
        await setDoc(categoryRef, {
          ...categoryData,
          createdAt: new Date()
        });
      }

      console.log(`✅ [STORAGE] Categoria ${category} salva para candidato ${candidateId} (string: ${candidateId.toString()}) no relatório ${reportId}`);
      return { id: categoryId, ...categoryData };
    } catch (error) {
      console.error('❌ Erro ao salvar categoria do candidato:', error);
      throw error;
    }
  }

  async getCategoriesByReportId(reportId: string): Promise<any[]> {
    try {
      const categoriesRef = collection(firebaseDb, "candidateCategories");
      const q = query(categoriesRef, where("reportId", "==", reportId));
      const querySnapshot = await getDocs(q);

      const categories = [];
      querySnapshot.forEach((doc) => {
        categories.push({ id: doc.id, ...doc.data() });
      });

      return categories;
    } catch (error) {
      console.error('❌ Erro ao buscar categorias do relatório:', error);
      return [];
    }
  }

  async getCandidateCategories(selectionId: string): Promise<any[]> {
    try {
      const reportId = `selection_${selectionId}`;
      const categoriesRef = collection(firebaseDb, 'candidateCategories');
      const q = query(categoriesRef, where('reportId', '==', reportId));
      const snapshot = await getDocs(q);

      const categories = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log(`📋 [STORAGE] Categorias encontradas para ${reportId}:`, categories.length);
      return categories;
    } catch (error) {
      console.error('Erro ao buscar categorias por selectionId:', error);
      return [];
    }
  }



  // Report Folders - Sistema de pastas de trabalho
  async getReportFoldersByClientId(clientId: string): Promise<ReportFolder[]> {
    try {
      console.log(`🗂️ Buscando pastas para cliente: ${clientId}`);

      // Use simpler query without orderBy to avoid index requirements
      const foldersRef = collection(firebaseDb, 'reportFolders');
      const querySnapshot = await getDocs(foldersRef);

      const allFolders = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          clientId: data.clientId,
          color: data.color || '#3b82f6',
          position: data.position || 0,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        };
      }) as ReportFolder[];

      // Filter by clientId in memory and sort by position
      const clientFolders = allFolders
        .filter(folder => folder.clientId === clientId)
        .sort((a, b) => (a.position || 0) - (b.position || 0));

      console.log(`📁 Pastas encontradas para cliente ${clientId}: ${clientFolders.length}`);
      return clientFolders;
    } catch (error) {
      console.error('❌ Erro ao buscar pastas:', error);
      return [];
    }
  }

  async getReportFolderById(id: string): Promise<ReportFolder | undefined> {
    try {
      const docRef = doc(firebaseDb, 'reportFolders', id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data()
        } as ReportFolder;
      }
      return undefined;
    } catch (error) {
      console.error('❌ Erro ao buscar pasta por ID:', error);
      return undefined;
    }
  }

  async createReportFolder(folder: InsertReportFolder): Promise<ReportFolder> {
    try {
      const folderId = `folder_${Date.now()}`;
      const folderData = {
        ...folder,
        id: folderId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      await setDoc(doc(firebaseDb, 'reportFolders', folderId), folderData);
      console.log(`✅ Pasta criada: ${folderId}`);

      return folderData as ReportFolder;
    } catch (error) {
      console.error('❌ Erro ao criar pasta:', error);
      throw error;
    }
  }

  async updateReportFolder(id: string, folder: Partial<ReportFolder>): Promise<ReportFolder> {
    try {
      const docRef = doc(firebaseDb, 'reportFolders', id);
      const updateData = {
        ...folder,
        updatedAt: Timestamp.now()
      };

      await updateDoc(docRef, updateData);
      const updatedDoc = await getDoc(docRef);
      console.log(`✅ Pasta atualizada: ${id}`);

      return { id, ...updatedDoc.data() } as ReportFolder;
    } catch (error) {
      console.error('❌ Erro ao atualizar pasta:', error);
      throw error;
    }
  }

  async deleteReportFolder(id: string): Promise<void> {
    try {
      // Primeiro, remover todas as atribuições de relatórios dessa pasta
      const assignmentsRef = collection(firebaseDb, 'reportFolderAssignments');
      const q = query(assignmentsRef, where('folderId', '==', id));
      const querySnapshot = await getDocs(q);

      const batch = writeBatch(firebaseDb);
      querySnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Deletar a pasta
      batch.delete(doc(firebaseDb, 'reportFolders', id));
      await batch.commit();

      console.log(`🗑️ Pasta deletada: ${id} (${querySnapshot.docs.length} atribuições removidas)`);
    } catch (error) {
      console.error('❌ Erro ao deletar pasta:', error);
      throw error;
    }
  }

  // Report Folder Assignments - Atribuições de relatórios às pastas
  async getReportFolderAssignments(folderId: string): Promise<ReportFolderAssignment[]> {
    try {
      const assignmentsRef = collection(firebaseDb, 'reportFolderAssignments');
      const q = query(assignmentsRef, where('folderId', '==', folderId));
      const querySnapshot = await getDocs(q);

      const assignments = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ReportFolderAssignment[];

      console.log(`📋 Atribuições encontradas para pasta ${folderId}: ${assignments.length}`);
      return assignments;
    } catch (error) {
      console.error('❌ Erro ao buscar atribuições:', error);
      return [];
    }
  }

  async getReportFolderAssignmentByReportId(reportId: string): Promise<ReportFolderAssignment | undefined> {
    try {
      const assignmentsRef = collection(firebaseDb, 'reportFolderAssignments');
      const q = query(assignmentsRef, where('reportId', '==', reportId));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        return {
          id: doc.id,
          ...doc.data()
        } as ReportFolderAssignment;
      }
      return undefined;
    } catch (error) {
      console.error('❌ Erro ao buscar atribuição por reportId:', error);
      return undefined;
    }
  }

  async assignReportToFolder(assignment: InsertReportFolderAssignment): Promise<ReportFolderAssignment> {
    try {
      // Primeiro, remover qualquer atribuição existente para este relatório
      await this.removeReportFromFolder(assignment.reportId);

      const assignmentId = `assignment_${Date.now()}`;
      const assignmentData = {
        ...assignment,
        id: assignmentId,
        assignedAt: Timestamp.now()
      };

      await setDoc(doc(firebaseDb, 'reportFolderAssignments', assignmentId), assignmentData);
      console.log(`✅ Relatório ${assignment.reportId} atribuído à pasta ${assignment.folderId}`);

      return assignmentData as ReportFolderAssignment;
    } catch (error) {
      console.error('❌ Erro ao atribuir relatório à pasta:', error);
      throw error;
    }
  }

  async removeReportFromFolder(reportId: string): Promise<void> {
    try {
      const assignmentsRef = collection(firebaseDb, 'reportFolderAssignments');
      const q = query(assignmentsRef, where('reportId', '==', reportId));
      const querySnapshot = await getDocs(q);

      const batch = writeBatch(firebaseDb);
      querySnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      console.log(`🗑️ Relatório ${reportId} removido de todas as pastas`);
    } catch (error) {
      console.error('❌ Erro ao remover relatório da pasta:', error);
      throw error;
    }
  }

  async moveReportToFolder(reportId: string, folderId: string): Promise<void> {
    try {
      await this.assignReportToFolder({
        reportId,
        folderId
      });
      console.log(`📁 Relatório ${reportId} movido para pasta ${folderId}`);
    } catch (error) {
      console.error('❌ Erro ao mover relatório:', error);
      throw error;
    }
  }

  // Report Folder Assignments - Implementações que estavam faltando
  async getAllReportFolderAssignments(): Promise<ReportFolderAssignment[]> {
    try {
      console.log('📋 Buscando todos os assignments de pastas');
      const snapshot = await getDocs(collection(firebaseDb, "reportFolderAssignments"));
      const assignments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ReportFolderAssignment));
      console.log(`📋 Encontrados ${assignments.length} assignments totais`);
      return assignments;
    } catch (error) {
      console.error('Erro ao buscar assignments:', error);
      return [];
    }
  }

  async getAllReportFolderAssignmentsByClientId(clientId: string): Promise<ReportFolderAssignment[]> {
    try {
      console.log('📋 Buscando assignments por clientId:', clientId);

      // Primeiro buscar todas as pastas do cliente
      const foldersQuery = query(
        collection(firebaseDb, "reportFolders"),
        where("clientId", "==", clientId)
      );
      const foldersSnapshot = await getDocs(foldersQuery);
      const folderIds = foldersSnapshot.docs.map(doc => doc.id);

      console.log(`📁 Cliente tem ${folderIds.length} pastas:`, folderIds);

      if (folderIds.length === 0) {
        console.log('📋 Cliente não tem pastas, retornando array vazio');
        return [];
      }

      // Buscar assignments dessas pastas
      const allAssignments: ReportFolderAssignment[] = [];

      for (const folderId of folderIds) {
        const assignmentsQuery = query(
          collection(firebaseDb, "reportFolderAssignments"),
          where("folderId", "==", folderId)
        );
        const assignmentsSnapshot = await getDocs(assignmentsQuery);

        const folderAssignments = assignmentsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as ReportFolderAssignment));

        allAssignments.push(...folderAssignments);
      }

      console.log(`📋 Encontrados ${allAssignments.length} assignments para cliente ${clientId}`);
      return allAssignments;
    } catch (error) {
      console.error('Erro ao buscar assignments por cliente:', error);
      return [];
    }
  }

  async createReportFolderAssignment(assignment: InsertReportFolderAssignment): Promise<ReportFolderAssignment> {
    try {
      const assignmentId = `${assignment.reportId}_${assignment.folderId}`;
      const assignmentData = {
        ...assignment,
        id: assignmentId,
        assignedAt: new Date()
      };

      await setDoc(doc(firebaseDb, "reportFolderAssignments", assignmentId), assignmentData);
      console.log(`✅ Assignment criado: ${assignmentId}`);
      return assignmentData as ReportFolderAssignment;
    } catch (error) {
      console.error('Erro ao criar assignment:', error);
      throw error;
    }
  }

  async deleteReportFolderAssignment(reportId: string): Promise<void> {
    try {
      console.log('🗑️ Removendo assignments para report:', reportId);

      const assignmentsQuery = query(
        collection(firebaseDb, "reportFolderAssignments"),
        where("reportId", "==", reportId)
      );
      const snapshot = await getDocs(assignmentsQuery);

      const batch = writeBatch(firebaseDb);
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log(`✅ Removidos ${snapshot.docs.length} assignments para ${reportId}`);
    } catch (error) {
      console.error('Erro ao remover assignments:', error);
      throw error;
    }
  }
}

export const storage = new FirebaseStorage();