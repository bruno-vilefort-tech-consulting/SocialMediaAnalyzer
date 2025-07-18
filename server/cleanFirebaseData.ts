import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, deleteDoc, query, where } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export async function cleanFirebaseData() {
  try {
    // Remover entrevistas do João Silva
    const interviewsRef = collection(db, 'interviews');
    const interviewsSnapshot = await getDocs(interviewsRef);
    
    let deletedInterviews = 0;
    for (const docSnap of interviewsSnapshot.docs) {
      const interview = docSnap.data();
      if (interview.candidateName === 'João Silva' || interview.candidatePhone === '5511984316526') {
        await deleteDoc(doc(db, 'interviews', docSnap.id));
        deletedInterviews++;
      }
    }
    
    // Remover candidato João Silva
    const candidatesRef = collection(db, 'candidates');
    const candidatesSnapshot = await getDocs(candidatesRef);
    
    let deletedCandidates = 0;
    for (const docSnap of candidatesSnapshot.docs) {
      const candidate = docSnap.data();
      if (candidate.name === 'João Silva' || candidate.whatsapp === '5511984316526') {
        await deleteDoc(doc(db, 'candidates', docSnap.id));
        deletedCandidates++;
      }
    }
  } catch (error) {
    console.error('❌ Erro na limpeza:', error);
  }
}