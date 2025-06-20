# 📱 CADÊNCIA COMPLETA DE MENSAGENS WHATSAPP

## 📂 ARQUIVOS PRINCIPAIS

### **1. server/interactiveInterviewService.ts**
- **Função**: Controla todo o fluxo de entrevista via WhatsApp
- **Responsável por**: Comandos 1/2, perguntas, respostas por áudio

### **2. server/prompts.ts** 
- **Função**: Templates de mensagens para IA e entrevistas
- **Responsável por**: Textos das perguntas e prompts de análise

### **3. client/src/components/SelectionModal.tsx**
- **Função**: Template configurável do convite inicial
- **Responsável por**: Mensagem de convite personalizada por cliente

## 🔄 FLUXO COMPLETO DE MENSAGENS

### **ETAPA 1: CONVITE INICIAL** 
**Arquivo**: `SelectionModal.tsx` (linhas 275-300)
```
Template personalizável:
"Olá [nome do candidato], você foi convidado para entrevista da vaga [Nome da Vaga] na empresa [nome do cliente]...

Você gostaria de iniciar a entrevista?

Para participar, responda:
1 - Sim, começar agora
2 - Não quero participar"
```

### **ETAPA 2: RESPOSTA DO CANDIDATO**
**Arquivo**: `interactiveInterviewService.ts` (linhas 146-158)

**Comando "1"**: Inicia entrevista
```javascript
if (text === '1' && !activeInterview) {
  console.log(`🚀 [INTERVIEW] Comando "1" detectado - iniciando entrevista`);
  await this.startInterview(phone, clientId);
}
```

**Comando "2"**: Recusa entrevista
```javascript
else if (text === '2') {
  console.log(`❌ [INTERVIEW] Comando "2" detectado - recusando entrevista`);
  await this.sendMessage(from, "Entendido. Obrigado!");
}
```

**Comando inválido**: Instruções
```javascript
else {
  await this.sendMessage(from, "Digite:\n1 - Iniciar entrevista\n2 - Não participar");
}
```

### **ETAPA 3: PERGUNTAS DA ENTREVISTA**
**Arquivo**: `interactiveInterviewService.ts` (linhas 280-320)

**Mensagem de boas-vindas**:
```javascript
const welcomeMessage = `Olá ${interview.candidateName}! 👋

Bem-vindo(a) à entrevista para a vaga de ${interview.jobName}.

Você receberá ${interview.questions.length} perguntas. Para cada pergunta:
🎤 Responda somente por áudio
⏰ Sem limite de tempo
🔄 Se tiver problemas, digite "parar"

Vamos começar?`;
```

**Formato das perguntas**:
```javascript
const questionMessage = `📋 Pergunta ${interview.currentQuestion + 1}/${interview.questions.length}:

${currentQuestion.textoPergunta}

🎤 Responda somente por áudio`;
```

### **ETAPA 4: VALIDAÇÃO DE RESPOSTAS**
**Arquivo**: `interactiveInterviewService.ts` (linhas 350-380)

**Resposta apenas texto (rejeitada)**:
```javascript
if (!audioMessage && text) {
  await this.sendMessage(from, "Por gentileza, responda por áudio. 🎤");
  return;
}
```

**Resposta por áudio (aceita)**:
```javascript
if (audioMessage) {
  // Processar áudio
  const audioPath = await this.downloadAudioDirect(audioMessage, phone, interview.clientId, interview.selectionId, interview.currentQuestion + 1);
  
  // Transcrever
  const transcription = await this.transcribeAudio(audioPath, phone);
  
  // Salvar resposta
  interview.responses.push({
    questionId: currentQuestion.id,
    questionText: currentQuestion.textoPergunta,
    responseText: transcription,
    audioFile: audioPath,
    timestamp: new Date().toISOString()
  });
}
```

### **ETAPA 5: FINALIZAÇÃO**
**Arquivo**: `interactiveInterviewService.ts` (linhas 400-430)

**Mensagem de finalização**:
```javascript
const finalizationMessage = `🎉 Parabéns ${interview.candidateName}!

Você concluiu a entrevista para a vaga de ${interview.jobName}.

✅ Suas ${interview.responses.length} respostas foram gravadas com sucesso
📊 Nossa equipe analisará suas respostas
📞 Entraremos em contato em breve com o resultado

Obrigado pela sua participação! 🙏`;
```

## 🎛️ COMANDOS ESPECIAIS

### **Durante a entrevista**:
- **"parar"** ou **"sair"**: Para a entrevista
```javascript
else if (text.toLowerCase() === 'parar' || text.toLowerCase() === 'sair') {
  await this.stopInterview(phone);
}
```

### **Mensagem de parada**:
```javascript
const stopMessage = `⏹️ Entrevista interrompida.

Suas respostas já enviadas foram salvas.
Obrigado pela participação! 🙏`;
```

## 📋 PLACEHOLDERS DISPONÍVEIS

### **No template de convite**:
- `[nome do candidato]` → Nome real do candidato
- `[nome do cliente]` → Nome da empresa
- `[Nome da Vaga]` → Título da vaga
- `[número de perguntas]` → Quantidade de perguntas

## 🔧 CONFIGURAÇÕES TÉCNICAS

### **Nomenclatura de áudios**:
```javascript
// Formato: audio_[whatsapp]_[selectionId]_R[numero].ogg
const audioFileName = `audio_${cleanPhone}_${selectionId}_R${questionNumber}.ogg`;
```

### **Integração Whisper**:
```javascript
const transcription = await this.transcribeAudio(audioPath, phone);
```

### **Logs detalhados**:
```javascript
console.log(`🎯 [INTERVIEW] ===== NOVA MENSAGEM RECEBIDA =====`);
console.log(`📱 [INTERVIEW] Telefone: ${phone}`);
console.log(`💬 [INTERVIEW] Texto: "${text}"`);
console.log(`🎵 [INTERVIEW] Áudio: ${audioMessage ? 'SIM' : 'NÃO'}`);
```

## 📊 FLUXO VISUAL

```
1. CONVITE → "Olá João, convite para vaga X..."
2. RESPOSTA → "1" (aceita) ou "2" (recusa)  
3. BOAS-VINDAS → "Bem-vindo! Você receberá 3 perguntas..."
4. PERGUNTA 1 → "Pergunta 1/3: Fale sobre sua experiência..."
5. ÁUDIO → Candidato grava resposta
6. PERGUNTA 2 → "Pergunta 2/3: Como você resolve conflitos..."
7. ÁUDIO → Candidato grava resposta  
8. PERGUNTA 3 → "Pergunta 3/3: Onde se vê em 5 anos..."
9. ÁUDIO → Candidato grava resposta
10. FINALIZAÇÃO → "Parabéns! Entrevista concluída..."
```

Toda a cadência está configurada nos arquivos mencionados, com logs detalhados para monitoramento e controle completo do fluxo.