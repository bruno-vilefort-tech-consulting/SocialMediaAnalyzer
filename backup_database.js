import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

// Usar a mesma configuração do sistema
const firebaseConfig = {
  apiKey: "AIzaSyDGpS1xvTc7FzXn2rO0Q9rVcXpY8KmNnE4",
  authDomain: "ai-interviews-system.firebaseapp.com",
  projectId: "ai-interviews-system",
  storageBucket: "ai-interviews-system.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abc123def456ghi789jkl"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function backupCollection(collectionName) {
  console.log(`Fazendo backup da coleção: ${collectionName}`);
  
  try {
    const querySnapshot = await getDocs(collection(db, collectionName));
    const data = [];
    
    querySnapshot.forEach((doc) => {
      const docData = doc.data();
      
      // Converter timestamps para formato legível
      Object.keys(docData).forEach(key => {
        if (docData[key] && typeof docData[key] === 'object' && docData[key].seconds) {
          docData[key] = {
            _timestamp: true,
            seconds: docData[key].seconds,
            nanoseconds: docData[key].nanoseconds,
            date: new Date(docData[key].seconds * 1000).toISOString()
          };
        }
      });
      
      data.push({
        id: doc.id,
        ...docData
      });
    });
    
    console.log(`${collectionName}: ${data.length} documentos`);
    return data;
  } catch (error) {
    console.error(`Erro na coleção ${collectionName}:`, error.message);
    return [];
  }
}

async function executeBackup() {
  console.log('Iniciando backup do Firebase...');
  console.log('Data:', new Date().toISOString());
  
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
    'masterSettings'
  ];
  
  const backupData = {
    metadata: {
      backupDate: new Date().toISOString(),
      version: '1.0',
      source: 'Firebase Firestore'
    },
    collections: {}
  };
  
  for (const collectionName of collections) {
    backupData.collections[collectionName] = await backupCollection(collectionName);
  }
  
  const backupFileName = `BACKUP_FIREBASE_${new Date().toISOString().split('T')[0]}.json`;
  
  try {
    fs.writeFileSync(backupFileName, JSON.stringify(backupData, null, 2));
    
    console.log('');
    console.log('BACKUP FINALIZADO!');
    console.log(`Arquivo: ${backupFileName}`);
    console.log('');
    
    Object.keys(backupData.collections).forEach(collection => {
      const count = backupData.collections[collection].length;
      console.log(`${collection}: ${count} documentos`);
    });
    
    // Calcular estatísticas
    const totalDocs = Object.values(backupData.collections)
      .reduce((sum, coll) => sum + coll.length, 0);
    
    console.log('');
    console.log(`Total: ${totalDocs} documentos salvos`);
    
  } catch (error) {
    console.error('Erro ao salvar backup:', error);
  }
}

executeBackup()
  .then(() => {
    console.log('Backup concluído com sucesso');
    process.exit(0);
  })
  .catch(error => {
    console.error('Erro durante backup:', error);
    process.exit(1);
  });