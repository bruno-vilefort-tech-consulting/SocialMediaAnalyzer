import {
  type User, type InsertUser, type Client, type InsertClient,
  type Job, type InsertJob, type Question, type InsertQuestion,
  type CandidateList, type InsertCandidateList, type Candidate, type InsertCandidate, 
  type CandidateListMembership, type InsertCandidateListMembership,
  type Selection, type InsertSelection, type Interview, type InsertInterview, 
  type Response, type InsertResponse, type ApiConfig, type InsertApiConfig,
  type ClientVoiceSetting, type InsertClientVoiceSetting,
  type MasterSettings, type InsertMasterSettings,
  type MessageLog, type InsertMessageLog
} from "@shared/schema";
import { collection, doc, getDocs, getDoc, updateDoc, deleteDoc, query, where, setDoc, addDoc, orderBy, writeBatch } from "firebase/firestore";
import bcrypt from "bcrypt";
import { firebaseDb } from "./db";

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
  createResponse(response: InsertResponse): Promise<Response>;
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
    const snapshot = await getDocs(collection(firebaseDb, "candidates"));
    return snapshot.docs.map(doc => ({ id: parseInt(doc.id), ...doc.data() } as Candidate));
  }

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
    console.log(`🔍 getCandidatesByListId: Buscando candidatos para lista ${listId}`);
    
    // Busca memberships da lista
    const membershipsSnapshot = await getDocs(collection(firebaseDb, "candidate-list-memberships"));
    console.log(`📋 Total de memberships no banco: ${membershipsSnapshot.docs.length}`);
    
    const allMemberships = membershipsSnapshot.docs.map(doc => {
      const data = doc.data();
      return { id: doc.id, ...data };
    });
    
    console.log('🔍 Todos os memberships:', allMemberships);
    
    const memberships = allMemberships.filter(membership => membership.listId === listId);
    console.log(`🎯 Memberships para lista ${listId}:`, memberships);
    
    // Busca candidatos baseado nos IDs encontrados
    const candidateIds = memberships.map(m => m.candidateId);
    console.log(`👥 IDs de candidatos encontrados:`, candidateIds);
    
    if (candidateIds.length === 0) {
      console.log('❌ Nenhum candidato encontrado para esta lista');
      return [];
    }
    
    const candidatesSnapshot = await getDocs(collection(firebaseDb, "candidates"));
    const allCandidates = candidatesSnapshot.docs.map(doc => ({ id: parseInt(doc.id), ...doc.data() } as Candidate));
    console.log(`👤 Total de candidatos no banco: ${allCandidates.length}`);
    
    const filteredCandidates = allCandidates.filter(candidate => candidateIds.includes(candidate.id));
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
      console.log('🔗 Criando membership:', membershipData, 'com ID:', membershipId);
      await setDoc(doc(firebaseDb, "candidate-list-memberships", membershipId), membershipData);
      console.log('✅ Membership criada com sucesso');
    } else {
      console.log('❌ Membership não criada - listId:', listId, 'clientId:', clientId);
    }
    
    return candidateData as Candidate;
  }

  async createCandidates(insertCandidates: InsertCandidate[]): Promise<Candidate[]> {
    const batch = writeBatch(firebaseDb);
    const candidates: Candidate[] = [];

    for (const insertCandidate of insertCandidates) {
      const candidateId = Date.now() + Math.floor(Math.random() * 1000) + candidates.length;
      
      // Extract listId and clientId from insertCandidate
      const { listId, clientId, ...candidateFields } = insertCandidate;
      
      const candidateData = {
        ...candidateFields,
        id: candidateId,
        createdAt: new Date()
      };
      
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
        const membershipRef = doc(firebaseDb, "candidate-list-memberships", membershipId);
        batch.set(membershipRef, membershipData);
      }
    }

    await batch.commit();
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
      const membershipsSnapshot = await getDocs(collection(firebaseDb, "candidate-list-memberships"));
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

  // API Config - configurações específicas por cliente/master (voz TTS + WhatsApp QR)
  async getApiConfig(entityType: string, entityId: string): Promise<ApiConfig | undefined> {
    const configsSnapshot = await getDocs(collection(firebaseDb, "apiConfigs"));
    for (const configDoc of configsSnapshot.docs) {
      const data = configDoc.data();
      if (data.entityType === entityType && data.entityId === entityId) {
        return { id: parseInt(configDoc.id) || Date.now(), ...data } as ApiConfig;
      }
    }
    return undefined;
  }

  async upsertApiConfig(config: InsertApiConfig): Promise<ApiConfig> {
    // Busca configuração existente
    const existingConfig = await this.getApiConfig(config.entityType, config.entityId);
    
    const configData = { 
      ...config, 
      id: existingConfig?.id || Date.now(), 
      updatedAt: new Date() 
    };
    
    // Se existe, usa mesmo documento. Se não existe, cria novo
    const docId = existingConfig ? 
      `${config.entityType}_${config.entityId}` : 
      `${config.entityType}_${config.entityId}_${Date.now()}`;
    
    await setDoc(doc(firebaseDb, "apiConfigs", docId), configData);
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
    const snapshot = await getDocs(collection(firebaseDb, "candidateListMemberships"));
    const membership = snapshot.docs.find(doc => {
      const data = doc.data();
      return data.candidateId === candidateId && data.listId === listId;
    });
    
    if (membership) {
      await deleteDoc(membership.ref);
    }
  }

  async getCandidateListMemberships(candidateId: number): Promise<CandidateListMembership[]> {
    const snapshot = await getDocs(collection(firebaseDb, "candidateListMemberships"));
    return snapshot.docs
      .map(doc => ({ id: parseInt(doc.id), ...doc.data() } as CandidateListMembership))
      .filter(membership => membership.candidateId === candidateId);
  }

  async getAllCandidateListMemberships(): Promise<CandidateListMembership[]> {
    console.log('🔍 Buscando TODOS os candidate-list-memberships no Firebase...');
    const snapshot = await getDocs(collection(firebaseDb, "candidate-list-memberships"));
    const memberships = snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    } as CandidateListMembership));
    console.log(`📋 Total de memberships encontrados: ${memberships.length}`);
    return memberships;
  }

  async getCandidateListMembershipsByClientId(clientId: number): Promise<CandidateListMembership[]> {
    console.log(`🔍 Buscando candidate-list-memberships para clientId: ${clientId}`);
    const snapshot = await getDocs(collection(firebaseDb, "candidate-list-memberships"));
    const memberships = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as CandidateListMembership))
      .filter(membership => membership.clientId === clientId);
    console.log(`📋 Memberships encontrados para cliente ${clientId}: ${memberships.length}`);
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


}

export const storage = new FirebaseStorage();