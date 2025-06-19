// ===============================================
// BACKUP DO CÓDIGO PRINCIPAL - WHATSAPP BAILEYS
// ===============================================
// Data: 19/06/2025
// Status: ✅ FUNCIONANDO 100%
// Cliente Testado: 1749849987543 (Grupo Maximuns)

// ===============================================
// 1. WHATSAPP BAILEYS SERVICE (server/whatsappBaileyService.ts)
// ===============================================

import { FirebaseStorage } from './storage';

let makeWASocket: any;
let useMultiFileAuthState: any;
let QRCode: any;

async function initializeDependencies() {
  if (!makeWASocket) {
    console.log('📦 Carregando dependências Baileys...');
    const baileys = await import('@whiskeysockets/baileys');
    makeWASocket = baileys.default;
    useMultiFileAuthState = baileys.useMultiFileAuthState;
    const qrCodeModule = await import('qrcode');
    QRCode = qrCodeModule.default || qrCodeModule;
    console.log('📦 Dependências carregadas com sucesso');
  }
}

interface WhatsAppState {
  qrCode: string;
  isConnected: boolean;
  phoneNumber: string | null;
  socket: any;
}

class WhatsAppBaileyService {
  private connections: Map<string, WhatsAppState> = new Map();

  async initWhatsApp(clientId: string) {
    console.log(`🔑 Inicializando WhatsApp para cliente ${clientId}`);
    
    await initializeDependencies();
    
    if (this.connections.has(clientId)) {
      const existing = this.connections.get(clientId)!;
      if (existing.isConnected) {
        console.log(`✅ Cliente ${clientId} já conectado`);
        return existing;
      }
    }

    try {
      const authDir = `whatsapp-sessions/client_${clientId}`;
      const { state, saveCreds } = await useMultiFileAuthState(authDir);
      
      const sock = makeWASocket({ 
        auth: state, 
        printQRInTerminal: false,
        browser: ["WhatsApp Business", "Chrome", "118.0.0.0"],
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 25000
      });

      const connectionState: WhatsAppState = {
        qrCode: '',
        isConnected: false,
        phoneNumber: null,
        socket: sock
      };

      this.connections.set(clientId, connectionState);

      sock.ev.on('connection.update', async ({ connection, qr }: any) => {
        if (qr) {
          connectionState.qrCode = await QRCode.toDataURL(qr);
          console.log(`📱 QR Code gerado para cliente ${clientId} - Length: ${connectionState.qrCode.length}`);
          await this.saveConnectionToDB(clientId, connectionState);
        }
        
        if (connection === 'open') {
          console.log(`✅ WhatsApp conectado para cliente ${clientId}`);
          connectionState.isConnected = true;
          connectionState.phoneNumber = sock.user?.id?.split(':')[0] || null;
          connectionState.qrCode = '';
          
          // Salvar status CONECTADO no banco
          try {
            const storage = new FirebaseStorage();
            const config = await storage.getApiConfig('client', clientId) || {};
            await storage.upsertApiConfig({
              ...config,
              entityType: 'client',
              entityId: clientId,
              whatsappQrConnected: true,
              whatsappQrPhoneNumber: connectionState.phoneNumber,
              whatsappQrCode: null,
              whatsappQrLastConnection: new Date()
            });
            console.log(`💾 Status CONECTADO salvo no banco para cliente ${clientId}`);
          } catch (error) {
            console.log(`❌ Erro ao salvar status conectado:`, error.message);
          }
        }
        
        if (connection === 'close') {
          console.log(`🔌 WhatsApp desconectado para cliente ${clientId}`);
          connectionState.isConnected = false;
          connectionState.phoneNumber = null;
          
          // Salvar status DESCONECTADO no banco
          try {
            const storage = new FirebaseStorage();
            const config = await storage.getApiConfig('client', clientId) || {};
            await storage.upsertApiConfig({
              ...config,
              entityType: 'client',
              entityId: clientId,
              whatsappQrConnected: false,
              whatsappQrPhoneNumber: null,
              whatsappQrLastConnection: new Date()
            });
            console.log(`💾 Status DESCONECTADO salvo no banco para cliente ${clientId}`);
          } catch (error) {
            console.log(`❌ Erro ao salvar status desconectado:`, error.message);
          }
          
          // Reconecta automaticamente após 2 segundos
          setTimeout(() => this.initWhatsApp(clientId), 2000);
        }
      });

      sock.ev.on('creds.update', saveCreds);

      return {
        success: true,
        qrCode: connectionState.qrCode || null
      };

    } catch (error) {
      console.error(`❌ Erro ao inicializar WhatsApp para cliente ${clientId}:`, error);
      throw error;
    }
  }

