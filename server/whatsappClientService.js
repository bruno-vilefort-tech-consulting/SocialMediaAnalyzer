const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');

class WhatsAppClientService {
  constructor() {
    this.connections = new Map(); // clientId -> connection data
    this.ensureSessionsDir();
  }

  ensureSessionsDir() {
    const sessionsDir = path.join(process.cwd(), 'whatsapp-sessions');
    if (!fs.existsSync(sessionsDir)) {
      fs.mkdirSync(sessionsDir, { recursive: true });
    }
  }

  getSessionPath(clientId) {
    return path.join(process.cwd(), 'whatsapp-sessions', `client_${clientId}`);
  }

  async initWhatsAppForClient(clientId) {
    try {
      console.log(`🔑 Inicializando WhatsApp para cliente ${clientId}`);
      
      const sessionPath = this.getSessionPath(clientId);
      
      // Ensure session directory exists
      if (!fs.existsSync(sessionPath)) {
        fs.mkdirSync(sessionPath, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
      
      const sock = makeWASocket({ 
        auth: state, 
        printQRInTerminal: false,
        browser: ['WhatsApp Business', 'Chrome', '118.0.0.0'],
        connectTimeoutMs: 90000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 25000,
        emitOwnEvents: false,
        markOnlineOnConnect: false,
        shouldSyncHistoryMessage: false,
        shouldIgnoreJid: () => true,
        generateHighQualityLinkPreview: false,
        linkPreviewImageThumbnailWidth: 0,
        transactionOpts: { maxCommitRetries: 1, delayBetweenTriesMs: 1000 },
        getMessage: async () => ({ conversation: 'Hello' })
      });

      const connectionData = {
        sock,
        qrCode: '',
        isConnected: false,
        phoneNumber: null,
        lastConnection: null
      };

      this.connections.set(clientId, connectionData);

      sock.ev.on('connection.update', async ({ connection, qr }) => {
        if (qr) {
          console.log(`📱 QR Code gerado para cliente ${clientId}`);
          connectionData.qrCode = await qrcode.toDataURL(qr);
          console.log(`✅ QR Code convertido (${connectionData.qrCode.length} chars)`);
        }
        
        if (connection === 'open') {
          console.log(`✅ WhatsApp conectado para cliente ${clientId}`);
          console.log(`📱 Telefone: ${sock?.user?.id?.split(':')[0]}`);
          connectionData.isConnected = true;
          connectionData.phoneNumber = sock?.user?.id?.split(':')[0] || null;
          connectionData.lastConnection = new Date();
          connectionData.qrCode = ''; // Clear QR code after connection
        }
        
        if (connection === 'close') {
          console.log(`❌ WhatsApp desconectado para cliente ${clientId}`);
          connectionData.isConnected = false;
          connectionData.phoneNumber = null;
          
          // Reconnect after 3 seconds
          setTimeout(() => {
            this.initWhatsAppForClient(clientId);
          }, 3000);
        }
      });

      sock.ev.on('creds.update', saveCreds);

      // Keep-alive every 25 seconds
      const keepAliveInterval = setInterval(() => {
        if (connectionData.isConnected && sock) {
          sock.sendPresenceUpdate?.('available');
        } else {
          clearInterval(keepAliveInterval);
        }
      }, 25000);

      return connectionData;

    } catch (error) {
      console.error(`❌ Erro ao inicializar WhatsApp para cliente ${clientId}:`, error);
      throw error;
    }
  }

  async getStatus(clientId) {
    const connection = this.connections.get(clientId);
    
    if (!connection) {
      // Initialize if not exists
      await this.initWhatsAppForClient(clientId);
      return this.connections.get(clientId) || {
        isConnected: false,
        qrCode: null,
        phoneNumber: null,
        lastConnection: null
      };
    }

    return {
      isConnected: connection.isConnected,
      qrCode: connection.qrCode,
      phoneNumber: connection.phoneNumber,
      lastConnection: connection.lastConnection
    };
  }

  async connect(clientId) {
    try {
      const status = await this.getStatus(clientId);
      
      if (status.isConnected) {
        return {
          success: true,
          message: 'WhatsApp já está conectado',
          qrCode: null
        };
      }

      // If not connected and no QR code, initialize
      if (!status.qrCode) {
        await this.initWhatsAppForClient(clientId);
        const newStatus = await this.getStatus(clientId);
        return {
          success: false,
          message: 'QR Code gerado, escaneie para conectar',
          qrCode: newStatus.qrCode
        };
      }

      return {
        success: false,
        message: 'Escaneie o QR Code para conectar',
        qrCode: status.qrCode
      };

    } catch (error) {
      console.error(`❌ Erro ao conectar WhatsApp para cliente ${clientId}:`, error);
      return {
        success: false,
        message: 'Erro ao inicializar conexão WhatsApp'
      };
    }
  }

  async sendMessage(clientId, phoneNumber, message) {
    try {
      const connection = this.connections.get(clientId);
      
      if (!connection || !connection.isConnected || !connection.sock) {
        throw new Error('WhatsApp não está conectado para este cliente');
      }

      // Format phone number
      let formattedPhone = phoneNumber.replace(/\D/g, ''); // Remove non-digits
      
      // Add @s.whatsapp.net if not present
      if (!formattedPhone.includes('@')) {
        formattedPhone = `${formattedPhone}@s.whatsapp.net`;
      }

      console.log(`📤 Enviando mensagem para ${formattedPhone} via cliente ${clientId}`);

      const result = await connection.sock.sendMessage(formattedPhone, { text: message });
      
      console.log(`✅ Mensagem enviada com sucesso:`, result.key);
      
      return {
        success: true,
        messageId: result.key.id,
        timestamp: new Date()
      };

    } catch (error) {
      console.error(`❌ Erro ao enviar mensagem via cliente ${clientId}:`, error);
      throw error;
    }
  }

  async disconnect(clientId) {
    try {
      const connection = this.connections.get(clientId);
      
      if (connection && connection.sock) {
        await connection.sock.logout();
        connection.isConnected = false;
        connection.phoneNumber = null;
        connection.qrCode = '';
      }

      // Remove session files
      const sessionPath = this.getSessionPath(clientId);
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
      }

      this.connections.delete(clientId);

      return {
        success: true,
        message: 'WhatsApp desconectado com sucesso'
      };

    } catch (error) {
      console.error(`❌ Erro ao desconectar WhatsApp para cliente ${clientId}:`, error);
      return {
        success: false,
        message: 'Erro ao desconectar WhatsApp'
      };
    }
  }

  getAllConnections() {
    const connections = [];
    
    for (const [clientId, connection] of this.connections.entries()) {
      connections.push({
        clientId,
        isConnected: connection.isConnected,
        phoneNumber: connection.phoneNumber,
        lastConnection: connection.lastConnection
      });
    }

    return connections;
  }
}

// Singleton instance
const whatsappClientService = new WhatsAppClientService();

module.exports = { whatsappClientService };