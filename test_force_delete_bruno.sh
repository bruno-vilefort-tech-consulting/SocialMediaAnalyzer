#!/bin/bash

echo "🗑️ [TESTE] ===== TESTANDO DELEÇÃO FORÇADA DO BRUNO VILEFORT ====="
echo ""

# Token do usuário bruno.claro@yahoo.com (obtido dos logs)
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjE3NTEzODUwNzUxNTkiLCJlbWFpbCI6ImJydW5vLmNsYXJvQHlhaG9vLmNvbSIsInJvbGUiOiJjbGllbnQiLCJjbGllbnRJZCI6MTc0OTg0OTk4NzU0MywiaWF0IjoxNzUyODE4MTE0fQ.pJ_oeHYWW2GDq8OQR6eXcxM3KlI1WKUCh6qI1FG1Gqs"

echo "🔑 Usando token de autenticação..."
echo "📋 Executando deleção forçada..."

curl -X DELETE "http://localhost:5000/api/force-delete/bruno-vilefort" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -v

echo ""
echo "🎉 [FINALIZADO] Teste de deleção forçada concluído!"