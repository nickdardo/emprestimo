// ════════════════════════════════════════════════════════════════
// PAGAMENTO — Geração de código PIX, renovações de plano, polling Mercado Pago
// ════════════════════════════════════════════════════════════════

// ══ PIX / RENOVAÇÃO ══
const _PIX_KEY='01058147250';
const _PIX_NAME='Eduardo Ribeiro Oliveira';
const _PIX_CITY='Belem';
const _PIX_PLANOS=[
  {label:'30 dias',  dias:30,  valor:2.99, desc:'Renovação trial'},
  {label:'60 dias',  dias:60,  valor:5.00, desc:'Plano básico'},
  {label:'90 dias',  dias:90,  valor:8.00, desc:'Plano trimestral'},
  {label:'6 meses',  dias:180, valor:15.00,desc:'Plano semestral'},
  {label:'1 ano',    dias:365, valor:25.00,desc:'Plano anual'},
];

function _crc16pix(str){
  let crc=0xFFFF;
  for(let i=0;i<str.length;i++){
    crc^=str.charCodeAt(i)<<8;
    for(let j=0;j<8;j++) crc=(crc&0x8000)?((crc<<1)^0x1021):(crc<<1);
  }
  return(crc&0xFFFF).toString(16).toUpperCase().padStart(4,'0');
}

function _pixField(id,value){
  const l=String(value.length).padStart(2,'0');
  return id+l+value;
}

function gerarPixEMV(chave,nome,cidade,valor,txid){
  txid=(txid||'GEPainel').replace(/[^A-Za-z0-9]/g,'').substring(0,25).padEnd(1,'A');
  const gui=_pixField('00','BR.GOV.BCB.PIX')+_pixField('01',chave);
  const mai=_pixField('26',gui);
  const addi=_pixField('62',_pixField('05',txid));
  const nomeAsc=nome.normalize('NFD').replace(/[\u0300-\u036f]/g,'').substring(0,25);
  const cidAsc=cidade.normalize('NFD').replace(/[\u0300-\u036f]/g,'').substring(0,15);
  const payload=
    _pixField('00','01')+
    _pixField('01','12')+
    mai+
    _pixField('52','0000')+
    _pixField('53','986')+
    _pixField('54',valor.toFixed(2))+
    _pixField('58','BR')+
    _pixField('59',nomeAsc)+
    _pixField('60',cidAsc)+
    addi+
    '6304';
  return payload+_crc16pix(payload);
}


// ══ GERADOR DE CÓDIGO PIX (EMV) ══
function gerarPixCode(valor){
  const pixKey='01058147250'; // CPF sem pontos
  const merchantName='EDUARDO GEPAINEL';
  const merchantCity='BELEM';
  const txid='***'; // ID da transação
  
  // Campos PIX (formato EMV)
  const payload=[
    field('00','01'), // Payload Format Indicator
    field('26',
      field('00','BR.GOV.BCB.PIX')+
      field('01',pixKey)
    ),
    field('52','0000'), // Merchant Category Code
    field('53','986'), // Currency (BRL)
    field('54',valor.toFixed(2)), // Transaction Amount
    field('58','BR'), // Country Code
    field('59',merchantName), // Merchant Name
    field('60',merchantCity), // Merchant City
    field('62',field('05',txid)), // Additional Data
  ].join('');
  
  // Adicionar CRC
  const crc=crc16(payload+'6304');
  return payload+'6304'+crc;
}

function field(id,value){
  const len=value.length.toString().padStart(2,'0');
  return id+len+value;
}

function crc16(str){
  let crc=0xFFFF;
  for(let i=0;i<str.length;i++){
    crc^=str.charCodeAt(i)<<8;
    for(let j=0;j<8;j++){
      if(crc&0x8000)crc=(crc<<1)^0x1021;
      else crc<<=1;
    }
  }
  return(crc&0xFFFF).toString(16).toUpperCase().padStart(4,'0');
}