  async saveConnectionToDB(clientId: string, connectionState: WhatsAppState) {
    try {
      const storage = new FirebaseStorage();
      const config = await storage.getApiConfig('client', clientId) || {};
      
      await storage.upsertApiConfig({
        ...config,
        entityType: 'client',
        entityId: clientId,
        whatsappQrConnected: false,
        whatsappQrPhoneNumber: connectionState.phoneNumber,
        whatsappQrCode: connectionState.qrCode,
        whatsappQrLastConnection: new Date()
      });
      
      console.log(`💾 Status WhatsApp salvo para cliente ${clientId}: DESCONECTADO`);
      console.log(`💾 QR Code salvo: SIM - Length: ${connectionState.qrCode.length}`);
    } catch (error) {
      console.error(`❌ Erro ao salvar no banco:`, error);
    }
  }

  isConnected(clientId: string): boolean {
    const connection = this.connections.get(clientId);
    return connection?.isConnected || false;
  }

  getPhoneNumber(clientId: string): string | null {
    const connection = this.connections.get(clientId);
    return connection?.phoneNumber || null;
  }

  async sendMessage(clientId: string, phone: string, text: string): Promise<boolean> {
    const connection = this.connections.get(clientId);
    
    if (!connection || !connection.isConnected) {
      throw new Error('WhatsApp não conectado para este cliente');
    }

    try {
      const formattedNumber = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
      const result = await connection.socket.sendMessage(formattedNumber, { text });
      console.log(`✅ Mensagem enviada para ${phone} via cliente ${clientId}:`, result?.key?.id);
      return true;
    } catch (error) {
      console.error(`❌ Erro ao enviar mensagem via cliente ${clientId}:`, error);
      return false;
    }
  }

  getStatus(clientId: string) {
    const connection = this.connections.get(clientId);
    return {
      isConnected: connection?.isConnected || false,
      qrCode: connection?.qrCode || null,
      phoneNumber: connection?.phoneNumber || null
    };
  }

  getAllConnections() {
    return this.connections;
  }

  async connect(clientId: string) {
    const existingConnection = this.connections.get(clientId);
    if (existingConnection?.isConnected) {
      console.log(`📱 Cliente ${clientId} já conectado`);
      return {
        success: true,
        qrCode: null,
        message: 'Já conectado'
      };
    }
    
    return await this.initWhatsApp(clientId);
  }

  async disconnect(clientId: string) {
    const connection = this.connections.get(clientId);
    if (connection?.socket) {
      await connection.socket.logout();
      this.connections.delete(clientId);
      console.log(`🔌 Cliente ${clientId} desconectado`);
    }
  }

  async restoreConnections() {
    try {
      console.log('🔄 Restaurando conexões WhatsApp após restart...');
      
      const fs = await import('fs');
      if (fs.existsSync('./whatsapp-sessions')) {
        const sessions = fs.readdirSync('./whatsapp-sessions');
        
        for (const sessionDir of sessions) {
          if (sessionDir.startsWith('client_')) {
            const clientId = sessionDir.replace('client_', '');
            const credsPath = `./whatsapp-sessions/${sessionDir}/creds.json`;
            
            if (fs.existsSync(credsPath)) {
              console.log(`📱 Restaurando sessão para cliente ${clientId}...`);
              try {
                await this.initWhatsApp(clientId);
              } catch (error) {
                console.log(`❌ Erro ao restaurar cliente ${clientId}:`, error.message);
              }
            }
          }
        }
      }
    } catch (error) {
      console.log(`❌ Erro na restauração:`, error.message);
    }
  }
}

