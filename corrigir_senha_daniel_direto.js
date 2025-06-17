import { FirebaseStorage } from './server/storage.js';
import bcrypt from 'bcrypt';

async function corrigirSenhaDaniel() {
  try {
    console.log('🔧 Corrigindo senha do usuário Daniel Braga via storage direto...');
    
    const storage = new FirebaseStorage();
    
    // Buscar o usuário Daniel primeiro
    const user = await storage.getUserByEmail('danielmoreirabraga@gmail.com');
    
    if (!user) {
      console.log('❌ Usuário Daniel não encontrado');
      return;
    }
    
    console.log('✅ Usuário encontrado:', user.name, user.email);
    console.log('📋 Senha atual:', user.password);
    
    // Criptografar a nova senha
    const senhaTexto = '580190';
    const saltRounds = 10;
    const senhaCriptografada = await bcrypt.hash(senhaTexto, saltRounds);
    
    console.log('🔐 Senha original:', senhaTexto);
    console.log('🔐 Hash gerado:', senhaCriptografada);
    
    // Atualizar a senha via updateDoc direto
    const { doc, updateDoc } = await import('firebase/firestore');
    const { firebaseDb } = await import('./server/db.js');
    
    await updateDoc(doc(firebaseDb, 'users', user.id), {
      password: senhaCriptografada,
      updatedAt: new Date()
    });
    
    console.log('✅ Senha do Daniel Braga atualizada com hash bcrypt');
    
    // Testar se a senha funciona
    const senhaCorreta = await bcrypt.compare(senhaTexto, senhaCriptografada);
    console.log('🧪 Teste de comparação:', senhaCorreta ? 'PASSOU' : 'FALHOU');
    
  } catch (error) {
    console.error('❌ Erro ao corrigir senha:', error);
  }
}

corrigirSenhaDaniel();