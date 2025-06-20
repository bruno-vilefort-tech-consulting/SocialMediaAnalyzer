const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');

class WhatsAppBaileyService {
  constructor() {
    this.currentQR = '';
    this.sock = null;
    this.isInitialized = false;
  }

  async initWhatsApp() {
    try {
      console.log('🔄 Inicializando WhatsApp Baileys...');
      
      const { state, saveCreds } = await useMultiFileAuthState('auth_info');
      
      this.sock = makeWASocket({ 
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

      this.sock.ev.on('connection.update', async ({ connection, qr }) => {
        if (qr) {
          console.log('📱 QR Code gerado!');
          this.currentQR = await qrcode.toDataURL(qr);
          console.log(`✅ QR Code convertido para Data URL (${this.currentQR.length} chars)`);
        }
        
        if (connection === 'open') {
          console.log('✅ WhatsApp conectado com sucesso!');
          console.log(`📱 Telefone conectado: ${this.sock?.user?.id?.split(':')[0]}`);
          this.currentQR = ''; // Limpar QR Code após conexão
        }
        
        if (connection === 'close') {
          console.log('❌ WhatsApp desconectado, tentando reconectar...');
          setTimeout(() => this.initWhatsApp(), 2000); // reconecta
        }
      });

      this.sock.ev.on('creds.update', saveCreds);

      // Keep-alive a cada 25 segundos
      setInterval(() => {
        if (this.sock?.user) {
          this.sock.sendPresenceUpdate?.('available');
        }
      }, 25000);

      this.isInitialized = true;
      console.log('✅ WhatsApp Baileys inicializado com sucesso');
    } catch (error) {
      console.error('❌ Erro ao inicializar WhatsApp:', error);
      this.isInitialized = false;
    }
  }

  getQR() {
    return this.currentQR;
  }

  isConnected() {
    return this.sock && this.sock.user && this.sock.readyState === 'open';
  }

  async sendMessage(phone, text) {
    if (!this.isConnected()) {
      throw new Error('WhatsApp não conectado');
    }
    
    try {
      const phoneNumber = phone.replace(/\D/g, ''); // Remove caracteres não numéricos
      const jid = `${phoneNumber}@s.whatsapp.net`;
      
      console.log(`📤 Enviando mensagem para ${phoneNumber}...`);
      const result = await this.sock.sendMessage(jid, { text });
      console.log('✅ Mensagem enviada com sucesso!');
      
      return result;
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem:', error);
      throw error;
    }
  }

  getStatus() {
    const isConnected = this.sock && this.sock.user && this.sock.readyState === 'open';
    return {
      isConnected: !!isConnected,
      qrCode: this.currentQR,
      phoneNumber: this.sock?.user?.id?.split(':')[0] || null
    };
  }
}

// Instância única
const whatsappBaileyService = new WhatsAppBaileyService();

module.exports = { whatsappBaileyService };