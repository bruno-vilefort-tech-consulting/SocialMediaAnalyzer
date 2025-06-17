import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Inicializar Firebase Admin
const serviceAccount = {
  type: process.env.FIREBASE_TYPE || "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID || "ai-interviews-system",
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI || "https://accounts.google.com/o/oauth2/auth",
  token_uri: process.env.FIREBASE_TOKEN_URI || "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL || "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function backupCollection(collectionName) {
  console.log(`🔄 Fazendo backup da coleção: ${collectionName}`);
  
  try {
    const snapshot = await db.collection(collectionName).get();
    const data = [];
    
    snapshot.forEach(doc => {
      const docData = doc.data();
      
      // Converter timestamps do Firestore para formato legível
      Object.keys(docData).forEach(key => {
        if (docData[key] && typeof docData[key] === 'object' && docData[key]._seconds) {
          docData[key] = {
            _timestamp: true,
            seconds: docData[key]._seconds,
            nanoseconds: docData[key]._nanoseconds,
            date: new Date(docData[key]._seconds * 1000).toISOString()
          };
        }
      });
      
      data.push({
        id: doc.id,
        ...docData
      });
    });
    
    console.log(`✅ ${collectionName}: ${data.length} documentos coletados`);
    return data;
  } catch (error) {
    console.error(`❌ Erro ao fazer backup da coleção ${collectionName}:`, error);
    return [];
  }
}

async function backupAllData() {
  console.log('🚀 Iniciando backup completo do Firebase...');
  console.log('📅 Data:', new Date().toISOString());
  
  const collections = [
    'users',
    'clients', 
    'jobs',
    'candidates',
    'candidateLists',
    'candidateListMemberships',
    'selections',
    'interviews',
    'responses',
    'apiConfigs',
    'masterSettings',
    'messageLogs'
  ];
  
  const backupData = {
    metadata: {
      backupDate: new Date().toISOString(),
      version: '1.0',
      description: 'Backup completo do Firebase - Sistema de Entrevistas IA'
    },
    collections: {}
  };
  
  // Fazer backup de cada coleção
  for (const collectionName of collections) {
    backupData.collections[collectionName] = await backupCollection(collectionName);
  }
  
  // Salvar backup em arquivo JSON
  const backupFileName = `BACKUP_FIREBASE_${new Date().toISOString().split('T')[0]}.json`;
  const backupPath = path.join(__dirname, backupFileName);
  
  try {
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
    
    console.log('');
    console.log('🎉 BACKUP COMPLETO FINALIZADO!');
    console.log(`📁 Arquivo: ${backupFileName}`);
    console.log('');
    
    // Estatísticas do backup
    Object.keys(backupData.collections).forEach(collection => {
      const count = backupData.collections[collection].length;
      console.log(`📊 ${collection}: ${count} documentos`);
    });
    
    console.log('');
    console.log('💾 Backup salvo com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao salvar arquivo de backup:', error);
  }
}

// Executar backup
backupAllData()
  .then(() => {
    console.log('✅ Processo de backup concluído');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Erro durante o backup:', error);
    process.exit(1);
  });