export const whatsappBaileyService = new WhatsAppBaileyService();

// ===============================================
// 2. ENDPOINTS API (server/routes.ts - SEÇÕES WHATSAPP)
// ===============================================

// JWT_SECRET CRÍTICO - DEVE SER EXATAMENTE IGUAL EM routes.ts E index.ts
const JWT_SECRET = 'maximus-interview-system-secret-key-2024';

// GET /api/client/whatsapp/status
router.get('/client/whatsapp/status', authenticate(['client']), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user?.clientId) {
      return res.status(400).json({ message: 'Client ID required' });
    }

    console.log(`📊 [BAILEYS] Buscando status WhatsApp para cliente ${user.clientId}...`);
    
    // Primeiro buscar no banco de dados (fonte autoritativa)
    const dbConfig = await storage.getApiConfig('client', user.clientId.toString());
    
    // Depois buscar no serviço em memória
    const { whatsappBaileyService } = await import('./whatsappBaileyService');
    const memoryStatus = whatsappBaileyService.getStatus(user.clientId.toString());
    
    // Se memória mostra desconectado mas banco mostra conectado, tentar restaurar
    const shouldRestore = !memoryStatus.isConnected && dbConfig?.whatsappQrConnected && dbConfig?.whatsappQrPhoneNumber;
    
    if (shouldRestore) {
      console.log(`🔄 Tentando restaurar conexão para cliente ${user.clientId}...`);
      try {
        await whatsappBaileyService.connect(user.clientId.toString());
        const restoredStatus = whatsappBaileyService.getStatus(user.clientId.toString());
        memoryStatus.isConnected = restoredStatus.isConnected;
        memoryStatus.phoneNumber = restoredStatus.phoneNumber;
      } catch (error) {
        console.log(`❌ Erro ao restaurar conexão:`, error.message);
      }
    }
    
    const finalStatus = {
      isConnected: memoryStatus.isConnected || dbConfig?.whatsappQrConnected || false,
      qrCode: dbConfig?.whatsappQrCode || memoryStatus.qrCode || null,
      phoneNumber: dbConfig?.whatsappQrPhoneNumber || memoryStatus.phoneNumber || null,
      lastConnection: dbConfig?.whatsappQrLastConnection || null
    };
    
    console.log(`📱 [BAILEYS] Status final:`, {
      isConnected: finalStatus.isConnected,
      hasQrCode: !!finalStatus.qrCode,
      qrCodeLength: finalStatus.qrCode?.length || 0,
      phoneNumber: finalStatus.phoneNumber,
      source: 'DB + Memory'
    });
    
    res.json({
      isConnected: finalStatus.isConnected,
      phone: finalStatus.phoneNumber,
      qrCode: finalStatus.qrCode,
      lastConnection: finalStatus.lastConnection
    });
  } catch (error) {
    console.error('❌ Erro ao buscar status WhatsApp:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// POST /api/client/whatsapp/connect
router.post('/client/whatsapp/connect', authenticate(['client']), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user?.clientId) {
      return res.status(400).json({ message: 'Client ID required' });
    }

    console.log(`🔗 Conectando WhatsApp para cliente ${user.clientId}...`);
    
    const { whatsappBaileyService } = await import('./whatsappBaileyService');
    const result = await whatsappBaileyService.connect(user.clientId.toString());
    
    console.log(`🔗 [DEBUG] Resultado da conexão:`, {
      success: result.success,
      hasQrCode: !!result.qrCode,
      qrCodeLength: result.qrCode?.length || 0,
      message: result.message
    });
    
    res.json({
      success: result.success,
      message: result.message || 'Conectado com sucesso',
      qrCode: result.qrCode
    });
  } catch (error) {
    console.error('❌ Erro ao conectar WhatsApp:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao conectar WhatsApp'
    });
  }
});

