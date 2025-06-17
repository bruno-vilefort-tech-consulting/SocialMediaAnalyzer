#!/usr/bin/env node

// Script para enviar teste de entrevista diretamente via WhatsApp
import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';

async function enviarTesteDireto() {
    try {
        console.log('🚀 Iniciando envio direto de teste de entrevista...');
        
        // Usar dados de autenticação existentes
        const { state, saveCreds } = await useMultiFileAuthState('./whatsapp-auth');
        
        // Criar socket WhatsApp
        const socket = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            connectTimeoutMs: 30000,
            defaultQueryTimeoutMs: 15000,
            browser: ['Teste Entrevista', 'Chrome', '1.0.0']
        });

        // Aguardar conexão
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timeout na conexão')), 45000);
            
            socket.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;
                
                if (qr) {
                    console.log('📱 QR Code gerado - escaneie com seu WhatsApp');
                }
                
                if (connection === 'open') {
                    clearTimeout(timeout);
                    console.log('✅ WhatsApp conectado com sucesso!');
                    resolve(true);
                } else if (connection === 'close') {
                    clearTimeout(timeout);
                    const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
                    if (shouldReconnect) {
                        reject(new Error('Conexão fechada - tentando novamente'));
                    } else {
                        reject(new Error('Falha na autenticação'));
                    }
                }
            });

            socket.ev.on('creds.update', saveCreds);
        });

        // Enviar mensagem de teste
        const phoneNumber = '5511984316526@s.whatsapp.net';
        const message = `🎯 TESTE DE ENTREVISTA - SISTEMA FUNCIONANDO

Olá Daniel Moreira!

Você foi selecionado para a vaga de CONSULTOR da Grupo Maximuns.

📋 ENTREVISTA POR ÁUDIO:
• 3 perguntas enviadas por áudio
• Você responde falando no WhatsApp  
• Sem necessidade de vídeo
• Análise automática das respostas

Para iniciar a entrevista:
1️⃣ Digite "1" ou "SIM" 
2️⃣ Digite "2" ou "NÃO"

Aguardamos sua resposta!`;

        console.log('📤 Enviando mensagem para 11984316526...');
        
        await socket.sendMessage(phoneNumber, {
            text: message
        });

        console.log('✅ Mensagem enviada com sucesso!');
        console.log('🔍 Aguardando resposta do candidato...');

        // Aguardar resposta por 2 minutos
        let responseReceived = false;
        
        socket.ev.on('messages.upsert', async (m) => {
            const message = m.messages[0];
            if (message.key.fromMe) return; // Ignorar mensagens próprias
            
            const from = message.key.remoteJid;
            const text = message.message?.conversation || 
                        message.message?.extendedTextMessage?.text || '';
            
            if (from?.includes('11984316526')) {
                console.log(`📱 Resposta recebida de ${from}: ${text}`);
                responseReceived = true;
                
                if (text === '1' || text.toLowerCase().includes('sim')) {
                    console.log('🎉 Candidato aceitou a entrevista!');
                    
                    await socket.sendMessage(from, {
                        text: `Perfeito! A entrevista está iniciando.

Você receberá 3 perguntas por áudio. Para cada pergunta:
• Ouça o áudio completo
• Responda falando no WhatsApp (grave um áudio)
• Aguarde a próxima pergunta

🎤 Primeira pergunta chegando em instantes...`
                    });
                    
                    console.log('✅ Sistema de entrevista confirmado como funcional!');
                } else if (text === '2' || text.toLowerCase().includes('não')) {
                    console.log('ℹ️ Candidato recusou a entrevista');
                    await socket.sendMessage(from, {
                        text: 'Entendido. Obrigado pelo retorno!'
                    });
                }
            }
        });

        // Aguardar resposta por 2 minutos
        setTimeout(() => {
            if (!responseReceived) {
                console.log('⏰ Tempo limite atingido - encerrando teste');
            }
            socket.end();
            process.exit(0);
        }, 120000);

    } catch (error) {
        console.error('❌ Erro no teste:', error.message);
        process.exit(1);
    }
}

// Executar o teste
enviarTesteDireto();