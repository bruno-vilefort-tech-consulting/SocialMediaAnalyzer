// Vamos usar o servidor existente que já tem Firebase configurado
const url = 'http://localhost:5000/api/search-candidate';

// Buscar candidato
fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer temp' // Usando token temporário
  },
  body: JSON.stringify({
    phone: '5511996612253'
  })
})
.then(response => response.json())
.then(data => {
  console.log('📋 Resultado da busca:', data);
})
.catch(error => {
  console.error('❌ Erro:', error);
});