function abrirRenovacao(){
  if(session.role==='admin'){toast('Admin não precisa renovar!');return;}
  const grid=document.getElementById('renov-grid');
  if(!grid)return;
  grid.innerHTML=_PIX_PLANOS.map((p,i)=>{
    const tiers={
      '30 dias':{name:'🥉 Bronze', bg:'linear-gradient(135deg,#CD7F32,#A0522D)', border:'#CD7F32'},
      '60 dias':{name:'🥈 Prata',  bg:'linear-gradient(135deg,#C0C0C0,#A8A8A8)', border:'#A8A8A8'},
      '90 dias':{name:'🥇 Ouro',   bg:'linear-gradient(135deg,#FFD700,#DAA520)', border:'#DAA520'},
      '6 meses':{name:'💎 Platinum',bg:'linear-gradient(135deg,#E5E4E2,#B8B8B8)', border:'#B8B8B8'},
      '1 ano':  {name:'💎 Diamante',bg:'linear-gradient(135deg,#60A5FA,#818CF8,#C084FC)', border:'#818CF8'},
    };
    const t=tiers[p.label]||{};
    return`<div onclick="selecionarPlano(${i})" style="border:2px solid ${t.border||'#E5E7EB'};border-radius:var(--r);padding:.85rem;cursor:pointer;text-align:center;transition:all .15s;background:var(--card);position:relative;overflow:hidden"
      onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 20px rgba(0,0,0,.15)'"
      onmouseout="this.style.transform='';this.style.boxShadow=''">
      ${t.name?`<div style="display:inline-block;background:${t.bg};color:${p.label==='90 dias'?'#111':'#fff'};border-radius:999px;font-size:10px;font-weight:800;padding:2px 10px;margin-bottom:.4rem;letter-spacing:.03em">${t.name}</div>`:''}
      <div style="font-size:1.05rem;font-weight:700;color:var(--n1)">${p.label}</div>
      <div style="font-size:1.3rem;font-weight:800;color:#EA580C;margin:.2rem 0">R$ ${p.valor.toFixed(2).replace('.',',')}</div>
      <div style="font-size:11px;color:var(--n4)">${p.desc}</div>
    </div>`;
  }).join('');
  
  // Carrega preferência de renovação automática
  const toggle=document.getElementById('renov-auto-toggle');
  if(toggle){
    toggle.checked=!!session.auto_renewal;
    // Mostra aviso se já estiver ativo
    const aviso=document.getElementById('renov-auto-aviso');
    if(aviso)aviso.style.display=toggle.checked?'':'none';
  }
  
  document.getElementById('renov-planos').style.display='';
  document.getElementById('renov-qr').style.display='none';
  openM('renov-modal');
}

function mostrarAvisoRenovacao(){
  const toggle=document.getElementById('renov-auto-toggle');
  const aviso=document.getElementById('renov-auto-aviso');
  if(aviso)aviso.style.display=toggle?.checked?'':'none';
}

// ============================================================
// renov-cpf-integrado.js
// Substitui a função selecionarPlano() preservando:
//   - Fallback PIX estático
//   - Polling de pagamento
//   - QR Code local via qrcodejs
//   - Salvar renovação em background
// E adiciona a etapa de coleta de CPF antes de chamar a API.
// ============================================================
//
// 🔧 AJUSTES no topo (verifique antes de usar):
const SUPABASE_CLIENT = sb;                // cliente Supabase do projeto (linha 1043)
const USERS_TABLE     = 'users';           // confirmado no webhook-asaas.js
//
// ============================================================

// Guarda o plano selecionado entre as etapas
let _renovPlanoSel = null;

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
  const erroDiv = document.getElementById('renov-cpf-erro');
  if (erroDiv) erroDiv.style.display = 'none';
}

function cpfValido(cpf) {
  cpf = limparCpf(cpf);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1+$/.test(cpf)) return false;

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
// Supabase helpers
// ─────────────────────────────────────────────────────────────

async function buscarCpfDoUsuario(userId) {
  try {
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
  } catch (e) {
    console.warn('[buscarCpfDoUsuario] exception:', e);
    return null;
  }
}

async function salvarCpfDoUsuario(userId, cpf) {
  try {
    const { error } = await SUPABASE_CLIENT
      .from(USERS_TABLE)
      .update({ cpf: limparCpf(cpf) })
      .eq('id', userId);
    if (error) console.error('[salvarCpfDoUsuario]', error.message);
  } catch (e) {
    console.error('[salvarCpfDoUsuario] exception:', e);
  }
}

// ─────────────────────────────────────────────────────────────
// Navegação entre etapas
// ─────────────────────────────────────────────────────────────

function _mostrarEtapa(etapa) {
  ['renov-planos', 'renov-cpf', 'renov-qr'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = (id === etapa) ? '' : 'none';
  });
}

function voltarParaPlanos() {
  if (window._renovPollingId) clearInterval(window._renovPollingId);
  _mostrarEtapa('renov-planos');
}

