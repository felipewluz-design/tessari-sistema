# RepGo — Instruções de Deploy

## Arquivos para o repositório `felipewluz-design/tessari-sistema`

```
index.html          ← App principal PWA
admin.html          ← Painel administrativo
manifest.json       ← PWA manifest
sw.js               ← Service Worker
icon512.png         ← Ícone (já existe no repo)
vercel.json         ← Config Vercel
api/
  processar-pdf.js  ← Serverless function (Anthropic)
```

---

## 1. Subir arquivos no GitHub

**NÃO use o editor web do GitHub para `index.html` e `admin.html`** — são arquivos grandes e vão corromper.

Use o fluxo "Upload files":
1. GitHub → repositório → "Add file" → "Upload files"
2. Arraste todos os arquivos de uma vez
3. Commit direto na main

---

## 2. Variável de ambiente no Vercel

No painel Vercel → Settings → Environment Variables:

```
ANTHROPIC_API_KEY = sua_chave_aqui
```

---

## 3. SQL no Supabase

1. Acesse Supabase → SQL Editor
2. Cole o conteúdo de `supabase-migrations.sql`
3. Execute (Run)

Isso cria todas as tabelas, RLS policies, RPCs de suporte e RPCs de admin.

**Se as tabelas já existem** (dados do Elias), o script usa `IF NOT EXISTS` — seguro de rodar.

---

## 4. Testar

### App principal
- https://tessari-sistema.vercel.app
- Login com conta existente do Elias
- Verificar dashboard, clientes, pedidos

### Admin
- https://tessari-sistema.vercel.app/admin.html
- Login com conta admin

### Modo suporte
- Admin → card de um rep → botão "▶ Entrar"
- Abre `/?support_uid=<uid>` em nova aba
- Banner roxo deve aparecer no topo

---

## 5. PWA (instalar no celular)

No iOS Safari: Compartilhar → "Adicionar à Tela de Início"
No Android Chrome: "Adicionar ao início" aparece automaticamente

---

## Notas técnicas

- **Sem acentos** em IDs HTML, funções JS ou colunas Supabase
- Service Worker usa **network-first** — sempre pega versão mais recente
- A cada deploy, incrementar versão em `sw.js`: `repgo-v1-0-1`, `repgo-v1-0-2`, etc.
- RPCs `SECURITY DEFINER` no Supabase permitem admin ver dados de qualquer rep
- A marca é criada automaticamente na tabela `marcas_rep` ao salvar um pedido
