import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, deleteDoc, getDocs } from 'firebase/firestore';

// Configuração do Firebase
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function consolidarConfigs() {
  try {
    console.log('🔧 Consolidando configurações duplicadas...');
    
    // Buscar dados das coleções duplicadas
    const configSnapshot = await getDocs(collection(db, 'config'));
    const configsSnapshot = await getDocs(collection(db, 'configs'));
    
    let configData = {};
    let configsData = {};
    
    // Extrair dados da coleção "config"
    configSnapshot.forEach(doc => {
      console.log(`📄 Dados de 'config' (ID: ${doc.id}):`, doc.data());
      configData = { ...configData, ...doc.data() };
    });
    
    // Extrair dados da coleção "configs"
    configsSnapshot.forEach(doc => {
      console.log(`📄 Dados de 'configs' (ID: ${doc.id}):`, doc.data());
      configsData = { ...configsData, ...doc.data() };
    });
    
    // Consolidar todos os dados
    const dadosConsolidados = {
      id: 1,
      openaiApiKey: configsData.openaiApiKey || configData.openaiApiKey || null,
      openaiModel: configsData.openaiModel || configData.openaiModel || 'gpt-4o',
      firebaseProjectId: configsData.firebaseProjectId || configData.firebaseProjectId || null,
      firebaseServiceAccount: configsData.firebaseServiceAccount || configData.firebaseServiceAccount || null,
      whatsappQrConnected: configData.whatsappQrConnected || configsData.whatsappQrConnected || true,
      whatsappQrPhoneNumber: configData.whatsappQrPhoneNumber || configsData.whatsappQrPhoneNumber || null,
      whatsappQrLastConnection: configData.whatsappQrLastConnection || configsData.whatsappQrLastConnection || null,
      updatedAt: new Date()
    };
    
    console.log('📊 Dados consolidados:', dadosConsolidados);
    
    // Salvar na coleção correta 'apiConfigs'
    console.log('💾 Salvando dados consolidados em apiConfigs...');
    await setDoc(doc(db, 'apiConfigs', '1'), dadosConsolidados);
    console.log('✅ Configurações salvas na coleção apiConfigs');
    
    // Deletar coleções duplicadas
    console.log('🗑️ Removendo coleções duplicadas...');
    
    // Deletar documentos de 'config'
    for (const documento of configSnapshot.docs) {
      await deleteDoc(doc(db, 'config', documento.id));
      console.log(`✅ Deletado: config/${documento.id}`);
    }
    
    // Deletar documentos de 'configs'
    for (const documento of configsSnapshot.docs) {
      await deleteDoc(doc(db, 'configs', documento.id));
      console.log(`✅ Deletado: configs/${documento.id}`);
    }
    
    console.log('🎉 Consolidação concluída! Agora existe apenas a coleção apiConfigs.');
    
    // Verificar resultado final
    const apiConfigsSnapshot = await getDocs(collection(db, 'apiConfigs'));
    console.log(`📊 Resultado: apiConfigs contém ${apiConfigsSnapshot.size} documento(s)`);
    
  } catch (error) {
    console.error('❌ Erro ao consolidar configurações:', error);
  }
}

consolidarConfigs();