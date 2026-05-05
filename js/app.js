```javascript
/**
 * GEPainel - Lógica Principal da Aplicação
 * Este arquivo contém toda a lógica de negócio do sistema
 */

// ═══════════════════════════════════════════════════════════
// VARIÁVEIS GLOBAIS
// ═══════════════════════════════════════════════════════════

let session = null;
let tomadores = [];
let emprestimos = [];
let parcelas = [];
let users = [];

// Estilos de avatar por role
const AV_STYLE = {
  admin: 'background: linear-gradient(135deg, #EA580C, #F97316); color: #fff;',
  op: 'background: linear-gradient(135deg, #6D9FFF, #8C43F2); color: #fff;'
};

// ═══════════════════════════════════════════════════════════
// AUTENTICAÇÃO
// ═══════════════════════════════════════════════════════════

function showRegister() {
  document.getElementById('login-panel').style.display = 'none';
  document.getElementById('register-panel').style.display = 'block';
  document.getElementById('reg-error').style.display = 'none';
}

function showLogin() {
  document.getElementById('register-panel').style.display = 'none';
  document.getElementById('login-panel').style.display = 'block';
  document.getElementById('login-error').style.display = 'none';
}

function showErr(msg) {
  const errorElement = document.getElementById('login-error');
  errorElement.textContent = msg;
  errorElement.style.display = 'block';
}

function showRegErr(msg) {
  const errorElement = document.getElementById('reg-error');
  errorElement.textContent = msg;
  errorElement.style.display = 'block';
}

async function doLogin() {
  const login = document.getElementById('lu').value.trim().toLowerCase();
  const pass = document.getElementById('lp').value;
  
  if (!login || !pass) {
    showErr('Preencha usuário e senha');
    return;
  }
  
  const btn = document.getElementById('login-btn');
  const textoOriginal = setBotaoLoading(btn, 'Entrando...');
  
  try {
    const { data, error } = await sb
      .from('users')
      .select('*')
      .eq('login', login)
      .eq('pass_hash', hp(pass))
      .maybeSingle();
    
    resetBotao(btn, textoOriginal);
    
    if (error || !data) {
      showErr('Usuário ou senha incorretos.');
      return;
    }
    
    if (data.ativo === false) {
      showErr('Conta suspensa. Contate o administrador.');
      return;
    }
    
    // Verificar expiração
    if (data.role !== 'admin' && data.expires_at) {
      const dias = Math.ceil((new Date(data.expires_at) - new Date()) / (1000 * 60 * 60 * 24));
      
      if (dias < 0) {
        showErr('⛔ Seu acesso expirou. Contate o administrador.');
        return;
      }
      
      if (dias <= 3) {
        setTimeout(() => {
          toast(`⚠ Seu acesso expira em ${dias} dia${dias !== 1 ? 's' : ''}!`, true);
        }, 1500);
      }
    }
    
    session = data;
    saveSession(session);
    await bootApp();
    
  } catch (e) {
    console.error('Erro no login:', e);
    resetBotao(btn, textoOriginal);
    showErr('Erro de conexão.');
  }
}

async function doRegister() {
  const nome = document.getElementById('reg-nome').value.trim();
  const login = document.getElementById('reg-login').value.trim().toLowerCase();
  const email = document.getElementById('reg-email').value.trim().toLowerCase();
  const pass = document.getElementById('reg-pass').value;
  const pass2 = document.getElementById('reg-pass2').value;
  
  document.getElementById('reg-error').style.display = 'none';
  
  // Validações
  if (!nome) {
    showRegErr('Informe seu nome.');
    return;
  }
  
  if (!login || login.length < 3) {
    showRegErr('Login deve ter ao menos 3 caracteres.');
    return;
  }
  
  if (!/^[a-z0-9._]+$/.test(login)) {
    showRegErr('Login inválido. Use letras, números, ponto.');
    return;
  }
  
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showRegErr('E-mail inválido.');
    return;
  }
  
  if (pass.length < 4) {
    showRegErr('Senha deve ter ao menos 4 caracteres.');
    return;
  }
  
  if (pass !== pass2) {
    showRegErr('As senhas não coincidem.');
    return;
  }
  
  const btn = document.getElementById('register-btn');
  const textoOriginal = setBotaoLoading(btn, 'Criando...');
  
  try {
    // Verificar se login já existe
    const { data: existente } = await sb
      .from('users')
      .select('id')
      .eq('login', login)
      .maybeSingle();
    
    if (existente) {
      showRegErr('Login já em uso.');
      resetBotao(btn, textoOriginal);
      return;
    }
    
    // Verificar se email já existe
    const { data: emailExistente } = await sb
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    
    if (emailExistente) {
      showRegErr('E-mail já cadastrado.');
      resetBotao(btn, textoOriginal);
      return;
    }
    
    // Criar conta com 30 dias de trial
    const trialExp = new Date();
    trialExp.setDate(trialExp.getDate() + 30);
    const trialExpStr = trialExp.toISOString().split('T')[0];
    
    const { data, error } = await sb
      .from('users')
      .insert({
        nome,
        login,
        email,
        pass_hash: hp(pass),
        role: 'op',
        ativo: true,
        expires_at: trialExpStr
      })
      .select()
      .single();
    
    if (error || !data) {
      console.error('Erro ao criar conta:', error);
      showRegErr('Erro ao criar conta: ' + (error?.message || 'tente novamente'));
      resetBotao(btn, textoOriginal);
      return;
    }
    
    if (!data.expires_at) data.expires_at = trialExpStr;
    
    session = data;
    saveSession(session);
    resetBotao(btn, textoOriginal);
    
    await bootApp();
    toast(`✓ Bem-vindo(a), ${data.nome.split(' ')[0]}! Você tem 30 dias grátis.`);
    
  } catch (e) {
    console.error('Erro no registro:', e);
    showRegErr('Erro de conexão.');
    resetBotao(btn, textoOriginal);
  }
}

function logout() {
  if (confirm('Deseja realmente sair?')) {
    clearSession();
    window.location.reload();
  }
}

// ═══════════════════════════════════════════════════════════
// INICIALIZAÇÃO DA APLICAÇÃO
// ═══════════════════════════════════════════════════════════

async function bootApp() {
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('app-page').style.display = 'flex';
  
  try {
    // Configurar avatar
    const avatarElement = document.getElementById('nav-av');
    if (session.avatar_url) {
      avatarElement.style.cssText = 'background: transparent; padding: 0; overflow: hidden;';
      avatarElement.innerHTML = `<img src="${session.avatar_url}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%" alt="Avatar do usuário">`;
    } else {
      avatarElement.textContent = ini(session.nome);
      avatarElement.style.cssText = AV_STYLE[session.role] || AV_STYLE.op;
    }
    
    // Configurar nome
    document.getElementById('nav-name').textContent = session.nome || '';
    
    // Configurar badge de role/plano
    const navBadge = document.getElementById('nav-role');
    
    if (session.role === 'admin') {
      navBadge.textContent = 'Admin';
      navBadge.className = 'nav-badge badge-admin';
    } else if (session.expires_at) {
      const dias = Math.ceil((new Date(session.expires_at) - new Date()) / (1000 * 60 * 60 * 24));
      
      if (dias < 0) {
        navBadge.textContent = '⛔ Expirado';
        navBadge.className = 'nav-badge badge-expired';
      } else if (dias <= 7) {
        navBadge.textContent = `⚠ ${dias}d restantes`;
        navBadge.className = 'nav-badge badge-warn';
      } else {
        navBadge.textContent = `Ativo · ${dias}d`;
        navBadge.className = 'nav-badge badge-ativo';
      }
    } else {
      navBadge.textContent = '👑 Vitalício';
      navBadge.className = 'nav-badge badge-vitalicio';
    }
    
  } catch (e) {
    console.error('Erro ao configurar interface:', e);
  }
  
  try {
    await loadAll();
  } catch (e) {
    console.error('Erro ao carregar dados:', e);
    tomadores = [];
    emprestimos = [];
    parcelas = [];
    users = [];
  }
  
  buildSidebar();
  showPage('dashboard');
}

// ═══════════════════════════════════════════════════════════
// CARREGAMENTO DE DADOS
// ═══════════════════════════════════════════════════════════

async function loadAll() {
  // Implementar carregamento de dados do Supabase
  // TODO: Extrair do arquivo original
}

// ═══════════════════════════════════════════════════════════
// SIDEBAR E NAVEGAÇÃO
// ═══════════════════════════════════════════════════════════

function buildSidebar() {
  // Implementar construção do sidebar
  // TODO: Extrair do arquivo original
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.querySelector('.sb-overlay');
  
  sidebar.classList.toggle('open');
  overlay.classList.toggle('open');
  
  const hamburger = document.querySelector('.hamburger');
  const isOpen = sidebar.classList.contains('open');
  hamburger.setAttribute('aria-expanded', isOpen);
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.querySelector('.sb-overlay');
  
  sidebar.classList.remove('open');
  overlay.classList.remove('open');
  
  const hamburger = document.querySelector('.hamburger');
  hamburger.setAttribute('aria-expanded', 'false');
}

function showPage(pageName) {
  // Implementar sistema de páginas
  // TODO: Extrair do arquivo original
  const content = document.getElementById('page-content');
  
  // Placeholder
  content.innerHTML = `
    <div style="padding: 2rem; text-align: center;">
      <h1 style="font-family: var(--FT); font-size: 2rem; margin-bottom: 1rem;">
        Página: ${pageName}
      </h1>
      <p style="color: var(--n3);">
        Implementação pendente. Extrair do arquivo original.
      </p>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════
// EXPORTAÇÕES GLOBAIS
// ═══════════════════════════════════════════════════════════

window.showRegister = showRegister;
window.showLogin = showLogin;
window.doLogin = doLogin;
window.doRegister = doRegister;
window.logout = logout;
window.bootApp = bootApp;
window.toggleSidebar = toggleSidebar;
window.closeSidebar = closeSidebar;
window.showPage = showPage;
```
