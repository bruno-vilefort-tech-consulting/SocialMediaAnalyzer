// Firebase é o único banco de dados usado no sistema
// Este arquivo mantém compatibilidade com imports existentes mas não usa PostgreSQL

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const firebaseDb = getFirestore(app);

// Compatibilidade com imports existentes - mas sistema usa apenas Firebase
export const db = null;
export const pool = null;