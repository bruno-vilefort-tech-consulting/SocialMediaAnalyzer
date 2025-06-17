import bcrypt from 'bcrypt';
import { FirebaseStorage } from './server/storage.js';

async function fixDanielPassword() {
  try {
    const storage = new FirebaseStorage();
    
    console.log('🔍 Buscando usuário Daniel Braga...');
    const user = await storage.getUserByEmail('danielmoreirabraga@gmail.com');
    
    if (!user) {
      console.log('❌ Usuário não encontrado');
      return;
    }
    
    console.log('👤 Usuário encontrado:', {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    });
    
    const newPassword = 'daniel580190';
    console.log('🔐 Gerando novo hash para senha:', newPassword);
    
    const newHash = await bcrypt.hash(newPassword, 10);
    console.log('🆕 Novo hash gerado:', newHash);
    
    // Atualizar a senha no Firebase
    await storage.updateUser(user.id, { password: newHash });
    
    console.log('💾 Senha atualizada no Firebase');
    
    // Testar a nova senha
    const testUser = await storage.getUserByEmail('danielmoreirabraga@gmail.com');
    const isValid = await bcrypt.compare(newPassword, testUser.password);
    
    console.log('✅ Nova senha funciona?', isValid);
    
    if (isValid) {
      console.log('🎉 Problema de login do Daniel Braga RESOLVIDO!');
    } else {
      console.log('❌ Ainda há problemas com a senha');
    }
    
  } catch (error) {
    console.error('❌ Erro ao corrigir senha:', error);
  }
}

fixDanielPassword();