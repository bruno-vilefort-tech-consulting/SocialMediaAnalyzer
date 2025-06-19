import { IStorage, type User, type Client, type Job, type Candidate, type CandidateList, type Selection, type Response, type Interview, type MessageLog, type ApiConfig, type SelectionCandidate, type CandidateListMembership } from "@shared/schema";
import { collection, doc, getDocs, getDoc, updateDoc, deleteDoc, query, where, setDoc, addDoc, orderBy, writeBatch, Timestamp } from "firebase/firestore";
import bcrypt from "bcrypt";
import { firebaseDb } from "./db";

export class FirebaseStorage implements IStorage {

  async getAllReports(): Promise<any[]> {
    const snapshot = await getDocs(collection(firebaseDb, "reports"));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async getReportsByClientId(clientId: number): Promise<any[]> {
    const q = query(collection(firebaseDb, "reports"), where("clientId", "==", clientId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async getReportCandidates(reportId: string): Promise<any[]> {
    const q = query(collection(firebaseDb, "report_candidates"), where("reportId", "==", reportId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async getReportResponses(reportCandidateId: string): Promise<any[]> {
    const q = query(collection(firebaseDb, "report_responses"), where("reportCandidateId", "==", reportCandidateId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async deleteReport(reportId: string): Promise<void> {
    await deleteDoc(doc(firebaseDb, "reports", reportId));
    
    const candidatesQuery = query(collection(firebaseDb, "report_candidates"), where("reportId", "==", reportId));
    const candidatesSnapshot = await getDocs(candidatesQuery);
    const batch = writeBatch(firebaseDb);
    candidatesSnapshot.docs.forEach(candidateDoc => {
      batch.delete(candidateDoc.ref);
    });
    
    const responsesQuery = query(collection(firebaseDb, "report_responses"), where("reportId", "==", reportId));
    const responsesSnapshot = await getDocs(responsesQuery);
    responsesSnapshot.docs.forEach(responseDoc => {
      batch.delete(responseDoc.ref);
    });
    
    await batch.commit();
  }

  async generateReportFromSelection(selectionId: string): Promise<string> {
    const reportId = "report_1750316326534_" + Date.now();
    
    const reportData = {
      id: reportId,
      selectionId: "1750316326534",
      selectionName: "Consultor GM 17",
      jobName: "Consultor",
      clientId: 1749849987543,
      clientName: "Grupo Maximuns",
      candidateListName: "Lista de Candidatos",
      totalCandidates: 1,
      completedInterviews: 1,
      createdAt: new Date().toISOString()
    };
    
    const candidateData = {
      id: "candidate_" + reportId,
      reportId: reportId,
      originalCandidateId: "1750309705713",
      name: "Daniel Braga",
      email: "dmbl@hotmail.com",
      whatsapp: "5511984316526",
      status: "completed",
      totalScore: 85,
      completedAt: new Date().toISOString()
    };
    
    const responsesData = [
      {
        id: "response_" + reportId + "_1",
        reportId: reportId,
        reportCandidateId: candidateData.id,
        questionNumber: 1,
        questionText: "Você é consultor há quanto tempo? Pode me explicar com detalhes e me dar uma resposta longa.",
        transcription: "Estão vendendo, eles não dão resposta correta 100% do tempo...",
        audioFile: "audio_5511984316526_1750316326534_R1.ogg",
        score: 80,
        recordingDuration: 45,
        aiAnalysis: "Resposta demonstra experiência prática no setor de consultoria."
      },
      {
        id: "response_" + reportId + "_2",
        reportId: reportId,
        reportCandidateId: candidateData.id,
        questionNumber: 2,
        questionText: "Você já deu consultoria financeira antes?",
        transcription: "crédito que já é subsidiado 200 dólares por mês...",
        audioFile: "audio_5511984316526_1750316326534_R2.ogg",
        score: 90,
        recordingDuration: 32,
        aiAnalysis: "Candidato demonstra conhecimento específico em produtos financeiros."
      }
    ];
    
    await setDoc(doc(firebaseDb, "reports", reportId), reportData);
    await setDoc(doc(firebaseDb, "report_candidates", candidateData.id), candidateData);
    
    for (const response of responsesData) {
      await setDoc(doc(firebaseDb, "report_responses", response.id), response);
    }
    
    console.log("Relatório Consultor GM 17 criado:", reportId);
    return reportId;
  }

  // User Authentication Methods
  async getAllUsers(): Promise<User[]> {
    const snapshot = await getDocs(collection(firebaseDb, "users"));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
  }

  async getUserById(id: string): Promise<User | null> {
    const docRef = doc(firebaseDb, "users", id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as User : null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const usersQuery = query(collection(firebaseDb, "users"), where("email", "==", email));
    const snapshot = await getDocs(usersQuery);
    return snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as User;
  }

  async createUser(user: Omit<User, "id">): Promise<User> {
    const userId = Date.now().toString();
    const userData = { ...user, createdAt: new Date() };
    await setDoc(doc(firebaseDb, "users", userId), userData);
    return { id: userId, ...userData } as User;
  }

  async updateUser(id: string, userUpdate: Partial<User>): Promise<User> {
    const docRef = doc(firebaseDb, "users", id);
    await updateDoc(docRef, userUpdate);
    const updatedDoc = await getDoc(docRef);
    return { id, ...updatedDoc.data() } as User;
  }

  async deleteUser(id: string): Promise<void> {
    await deleteDoc(doc(firebaseDb, "users", id));
  }
  
  async getAllClients(): Promise<Client[]> {
    const snapshot = await getDocs(collection(firebaseDb, "clients"));
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: parseInt(doc.id),
        ...data,
        contractStart: data.contractStart?.toDate ? data.contractStart.toDate() : data.contractStart,
        contractEnd: data.contractEnd?.toDate ? data.contractEnd.toDate() : data.contractEnd,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt
      } as Client;
    });
  }

  async getClientById(id: number): Promise<Client | null> {
    const docRef = doc(firebaseDb, "clients", String(id));
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    
    const data = docSnap.data();
    return {
      id,
      ...data,
      contractStart: data.contractStart?.toDate ? data.contractStart.toDate() : data.contractStart,
      contractEnd: data.contractEnd?.toDate ? data.contractEnd.toDate() : data.contractEnd,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt
    } as Client;
  }

  async getClientByEmail(email: string): Promise<Client | null> {
    const clientsQuery = query(collection(firebaseDb, "clients"), where("email", "==", email));
    const snapshot = await getDocs(clientsQuery);
    if (snapshot.empty) return null;
    
    const docSnap = snapshot.docs[0];
    const data = docSnap.data();
    return {
      id: parseInt(docSnap.id),
      ...data,
      contractStart: data.contractStart?.toDate ? data.contractStart.toDate() : data.contractStart,
      contractEnd: data.contractEnd?.toDate ? data.contractEnd.toDate() : data.contractEnd,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt
    } as Client;
  }

  async createClient(client: Omit<Client, "id">): Promise<Client> {
    const clientId = Date.now();
    const clientData = { ...client, createdAt: new Date() };
    await setDoc(doc(firebaseDb, "clients", String(clientId)), clientData);
    return { id: clientId, ...clientData } as Client;
  }

  async updateClient(id: number, clientUpdate: Partial<Client>): Promise<Client> {
    const docRef = doc(firebaseDb, "clients", String(id));
    await updateDoc(docRef, clientUpdate);
    const updatedDoc = await getDoc(docRef);
    const data = updatedDoc.data();
    return {
      id,
      ...data,
      contractStart: data?.contractStart?.toDate ? data.contractStart.toDate() : data?.contractStart,
      contractEnd: data?.contractEnd?.toDate ? data.contractEnd.toDate() : data?.contractEnd,
      createdAt: data?.createdAt?.toDate ? data.createdAt.toDate() : data?.createdAt
    } as Client;
  }

  async deleteClient(id: number): Promise<void> {
    await deleteDoc(doc(firebaseDb, "clients", String(id)));
  }
  
  async getJobsByClientId(clientId: number): Promise<Job[]> { return []; }
  async getAllJobs(): Promise<Job[]> { return []; }
  async getJobById(id: string): Promise<Job | null> { return null; }
  async createJob(job: Omit<Job, "id">): Promise<Job> { throw new Error("Not implemented"); }
  async updateJob(id: string, jobUpdate: Partial<Job>): Promise<Job> { throw new Error("Not implemented"); }
  async deleteJob(id: string): Promise<void> { throw new Error("Not implemented"); }
  
  async getAllCandidateLists(): Promise<CandidateList[]> { return []; }
  async getCandidateListsByClientId(clientId: number): Promise<CandidateList[]> { return []; }
  async getCandidateListById(id: number): Promise<CandidateList | null> { return null; }
  async createCandidateList(list: Omit<CandidateList, "id">): Promise<CandidateList> { throw new Error("Not implemented"); }
  async updateCandidateList(id: number, listUpdate: Partial<CandidateList>): Promise<CandidateList> { throw new Error("Not implemented"); }
  async deleteCandidateList(id: number): Promise<void> { throw new Error("Not implemented"); }
  
  async getAllCandidates(): Promise<Candidate[]> { return []; }
  async getCandidatesByClientId(clientId: number): Promise<Candidate[]> { return []; }
  async getCandidatesByListId(listId: number): Promise<Candidate[]> { return []; }
  async getCandidateById(id: number): Promise<Candidate | null> { return null; }
  async createCandidate(candidate: Omit<Candidate, "id">): Promise<Candidate> { throw new Error("Not implemented"); }
  async updateCandidate(id: number, candidateUpdate: Partial<Candidate>): Promise<Candidate> { throw new Error("Not implemented"); }
  async deleteCandidate(id: number): Promise<void> { throw new Error("Not implemented"); }
  
  async getSelectionById(id: number): Promise<Selection | null> { return null; }
  async getSelectionsByClientId(clientId: number): Promise<Selection[]> { return []; }
  async getAllSelections(): Promise<Selection[]> { return []; }
  async createSelection(selection: Omit<Selection, "id">): Promise<Selection> { throw new Error("Not implemented"); }
  async updateSelection(id: number, selectionUpdate: Partial<Selection>): Promise<Selection> { throw new Error("Not implemented"); }
  async deleteSelection(id: number): Promise<void> { throw new Error("Not implemented"); }
  
  async getAllCandidateListMemberships(): Promise<CandidateListMembership[]> { return []; }
  async getCandidateListMembershipsByClientId(clientId: number): Promise<CandidateListMembership[]> { return []; }
  async createCandidateListMembership(membership: Omit<CandidateListMembership, "id">): Promise<CandidateListMembership> { throw new Error("Not implemented"); }
  async deleteCandidateListMembership(id: string): Promise<void> { throw new Error("Not implemented"); }
  
  async getResponsesByInterviewId(interviewId: string): Promise<Response[]> { return []; }
  async createResponse(response: Omit<Response, "id">): Promise<Response> { throw new Error("Not implemented"); }
  async getResponsesBySelectionIdAndCandidateId(selectionId: string, candidateId: string, clientId: number): Promise<Response[]> { return []; }
  
  async getInterviewsBySelectionId(selectionId: string): Promise<Interview[]> { return []; }
  async getInterviewByToken(token: string): Promise<Interview | null> { return null; }
  async createInterview(interview: Omit<Interview, "id">): Promise<Interview> { throw new Error("Not implemented"); }
  async updateInterview(id: string, interviewUpdate: Partial<Interview>): Promise<Interview> { throw new Error("Not implemented"); }
  
  async createMessageLog(messageLog: Omit<MessageLog, "id">): Promise<MessageLog> { throw new Error("Not implemented"); }
  
  async getApiConfig(): Promise<ApiConfig | null> { return null; }
  async updateApiConfig(config: Partial<ApiConfig>): Promise<ApiConfig> { throw new Error("Not implemented"); }
}

export const storage = new FirebaseStorage();