// ─────────────────────────────────────────────────────────────
// FUNÇÃO PRINCIPAL — substitui sua selecionarPlano() atual
// ─────────────────────────────────────────────────────────────

async function selecionarPlano(idx) {
  const plano = _PIX_PLANOS[idx];
  window._renovPlanoSel = plano;
  _renovPlanoSel = plano;
  window._renovPollingId = null;

  // 1. Verifica se o usuário já tem CPF no Supabase
  const cpfSalvo = await buscarCpfDoUsuario(session.id);

  if (cpfSalvo && cpfValido(cpfSalvo)) {
    // Já tem CPF → vai direto pro fluxo original de cobrança
    return _gerarCobrancaComCpf(plano, cpfSalvo);
  }

  // 2. Não tem CPF → mostra etapa de coleta
  document.getElementById('renov-cpf-titulo').textContent =
    `PIX — ${plano.label} · R$ ${plano.valor.toFixed(2).replace('.', ',')}`;
  const inputCpf = document.getElementById('renov-cpf-input');
  inputCpf.value = '';
  document.getElementById('renov-cpf-erro').style.display = 'none';
  const btn = document.getElementById('renov-cpf-continuar');
  btn.disabled = false;
  btn.textContent = 'Continuar para o pagamento';

  _mostrarEtapa('renov-cpf');
  setTimeout(() => inputCpf.focus(), 100);
}

// ─────────────────────────────────────────────────────────────
// Usuário preencheu o CPF e clicou em "Continuar"
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

  // Salva no Supabase em background (não bloqueia o pagamento se falhar)
  if (salvarChk && salvarChk.checked) {
    salvarCpfDoUsuario(session.id, cpf);
  }

  // Continua para gerar a cobrança
  await _gerarCobrancaComCpf(_renovPlanoSel, cpf);
}

// ─────────────────────────────────────────────────────────────
// Gera cobrança (lógica original preservada + envio de CPF)
// ─────────────────────────────────────────────────────────────

async function _gerarCobrancaComCpf(plano, cpf) {
  // Mostra tela de carregamento
  const qrDiv = document.getElementById('renov-qr-canvas');
  qrDiv.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--n3)"><div style="font-size:2.5rem;margin-bottom:.75rem">⏳</div><div style="font-weight:600">Gerando cobrança PIX...</div><div style="font-size:12px;margin-top:.35rem">Aguarde um instante</div></div>';
  _mostrarEtapa('renov-qr');
  document.getElementById('renov-qr-titulo').textContent =
    `PIX — ${plano.label} · R$ ${plano.valor.toFixed(2).replace('.', ',')}`;

  const avisarBtn = document.getElementById('renov-avisar-btn');
  if (avisarBtn) avisarBtn.style.display = 'none';
  const aguardando = document.getElementById('renov-aguardando');
  if (aguardando) aguardando.style.display = 'none';
  const statusAreaInit = document.getElementById('renov-status-area');
  if (statusAreaInit) statusAreaInit.innerHTML = '';

  try {
    const resp = await fetch('/api/criar-cobranca', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId:     session.id,
        userName:   session.nome,
        userEmail:  session.email || null,
        userCpf:    cpf,                    // ⭐ NOVO
        planoLabel: plano.label,
        planoValor: plano.valor,
        planoDias:  plano.dias,
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      console.warn('[Asaas] API falhou, usando PIX estático:', err);
      _selecionarPlanoFallback(plano, qrDiv);
      return;
    }

    const data = await resp.json();
    window._renovPaymentId = data.paymentId;

    // Mostra QR Code retornado pelo Asaas
    document.getElementById('renov-pix-code').value = data.pixCode || '';
    if (data.qrCodeImage) {
      qrDiv.innerHTML = `<img src="data:image/png;base64,${data.qrCodeImage}" style="width:200px;height:200px;border-radius:8px"/>`;
    } else if (data.pixCode) {
      qrDiv.innerHTML = '';
      const _rQR = () => new QRCode(qrDiv, { text: data.pixCode, width: 200, height: 200, colorDark: '#111827', colorLight: '#ffffff' });
      if (typeof QRCode === 'undefined') {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
        s.onload = _rQR;
        document.head.appendChild(s);
      } else _rQR();
    }

    // Mostra indicador grande "Aguardando confirmação do pagamento..."
    if (aguardando) aguardando.style.display = 'flex';

    // Polling
    _iniciarPollingPagamento(data.paymentId, plano);

  } catch (err) {
    console.error('[Asaas] Erro ao criar cobrança:', err);
    _selecionarPlanoFallback(plano, qrDiv);
  }

  _salvarRenovacaoBackground(plano);
}

