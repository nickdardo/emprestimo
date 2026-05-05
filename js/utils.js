/**
 * GEPainel - Funções Utilitárias
 * Este arquivo contém funções auxiliares para formatação, validação e manipulação de dados
 */

// ═══════════════════════════════════════════════════════════
// FORMATAÇÃO DE VALORES
// ═══════════════════════════════════════════════════════════

/**
 * Formata valor monetário em Real brasileiro
 * @param {number} val - Valor a ser formatado
 * @returns {string} - Valor formatado (ex: "R$ 1.234,56")
 */
function fm(val) {
  if (val == null || isNaN(val)) return 'R$ 0,00';
  return 'R$ ' + Number(val).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Formata data no padrão brasileiro
 * @param {string} d - Data em formato ISO
 * @returns {string} - Data formatada (ex: "25/12/2024")
 */
function fd(d) {
  if (!d) return '';
  const [y, m, day] = d.split('T')[0].split('-');
  return `${day}/${m}/${y}`;
}

/**
 * Formata data com hora no padrão brasileiro
 * @param {string} d - Data em formato ISO
 * @returns {string} - Data e hora formatadas (ex: "25/12/2024 15:30")
 */
function fdh(d) {
  if (!d) return '';
  const dt = new Date(d);
  const day = String(dt.getDate()).padStart(2, '0');
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const year = dt.getFullYear();
  const hour = String(dt.getHours()).padStart(2, '0');
  const min = String(dt.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hour}:${min}`;
}

/**
 * Converte data BR para ISO
 * @param {string} dataBr - Data no formato DD/MM/YYYY
 * @returns {string} - Data no formato ISO (YYYY-MM-DD)
 */
function brToIso(dataBr) {
  if (!dataBr || dataBr.length !== 10) return '';
  const [d, m, y] = dataBr.split('/');
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/**
 * Retorna as iniciais do nome
 * @param {string} nome - Nome completo
 * @returns {string} - Iniciais (máximo 2 caracteres)
 */
function ini(nome) {
  if (!nome) return '?';
  const partes = nome.trim().split(' ').filter(p => p.length > 0);
  if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

/**
 * Hash simples para senhas (substitua por bcrypt em produção)
 * @param {string} s - String a ser hasheada
 * @returns {string} - Hash da string
 */
function hp(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h = h & h;
  }
  return h.toString(36);
}

// ═══════════════════════════════════════════════════════════
// MÁSCARAS DE INPUT
// ═══════════════════════════════════════════════════════════

/**
 * Aplica máscara de telefone (formato brasileiro)
 * @param {HTMLInputElement} input - Elemento input
 */
function maskTel(input) {
  let val = input.value.replace(/\D/g, '');
  if (val.length > 11) val = val.substring(0, 11);
  
  if (val.length <= 10) {
    val = val.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3');
  } else {
    val = val.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, '($1) $2-$3');
  }
  
  input.value = val;
}

/**
 * Aplica máscara de CPF
 * @param {HTMLInputElement} input - Elemento input
 */
function maskCPF(input) {
  let val = input.value.replace(/\D/g, '');
  if (val.length > 11) val = val.substring(0, 11);
  
  val = val.replace(/^(\d{3})(\d{3})(\d{3})(\d{2}).*/, '$1.$2.$3-$4');
  input.value = val;
}

/**
 * Formata CPF para input
 * @param {HTMLInputElement} input - Elemento input
 */
function formatarCpfInput(input) {
  let v = input.value.replace(/\D/g, '');
  if (v.length > 11) v = v.substring(0, 11);
  
  if (v.length > 9) {
    v = v.replace(/^(\d{3})(\d{3})(\d{3})(\d{2}).*/, '$1.$2.$3-$4');
  } else if (v.length > 6) {
    v = v.replace(/^(\d{3})(\d{3})(\d{0,3}).*/, '$1.$2.$3');
  } else if (v.length > 3) {
    v = v.replace(/^(\d{3})(\d{0,3}).*/, '$1.$2');
  }
  
  input.value = v;
}

/**
 * Valida CPF
 * @param {string} cpf - CPF a ser validado
 * @returns {boolean} - true se válido, false caso contrário
 */
function validarCPF(cpf) {
  cpf = cpf.replace(/\D/g, '');
  
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  
  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(cpf.charAt(i)) * (10 - i);
  }
  let resto = 11 - (soma % 11);
  let digito1 = resto >= 10 ? 0 : resto;
  
  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(cpf.charAt(i)) * (11 - i);
  }
  resto = 11 - (soma % 11);
  let digito2 = resto >= 10 ? 0 : resto;
  
  return parseInt(cpf.charAt(9)) === digito1 && parseInt(cpf.charAt(10)) === digito2;
}

// ═══════════════════════════════════════════════════════════
// NOTIFICAÇÕES (TOAST)
// ═══════════════════════════════════════════════════════════

/**
 * Exibe notificação toast
 * @param {string} msg - Mensagem a ser exibida
 * @param {boolean} isWarning - Se true, usa estilo de aviso
 */
function toast(msg, isWarning = false) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'polite');
  toast.textContent = msg;
  
  if (isWarning) {
    toast.style.background = 'linear-gradient(135deg, #F59E0B, #D97706)';
  }
  
  document.body.appendChild(toast);
  
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ═══════════════════════════════════════════════════════════
// MANIPULAÇÃO DE SESSÃO
// ═══════════════════════════════════════════════════════════

/**
 * Salva sessão do usuário no localStorage
 * @param {Object} dados - Dados da sessão
 */
function saveSession(dados) {
  try {
    localStorage.setItem('ep_sess', JSON.stringify(dados));
  } catch (e) {
    console.error('Erro ao salvar sessão:', e);
  }
}

/**
 * Carrega sessão do usuário do localStorage
 * @returns {Object|null} - Dados da sessão ou null
 */
function loadSession() {
  try {
    const dados = localStorage.getItem('ep_sess');
    return dados ? JSON.parse(dados) : null;
  } catch (e) {
    return null;
  }
}

/**
 * Limpa sessão do localStorage
 */
function clearSession() {
  try {
    localStorage.removeItem('ep_sess');
  } catch (e) {
    console.error('Erro ao limpar sessão:', e);
  }
}

// ═══════════════════════════════════════════════════════════
// UTILITÁRIOS DE DOM
// ═══════════════════════════════════════════════════════════

/**
 * Adiciona classe de loading a um elemento
 * @param {HTMLElement} elemento - Elemento a receber a classe
 */
function showLoading(elemento) {
  if (elemento) {
    elemento.classList.add('loading');
    elemento.setAttribute('aria-busy', 'true');
  }
}

/**
 * Remove classe de loading de um elemento
 * @param {HTMLElement} elemento - Elemento que terá a classe removida
 */
function hideLoading(elemento) {
  if (elemento) {
    elemento.classList.remove('loading');
    elemento.setAttribute('aria-busy', 'false');
  }
}

/**
 * Adiciona texto de loading a um botão e desabilita
 * @param {HTMLButtonElement} botao - Botão a ser modificado
 * @param {string} texto - Texto de loading (opcional)
 * @returns {string} - Texto original do botão
 */
function setBotaoLoading(botao, texto = 'Carregando...') {
  if (!botao) return '';
  const textoOriginal = botao.textContent;
  botao.textContent = texto;
  botao.disabled = true;
  botao.setAttribute('aria-busy', 'true');
  return textoOriginal;
}

/**
 * Restaura botão ao estado original
 * @param {HTMLButtonElement} botao - Botão a ser restaurado
 * @param {string} textoOriginal - Texto original do botão
 */
function resetBotao(botao, textoOriginal) {
  if (!botao) return;
  botao.textContent = textoOriginal;
  botao.disabled = false;
  botao.setAttribute('aria-busy', 'false');
}

// ═══════════════════════════════════════════════════════════
// EXPORTAÇÕES GLOBAIS
// ═══════════════════════════════════════════════════════════

// Exportar funções para o escopo global (para compatibilidade com código existente)
window.fm = fm;
window.fd = fd;
window.fdh = fdh;
window.brToIso = brToIso;
window.ini = ini;
window.hp = hp;
window.maskTel = maskTel;
window.maskCPF = maskCPF;
window.formatarCpfInput = formatarCpfInput;
window.validarCPF = validarCPF;
window.toast = toast;
window.saveSession = saveSession;
window.loadSession = loadSession;
window.clearSession = clearSession;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.setBotaoLoading = setBotaoLoading;
window.resetBotao = resetBotao;
