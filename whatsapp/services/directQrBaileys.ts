/**
 * Serviço simplificado para gerar QR Code real do Baileys
 * Foca exclusivamente na geração de QR Code funcional
 */
import P from 'pino';

export class DirectQrBaileys {
  private activeConnections: Map<string, any> = new Map();

  async generateQrCode(clientId: string, slotNumber: number): Promise<{ success: boolean; qrCode?: string; message: string }> {
    const connectionId = `${clientId}_slot_${slotNumber}`;
    
    console.log(`🎯 [DIRECT-QR] Gerando QR Code para ${connectionId}`);

    try {
      // Importar dependências dinamicamente
      const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = await import('@whiskeysockets/baileys');
      const path = await import('path');
      const fs = await import('fs');

      // Criar caminho único para sessão
      const sessionPath = path.join(process.cwd(), 'whatsapp-sessions', `direct_${connectionId}`);

      // Sempre limpar sessão para forçar novo QR
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
      }
      fs.mkdirSync(sessionPath, { recursive: true });

      console.log(`📁 [DIRECT-QR] Sessão limpa criada: ${sessionPath}`);

      // Carregar estado de autenticação limpo
      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

      console.log(`🚀 [DIRECT-QR] Criando socket Baileys minimalista...`);

      // Configuração minimalista do socket
      const socket = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        // Removido mobile: true (deprecated - causa erro "Mobile API is not supported anymore")
        browser: ['Ubuntu', 'Chrome', '20.0.04'],
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
        qrTimeout: 90000,
        retryRequestDelayMs: 2000,
        maxMsgRetryCount: 3,
        markOnlineOnConnect: false,
        fireInitQueries: true,
        syncFullHistory: false,
        generateHighQualityLinkPreview: false,
        emitOwnEvents: false,
        shouldSyncHistoryMessage: () => false,
        logger: P({ level: 'silent' })
      });

      // Promise para aguardar apenas QR Code
      return new Promise<{ success: boolean; qrCode?: string; message: string }>((resolve) => {
        let resolved = false;
        
        // Listener para QR Code
        socket.ev.on('connection.update', async (update) => {
          console.log(`📡 [DIRECT-QR] Update:`, { 
            connection: update.connection, 
            hasQR: !!update.qr,
            qrLength: update.qr?.length 
          });

          const { qr, connection } = update;

          // Se recebeu QR Code
          if (qr && !resolved) {
            try {
              const QRCode = await import('qrcode');
              const qrCodeData = await QRCode.toDataURL(qr, {
                width: 256,
                margin: 2,
                color: {
                  dark: '#000000',
                  light: '#FFFFFF'
                }
              });

              console.log(`✅ [DIRECT-QR] QR Code gerado com sucesso (${qrCodeData.length} chars)`);
              
              resolved = true;
              resolve({
                success: true,
                qrCode: qrCodeData,
                message: 'QR Code gerado com sucesso'
              });

            } catch (error) {
              console.error(`❌ [DIRECT-QR] Erro ao converter QR:`, error);
              resolved = true;
              resolve({
                success: false,
                message: 'Erro ao converter QR Code'
              });
            }
          }

          // Se conectou (não deveria acontecer com sessão limpa)
          if (connection === 'open' && !resolved) {
            console.log(`🔗 [DIRECT-QR] Conectado sem QR Code`);
            resolved = true;
            resolve({
              success: false,
              message: 'Conectado sem gerar QR Code'
            });
          }
        });

        // Salvar credenciais quando atualizadas
        socket.ev.on('creds.update', saveCreds);

        // Timeout de 30 segundos
        setTimeout(() => {
          if (!resolved) {
            console.log(`⏰ [DIRECT-QR] Timeout - QR Code não gerado`);
            resolved = true;
            resolve({
              success: false,
              message: 'Timeout: QR Code não gerado em 30 segundos'
            });
          }
        }, 30000);

        console.log(`⏳ [DIRECT-QR] Aguardando QR Code...`);
      });

    } catch (error) {
      console.error(`💥 [DIRECT-QR] Erro fatal:`, error);
      return {
        success: false,
        message: `Erro: ${error}`
      };
    }
  }

  async cleanSession(clientId: string, slotNumber: number): Promise<void> {
    const connectionId = `${clientId}_slot_${slotNumber}`;
    
    try {
      const path = await import('path');
      const fs = await import('fs');

      const sessionPath = path.join(process.cwd(), 'whatsapp-sessions', `direct_${connectionId}`);
      
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
        console.log(`🧹 [DIRECT-QR] Sessão ${connectionId} limpa`);
      }
    } catch (error) {
      console.error(`❌ [DIRECT-QR] Erro ao limpar sessão:`, error);
    }
  }
}

export const directQrBaileys = new DirectQrBaileys();