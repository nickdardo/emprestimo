// ============================================================
// renov-cpf.js — Fluxo de coleta de CPF antes da cobrança PIX
// ============================================================
// Pré-requisitos:
//   - Cliente Supabase já inicializado em window.supabase
//     (ou ajuste a variável SUPABASE_CLIENT abaixo)
//   - HTML do modal (02_renov_modal.html) já aplicado na página
//   - Endpoint /api/criar-cobranca já no backend
// ============================================================

// 🔧 Ajuste se seu cliente Supabase tiver outro nome
const SUPABASE_CLIENT = window.supabase;

// 🔧 Ajuste se o nome da tabela for diferente
const USERS_TABLE = 'users';

// Guarda o plano selecionado entre as etapas (planos → cpf → qr)
let _renovPlanoSelecionado = null;

// ─────────────────────────────────────────────────────────────
// Helpers de CPF
// ─────────────────────────────────────────────────────────────

function limparCpf(cpf) {
  return (cpf || '').replace(/\D/g, '');
}

function formatarCpfInput(input) {
  let v = limparCpf(input.value).slice(0, 11);
  if (v.length > 9)      v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
  else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
  else if (v.length > 3) v = v.replace(/(\d{3})(\d{1,3})/, '$1.$2');
  input.value = v;
  // limpa mensagem de erro ao digitar
  document.getElementById('renov-cpf-erro').style.display = 'none';
}

// Validação de CPF com dígitos verificadores
function cpfValido(cpf) {
  cpf = limparCpf(cpf);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1+$/.test(cpf)) return false; // todos iguais (111.111.111-11 etc.)

  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(cpf[i]) * (10 - i);
  let dv1 = 11 - (soma % 11);
  if (dv1 >= 10) dv1 = 0;
  if (dv1 !== parseInt(cpf[9])) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(cpf[i]) * (11 - i);
  let dv2 = 11 - (soma % 11);
  if (dv2 >= 10) dv2 = 0;
  return dv2 === parseInt(cpf[10]);
}

// ─────────────────────────────────────────────────────────────
// Navegação entre etapas do modal
// ─────────────────────────────────────────────────────────────

function mostrarEtapa(etapa) {
  ['renov-planos', 'renov-cpf', 'renov-qr'].forEach(id => {
    document.getElementById(id).style.display = (id === etapa) ? '' : 'none';
  });
}

function voltarParaPlanos() {
  if (window._renovPollingId) clearInterval(window._renovPollingId);
  mostrarEtapa('renov-planos');
}

// ─────────────────────────────────────────────────────────────
// Fluxo principal: usuário clicou em um plano
// Substitua a sua função antiga (a que era chamada pelos botões
// de plano em #renov-grid) por esta.
// ─────────────────────────────────────────────────────────────

async function selecionarPlano(plano) {
  // plano = { label: '30 dias', valor: 2.99, dias: 30 }
  _renovPlanoSelecionado = plano;

  // Pega usuário logado
  const user = await getUsuarioAtual();
  if (!user) {
    alert('Sessão expirada. Faça login novamente.');
    return;
  }

  // Busca CPF salvo no perfil
  const cpfSalvo = await buscarCpfDoUsuario(user.id);

  if (cpfSalvo && cpfValido(cpfSalvo)) {
    // Já tem CPF → pula direto pro QR Code
    await gerarCobranca({ user, cpf: cpfSalvo, plano });
  } else {
    // Não tem CPF → mostra etapa de coleta
    document.getElementById('renov-cpf-titulo').textContent =
      `PIX — ${plano.label} · R$ ${plano.valor.toFixed(2).replace('.', ',')}`;
    document.getElementById('renov-cpf-input').value = '';
    document.getElementById('renov-cpf-erro').style.display = 'none';
    mostrarEtapa('renov-cpf');
    setTimeout(() => document.getElementById('renov-cpf-input').focus(), 100);
  }
}

// ─────────────────────────────────────────────────────────────
// Usuário preencheu o CPF e clicou "Continuar"
// ─────────────────────────────────────────────────────────────