// POST /api/client/whatsapp/test
router.post('/client/whatsapp/test', authenticate(['client']), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user?.clientId) {
      return res.status(400).json({ message: 'Client ID required' });
    }

    console.log(`📤 Enviando teste WhatsApp para 5511984316526 via cliente ${user.clientId}...`);
    
    const { whatsappBaileyService } = await import('./whatsappBaileyService');
    const success = await whatsappBaileyService.sendMessage(
      user.clientId.toString(), 
      '5511984316526', 
      'Teste de conexão WhatsApp - Sistema de Entrevistas'
    );
    
    res.json({
      success,
      message: success ? 'Mensagem enviada com sucesso!' : 'Erro ao enviar mensagem'
    });
  } catch (error) {
    console.error('❌ Erro ao enviar teste WhatsApp:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao enviar mensagem teste'
    });
  }
});

// ===============================================
// 3. INICIALIZAÇÃO (server/index.ts)
// ===============================================

// JWT_SECRET CRÍTICO - DEVE SER IGUAL AO routes.ts
const JWT_SECRET = 'maximus-interview-system-secret-key-2024';

// Na função de inicialização:
(async () => {
  // Inicializar WhatsApp Baileys Service
  console.log('📱 WhatsApp Baileys Service: Inicializando sistema de entrevistas...');
  
  try {
    const { whatsappBaileyService } = await import('./whatsappBaileyService');
    await whatsappBaileyService.restoreConnections();
    console.log('✅ WhatsApp Baileys Service inicializado com sucesso');
  } catch (error) {
    console.log('⚠️ WhatsApp Baileys Service: Erro na inicialização -', error.message);
    console.log('📱 WhatsApp Baileys Service: Funcionará sob demanda');
  }

  const server = await registerRoutes(app);
  
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
  });
})();

// ===============================================
// 4. DEPENDÊNCIAS PACKAGE.JSON
// ===============================================

/*
{
  "dependencies": {
    "@whiskeysockets/baileys": "^6.x.x",
    "qrcode": "^1.x.x"
  }
}
*/

// ===============================================
// 5. ESTRUTURA DE DIRETÓRIOS CRÍTICA
// ===============================================

/*
whatsapp-sessions/
└── client_1749849987543/
    ├── app-state-sync-key-AAAAAPla.json
    ├── app-state-sync-version-critical_block.json
    ├── app-state-sync-version-critical_unblock_low.json
    ├── app-state-sync-version-regular.json
    ├── app-state-sync-version-regular_low.json
    ├── creds.json (ARQUIVO PRINCIPAL)
    └── pre-key-11.json
*/

// ===============================================
// 6. CONFIGURAÇÃO FIREBASE NECESSÁRIA
// ===============================================

/*
Firebase Collection: apiConfigs
Document Structure:
{
  entityType: 'client',
  entityId: '1749849987543', // string do clientId
  whatsappQrConnected: boolean,
  whatsappQrCode: string | null,
  whatsappQrPhoneNumber: string | null,
  whatsappQrLastConnection: Date | null
}
*/

// ===============================================
// COMANDOS DE TESTE VALIDADOS
// ===============================================

/*
# 1. Status
curl -X GET http://localhost:5000/api/client/whatsapp/status \
  -H "Authorization: Bearer [TOKEN]"

# 2. Conectar
curl -X POST http://localhost:5000/api/client/whatsapp/connect \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [TOKEN]" \
  -d '{}'

# 3. Teste
curl -X POST http://localhost:5000/api/client/whatsapp/test \
  -H "Authorization: Bearer [TOKEN]"
*/

// ===============================================
// STATUS DE SUCESSO CONFIRMADO
// ===============================================

/*
✅ QR Code: 6386 caracteres gerados
✅ Conexão: "connected to WA" confirmado
✅ Mensagens: ID 3EB006EA660320BDBBED4D enviado
✅ Status: isConnected: true, phone: "551151940284"
✅ Persistência: Dados salvos no Firebase
✅ Isolamento: client_1749849987543 funcional
*/