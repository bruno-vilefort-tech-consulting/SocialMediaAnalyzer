#!/bin/bash

# 🧪 TESTE MANUAL DA CADÊNCIA - Simular resposta "1"
echo "🧪 Testando cadência manual..."

# Obter token JWT (assumindo que está logado como cliente)
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjE3NTEzODUwNzUxNTkiLCJlbWFpbCI6ImJydW5vLmNsYXJvQHlhaG9vLmNvbSIsInJvbGUiOiJjbGllbnQiLCJjbGllbnRJZCI6MTc0OTg0OTk4NzU0MywiaWF0IjoxNzUzMDUyOTU5fQ.k_BqR2YDdqnuKPYR2wq2Yiue6vVVMAdY8F8D2I7TGJg"

echo "🚀 Testando cadência imediata..."
curl -X POST http://localhost:5000/api/user-round-robin/activate-immediate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"candidatePhone": "553182230538"}' \
  -w "\n"

echo -e "\n📊 Verificando estatísticas..."
curl -X GET http://localhost:5000/api/user-round-robin/stats \
  -H "Authorization: Bearer $TOKEN" \
  -w "\n"

echo -e "\n✅ Teste concluído - verificar logs do servidor"