async function continuarComCpf() {
  const inputCpf  = document.getElementById('renov-cpf-input');
  const erroDiv   = document.getElementById('renov-cpf-erro');
  const btn       = document.getElementById('renov-cpf-continuar');
  const salvarChk = document.getElementById('renov-cpf-salvar');

  const cpf = limparCpf(inputCpf.value);

  if (!cpfValido(cpf)) {
    erroDiv.textContent = 'CPF inválido. Confira os números digitados.';
    erroDiv.style.display = '';
    inputCpf.focus();
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Gerando cobrança...';

  try {
    const user = await getUsuarioAtual();
    if (!user) throw new Error('Sessão expirada');

    // Salva no Supabase se o checkbox estiver marcado
    if (salvarChk.checked) {
      await salvarCpfDoUsuario(user.id, cpf);
    }

    await gerarCobranca({ user, cpf, plano: _renovPlanoSelecionado });

  } catch (err) {
    console.error('[continuarComCpf]', err);
    erroDiv.textContent = err.message || 'Erro ao gerar cobrança. Tente novamente.';
    erroDiv.style.display = '';
    btn.disabled = false;
    btn.textContent = 'Continuar para o pagamento';
  }
}

// ─────────────────────────────────────────────────────────────
// Chama o backend e mostra o QR Code
// ─────────────────────────────────────────────────────────────

async function gerarCobranca({ user, cpf, plano }) {
  const resp = await fetch('/api/criar-cobranca', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId:     user.id,
      userName:   user.user_metadata?.nome || user.email,
      userEmail:  user.email,
      userCpf:    cpf,
      planoLabel: plano.label,
      planoValor: plano.valor,
      planoDias:  plano.dias,
    }),
  });

  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || 'Erro ao gerar cobrança');

  // Renderiza QR Code
  document.getElementById('renov-qr-titulo').textContent =
    `PIX — ${plano.label} · R$ ${plano.valor.toFixed(2).replace('.', ',')}`;

  const qrEl = document.getElementById('renov-qr-canvas');
  qrEl.innerHTML = `<img src="data:image/png;base64,${data.qrCodeImage}" alt="QR Code PIX" style="width:220px;height:220px;display:block">`;

  document.getElementById('renov-pix-code').value = data.pixCode;

  mostrarEtapa('renov-qr');

  // Reativa botão da etapa anterior (caso volte)
  const btn = document.getElementById('renov-cpf-continuar');
  btn.disabled = false;
  btn.textContent = 'Continuar para o pagamento';

  // Inicia polling de status (se você já tem essa função)
  if (typeof iniciarPollingPagamento === 'function') {
    iniciarPollingPagamento(data.paymentId);
  }
}

// ─────────────────────────────────────────────────────────────
// Integração com Supabase
// ─────────────────────────────────────────────────────────────

async function getUsuarioAtual() {
  const { data: { user } } = await SUPABASE_CLIENT.auth.getUser();
  return user;
}

async function buscarCpfDoUsuario(userId) {
  const { data, error } = await SUPABASE_CLIENT
    .from(USERS_TABLE)
    .select('cpf')
    .eq('id', userId)
    .single();

  if (error) {
    console.warn('[buscarCpfDoUsuario]', error.message);
    return null;
  }
  return data?.cpf || null;
}

async function salvarCpfDoUsuario(userId, cpf) {
  const { error } = await SUPABASE_CLIENT
    .from(USERS_TABLE)
    .update({ cpf: limparCpf(cpf) })
    .eq('id', userId);

  if (error) {
    console.error('[salvarCpfDoUsuario]', error.message);
    // Não bloqueia o fluxo de pagamento se falhar o save
  }
}

// ─────────────────────────────────────────────────────────────
// Copiar código PIX (caso você já não tenha essa função)
// ─────────────────────────────────────────────────────────────

function copiarPix() {
  const input = document.getElementById('renov-pix-code');
  input.select();
  navigator.clipboard.writeText(input.value).then(() => {
    const btn = event.target.closest('button');
    const txtOriginal = btn.innerHTML;
    btn.innerHTML = '✅ Copiado!';
    setTimeout(() => { btn.innerHTML = txtOriginal; }, 1500);
  });
}
