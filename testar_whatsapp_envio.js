#!/usr/bin/env node

// Script para testar envio de mensagem WhatsApp diretamente
import fetch from 'node-fetch';

async function testarEnvioWhatsApp() {
    try {
        console.log('🧪 Testando envio de mensagem WhatsApp...');
        
        // 1. Fazer login para obter token
        console.log('\n📋 1. FAZENDO LOGIN:');
        const loginResponse = await fetch('http://localhost:5000/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: 'danielmoreirabraga@gmail.com',
                password: '123456'
            })
        });
        
        if (!loginResponse.ok) {
            throw new Error(`Login falhou: ${loginResponse.status}`);
        }
        
        const loginData = await loginResponse.json();
        console.log(`   ✅ Login realizado: ${loginData.user?.email}`);
        console.log(`   🔑 Token obtido: ${loginData.token ? 'SIM' : 'NÃO'}`);
        
        if (!loginData.token) {
            throw new Error('Token não obtido no login');
        }
        
        // 2. Testar envio de mensagem WhatsApp
        console.log('\n📋 2. TESTANDO ENVIO WHATSAPP:');
        const connectionId = 'client_1749849987543_1750175926509';
        const testResponse = await fetch(`http://localhost:5000/api/whatsapp/test/${connectionId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${loginData.token}`
            },
            body: JSON.stringify({
                phoneNumber: '11984316526',
                message: 'Teste de mensagem WhatsApp do sistema corrigido'
            })
        });
        
        console.log(`   📤 Status da requisição: ${testResponse.status}`);
        
        const testResult = await testResponse.json();
        console.log(`   💬 Resultado: ${JSON.stringify(testResult, null, 2)}`);
        
        if (testResult.success) {
            console.log('\n✅ MENSAGEM ENVIADA COM SUCESSO!');
        } else {
            console.log('\n❌ FALHA NO ENVIO DA MENSAGEM');
            console.log(`   Erro: ${testResult.error || 'Erro desconhecido'}`);
        }
        
    } catch (error) {
        console.error('❌ Erro no teste:', error.message);
    }
}

// Executar teste
testarEnvioWhatsApp()
    .then(() => {
        console.log('\n🏁 Teste finalizado');
        process.exit(0);
    })
    .catch(error => {
        console.error('💥 Erro fatal:', error);
        process.exit(1);
    });