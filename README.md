# 🚀 GEPainel - Pronto para Deploy

Sistema de Gestão de Empréstimos modularizado e otimizado.

## 📁 Estrutura do Projeto

```
gepainel/
├── index.html          # Página principal
├── css/
│   └── style.css      # Estilos (641 linhas)
├── js/
│   ├── config.js      # Configuração Supabase
│   ├── utils.js       # Funções utilitárias
│   └── app.js         # Lógica principal (4.749 linhas)
├── icons/             # (adicione seus ícones PWA aqui)
├── .gitignore
└── vercel.json        # Configuração Vercel
```

## 🎯 Como Fazer Deploy

### Opção 1: GitHub + Vercel (Recomendado)

1. **Criar repositório no GitHub**
   ```bash
   # No terminal, dentro da pasta gepainel:
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/gepainel.git
   git push -u origin main
   ```

2. **Deploy no Vercel**
   - Acesse [vercel.com](https://vercel.com)
   - Clique em "New Project"
   - Importe seu repositório GitHub
   - Configure:
     - Framework Preset: `Other`
     - Build Command: (deixe vazio)
     - Output Directory: `.`
   - Clique em "Deploy"
   
3. **Pronto!** Seu app estará no ar em segundos.

### Opção 2: Upload Direto no Vercel

1. Acesse [vercel.com](https://vercel.com)
2. Arraste a pasta `gepainel` para fazer upload
3. Aguarde o deploy automático

## ⚙️ Configuração do Supabase

Suas credenciais do Supabase já estão configuradas em `js/config.js`:

```javascript
const SUPABASE_URL = 'https://efdwdjwncbwbgmcudizh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGc...' // (já configurado)
```

## 📱 PWA (Progressive Web App)

Para o PWA funcionar corretamente:

1. **Adicione os ícones** na pasta `icons/`:
   - favicon.ico
   - favicon-16x16.png
   - favicon-32x32.png
   - android-chrome-192x192.png
   - android-chrome-512x512.png
   - apple-touch-icon.png
   - site.webmanifest

2. **O PWA funcionará automaticamente** após deploy

## ✅ Checklist Pós-Deploy

- [ ] Site carregando corretamente
- [ ] Login funcionando
- [ ] Supabase conectado
- [ ] PWA instalável (teste no mobile)
- [ ] Sem erros no console (F12)

## 🔧 Desenvolvimento Local

Para testar localmente antes do deploy:

```bash
# Instale um servidor HTTP simples
npm install -g http-server

# Execute na pasta do projeto
http-server

# Ou use Python:
python -m http.server 8000

# Acesse: http://localhost:8000
```

## 📊 Otimizações Realizadas

✅ Código modularizado (CSS, JS separados)
✅ Pronto para GitHub + Vercel
✅ PWA configurado
✅ Estrutura profissional
✅ Fácil manutenção

## 🆘 Suporte

Se tiver problemas:
1. Verifique o console do navegador (F12)
2. Confirme que o Supabase está acessível
3. Verifique se todos os arquivos foram enviados

---

**Desenvolvido por Eduardo Ribeiro**  
**Versão**: 2.0 Modularizada