// Fallback: usa PIX estático gerado localmente (sem Asaas)
function _selecionarPlanoFallback(plano,qrDiv){
  const pixCode=gerarPixEMV(_PIX_KEY,_PIX_NAME,_PIX_CITY,plano.valor,'GEPainel');
  document.getElementById('renov-pix-code').value=pixCode;
  qrDiv.innerHTML='';
  const _rQR=()=>new QRCode(qrDiv,{text:pixCode,width:200,height:200,colorDark:'#111827',colorLight:'#ffffff'});
  if(typeof QRCode==='undefined'){const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';s.onload=_rQR;s.onerror=()=>{qrDiv.innerHTML='<div style="font-size:11px;word-break:break-all;padding:.5rem;color:var(--n3)">'+pixCode+'</div>';};document.head.appendChild(s);}
  else _rQR();
  // Modo fallback: webhook não vai confirmar, então mostra o botão "Já paguei"
  const aguardando=document.getElementById('renov-aguardando');
  if(aguardando)aguardando.style.display='none';
  const avisarBtn=document.getElementById('renov-avisar-btn');
  if(avisarBtn)avisarBtn.style.display='';
}

// Polling a cada 4s verificando se expires_at foi atualizado pelo webhook
function _iniciarPollingPagamento(paymentId,plano){
  if(window._renovPollingId)clearInterval(window._renovPollingId);
  const expiresAntes=session.expires_at;
  let tentativas=0;
  const MAX=90; // 6 minutos (90 x 4s)
  window._renovPollingId=setInterval(async()=>{
    // Pausa polling se aba não está visível (economiza recursos)
    if(document.hidden)return;
    
    tentativas++;
    if(tentativas>MAX){
      clearInterval(window._renovPollingId);
      const aguardando=document.getElementById('renov-aguardando');
      if(aguardando)aguardando.style.display='none';
      const s=document.getElementById('renov-status-area');
      if(s)s.innerHTML='<div style="font-size:12px;color:var(--amb);background:#FFF7ED;border:1px solid #FDE68A;border-radius:999px;padding:.35rem .85rem;display:inline-block">Tempo esgotado — se pagou, aguarde a confirmação manual.</div>';
      const avisarBtn=document.getElementById('renov-avisar-btn');
      if(avisarBtn)avisarBtn.style.display='';
      return;
    }
    try{
      const{data}=await sb.from('users').select('expires_at,plan_type').eq('id',session.id).single();
      if(data&&data.expires_at!==expiresAntes){
        // Pagamento confirmado pelo webhook!
        clearInterval(window._renovPollingId);
        session.expires_at=data.expires_at;
        session.plan_type=data.plan_type;
        saveSession(session);
        closeM('renov-modal');
        // Atualiza badge imediatamente
        const nb=document.getElementById('nav-role');
        const dias=Math.ceil((new Date(data.expires_at)-new Date())/(1000*60*60*24));
        const pl=getUserPlan(data.plan_type)||_inferPlanByDias(dias);
        if(nb&&pl){nb.textContent=`${pl.name} · ${dias}d`;nb.className=`nav-badge ${pl.badge}`;}
        toast(`🎉 Pagamento confirmado! Acesso renovado: ${pl?.name||plano.label}`);
        setTimeout(()=>renderDashboard(),800);
      }
    }catch(e){}
  },4000);
}

async function _salvarRenovacaoBackground(plano){
  const payload={
    user_id:session.id,
    plan_type:plano.label,
    amount:plano.valor,
    dias:plano.dias,
    status:'pending'
  };
  let res=await sb.from('renewals').insert([payload]);
  if(res.error){
    // Tenta sem coluna 'dias' (coluna pode não existir)
    const{dias:_,...payload2}=payload;
    res=await sb.from('renewals').insert([payload2]);
    if(res.error){
      console.warn('renewals insert falhou:',res.error.message);
      // Fallback: salva na tabela renovacoes legada
      await sb.from('renovacoes').insert([{
        user_id:session.id,
        user_nome:session.nome,
        user_login:session.login,
        plano:plano.label,
        dias:plano.dias,
        valor:plano.valor,
        status:'pendente'
      }]).catch(e=>console.warn('renovacoes fallback falhou:',e));
    }
  }
}

async function salvarPreferenciaRenovacao(diasPlano, autoRenewal){
  try{
    const {error}=await supabase.from('users').update({
      auto_renewal: autoRenewal,
      auto_renewal_plan: diasPlano
    }).eq('id',session.id);
    
    if(error)throw error;
    
    // Atualiza sessão local
    session.auto_renewal=autoRenewal;
    session.auto_renewal_plan=diasPlano;
    
    if(autoRenewal){
      toast(`✅ Renovação automática ATIVADA (${diasPlano} dias)`);
    }
  }catch(err){
    console.error('Erro ao salvar preferência:',err);
  }
}

// Verificação automática removida - sistema manual
/*
// Verifica status do pagamento a cada 3 segundos
let verificacaoInterval=null;
function iniciarVerificacaoPagamento(paymentId){
  // Limpa intervalo anterior se existir
  if(verificacaoInterval)clearInterval(verificacaoInterval);
  
  let tentativas=0;
  const maxTentativas=100; // 5 minutos (100 x 3s)
  
  verificacaoInterval=setInterval(async()=>{
    tentativas++;
    
    // Para após 5 minutos
    if(tentativas>=maxTentativas){
      clearInterval(verificacaoInterval);
      return;
    }
    
    try{
      // Busca status da transação no banco
      const {data,error}=await supabase
        .from('pix_transactions')
        .select('status')
        .eq('payment_id',paymentId)
        .single();
      
      if(error)return;
      
      if(data.status==='approved'){
        clearInterval(verificacaoInterval);
        
        // PAGAMENTO APROVADO!
        closeM('renov-modal');
        toast('🎉 Pagamento aprovado! Seu acesso foi renovado!');
        
        // Recarrega dados do usuário
        setTimeout(()=>location.reload(),2000);
      }
    }catch(err){
      console.error('Erro ao verificar pagamento:',err);
    }
  },3000); // Verifica a cada 3 segundos
}
*/

function copiarPix(){
  const code=document.getElementById('renov-pix-code')?.value;
  if(!code)return;
  navigator.clipboard.writeText(code).then(()=>toast('✓ Código PIX copiado!')).catch(()=>{
    document.getElementById('renov-pix-code').select();document.execCommand('copy');toast('✓ Copiado!');
  });
}

async function avisarPagamento(){
  const plano=window._renovPlanoSel;
  if(!plano)return;

  const btn=document.querySelector('#renov-modal .btn-grn');
  if(btn){btn.textContent='Registrando...';btn.disabled=true;}

  // Registra solicitação no Supabase
  try{
    await sb.from('renovacoes').insert({
      user_id:session.id,
      user_nome:session.nome,
      user_login:session.login,
      plano:plano.label,
      dias:plano.dias,
      valor:plano.valor,
      status:'pendente'
    });
  }catch(e){console.warn('Erro ao registrar renovacao',e);}

  // Envia WhatsApp
  const msg=`Olá! Acabei de realizar o pagamento via PIX para renovação do GEPainel.%0A%0A👤 Usuário: ${session.nome}%0A📋 Login: @${session.login}%0A📅 Plano: ${plano.label}%0A💰 Valor: R$ ${plano.valor.toFixed(2).replace('.',',')}%0A%0AAguardo a liberação do acesso. Obrigado!`;
  const tel='5591985919201';
  window.open('https://wa.me/'+tel+'?text='+msg,'_blank');

  if(btn){btn.textContent='✓ Solicitação enviada!';btn.style.background='#166534';}
  toast('✓ Solicitação registrada! Aguarde a confirmação do admin.');
  setTimeout(()=>closeM('renov-modal'),2500);
}



async function verificarRenovacoesPendentes(){
  try{
    const{data}=await sb.from('renovacoes').select('id').eq('status','pendente');
    if(data&&data.length>0){
      const siUsr=document.getElementById('si-usuarios');
      if(siUsr&&!siUsr.querySelector('.renov-badge')){
        const badge=document.createElement('span');
        badge.className='renov-badge';
        badge.textContent=data.length;
        badge.style.cssText='background:#DC2626;color:#fff;font-size:10px;font-weight:700;padding:1px 5px;border-radius:999px;margin-left:auto';
        siUsr.appendChild(badge);
      }
    }
  }catch(e){}
}

