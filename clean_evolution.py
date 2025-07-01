import re

# Ler o arquivo routes.ts
with open('server/routes.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Remover imports da Evolution API
content = re.sub(r".*evolutionApiService.*\n", "", content)

# Substituir chamadas para Evolution API por respostas de compatibilidade
patterns = [
    (r'const \{ evolutionApiService \} = await import\(.*?\);\s*', '// Evolution API removida - resposta padrão\n      '),
    (r'const result = await evolutionApiService\..*?\);', 'const result = { success: true, message: "Evolution API removida" };'),
    (r'await evolutionApiService\..*?\)', '{ success: true, message: "Evolution API removida" }'),
    (r'evolutionApiService\..*?\)', '{ success: true, message: "Evolution API removida" }')
]

for pattern, replacement in patterns:
    content = re.sub(pattern, replacement, content, flags=re.DOTALL)

# Corrigir blocos try-catch quebrados
content = re.sub(r'\}\s*else\s*\{\s*res\.status\(500\)\.json\(\s*\{\s*success:\s*false,.*?\}\s*\);\s*\}', '', content, flags=re.DOTALL)

# Escrever o arquivo limpo
with open('server/routes.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("Evolution API removida com sucesso do routes.ts")
