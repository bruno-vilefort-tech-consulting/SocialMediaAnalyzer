// Sistema híbrido: Firebase para dados principais + PostgreSQL para autenticação
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "../shared/schema";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Firebase config (dados principais do sistema)
const firebaseConfig = {
  apiKey: "AIzaSyAFvUSbvTuXuo6KVt4ApG2OSOvXs7AkRx4",
  authDomain: "entrevistaia-cf7b4.firebaseapp.com",
  projectId: "entrevistaia-cf7b4",
  storageBucket: "entrevistaia-cf7b4.firebasestorage.app",
  messagingSenderId: "746157638477",
  appId: "1:746157638477:web:0d55b46c3fbf9a72e8ed04"
};

// Evita aplicação duplicada do Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const firebaseDb = getFirestore(app);

// PostgreSQL config (para autenticação e sessões)
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });