// Firebase é o único banco de dados usado no sistema
// Este arquivo mantém compatibilidade com imports existentes mas não usa PostgreSQL

import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAFvUSbvTuXuo6KVt4ApG2OSOvXs7AkRx4",
  authDomain: "entrevistaia-cf7b4.firebaseapp.com",
  projectId: "entrevistaia-cf7b4",
  storageBucket: "entrevistaia-cf7b4.firebasestorage.app",
  messagingSenderId: "746157638477",
  appId: "1:746157638477:web:0d55b46c3fbf9a72e8ed04"
};

// Evita aplicação duplicada
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const firebaseDb = getFirestore(app);

// Compatibilidade com imports existentes - mas sistema usa apenas Firebase
export const db = null;
export const pool = null;