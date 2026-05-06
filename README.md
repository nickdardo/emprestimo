# GEPainel

Sistema de gestão de empréstimos, parcelas e clientes — versão modular.

> Migração completa do projeto monolítico (`index.html` único de 6.350 linhas) para uma estrutura organizada por responsabilidade. **Zero alteração de funcionalidade**: todo o código JavaScript e CSS foi preservado.

---

## Stack

- **Frontend**: HTML + CSS + JavaScript vanilla (sem build step)
- **Banco de dados**: [Supabase](https://supabase.com) (PostgreSQL + Auth + Storage)
- **Hospedagem**: [Vercel](https://vercel.com)
- **PWA**: Service Worker + manifest (instalável em Android/iOS/Desktop)
- **Bibliotecas externas (CDN)**: `@supabase/supabase-js`, `xlsx` (importação/exportação Excel), `lucide` (ícones)

---

## Estrutura de pastas

```
gepainel/
├── index.html              # HTML principal (apenas estrutura — sem CSS/JS inline)
├── service-worker.js       # PWA — cache de assets para uso offline
├── vercel.json             # Config Vercel (cache headers, rewrites)
├── .gitignore
├── README.md
│
├── icons/                  # Favicons, ícones PWA, manifest
│   ├── favicon.ico
│   ├── favicon-16x16.png
│   ├── favicon-32x32.png
│   ├── apple-touch-icon.png
│   ├── android-chrome-192x192.png
│   ├── android-chrome-512x512.png
│   └── site.webmanifest
│
├── css/                    # Estilos modulares (carregados em ordem no <head>)
│   ├── variables.css       # Variáveis CSS (tema light/dark)
│   ├── base.css            # Reset, body, defaults globais
│   ├── login.css           # Tela de login + registro
│   ├── layout.css          # Nav, sidebar, bottom nav
│   ├── components.css      # Botões, inputs, modais, tabelas, badges, toast
│   ├── themes.css          # Overrides dark/light mode
│   └── responsive.css      # Media queries (mobile, tablet)
│
└── js/                     # JavaScript modular (carregado em ordem no fim do <body>)
    ├── config.js           # Cliente Supabase, constantes globais
    ├── state.js            # Estado global compartilhado (let tomadores=[], etc)
    ├── session.js          # saveSession / clearSession / readSession
    ├── utils.js            # Helpers: fmtR, fmtDate, masks, toast, modais
    ├── sidebar.js          # Sidebar, bottom nav, calculadora, calendário
    ├── auth.js             # Login, registro, recuperar senha
    ├── indicacao.js        # Códigos de indicação para captação
    ├── whatsapp.js         # Envio individual + WhatsApp Gestor
    ├── app.js              # bootApp, doLogout, loadAll, planos, avisos
    ├── dashboard.js        # Renderização do dashboard
    ├── emprestimos.js      # CRUD empréstimos, importação/exportação Excel
    ├── parcelas.js         # CRUD parcelas, pagamentos, mora, quitação
    ├── clientes.js         # CRUD tomadores, ficha do cliente
    ├── simulador.js        # Simulador de empréstimo
    ├── perfil.js           # Perfil, avatar, senha
    ├── usuarios.js         # Admin: CRUD usuários, renovações
    ├── notificacoes.js     # Push notifications, alertas de vencimento
    ├── pagamento.js        # Geração PIX (EMV), renovações de plano
    ├── relatorios.js       # Relatório, gráficos, exportar PDF/CSV
    ├── init.js             # Dark mode, busca global, ficha, DOMContentLoaded
    └── pwa.js              # Service Worker + Install Prompt
```

---

## Como rodar localmente

A aplicação é estática — basta servir os arquivos por HTTP (não funciona com `file://` por causa do PWA e do `fetch`):

```bash
# Opção 1: Python 3
python3 -m http.server 8000

# Opção 2: Node.js
npx serve -p 8000

# Opção 3: Vercel CLI (simula o ambiente de produção)
npm i -g vercel
vercel dev
```

Acesse: <http://localhost:8000>

---

## Deploy no Vercel

### Primeira vez
1. Faça `git push` deste repositório no GitHub.
2. No painel da Vercel, **Add New → Project → Import** o repositório.
3. **Framework Preset**: `Other` (não é um SPA com build).
4. **Build Command**: deixe vazio.
5. **Output Directory**: deixe vazio (raiz do repo).
6. Clique em **Deploy**.

### Atualizações
Cada `git push` na branch `main` faz deploy automático.

### Domínio customizado
**Project Settings → Domains** → adicione seu domínio.

---

## Configuração do Supabase

A chave que está em `js/config.js` é a **anon key** — ela é projetada para ser pública (vai no front-end de qualquer aplicação Supabase). A segurança real do banco vem das **Row Level Security (RLS) policies**.

### ⚠️ Confira que estas policies estão ativas:

```sql
-- Em todas as tabelas que contêm dados sensíveis:
ALTER TABLE tomadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE emprestimos ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Exemplo de policy: usuário só vê os próprios dados
CREATE POLICY "users_own_data" ON tomadores
  FOR ALL USING (auth.uid()::text = user_id::text);
```

> Sem RLS habilitado, qualquer um com a anon key pode ler/modificar tudo. **Confirme isso antes de ir para produção.**

### Mover credenciais para variáveis de ambiente (opcional)

Para não versionar a chave no GitHub:

1. No Vercel: **Settings → Environment Variables** → adicione `SUPABASE_URL` e `SUPABASE_ANON_KEY`.
2. Crie um endpoint Vercel `api/config.js` que retorna essas vars.
3. Em `js/config.js`, busque via `fetch('/api/config')` antes de criar o cliente.

(Opcional — a anon key é desenhada para ser pública.)

---

## Ordem de carregamento dos scripts (importante!)

Como não usamos um bundler, **a ordem dos `<script>` em `index.html` importa**. Cada arquivo declara funções/variáveis no escopo global, e arquivos posteriores podem usá-las. A ordem correta está documentada no próprio `index.html` com comentários.

**Não reordene** sem entender as dependências:
- `config.js` → declara `sb` (cliente Supabase) usado por todos
- `state.js` → declara `tomadores`, `emprestimos`, etc usados em todos os módulos de domínio
- `utils.js` → declara `toast`, `fmtR`, etc usados em quase todo lugar
- `init.js` → roda `DOMContentLoaded` (deve ser carregado **depois** de todas as funções que ele chama)

---

## Próximos passos sugeridos (opcional)

Se quiser evoluir a base de código no futuro:

1. **Adotar ES Modules**: trocar `<script>` simples por `<script type="module">` e usar `import`/`export`. Isso elimina a dependência da ordem global.
2. **Build step com Vite**: agrupa, minifica e adiciona hash de cache nos arquivos.
3. **TypeScript**: já que o projeto está organizado, é fácil migrar arquivo por arquivo.
4. **Testes**: ao menos para as funções puras (`fmtR`, `parseCurrency`, `gerarPixEMV`, `_crc16pix`, `cpfValido`).

---

## Histórico de migração

Esta versão modular foi gerada a partir do `index.html` monolítico original (6.350 linhas), preservando 100% do comportamento. As mudanças foram puramente organizacionais:

- ✅ CSS extraído de `<style>` inline para 7 arquivos em `/css/`
- ✅ JavaScript extraído de `<script>` inline para 20 arquivos em `/js/`
- ✅ Service Worker movido de inline para `/service-worker.js`
- ✅ Lista de cache do SW atualizada para refletir os novos paths
- ✅ Manifest PWA criado em `/icons/site.webmanifest`
- ✅ `vercel.json` adicionado com headers de cache otimizados
- ✅ Variáveis de estado global centralizadas em `state.js` (sem duplicação)
- ✅ Validação sintática (todos os arquivos JS passam `node --check`)

---

**Desenvolvido por Eduardo Ribeiro.**
