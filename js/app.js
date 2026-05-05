
// ══ SESSÃO ══
const TIMEOUT_MS=10*60*1000;
let session=null, _lastActivity=Date.now();

function saveSession(s){try{localStorage.setItem('ep_s',JSON.stringify(s));document.cookie='ep_s='+encodeURIComponent(JSON.stringify(s))+';path=/;max-age='+(30*24*3600)+';SameSite=Lax';}catch(e){}}
function clearSession(){try{localStorage.removeItem('ep_s');}catch(e){}try{document.cookie='ep_s=;path=/;max-age=0';}catch(e){}}
function readSession(){
  try{const v=localStorage.getItem('ep_s');if(v){const p=JSON.parse(v);if(p&&p.id)return p;}}catch(e){}
  try{const m=document.cookie.match(/(?:^|;\s*)ep_s=([^;]*)/);if(m&&m[1]){const p=JSON.parse(decodeURIComponent(m[1]));if(p&&p.id)return p;}}catch(e){}
  return null;
}

// ══ STATE ══
let tomadores=[],emprestimos=[],parcelas=[],users=[];
let editEmp=null,editTom=null,editUsr=null,curPage='dashboard';

// ══ HELPERS ══
function hp(s){let h=0;for(let i=0;i<s.length;i++){h=(Math.imul(31,h)+s.charCodeAt(i))|0}return h.toString(36);}
const ini=n=>(n||'?').split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase();
const fmtDate=d=>d?new Date(d+'T12:00:00').toLocaleDateString('pt-BR'):'—';
const today=()=>new Date().toISOString().split('T')[0];
const fmtR=v=>v!=null?'R$ '+Number(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';
const can=p=>{if(!session)return false;if(session.role==='admin')return true;return['dashboard','emprestimos','tomadores','simulador','perfil','relatorio'].includes(p);};
const AV_STYLE={admin:'background:#FDE68A;color:#78350F',op:'background:#FFF7ED;color:#EA580C'};
const isAtrasada=v=>v&&v.status==='pendente'&&new Date(v.vencimento+'T12:00:00')<new Date();

function maskCurrency(el){
  let v=el.value.replace(/[^\d]/g,'');
  if(!v){el.value='';return;}
  const num=parseInt(v,10)/100;
  el.value=num.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
}

function parseCurrency(s){
  if(!s)return 0;
  // handles "1.234,56" or "1234.56" or "1234"
  const clean=String(s).replace(/\./g,'').replace(',','.');
  return parseFloat(clean)||0;
}

function maskTel(el){let v=el.value.replace(/[^\d]/g,'');if(v.length>0)v='('+v;if(v.length>3)v=v.slice(0,3)+') '+v.slice(3);if(v.length>10)v=v.slice(0,10)+'-'+v.slice(10);el.value=v.slice(0,15);}
function toast(msg,err=false){const t=document.createElement('div');t.className='toast';t.textContent=msg;t.style.background=err?'#991B1B':'#9A3412';document.body.appendChild(t);setTimeout(()=>t.remove(),2800);}
function openM(id){document.getElementById(id).style.display='flex';}
function closeM(id){document.getElementById(id).style.display='none';}

// ══ BOTTOM NAV ══
function toggleBottomNav(on){
  const prev=localStorage.getItem('ep_bottom_nav')==='1';
  const ativo=on!==undefined?on:!prev;
  localStorage.setItem('ep_bottom_nav',ativo?'1':'0');
  if(ativo){document.body.classList.add('bottom-nav-mode');}
  else{document.body.classList.remove('bottom-nav-mode');}
  renderBottomNav();
  // Atualiza toggle no perfil se estiver aberto
  const tog=document.getElementById('bottom-nav-toggle');
  const knob=document.getElementById('bottom-nav-knob');
  const lbl=document.getElementById('bottom-nav-lbl');
  if(tog)tog.style.background=ativo?'#EA580C':'#D1D5DB';
  if(knob)knob.style.left=ativo?'22px':'2px';
  if(lbl)lbl.textContent=ativo?'Ativo':'Inativo';
}

function loadBottomNavPref(){
  if(localStorage.getItem('ep_bottom_nav')==='1'){
    document.body.classList.add('bottom-nav-mode');
    renderBottomNav();
  }
}

function renderBottomNav(){
  const items=document.getElementById('bottom-nav-items');
  if(!items)return;
  const tabs=[
    {id:'dashboard',icon:'dashboard',label:'Início'},
    {id:'emprestimos',icon:'emprestimos',label:'Emprest.'},
    {id:'tomadores',icon:'tomadores',label:'Clientes'},
    {id:'relatorio',icon:'relatorio',label:'Relatório'},
    {id:'perfil',icon:'perfil',label:'Perfil'},
  ];
  const visibles=tabs.filter(t=>can(t.id));
  items.innerHTML=visibles.map(t=>`
    <button class="bnav-item${curPage===t.id?' active':''}" onclick="showPage('${t.id}')" id="bnav-${t.id}">
      ${LUCIDE_ICONS[t.icon]||''}
      <span>${t.label}</span>
    </button>`).join('')+`
    <button class="bnav-item" onclick="doLogout()" title="Sair">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
      <span>Sair</span>
    </button>`;
}

// ══ CALCULADORA ══
let _calcVal='0',_calcOp=null,_calcPrev=null,_calcNewNum=true;
function calcRenderBtns(){
  const g=document.getElementById('calc-btns');if(!g||g.children.length>0)return;
  const keys=['C','±','%','÷','7','8','9','×','4','5','6','−','1','2','3','+','0','.',',','='];
  keys.forEach(k=>{
    const isOp=['÷','×','−','+','='].includes(k),isClear=k==='C';
    const bg=isOp?'var(--grn0)':isClear?'var(--red0)':'var(--card2)';
    const color=isOp?'var(--grn)':isClear?'var(--red)':'var(--n1)';
    const btn=document.createElement('button');
    if(k==='0')btn.style.gridColumn='span 2';
    btn.style.cssText='padding:.6rem;background:'+bg+';border:1px solid var(--border);border-radius:var(--rs);cursor:pointer;color:'+color+';font-size:13px;font-weight:700;transition:all .1s';
    btn.textContent=k;
    btn.onclick=()=>calcPress(k);
    btn.onmouseover=()=>btn.style.opacity='.75';
    btn.onmouseout=()=>btn.style.opacity='1';
    g.appendChild(btn);
  });
}
function toggleCalcSidebar(){const c=document.getElementById('calc-popup');const cal=document.getElementById('cal-popup');if(cal)cal.style.display='none';if(c){c.style.display=c.style.display==='none'?'block':'none';if(c.style.display==='block')calcRenderBtns();}}
function toggleCalSidebar(){const c=document.getElementById('cal-popup');const calc=document.getElementById('calc-popup');if(calc)calc.style.display='none';if(c){c.style.display=c.style.display==='none'?'block':'none';if(c.style.display==='block')renderCal();}}
function calcPress(k){
  const disp=document.getElementById('calc-display');const expr=document.getElementById('calc-expr');if(!disp)return;
  if(k==='C'){_calcVal='0';_calcOp=null;_calcPrev=null;_calcNewNum=true;if(expr)expr.textContent='';}
  else if(k==='±'){_calcVal=String(-parseFloat(_calcVal||0));}
  else if(k==='%'){_calcVal=String(parseFloat(_calcVal||0)/100);}
  else if(['÷','×','−','+'].includes(k)){_calcPrev=parseFloat(_calcVal);_calcOp=k;_calcNewNum=true;if(expr)expr.textContent=_calcVal+' '+k;}
  else if(k==='='){
    if(_calcOp&&_calcPrev!==null){const b=parseFloat(_calcVal);let r;if(_calcOp==='÷')r=_calcPrev/b;else if(_calcOp==='×')r=_calcPrev*b;else if(_calcOp==='−')r=_calcPrev-b;else r=_calcPrev+b;
    if(expr)expr.textContent=_calcPrev+' '+_calcOp+' '+b+' =';_calcVal=String(parseFloat(r.toFixed(10)));_calcOp=null;_calcPrev=null;_calcNewNum=true;}
  }
  else if(k===','||k==='.'){if(_calcNewNum){_calcVal='0.';_calcNewNum=false;}else if(!_calcVal.includes('.'))_calcVal+='.';}
  else{if(_calcNewNum){_calcVal=k;_calcNewNum=false;}else _calcVal=_calcVal==='0'?k:_calcVal+k;}
  const n=parseFloat(_calcVal);disp.textContent=isNaN(n)?_calcVal:n.toLocaleString('pt-BR',{maximumFractionDigits:10});
}
// ══ CALENDÁRIO ══
let _calY=new Date().getFullYear(),_calM=new Date().getMonth();
function calNav(d){_calM+=d;if(_calM>11){_calM=0;_calY++;}else if(_calM<0){_calM=11;_calY--;}renderCal();}
function renderCal(){
  const t=document.getElementById('cal-title');const g=document.getElementById('cal-grid');if(!t||!g)return;
  const mn=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];t.textContent=mn[_calM]+' '+_calY;
  const hoje=new Date();const pD=new Date(_calY,_calM,1).getDay();const dM=new Date(_calY,_calM+1,0).getDate();
  let html=['D','S','T','Q','Q','S','S'].map(d=>`<div style="font-size:9px;font-weight:700;color:var(--n4);padding:2px">${d}</div>`).join('');
  for(let i=0;i<pD;i++)html+=`<div></div>`;
  for(let d=1;d<=dM;d++){const isH=d===hoje.getDate()&&_calM===hoje.getMonth()&&_calY===hoje.getFullYear();html+=`<div style="font-size:11px;padding:3px;border-radius:50%;cursor:default;text-align:center;${isH?'background:var(--grn);color:#0D0B1E;font-weight:700;':'color:var(--n2);'}">${d}</div>`;}
  g.innerHTML=html;
}

// ══ INDICAÇÃO ══
function gerarCodigoIndicacao(userId){return 'GE'+userId.substring(0,6).toUpperCase();}
async function abrirIndicacao(){
  const cod=gerarCodigoIndicacao(session.id);
  const el=document.getElementById('cod-indicacao');if(el)el.textContent=cod;
  const st=document.getElementById('indicacao-status');
  if(st){
    st.innerHTML='<div style="background:rgba(108,159,255,.08);border:1px solid rgba(108,159,255,.2);border-radius:var(--rs);padding:.65rem;font-size:12px;color:var(--n3)">⏳ Verificando indicações...</div>';
  }
  openM('indicacao-modal');
  // Busca quantos amigos foram indicados por este usuário
  try{
    const{data:indicados,error}=await sb.from('users').select('id,nome,created_at').eq('indicado_por',session.id).order('created_at',{ascending:false});
    if(st){
      if(error){
        // Coluna pode não existir ainda — fallback simples
        const usou=localStorage.getItem('ep_bonus_indicacao_usado');
        st.innerHTML=usou?'<div style="background:rgba(0,200,150,.08);border:1px solid rgba(0,200,150,.2);border-radius:var(--rs);padding:.65rem;font-size:12px;color:var(--grn)">✓ Bônus de indicação já utilizado.</div>':'<div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:var(--rs);padding:.65rem;font-size:12px;color:var(--amb)">○ Aguardando seu primeiro indicado.</div>';
      } else if(!indicados||indicados.length===0){
        st.innerHTML='<div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:var(--rs);padding:.65rem;font-size:12px;color:var(--amb)">○ Aguardando seu primeiro indicado.</div>';
      } else {
        const n=indicados.length;
        const dias=n*30;
        const lista=indicados.slice(0,3).map(u=>`<div style="font-size:11px;color:var(--n3);margin-top:4px">• ${u.nome||'Usuário'}</div>`).join('');
        const mais=n>3?`<div style="font-size:11px;color:var(--n4);margin-top:4px">e mais ${n-3}...</div>`:'';
        st.innerHTML=`<div style="background:rgba(0,200,150,.08);border:1px solid rgba(0,200,150,.25);border-radius:var(--rs);padding:.75rem;font-size:12px;color:var(--grn)"><div style="font-weight:700;margin-bottom:4px">✓ ${n} ${n===1?'amigo indicado':'amigos indicados'} · +${dias} dias ganhos</div>${lista}${mais}</div>`;
      }
    }
  }catch(e){
    if(st)st.innerHTML='<div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:var(--rs);padding:.65rem;font-size:12px;color:var(--amb)">○ Não foi possível verificar agora.</div>';
  }
}
function copiarCodigoIndicacao(){const cod=gerarCodigoIndicacao(session.id);navigator.clipboard.writeText(cod).then(()=>toast('✓ Código copiado!')).catch(()=>toast('Código: '+cod));}
function compartilharIndicacao(){const cod=gerarCodigoIndicacao(session.id);const url='https://gepainel.vercel.app';const msg=`Olá! Estou usando o *GEPainel* para gerenciar empréstimos! 🚀%0A%0ACadastre-se com meu código e ganhe 30 dias grátis:%0A*Código:* ${cod}%0A*Link:* ${url}`;window.open('https://wa.me/?text='+msg,'_blank');}
async function verificarCodigoIndicacao(cod){
  if(!cod||cod.length<8)return;
  const{data:allUsers}=await sb.from('users').select('id,nome,expires_at').limit(200);
  if(!allUsers)return;
  const indicador=allUsers.find(u=>gerarCodigoIndicacao(u.id)===cod&&u.id!==session.id);
  if(!indicador)return;
  
  // Acumula 30 dias: se já tem tempo futuro, soma a partir dessa data; senão, soma a partir de hoje
  const base=indicador.expires_at&&new Date(indicador.expires_at)>new Date()?new Date(indicador.expires_at):new Date();
  base.setDate(base.getDate()+30);
  
  // Atualiza expires_at do indicador (bônus)
  await sb.from('users').update({expires_at:base.toISOString().split('T')[0]}).eq('id',indicador.id);
  
  // Grava relacionamento indicado_por no novo usuário (se a coluna existir)
  try{
    await sb.from('users').update({indicado_por:indicador.id}).eq('id',session.id);
  }catch(e){console.warn('[INDICACAO] Coluna indicado_por não existe ainda:',e);}
  
  // Mantém localStorage como fallback
  localStorage.setItem('ep_bonus_dado_'+indicador.id,'1');
  toast('🎁 Código válido! Seu amigo ganhou 30 dias extras!');
}

// ══ ESQUECI MINHA SENHA ══
function openEsqueciSenha(){
  document.getElementById('esqueci-senha-modal').style.display='flex';
  document.getElementById('esqueci-input').value='';
  document.getElementById('esqueci-error').style.display='none';
  setTimeout(()=>document.getElementById('esqueci-input').focus(),100);
}

function closeEsqueciSenha(){
  document.getElementById('esqueci-senha-modal').style.display='none';
}

function showEsqueciErr(msg){
  const el=document.getElementById('esqueci-error');
  el.textContent=msg;
  el.style.display='block';
}

async function enviarRecuperacaoSenha(){
  const input=document.getElementById('esqueci-input').value.trim().toLowerCase();
  document.getElementById('esqueci-error').style.display='none';
  
  if(!input){showEsqueciErr('Informe seu login ou e-mail.');return;}
  
  const btn=document.getElementById('esqueci-btn');
  btn.textContent='Enviando...';
  btn.disabled=true;
  
  try{
    // Chama API serverless (mais seguro - API Key não fica exposta)
    const response=await fetch('/api/recuperar-senha',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({login:input})
    });
    
    const data=await response.json();
    
    if(!response.ok){
      showEsqueciErr(data.error||'Erro ao processar solicitação.');
      btn.textContent='Enviar →';
      btn.disabled=false;
      return;
    }
    
    toast('✓ '+data.message);
    closeEsqueciSenha();
    btn.textContent='Enviar →';
    btn.disabled=false;
    
  }catch(e){
    console.error('Erro:',e);
    showEsqueciErr('Erro ao processar solicitação.');
    btn.textContent='Enviar →';
    btn.disabled=false;
  }
}

// ══ SIDEBAR ══
function toggleSidebar(){document.getElementById('sidebarEl').classList.toggle('open');document.getElementById('sb-overlay').classList.toggle('open');}
function closeSidebar(){document.getElementById('sidebarEl').classList.remove('open');document.getElementById('sb-overlay').classList.remove('open');}

const LUCIDE_ICONS={
  dashboard:'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
  emprestimos:'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',
  tomadores:'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  simulador:'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="12" y1="10" x2="14" y2="10"/><line x1="16" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="12" y1="14" x2="14" y2="14"/><line x1="16" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="10" y2="18"/><line x1="12" y1="18" x2="14" y2="18"/><line x1="16" y1="18" x2="16" y2="18"/></svg>',
  perfil:'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  usuarios:'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  relatorio:'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
};

function buildSidebar(){
  const tabs=[
    {id:'dashboard',icon:'dashboard',label:'Dashboard'},
    {id:'emprestimos',icon:'emprestimos',label:'Empréstimos'},
    {id:'tomadores',icon:'tomadores',label:'Clientes'},
    {id:'simulador',icon:'simulador',label:'Simulador'},
    {id:'relatorio',icon:'relatorio',label:'Relatório'},
    {id:'perfil',icon:'perfil',label:'Meu Perfil'},
    {id:'usuarios',icon:'usuarios',label:'Usuários',admin:true},
  ];
  document.getElementById('sidebarEl').innerHTML=
    `<div class="sidebar-section">Menu</div>`+
    tabs.filter(t=>can(t.id)||(t.admin&&session.role==='admin')).map(t=>
      `<button class="sidebar-item${curPage===t.id?' active':''}" id="si-${t.id}" onclick="showPage('${t.id}')">
        ${LUCIDE_ICONS[t.icon]||''}${t.label}
      </button>`
    ).join('')+
    `<div style="padding:.5rem .75rem 0">
      <button onclick="doLogout()" style="width:100%;padding:.65rem 1rem;background:transparent;border:1px solid var(--sid-border, #374151);border-radius:var(--rs);color:#9CA3AF;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:.6rem;transition:all .15s" onmouseover="this.style.background='#FEF2F2';this.style.color='#DC2626';this.style.borderColor='#FECACA'" onmouseout="this.style.background='transparent';this.style.color='#9CA3AF';this.style.borderColor='#374151'">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        Sair
      </button>
    </div>`+
    `<div style="border-top:1px solid #374151;margin:.75rem .75rem 0"></div>`+
    `<div style="padding:.5rem .75rem">
      <div style="display:flex;gap:.4rem;margin-bottom:.5rem">
        <button onclick="toggleCalcSidebar()" style="flex:1;padding:.5rem;background:var(--card2);border:1px solid var(--border);border-radius:var(--rs);cursor:pointer;color:var(--n3);display:flex;align-items:center;justify-content:center;gap:.3rem;font-size:11px;font-weight:600;transition:all .15s" onmouseover="this.style.borderColor='var(--grn)';this.style.color='var(--grn)'" onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--n3)'">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="12" y1="10" x2="14" y2="10"/><line x1="16" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="12" y1="14" x2="14" y2="14"/></svg>
          Calc
        </button>
        <button onclick="toggleCalSidebar()" style="flex:1;padding:.5rem;background:var(--card2);border:1px solid var(--border);border-radius:var(--rs);cursor:pointer;color:var(--n3);display:flex;align-items:center;justify-content:center;gap:.3rem;font-size:11px;font-weight:600;transition:all .15s" onmouseover="this.style.borderColor='var(--grn)';this.style.color='var(--grn)'" onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--n3)'">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Cal
        </button>
      </div>
      <div id="calc-popup" style="display:none;background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:.75rem;margin-bottom:.5rem">
        <div id="calc-display" style="background:var(--card2);border-radius:var(--rs);padding:.65rem .85rem;text-align:right;font-family:var(--FT);font-size:1.4rem;color:var(--grn);margin-bottom:.5rem;min-height:52px;word-break:break-all;border:1px solid var(--border)">0</div>
        <div id="calc-expr" style="text-align:right;font-size:10px;color:var(--n4);margin-bottom:.5rem;min-height:14px"></div>
        <div id="calc-btns" style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px"></div>
      </div>
      <div id="cal-popup" style="display:none;background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:.75rem;margin-bottom:.5rem">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.6rem">
          <button onclick="calNav(-1)" style="background:var(--card2);border:1px solid var(--border);border-radius:var(--rs);cursor:pointer;color:var(--n1);padding:.3rem .75rem;font-size:18px;font-weight:700;line-height:1;transition:all .15s;min-width:36px" onmouseover="this.style.borderColor='var(--grn)';this.style.color='var(--grn)'" onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--n1)'">‹</button>
          <span id="cal-title" style="font-size:12px;font-weight:700;color:var(--n1)"></span>
          <button onclick="calNav(1)" style="background:var(--card2);border:1px solid var(--border);border-radius:var(--rs);cursor:pointer;color:var(--n1);padding:.3rem .75rem;font-size:18px;font-weight:700;line-height:1;transition:all .15s;min-width:36px" onmouseover="this.style.borderColor='var(--grn)';this.style.color='var(--grn)'" onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--n1)'">›</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center" id="cal-grid"></div>
      </div>
    </div>
    <div class="sidebar-footer">GEPainel v1.0<br><span style="color:var(--n4)">Desenvolvido por Eduardo Ribeiro</span></div>`
}

function showPage(p){
  curPage=p;closeSidebar();renderBottomNav();
  document.querySelectorAll('.sidebar-item').forEach(e=>e.classList.remove('active'));
  const si=document.getElementById('si-'+p);if(si)si.classList.add('active');
  if(p==='dashboard')renderDashboard();
  else if(p==='emprestimos')renderEmprestimos();
  else if(p==='tomadores')renderTomadores();
  else if(p==='simulador')renderSimulador();
  else if(p==='perfil')renderPerfil();
  else if(p==='renovacoes')renderRenovacoes();
  else if(p==='usuarios')renderUsuarios();
  else if(p==='relatorio')renderRelatorio();
}

function togglePwd(inputId, btn){
  const inp=document.getElementById(inputId);
  if(!inp)return;
  const show=inp.type==='password';
  inp.type=show?'text':'password';
  const eyeOff='<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  const eyeOn='<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  btn.innerHTML=show?eyeOff:eyeOn;
  btn.style.color=show?'var(--grn)':'var(--n3)';
}

async function sbWithRetry(fn, tentativas=3, delay=1500){
  for(let i=0;i<tentativas;i++){
    try{
      const r=await Promise.race([fn(),new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),8000))]);
      return r;
    }catch(e){
      if(i===tentativas-1)throw e;
      await new Promise(r=>setTimeout(r,delay*(i+1)));
    }
  }
}

// ══ AUTH ══
function showRegister(){document.getElementById('login-panel').style.display='none';document.getElementById('register-panel').style.display='block';document.getElementById('reg-error').style.display='none';}
function showLogin(){document.getElementById('register-panel').style.display='none';document.getElementById('login-panel').style.display='block';document.getElementById('login-error').style.display='none';}
function showErr(msg){const e=document.getElementById('login-error');e.textContent=msg;e.style.display='block';}
function showRegErr(msg){const e=document.getElementById('reg-error');e.textContent=msg;e.style.display='block';}

// ── LEMBRAR ACESSO ──
let _remember=false;
function toggleRemember(){
  _remember=!_remember;
  const tog=document.getElementById('remember-toggle');
  const knob=document.getElementById('remember-knob');
  const st=document.getElementById('remember-status');
  if(_remember){
    tog.style.background='#EA580C';
    knob.style.left='20px';
    st.textContent='Ativo';st.style.color='#EA580C';
  } else {
    tog.style.background='#D1D5DB';
    knob.style.left='2px';
    st.textContent='';
    // Ao desativar, limpa o que estava salvo
    try{localStorage.removeItem('ep_cred');}catch(e){}
  }
}
function loadSavedCreds(){
  try{
    const raw=localStorage.getItem('ep_cred');
    if(!raw)return;
    const c=JSON.parse(atob(raw));
    if(c&&c.l&&c.p){
      document.getElementById('lu').value=c.l;
      document.getElementById('lp').value=c.p;
      _remember=true;
      const tog=document.getElementById('remember-toggle');
      const knob=document.getElementById('remember-knob');
      const st=document.getElementById('remember-status');
      if(tog)tog.style.background='#EA580C';
      if(knob)knob.style.left='20px';
      if(st){st.textContent='Ativo';st.style.color='#EA580C';}
    }
  }catch(e){}
}

async function doLogin(){
  const login=document.getElementById('lu').value.trim().toLowerCase();
  const pass=document.getElementById('lp').value;
  if(!login||!pass){showErr('Preencha usuário e senha');return;}
  const btn=document.getElementById('login-btn');btn.textContent='Entrando...';btn.disabled=true;
  try{
    const{data,error}=await sb.from('users').select('*').eq('login',login).eq('pass_hash',hp(pass)).maybeSingle();
    btn.textContent='Entrar →';btn.disabled=false;
    if(error||!data){showErr('Usuário ou senha incorretos.');return;}
    if(data.ativo===false){showErr('Conta suspensa. Contate o administrador.');return;}
    if(data.role!=='admin'&&data.expires_at){
      const dias=Math.ceil((new Date(data.expires_at)-new Date())/(1000*60*60*24));
      if(dias<0){showErr('⛔ Seu acesso expirou. Contate o administrador.');return;}
      if(dias<=3){
        // avisa mas permite entrar
        setTimeout(()=>toast('⚠ Seu acesso expira em '+dias+' dia'+(dias!==1?'s':'')+'!',true),1500);
      }
    }
    // Salva ou limpa credenciais conforme toggle
    try{
      if(_remember){localStorage.setItem('ep_cred',btoa(JSON.stringify({l:login,p:pass})));}
      else{localStorage.removeItem('ep_cred');}
    }catch(e){}
    session=data;saveSession(session);await bootApp();
  }catch(e){btn.textContent='Entrar →';btn.disabled=false;showErr('Erro de conexão.');}
}

async function doRegister(){
  const nome=document.getElementById('reg-nome').value.trim();
  const login=document.getElementById('reg-login').value.trim().toLowerCase();
  const email=document.getElementById('reg-email').value.trim().toLowerCase();
  const pass=document.getElementById('reg-pass').value;
  const pass2=document.getElementById('reg-pass2').value;
  document.getElementById('reg-error').style.display='none';
  if(!nome){showRegErr('Informe seu nome.');return;}
  if(!login||login.length<3){showRegErr('Login deve ter ao menos 3 caracteres.');return;}
  if(!/^[a-z0-9._]+$/.test(login)){showRegErr('Login inválido. Use letras, números, ponto.');return;}
  if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){showRegErr('E-mail inválido.');return;}
  if(pass.length<4){showRegErr('Senha deve ter ao menos 4 caracteres.');return;}
  if(pass!==pass2){showRegErr('As senhas não coincidem.');return;}
  const btn=document.getElementById('register-btn');btn.textContent='Criando...';btn.disabled=true;
  try{
    const{data:ex}=await sb.from('users').select('id').eq('login',login).maybeSingle();
    if(ex){showRegErr('Login já em uso.');btn.textContent='Criar conta →';btn.disabled=false;return;}
    const{data:exEmail}=await sb.from('users').select('id').eq('email',email).maybeSingle();
    if(exEmail){showRegErr('E-mail já cadastrado.');btn.textContent='Criar conta →';btn.disabled=false;return;}
    const trialExp=new Date();trialExp.setDate(trialExp.getDate()+30);
    const trialExpStr=trialExp.toISOString().split('T')[0];
    // Cria conta com 30 dias de trial — SEM fallback que deixava vitalício
    const{data,error}=await sb.from('users').insert({nome,login,email,pass_hash:hp(pass),role:'op',ativo:true,expires_at:trialExpStr}).select().single();
    if(error||!data){
      console.error('[REGISTER] Erro ao criar conta:',error);
      showRegErr('Erro ao criar conta: '+(error?.message||'tente novamente'));
      btn.textContent='Criar conta →';btn.disabled=false;
      return;
    }
    // Garante que o objeto session local tem o trial mesmo se o banco não retornar
    if(!data.expires_at)data.expires_at=trialExpStr;
    session=data;saveSession(session);btn.textContent='Criar conta →';btn.disabled=false;
    const codInd=document.getElementById('reg-indicacao')?.value.trim().toUpperCase();
    if(codInd&&codInd.length>=8){await verificarCodigoIndicacao(codInd);}
    await bootApp();toast('✓ Bem-vindo(a), '+data.nome.split(' ')[0]+'! Você tem 30 dias grátis.');
  }catch(e){showRegErr('Erro de conexão.');btn.textContent='Criar conta →';btn.disabled=false;}
}

// ══ FUNÇÃO PARA DETERMINAR PLANO DO USUÁRIO ══
function getUserPlan(planType){
  const m={
    '30 dias':{name:'🥉 Bronze',badge:'badge-bronze'},
    '60 dias':{name:'🥈 Prata',badge:'badge-prata'},
    '90 dias':{name:'🥇 Ouro',badge:'badge-ouro'},
    '6 meses':{name:'💎 Platinum',badge:'badge-platinum'},
    '1 ano':{name:'💎 Diamante',badge:'badge-diamante'},
  };
  return m[planType]||null;
}
function _inferPlanByDias(dias){
  if(dias>=365)return{name:'💎 Diamante',badge:'badge-diamante'};
  if(dias>=180)return{name:'💎 Platinum',badge:'badge-platinum'};
  if(dias>=90) return{name:'🥇 Ouro',    badge:'badge-ouro'};
  if(dias>=60) return{name:'🥈 Prata',   badge:'badge-prata'};
  if(dias>=30) return{name:'🥉 Bronze',  badge:'badge-bronze'};
  return null;
}

function getPlanBadgeHTML(u){
  if(u.role==='admin')return`<span class="bdg bdg-admin">👑 Admin</span>`;
  const s={'badge-bronze':'background:linear-gradient(135deg,#CD7F32,#A0522D);color:#fff','badge-prata':'background:linear-gradient(135deg,#C0C0C0,#A8A8A8);color:#fff','badge-ouro':'background:linear-gradient(135deg,#FFD700,#DAA520);color:#111','badge-platinum':'background:linear-gradient(135deg,#E5E4E2,#B8B8B8);color:#1F2937;font-weight:800','badge-diamante':'background:linear-gradient(135deg,#60A5FA,#818CF8,#C084FC);color:#fff;box-shadow:0 0 6px rgba(129,140,248,.4)','badge-vitalicio':'background:linear-gradient(135deg,#059669,#10B981);color:#fff'};
  let pl=getUserPlan(u.plan_type);
  if(!pl&&u.expires_at){const d=Math.ceil((new Date(u.expires_at)-new Date())/(1000*60*60*24));pl=_inferPlanByDias(d);}
  if(!pl&&!u.expires_at)pl={name:'👑 Vitalício',badge:'badge-vitalicio'};
  if(pl)return`<span class="bdg" style="${s[pl.badge]||''};border-radius:999px;font-weight:700;font-size:11px;padding:2px 8px">${pl.name}</span>`;
  return`<span class="bdg bdg-op">Operador</span>`;
}

async function bootApp(){
  document.getElementById('login-page').style.display='none';
  document.getElementById('app-page').style.display='flex';
  try{
    const av=document.getElementById('nav-av');
    if(session.avatar_url){
      av.style.cssText='background:transparent;padding:0;overflow:hidden;';
      av.innerHTML=`<img src="${session.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`;
    } else {
      av.textContent=ini(session.nome);av.style.cssText=AV_STYLE[session.role]||AV_STYLE.op;
    }
    document.getElementById('nav-name').textContent=session.nome||'';
    const navBadge=document.getElementById('nav-role');
    if(session.role==='admin'){
      navBadge.textContent='Admin';
      navBadge.className='nav-badge badge-admin';
    } else if(session.expires_at){
      const diasNav=Math.ceil((new Date(session.expires_at)-new Date())/(1000*60*60*24));
      navBadge.style.cursor='pointer';
      navBadge.title='Clique para renovar acesso';
      navBadge.onclick=()=>abrirRenovacao();
      if(diasNav<0){
        navBadge.textContent='⛔ Expirado — Renovar';navBadge.className='nav-badge badge-expired';
      } else if(diasNav<=7){
        navBadge.textContent=`⚠ ${diasNav}d — Renovar`;navBadge.className='nav-badge badge-warn';
      } else {
        const pl=getUserPlan(session.plan_type)||_inferPlanByDias(diasNav);
        if(pl){navBadge.textContent=`${pl.name} · ${diasNav}d`;navBadge.className=`nav-badge ${pl.badge}`;}
        else{navBadge.textContent=`Ativo · ${diasNav}d`;navBadge.className='nav-badge badge-ativo';}
      }
    } else {
      const pl=getUserPlan(session.plan_type);
      if(pl){navBadge.textContent=pl.name;navBadge.className=`nav-badge ${pl.badge}`;}
      else{navBadge.textContent='👑 Vitalício';navBadge.className='nav-badge badge-vitalicio';}
    }
  }catch(e){}
  try{await loadAll();}catch(e){tomadores=[];emprestimos=[];parcelas=[];users=[];}
  buildSidebar();loadBottomNavPref();showPage('dashboard');
  if(_notifAtivo())iniciarVerificacaoAutomatica();
  if(session.role==='admin')verificarRenovacoesPendentes();
  
  // Aviso de boas-vindas (primeiro acesso)
  mostrarBoasVindas();
  
  // Aviso para adicionar e-mail (se não tiver)
  mostrarAvisoEmail();
}

// ══ AVISOS INICIAIS ══
function mostrarBoasVindas(){
  // Verifica se já mostrou boas-vindas antes
  const jaViu=localStorage.getItem('gepainel_boas_vindas');
  if(jaViu)return;
  
  // Marca como visto
  localStorage.setItem('gepainel_boas_vindas','1');
  
  // Aguarda 800ms para o app carregar
  setTimeout(()=>{
    const modal=document.createElement('div');
    modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;animation:fadeIn .3s';
    modal.innerHTML=`
      <div style="background:var(--card);border-radius:var(--r);max-width:480px;width:100%;box-shadow:var(--shm);overflow:hidden">
        <!-- Header -->
        <div style="background:linear-gradient(135deg,#22D3EE 0%,#818CF8 50%,#C084FC 100%);padding:1.75rem 1.5rem;text-align:center">
          <div style="font-size:3rem;margin-bottom:.5rem">👋</div>
          <div style="font-family:var(--FT);font-size:1.5rem;color:#fff;font-weight:700;margin-bottom:.25rem">Bem-vindo ao GEPainel!</div>
          <div style="font-size:13px;color:rgba(255,255,255,.9)">Sistema de gestão de empréstimos</div>
        </div>
        
        <!-- Conteúdo -->
        <div style="padding:1.75rem 1.5rem">
          <div style="font-size:14px;color:var(--n2);line-height:1.6;margin-bottom:1.25rem">
            <p style="margin:0 0 .75rem">Olá, <strong>${session.nome.split(' ')[0]}</strong>! 👋</p>
            <p style="margin:0 0 .75rem">Estamos felizes em ter você aqui. O GEPainel foi desenvolvido para facilitar a gestão dos seus empréstimos e clientes.</p>
            <p style="margin:0">Caso precise de ajuda ou tenha alguma dúvida, entre em contato:</p>
          </div>
          
          <!-- Contato de suporte -->
          <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:var(--rs);padding:1rem;margin-bottom:1.25rem">
            <div style="display:flex;align-items:center;gap:.75rem">
              <div style="width:40px;height:40px;background:#16A34A;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              </div>
              <div style="flex:1">
                <div style="font-size:11px;color:#166534;font-weight:600;text-transform:uppercase;letter-spacing:.03em;margin-bottom:2px">Suporte técnico</div>
                <a href="https://wa.me/5591985919201" target="_blank" style="font-size:16px;font-weight:700;color:#16A34A;text-decoration:none;font-family:var(--FM)">(91) 98591-9201</a>
              </div>
            </div>
          </div>
          
          <!-- Botão fechar -->
          <button onclick="this.closest('div[style*=fixed]').remove()" class="btn btn-full" style="background:linear-gradient(135deg,#818CF8 0%,#C084FC 100%);color:#fff;padding:.85rem;font-weight:600;font-size:15px;border:none">
            Entendi, vamos começar! →
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  },800);
}

function mostrarAvisoEmail(){
  // Só mostra se não tiver e-mail
  if(session.email)return;
  
  // Aguarda 2s (após boas-vindas)
  setTimeout(()=>{
    const banner=document.createElement('div');
    banner.id='aviso-email-banner';
    banner.style.cssText='position:fixed;top:60px;left:50%;transform:translateX(-50%);max-width:600px;width:calc(100% - 2rem);z-index:100;animation:slideDown .3s';
    banner.innerHTML=`
      <div style="background:#FEF3C7;border:2px solid #FDE68A;border-radius:var(--r);padding:1rem 1.25rem;box-shadow:0 4px 12px rgba(0,0,0,.15);display:flex;align-items:start;gap:1rem">
        <div style="width:36px;height:36px;background:#F59E0B;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:14px;color:#92400E;margin-bottom:4px">📧 Adicione seu e-mail</div>
          <div style="font-size:13px;color:#78350F;line-height:1.5;margin-bottom:.75rem">
            Para recuperar sua senha em caso de esquecimento, adicione seu e-mail no perfil.
          </div>
          <button onclick="showPage('perfil');document.getElementById('aviso-email-banner').remove()" class="btn btn-sm" style="background:#F59E0B;color:#fff;font-weight:600;padding:.4rem .85rem;font-size:12px">
            Adicionar agora →
          </button>
        </div>
        <button onclick="this.closest('#aviso-email-banner').remove()" style="background:none;border:none;color:#92400E;cursor:pointer;font-size:1.2rem;padding:0;line-height:1;flex-shrink:0">✕</button>
      </div>
    `;
    document.body.appendChild(banner);
  },2000);
}

function doLogout(){
  session=null;clearSession();
  document.getElementById('app-page').style.display='none';
  document.getElementById('login-page').style.display='';
  document.getElementById('lu').value='';document.getElementById('lp').value='';
  document.getElementById('login-error').style.display='none';
  tomadores=[];emprestimos=[];parcelas=[];users=[];_dashUserId=null;
  if(_notifInterval){clearInterval(_notifInterval);_notifInterval=null;}
  // Recarrega credenciais salvas após logout
  setTimeout(loadSavedCreds,50);
}

async function loadAll(){
  let tq=sb.from('tomadores').select('*').order('nome');
  let eq=sb.from('emprestimos').select('*').order('created_at',{ascending:false});
  if(session.role!=='admin'){
    tq=tq.eq('owner_id',session.id);
    eq=eq.eq('owner_id',session.id);
  }
  const[tr,er,pr,ur]=await Promise.all([sbWithRetry(()=>tq),sbWithRetry(()=>eq),sbWithRetry(()=>sb.from('parcelas').select('*').order('numero')),sbWithRetry(()=>sb.from('users').select('*').order('nome'))]);
  tomadores=tr.data||[];emprestimos=er.data||[];users=ur.data||[];
  // Sincroniza session com dados frescos do banco (evita inconsistência entre nav e dashboard)
  const freshMe=users.find(u=>u.id===session.id);
  if(freshMe){session.expires_at=freshMe.expires_at;session.plan_type=freshMe.plan_type;saveSession(session);}
  // Filtrar parcelas apenas dos empréstimos visíveis
  const empIds=new Set(emprestimos.map(e=>e.id));
  // Garantir que o valor de cada parcela é só o juros mensal (sem o capital)
  parcelas=(pr.data||[]).filter(p=>empIds.has(p.emprestimo_id)).map(p=>{
    const emp=emprestimos.find(e=>e.id===p.emprestimo_id);
    if(emp&&!p.abatimento){
      const jurosCorreto=parseFloat((emp.valor*emp.juros).toFixed(2));
      // Se o valor na DB for o total (valor+juros), corrige na memória
      const totalEmp=parseFloat((emp.valor+emp.valor*emp.juros).toFixed(2));
      if(Math.abs(p.valor-totalEmp)<0.01){
        return{...p,valor:jurosCorreto};
      }
    }
    return p;
  });
}

function renderDashboardSelector(){
  const mc=document.getElementById('main-content');
  const ops=users.filter(u=>u.role==='admin'||u.role==='op');

  const cards=ops.map(u=>{
    const emps=emprestimos.filter(e=>e.owner_id===u.id);
    const empIds=new Set(emps.map(e=>e.id));
    const parcs=parcelas.filter(p=>empIds.has(p.emprestimo_id));
    const totalEmp=emps.reduce((s,e)=>s+Number(e.valor||0),0);
    const atras=parcs.filter(p=>isAtrasada(p)).length;
    const pendentes=parcs.filter(p=>p.status==='pendente').length;
    const av=u.role==='admin'?'background:#FDE68A;color:#78350F':'background:#FFF7ED;color:#EA580C';
    return`<div onclick="_dashUserId='${u.id}';renderDashboard()" style="background:var(--card);border:1px solid #E5E7EB;border-radius:var(--r);padding:1.25rem;cursor:pointer;transition:all .15s;box-shadow:var(--sh)" onmouseover="this.style.borderColor='#EA580C';this.style.transform='translateY(-2px)'" onmouseout="this.style.borderColor='#E5E7EB';this.style.transform=''">
      <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:1rem">
        <div style="width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;flex-shrink:0;${av}">${ini(u.nome)}</div>
        <div>
          <div style="font-weight:700;font-size:15px;color:var(--n1)">${u.nome}</div>
          <div style="font-size:12px;color:var(--n4);margin-top:1px">@${u.login} · ${getPlanBadgeHTML(u)}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.5rem;text-align:center">
        <div style="background:#EFF6FF;border-radius:var(--rs);padding:.5rem">
          <div style="font-size:9px;color:var(--blu);font-weight:700;text-transform:uppercase;margin-bottom:2px">Empréstimos</div>
          <div style="font-family:var(--FT);font-size:1.1rem;color:var(--blu)">${emps.length}</div>
        </div>
        <div style="background:#FFF7ED;border-radius:var(--rs);padding:.5rem">
          <div style="font-size:9px;color:var(--grn);font-weight:700;text-transform:uppercase;margin-bottom:2px">Pendentes</div>
          <div style="font-family:var(--FT);font-size:1.1rem;color:var(--grn)">${pendentes}</div>
        </div>
        <div style="background:${atras?'var(--red0)':'#F9FAFB'};border-radius:var(--rs);padding:.5rem">
          <div style="font-size:9px;color:${atras?'var(--red)':'var(--n4)'};font-weight:700;text-transform:uppercase;margin-bottom:2px">Atrasos</div>
          <div style="font-family:var(--FT);font-size:1.1rem;color:${atras?'var(--red)':'var(--n4)'}">${atras}</div>
        </div>
      </div>
      <div style="margin-top:.85rem;font-size:12px;font-weight:600;color:var(--blu);text-align:center">Ver dashboard →</div>
    </div>`;
  }).join('');

  mc.innerHTML=`
    <div class="sec-hdr"><span class="sec-title">Dashboard</span></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1rem">${cards}</div>`;
}

// ══ DASHBOARD ══
let _dashUserId = null; // null = todos (admin), ou id do usuário filtrado

function renderDashboard(){
  const mc=document.getElementById('main-content');

  // Admin: se nenhum usuário selecionado, mostra seletor
  if(session.role==='admin' && _dashUserId===null){
    renderDashboardSelector();
    return;
  }

  // Filtra dados pelo usuário selecionado
  const uid = session.role==='admin' ? _dashUserId : session.id;
  const emps   = uid ? emprestimos.filter(e=>e.owner_id===uid) : emprestimos;
  const empIds = new Set(emps.map(e=>e.id));
  const parcs  = parcelas.filter(p=>empIds.has(p.emprestimo_id));
  const toms   = uid ? tomadores.filter(t=>t.owner_id===uid) : tomadores;
  const userAtivo = uid ? users.find(u=>u.id===uid) : null;

  // Só soma empréstimos com saldo em aberto (exclui quitados)
  const empsAtivos = emps.filter(e=>{
    const ep=parcelas.filter(p=>p.emprestimo_id===e.id);
    return ep.length===0||ep.some(p=>p.status==='pendente');
  });
  const totalEmp = empsAtivos.reduce((s,e)=>s+Number(e.saldo_devedor!=null?e.saldo_devedor:e.valor||0),0);
  const totalLucro = emps.reduce((s,e)=>s+Number(e.lucro||0),0);
  const pRecebido  = parcs.filter(p=>p.status==='pago').reduce((s,p)=>s+Number(p.valor||0),0);
  const pPendente  = parcs.filter(p=>p.status==='pendente').reduce((s,p)=>s+Number(p.valor||0),0);
  const atrasadas  = parcs.filter(p=>isAtrasada(p));
  const vencHoje   = parcs.filter(p=>p.status==='pendente'&&p.vencimento===today());

  // Sobrescreve variáveis locais para reusar nos cards
  const emprestimos_dash = emps;
  const parcelas_dash    = parcs;

  const voltarBtn = session.role==='admin'
    ? `<button class="btn btn-g btn-sm" onclick="_dashUserId=null;renderDashboard()">← Todos os operadores</button>`
    : '';

  mc.innerHTML=`
    <div class="sec-hdr">
      <div style="display:flex;align-items:center;gap:.75rem">
        ${voltarBtn}
        <span class="sec-title">${userAtivo ? userAtivo.nome.split(' ')[0] : 'Dashboard'}</span>
        ${userAtivo ? getPlanBadgeHTML(userAtivo) : ''}
      </div>
      <div style="display:flex;gap:.5rem">
        <button class="btn btn-grn btn-sm" onclick="openEmpModal(null)">+ Novo Empréstimo</button>
      </div>
    </div>
    <div class="stats">
      <div class="stat"><div class="stat-label">Total Emprestado</div><div class="stat-value" style="color:var(--blu)">${fmtR(totalEmp)}</div><div class="stat-sub">${empsAtivos.length} em aberto</div></div>
      <div class="stat"><div class="stat-label">Lucro Esperado</div><div class="stat-value" style="color:var(--grn)">${fmtR(totalLucro)}</div><div class="stat-sub">em juros</div></div>
      <div class="stat"><div class="stat-label">Recebido</div><div class="stat-value" style="color:var(--grn)">${fmtR(pRecebido)}</div><div class="stat-sub">em parcelas pagas</div></div>
      <div class="stat"><div class="stat-label">Próximas Parcelas</div><div class="stat-value" style="color:var(--amb)">${fmtR(pPendente)}</div><div class="stat-sub">${parcs.filter(p=>p.status==='pendente').length} parcelas</div></div>
    </div>
    ${(()=>{
      const hoje=new Date();hoje.setHours(0,0,0,0);
      const em3=new Date();em3.setDate(em3.getDate()+3);em3.setHours(23,59,59,999);
      const em7=new Date();em7.setDate(em7.getDate()+7);em7.setHours(23,59,59,999);
      // venc3: amanhã até dia 3
      const venc3=parcelas.filter(p=>{
        if(p.status!=='pendente')return false;
        const v=new Date(p.vencimento+'T00:00:00');
        return v>hoje&&v<=em3;
      });
      // venc7: TODAS até dia 7 (incluindo hoje e próximos 3 dias)
      const venc7=parcelas.filter(p=>{
        if(p.status!=='pendente')return false;
        const v=new Date(p.vencimento+'T00:00:00');
        return v>=hoje&&v<=em7;
      });
      let out='';
      if(atrasadas.length)out+=`<div class="warn-box">⚠ <strong>${atrasadas.length} parcela${atrasadas.length!==1?'s':''} em atraso!</strong> Verifique os empréstimos pendentes.</div>`;
      if(vencHoje.length)out+=`<div id="alerta-hoje" class="warn-box ${filtroAtivo==='hoje'?'alerta-ativo':''}" onclick="mostrarVencimento('hoje')" style="background:#FEF2F2;border-color:#FECACA;color:#991B1B;cursor:pointer;transition:all .2s;font-weight:600" onmouseenter="this.style.boxShadow='0 4px 8px rgba(153,27,27,.2)'" onmouseleave="this.style.boxShadow=''"><span style="font-size:1.2rem;margin-right:6px">●</span><strong>${vencHoje.length} parcela${vencHoje.length!==1?'s':''} vence${vencHoje.length===1?'':'m'} hoje.</strong></div>`;
      if(venc3.length)out+=`<div id="alerta-3dias" class="info-box ${filtroAtivo==='3dias'?'alerta-ativo':''}" onclick="mostrarVencimento('3dias')" style="background:#FFFBEB;border-color:#FDE68A;color:#92400E;cursor:pointer;transition:all .2s;font-weight:600" onmouseenter="this.style.boxShadow='0 4px 8px rgba(146,64,14,.15)'" onmouseleave="this.style.boxShadow=''"><span style="font-size:1.2rem;margin-right:6px">◉</span><strong>${venc3.length} parcela${venc3.length!==1?'s':''}</strong> vence${venc3.length===1?'':'m'} nos próximos 3 dias.</div>`;
      if(venc7.length)out+=`<div id="alerta-7dias" class="info-box ${filtroAtivo==='7dias'?'alerta-ativo':''}" onclick="mostrarVencimento('7dias')" style="background:#F8FAFC;border-color:#CBD5E1;color:#475569;cursor:pointer;transition:all .2s;font-weight:600" onmouseenter="this.style.boxShadow='0 4px 8px rgba(71,85,105,.15)'" onmouseleave="this.style.boxShadow=''"><span style="font-size:1.2rem;margin-right:6px">○</span><strong>${venc7.length} parcela${venc7.length!==1?'s':''}</strong> vence${venc7.length===1?'':'m'} em até 7 dias.</div>`;
      return out;
    })()}
    <div class="dash-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
      <div class="card">
        ${filtroAtivo?`
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
            <div class="card-title" style="margin-bottom:0">${filtroAtivo==='hoje'?'<span style="color:#991B1B">●</span> Vence Hoje':filtroAtivo==='3dias'?'<span style="color:#92400E">◉</span> Próximos 3 Dias':'<span style="color:#64748B">○</span> Próximos 7 Dias'}</div>
            <button onclick="voltarUltimosEmp()" class="btn btn-xs btn-g" style="font-size:11px">← Voltar</button>
          </div>
          ${(()=>{
            const hoje=new Date();hoje.setHours(0,0,0,0);
            const em3=new Date(hoje);em3.setDate(em3.getDate()+3);em3.setHours(23,59,59,999);
            const em7=new Date(hoje);em7.setDate(em7.getDate()+7);em7.setHours(23,59,59,999);
            
            let parcelasF=[];
            if(filtroAtivo==='hoje'){
              parcelasF=parcelas.filter(p=>p.status==='pendente'&&p.vencimento===today());
            }else if(filtroAtivo==='3dias'){
              // Amanhã até dia 3
              parcelasF=parcelas.filter(p=>{
                if(p.status!=='pendente')return false;
                const v=new Date(p.vencimento+'T00:00:00');
                return v>hoje&&v<=em3;
              });
            }else if(filtroAtivo==='7dias'){
              // TODAS até dia 7 (incluindo hoje)
              parcelasF=parcelas.filter(p=>{
                if(p.status!=='pendente')return false;
                const v=new Date(p.vencimento+'T00:00:00');
                return v>=hoje&&v<=em7;
              });
            }
            
            if(parcelasF.length===0){
              return`<div class="empty"><div style="font-size:2rem;margin-bottom:.5rem;color:var(--n5)">—</div><div class="empty-text">Nenhuma parcela neste período.</div></div>`;
            }
            
            // Agrupa por cliente
            const porCliente={};
            parcelasF.forEach(p=>{
              const emp=emprestimos.find(e=>e.id===p.emprestimo_id);
              const tom=tomadores.find(t=>t.id===emp?.tomador_id);
              if(!tom)return;
              if(!porCliente[tom.id]){
                porCliente[tom.id]={tomador:tom,parcelas:[]};
              }
              porCliente[tom.id].parcelas.push({...p,emp});
            });
            
            return Object.values(porCliente).map(item=>`
              <div style="margin-bottom:.75rem;border:2px solid ${filtroAtivo==='hoje'?'#FECACA':filtroAtivo==='3dias'?'#FDE68A':'#CBD5E1'};border-radius:var(--rs);overflow:hidden;background:${filtroAtivo==='hoje'?'#FEF2F2':filtroAtivo==='3dias'?'#FFFBEB':'#F8FAFC'};cursor:pointer;transition:all .2s;box-shadow:0 2px 4px rgba(0,0,0,.1)" onclick="openClientView('${item.tomador.id}')" onmouseenter="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 8px rgba(0,0,0,.15)'" onmouseleave="this.style.transform='translateY(0)';this.style.boxShadow='0 2px 4px rgba(0,0,0,.1)'">
                <div style="padding:.75rem 1rem">
                  <div style="font-weight:700;color:#1E293B;margin-bottom:4px;font-size:14px">${item.tomador.nome}</div>
                  ${item.parcelas.map(p=>`
                    <div style="font-size:11px;color:#64748B;margin-top:2px">
                      • ${fmtR(p.valor)} · Venc: ${fmtDate(p.vencimento)} · ${p.numero}º ${p.emp?.tipo==='consignado'?'Parcela':'Juros'}
                    </div>
                  `).join('')}
                </div>
              </div>
            `).join('');
          })()}
        `:`
          <div class="card-title">Últimos Empréstimos</div>
          ${emps.slice(0,6).map(e=>{
            const tom=tomadores.find(t=>t.id===e.tomador_id);
            const parcsEmp=parcelas.filter(p=>p.emprestimo_id===e.id);
            const pgCnt=parcsEmp.filter(p=>p.status==='pago').length;
            const atCnt=parcsEmp.filter(p=>isAtrasada(p)).length;
            const tipo=e.tipo||'juros';
            const isConsig=tipo==='consignado';
            const cor=isConsig?'var(--blu)':'var(--grn)';
            let statusTxt='';
            if(parcsEmp.length===0){statusTxt=isConsig?'Sem parcelas':'Sem juros';}
            else if(atCnt>0){statusTxt=`⚠️ ${atCnt} em atraso`;}
            else if(isConsig){statusTxt=`${pgCnt}/${parcsEmp.length} pagas`;}
            else{statusTxt=`${pgCnt} pago${pgCnt!==1?'s':''}`;}
            return`<div style="display:flex;align-items:center;justify-content:space-between;padding:.6rem 0;border-bottom:1px solid #F3F4F6">
              <div>
                <div style="font-size:13px;font-weight:600;cursor:pointer;color:var(--n1)" onclick="openClientView('${tom?.id}')">${tom?.nome||'—'} <span style="font-size:11px;color:var(--grn)">→</span></div>
                <div style="font-size:11px;color:var(--n4)">${fmtDate(e.data_emprestimo)} · ${fmtR(e.valor)}</div>
              </div>
              <div style="text-align:right">
                <div style="font-size:12px;color:${atCnt?'var(--red)':cor};font-weight:600">${statusTxt}</div>
                <div style="font-size:11px;color:${isConsig?'#2563EB':'var(--grn)'};font-weight:600">${isConsig?'■ Consignado':'◆ Juros'}</div>
              </div>
            </div>`;
          }).join('')||'<div class="empty"><div style="font-size:2rem;margin-bottom:.5rem;color:var(--n5)">—</div><div class="empty-text">Nenhum empréstimo ainda.</div></div>'}
        `}
      </div>
      <div class="card">
        <div class="card-title">Parcelas em Atraso</div>
        ${atrasadas.slice(0,8).map(p=>{
          const emp=emprestimos.find(e=>e.id===p.emprestimo_id);
          const tom=tomadores.find(t=>t.id===emp?.tomador_id);
          const dias=Math.floor((new Date()-new Date(p.vencimento+'T12:00:00'))/(1000*60*60*24));
          return`<div style="display:flex;align-items:center;justify-content:space-between;padding:.6rem 0;border-bottom:1px solid #F3F4F6">
            <div>
              <div style="font-size:13px;font-weight:600;color:var(--red);cursor:pointer" onclick="openClientView('${tom?.id}')">${tom?.nome||'—'} <span style="font-size:11px">→</span></div>
              <div style="font-size:11px;color:var(--n4)">${dias}d de atraso · Parcela ${p.numero}</div>
            </div>
            <div style="display:flex;align-items:center;gap:.5rem">
              <span style="font-size:13px;font-weight:600;color:var(--red)">${fmtR(p.valor)}</span>
              <span class="bdg bdg-atras">Pendente</span>
              <button class="btn btn-grn btn-xs" onclick="confirmarAtrasoComDupla('${p.id}','${emp?.tomador_id}')">Confirmar</button>
            </div>
          </div>`;
        }).join('')||'<div class="empty"><div style="font-size:2rem;margin-bottom:.5rem;color:var(--n5)">—</div><div class="empty-text">Nenhum atraso. Tudo em dia!</div></div>'}
      </div>
    </div>`;
}

// ══ EMPRÉSTIMOS ══

// ══ IMPORT / EXPORT ══

async function importExcel(input){
  const file=input.files[0];
  if(!file)return;
  input.value='';
  toast('Lendo arquivo...');
  const reader=new FileReader();
  reader.onload=async(e)=>{
    try{
      const data=new Uint8Array(e.target.result);
      const wb=XLSX.read(data,{type:'array',cellDates:true});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(ws,{header:1,raw:false,dateNF:'yyyy-mm-dd'});

      // Find header row (contains 'NOME')
      let headerIdx=rows.findIndex(r=>r.some(c=>String(c||'').toUpperCase().includes('NOME')));
      if(headerIdx===-1){toast('⚠ Formato inválido. Coluna NOME não encontrada.',true);return;}
      const dataRows=rows.slice(headerIdx+1).filter(r=>r[1]&&String(r[1]).trim());

      if(!dataRows.length){toast('⚠ Nenhum dado encontrado.',true);return;}

      // Show preview modal
      showImportPreview(dataRows);
    }catch(err){
      console.error(err);
      toast('⚠ Erro ao ler o arquivo.',true);
    }
  };
  reader.readAsArrayBuffer(file);
}

function showImportPreview(dataRows){
  const existing=document.getElementById('import-preview-modal');
  if(existing)existing.remove();

  // Formato: [#, NOME, TELEFONE, VALOR, JUROS%, LUCRO, TOTAL, DATA, VENC1..VENC20]
  const preview=dataRows.slice(0,5).map(r=>`
    <tr>
      <td style="padding:4px 8px;border:1px solid #E5E7EB;font-size:12px">${r[1]||''}</td>
      <td style="padding:4px 8px;border:1px solid #E5E7EB;font-size:12px">${r[2]||''}</td>
      <td style="padding:4px 8px;border:1px solid #E5E7EB;font-size:12px">R$ ${Number(r[3]||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
      <td style="padding:4px 8px;border:1px solid #E5E7EB;font-size:12px">${(()=>{const j=Number(r[4]||0);return(j>1?j:j*100).toFixed(1)+'%';})()}</td>
      <td style="padding:4px 8px;border:1px solid #E5E7EB;font-size:12px">${r[7]||''}</td>
    </tr>`).join('');

  const div=document.createElement('div');
  div.id='import-preview-modal';
  div.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:300;display:flex;align-items:center;justify-content:center;padding:1rem';
  div.innerHTML=`<div style="background:#fff;border-radius:var(--r);width:100%;max-width:620px;max-height:90vh;overflow-y:auto;box-shadow:var(--shm)">
    <div style="padding:1.25rem 1.5rem;border-bottom:1px solid #E5E7EB;display:flex;justify-content:space-between;align-items:center">
      <div style="font-family:var(--FT);font-size:1.15rem">Importar ${dataRows.length} registro${dataRows.length!==1?'s':''}</div>
      <button onclick="document.getElementById('import-preview-modal').remove()" style="background:none;border:none;cursor:pointer;font-size:1.1rem;color:var(--n4)">✕</button>
    </div>
    <div style="padding:1.25rem 1.5rem">
      <div style="padding:.75rem 1rem;background:var(--grn0);border-radius:var(--rs);font-size:13px;color:#065F46;margin-bottom:1rem;border:1px solid var(--grn1)">
        Arquivo reconhecido. <strong>${dataRows.length} empréstimos</strong> serão importados.<br>
        Os clientes serão criados automaticamente se ainda não existirem.
      </div>
      <div style="font-size:11px;font-weight:700;color:var(--n4);text-transform:uppercase;margin-bottom:.5rem">Prévia (primeiros 5)</div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="background:#F9FAFB">
            <th style="padding:6px 8px;border:1px solid #E5E7EB;font-size:11px;text-align:left">Nome</th>
            <th style="padding:6px 8px;border:1px solid #E5E7EB;font-size:11px;text-align:left">Telefone</th>
            <th style="padding:6px 8px;border:1px solid #E5E7EB;font-size:11px;text-align:left">Valor</th>
            <th style="padding:6px 8px;border:1px solid #E5E7EB;font-size:11px;text-align:left">Juros</th>
            <th style="padding:6px 8px;border:1px solid #E5E7EB;font-size:11px;text-align:left">Data</th>
          </tr></thead>
          <tbody>${preview}</tbody>
        </table>
      </div>
      ${dataRows.length>5?`<div style="font-size:12px;color:var(--n4);margin-top:.5rem">... e mais ${dataRows.length-5} registro${dataRows.length-5!==1?'s':''}</div>`:''}
    </div>
    <div style="padding:1rem 1.5rem;border-top:1px solid #E5E7EB;display:flex;gap:.5rem;justify-content:flex-end">
      <button class="btn btn-g btn-sm" onclick="document.getElementById('import-preview-modal').remove()">Cancelar</button>
      <button class="btn btn-grn btn-sm" id="btn-confirm-import" onclick="executeImport(window._importRows)">✓ Importar tudo</button>
    </div>
  </div>`;
  window._importRows=dataRows;
  document.body.appendChild(div);
}

async function executeImport(dataRows){
  const btn=document.getElementById('btn-confirm-import');
  if(btn){btn.textContent='Importando...';btn.disabled=true;}

  let tomCriados=0,empCriados=0,parcCriadas=0,erros=0;

  // Cache de tomadores por nome normalizado
  const tomCache={};
  tomadores.forEach(t=>{tomCache[t.nome.trim().toUpperCase()]=t;});

  for(const row of dataRows){
    try{
      // Formato padrão: [#, NOME, TELEFONE, VALOR, JUROS%, LUCRO, TOTAL, DATA, VENC1..VENC20]
      const nome=String(row[1]||'').trim();
      const valor=parseFloat(String(row[3]||'').replace(/\./g,'').replace(',','.'))||0;
      // Juros: pode vir como 20 (para 20%) ou 0.20 (decimal)
      const jurosRaw=parseFloat(String(row[4]||'0').replace(',','.'))||0;
      const juros=jurosRaw>1?jurosRaw/100:jurosRaw;
      const telefone=String(row[2]||'').trim();
      const dataEmp=formatDateForDB(row[7])||formatDateForDB(row[4]);
      if(!nome||!valor||!dataEmp)continue;

      // Criar ou reutilizar tomador
      const nomeKey=nome.toUpperCase();
      let tom=tomCache[nomeKey];
      if(!tom){
        const{data:td,error:te}=await sb.from('tomadores').insert({nome,contato:telefone||null,owner_id:session.id}).select().single();
        if(te||!td){erros++;continue;}
        tom=td;tomadores.push(td);tomCache[nomeKey]=td;tomCriados++;
      }

      // Criar empréstimo
      const{data:emp,error:ee}=await sb.from('emprestimos').insert({
        tomador_id:tom.id,valor,juros,
        data_emprestimo:dataEmp,
        created_by:session.id,
        owner_id:session.id
      }).select().single();
      if(ee||!emp){erros++;continue;}
      emprestimos.unshift(emp);empCriados++;

      // Criar parcelas dos vencimentos (colunas 8-27)
      const vencDates=[];
      for(let c=8;c<=27;c++){
        if(row[c]){
          const d=formatDateForDB(row[c]);
          if(d)vencDates.push(d);
        }
      }
      if(vencDates.length>0){
        const valorParc=parseFloat((valor*juros).toFixed(2)); // apenas juros mensal
        const parcsPayload=vencDates.map((venc,i)=>({
          emprestimo_id:emp.id,numero:i+1,
          vencimento:venc,valor:valorParc,status:'pendente'
        }));
        const{data:ps}=await sb.from('parcelas').insert(parcsPayload).select();
        if(ps){parcelas.push(...ps);parcCriadas+=ps.length;}
      }
    }catch(err){erros++;console.error(err);}
  }

  document.getElementById('import-preview-modal')?.remove();
  toast(`Importado! ${empCriados} empréstimos, ${tomCriados} tomadores, ${parcCriadas} parcelas.${erros?` ⚠ ${erros} erro(s).`:''}`);
  renderEmprestimos();
}

function formatDateForDB(val){
  if(!val)return null;
  if(val instanceof Date){
    const y=val.getFullYear();const m=String(val.getMonth()+1).padStart(2,'0');const d=String(val.getDate()).padStart(2,'0');
    return`${y}-${m}-${d}`;
  }
  const s=String(val).trim();
  // yyyy-mm-dd
  if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
  // dd/mm/yyyy (4 digitos no ano)
  const mA=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if(mA)return`${mA[3]}-${mA[2]}-${mA[1]}`;
  // dd/mm/yy (2 digitos no ano — texto manual, ex: 01/06/25)
  const mB=s.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if(mB){const y=parseInt(mB[3]);return`${y<50?2000+y:1900+y}-${mB[2]}-${mB[1]}`;}
  // m/d/yy ou m/d/yyyy — formato americano do xlsx.js (ex: 5/1/25 = 1 de maio)
  const mC=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if(mC){const y=parseInt(mC[3]);const fy=y<100?(y<50?2000+y:1900+y):y;return`${fy}-${String(parseInt(mC[1])).padStart(2,'0')}-${String(parseInt(mC[2])).padStart(2,'0')}`;}
  return null;
}

function downloadModelo(){
  const b64='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';
  try{
    const bin=atob(b64);
    const buf=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)buf[i]=bin.charCodeAt(i);
    const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download='GEPainel_Modelo_Importacao.xlsx';
    document.body.appendChild(a);a.click();
    setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},200);
    toast('✓ Modelo baixado!');
  }catch(e){toast('⚠ Erro ao baixar',true);console.error(e);}
}

function exportExcel(){
  if(!emprestimos.length){toast('⚠ Nenhum empréstimo para exportar.',true);return;}
  const rows=[['#','NOME','TELEFONE','VALOR EMPRESTADO','JUROS(%)','LUCRO','VALOR TOTAL','DATA DO EMPRÉSTIMO',
    ...Array.from({length:20},(_,i)=>`${i+1}ª VENCIMENTO`)]];

  emprestimos.forEach((e,i)=>{
    const tom=tomadores.find(t=>t.id===e.tomador_id);
    const parcsEmp=parcelas.filter(p=>p.emprestimo_id===e.id).sort((a,b)=>a.numero-b.numero);
    const lucro=e.valor*e.juros;
    const total=e.valor+lucro;
    const vencCols=Array.from({length:20},(_,j)=>parcsEmp[j]?.vencimento||'');
    rows.push([i+1,tom?.nome||'',tom?.contato||'',e.valor,e.juros*100,lucro.toFixed(2),total.toFixed(2),e.data_emprestimo,...vencCols]);
  });

  const ws=XLSX.utils.aoa_to_sheet(rows);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,'BANCO DE DADOS',ws);
  const b64=XLSX.write(wb,{bookType:'xlsx',type:'base64'});
  const bin=atob(b64);const buf=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)buf[i]=bin.charCodeAt(i);
  const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;
  a.download='GEPainel_'+today()+'.xlsx';
  document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},300);
  toast('✓ Arquivo exportado!');
}

let _selectMode=false;

function toggleSelectMode(){
  _selectMode=!_selectMode;
  const btn=document.getElementById('btn-select-mode');
  const btnDel=document.getElementById('btn-del-all');
  const thChk=document.getElementById('th-check');
  if(btn)btn.textContent=_selectMode?'Cancelar':'Selecionar';
  if(btn)btn.className=_selectMode?'btn btn-g btn-sm':'btn btn-g btn-sm';
  document.querySelectorAll('.chk-cell').forEach(el=>el.style.display=_selectMode?'':'none');
  if(thChk)thChk.style.display=_selectMode?'':'none';
  if(btnDel)btnDel.style.display='none';
  if(!_selectMode){document.querySelectorAll('.emp-chk').forEach(el=>el.checked=false);const chkAll=document.getElementById('chk-all');if(chkAll)chkAll.checked=false;}
}

function toggleAllChk(chk){
  document.querySelectorAll('.emp-chk').forEach(el=>el.checked=chk.checked);
  onChkChange();
}

function onChkChange(){
  const checked=document.querySelectorAll('.emp-chk:checked').length;
  const btnDel=document.getElementById('btn-del-all');
  if(btnDel)btnDel.style.display=checked>0?'':'none';
  if(btnDel&&checked>0)btnDel.textContent=`Excluir ${checked} selecionado${checked!==1?'s':''}`;
}

async function deleteSelectedEmps(){
  const ids=[...document.querySelectorAll('.emp-chk:checked')].map(el=>el.value);
  if(!ids.length)return;
  const nomes=ids.map(id=>{const e=emprestimos.find(x=>x.id===id);const t=tomadores.find(x=>x.id===e?.tomador_id);return t?.nome||'?';});
  if(!confirm(`Excluir ${ids.length} empréstimo${ids.length!==1?'s':''}?\n${nomes.join(', ')}\n\nEsta ação não pode ser desfeita.`))return;
  for(const id of ids){
    await sb.from('parcelas').delete().eq('emprestimo_id',id);
    await sb.from('emprestimos').delete().eq('id',id);
    emprestimos=emprestimos.filter(e=>e.id!==id);
    parcelas=parcelas.filter(p=>p.emprestimo_id!==id);
  }
  toast(`✓ ${ids.length} empréstimo${ids.length!==1?'s':''} excluído${ids.length!==1?'s':''}`);
  _selectMode=false;
  renderEmprestimos();
}

function renderEmprestimos(){
  const mc=document.getElementById('main-content');
  mc.innerHTML=`
    <div class="sec-hdr">
      <span class="sec-title">Empréstimos</span>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;justify-content:flex-end">
        <label class="btn btn-g btn-sm" style="cursor:pointer">
          Importar Excel
          <input type="file" id="import-file" accept=".xlsx,.xls" style="display:none" onchange="importExcel(this)"/>
        </label>
        <button class="btn btn-sm" onclick="downloadModelo()" style="background:#16A34A;color:#fff;border:none" title="Baixar planilha modelo para importação">
          ↓ Modelo Excel
        </button>
        <button class="btn btn-grn btn-sm" onclick="openEmpModal(null)">+ Novo Empréstimo</button>
      </div>
    </div>
    <div class="filter-pills">
      <button class="pill active" id="pill-todos" onclick="setEmpFilter('todos')"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> Todos</button>
      <button class="pill pill-red" id="pill-atrasado" onclick="setEmpFilter('atrasado')"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Em atraso</button>
      <button class="pill pill-amb" id="pill-hoje" onclick="setEmpFilter('hoje')"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Vence hoje</button>
      <button class="pill pill-grn" id="pill-quitado" onclick="setEmpFilter('quitado')"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Quitados</button>
      <button class="pill" id="pill-ativo" onclick="setEmpFilter('ativo')"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg> Ativos</button>
      <button class="pill pill-juros" id="pill-juros" onclick="setEmpFilter('juros')"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> Juros</button>
      <button class="pill pill-consig" id="pill-consig" onclick="setEmpFilter('consig')"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> Consignado</button>
    </div>
    <div style="display:flex;gap:.75rem;align-items:center;margin-bottom:1rem;flex-wrap:wrap">
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center">
        <input type="text" id="emp-s" placeholder="🔍  Buscar por nome, local ou responsável..." oninput="filterEmp()" style="max-width:280px"/>
        <input type="text" id="emp-date-filter" placeholder="📅  Buscar por data" oninput="filterEmp()" style="padding:.5rem .75rem;border:1px solid var(--border);border-radius:var(--rs);background:var(--card);color:var(--n2);font-size:13px;font-family:var(--FB);max-width:150px" title="Filtrar por data de empréstimo"/>
        <button class="btn btn-g btn-sm" onclick="clearDateFilter()" id="btn-clear-date" style="display:none" title="Limpar filtro de data">✕ Data</button>
      </div>
      <button class="btn btn-d btn-sm" onclick="deleteSelectedEmps()" id="btn-del-all" style="display:none">Excluir selecionados</button>
      <button class="btn btn-g btn-sm" onclick="toggleSelectMode()" id="btn-select-mode">Selecionar</button>
    </div>
    <div class="tbl-wrap">
      <table>
        <thead><tr>
          <th id="th-check" style="display:none;width:36px"><input type="checkbox" id="chk-all" onclick="toggleAllChk(this)"/></th>
          <th style="width:36px">Nº</th>
          <th class="sortable" id="th-sort-nome" onclick="sortEmp('nome')">Cliente<span class="sort-icon"></span></th>
          <th class="hide-mobile sortable" id="th-sort-responsavel" onclick="sortEmp('responsavel')">Responsável<span class="sort-icon"></span></th>
          <th class="hide-mobile">Garantia</th>
          <th class="hide-mobile sortable" id="th-sort-local" onclick="sortEmp('local')">Local<span class="sort-icon"></span></th>
          <th class="sortable" id="th-sort-valor" onclick="sortEmp('valor')">Valor Inicial<span class="sort-icon"></span></th>
          <th class="sortable" id="th-sort-saldo" onclick="sortEmp('saldo')">Valor Atual<span class="sort-icon"></span></th>
          <th class="sortable" id="th-sort-juros" onclick="sortEmp('juros')">Juros<span class="sort-icon"></span></th>
          <th class="sortable" id="th-sort-total" onclick="sortEmp('total')">Total<span class="sort-icon"></span></th>
          <th class="sortable" id="th-sort-data" onclick="sortEmp('data')">Data<span class="sort-icon"></span></th>
          <th class="sortable" id="th-sort-parcelas" onclick="sortEmp('parcelas')">Parcelas/Juros<span class="sort-icon"></span></th>
          <th></th>
        </tr></thead>
        <tbody id="emp-tbody">${empTbodyHTML(emprestimos)}</tbody>
      </table>
    </div>`;
  // Aplica filtro padrão (esconde quitados quando _empFilter='todos')
  setTimeout(()=>{try{filterEmp();}catch(e){}},0);
}

let _empSort={col:null,dir:'asc'};
function sortEmp(col){
  if(_empSort.col===col){_empSort.dir=_empSort.dir==='asc'?'desc':'asc';}
  else{_empSort.col=col;_empSort.dir='asc';}
  document.querySelectorAll('th.sortable').forEach(th=>{th.classList.remove('asc','desc');});
  const th=document.getElementById('th-sort-'+col);
  if(th)th.classList.add(_empSort.dir);
  filterEmp();
}
function applySortEmp(list){
  const{col,dir}=_empSort;
  if(!col)return list;
  return [...list].sort((a,b)=>{
    let va,vb;
    if(col==='nome'){const ta=tomadores.find(t=>t.id===a.tomador_id);const tb2=tomadores.find(t=>t.id===b.tomador_id);va=(ta?.nome||'').toLowerCase();vb=(tb2?.nome||'').toLowerCase();}
    else if(col==='valor'){va=Number(a.valor);vb=Number(b.valor);}
    else if(col==='saldo'){va=Number(a.saldo_devedor!=null?a.saldo_devedor:a.valor||0);vb=Number(b.saldo_devedor!=null?b.saldo_devedor:b.valor||0);}
    else if(col==='juros'){va=Number(a.juros);vb=Number(b.juros);}
    else if(col==='total'){va=Number(a.valor_total||a.valor);vb=Number(b.valor_total||b.valor);}
    else if(col==='data'){va=a.data_emprestimo||'';vb=b.data_emprestimo||'';}
    else if(col==='responsavel'){va=(a.responsavel||'').toLowerCase();vb=(b.responsavel||'').toLowerCase();}
    else if(col==='local'){va=(a.local||'').toLowerCase();vb=(b.local||'').toLowerCase();}
    else if(col==='parcelas'){
      const pa=parcelas.filter(p=>p.emprestimo_id===a.id);
      const pb2=parcelas.filter(p=>p.emprestimo_id===b.id);
      va=pa.filter(p=>isAtrasada(p)).length*1000+pa.filter(p=>p.status==='pendente').length;
      vb=pb2.filter(p=>isAtrasada(p)).length*1000+pb2.filter(p=>p.status==='pendente').length;
    }
    if(va<vb)return dir==='asc'?-1:1;
    if(va>vb)return dir==='asc'?1:-1;
    return 0;
  });
}

let _tomSort={col:null,dir:'asc'};
function sortTom(col){
  if(_tomSort.col===col){_tomSort.dir=_tomSort.dir==='asc'?'desc':'asc';}
  else{_tomSort.col=col;_tomSort.dir='asc';}
  document.querySelectorAll('#tom-thead th.sortable').forEach(th=>{th.classList.remove('asc','desc');});
  const th=document.getElementById('th-tom-'+col);if(th)th.classList.add(_tomSort.dir);
  filterTom();
}
function applySortTom(list){
  const{col,dir}=_tomSort;
  if(!col)return list;
  return [...list].sort((a,b)=>{
    let va,vb;
    if(col==='nome'){va=a.nome.toLowerCase();vb=b.nome.toLowerCase();}
    else if(col==='contato'){va=(a.contato||'').toLowerCase();vb=(b.contato||'').toLowerCase();}
    else if(col==='ocupacao'){va=(a.ocupacao||'').toLowerCase();vb=(b.ocupacao||'').toLowerCase();}
    else if(col==='emps'){va=emprestimos.filter(e=>e.tomador_id===a.id).length;vb=emprestimos.filter(e=>e.tomador_id===b.id).length;}
    else if(col==='devido'){
      const getTotal=t=>{return emprestimos.filter(e=>e.tomador_id===t.id).reduce((s,e)=>s+Number(e.valor||0),0);};
      va=getTotal(a);vb=getTotal(b);
    }
    if(va<vb)return dir==='asc'?-1:1;
    if(va>vb)return dir==='asc'?1:-1;
    return 0;
  });
}

let _empFilter='todos';
function clearDateFilter(){
  const dateInput=document.getElementById('emp-date-filter');
  if(dateInput){
    dateInput.value='';
    filterEmp();
  }
}

function setEmpFilter(f){
  _empFilter=f;
  document.querySelectorAll('.pill').forEach(p=>p.classList.remove('active'));
  const el=document.getElementById('pill-'+f);if(el)el.classList.add('active');
  filterEmp();
}
function filterEmp(){
  const q=(document.getElementById('emp-s')?.value||'').toLowerCase();
  const dateFilter=document.getElementById('emp-date-filter')?.value||'';
  
  // Mostrar/ocultar botão de limpar filtro de data
  const btnClearDate=document.getElementById('btn-clear-date');
  if(btnClearDate){
    btnClearDate.style.display=dateFilter?'inline-block':'none';
  }
  
  let f=emprestimos.filter(e=>{
    const tom=tomadores.find(t=>t.id===e.tomador_id);
    const matchText=(tom?.nome||'').toLowerCase().includes(q)||(e.responsavel||'').toLowerCase().includes(q)||(e.local||'').toLowerCase().includes(q);
    
    // Filtro de data parcial - aceita digitação progressiva
    let matchDate=true;
    if(dateFilter){
      // Converter data do empréstimo de YYYY-MM-DD para DD/MM/YYYY
      const empDate=e.data_emprestimo||'';
      if(empDate){
        const[y,m,d]=empDate.split('-');
        const formattedDate=`${d}/${m}/${y}`;
        matchDate=formattedDate.includes(dateFilter);
      }else{
        matchDate=false;
      }
    }
    
    return matchText&&matchDate;
  });
  if(_empFilter==='atrasado'){f=f.filter(e=>parcelas.some(p=>p.emprestimo_id===e.id&&isAtrasada(p)));}
  else if(_empFilter==='hoje'){f=f.filter(e=>parcelas.some(p=>p.emprestimo_id===e.id&&p.status==='pendente'&&p.vencimento===today()));}
  else if(_empFilter==='quitado'){f=f.filter(e=>{const ep=parcelas.filter(p=>p.emprestimo_id===e.id);return ep.length>0&&ep.every(p=>p.status==='pago');});}
  else if(_empFilter==='ativo'){f=f.filter(e=>{const ep=parcelas.filter(p=>p.emprestimo_id===e.id);return ep.length===0||ep.some(p=>p.status==='pendente');});}
  else if(_empFilter==='semparc'){f=f.filter(e=>parcelas.filter(p=>p.emprestimo_id===e.id).length===0);}
  else if(_empFilter==='juros'){f=f.filter(e=>(e.tipo||'juros')==='juros');}
  else if(_empFilter==='consig'){f=f.filter(e=>e.tipo==='consignado');}
  else {
    // Filtro padrão "todos": esconde os já quitados (continuam acessíveis pela pílula "Quitados")
    f=f.filter(e=>{const ep=parcelas.filter(p=>p.emprestimo_id===e.id);return ep.length===0||ep.some(p=>p.status==='pendente');});
  }
  const sorted=applySortEmp(f);
  const tb=document.getElementById('emp-tbody');if(tb)tb.innerHTML=empTbodyHTML(sorted);
}

function _empRow(e,i){
  const tom=tomadores.find(t=>t.id===e.tomador_id);
  const parcsEmp=parcelas.filter(p=>p.emprestimo_id===e.id);
  const pgCnt=parcsEmp.filter(p=>p.status==='pago').length;
  const atCnt=parcsEmp.filter(p=>isAtrasada(p)).length;
  const allPago=parcsEmp.length>0&&pgCnt===parcsEmp.length;
  // Valor Atual = saldo devedor (após abatimentos). Se nunca abateu, é igual ao valor inicial.
  const tipo=e.tipo||'juros';
  const saldoAtual=tipo==='consignado'
    ? (allPago?0:Number(e.valor||0))
    : Number(e.saldo_devedor!=null?e.saldo_devedor:e.valor||0);
  const houveAbatimento=tipo!=='consignado'&&e.saldo_devedor!=null&&Math.abs(saldoAtual-Number(e.valor||0))>0.01;
  const corSaldo=saldoAtual===0?'var(--grn)':(houveAbatimento?'var(--amb)':'var(--n3)');
  const labelSaldo=saldoAtual===0?'Quitado':fmtR(saldoAtual);
    return`<tr id="row-${e.id}">
      <td class="chk-cell" style="display:none;text-align:center"><input type="checkbox" class="emp-chk" value="${e.id}" onchange="onChkChange()"/></td>
      <td style="color:var(--n4);font-size:12px">${i+1}</td>
      <td style="font-weight:600">${tom?.nome||'—'}</td>
      <td class="hide-mobile" style="color:var(--n3)">${e.responsavel||'—'}</td>
      <td class="hide-mobile" style="color:var(--n3)">${e.garantia||'—'}</td>
      <td class="hide-mobile" style="color:var(--n3)">${e.local||'—'}</td>
      <td style="font-weight:600;color:var(--blu)">${fmtR(e.valor)}</td>
      <td style="font-weight:600;color:${corSaldo}">${labelSaldo}${houveAbatimento&&saldoAtual>0?'<div style="font-size:10px;font-weight:400;color:var(--n4);margin-top:2px">abatido</div>':''}</td>
      <td class="hide-mobile-juros" style="color:var(--n3)">${(e.juros*100).toFixed(0)}%</td>
      <td class="hide-mobile-juros" style="font-weight:600;color:var(--grn)">${(()=>{
        // Total atual = saldo devedor + juros sobre o saldo
        // Para consignado mantém o valor_total original
        if(tipo==='consignado')return fmtR(e.valor_total);
        const totalAtual=parseFloat((saldoAtual+saldoAtual*Number(e.juros||0)).toFixed(2));
        return fmtR(totalAtual);
      })()}</td>
      <td style="color:var(--n4);font-size:12px">${fmtDate(e.data_emprestimo)}</td>
      <td>
        ${(()=>{
          // SVGs inline profissionais (alinhamento vertical centralizado)
          const svgCheck=`<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><polyline points="20 6 9 17 4 12"/></svg>`;
          const svgAlert=`<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
          const svgClock=`<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
          const svgCard=`<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>`;
          const svgAlertSmall=`<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-left:4px"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;

          if(parcsEmp.length===0){
            return`<button class="btn btn-xs btn-g" onclick="addParcela('${e.id}')">${tipo==='consignado'?'Parcelas':'Juros'}</button>`;
          }
          if(tipo==='juros'){
            // Juros mensal: mostra "X juros pagos" ou "em atraso"
            if(allPago) return`<button class="btn btn-xs btn-grn" onclick="openParcelas('${e.id}')">${svgCheck}Quitado</button>`;
            if(atCnt)   return`<button class="btn btn-xs btn-d"   onclick="openParcelas('${e.id}')">${svgAlert}${atCnt} em atraso</button>`;
            return`<button class="btn btn-xs btn-amb" onclick="openParcelas('${e.id}')">${svgClock}${pgCnt} pago${pgCnt!==1?'s':''}</button>`;
          } else {
            // Consignado: mantém X/Y
            const ic=allPago?svgCheck:svgCard;
            return`<button class="btn btn-xs ${allPago?'btn-grn':atCnt?'btn-d':'btn-amb'}" onclick="openParcelas('${e.id}')">${ic}${pgCnt}/${parcsEmp.length}${atCnt?svgAlertSmall+atCnt:''}</button>`;
          }
        })()}
      </td>
      <td>
        <div style="display:flex;gap:.3rem;align-items:center">
          ${!allPago?`<button class="btn btn-xs" style="background:rgba(0,200,150,.15);border:1px solid var(--grn);color:var(--grn);font-size:10px;font-weight:700;padding:.2rem .5rem;border-radius:var(--rs)" onclick="abrirQuitacao('${e.id}')" title="Quitar empréstimo">Quitar</button>`:''}
          <button class="btn btn-xs btn-g" onclick="openEmpModal('${e.id}')" title="Editar"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          ${session.role==='admin'?'<button class="btn btn-xs btn-d" onclick="deleteEmp(\''+e.id+'\')">✕</button>':''}
        </div>
      </td>
    </tr>`;
}

function empTbodyHTML(list){
  if(!list.length)return'<tr><td colspan="12"><div class="empty"><div style="font-size:2rem;margin-bottom:.5rem;color:var(--n5)">—</div><div class="empty-text">Nenhum empréstimo.</div></div></td></tr>';
  const ativos=list.filter(e=>{const ep=parcelas.filter(p=>p.emprestimo_id===e.id);return ep.length===0||ep.some(p=>p.status==='pendente');});
  const quitados=list.filter(e=>{const ep=parcelas.filter(p=>p.emprestimo_id===e.id);return ep.length>0&&ep.every(p=>p.status==='pago');});
  let html=ativos.map((e,i)=>_empRow(e,i+1)).join('');
  if(quitados.length){
    html+='<tr><td colspan="12" style="padding:.65rem 1rem;background:rgba(0,200,150,.06);border-top:2px solid rgba(0,200,150,.3);border-bottom:1px solid rgba(0,200,150,.2)"><div style="display:flex;align-items:center;gap:.5rem"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"13\" height=\"13\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#00C896\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"20 6 9 17 4 12\"/></svg><span style=\"font-size:11px;font-weight:700;color:var(--grn);text-transform:uppercase;letter-spacing:.05em\">Quitados ('+quitados.length+')</span></div></td></tr>';
    html+=quitados.map((e,i)=>{const row=_empRow(e,ativos.length+i+1);return row.replace('<tr id=','<tr style="opacity:.6" id=');}).join('');
  }
  return html||'<tr><td colspan="12"><div class="empty"><div class="empty-text">Nenhum empréstimo.</div></div></td></tr>';
}

let _empTipo='juros';

function setTipoEmp(tipo){
  _empTipo=tipo;
  const bjuros=document.getElementById('btn-tipo-juros');
  const bconsig=document.getElementById('btn-tipo-consig');
  const desc=document.getElementById('emp-tipo-desc');
  const consigWrap=document.getElementById('emp-consig-wrap');
  const jurosWrap=document.getElementById('emp-juros-wrap');
  const nparclbl=document.getElementById('emp-nparc-lbl');
  const nparc=document.getElementById('emp-nparc');

  if(tipo==='juros'){
    bjuros.style.background='#EA580C';bjuros.style.borderColor='#EA580C';bjuros.style.color='#fff';
    bconsig.style.background='#fff';bconsig.style.borderColor='#E5E7EB';bconsig.style.color='#6B7280';
    desc.textContent='Parcela mensal = só juros. Capital reduz com abatimentos. Gera juros diários após vencimento.';
    desc.style.background='#FFF7ED';desc.style.borderColor='#FED7AA';desc.style.color='#9A3412';
    if(consigWrap)consigWrap.style.display='none';
    if(jurosWrap)jurosWrap.style.display='';
    if(nparclbl)nparclbl.textContent='Nº de Parcelas';
    if(nparc){nparc.options[0].text='Ilimitado';}
  } else {
    bjuros.style.background='#fff';bjuros.style.borderColor='#E5E7EB';bjuros.style.color='#6B7280';
    bconsig.style.background='#2563EB';bconsig.style.borderColor='#2563EB';bconsig.style.color='#fff';
    desc.textContent='Valor total fixo. Cliente paga parcelado. Pagamento antecipado com desconto negociável.';
    desc.style.background='#EFF6FF';desc.style.borderColor='#BFDBFE';desc.style.color='#1e40af';
    if(consigWrap)consigWrap.style.display='';
    if(jurosWrap)jurosWrap.style.display='none';
    if(nparclbl)nparclbl.textContent='Nº de Parcelas *';
    if(nparc&&nparc.value==='0')nparc.value='10';
  }
  updateEmpCalc();
}

function updateEmpCalc(){
  const val=parseCurrency(document.getElementById('emp-valor')?.value)||0;
  const juros=parseFloat(document.getElementById('emp-juros')?.value)||0;
  const nparc=parseInt(document.getElementById('emp-nparc')?.value)||0;
  const box=document.getElementById('emp-calc');
  const consigWrap3=document.getElementById('calc-parc-consig-wrap');

  if(_empTipo==='consignado'){
    const valConsig=parseCurrency(document.getElementById('emp-valor-consig')?.value)||0;
    if(val>0&&valConsig>0&&box){
      box.style.display='block';
      const lucro=valConsig-val;
      const parcVal=nparc>0?parseFloat((valConsig/nparc).toFixed(2)):0;
      document.getElementById('calc-total').textContent=fmtR(valConsig);
      document.getElementById('calc-parc').textContent=fmtR(lucro>0?lucro:0);
      if(consigWrap3)consigWrap3.style.display=nparc>0?'':'none';
      if(parcVal)document.getElementById('calc-parc-consig').textContent=fmtR(parcVal);
    } else if(box){box.style.display='none';}
  } else {
    const lucro=val*juros;
    const total=val+lucro;
    if(val>0&&box){
      box.style.display='block';
      document.getElementById('calc-total').textContent=fmtR(total);
      document.getElementById('calc-parc').textContent=fmtR(lucro);
      if(consigWrap3)consigWrap3.style.display='none';
    } else if(box){box.style.display='none';}
  }
}

// ══ FUNÇÕES DE ANEXO DE ARQUIVO ══
function showFileName(input){
  const file=input.files[0];
  if(!file)return;
  
  // Validar tamanho (máximo 5MB)
  if(file.size>5*1024*1024){
    toast('⚠️ Arquivo muito grande! Máximo 5MB',true);
    input.value='';
    return;
  }
  
  // Mostrar nome do arquivo
  document.getElementById('emp-file-name').textContent=file.name;
  document.getElementById('emp-file-selected').textContent=file.name;
  document.getElementById('emp-file-preview').style.display='block';
}

function clearEmpFile(){
  document.getElementById('emp-file').value='';
  document.getElementById('emp-file-name').textContent='Clique para selecionar PDF, foto ou documento';
  document.getElementById('emp-file-preview').style.display='none';
}

function openEmpModal(id){
  editEmp=id?emprestimos.find(e=>e.id===id):null;
  document.getElementById('emp-modal-title').textContent=editEmp?'Editar Empréstimo':'Novo Empréstimo';
  const sel=document.getElementById('emp-tom');
  sel.innerHTML='<option value="">Selecione o cliente</option>'+
    tomadores.map(t=>`<option value="${t.id}">${t.nome}</option>`).join('');
  if(editEmp){
    const tipo=editEmp.tipo||'juros';
    setTipoEmp(tipo);
    sel.value=editEmp.tomador_id||'';
    document.getElementById('emp-resp').value=editEmp.responsavel||'';
    document.getElementById('emp-gar').value=editEmp.garantia||'';
    document.getElementById('emp-loc').value=editEmp.local||'';
    document.getElementById('emp-data').value=editEmp.data_emprestimo||'';
    document.getElementById('emp-valor').value=editEmp.valor||'';
    document.getElementById('emp-juros').value=editEmp.juros||'0.2';
    document.getElementById('emp-obs').value=editEmp.obs||'';
    if(tipo==='consignado'){
      const vconsig=document.getElementById('emp-valor-consig');
      if(vconsig)vconsig.value=editEmp.valor_total_consignado||'';
      const parcsCount=parcelas.filter(p=>p.emprestimo_id===editEmp.id).length;
      document.getElementById('emp-nparc').value=parcsCount||10;
    } else {
      document.getElementById('emp-nparc').value=parcelas.filter(p=>p.emprestimo_id===editEmp.id).length||1;
    }
  } else {
    setTipoEmp('juros');
    sel.value='';
    document.getElementById('emp-resp').value='';
    document.getElementById('emp-gar').value='';
    document.getElementById('emp-loc').value='';
    document.getElementById('emp-data').value=today();
    document.getElementById('emp-valor').value='';
    document.getElementById('emp-juros').value='0.2';
    document.getElementById('emp-obs').value='';
    document.getElementById('emp-nparc').value='0';
    document.getElementById('emp-calc').style.display='none';
    const vconsig=document.getElementById('emp-valor-consig');
    if(vconsig)vconsig.value='';
  }
  updateEmpCalc();
  openM('emp-modal');
}

// Função auxiliar para adicionar meses mantendo o dia do mês
// Função para adicionar meses mantendo sempre o mesmo dia
// Ex: 25/10 + 1 mês = 25/11, 25/10 + 2 meses = 25/12
function addMonths(dateStr, months){
  const d=new Date(dateStr+'T12:00:00');
  const targetDay=d.getDate(); // Guarda o dia original (ex: 25)
  
  // Adiciona os meses
  d.setMonth(d.getMonth()+months);
  
  // Força o dia a ser sempre o mesmo da data original
  // Se o dia não existir no novo mês, setDate() ajusta automaticamente
  d.setDate(targetDay);
  
  return d.toISOString().split('T')[0];
}

async function saveEmp(){
  const tomId=document.getElementById('emp-tom').value;
  const valor=parseCurrency(document.getElementById('emp-valor').value);
  const data=document.getElementById('emp-data').value;
  const nparc=parseInt(document.getElementById('emp-nparc').value)||0;
  const tipo=_empTipo||'juros';

  if(!tomId){toast('⚠ Selecione o cliente',true);return;}
  if(!valor||valor<=0){toast('⚠ Informe o valor',true);return;}
  if(!data){toast('⚠ Informe a data',true);return;}

  let juros=0, valorTotalConsig=null;

  if(tipo==='consignado'){
    valorTotalConsig=parseCurrency(document.getElementById('emp-valor-consig')?.value)||0;
    if(!valorTotalConsig||valorTotalConsig<=valor){toast('⚠ Valor total a receber deve ser maior que o emprestado',true);return;}
    if(!nparc||nparc<=0){toast('⚠ Informe o número de parcelas para consignado',true);return;}
    juros=parseFloat(((valorTotalConsig-valor)/valor).toFixed(4));
  } else {
    juros=parseFloat(document.getElementById('emp-juros').value);
  }

  const payload={
    tomador_id:tomId,
    responsavel:(document.getElementById('emp-resp').value.trim()||'').toUpperCase()||null,
    garantia:(document.getElementById('emp-gar').value.trim()||'').toUpperCase()||null,
    local:(document.getElementById('emp-loc').value.trim()||'').toUpperCase()||null,
    valor:parseFloat(valor.toFixed(2)),
    juros:parseFloat(juros.toFixed(4)),
    tipo:tipo,
    valor_total_consignado:valorTotalConsig,
    data_emprestimo:data,
    obs:document.getElementById('emp-obs').value.trim()||null,
    created_by:session.id,
    owner_id:session.id
  };

  const btn=document.querySelector('#emp-modal .btn-grn');btn.textContent='Salvando...';btn.disabled=true;
  try{
    if(editEmp){
      const{data:d,error}=await sb.from('emprestimos').update(payload).eq('id',editEmp.id).select().single();
      if(error)throw error;
      emprestimos=emprestimos.map(e=>e.id===editEmp.id?d:e);
      toast('✓ Empréstimo atualizado!');
    } else {
      const{data:d,error}=await sb.from('emprestimos').insert(payload).select().single();
      if(error)throw error;
      emprestimos.unshift(d);

      if(tipo==='consignado'){
        // Parcelas fixas: valorTotal / nparc
        const valorParc=parseFloat((valorTotalConsig/nparc).toFixed(2));
        const parcsPayload=Array.from({length:nparc},(_,i)=>{
          const venc=addMonths(data,i+1);
          return{emprestimo_id:d.id,numero:i+1,vencimento:venc,valor:valorParc,status:'pendente'};
        });
        const{data:ps,error:pe}=await sb.from('parcelas').insert(parcsPayload).select();
        if(!pe&&ps)parcelas.push(...ps);
        toast('✓ Consignado registrado! '+nparc+'× '+fmtR(valorParc));
      } else if(nparc>0){
        const valorParc=parseFloat((valor*juros).toFixed(2));
        const parcsPayload=Array.from({length:nparc},(_,i)=>{
          const venc=addMonths(data,i+1);
          return{emprestimo_id:d.id,numero:i+1,vencimento:venc,valor:valorParc,status:'pendente'};
        });
        const{data:ps,error:pe}=await sb.from('parcelas').insert(parcsPayload).select();
        if(!pe&&ps)parcelas.push(...ps);
        toast('✓ Empréstimo registrado! '+nparc+' parcela'+(nparc!==1?'s':'')+' gerada'+(nparc!==1?'s':'')+'.');
      } else {
        // Juros ilimitado: gera automaticamente a primeira parcela (vence em 1 mês no mesmo dia)
        const valorParcAuto=parseFloat((valor*juros).toFixed(2));
        const vencStrAuto=addMonths(data,1);
        const{data:pa,error:pe}=await sb.from('parcelas').insert({
          emprestimo_id:d.id,numero:1,
          vencimento:vencStrAuto,
          valor:valorParcAuto,
          status:'pendente'
        }).select().single();
        if(!pe&&pa)parcelas.push(pa);
        toast('✓ Empréstimo registrado! 1ª parcela de juros: '+fmtR(valorParcAuto)+' vence em '+fmtDate(vencStrAuto));
      }
    }
    closeM('emp-modal');
    if(curPage==='dashboard')renderDashboard();
    else renderEmprestimos();
  }catch(e){toast('Erro ao salvar',true);console.error(e);}
  btn.textContent='Salvar Empréstimo';btn.disabled=false;
}

function openClientView(tomId){
  const tom=tomadores.find(t=>t.id===tomId);
  if(!tom)return;
  const empsDoTom=emprestimos.filter(e=>e.tomador_id===tomId);
  const todasParcelas=parcelas.filter(p=>empsDoTom.some(e=>e.id===p.emprestimo_id));
  const pagas=todasParcelas.filter(p=>p.status==='pago').sort((a,b)=>b.pago_em?.localeCompare(a.pago_em||'')||0);
  const pendentes=todasParcelas.filter(p=>p.status==='pendente');
  const atrasadas=todasParcelas.filter(p=>isAtrasada(p));
  const totalEmprestado=empsDoTom.reduce((s,e)=>s+Number(e.valor||0),0);
  const totalRecebido=pagas.reduce((s,p)=>s+Number(p.valor||0),0);
  const totalPendente=pendentes.reduce((s,p)=>s+Number(p.valor||0),0);
  const progPct=todasParcelas.length?Math.round(pagas.length/todasParcelas.length*100):0;

  // Build full payment history grouped by emprestimo
  const histRows=empsDoTom.map(e=>{
    const parcsEmp=parcelas.filter(p=>p.emprestimo_id===e.id).sort((a,b)=>a.numero-b.numero);
    const pgCnt=parcsEmp.filter(p=>p.status==='pago').length;
    const atCnt=parcsEmp.filter(p=>isAtrasada(p)).length;
    const pct=e.juros*100;
    const pctStr=pct%1===0?pct.toFixed(0):pct.toFixed(1);
    const parcRows=parcsEmp.map(p=>{
      const atras=isAtrasada(p);
      const diasAtras=atras?Math.floor((new Date()-new Date(p.vencimento+'T12:00:00'))/(1000*60*60*24)):0;
      return`<div style="display:flex;align-items:center;justify-content:space-between;padding:.45rem .75rem;border-radius:6px;margin-bottom:3px;background:${p.status==='pago'?'#F0FDF4':atras?'#FEF2F2':'#F9FAFB'};border:1px solid ${p.status==='pago'?'#D1FAE5':atras?'#FECACA':'#E5E7EB'}">
        <div style="display:flex;align-items:center;gap:.6rem">
          <span style="font-size:11px;font-weight:700;color:${p.status==='pago'?'var(--grn)':atras?'var(--red)':'var(--n4)'};min-width:20px">${p.numero}°</span>
          <div>
            <div style="font-size:12px;color:var(--n3)">Venc: ${fmtDate(p.vencimento)}${atras?` <span style="color:var(--red);font-size:10px">(${diasAtras}d atraso)</span>`:''}</div>
            ${p.pago_em?`<div style="font-size:11px;color:var(--grn)">Pago em ${fmtDate(p.pago_em)}</div>`:''}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:.5rem">
          <span style="font-size:12px;font-weight:700;color:${p.status==='pago'?'var(--grn)':atras?'var(--red)':'var(--n2)'}">${fmtR(p.valor)}</span>
          <span style="font-size:10px;padding:1px 6px;border-radius:999px;font-weight:700;background:${p.status==='pago'?'var(--grn0)':atras?'var(--red0)':'#F3F4F6'};color:${p.status==='pago'?'var(--grn)':atras?'var(--red)':'var(--n4)'}">${p.status==='pago'?'Pago':atras?'Atraso':'Pendente'}</span>
        </div>
      </div>`;
    }).join('');
    return`<div style="margin-bottom:1rem;border:1px solid #E5E7EB;border-radius:var(--rs);overflow:hidden">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:.65rem 1rem;background:#F9FAFB;border-bottom:1px solid #E5E7EB;cursor:pointer;transition:all .15s" onclick="document.getElementById('client-view-modal').remove();openParcelas('${e.id}')" onmouseenter="this.style.background='#F3F4F6'" onmouseleave="this.style.background='#F9FAFB'">
        <div>
          <span style="font-weight:700;color:var(--blu)">${fmtR(e.valor)}</span>
          <span style="font-size:11px;padding:1px 7px;border-radius:999px;font-weight:700;margin-left:.4rem;${(e.tipo||'juros')==='consignado'?'background:#EFF6FF;color:#2563EB':'background:#FFF7ED;color:#EA580C'}">${(e.tipo||'juros')==='consignado'?'Consignado':'A Juros'}</span>
          <span style="font-size:12px;color:var(--n4);margin-left:.4rem">${pctStr}% · ${fmtDate(e.data_emprestimo)}</span>
          ${e.garantia?`<span style="font-size:11px;color:var(--n4);margin-left:.4rem">· ${e.garantia}</span>`:''}
        </div>
        <span style="font-size:12px;font-weight:600;color:${atCnt?'var(--red)':'var(--grn)'}">${pgCnt}/${parcsEmp.length} pagas${atCnt?` <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-left:2px"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>${atCnt}`:''}</span>
      </div>
      <div style="padding:.6rem .75rem">${parcRows||`<div style="text-align:center;color:var(--n4);padding:.5rem;font-size:12px">Ilimitado — sem parcelas definidas</div>`}</div>
    </div>`;
  }).join('');

  const div=document.createElement('div');
  div.id='client-view-modal';
  div.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:300;display:flex;align-items:center;justify-content:center;padding:1rem';
  div.onclick=e=>{if(e.target===div)div.remove();};
  div.innerHTML=`<div style="background:#fff;border-radius:var(--r);width:100%;max-width:540px;max-height:92vh;overflow-y:auto;box-shadow:var(--shm)">
    <!-- HEADER -->
    <div style="padding:1.25rem 1.5rem 1rem;border-bottom:1px solid #E5E7EB;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:#fff;z-index:1">
      <div>
        <div style="font-family:var(--FT);font-size:1.3rem;color:var(--n1)">${tom.nome}</div>
        <div style="font-size:12px;color:var(--n4);margin-top:2px">${tom.contato?`${tom.contato} · `:''} ${empsDoTom.length} empréstimo${empsDoTom.length!==1?'s':''}</div>
      </div>
      <div style="display:flex;gap:.4rem;align-items:center">
        ${tom.contato?`<a href="https://wa.me/55${tom.contato.replace(/\D/g,'')}" target="_blank" class="btn btn-sm" style="background:#16A34A;color:#fff;font-size:12px;padding:.3rem .7rem;text-decoration:none">💬 WhatsApp</a>`:''}
        <button class="btn btn-g btn-sm" style="font-size:12px" onclick="printFicha('${tom.id}')">🖨 Imprimir</button>
        <button onclick="document.getElementById('client-view-modal').remove()" style="background:none;border:none;cursor:pointer;font-size:1.2rem;color:var(--n4)">✕</button>
      </div>
    </div>
    <div style="padding:1.25rem 1.5rem">
      <!-- CARDS RESUMO -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.6rem;margin-bottom:1rem">
        <div style="background:#EFF6FF;border-radius:var(--rs);padding:.75rem;text-align:center">
          <div style="font-size:9px;color:var(--blu);font-weight:700;text-transform:uppercase;margin-bottom:3px">Total emprestado</div>
          <div style="font-family:var(--FT);font-size:1.1rem;color:var(--blu)">${fmtR(totalEmprestado)}</div>
        </div>
        <div style="background:#FFF7ED;border-radius:var(--rs);padding:.75rem;text-align:center">
          <div style="font-size:9px;color:var(--grn);font-weight:700;text-transform:uppercase;margin-bottom:3px">Recebido</div>
          <div style="font-family:var(--FT);font-size:1.1rem;color:var(--grn)">${fmtR(totalRecebido)}</div>
        </div>
        <div style="background:${atrasadas.length?'var(--red0)':'#F9FAFB'};border-radius:var(--rs);padding:.75rem;text-align:center">
          <div style="font-size:9px;color:${atrasadas.length?'var(--red)':'var(--n4)'};font-weight:700;text-transform:uppercase;margin-bottom:3px">${atrasadas.length?'Em atraso':'Saldo'}</div>
          <div style="font-family:var(--FT);font-size:1.1rem;color:${atrasadas.length?'var(--red)':'var(--n4)'}">
            ${atrasadas.length?atrasadas.length+' parcela'+(atrasadas.length>1?'s':''):
              fmtR(empsDoTom.reduce((s,e)=>s+Number(e.saldo_devedor!=null?e.saldo_devedor:e.valor||0),0))}
          </div>
        </div>
      </div>
      <!-- BARRA PROGRESSO -->
      ${todasParcelas.length?`<div style="margin-bottom:1.25rem">
        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--n4);margin-bottom:4px">
          <span>${pagas.length} de ${todasParcelas.length} parcelas pagas</span>
          <span>${progPct}%</span>
        </div>
        <div style="background:#E5E7EB;border-radius:999px;height:8px;overflow:hidden">
          <div style="background:var(--grn);height:100%;border-radius:999px;width:${progPct}%;transition:width .3s"></div>
        </div>
      </div>`:''}
      <!-- HISTÓRICO COMPLETO -->
      <div style="font-size:11px;font-weight:700;color:var(--n4);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.75rem">Histórico completo</div>
      ${histRows||'<div style="text-align:center;color:var(--n4);padding:1rem">Nenhum empréstimo.</div>'}
    </div>
  </div>`;
  document.body.appendChild(div);
}

async function addParcela(empId){
  const emp=emprestimos.find(e=>e.id===empId);
  if(!emp)return;
  // Juros sobre o SALDO atual (após abatimentos), não sobre o valor original
  const saldoAtual=parseFloat((emp.saldo_devedor!=null?emp.saldo_devedor:emp.valor).toFixed(2));
  const valorJuros=parseFloat((saldoAtual*emp.juros).toFixed(2));
  const parcsExist=parcelas.filter(p=>p.emprestimo_id===empId);
  const nextNum=parcsExist.length+1;
  const venc=addMonths(emp.data_emprestimo,nextNum);
  const{data,error}=await sb.from('parcelas').insert({
    emprestimo_id:empId,numero:nextNum,
    vencimento:venc,
    valor:valorJuros,status:'pendente'
  }).select().single();
  if(error){toast('Erro ao adicionar parcela',true);return;}
  parcelas.push(data);toast('✓ Parcela adicionada!');
  openParcelas(empId);
}

async function abrirQuitacao(empId){
  const emp=emprestimos.find(e=>e.id===empId);
  if(!emp)return;
  const tom=tomadores.find(t=>t.id===emp.tomador_id);
  const parcsEmp=parcelas.filter(p=>p.emprestimo_id===empId&&p.status==='pendente');
  const saldoAtual=parseFloat((emp.saldo_devedor!=null?emp.saldo_devedor:emp.valor).toFixed(2));
  const jurosTotal=parcsEmp.reduce((s,p)=>s+Number(p.valor||0),0);
  const totalQuitacao=parseFloat((saldoAtual+jurosTotal).toFixed(2));

  const div=document.createElement('div');
  div.id='quitar-modal-'+empId;
  div.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:500;display:flex;align-items:center;justify-content:center;padding:1rem';
  div.onclick=e=>{if(e.target===div)div.remove();};
  div.innerHTML=`<div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:1.75rem;max-width:400px;width:100%;box-shadow:var(--shm)">
    <div style="text-align:center;margin-bottom:1.25rem">
      <div style="font-size:2.5rem;margin-bottom:.5rem">💳</div>
      <div style="font-family:var(--FT);font-size:1.2rem;color:var(--n1);margin-bottom:.35rem">Quitar Empréstimo</div>
      <div style="font-size:13px;color:var(--n3)">Confirmar quitação total da dívida de <strong style="color:var(--n1)">${tom?.nome||'—'}</strong>?</div>
    </div>
    <div style="background:var(--card2);border:1px solid var(--border);border-radius:var(--rs);padding:1rem;margin-bottom:1.25rem">
      <div style="display:flex;justify-content:space-between;margin-bottom:.4rem;font-size:13px">
        <span style="color:var(--n3)">Saldo devedor</span>
        <span style="font-weight:600;color:var(--red)">${fmtR(saldoAtual)}</span>
      </div>
      ${jurosTotal>0?`<div style="display:flex;justify-content:space-between;margin-bottom:.4rem;font-size:13px">
        <span style="color:var(--n3)">Juros pendentes (${parcsEmp.length} parcela${parcsEmp.length!==1?'s':''})</span>
        <span style="font-weight:600;color:var(--amb)">${fmtR(jurosTotal)}</span>
      </div>`:''}
      <div style="height:1px;background:var(--border);margin:.5rem 0"></div>
      <div style="display:flex;justify-content:space-between;font-size:14px">
        <span style="font-weight:700;color:var(--n1)">Total a quitar</span>
        <span style="font-weight:800;color:var(--grn);font-size:1.1rem">${fmtR(totalQuitacao)}</span>
      </div>
    </div>
    <div style="font-size:12px;color:var(--n4);margin-bottom:1rem;text-align:center">
      ⚠ Esta ação marcará todas as parcelas como pagas e zerará o saldo devedor.
    </div>
    <div style="display:flex;gap:.5rem">
      <button class="btn btn-g btn-sm" style="flex:1" onclick="document.getElementById('quitar-modal-${empId}').remove()">Cancelar</button>
      <button class="btn btn-sm" style="flex:1;background:var(--grn);color:#0D0B1E;font-weight:700" onclick="confirmarQuitacao('${empId}')">✓ Confirmar Quitação</button>
    </div>
  </div>`;
  document.body.appendChild(div);
}

async function confirmarQuitacao(empId){
  const emp=emprestimos.find(e=>e.id===empId);
  if(!emp)return;
  const parcsEmp=parcelas.filter(p=>p.emprestimo_id===empId&&p.status==='pendente');
  const hoje=today();

  // Marca todas parcelas pendentes como pagas
  for(const p of parcsEmp){
    await sb.from('parcelas').update({status:'pago',pago_em:hoje,valor_pago:p.valor}).eq('id',p.id);
    parcelas=parcelas.map(x=>x.id===p.id?{...x,status:'pago',pago_em:hoje,valor_pago:p.valor}:x);
  }
  // Zera saldo devedor
  await sb.from('emprestimos').update({saldo_devedor:0}).eq('id',empId);
  emprestimos=emprestimos.map(e=>e.id===empId?{...e,saldo_devedor:0}:e);

  document.getElementById('quitar-modal-'+empId)?.remove();
  toast('✅ Empréstimo quitado com sucesso!');
  renderEmprestimos();
  if(curPage==='dashboard')renderDashboard();
}

async function deleteEmp(id){
  const emp=emprestimos.find(e=>e.id===id);
  const tom=tomadores.find(t=>t.id===emp?.tomador_id);
  if(!confirm(`Remover empréstimo de "${tom?.nome}"?\nTodas as parcelas serão removidas.`))return;
  await sb.from('parcelas').delete().eq('emprestimo_id',id);
  await sb.from('emprestimos').delete().eq('id',id);
  emprestimos=emprestimos.filter(e=>e.id!==id);
  parcelas=parcelas.filter(p=>p.emprestimo_id!==id);
  toast('Empréstimo removido');
  if(curPage==='dashboard')renderDashboard();else renderEmprestimos();
}

// ══ FILTROS DE VENCIMENTO ══
let filtroAtivo = null; // null, 'hoje', '3dias', '7dias'

function mostrarVencimento(tipo){
  // Se clicar no mesmo filtro, fecha (toggle)
  if(filtroAtivo === tipo){
    filtroAtivo = null;
    renderDashboard();
    return;
  }
  
  filtroAtivo = tipo;
  renderDashboard();
}

function voltarUltimosEmp(){
  filtroAtivo = null;
  renderDashboard();
}

// ══ PARCELAS ══
function openParcelas(empId){
  const emp=emprestimos.find(e=>e.id===empId);
  const tom=tomadores.find(t=>t.id===emp?.tomador_id);
  const parcsEmp=parcelas.filter(p=>p.emprestimo_id===empId).sort((a,b)=>a.numero-b.numero);
  document.getElementById('parc-modal-title').textContent=`${tom?.nome||'Parcelas'}`;

  const pago=parcsEmp.filter(p=>p.status==='pago').reduce((s,p)=>s+Number(p.valor||0),0);
  const pend=parcsEmp.filter(p=>p.status==='pendente').reduce((s,p)=>s+Number(p.valor||0),0);
  const atrasadasCnt=parcsEmp.filter(p=>isAtrasada(p)).length;
  const progPct=parcsEmp.length?Math.round(parcsEmp.filter(p=>p.status==='pago').length/parcsEmp.length*100):0;
  // Saldo devedor = valor original - abatimentos realizados
  const saldo=parseFloat((emp?.saldo_devedor!=null?emp.saldo_devedor:emp?.valor||0).toFixed(2));
  
  // Para empréstimos de JUROS: só considera quitado se saldo=0 E todas parcelas pagas
  // Para CONSIGNADO: quitado quando todas parcelas pagas
  const tipo=emp?.tipo||'juros';
  const todasPagas=parcsEmp.length>0&&parcsEmp.every(p=>p.status==='pago');
  const estaQuitado=tipo==='consignado'?todasPagas:(saldo===0&&todasPagas);

  document.getElementById('parc-modal-body').innerHTML=`
    <!-- INFO EMPRÉSTIMO -->
    <div style="background:#F9FAFB;border-radius:var(--rs);padding:.75rem 1rem;margin-bottom:1rem;border:1px solid #E5E7EB;font-size:12px;color:var(--n3);display:flex;flex-wrap:wrap;gap:.5rem 1.5rem">
      ${emp?.saldo_devedor!=null&&emp.saldo_devedor!==emp.valor?`<span><strong style="color:${estaQuitado?'var(--grn)':'var(--red)'}">${fmtR(saldo)}</strong> saldo devedor${estaQuitado?' (Quitado!)':''}</span><span style="color:var(--n4);text-decoration:line-through">${fmtR(emp?.valor)} original</span>`:`<span><strong>${fmtR(emp?.valor)}</strong> emprestado</span>`}
      <span><strong>${((emp?.juros||0)*100)%1===0?((emp?.juros||0)*100).toFixed(0):((emp?.juros||0)*100).toFixed(1)}%</strong> juros</span>
      <span>💵 <strong style="color:var(--grn)">${fmtR(saldo*(emp?.juros||0))}</strong>/mês</span>
      <span><strong>${fmtDate(emp?.data_emprestimo)}</strong></span>
      ${emp?.garantia?`<span><strong>${emp.garantia}</strong></span>`:''}
    </div>

    <!-- RESUMO FINANCEIRO -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.6rem;margin-bottom:1rem">
      <div style="background:var(--grn0);border-radius:var(--rs);padding:.7rem;text-align:center;border:1px solid var(--grn1)">
        <div style="font-size:9px;color:var(--grn);font-weight:700;text-transform:uppercase;margin-bottom:2px">Recebido</div>
        <div style="font-family:var(--FT);font-size:1.2rem;color:var(--grn)">${fmtR(pago)}</div>
      </div>
      <div style="background:${estaQuitado?'var(--grn0)':'var(--red0)'};border-radius:var(--rs);padding:.7rem;text-align:center;border:1px solid ${estaQuitado?'var(--grn1)':'var(--red1)'}">
        <div style="font-size:9px;color:${estaQuitado?'var(--grn)':'var(--red)'};font-weight:700;text-transform:uppercase;margin-bottom:2px">Saldo Devedor</div>
        <div style="font-family:var(--FT);font-size:1.2rem;color:${estaQuitado?'var(--grn)':'var(--red)'}">${estaQuitado?'Quitado!':fmtR(saldo)}</div>
      </div>
      <div style="background:${atrasadasCnt?'var(--red0)':'#F9FAFB'};border-radius:var(--rs);padding:.7rem;text-align:center;border:1px solid ${atrasadasCnt?'var(--red1)':'#E5E7EB'}">
        <div style="font-size:9px;color:${atrasadasCnt?'var(--red)':'var(--n4)'};font-weight:700;text-transform:uppercase;margin-bottom:2px">Atraso</div>
        <div style="font-family:var(--FT);font-size:1.2rem;color:${atrasadasCnt?'var(--red)':'var(--n4)'}">${atrasadasCnt}</div>
      </div>
    </div>

    <!-- BARRA DE PROGRESSO -->
    ${parcsEmp.length?`<div style="margin-bottom:1rem">
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--n4);margin-bottom:4px">
        <span>${parcsEmp.filter(p=>p.status==='pago').length} de ${parcsEmp.length} ${lblParcela(emp,true).toLowerCase()} pagas</span>
        <span>${progPct}%</span>
      </div>
      <div style="background:#E5E7EB;border-radius:999px;height:8px;overflow:hidden">
        <div style="background:var(--grn);height:100%;border-radius:999px;width:${progPct}%;transition:width .3s"></div>
      </div>
    </div>`:''}

    <!-- LISTA DE PARCELAS -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem">
      <div style="font-size:11px;font-weight:700;color:var(--n3);text-transform:uppercase;letter-spacing:.05em">${lblParcela(emp,true)}</div>
      ${parcsEmp.filter(p=>p.status==='pendente').length>0?`
      <button class="btn btn-xs btn-g" id="btn-sel-parc" onclick="toggleSelecaoParc('${empId}')" style="font-size:11px">Selecionar</button>`:''}
    </div>
    <div id="sel-parc-bar" style="display:none;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:var(--rs);padding:.6rem .85rem;margin-bottom:.75rem;display:none;align-items:center;justify-content:space-between;gap:.5rem">
      <div style="display:flex;align-items:center;gap:.5rem">
        <input type="checkbox" id="chk-parc-all" onchange="toggleAllParcs(this,'${empId}')" style="width:15px;height:15px;cursor:pointer"/>
        <span id="sel-parc-count" style="font-size:12px;font-weight:600;color:var(--blu)">0 selecionadas</span>
      </div>
      <button class="btn btn-xs" style="background:#16A34A;color:#fff;font-weight:700" onclick="confirmarPagamentoLote('${empId}')">✓ Confirmar selecionadas</button>
    </div>
    ${parcsEmp.length===0?`<div class="empty"><div style="font-size:2rem;margin-bottom:.5rem;color:var(--n5)">—</div><div class="empty-text">Empréstimo ilimitado — adicione parcelas conforme o pagamento.</div></div>`:''}
    ${parcsEmp.map(p=>{
      const atras=isAtrasada(p);
      const diasAtras=atras?Math.floor((new Date()-new Date(p.vencimento+'T12:00:00'))/(1000*60*60*24)):0;
      const vencHoje=p.status==='pendente'&&p.vencimento===today();
      const isPendente=p.status==='pendente';
      return`<div ${isPendente?`onclick="confirmarPagamento('${p.id}','${empId}')"`:''} style="${isPendente?'cursor:pointer;':''}display:flex;align-items:center;justify-content:space-between;padding:.7rem .85rem;margin-bottom:.4rem;border-radius:var(--rs);border:1px solid ${p.status==='pago'?'#D1FAE5':atras?'#FECACA':vencHoje?'#FDE68A':'#E5E7EB'};background:${p.status==='pago'?'#F0FDF4':atras?'#FEF2F2':vencHoje?'#FFFBEB':'#FAFAFA'}">
        ${p.status==='pendente'?`<input type="checkbox" class="chk-parc" data-id="${p.id}" onchange="onChkParcChange('${empId}')" onclick="event.stopPropagation()" style="width:15px;height:15px;cursor:pointer;margin-right:.5rem;flex-shrink:0;display:none"/>`:'<div style="width:21px;flex-shrink:0"></div>'}
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:700;color:${p.status==='pago'?'var(--grn)':atras?'var(--red)':vencHoje?'var(--amb)':'var(--n1)'}">
            ${p.numero}º ${lblParcela(emp)}
            ${atras?`<span style="font-size:10px;font-weight:400;background:var(--red);color:#fff;padding:1px 6px;border-radius:999px;margin-left:4px">${diasAtras}d atraso</span>`:''}
            ${vencHoje?`<span style="font-size:10px;font-weight:400;background:var(--amb);color:#fff;padding:1px 6px;border-radius:999px;margin-left:4px">Vence hoje</span>`:''}
            ${(emp?.tipo||'juros')==='juros'&&atras?(()=>{const mora=parseFloat((p.valor/30*diasAtras).toFixed(2));return`<span style="font-size:10px;font-weight:600;color:var(--red);margin-left:4px">+ ${fmtR(mora)} mora</span>`;})():''}
          </div>
          <div style="font-size:11px;color:var(--n4);margin-top:2px">
            Venc: <strong>${fmtDate(p.vencimento)}</strong>
            ${p.pago_em?` · Pago em: <strong style="color:var(--grn)">${fmtDate(p.pago_em)}</strong>`:''}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:.5rem;flex-shrink:0">
          <span style="font-weight:700;font-size:14px;color:${p.status==='pago'?'var(--grn)':atras?'var(--red)':'var(--n1)'}">${fmtR(p.valor)}</span>
          ${p.status==='pendente'?`
            <button class="btn btn-xs btn-grn btn-confirmar-parc" data-pid="${p.id}" onclick="event.stopPropagation();confirmarPagamento('${p.id}','${empId}')" style="font-weight:700">Confirmar</button>
            <button class="btn btn-xs btn-d" onclick="event.stopPropagation();deleteParcela('${p.id}','${empId}')" title="Remover parcela">✕</button>
          `:`<button class="btn btn-xs btn-g" onclick="event.stopPropagation();marcarPendente('${p.id}','${empId}')" title="Reverter para pendente" style="font-size:11px">Reverter</button>`}
        </div>
      </div>`;
    }).join('')}</div>`;

  // Histórico de abatimentos
  const abats=parcsEmp.filter(p=>p.status==='pago'&&p.abatimento>0);
  if(abats.length){
    const totalAbat=abats.reduce((s,p)=>s+Number(p.abatimento||0),0);
    const histHTML=abats.map(p=>`<div style="display:flex;justify-content:space-between;font-size:12px;padding:.35rem 0;border-bottom:1px solid #F3F4F6"><span style="color:var(--n3)">${p.numero}ª parcela · ${fmtDate(p.pago_em)}</span><span style="font-weight:700;color:var(--blu)">-${fmtR(p.abatimento)}</span></div>`).join('');
    const abatDiv=document.createElement('div');
    abatDiv.style.cssText='padding:.75rem;background:#EFF6FF;border-radius:var(--rs);margin-top:.75rem;border:1px solid #BFDBFE';
    abatDiv.innerHTML=`<div style="font-size:11px;font-weight:700;color:var(--blu);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.4rem">Histórico de Abatimentos</div>${histHTML}<div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;margin-top:.5rem;padding-top:.5rem;border-top:1px solid #BFDBFE"><span>Total abatido</span><span style="color:var(--blu)">${fmtR(totalAbat)}</span></div>`;
    document.getElementById('parc-modal-body').appendChild(abatDiv);
  }

  const tom2=tomadores.find(t=>t.id===emp?.tomador_id);
  const footer=document.getElementById('parc-modal').querySelector('.mfooter');
  footer.innerHTML=`
    <button class="btn btn-g btn-sm" onclick="closeM('parc-modal');openClientView('${tom2?.id}')">← Voltar</button>
    <button class="btn btn-p btn-sm" onclick="addParcela('${empId}')">+ ${lblParcela(emp)}</button>`;
  openM('parc-modal');
  // Scroll to bottom so latest parcelas are visible
  setTimeout(()=>{
    const el=document.getElementById('parc-list-scroll');
    if(el)el.scrollTop=el.scrollHeight;
  },50);
}

function confirmarPagamento(id, empId){
  const p=parcelas.find(x=>x.id===id);
  const emp=emprestimos.find(x=>x.id===empId);
  if(!p||!emp)return;

  // Juros da parcela = SALDO DEVEDOR ATUAL * taxa (não o valor original)
  // Se houve abatimento, os juros caem proporcionalmente
  const tipo=emp.tipo||'juros';
  // Saldo devedor atual (calculado antes para usar no jurosBase)
  const saldoAtualEmp=parseFloat((emp.saldo_devedor!=null?emp.saldo_devedor:emp.valor).toFixed(2));
  // Juros base da parcela
  const jurosBase=tipo==='consignado'
    ? parseFloat((emp.valor_total_consignado/parcelas.filter(x=>x.emprestimo_id===emp.id).length).toFixed(2))
    : parseFloat((saldoAtualEmp*emp.juros).toFixed(2));
  // Mora diária (só para juros mensal)
  const diasAtrasConf=tipo==='juros'&&isAtrasada(p)?Math.floor((new Date()-new Date(p.vencimento+'T12:00:00'))/(1000*60*60*24)):0;
  const mora=tipo==='juros'&&diasAtrasConf>0?parseFloat((jurosBase/30*diasAtrasConf).toFixed(2)):0;
  const jurosParc=parseFloat((jurosBase+mora).toFixed(2));
  // Saldo devedor atual (usado no resumo do pagamento)
  const saldo=tipo==='consignado'?0:saldoAtualEmp;

  const div=document.createElement('div');
  div.id='confirm-pay-'+id;
  div.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:400;display:flex;align-items:center;justify-content:center;padding:1rem';
  div.innerHTML=`<div style="background:#fff;border-radius:var(--r);padding:1.5rem;max-width:400px;width:100%;box-shadow:var(--shm)">
    <div style="font-family:var(--FT);font-size:1.2rem;color:var(--n1);margin-bottom:1rem">Registrar Pagamento</div>

    <!-- INFO PARCELA -->
    <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:var(--rs);padding:.75rem 1rem;margin-bottom:1rem;font-size:13px;color:var(--n3)">
      <strong>${p.numero}º ${lblParcela(emp)}</strong> · Venc: ${fmtDate(p.vencimento)}<br>
      <span style="color:var(--n4)">Saldo devedor atual: <strong style="color:var(--red)">${fmtR(saldo)}</strong></span>
    </div>

    <!-- JUROS (OBRIGATÓRIO) -->
    <div style="margin-bottom:.85rem">
      <div style="font-size:11px;font-weight:700;color:var(--n3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">${tipo==='consignado'?'Parcela':'Juros cobrado'} (obrigatório)</div>
      <div style="padding:.7rem 1rem;background:#FFF7ED;border:1px solid #FED7AA;border-radius:var(--rs);text-align:center">
        <div style="font-family:var(--FT);font-size:1.3rem;color:var(--grn)" id="jurs-display-${id}">${fmtR(jurosParc)}</div>
        ${mora>0?`<div style="font-size:11px;color:var(--red);margin-top:3px" id="mora-display-${id}">Inclui mora de ${diasAtrasConf}d: ${fmtR(mora)}</div>`:''}
      </div>
      ${mora>0?`
      <label style="display:flex;align-items:center;gap:.5rem;margin-top:.6rem;cursor:pointer;user-select:none">
        <input type="checkbox" id="isentar-mora-${id}" onchange="toggleIsentarMora('${id}','${empId}',${jurosBase},${mora},${saldo})"
          style="width:15px;height:15px;cursor:pointer;accent-color:#EA580C"/>
        <span style="font-size:12px;color:var(--n2)">Isentar juros de mora <span style="color:var(--n4)">(desconto de ${fmtR(mora)})</span></span>
      </label>`:''}
    </div>
    ${tipo==='consignado'?`<div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:var(--rs);padding:.65rem 1rem;margin-bottom:.85rem;font-size:12px;color:#1e40af">■ Consignado — parcela fixa sem abatimento de capital</div>`:''}

    <!-- ABATIMENTO (OPCIONAL) -->
    <div style="margin-bottom:.85rem">
      <div style="font-size:11px;font-weight:700;color:var(--n3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Abatimento no capital (opcional)</div>
      <input type="text" id="pay-abat-${id}" placeholder="R$ 0,00 — valor extra para abater a dívida"
        oninput="maskCurrency(this);updatePaySummary('${id}',${jurosParc},${saldo})"
        inputmode="numeric" style="font-size:15px;font-weight:600"/>
      <div style="font-size:11px;color:var(--n4);margin-top:4px">Informe se o cliente pagou algo além dos juros para reduzir o capital</div>
    </div>

    <!-- TOTAL E NOVO SALDO -->
    <div id="pay-summary-${id}" style="margin-bottom:.85rem;display:none;background:#ECFDF5;border:1px solid #A7F3D0;border-radius:var(--rs);padding:.75rem 1rem;font-size:13px">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px">
        <span style="color:var(--n3)">Juros</span><span style="font-weight:600;color:var(--grn)" id="ps-jur-${id}">${fmtR(jurosParc)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:4px">
        <span style="color:var(--n3)">Abatimento</span><span style="font-weight:600;color:var(--blu)" id="ps-abat-${id}">R$ 0,00</span>
      </div>
      <div style="height:1px;background:#D1FAE5;margin:.4rem 0"></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:4px">
        <span style="font-weight:700;color:var(--n1)">Total recebido</span><span style="font-weight:700;color:var(--n1)" id="ps-tot-${id}"></span>
      </div>
      <div style="display:flex;justify-content:space-between">
        <span style="color:var(--n3)">Novo saldo devedor</span><span style="font-weight:700;color:var(--red)" id="ps-saldo-${id}"></span>
      </div>
    </div>

    <!-- DATA -->
    <div style="margin-bottom:1rem">
      <div style="font-size:11px;font-weight:700;color:var(--n3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Data do recebimento</div>
      <input type="date" id="pay-date-${id}" value="${p.vencimento||today()}" style="width:100%"/>
    </div>

    <div style="display:flex;gap:.5rem;justify-content:flex-end">
      <button class="btn btn-g btn-sm" onclick="document.getElementById('confirm-pay-${id}').remove()">Cancelar</button>
      <button class="btn btn-grn btn-sm" onclick="efetivarPagamento('${id}','${empId}',${jurosParc},${saldo},${mora})">Confirmar Pagamento</button>
    </div>
  </div>`;
  document.body.appendChild(div);
}

function toggleIsentarMora(id, empId, jurosBase, mora, saldo){
  const isento=document.getElementById('isentar-mora-'+id)?.checked;
  const novoJuros=isento?jurosBase:jurosBase+mora;
  const display=document.getElementById('jurs-display-'+id);
  const moraDisplay=document.getElementById('mora-display-'+id);
  if(display) display.textContent=fmtR(novoJuros);
  if(moraDisplay) moraDisplay.style.textDecoration=isento?'line-through':'none';
  if(moraDisplay) moraDisplay.style.opacity=isento?'.5':'1';
  // Atualiza o onclick do botão confirmar com o novo valor
  const btn=document.querySelector(`#confirm-pay-${id} .btn-grn`);
  if(btn) btn.onclick=()=>efetivarPagamento(id,empId,novoJuros,saldo,mora,isento);
  // Atualiza o resumo se abatimento já preenchido
  updatePaySummary(id,novoJuros,saldo);
}

function updatePaySummary(id, jurosParc, saldo){
  const abat=parseCurrency(document.getElementById('pay-abat-'+id)?.value)||0;
  const sumDiv=document.getElementById('pay-summary-'+id);
  if(!sumDiv)return;
  if(abat>0){
    sumDiv.style.display='block';
    document.getElementById('ps-abat-'+id).textContent=fmtR(abat);
    document.getElementById('ps-tot-'+id).textContent=fmtR(jurosParc+abat);
    const novoSaldo=Math.max(0,saldo-abat);
    document.getElementById('ps-saldo-'+id).textContent=fmtR(novoSaldo);
    document.getElementById('ps-saldo-'+id).style.color=novoSaldo===0?'var(--grn)':'var(--red)';
  } else {
    sumDiv.style.display='none';
  }
}

async function efetivarPagamento(id, empId, jurosParc, saldoAtual, mora=0, moraIsenta=false){
  const datePay=document.getElementById('pay-date-'+id)?.value||today();
  const abat=parseCurrency(document.getElementById('pay-abat-'+id)?.value)||0;
  // Se checkbox de isenção marcado, recalcula sem mora
  const isentoChk=document.getElementById('isentar-mora-'+id)?.checked||false;
  const jurosReal=isentoChk&&mora>0?jurosParc-mora:jurosParc;
  const novoSaldo=Math.max(0,saldoAtual-abat);
  const totalPago=jurosReal+abat;

  const{data,error}=await sb.from('parcelas').update({
    status:'pago', pago_em:datePay,
    valor_pago:totalPago,
    abatimento:abat>0?abat:null
  }).eq('id',id).select().single();

  if(error){toast('Erro ao confirmar',true);return;}
  parcelas=parcelas.map(p=>p.id===id?data:p);

  if(abat>0){
    await sb.from('emprestimos').update({saldo_devedor:novoSaldo}).eq('id',empId);
    emprestimos=emprestimos.map(e=>e.id===empId?{...e,saldo_devedor:novoSaldo}:e);

    // Recalcula parcelas pendentes futuras com juros sobre o novo saldo
    const empAtual=emprestimos.find(e=>e.id===empId);
    if(empAtual&&(empAtual.tipo||'juros')==='juros'&&novoSaldo>0){
      const novoJurosParc=parseFloat((novoSaldo*empAtual.juros).toFixed(2));
      const pendentesFuturas=parcelas.filter(pp=>pp.emprestimo_id===empId&&pp.status==='pendente');
      if(pendentesFuturas.length>0){
        const idsPend=pendentesFuturas.map(pp=>pp.id);
        await sb.from('parcelas').update({valor:novoJurosParc}).in('id',idsPend);
        parcelas=parcelas.map(pp=>idsPend.includes(pp.id)?{...pp,valor:novoJurosParc}:pp);
      }
    }
  }

  document.getElementById('confirm-pay-'+id)?.remove();

  if(isentoChk&&mora>0){
    toast(`✓ Pago! Mora de ${fmtR(mora)} isenta.${abat>0?' Abatimento: '+fmtR(abat):''}${novoSaldo===0?' Capital quitado! 🎉':''}`);
  } else if(abat>0&&novoSaldo===0){
    toast('✓ Pagamento confirmado! Capital totalmente quitado! 🎉');
  } else if(abat>0){
    toast(`✓ Pago! Juros: ${fmtR(jurosReal)} + Abatimento: ${fmtR(abat)} → Saldo: ${fmtR(novoSaldo)}`);
  } else {
    toast('✓ Pagamento de juros confirmado!');
  }

  await autoGerarProximaParcela(empId, novoSaldo);
  openParcelas(empId);
  if(curPage==='dashboard')renderDashboard();
  else if(curPage==='emprestimos')renderEmprestimos();
}

async function autoGerarProximaParcela(empId, saldoOverride){
  const emp=emprestimos.find(e=>e.id===empId);
  if(!emp)return;

  // Saldo atual do empréstimo
  const saldo=saldoOverride!=null?saldoOverride:parseFloat((emp.saldo_devedor!=null?emp.saldo_devedor:emp.valor).toFixed(2));

  // Não gera se o capital já foi quitado
  if(saldo<=0)return;

  // Verifica se ainda existe alguma parcela pendente
  const parcsEmp=parcelas.filter(p=>p.emprestimo_id===empId);
  const temPendente=parcsEmp.some(p=>p.status==='pendente');
  if(temPendente)return;

  // Calcula a data da próxima parcela (último vencimento + 1 mês)
  const parcsOrdenadas=parcsEmp.sort((a,b)=>b.numero-a.numero);
  const ultimaParc=parcsOrdenadas[0];
  let novaData;
  if(ultimaParc){
    const dt=new Date(ultimaParc.vencimento+'T12:00:00');
    dt.setMonth(dt.getMonth()+1);
    novaData=dt.toISOString().split('T')[0];
  } else {
    // Sem parcelas anteriores: usa data do empréstimo + 1 mês
    const dt=new Date(emp.data_emprestimo+'T12:00:00');
    dt.setMonth(dt.getMonth()+1);
    novaData=dt.toISOString().split('T')[0];
  }

  const proximoNum=(ultimaParc?.numero||0)+1;
  // Juros sobre o SALDO atual (após abatimentos), não sobre o valor original
  const valorParc=parseFloat((saldo*emp.juros).toFixed(2));

  const{data:nova,error}=await sb.from('parcelas').insert({
    emprestimo_id:empId,
    numero:proximoNum,
    vencimento:novaData,
    valor:valorParc,
    status:'pendente'
  }).select().single();

  if(error){console.error('Erro ao gerar próxima parcela',error);return;}
  parcelas.push(nova);
  toast(`✓ ${lblProximo(emp)} gerado automaticamente: ${fmtDate(novaData)}`);
}

function confirmarAtrasoComDupla(parcId, tomId){
  // Primeiro modal de confirmação
  const div=document.createElement('div');
  div.id='dupla-confirm-modal';
  div.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:500;display:flex;align-items:center;justify-content:center;padding:1rem';
  div.innerHTML=`<div style="background:var(--card);border-radius:var(--r);padding:1.75rem;max-width:360px;width:100%;box-shadow:var(--shm);text-align:center">
    <div style="font-size:2.5rem;margin-bottom:.75rem">💰</div>
    <div style="font-family:var(--FT);font-size:1.1rem;color:var(--n1);margin-bottom:.5rem">Confirmar Pagamento?</div>
    <div style="font-size:13px;color:var(--n4);margin-bottom:1.5rem">Deseja realmente confirmar este pagamento e abrir a ficha do cliente?</div>
    <div style="display:flex;gap:.5rem;justify-content:center">
      <button class="btn btn-g btn-sm" onclick="document.getElementById('dupla-confirm-modal').remove()">Cancelar</button>
      <button class="btn btn-sm" style="background:#EA580C;color:#fff" onclick="document.getElementById('dupla-confirm-modal').remove();openClientView('${tomId}')">Sim, confirmar</button>
    </div>
  </div>`;
  div.onclick=e=>{if(e.target===div)div.remove();};
  document.body.appendChild(div);
}

async function marcarPago(id){
  const{data,error}=await sb.from('parcelas').update({status:'pago',pago_em:today()}).eq('id',id).select().single();
  if(error){toast('Erro ao atualizar',true);return;}
  parcelas=parcelas.map(p=>p.id===id?data:p);
  toast('✓ Parcela marcada como paga!');

  // Gera próxima parcela automaticamente se necessário
  await autoGerarProximaParcela(data.emprestimo_id);

  const modal=document.getElementById('parc-modal');
  if(modal.style.display!=='none'){
    const emp=emprestimos.find(e=>e.id===data.emprestimo_id);
    if(emp)openParcelas(emp.id);
  }
  if(curPage==='dashboard')renderDashboard();
  else if(curPage==='emprestimos')renderEmprestimos();
}

async function deleteParcela(id, empId){
  if(!confirm('Remover esta parcela?'))return;
  await sb.from('parcelas').delete().eq('id',id);
  parcelas=parcelas.filter(p=>p.id!==id);
  toast('Parcela removida');
  openParcelas(empId);
}

async function marcarPendente(id, empId){
  if(!confirm('Reverter pagamento desta parcela para pendente?'))return;
  const{data,error}=await sb.from('parcelas').update({status:'pendente',pago_em:null}).eq('id',id).select().single();
  if(error){toast('Erro ao atualizar',true);return;}
  parcelas=parcelas.map(p=>p.id===id?data:p);
  toast('Parcela revertida para pendente');
  openParcelas(empId||data.emprestimo_id);
  if(curPage==='dashboard')renderDashboard();
  else if(curPage==='emprestimos')renderEmprestimos();
}

// ══ SELEÇÃO EM LOTE DE PARCELAS ══
function toggleSelecaoParc(empId){
  const bar=document.getElementById('sel-parc-bar');
  const btn=document.getElementById('btn-sel-parc');
  const chks=document.querySelectorAll('.chk-parc');
  const btns=document.querySelectorAll('.btn-confirmar-parc');
  if(!bar)return;
  const abrindo=bar.style.display==='none'||bar.style.display==='';
  if(abrindo){
    bar.style.display='flex';
    chks.forEach(c=>c.style.display='');
    btns.forEach(b=>b.style.display='none');
    if(btn)btn.textContent='Cancelar';
  } else {
    bar.style.display='none';
    chks.forEach(c=>{c.style.display='none';c.checked=false;});
    btns.forEach(b=>b.style.display='');
    const all=document.getElementById('chk-parc-all');
    if(all)all.checked=false;
    atualizarContadorParc(empId);
    if(btn)btn.textContent='Selecionar';
  }
}

function toggleAllParcs(chk, empId){
  document.querySelectorAll('.chk-parc').forEach(c=>c.checked=chk.checked);
  atualizarContadorParc(empId);
}

function onChkParcChange(empId){
  const all=document.getElementById('chk-parc-all');
  const chks=document.querySelectorAll('.chk-parc');
  const checked=document.querySelectorAll('.chk-parc:checked');
  if(all)all.checked=checked.length===chks.length&&chks.length>0;
  atualizarContadorParc(empId);
}

function atualizarContadorParc(empId){
  const checked=document.querySelectorAll('.chk-parc:checked');
  const cnt=document.getElementById('sel-parc-count');
  const emp=emprestimos.find(e=>e.id===empId);
  if(!cnt||!emp)return;
  const total=checked.length;
  const valorTotal=parseFloat((emp.valor*emp.juros*total).toFixed(2));
  cnt.textContent=total>0?`${total} selecionada${total>1?'s':''} · ${fmtR(valorTotal)}`:'0 selecionadas';
}

async function confirmarPagamentoLote(empId){
  const checked=[...document.querySelectorAll('.chk-parc:checked')];
  if(!checked.length){toast('⚠ Selecione ao menos uma parcela',true);return;}
  const ids=checked.map(c=>c.dataset.id);
  if(!confirm(`Confirmar pagamento de ${ids.length} parcela${ids.length>1?'s':''} como pagas hoje?`))return;

  let ok=0;
  for(const id of ids){
    const{data,error}=await sb.from('parcelas').update({
      status:'pago', pago_em:today(), valor_pago:null, abatimento:null
    }).eq('id',id).select().single();
    if(!error&&data){
      parcelas=parcelas.map(p=>p.id===id?data:p);
      ok++;
    }
  }

  // Gera próxima parcela automática se necessário
  await autoGerarProximaParcela(empId);

  toast(`✓ ${ok} parcela${ok>1?'s':''} confirmada${ok>1?'s':''}!`);
  openParcelas(empId);
  if(curPage==='dashboard')renderDashboard();
  else if(curPage==='emprestimos')renderEmprestimos();
}

// ══ TOMADORES ══
function exportTomadoresExcel(){
  if(!tomadores.length){toast('⚠ Nenhum tomador para exportar.',true);return;}

  const rows=tomadores.map((t,i)=>{
    const emps=emprestimos.filter(e=>e.tomador_id===t.id);
    const totalEmp=emps.reduce((s,e)=>s+Number(e.valor||0),0);
    const saldo=emps.reduce((s,e)=>s+Number(e.saldo_devedor!=null?e.saldo_devedor:e.valor||0),0);
    return`<tr>
      <td>${i+1}</td>
      <td><strong>${t.nome}</strong></td>
      <td>${t.contato||'—'}</td>
      <td>${t.ocupacao||'—'}</td>
      <td style="text-align:center">${emps.length}</td>
      <td style="text-align:right;color:#2563EB;font-weight:700">${fmtR(totalEmp)}</td>
      <td style="text-align:right;color:#DC2626;font-weight:700">${fmtR(saldo)}</td>
    </tr>`;
  }).join('');

  const totalGeral=tomadores.reduce((s,t)=>{
    const emps=emprestimos.filter(e=>e.tomador_id===t.id);
    return s+emps.reduce((ss,e)=>ss+Number(e.valor||0),0);
  },0);

  const win=window.open('','_blank');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>GEPainel — Clientes</title>
  <style>
    body{font-family:Arial,sans-serif;padding:2rem;color:#111;font-size:13px}
    h1{font-size:1.4rem;margin-bottom:.25rem;color:#111827}
    .sub{font-size:12px;color:#6B7280;margin-bottom:1.5rem}
    table{width:100%;border-collapse:collapse}
    thead th{background:#111827;color:#fff;padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.04em}
    tbody tr:nth-child(even){background:#F9FAFB}
    tbody td{padding:7px 10px;border-bottom:1px solid #E5E7EB;font-size:12px}
    tfoot td{padding:8px 10px;font-weight:700;background:#F3F4F6;border-top:2px solid #111827}
    .footer{margin-top:2rem;font-size:11px;color:#9CA3AF;display:flex;justify-content:space-between}
    @media print{button{display:none!important}}
  
/* Badges de Planos */
.nav-badge.badge-bronze{background:linear-gradient(135deg,#CD7F32 0%,#A0522D 100%);color:#fff;border:none}
.nav-badge.badge-prata{background:linear-gradient(135deg,#C0C0C0 0%,#A8A8A8 100%);color:#fff;border:none}
.nav-badge.badge-ouro{background:linear-gradient(135deg,#FFD700 0%,#DAA520 100%);color:#fff;border:none}
.nav-badge.badge-platinum{background:linear-gradient(135deg,#E5E4E2 0%,#B8B8B8 100%);color:#1F2937;border:none;font-weight:800}
.nav-badge.badge-diamante{background:linear-gradient(135deg,#60A5FA 0%,#818CF8 60%,#C084FC 100%);color:#fff;border:none;font-weight:800;box-shadow:0 0 8px rgba(129,140,248,.45)}

</style></head><body>
  <h1>GEPainel — Lista de Clientes</h1>
  <div class="sub">Gerado em ${new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})} · ${tomadores.length} tomadores</div>
  <table>
    <thead><tr>
      <th>#</th><th>Nome</th><th>Contato</th><th>Ocupação</th>
      <th style="text-align:center">Empréstimos</th>
      <th style="text-align:right">Total Emprestado</th>
      <th style="text-align:right">Saldo Devedor</th>
    </tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr>
      <td colspan="4">Total geral</td>
      <td style="text-align:center">${emprestimos.length}</td>
      <td style="text-align:right;color:#2563EB">${fmtR(totalGeral)}</td>
      <td></td>
    </tr></tfoot>
  </table>
  <div class="footer">
    <span>GEPainel — Sistema de Gestão de Empréstimos</span>
    <span>${session?.nome||''}</span>
  </div>
  <br>
  <button onclick="window.print()" style="padding:.5rem 1.5rem;background:#111827;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">🖨 Salvar como PDF</button>
  </body></html>`);
  win.document.close();
  toast('✓ Relatório aberto — clique em "Salvar como PDF"');
}

function renderTomadores(){
  const mc=document.getElementById('main-content');

  // Calcular totais
  const totalEmprestado = tomadores.reduce((s,t)=>{
    return s + emprestimos.filter(e=>e.tomador_id===t.id).reduce((ss,e)=>ss+Number(e.valor||0),0);
  },0);
  const totalEmAberto = tomadores.reduce((s,t)=>{
    return s + emprestimos.filter(e=>e.tomador_id===t.id).reduce((ss,e)=>{
      const ep=parcelas.filter(p=>p.emprestimo_id===e.id);
      const pago=ep.filter(p=>p.status==='pago').reduce((a,p)=>a+Number(p.valor||0),0);
      return ss+Math.max(0,Number(e.valor_total||e.valor||0)-pago);
    },0);
  },0);
  const qtdAtivos = tomadores.filter(t=>!_isClienteQuitado(t)&&emprestimos.some(e=>e.tomador_id===t.id)).length;
  const qtdQuitados = tomadores.filter(t=>_isClienteQuitado(t)).length;
  const qtdSemEmp = tomadores.filter(t=>!emprestimos.some(e=>e.tomador_id===t.id)).length;

  mc.innerHTML=`
    <div class="sec-hdr">
      <span class="sec-title">Clientes</span>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap">
        <button class="btn btn-g btn-sm" onclick="exportTomadoresExcel()">↓ Exportar PDF</button>
        <button class="btn btn-p btn-sm" onclick="openTomModal(null)">+ Novo Cliente</button>
      </div>
    </div>

    <!-- Cards de resumo -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.75rem;margin-bottom:1.25rem">
      <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:1rem 1.25rem;display:flex;align-items:center;gap:.85rem">
        <div style="width:38px;height:38px;border-radius:10px;background:var(--blu0);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--blu)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <div>
          <div style="font-size:10px;font-weight:700;color:var(--n4);text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">Total Emprestado</div>
          <div style="font-family:var(--FT);font-size:1.25rem;color:var(--blu);line-height:1">${fmtR(totalEmprestado)}</div>
        </div>
      </div>
      <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:1rem 1.25rem;display:flex;align-items:center;gap:.85rem">
        <div style="width:38px;height:38px;border-radius:10px;background:var(--amb0);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--amb)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <div>
          <div style="font-size:10px;font-weight:700;color:var(--n4);text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">Em Aberto</div>
          <div style="font-family:var(--FT);font-size:1.25rem;color:var(--amb);line-height:1">${fmtR(totalEmAberto)}</div>
        </div>
      </div>
      <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:1rem 1.25rem;display:flex;align-items:center;gap:.85rem">
        <div style="width:38px;height:38px;border-radius:10px;background:var(--grn0);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--grn)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <div>
          <div style="font-size:10px;font-weight:700;color:var(--n4);text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">Clientes Ativos</div>
          <div style="font-family:var(--FT);font-size:1.25rem;color:var(--grn);line-height:1">${qtdAtivos} <span style="font-size:.75rem;color:var(--n4);font-family:var(--FB)">${qtdQuitados>0?`· ${qtdQuitados} quitado${qtdQuitados>1?'s':''}`:''}</span></div>
        </div>
      </div>
      <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:1rem 1.25rem;display:flex;align-items:center;gap:.85rem">
        <div style="width:38px;height:38px;border-radius:10px;background:var(--grn0);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--grn)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
        </div>
        <div>
          <div style="font-size:10px;font-weight:700;color:var(--n4);text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">Total de Clientes</div>
          <div style="font-family:var(--FT);font-size:1.25rem;color:var(--n1);line-height:1">${tomadores.length} <span style="font-size:.75rem;color:var(--n4);font-family:var(--FB)">${qtdSemEmp>0?`· ${qtdSemEmp} sem empréstimo`:''}</span></div>
        </div>
      </div>
    </div>

    <div style="margin-bottom:1rem"><input type="text" id="tom-s" placeholder="🔍  Buscar cliente..." oninput="filterTom()" style="max-width:360px"/></div>
    <div class="tbl-wrap">
      <table>
        <thead id="tom-thead"><tr>
          <th style="width:36px">Nº</th>
          <th class="sortable" id="th-tom-nome" onclick="sortTom('nome')">Nome<span class="sort-icon"></span></th>
          <th class="sortable" id="th-tom-contato" onclick="sortTom('contato')">Contato<span class="sort-icon"></span></th>
          <th class="hide-mobile sortable" id="th-tom-ocupacao" onclick="sortTom('ocupacao')">Ocupação<span class="sort-icon"></span></th>
          <th class="sortable" id="th-tom-emps" onclick="sortTom('emps')">Empréstimos<span class="sort-icon"></span></th>
          <th class="sortable" id="th-tom-devido" onclick="sortTom('devido')">Total Emprestado<span class="sort-icon"></span></th>
          <th></th>
        </tr></thead>
        <tbody id="tom-tbody">${tomTbodyHTML(tomadores)}</tbody>
      </table>
    </div>`;
}

function filterTom(){
  const q=(document.getElementById('tom-s')?.value||'').toLowerCase();
  const f=tomadores.filter(t=>t.nome.toLowerCase().includes(q)||(t.contato||'').includes(q)||(t.ocupacao||'').toLowerCase().includes(q));
  const sorted=applySortTom(f);
  const tb=document.getElementById('tom-tbody');if(tb)tb.innerHTML=tomTbodyHTML(sorted);
}

function _tomDataInicio(p){
  const d=new Date();
  if(p==='1m') d.setMonth(d.getMonth()-1);
  else if(p==='2m') d.setMonth(d.getMonth()-2);
  else if(p==='3m') d.setMonth(d.getMonth()-3);
  else if(p==='6m') d.setMonth(d.getMonth()-6);
  else if(p==='12m') d.setFullYear(d.getFullYear()-1);
  else return null;
  d.setHours(0,0,0,0); return d;
}

function _tomRow(t,i){
  const emps=emprestimos.filter(e=>e.tomador_id===t.id);
  const totalEmprestado=emps.reduce((s,e)=>s+Number(e.valor||0),0);
  return`<tr>
    <td style="color:var(--n4);font-size:12px">${i+1}</td>
    <td style="font-weight:600">${t.nome}</td>
    <td style="color:var(--n3)">${t.contato?`<a href="https://wa.me/55${t.contato.replace(/\D/g,'')}" target="_blank" style="color:var(--grn);text-decoration:none">${t.contato}</a>`:'—'}</td>
    <td class="hide-mobile" style="color:var(--n3)">${t.ocupacao||'—'}</td>
    <td style="font-weight:600;color:var(--blu)">${emps.length}</td>
    <td style="font-weight:700;color:${totalEmprestado>0?'var(--blu)':'var(--n4)'}">${fmtR(totalEmprestado)}</td>
    <td><div style="display:flex;gap:.3rem">
      <button class="btn btn-xs btn-g" onclick="openTomModal('${t.id}')" title="Editar"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
      <button class="btn btn-xs btn-d" onclick="deleteTom('${t.id}')">✕</button>
    </div></td>
  </tr>`;
}

function _isClienteQuitado(t){
  const emps=emprestimos.filter(e=>e.tomador_id===t.id);
  if(!emps.length) return false;
  return emps.every(e=>{
    const ep=parcelas.filter(p=>p.emprestimo_id===e.id);
    return ep.length>0&&ep.every(p=>p.status==='pago');
  });
}

function tomTbodyHTML(list){
  if(!list.length)return`<tr><td colspan="8"><div class="empty"><div style="font-size:2rem;margin-bottom:.5rem;color:var(--n5)">—</div><div class="empty-text">Nenhum cliente.</div></div></td></tr>`;
  
  const ativos=list.filter(t=>!_isClienteQuitado(t));
  const quitados=list.filter(t=>_isClienteQuitado(t));
  
  let html='';
  // Ativos
  if(ativos.length){
    html+=ativos.map((t,i)=>_tomRow(t,i+1)).join('');
  }
  // Separador + Quitados
  if(quitados.length){
    html+=`<tr><td colspan="7" style="padding:.75rem 1rem;background:#F0FDF4;border-top:2px solid #D1FAE5;border-bottom:1px solid #D1FAE5">
      <div style="display:flex;align-items:center;gap:.5rem">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        <span style="font-size:12px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:.05em">Quitados (${quitados.length})</span>
      </div>
    </td></tr>`;
    html+=quitados.map((t,i)=>{
      const row=_tomRow(t,ativos.length+i+1);
      return row.replace('<tr>',`<tr style="opacity:.7">`);
    }).join('');
  }
  return html;
}

function openTomModal(id){
  editTom=id?tomadores.find(t=>t.id===id):null;
  document.getElementById('tom-modal-title').textContent=editTom?'Editar Cliente':'Novo Cliente';
  document.getElementById('tom-nome').value=editTom?.nome||'';
  document.getElementById('tom-cont').value=editTom?.contato||'';
  const ocupEl=document.getElementById('tom-ocup');if(ocupEl)ocupEl.value=editTom?.ocupacao||'';
  const modal=document.getElementById('tom-modal');
  modal.style.display='flex';
  modal.style.zIndex='400';
  setTimeout(()=>document.getElementById('tom-nome').focus(),100);
}

async function saveTom(){
  const nome=document.getElementById('tom-nome').value.trim().toUpperCase();
  if(!nome){toast('⚠ Informe o nome',true);return;}
  const ocupEl=document.getElementById('tom-ocup');
  const ocupacao=ocupEl?.value.trim().toUpperCase()||null;
  const contato=document.getElementById('tom-cont').value.trim()||null;

  // Tenta salvar com ocupacao; se falhar (coluna não existe), salva sem ela
  async function tryInsert(payload){
    if(editTom){
      const{data,error}=await sb.from('tomadores').update(payload).eq('id',editTom.id).select().single();
      return{data,error};
    } else {
      const{data,error}=await sb.from('tomadores').insert(payload).select().single();
      return{data,error};
    }
  }

  let payload={nome,contato,ocupacao,owner_id:session.id};
  let{data,error}=await tryInsert(payload);

  // Se deu erro de coluna inexistente, tenta sem ocupacao
  if(error&&(error.message?.includes('ocupacao')||error.code==='42703')){
    payload={nome,contato,owner_id:session.id};
    const res=await tryInsert(payload);
    data=res.data;error=res.error;
    if(!error&&data)data.ocupacao=ocupacao; // mantém na memória local
  }

  if(error){toast('Erro ao salvar: '+error.message,true);return;}

  if(editTom){
    tomadores=tomadores.map(t=>t.id===editTom.id?{...data,ocupacao}:t);
    toast('✓ Cliente atualizado');
  } else {
    const tomComOcup={...data,ocupacao};
    tomadores.push(tomComOcup);
    tomadores.sort((a,b)=>a.nome.localeCompare(b.nome));
    const sel=document.getElementById('emp-tom');
    if(sel){sel.innerHTML='<option value="">Selecione o cliente</option>'+tomadores.map(t=>`<option value="${t.id}">${t.nome}</option>`).join('');sel.value=data.id;}
    toast('✓ Cliente cadastrado');
  }
  closeM('tom-modal');
  if(curPage==='tomadores')renderTomadores();
}

async function deleteTom(id){
  const t=tomadores.find(x=>x.id===id);
  const cnt=emprestimos.filter(e=>e.tomador_id===id).length;
  if(cnt>0&&!confirm(`"${t?.nome}" possui ${cnt} empréstimo${cnt!==1?'s':''}. Remover mesmo assim?`))return;
  if(cnt===0&&!confirm(`Remover cliente "${t?.nome}"?`))return;
  await sb.from('tomadores').delete().eq('id',id);
  tomadores=tomadores.filter(x=>x.id!==id);
  toast('Cliente removido');renderTomadores();
}

// ══ SIMULADOR ══
function renderSimulador(){
  const mc=document.getElementById('main-content');
  mc.innerHTML=`
    <div class="sec-hdr"><span class="sec-title">Simulador de Juros</span></div>
    <div class="card" style="max-width:480px">
      <div class="card-title">Calcular Empréstimo</div>
      <div class="fgrid">
        <div class="fg"><span class="lbl">Valor (R$)</span>
          <input type="text" id="sim-val" placeholder="Ex: 1.000,00" oninput="maskCurrency(this);calcSim()" inputmode="numeric" style="font-size:16px;font-weight:700"/>
        </div>
        <div class="fg"><span class="lbl">Juros (%)</span>
          <select id="sim-jur" onchange="calcSim()">
            <option value="0.05">5%</option>
            <option value="0.075">7,5%</option>
            <option value="0.1">10%</option>
            <option value="0.15">15%</option>
            <option value="0.2" selected>20%</option>
            <option value="0.25">25%</option>
            <option value="0.3">30%</option>
            <option value="0.4">40%</option>
            <option value="0.5">50%</option>
          </select>
        </div>
      </div>
      <div id="sim-result" style="margin-top:1rem"></div>
    </div>
    <div class="card" style="margin-top:1rem">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:.5rem">
        <div class="card-title" style="margin-bottom:0">Tabela de Referência</div>
        <div style="display:flex;align-items:center;gap:.5rem">
          <span style="font-size:12px;color:var(--n3);font-weight:600">Juros:</span>
          <select id="ref-jur" onchange="updateRefTable()" style="width:auto;padding:.35rem .75rem;font-size:13px;font-weight:600">
            <option value="0.05">5%</option>
            <option value="0.075">7,5%</option>
            <option value="0.1">10%</option>
            <option value="0.15">15%</option>
            <option value="0.2" selected>20%</option>
            <option value="0.25">25%</option>
            <option value="0.3">30%</option>
            <option value="0.4">40%</option>
            <option value="0.5">50%</option>
          </select>
        </div>
      </div>
      <div class="tbl-wrap" id="ref-table-wrap"></div>
    </div>`;
  updateRefTable();
  calcSim();
}

function updateRefTable(highlightVal=null){
  const jur=parseFloat(document.getElementById('ref-jur')?.value)||0.2;
  const wrap=document.getElementById('ref-table-wrap');
  if(!wrap)return;

  const recoveryMonth=Math.ceil(1/jur);
  const maxMonths=Math.min(recoveryMonth+2,20);
  const hdrCols=Array.from({length:maxMonths},(_,i)=>`<th style="text-align:center;min-width:82px">${i+1}° mês</th>`).join('');

  const buildCells=(v)=>Array.from({length:maxMonths},(_,i)=>{
    const mes=i+1;const cumul=v*jur*mes;
    const isRec=mes===recoveryMonth;const past=mes>recoveryMonth;
    if(isRec)return`<td style="text-align:center;padding:.4rem .25rem"><div style="background:#EA580C;color:#fff;font-weight:800;font-size:12px;border-radius:6px;padding:3px 6px;animation:blink-grn 1.2s ease-in-out infinite;display:inline-block">${fmtR(cumul)}<div style="font-size:9px;opacity:.9">✓ Recuperado!</div></div></td>`;
    if(past)return`<td style="text-align:center;padding:.4rem .25rem"><div style="color:var(--grn);font-weight:600;font-size:12px;background:var(--grn0);border-radius:4px;padding:2px 5px;display:inline-block">${fmtR(cumul)}</div></td>`;
    return`<td style="text-align:center;padding:.4rem .25rem;color:var(--grn);font-weight:600;font-size:12px">${fmtR(cumul)}</td>`;
  }).join('');

  // Se tiver valor digitado: mostra só ele. Senão, mostra tabela completa.
  if(highlightVal&&highlightVal>0){
    wrap.innerHTML=`<table>
      <thead><tr>
        <th>Valor emprestado</th><th>Saída (capital)</th>${hdrCols}
      </tr></thead>
      <tbody>
        <tr style="background:#EFF6FF">
          <td style="font-weight:800;color:var(--blu);font-size:13px">${fmtR(highlightVal)}</td>
          <td style="color:var(--n2);font-weight:600">${fmtR(highlightVal)}</td>
          ${buildCells(highlightVal)}
        </tr>
      </tbody>
    </table>`;
  } else {
    const valores=[300,400,500,600,700,800,900,1000,2000,3000,4000,5000,10000,20000,50000];
    const rows=valores.map(v=>`<tr>
      <td style="font-weight:700;color:var(--blu)">${fmtR(v)}</td>
      <td style="color:var(--n3);font-weight:500">${fmtR(v)}</td>
      ${buildCells(v)}
    </tr>`).join('');
    wrap.innerHTML=`<table>
      <thead><tr>
        <th>Valor emprestado</th><th>Saída (capital)</th>${hdrCols}
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }
}

function calcSim(){
  const val=parseCurrency(document.getElementById('sim-val')?.value)||0;
  const jur=parseFloat(document.getElementById('sim-jur')?.value)||0.2;
  const res=document.getElementById('sim-result');
  if(!res)return;

  if(!val){
    res.innerHTML='';
    // Sync ref table juros
    const refJur=document.getElementById('ref-jur');
    if(refJur&&refJur.value!==String(jur)){refJur.value=String(jur);}
    updateRefTable();
    return;
  }

  const jurosM=val*jur;
  const recoveryMonth=Math.ceil(1/jur);
  const pct=(jur*100)%1===0?(jur*100).toFixed(0):(jur*100).toFixed(1);

  // Show only 2 summary cards in sim-result
  res.innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
      <div style="background:var(--blu0);border-radius:var(--rs);padding:.85rem;text-align:center">
        <div style="font-size:10px;color:var(--blu);font-weight:700;text-transform:uppercase;margin-bottom:3px">Juros por mês</div>
        <div style="font-family:var(--FT);font-size:1.4rem;color:var(--blu)">${fmtR(jurosM)}</div>
      </div>
      <div style="background:var(--grn0);border-radius:var(--rs);padding:.85rem;text-align:center">
        <div style="font-size:10px;color:var(--grn);font-weight:700;text-transform:uppercase;margin-bottom:3px">Capital recuperado em</div>
        <div style="font-family:var(--FT);font-size:1.4rem;color:var(--grn)">${recoveryMonth} ${recoveryMonth===1?'mês':'meses'}</div>
      </div>
    </div>`;

  // Sync ref-jur and update table (highlighted row appears there)
  const refJur=document.getElementById('ref-jur');
  if(refJur&&refJur.value!==String(jur)){refJur.value=String(jur);}
  updateRefTable(val);
}

// ══ PERFIL ══

// ══ RENOVAÇÕES (ADMIN) ══
async function renderRenovacoes(){
  if(session.role!=='admin'){navTo('dashboard');return;}
  
  const mc=document.getElementById('main-content');
  mc.innerHTML='<div style="text-align:center;padding:2rem"><div class="loading-dots"><span></span><span></span><span></span></div></div>';
  
  // Buscar renovações pendentes
  const{data:renovs,error}=await sb.from('renewals')
    .select('*,users(nome,email,login)')
    .order('created_at',{ascending:false});
  
  if(error){
    console.error(error);
    mc.innerHTML='<div class="empty">Erro ao carregar renovações</div>';
    return;
  }
  
  const pendentes=renovs.filter(r=>r.status==='pending');
  const confirmadas=renovs.filter(r=>r.status==='confirmed');
  
  mc.innerHTML=`
    <div class="sec-hdr">
      <span class="sec-title">Renovações PIX</span>
      <div style="display:flex;gap:.5rem">
        <span class="bdg" style="background:var(--amb0);color:var(--amb)">${pendentes.length} pendentes</span>
        <span class="bdg" style="background:var(--grn0);color:var(--grn)">${confirmadas.length} confirmadas</span>
      </div>
    </div>
    
    ${pendentes.length>0?`
      <div class="card">
        <div class="card-title" style="color:var(--amb)">⏳ Aguardando Confirmação</div>
        <div class="tbl-wrap">
          <table>
            <thead><tr>
              <th>Cliente</th>
              <th>Plano</th>
              <th>Valor</th>
              <th>Data</th>
              <th>Ações</th>
            </tr></thead>
            <tbody>
              ${pendentes.map(r=>{
                const user=r.users;
                const userName=user?.nome||user?.login||'—';
                return`<tr>
                  <td><strong>${userName}</strong><br><span style="font-size:11px;color:var(--n4)">${user?.email||''}</span></td>
                  <td><span class="bdg" style="background:var(--blu0);color:var(--blu)">${r.plan_type}</span></td>
                  <td style="font-weight:700;color:var(--grn)">R$ ${r.amount.toFixed(2).replace('.',',')}</td>
                  <td style="font-size:12px;color:var(--n3)">${new Date(r.created_at).toLocaleString('pt-BR')}</td>
                  <td>
                    <button class="btn btn-grn btn-sm" onclick="confirmarRenovacao('${r.id}','${r.user_id}',${r.dias})">
                      ✓ Confirmar ${r.plan_type}
                    </button>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `:`<div class="card"><div class="empty">Nenhuma renovação pendente</div></div>`}
    
    ${confirmadas.length>0?`
      <div class="card">
        <div class="card-title" style="color:var(--grn)">✓ Confirmadas</div>
        <div class="tbl-wrap">
          <table>
            <thead><tr>
              <th>Cliente</th>
              <th>Plano</th>
              <th>Valor</th>
              <th>Confirmado em</th>
            </tr></thead>
            <tbody>
              ${confirmadas.slice(0,20).map(r=>{
                const user=r.users;
                const userName=user?.nome||user?.login||'—';
                return`<tr style="opacity:0.7">
                  <td>${userName}</td>
                  <td><span class="bdg bdg-ok">${r.plan_type}</span></td>
                  <td style="color:var(--grn)">R$ ${r.amount.toFixed(2).replace('.',',')}</td>
                  <td style="font-size:12px">${r.confirmed_at?new Date(r.confirmed_at).toLocaleString('pt-BR'):'—'}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `:''}
  `;
}

function renderPerfil(){
  const mc=document.getElementById('main-content');
  const avatarHTML=session.avatar_url
    ?`<img src="${session.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`
    :`<span style="font-size:2rem;font-weight:700">${ini(session.nome)}</span>`;
  const avStyle=session.avatar_url?'background:transparent':'background:#FFF7ED';
  mc.innerHTML=`
    <div class="sec-hdr"><span class="sec-title">Meu Perfil</span><button class="btn btn-grn btn-sm" onclick="abrirIndicacao()">🎁 Indicar amigo</button></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;max-width:800px" class="perfil-grid">
      <div class="card">
        <div class="card-title">Foto de Perfil</div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:1.25rem">
          <div id="avatar-preview" style="width:100px;height:100px;border-radius:50%;${avStyle};display:flex;align-items:center;justify-content:center;color:#111;border:3px solid #E5E7EB;overflow:hidden;flex-shrink:0">
            ${avatarHTML}
          </div>
          <div style="text-align:center">
            <div style="font-weight:600;font-size:16px">${session.nome}</div>
            <div style="font-size:13px;color:var(--n4);margin-top:2px">@${session.login||''} · ${session.role==='admin'?'👑 Admin':(()=>{let pl=getUserPlan(session.plan_type);if(!pl&&session.expires_at){const d=Math.ceil((new Date(session.expires_at)-new Date())/(1000*60*60*24));pl=_inferPlanByDias(d);}return pl?pl.name:'👑 Vitalício';})()}</div>
          </div>
          <div style="width:100%">
            <div style="font-size:11px;font-weight:700;color:var(--n3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:.5rem">Selecionar foto</div>
            <input type="file" id="avatar-file" accept="image/*" onchange="previewAvatar(this)"
              style="width:100%;padding:.5rem;border:1px dashed #D1D5DB;border-radius:var(--rs);background:#F9FAFB;color:var(--n3);font-size:13px;cursor:pointer"/>
            <div style="font-size:11px;color:var(--n4);margin-top:.4rem">JPG, PNG ou WEBP · Máximo 2MB</div>
          </div>
          <button class="btn btn-p btn-full" onclick="uploadAvatar()">Salvar foto</button>
          ${session.avatar_url?`<button class="btn btn-g btn-full" onclick="removeAvatar()" style="margin-top:-.5rem">Remover foto</button>`:''}
        </div>
      </div>
      
      <div class="card">
        <div class="card-title">Dados Pessoais</div>
        <div style="display:flex;flex-direction:column;gap:.85rem">
          <div class="fg">
            <span class="lbl">Nome completo</span>
            <input type="text" id="p-nome" value="${session.nome||''}" placeholder="Seu nome completo"/>
          </div>
          <div class="fg">
            <span class="lbl">E-mail</span>
            <input type="email" id="p-email" value="${session.email||''}" placeholder="seu@email.com"/>
            <div style="font-size:11px;color:var(--n4);margin-top:.3rem">
              ${session.email?'✓ E-mail cadastrado':'⚠️ Adicione seu e-mail para recuperar senha'}
            </div>
          </div>
          <button class="btn btn-p btn-full" onclick="savePerfilDados()">Salvar dados</button>
        </div>
      </div>
      
      <div class="card">
        <div class="card-title">Trocar Senha</div>
        <div style="display:flex;flex-direction:column;gap:.85rem">
          <div class="fg"><span class="lbl">Senha atual</span><input type="password" id="p-pwd-old" placeholder="••••••••"/></div>
          <div class="fg">
            <span class="lbl">Nova senha</span>
            <input type="password" id="p-pwd-new" placeholder="Mínimo 4 caracteres"/>
          </div>
          <div class="fg">
            <span class="lbl">Confirmar nova senha</span>
            <input type="password" id="p-pwd-new2" placeholder="Repita a nova senha" oninput="checkPwdMatch()"/>
            <div id="pwd-match" style="margin-top:.3rem;font-size:11px"></div>
          </div>
          <button class="btn btn-p btn-full" onclick="savePerfilSenha()">Alterar senha</button>
          <div style="padding:.75rem 1rem;background:#F9FAFB;border-radius:var(--rs);font-size:12px;color:var(--n3);border:1px solid #E5E7EB">
            Use ao menos 4 caracteres. Recomendamos misturar letras, números e símbolos.
          </div>
        </div>
      </div>
    </div>

    <!-- PREFERÊNCIAS DO APP -->
    <div class="card" style="margin-top:1.25rem;max-width:800px">
      <div class="card-title">Preferências do App</div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:.5rem 0">
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--n1)">Barra de navegação inferior</div>
          <div style="font-size:12px;color:var(--n4);margin-top:2px">Substitui o menu lateral por barra no rodapé (ideal para mobile)</div>
        </div>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <div id="bottom-nav-toggle" onclick="toggleBottomNav()"
            style="width:44px;height:24px;border-radius:999px;background:${localStorage.getItem('ep_bottom_nav')==='1'?'#EA580C':'#D1D5DB'};position:relative;cursor:pointer;transition:background .2s;flex-shrink:0">
            <div id="bottom-nav-knob" style="width:20px;height:20px;border-radius:50%;background:#fff;position:absolute;top:2px;left:${localStorage.getItem('ep_bottom_nav')==='1'?'22':'2'}px;transition:left .2s;box-shadow:0 1px 3px rgba(0,0,0,.2)"></div>
          </div>
          <span id="bottom-nav-lbl" style="font-size:13px;font-weight:600;color:var(--n4)">${localStorage.getItem('ep_bottom_nav')==='1'?'Ativo':'Inativo'}</span>
        </label>
      </div>
    </div>`;
}

function previewAvatar(input){
  const file=input.files[0];
  if(!file)return;
  if(file.size>2*1024*1024){toast('⚠ Imagem muito grande (máx 2MB)',true);input.value='';return;}
  const reader=new FileReader();
  reader.onload=e=>{
    const prev=document.getElementById('avatar-preview');
    if(prev)prev.innerHTML=`<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`;
  };
  reader.readAsDataURL(file);
}

async function uploadAvatar(){
  const input=document.getElementById('avatar-file');
  if(!input||!input.files[0]){toast('⚠ Selecione uma foto',true);return;}
  const file=input.files[0];
  if(file.size>2*1024*1024){toast('⚠ Imagem muito grande (máx 2MB)',true);return;}
  const ext=file.name.split('.').pop();
  const path=`${session.id}/avatar.${ext}`;
  await sb.storage.from('avatars').remove([path]);
  const{error:upErr}=await sb.storage.from('avatars').upload(path,file,{upsert:true,contentType:file.type});
  if(upErr){toast('Erro ao enviar foto',true);return;}
  const{data:urlData}=sb.storage.from('avatars').getPublicUrl(path);
  const avatarUrl=urlData.publicUrl+'?t='+Date.now();
  const{error:dbErr}=await sb.from('users').update({avatar_url:avatarUrl}).eq('id',session.id);
  if(dbErr){toast('Erro ao salvar',true);return;}
  session.avatar_url=avatarUrl;saveSession(session);
  const nav_av=document.getElementById('nav-av');
  if(nav_av){nav_av.style.cssText='background:transparent;padding:0;overflow:hidden;';nav_av.innerHTML=`<img src="${avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`;}
  users=users.map(u=>u.id===session.id?{...u,avatar_url:avatarUrl}:u);
  toast('✓ Foto atualizada!');renderPerfil();
}

async function removeAvatar(){
  if(!confirm('Remover foto de perfil?'))return;
  const ext=session.avatar_url?.split('.').pop()?.split('?')[0]||'jpg';
  await sb.storage.from('avatars').remove([`${session.id}/avatar.${ext}`]);
  await sb.from('users').update({avatar_url:null}).eq('id',session.id);
  session.avatar_url=null;saveSession(session);
  const nav_av=document.getElementById('nav-av');
  if(nav_av){nav_av.innerHTML=ini(session.nome);nav_av.style.cssText=AV_STYLE[session.role]||AV_STYLE.op;}
  users=users.map(u=>u.id===session.id?{...u,avatar_url:null}:u);
  toast('✓ Foto removida');renderPerfil();
}

function checkPwdMatch(){
  const nw=document.getElementById('p-pwd-new')?.value||'';
  const nw2=document.getElementById('p-pwd-new2')?.value||'';
  const el=document.getElementById('pwd-match');if(!el||!nw2)return;
  if(nw===nw2){el.textContent='✓ Senhas coincidem';el.style.color='var(--grn)';}
  else{el.textContent='✕ Senhas não coincidem';el.style.color='var(--red)';}
}

async function savePerfilDados(){
  const nome=document.getElementById('p-nome')?.value?.trim()||'';
  const email=document.getElementById('p-email')?.value?.trim()||'';
  
  if(!nome){toast('⚠ Nome é obrigatório',true);return;}
  
  // Valida e-mail se preenchido
  if(email&&!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)){
    toast('⚠ E-mail inválido',true);return;
  }
  
  // Verifica se e-mail já está em uso
  if(email){
    const{data:existente}=await sb.from('users').select('id').eq('email',email).single();
    if(existente&&existente.id!==session.id){
      toast('⚠ Este e-mail já está cadastrado',true);return;
    }
  }
  
  const{error}=await sb.from('users').update({nome,email:email||null}).eq('id',session.id);
  if(error){toast('Erro ao salvar',true);return;}
  
  // Atualiza session e users
  session.nome=nome;
  session.email=email||null;
  saveSession(session);
  users=users.map(x=>x.id===session.id?{...x,nome,email:email||null}:x);
  
  toast('✓ Dados salvos com sucesso!');
  renderPerfil();
}

async function savePerfilSenha(){
  const old=document.getElementById('p-pwd-old')?.value||'';
  const nw=document.getElementById('p-pwd-new')?.value||'';
  const nw2=document.getElementById('p-pwd-new2')?.value||'';
  const u=users.find(x=>x.id===session.id);
  if(!u||u.pass_hash!==hp(old)){toast('⚠ Senha atual incorreta',true);return;}
  if(nw.length<4){toast('⚠ Nova senha muito curta',true);return;}
  if(nw!==nw2){toast('⚠ As senhas não coincidem',true);return;}
  const{error}=await sb.from('users').update({pass_hash:hp(nw)}).eq('id',session.id);
  if(error){toast('Erro ao salvar',true);return;}
  users=users.map(x=>x.id===session.id?{...x,pass_hash:hp(nw)}:x);
  document.getElementById('p-pwd-old').value='';
  document.getElementById('p-pwd-new').value='';
  document.getElementById('p-pwd-new2').value='';
  document.getElementById('pwd-match').textContent='';
  toast('✓ Senha alterada com sucesso!');
}

// ══ USUÁRIOS ══
async function renderUsuarios(){
  const mc=document.getElementById('main-content');
  mc.innerHTML=`
    <div class="sec-hdr">
      <span class="sec-title">Usuários</span>
      <button class="btn btn-p btn-sm" onclick="openUsrModal(null)">+ Novo Usuário</button>
    </div>
    <div id="renov-pendentes-section"></div>
    <div id="usr-list">${usrListHTML()}</div>`;

  // Carrega renovações pendentes
  await carregarRenovacoesPendentes();
}

async function carregarRenovacoesPendentes(){
  const sec=document.getElementById('renov-pendentes-section');
  if(!sec)return;
  try{
    const{data,error}=await sb.from('renovacoes').select('*').eq('status','pendente').order('created_at',{ascending:false});
    if(error||!data||!data.length){sec.innerHTML='';return;}

    sec.innerHTML=`
      <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:var(--r);padding:1.25rem;margin-bottom:1.25rem">
        <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.85rem">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span style="font-weight:700;color:#92400E;font-size:14px">Renovações Pendentes (${data.length})</span>
        </div>
        ${data.map(r=>`
          <div style="background:#fff;border:1px solid #FDE68A;border-radius:var(--rs);padding:.85rem 1rem;display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem;gap:.75rem;flex-wrap:wrap">
            <div>
              <div style="font-weight:700;font-size:14px">${r.user_nome}</div>
              <div style="font-size:12px;color:var(--n4)">@${r.user_login} · ${r.plano} · <strong style="color:#EA580C">R$ ${Number(r.valor).toFixed(2).replace('.',',')}</strong></div>
              <div style="font-size:11px;color:var(--n4);margin-top:2px">${new Date(r.created_at).toLocaleString('pt-BR')}</div>
            </div>
            <div style="display:flex;gap:.4rem">
              <button class="btn btn-sm" style="background:#16A34A;color:#fff" onclick="confirmarRenovacao('${r.id}','${r.user_id}',${r.dias})">✓ Confirmar</button>
              <button class="btn btn-d btn-sm" onclick="rejeitarRenovacao('${r.id}')">✕ Rejeitar</button>
            </div>
          </div>`).join('')}
      </div>`;
  }catch(e){console.warn('Erro ao carregar renovacoes',e);}
}

async function confirmarRenovacao(renovId, userId, dias){
  if(!confirm('Confirmar pagamento e renovar acesso por '+dias+' dias?'))return;
  // Calcula nova data de expiração
  const u=users.find(x=>x.id===userId);
  const base=u?.expires_at&&new Date(u.expires_at)>new Date()?new Date(u.expires_at):new Date();
  base.setDate(base.getDate()+dias);
  const novaData=base.toISOString().split('T')[0];

  // Atualiza user
  const{error:ue}=await sb.from('users').update({expires_at:novaData}).eq('id',userId);
  if(ue){toast('Erro ao atualizar acesso',true);return;}

  // Marca renovação como confirmada
  await sb.from('renovacoes').update({status:'confirmado'}).eq('id',renovId);

  // Atualiza local
  users=users.map(u=>u.id===userId?{...u,expires_at:novaData}:u);

  toast('✓ Acesso renovado até '+new Date(novaData).toLocaleDateString('pt-BR')+'!');
  renderUsuarios();
}

async function rejeitarRenovacao(renovId){
  if(!confirm('Rejeitar esta solicitação?'))return;
  await sb.from('renovacoes').update({status:'rejeitado'}).eq('id',renovId);
  toast('Solicitação rejeitada.');
  renderUsuarios();
}

function usrListHTML(){
  return users.map(u=>{
    const isSelf=u.id===session.id;
    const av=u.role==='admin'?'background:#FDE68A;color:#78350F':'background:#D1FAE5;color:#065F46';
    return`<div style="background:#fff;border:1px solid #E5E7EB;border-radius:var(--r);padding:1rem 1.25rem;display:flex;align-items:center;gap:1rem;margin-bottom:.65rem;box-shadow:var(--sh)">
      <div style="width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;flex-shrink:0;${av}">${ini(u.nome)}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:17px;color:#1E293B;margin-bottom:3px">
          ${u.nome}${isSelf?' <span style="font-size:11px;color:#64748B;font-weight:400">(você)</span>':''}
          ${u.email?`<span style="font-size:13px;color:#64748B;font-weight:400;margin-left:8px">· ${u.email}</span>`:''}
        </div>
        <div style="font-size:12px;color:#64748B;display:flex;align-items:center;gap:.4rem;flex-wrap:wrap">
          @${u.login} · ${getPlanBadgeHTML(u)}
          ${(()=>{
            if(u.role==='admin')return'';
            if(!u.expires_at)return'<span class="bdg" style="background:#DCFCE7;color:#166534">✓ Vitalício</span>';
            const dias=Math.ceil((new Date(u.expires_at)-new Date())/(1000*60*60*24));
            if(dias<0)return'<span class="bdg" style="background:#FEE2E2;color:#991B1B">⛔ Expirado</span>';
            if(dias<=7)return`<span class="bdg" style="background:#FEF3C7;color:#92400E">⚠ ${dias}d restantes</span>`;
            if(dias<=30)return`<span class="bdg" style="background:#FFF7ED;color:#EA580C">Free · ${dias}d restantes</span>`;
            return`<span class="bdg" style="background:#EFF6FF;color:#1d4ed8">Ativo · ${dias}d</span>`;
          })()}
        </div>
      </div>
      <div style="display:flex;gap:.4rem">
        <button class="btn btn-g btn-sm" onclick="openUsrModal('${u.id}')"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Editar</button>
        ${!isSelf?`<button class="btn btn-d btn-sm" onclick="deleteUsr('${u.id}')">✕</button>`:''}
      </div>
    </div>`;
  }).join('');
}

function openUsrModal(id){
  editUsr=id?users.find(u=>u.id===id):null;
  document.getElementById('usr-modal-title').textContent=editUsr?'Editar Usuário':'Novo Usuário';
  document.getElementById('um-nome').value=editUsr?.nome||'';
  document.getElementById('um-login').value=editUsr?.login||'';
  document.getElementById('um-role').value=editUsr?.role||'op';
  document.getElementById('um-pass').value='';document.getElementById('um-pass2').value='';
  document.getElementById('um-pass').placeholder=editUsr?'Deixe em branco para não alterar':'Mínimo 4 caracteres';
  document.getElementById('um-p2w').style.display=editUsr?'none':'flex';
  // Acesso
  const acessoSel=document.getElementById('um-acesso');
  const acessoInfo=document.getElementById('um-acesso-info');
  if(editUsr?.expires_at){
    const dias=Math.ceil((new Date(editUsr.expires_at)-new Date())/(1000*60*60*24));
    acessoSel.value='30'; // default, não altera
    if(acessoInfo) acessoInfo.textContent=dias>0?`Expira em ${dias} dias (${new Date(editUsr.expires_at).toLocaleDateString('pt-BR')})`:'⛔ Acesso expirado';
  } else if(editUsr){
    acessoSel.value='0';
    if(acessoInfo) acessoInfo.textContent='Acesso vitalício';
  } else {
    acessoSel.value='30';
    if(acessoInfo) acessoInfo.textContent='Novo usuário recebe 30 dias de trial';
  }
  acessoSel.onchange=()=>{
    const v=parseInt(acessoSel.value);
    if(acessoInfo) acessoInfo.textContent=v===0?'Sem data de expiração':`Acesso por ${v} dias a partir de hoje`;
  };
  openM('usr-modal');
}

async function saveUsr(){
  const nome=document.getElementById('um-nome').value.trim().toUpperCase();
  const login=document.getElementById('um-login').value.trim().toLowerCase();
  const role=document.getElementById('um-role').value;
  const pass=document.getElementById('um-pass').value;
  const pass2=document.getElementById('um-pass2').value;
  if(!nome||!login){toast('⚠ Preencha nome e login',true);return;}
  if(users.find(u=>u.login===login&&u.id!==editUsr?.id)){toast('⚠ Login já em uso',true);return;}
  const diasAcesso=parseInt(document.getElementById('um-acesso')?.value||'30');
  let expiresAt=null;
  if(diasAcesso>0){
    const d=new Date();d.setDate(d.getDate()+diasAcesso);
    expiresAt=d.toISOString().split('T')[0];
  }
  // Tenta salvar com expires_at; se a coluna não existir no banco, salva sem ela
  const payload={nome,login,role};
  try{payload.expires_at=expiresAt;}catch(e){}
  if(pass){if(pass.length<4){toast('⚠ Senha muito curta',true);return;}if(!editUsr&&pass!==pass2){toast('⚠ Senhas não coincidem',true);return;}payload.pass_hash=hp(pass);}
  if(editUsr){
    const{data,error}=await sb.from('users').update(payload).eq('id',editUsr.id).select().single();
    if(error){toast('Erro ao salvar',true);return;}
    users=users.map(u=>u.id===editUsr.id?data:u);
    if(editUsr.id===session.id){session={...session,...data};saveSession(session);}
    toast('✓ Usuário atualizado');
  } else {
    if(!pass){toast('⚠ Informe a senha',true);return;}
    const{data,error}=await sb.from('users').insert(payload).select().single();
    if(error){toast('Erro ao salvar',true);return;}
    users.push(data);toast('✓ Usuário criado');
  }
  closeM('usr-modal');renderUsuarios();
}

async function deleteUsr(id){
  if(id===session.id){toast('⚠ Não pode remover você mesmo',true);return;}
  const u=users.find(x=>x.id===id);
  if(!confirm(`Remover "${u?.nome}"?`))return;
  await sb.from('users').delete().eq('id',id);
  users=users.filter(x=>x.id!==id);toast('Usuário removido');renderUsuarios();
}

// ══ NOTIFICAÇÕES DO NAVEGADOR ══
let _notifInterval = null;

function _notifAtivo(){
  // Ativo = permissão concedida E não foi desativado manualmente
  return Notification.permission==='granted' && localStorage.getItem('ep_notif_off')!=='1';
}

function atualizarBadgeNotif(){
  const track = document.getElementById('notif-toggle-track');
  const knob  = document.getElementById('notif-toggle-knob');
  const label = document.getElementById('notif-toggle-label');
  const pmsg  = document.getElementById('notif-perm-msg');
  const tbtn  = document.getElementById('btn-testar-notif');
  if(!track) return;

  const perm    = Notification.permission;
  const ativo   = _notifAtivo();
  const bloq    = perm==='denied';

  if(ativo){
    track.style.background='#16A34A';
    knob.style.left='22px';
    label.textContent='Ativo'; label.style.color='#166534';
    if(pmsg){pmsg.style.display='block';pmsg.textContent='Alertas automáticos a cada 30 min.';}
    if(tbtn) tbtn.style.display='';
  } else if(bloq){
    track.style.background='#D1D5DB';
    knob.style.left='2px';
    label.textContent='Bloqueado pelo navegador'; label.style.color='#DC2626';
    if(pmsg){pmsg.style.display='block';pmsg.style.color='#DC2626';pmsg.textContent='Clique no cadeado na barra de endereço para permitir notificações.';}
    if(tbtn) tbtn.style.display='none';
  } else {
    track.style.background='#D1D5DB';
    knob.style.left='2px';
    label.textContent='Desativado'; label.style.color='var(--n4)';
    if(pmsg){pmsg.style.display='none';pmsg.textContent='';}
    if(tbtn) tbtn.style.display='none';
  }
}

async function toggleNotificacoes(){
  if(!('Notification' in window)){toast('⚠ Seu navegador não suporta notificações',true);return;}

  if(_notifAtivo()){
    // Desativar
    localStorage.setItem('ep_notif_off','1');
    if(_notifInterval){clearInterval(_notifInterval);_notifInterval=null;}
    atualizarBadgeNotif();
    toast('Alertas desativados');
  } else if(Notification.permission==='denied'){
    toast('⚠ Permissão bloqueada. Libere nas configurações do navegador.',true);
  } else {
    // Ativar — solicita permissão se ainda não concedida
    const perm = Notification.permission==='granted'?'granted':await Notification.requestPermission();
    if(perm==='granted'){
      localStorage.removeItem('ep_notif_off');
      atualizarBadgeNotif();
      iniciarVerificacaoAutomatica();
      toast('✓ Alertas ativados!');
    } else {
      toast('⚠ Permissão negada.',true);
      atualizarBadgeNotif();
    }
  }
}

// Mantém compatibilidade com chamadas antigas
async function ativarNotificacoes(){ await toggleNotificacoes(); }

function dispararNotificacao(titulo, corpo, tag){
  ativarPulsoWa();
  tocarAudioAlerta();

  if(!_notifAtivo())return;
  if(navigator.vibrate)navigator.vibrate([300,100,300,100,500]);
  const icon="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%23111827'/><text x='16' y='22' font-size='18' text-anchor='middle' fill='%23F97316'>$</text></svg>";
  const n=new Notification(titulo,{body:corpo,icon,tag:tag||'agpainel',renotify:true});
  n.onclick=()=>{window.focus();showPage('dashboard');n.close();};
}

function testarNotificacao(){
  // Botão de teste manual — dispara uma notificação de exemplo imediatamente
  if(Notification.permission!=='granted'){toast('⚠ Ative os alertas primeiro',true);return;}
  dispararNotificacao(
    '🔔 GEPainel — Teste de alerta',
    'Os alertas estão funcionando! Você receberá avisos automáticos de vencimento.',
    'agpainel-teste'
  );
  toast('✓ Notificação de teste enviada!');
}

function verificarVencimentos(){
  if(Notification.permission!=='granted'||!session)return;

  const hoje=new Date(); hoje.setHours(0,0,0,0);

  // Controle de quais alertas já foram disparados hoje
  let jaDisparados={};
  try{jaDisparados=JSON.parse(localStorage.getItem('ep_notif_sent')||'{}');}catch(e){}

  const alertas=[];

  parcelas.filter(p=>p.status==='pendente').forEach(p=>{
    const venc=new Date(p.vencimento+'T12:00:00'); venc.setHours(0,0,0,0);
    const diff=Math.round((venc-hoje)/(1000*60*60*24));
    const emp=emprestimos.find(e=>e.id===p.emprestimo_id);
    const tom=tomadores.find(t=>t.id===emp?.tomador_id);
    if(!tom)return;

    if(diff===7){
      const key='7d_'+p.id;
      if(!jaDisparados[key]){
        alertas.push({key,titulo:'⏰ Vence em 7 dias',corpo:tom.nome+' — '+fmtR(p.valor)+' ('+fmtDate(p.vencimento)+')',tag:'agpainel-7d-'+p.id});
        jaDisparados[key]=today();
      }
    } else if(diff===3){
      const key='3d_'+p.id;
      if(!jaDisparados[key]){
        alertas.push({key,titulo:'🔴 Vence em 3 dias',corpo:tom.nome+' — '+fmtR(p.valor)+' ('+fmtDate(p.vencimento)+')',tag:'agpainel-3d-'+p.id});
        jaDisparados[key]=today();
      }
    } else if(diff<0){
      const key='atras_'+p.id+'_'+today();
      if(!jaDisparados[key]){
        alertas.push({key,titulo:'⛔ Parcela em atraso',corpo:tom.nome+' — '+fmtR(p.valor)+' (venceu '+fmtDate(p.vencimento)+')',tag:'agpainel-atras-'+p.id});
        jaDisparados[key]=today();
      }
    }
  });

  // Dispara cada alerta com intervalo de 900ms para não sobrepor
  alertas.forEach((a,i)=>setTimeout(()=>dispararNotificacao(a.titulo,a.corpo,a.tag),i*900));

  // Limpa chaves com mais de 10 dias e salva
  const limite=new Date(); limite.setDate(limite.getDate()-10);
  Object.keys(jaDisparados).forEach(k=>{
    try{if(new Date(jaDisparados[k]+'T12:00:00')<limite)delete jaDisparados[k];}catch(e){}
  });
  try{localStorage.setItem('ep_notif_sent',JSON.stringify(jaDisparados));}catch(e){}
}

function iniciarVerificacaoAutomatica(){
  if(_notifInterval)clearInterval(_notifInterval);
  // Verifica imediatamente e depois a cada 30 minutos
  setTimeout(verificarVencimentos,1500);
  _notifInterval=setInterval(()=>{
    if(Notification.permission==='granted'&&session)verificarVencimentos();
  },30*60*1000);
}

// ══ TERMINOLOGIA POR TIPO ══
function lblParcela(emp, plural=false){
  const tipo=emp?.tipo||'juros';
  if(tipo==='consignado') return plural?'Parcelas':'Parcela';
  return plural?'Juros':'Juros';
}
function lblProximo(emp){
  return (emp?.tipo||'juros')==='consignado'?'Próxima Parcela':'Próximo Vencimento';
}

let _waPulseAtivo=false;
function ativarPulsoWa(){
  const btn=document.getElementById('wa-nav-btn');
  if(btn&&!btn.classList.contains('unset')){
    btn.classList.add('wa-pulsing');
    _waPulseAtivo=true;
  }
}
function desativarPulsoWa(){
  const btn=document.getElementById('wa-nav-btn');
  if(btn){btn.classList.remove('wa-pulsing');}
  _waPulseAtivo=false;
}
function tocarAudioAlerta(){
  try{
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    const osc=ctx.createOscillator();
    const gain=ctx.createGain();
    osc.connect(gain);gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880,ctx.currentTime);
    osc.frequency.setValueAtTime(660,ctx.currentTime+0.1);
    osc.frequency.setValueAtTime(880,ctx.currentTime+0.2);
    gain.gain.setValueAtTime(0.3,ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.4);
    osc.start(ctx.currentTime);osc.stop(ctx.currentTime+0.4);
  }catch(e){}
}

// ══ WHATSAPP GESTOR ══
function loadWaNumber(){
  try{
    const num=localStorage.getItem('ep_wa_num');
    const btn=document.getElementById('wa-nav-btn');
    const lbl=document.getElementById('wa-nav-label');
    if(num&&btn&&lbl){
      btn.classList.remove('unset');
      lbl.textContent=num;
    }
  }catch(e){}
}

function openWaModal(){
  desativarPulsoWa();
  try{
    const saved=localStorage.getItem('ep_wa_num')||'';
    document.getElementById('wa-num-input').value=saved;
  }catch(e){}
  const box=document.getElementById('wa-preview-box');
  if(box)box.style.display='none';
  openM('wa-modal');
  setTimeout(atualizarBadgeNotif, 50);
}

function saveWaNumber(){
  const num=document.getElementById('wa-num-input').value.trim();
  if(!num){toast('⚠ Informe o número',true);return;}
  try{localStorage.setItem('ep_wa_num',num);}catch(e){}
  const btn=document.getElementById('wa-nav-btn');
  const lbl=document.getElementById('wa-nav-label');
  if(btn)btn.classList.remove('unset');
  if(lbl)lbl.textContent=num;
  closeM('wa-modal');
  toast('✓ WhatsApp salvo!');
}

function clearWaNumber(){
  try{localStorage.removeItem('ep_wa_num');}catch(e){}
  const btn=document.getElementById('wa-nav-btn');
  const lbl=document.getElementById('wa-nav-label');
  if(btn)btn.classList.add('unset');
  if(lbl)lbl.textContent='Seu WhatsApp';
  document.getElementById('wa-num-input').value='';
  closeM('wa-modal');
  toast('WhatsApp removido');
}

function testarMensagemWa(){
  const hoje=new Date();
  const em3=new Date();em3.setDate(hoje.getDate()+3);
  const em7=new Date();em7.setDate(hoje.getDate()+7);

  const linhas3=[];const linhas7=[];
  const linhasAtras=[];

  parcelas.filter(p=>p.status==='pendente').forEach(p=>{
    const venc=new Date(p.vencimento+'T12:00:00');
    const emp=emprestimos.find(e=>e.id===p.emprestimo_id);
    const tom=tomadores.find(t=>t.id===emp?.tomador_id);
    if(!emp||!tom)return;
    const linha='• '+tom.nome+' — '+fmtR(p.valor)+' (vence '+fmtDate(p.vencimento)+')';
    if(isAtrasada(p))linhasAtras.push(linha);
    else if(venc>=hoje&&venc<=em3)linhas3.push(linha);
    else if(venc>em3&&venc<=em7)linhas7.push(linha);
  });

  const box=document.getElementById('wa-preview-box');
  if(!box)return;

  if(!linhas3.length&&!linhas7.length&&!linhasAtras.length){
    box.style.display='block';
    box.style.background='#FFF7ED';box.style.borderColor='#FED7AA';box.style.color='#92400E';
    box.textContent='✓ Nenhuma parcela em atraso ou vencendo nos próximos 7 dias.';
    return;
  }

  const nl='\n';
  let msg='📊 *GEPainel — Avisos de Cobranças*'+nl;
  msg+='🗓 '+new Date().toLocaleDateString('pt-BR')+nl+nl;
  if(linhasAtras.length){msg+='⛔ *Em atraso ('+linhasAtras.length+'):*'+nl+linhasAtras.join(nl)+nl+nl;}
  if(linhas3.length){msg+='🔴 *Vencem em até 3 dias ('+linhas3.length+'):*'+nl+linhas3.join(nl)+nl+nl;}
  if(linhas7.length){msg+='⏰ *Vencem em 4–7 dias ('+linhas7.length+'):*'+nl+linhas7.join(nl)+nl;}

  box.style.display='block';
  box.style.background='#F0FDF4';box.style.borderColor='#BBF7D0';box.style.color='#166534';
  box.textContent=msg;
}

function enviarAvisosWa(){
  const num=localStorage.getItem('ep_wa_num');
  if(!num){toast('⚠ Configure seu número primeiro',true);openWaModal();return;}

  const hoje=new Date();
  const em3=new Date();em3.setDate(hoje.getDate()+3);
  const em7=new Date();em7.setDate(hoje.getDate()+7);

  const linhas3=[];const linhas7=[];const linhasAtras=[];

  parcelas.filter(p=>p.status==='pendente').forEach(p=>{
    const venc=new Date(p.vencimento+'T12:00:00');
    const emp=emprestimos.find(e=>e.id===p.emprestimo_id);
    const tom=tomadores.find(t=>t.id===emp?.tomador_id);
    if(!emp||!tom)return;
    const linha='• '+tom.nome+' — '+fmtR(p.valor)+' (vence '+fmtDate(p.vencimento)+')';
    if(isAtrasada(p))linhasAtras.push(linha);
    else if(venc>=hoje&&venc<=em3)linhas3.push(linha);
    else if(venc>em3&&venc<=em7)linhas7.push(linha);
  });

  if(!linhas3.length&&!linhas7.length&&!linhasAtras.length){toast('✓ Nenhuma parcela em atraso ou vencendo nos próximos 7 dias!');return;}

  const nl='\n';
  let msg='📊 *GEPainel — Avisos de Cobranças*'+nl;
  msg+='🗓 '+new Date().toLocaleDateString('pt-BR')+nl+nl;
  if(linhasAtras.length){msg+='⛔ *Em atraso ('+linhasAtras.length+'):*'+nl+linhasAtras.join(nl)+nl+nl;}
  if(linhas3.length){msg+='🔴 *Vencem em até 3 dias ('+linhas3.length+'):*'+nl+linhas3.join(nl)+nl+nl;}
  if(linhas7.length){msg+='⏰ *Vencem em 4–7 dias ('+linhas7.length+'):*'+nl+linhas7.join(nl)+nl;}

  const tel=num.replace(/\D/g,'');
  const url=`https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`;
  window.open(url,'_blank');
}

function exportRelatPDF(){
  const mc=document.getElementById('main-content');
  if(!mc)return;
  const win=window.open('','_blank');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>GEPainel — Relatório</title>
  <style>body{font-family:Arial,sans-serif;padding:2rem;font-size:13px}h1{font-size:1.3rem;margin-bottom:1rem}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem}
  .card{border:1px solid #E5E7EB;border-radius:8px;padding:1rem}
  canvas{max-height:200px}@media print{button{display:none}}
/* Badges de Planos */
.nav-badge.badge-bronze{background:linear-gradient(135deg,#CD7F32 0%,#A0522D 100%);color:#fff;border:none}
.nav-badge.badge-prata{background:linear-gradient(135deg,#C0C0C0 0%,#A8A8A8 100%);color:#fff;border:none}
.nav-badge.badge-ouro{background:linear-gradient(135deg,#FFD700 0%,#DAA520 100%);color:#fff;border:none}
.nav-badge.badge-platinum{background:linear-gradient(135deg,#E5E4E2 0%,#B8B8B8 100%);color:#1F2937;border:none;font-weight:800}
.nav-badge.badge-diamante{background:linear-gradient(135deg,#60A5FA 0%,#818CF8 60%,#C084FC 100%);color:#fff;border:none;font-weight:800;box-shadow:0 0 8px rgba(129,140,248,.45)}

</style></head>
  <body><h1>GEPainel — Relatório</h1>
  ${mc.innerHTML.replace(/<script[\s\S]*?<\/script>/gi,'')}
  <br><button onclick="window.print()" style="padding:.5rem 1.5rem;background:#111827;color:#fff;border:none;border-radius:6px;cursor:pointer">🖨 Salvar como PDF</button>
  </body></html>`);
  win.document.close();
}

function exportRelatCSV(){
  const R=window._relat||{modo:'mes'};
  const hoje=new Date();
  let dtI=null,dtF=null;
  if(R.modo==='dia'){dtI=new Date(R.y,R.m,R.d,0,0,0);dtF=new Date(R.y,R.m,R.d,23,59,59);}
  else if(R.modo==='mes'){dtI=new Date(R.y,R.m,1);dtF=new Date(R.y,R.m+1,0,23,59,59);}
  else if(R.modo==='ano'){dtI=new Date(R.y,0,1);dtF=new Date(R.y,11,31,23,59,59);}

  const myEmps=session.role==='admin'?emprestimos:emprestimos.filter(e=>e.owner_id===session.id);
  const empsF=dtI?myEmps.filter(e=>{const d=new Date(e.data_emprestimo+'T12:00:00');return d>=dtI&&d<=dtF;}):myEmps;
  const empIds=new Set(myEmps.map(e=>e.id));
  const myParcs=parcelas.filter(p=>empIds.has(p.emprestimo_id));
  const parcsPagas=myParcs.filter(p=>p.status==='pago'&&p.pago_em&&(!dtI||(new Date(p.pago_em+'T12:00:00')>=dtI&&new Date(p.pago_em+'T12:00:00')<=dtF)));

  const rows=[['TOMADOR','VALOR EMPRESTADO','JUROS','DATA','STATUS','RECEBIDO']];
  empsF.forEach(e=>{
    const tom=tomadores.find(t=>t.id===e.tomador_id);
    const rec=parcelas.filter(p=>p.emprestimo_id===e.id&&p.status==='pago').reduce((s,p)=>s+Number(p.valor_pago||p.valor||0),0);
    rows.push([tom?.nome||'',e.valor,(e.juros*100).toFixed(1)+'%',e.data_emprestimo,e.tipo||'juros',rec.toFixed(2)]);
  });
  rows.push([]);
  rows.push(['PARCELAS PAGAS NO PERÍODO','','','','','']);
  rows.push(['TOMADOR','PARCELA','DATA PAGAMENTO','VALOR PAGO','','']);
  parcsPagas.forEach(p=>{
    const emp=myEmps.find(e=>e.id===p.emprestimo_id);
    const tom=tomadores.find(t=>t.id===emp?.tomador_id);
    rows.push([tom?.nome||'',p.numero,p.pago_em,Number(p.valor_pago||p.valor).toFixed(2),'','']);
  });

  const csvEsc=v=>'"'+String(v).replace(/"/g,'""')+'"';
  const csv=rows.map(r=>r.map(csvEsc).join(',')).join('\n');
  const blob=new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='GEPainel_Relatorio_'+today()+'.csv';
  document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},300);
  toast('✓ CSV exportado!');
}

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

// ══ RELATÓRIO ══
function navAno(delta){
  if(!window._relatMes){const n=new Date();window._relatMes={y:n.getFullYear(),m:n.getMonth()};}
  const novoAno=window._relatMes.y+delta;
  const hoje=new Date();
  // Não avança além do ano atual
  if(novoAno>hoje.getFullYear()) return;
  window._relatMes={y:novoAno,m:window._relatMes.m};
  // Se o novo ano é o atual e o mês ultrapassou o atual, ajusta para o mês atual
  if(novoAno===hoje.getFullYear()&&window._relatMes.m>hoje.getMonth()){
    window._relatMes.m=hoje.getMonth();
  }
  renderRelatorio();
}

function navMes(delta){
  if(!window._relatMes){const n=new Date();window._relatMes={y:n.getFullYear(),m:n.getMonth()};}
  const d=new Date(window._relatMes.y,window._relatMes.m+delta,1);
  window._relatMes={y:d.getFullYear(),m:d.getMonth()};
  renderRelatorio();
}
function renderRelatorio(){
  const mc=document.getElementById('main-content');
  const hoje=new Date();

  if(!window._relat) window._relat={modo:'mes',y:hoje.getFullYear(),m:hoje.getMonth(),d:hoje.getDate()};
  const R=window._relat;
  const meses_nomes=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  // ── Filtro de data ──────────────────────────────────────
  let dtInicio,dtFim,exibindo;
  if(R.modo==='dia'){
    dtInicio=new Date(R.y,R.m,R.d,0,0,0);dtFim=new Date(R.y,R.m,R.d,23,59,59);
    exibindo=String(R.d).padStart(2,'0')+'/'+String(R.m+1).padStart(2,'0')+'/'+R.y;
  } else if(R.modo==='mes'){
    dtInicio=new Date(R.y,R.m,1);dtFim=new Date(R.y,R.m+1,0,23,59,59);
    exibindo=meses_nomes[R.m]+' '+R.y;
  } else if(R.modo==='ano'){
    dtInicio=new Date(R.y,0,1);dtFim=new Date(R.y,11,31,23,59,59);
    exibindo=''+R.y;
  } else {
    dtInicio=null;dtFim=null;exibindo='Todos os períodos';
  }
  const selY=R.y,selM=R.m;
  const mesAtualY=hoje.getFullYear(),mesAtualM=hoje.getMonth();

  // ── Dropdowns ───────────────────────────────────────────
  const diasNoMes=new Date(R.y,R.m+1,0).getDate();
  const selDia=Array.from({length:diasNoMes},(_,i)=>i+1).map(d=>`<option value="${d}"${d===R.d?' selected':''}>${String(d).padStart(2,'0')}</option>`).join('');
  const selMesOpts=meses_nomes.map((n,i)=>`<option value="${i}"${i===R.m?' selected':''}>${n}</option>`).join('');
  const anoAtual=hoje.getFullYear();
  const selAnoOpts=Array.from({length:6},(_,i)=>anoAtual-i).map(a=>`<option value="${a}"${a===R.y?' selected':''}>${a}</option>`).join('');
  const selSt='padding:.35rem .65rem;border:1px solid #E5E7EB;border-radius:var(--rs);background:var(--card);color:var(--n1);font-size:13px;font-weight:600;cursor:pointer;';
  const cal='<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';

  // ── Dados ────────────────────────────────────────────────
  const myEmps=session.role==='admin'?emprestimos:emprestimos.filter(e=>e.owner_id===session.id);
  const empsF=dtInicio?myEmps.filter(e=>{const d=new Date(e.data_emprestimo+'T12:00:00');return d>=dtInicio&&d<=dtFim;}):myEmps;
  const empIds=new Set(myEmps.map(e=>e.id));
  const myParcs=parcelas.filter(p=>empIds.has(p.emprestimo_id));
  const totalEmp=empsF.reduce((s,e)=>s+Number(e.valor||0),0);
  const totalLucro=empsF.reduce((s,e)=>s+Number(e.lucro||0),0);
  const parcsPagas=myParcs.filter(p=>p.status==='pago'&&p.pago_em&&(!dtInicio||(new Date(p.pago_em+'T12:00:00')>=dtInicio&&new Date(p.pago_em+'T12:00:00')<=dtFim)));
  const totalRec=parcsPagas.reduce((s,p)=>s+Number(p.valor_pago||p.valor||0),0);
  const parcsAtras=myParcs.filter(p=>isAtrasada(p));
  const totalAtras=parcsAtras.reduce((s,p)=>s+Number(p.valor||0),0);
  const saldoTotal=myEmps.reduce((s,e)=>s+Number(e.saldo_devedor!=null?e.saldo_devedor:e.valor||0),0);

  // ── Últimos 6 meses ──────────────────────────────────────
  const meses=[];
  for(let i=5;i>=0;i--){const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-i);meses.push({label:d.toLocaleString('pt-BR',{month:'short',year:'2-digit'}),m:d.getMonth(),y:d.getFullYear()});}
  const empMes=meses.map(m=>myEmps.filter(e=>{const d=new Date(e.data_emprestimo+'T12:00:00');return d.getMonth()===m.m&&d.getFullYear()===m.y;}).reduce((s,e)=>s+Number(e.valor||0),0));
  const recMes=meses.map(m=>myParcs.filter(p=>p.status==='pago'&&p.pago_em).filter(p=>{const d=new Date(p.pago_em+'T12:00:00');return d.getMonth()===m.m&&d.getFullYear()===m.y;}).reduce((s,p)=>s+Number(p.valor_pago||p.valor||0),0));
  const inadMes=meses.map(m=>{const v=myParcs.filter(p=>{const vd=new Date(p.vencimento+'T12:00:00');return p.status==='pendente'&&vd.getMonth()===m.m&&vd.getFullYear()===m.y&&vd<new Date();});return v.reduce((s,p)=>s+Number(p.valor||0),0);});
  const nJuros=myEmps.filter(e=>(e.tipo||'juros')==='juros').length;
  const nConsig=myEmps.filter(e=>e.tipo==='consignado').length;
  const proj=[];
  for(let i=1;i<=3;i++){const d=new Date();d.setDate(1);d.setMonth(d.getMonth()+i);const val=myParcs.filter(p=>{const v=new Date(p.vencimento+'T12:00:00');return p.status==='pendente'&&v.getMonth()===d.getMonth()&&v.getFullYear()===d.getFullYear();}).reduce((s,p)=>s+Number(p.valor||0),0);proj.push({label:d.toLocaleString('pt-BR',{month:'short',year:'2-digit'}),val});}
  // Ranking e lista filtrados pelo período selecionado (usa empsF)
  const tomRank=tomadores.map(t=>{
    const te=empsF.filter(e=>e.tomador_id===t.id);
    if(!te.length)return null;
    const tp=myParcs.filter(p=>te.some(e=>e.id===p.emprestimo_id));
    const saldo=te.reduce((s,e)=>s+Number(e.saldo_devedor!=null?e.saldo_devedor:e.valor||0),0);
    const atras=tp.filter(p=>isAtrasada(p)).length;
    const totalEmp=te.reduce((s,e)=>s+Number(e.valor||0),0);
    return{...t,saldo,atras,totalEmp};
  }).filter(Boolean).filter(t=>t.totalEmp>0).sort((a,b)=>b.saldo-a.saldo).slice(0,10);
  const saldoTotalPeriodo=tomRank.reduce((s,t)=>s+t.saldo,0);
  const empsPeriodo=empsF.slice(0,10);

  mc.innerHTML=`
    <div class="sec-hdr"><span class="sec-title">Relatório</span></div>

    <!-- SELETOR DE PERÍODO -->
    <div style="background:var(--card);border:1px solid #E5E7EB;border-radius:var(--r);padding:1rem 1.25rem;margin-bottom:1rem;box-shadow:var(--sh)">
      <div style="font-size:11px;font-weight:700;color:var(--n4);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.65rem">Período</div>
      <div style="display:flex;gap:.4rem;margin-bottom:.85rem;flex-wrap:wrap">
        ${['dia','mes','ano','tudo'].map((modo,i)=>{
          const labels=['Diário','Mês','Ano','Tudo'];
          const active=R.modo===modo;
          return`<button onclick="window._relat.modo='${modo}';renderRelatorio()" style="padding:.4rem 1rem;border-radius:var(--rs);border:1px solid ${active?'#16A34A':'#E5E7EB'};background:${active?'#16A34A':'var(--card)'};color:${active?'#fff':'var(--n2)'};font-size:13px;font-weight:600;cursor:pointer;transition:all .15s">${labels[i]}</button>`;
        }).join('')}
      </div>
      <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.6rem">
        ${R.modo==='dia'?`
          <div style="display:flex;align-items:center;gap:.35rem">${cal}<select style="${selSt}" onchange="window._relat.m=parseInt(this.value);renderRelatorio()">${selMesOpts}</select></div>
          <div style="display:flex;align-items:center;gap:.35rem">${cal}<select style="${selSt}" onchange="window._relat.d=parseInt(this.value);renderRelatorio()">${selDia}</select></div>
          <div style="display:flex;align-items:center;gap:.35rem">${cal}<select style="${selSt}" onchange="window._relat.y=parseInt(this.value);renderRelatorio()">${selAnoOpts}</select></div>
        `:R.modo==='mes'?`
          <div style="display:flex;align-items:center;gap:.35rem">${cal}<select style="${selSt}" onchange="window._relat.m=parseInt(this.value);renderRelatorio()">${selMesOpts}</select></div>
          <div style="display:flex;align-items:center;gap:.35rem">${cal}<select style="${selSt}" onchange="window._relat.y=parseInt(this.value);renderRelatorio()">${selAnoOpts}</select></div>
        `:R.modo==='ano'?`
          <div style="display:flex;align-items:center;gap:.35rem">${cal}<select style="${selSt}" onchange="window._relat.y=parseInt(this.value);renderRelatorio()">${selAnoOpts}</select></div>
        `:''}
      </div>
      <div style="font-size:12px;color:var(--n4);margin-bottom:.85rem;font-style:italic">Exibindo: <strong style="color:var(--n2)">${exibindo}</strong></div>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap">
        <button class="btn btn-g btn-sm" onclick="exportRelatPDF()">↓ Exportar PDF</button>
        <button class="btn btn-g btn-sm" onclick="exportRelatCSV()">↓ Exportar Excel (CSV)</button>
      </div>
    </div>

    <!-- CARDS RESUMO -->
    <div class="stats" style="margin-bottom:1.25rem">
      <div class="stat"><div class="stat-label">Total Emprestado</div><div class="stat-value" style="color:var(--blu)">${fmtR(totalEmp)}</div><div class="stat-sub">${empsF.length} empréstimos no período</div></div>
      <div class="stat"><div class="stat-label">Total Recebido</div><div class="stat-value" style="color:var(--grn)">${fmtR(totalRec)}</div><div class="stat-sub">${parcsPagas.length} parcelas pagas</div></div>
      <div class="stat"><div class="stat-label">Saldo Devedor</div><div class="stat-value" style="color:var(--red)">${fmtR(saldoTotal)}</div><div class="stat-sub">total geral em aberto</div></div>
      <div class="stat"><div class="stat-label">Inadimplência</div><div class="stat-value" style="color:${parcsAtras.length?'var(--red)':'var(--grn)'}">${parcsAtras.length}</div><div class="stat-sub">parcelas atrasadas (geral)</div></div>
    </div>

    <!-- GRÁFICOS LINHA 1 -->
    <div class="relat-grid-a" style="display:grid;grid-template-columns:2fr 1fr;gap:1rem;margin-bottom:1rem">
      <div class="card" style="padding:1.25rem">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;flex-wrap:wrap;gap:.5rem">
          <span style="font-family:var(--FT);font-size:1.05rem">Fluxo de Caixa — Últimos 6 meses</span>
          <div style="display:flex;gap:1rem;font-size:11px">
            <span><span style="display:inline-block;width:10px;height:10px;background:#2563EB;border-radius:2px;margin-right:4px"></span>Emprestado</span>
            <span><span style="display:inline-block;width:10px;height:10px;background:#16A34A;border-radius:2px;margin-right:4px"></span>Recebido</span>
            <span><span style="display:inline-block;width:10px;height:10px;background:#DC2626;border-radius:2px;margin-right:4px"></span>Atraso</span>
          </div>
        </div>
        <canvas id="chart-fluxo" height="160"></canvas>
      </div>
      <div class="card" style="padding:1.25rem;display:flex;flex-direction:column">
        <span style="font-family:var(--FT);font-size:1.05rem;margin-bottom:1rem">Saúde da Carteira</span>
        <div style="flex:1;display:flex;align-items:center;justify-content:center"><canvas id="chart-saude" style="max-height:180px"></canvas></div>
      </div>
    </div>

    <!-- GRÁFICOS LINHA 2 -->
    <div class="relat-grid-b" style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem">
      <div class="card" style="padding:1.25rem">
        <span style="font-family:var(--FT);font-size:1.05rem;margin-bottom:1rem;display:block">Projeção — Próximos 3 meses</span>
        <canvas id="chart-proj" height="140"></canvas>
      </div>
      <div class="card" style="padding:1.25rem">
        <span style="font-family:var(--FT);font-size:1.05rem;margin-bottom:1rem;display:block">Por Tipo de Empréstimo</span>
        <div style="display:flex;align-items:center;gap:1.5rem">
          <canvas id="chart-tipo" style="max-height:150px;max-width:150px"></canvas>
          <div style="flex:1">
            <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem">
              <div style="width:12px;height:12px;background:#EA580C;border-radius:2px"></div>
              <span style="font-size:13px">◆ Juros Mensal</span>
              <span style="font-weight:700;margin-left:auto">${nJuros}</span>
            </div>
            <div style="display:flex;align-items:center;gap:.5rem">
              <div style="width:12px;height:12px;background:#2563EB;border-radius:2px"></div>
              <span style="font-size:13px">■ Consignado</span>
              <span style="font-weight:700;margin-left:auto">${nConsig}</span>
            </div>
            <div style="margin-top:.75rem;padding-top:.75rem;border-top:1px solid #E5E7EB;font-size:12px;color:var(--n4)">Total: ${nJuros+nConsig} empréstimos</div>
          </div>
        </div>
      </div>
    </div>

    <!-- EMPRÉSTIMOS DO PERÍODO -->
    ${(()=>{
      if(!empsPeriodo.length||R.modo==='tudo')return'';
      const rows=empsPeriodo.map(e=>{
        const tom=tomadores.find(t=>t.id===e.tomador_id);
        const parcsE=myParcs.filter(p=>p.emprestimo_id===e.id);
        const pgE=parcsE.filter(p=>p.status==='pago').length;
        return '<div style="display:flex;align-items:center;justify-content:space-between;padding:.55rem 0;border-bottom:1px solid var(--border)"><div><div style="font-size:13px;font-weight:600;cursor:pointer;color:var(--n1)" onclick="openClientView(\''+tom?.id+'\')">'+( tom?.nome||'—')+' <span style="color:var(--grn);font-size:11px">→</span></div><div style="font-size:11px;color:var(--n4)">'+fmtDate(e.data_emprestimo)+' · '+(e.juros*100).toFixed(0)+'%</div></div><div style="text-align:right"><div style="font-size:13px;font-weight:700;color:var(--blu)">'+fmtR(e.valor)+'</div><div style="font-size:11px;color:var(--n4)">'+pgE+'/'+parcsE.length+' pagas</div></div></div>';
      }).join('');
      return '<div class="card" style="margin-bottom:1rem"><div style="font-size:14px;font-weight:700;color:var(--n1);margin-bottom:.85rem">📋 Empréstimos — '+exibindo+'</div>'+rows+'</div>';
    })()}

    <!-- RANKING CLIENTES -->
    <div class="card" style="margin-bottom:1rem">
      <div class="card-title">Ranking — Maiores Saldos Devedores</div>
      ${tomRank.map((t,i)=>{
        const pct=saldoTotalPeriodo>0?Math.round(t.saldo/saldoTotalPeriodo*100):0;
        return`<div style="display:flex;align-items:center;gap:.75rem;padding:.6rem 0;border-bottom:1px solid #F3F4F6">
          <span style="font-size:12px;color:var(--n4);min-width:18px;font-weight:700">${i+1}</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600;cursor:pointer" onclick="openClientView('${t.id}')">${t.nome} <span style="color:var(--grn);font-size:11px">→</span></div>
            <div style="background:#E5E7EB;border-radius:999px;height:5px;margin-top:4px;overflow:hidden"><div style="background:${t.atras?'var(--red)':'var(--blu)'};height:100%;border-radius:999px;width:${pct}%"></div></div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-size:13px;font-weight:700;color:${t.atras?'var(--red)':'var(--blu)'}">${fmtR(t.saldo)}</div>
            ${t.atras?`<div style="font-size:10px;color:var(--red)">${t.atras} em atraso</div>`:''}
          </div>
        </div>`;
      }).join('')||'<div class="empty-text">Nenhum dado.</div>'}
    </div>

    <!-- INADIMPLÊNCIA -->
    <div class="card">
      <span style="font-family:var(--FT);font-size:1.05rem;margin-bottom:1rem;display:block">Inadimplência por Mês</span>
      <canvas id="chart-inad" height="120"></canvas>
    </div>`;

  setTimeout(()=>{
    if(typeof Chart==='undefined'){
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
      s.onload=()=>_desenharGraficos(meses,empMes,recMes,inadMes,proj,myParcs,parcsAtras,nJuros,nConsig);
      document.head.appendChild(s);
    } else {
      _desenharGraficos(meses,empMes,recMes,inadMes,proj,myParcs,parcsAtras,nJuros,nConsig);
    }
  },50);
}
function _desenharGraficos(meses,empMes,recMes,inadMes,proj,myParcs,parcsAtras,nJuros,nConsig){
  const isDark=document.body.classList.contains('dark');
  const gridColor=isDark?'rgba(255,255,255,.07)':'rgba(0,0,0,.06)';
  const textColor=isDark?'#94A3B8':'#6B7280';
  const labels=meses.map(m=>m.label);

  Chart.defaults.font.family='DM Sans, sans-serif';
  Chart.defaults.font.size=11;

  // Destroi gráficos anteriores se existirem
  ['chart-fluxo','chart-saude','chart-proj','chart-tipo','chart-inad'].forEach(id=>{
    const c=Chart.getChart(id);if(c)c.destroy();
  });

  // 1. Fluxo de Caixa
  new Chart(document.getElementById('chart-fluxo'),{
    type:'bar',
    data:{labels,datasets:[
      {label:'Emprestado',data:empMes,backgroundColor:'rgba(37,99,235,.7)',borderRadius:4},
      {label:'Recebido',data:recMes,backgroundColor:'rgba(22,163,74,.7)',borderRadius:4},
      {label:'Atraso',data:inadMes,backgroundColor:'rgba(220,38,38,.6)',borderRadius:4},
    ]},
    options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{grid:{color:gridColor},ticks:{color:textColor}},y:{grid:{color:gridColor},ticks:{color:textColor,callback:v=>'R$'+v.toLocaleString('pt-BR')}}}}
  });

  // 2. Donut saúde
  const pagas=myParcs.filter(p=>p.status==='pago').length;
  const pend=myParcs.filter(p=>p.status==='pendente'&&!isAtrasada(p)).length;
  const atrasN=parcsAtras.length;
  new Chart(document.getElementById('chart-saude'),{
    type:'doughnut',
    data:{labels:['Em dia','Em atraso','Pagas'],datasets:[{data:[pend,atrasN,pagas],backgroundColor:['#F59E0B','#DC2626','#16A34A'],borderWidth:0,hoverOffset:4}]},
    options:{responsive:true,plugins:{legend:{position:'bottom',labels:{color:textColor,padding:12,boxWidth:10}}}}
  });

  // 3. Projeção
  new Chart(document.getElementById('chart-proj'),{
    type:'bar',
    data:{labels:proj.map(p=>p.label),datasets:[{label:'Previsto',data:proj.map(p=>p.val),backgroundColor:'rgba(234,88,12,.7)',borderRadius:6}]},
    options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{grid:{color:gridColor},ticks:{color:textColor}},y:{grid:{color:gridColor},ticks:{color:textColor,callback:v=>'R$'+v.toLocaleString('pt-BR')}}}}
  });

  // 4. Tipo pizza
  if(nJuros+nConsig>0){
    new Chart(document.getElementById('chart-tipo'),{
      type:'doughnut',
      data:{labels:['Juros','Consignado'],datasets:[{data:[nJuros,nConsig],backgroundColor:['#EA580C','#2563EB'],borderWidth:0}]},
      options:{responsive:true,plugins:{legend:{display:false}}}
    });
  }

  // 5. Inadimplência linha
  new Chart(document.getElementById('chart-inad'),{
    type:'line',
    data:{labels,datasets:[{label:'Em atraso',data:inadMes,borderColor:'#DC2626',backgroundColor:'rgba(220,38,38,.1)',fill:true,tension:.4,pointRadius:4,pointBackgroundColor:'#DC2626'}]},
    options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{grid:{color:gridColor},ticks:{color:textColor}},y:{grid:{color:gridColor},ticks:{color:textColor,callback:v=>'R$'+v.toLocaleString('pt-BR')}}}}
  });
}

// ══ DARK MODE ══
function toggleDarkMode(){
  const root=document.documentElement;
  const curr=root.getAttribute('data-theme')||'dark';
  const next=curr==='dark'?'light':'dark';
  root.setAttribute('data-theme',next);
  document.body.classList.toggle('dark', next==='dark');
  // Limpar inline styles — o CSS cuida das cores agora
  document.body.style.background='';
  document.body.style.color='';
  try{localStorage.setItem('ep_dark',next);}catch(e){}
  updateDarkBtn();
}
function updateDarkBtn(){
  const btn=document.getElementById('dark-toggle');
  if(!btn)return;
  const isDark=(document.documentElement.getAttribute('data-theme')||'dark')==='dark';
  btn.innerHTML=isDark
    ?'<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>'
    :'<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  btn.title=isDark?'Modo claro':'Modo escuro';
}
function loadDarkMode(){
  try{
    const saved=localStorage.getItem('ep_dark')||'dark';
    const isLight=saved==='light';
    document.documentElement.setAttribute('data-theme', isLight?'light':'dark');
    document.body.classList.toggle('dark', !isLight);
    // Limpar inline styles — o CSS cuida das cores via data-theme
    document.body.style.background='';
    document.body.style.color='';
  }catch(e){}
  updateDarkBtn();
}

// ══ BUSCA GLOBAL ══
function openGlobalSearch(){
  const ov=document.getElementById('gsearch-ov');
  ov.classList.add('open');
  setTimeout(()=>document.getElementById('gsearch-input')?.focus(),100);
}
function closeGlobalSearch(){
  document.getElementById('gsearch-ov').classList.remove('open');
  document.getElementById('gsearch-input').value='';
  document.getElementById('gsearch-results').innerHTML='<div class="gsearch-empty">Digite para buscar...</div>';
}
function runGlobalSearch(){
  const q=(document.getElementById('gsearch-input').value||'').toLowerCase().trim();
  const res=document.getElementById('gsearch-results');
  if(q.length<2){res.innerHTML='<div class="gsearch-empty">Digite ao menos 2 caracteres...</div>';return;}
  const items=[];
  tomadores.filter(t=>t.nome.toLowerCase().includes(q)||(t.contato||'').includes(q)||(t.ocupacao||'').toLowerCase().includes(q)).forEach(t=>{
    const emps=emprestimos.filter(e=>e.tomador_id===t.id).length;
    items.push(`<div class="gsearch-item" onclick="closeGlobalSearch();setTimeout(()=>openClientView('${t.id}'),100)">
      <div><div style="font-weight:600;font-size:13px">${t.nome}</div><div style="font-size:11px;color:var(--n4)">${t.contato||''} · ${emps} empréstimo${emps!==1?'s':''}</div></div>
      <span class="gsearch-tag" style="background:#EFF6FF;color:var(--blu)">Cliente</span></div>`);
  });
  emprestimos.filter(e=>{const t=tomadores.find(x=>x.id===e.tomador_id);return(t?.nome||'').toLowerCase().includes(q)||(e.responsavel||'').toLowerCase().includes(q)||(e.local||'').toLowerCase().includes(q)||String(e.valor).includes(q);}).forEach(e=>{
    const t=tomadores.find(x=>x.id===e.tomador_id);
    items.push(`<div class="gsearch-item" onclick="closeGlobalSearch();setTimeout(()=>openParcelas('${e.id}'),100)">
      <div><div style="font-weight:600;font-size:13px">${t?.nome||'—'}</div><div style="font-size:11px;color:var(--n4)">${fmtR(e.valor)} · ${(e.juros*100).toFixed(0)}% · ${fmtDate(e.data_emprestimo)}</div></div>
      <span class="gsearch-tag" style="background:var(--grn0);color:var(--grn)">Empréstimo</span></div>`);
  });
  res.innerHTML=items.length?items.join(''):'<div class="gsearch-empty">Nenhum resultado para "'+q+'"</div>';
}

// ══ IMPRIMIR FICHA ══
function printFicha(tomId){
  const tom=tomadores.find(t=>t.id===tomId);
  if(!tom)return;
  const emps=emprestimos.filter(e=>e.tomador_id===tomId);
  const todasP=parcelas.filter(p=>emps.some(e=>e.id===p.emprestimo_id));
  const pagas=todasP.filter(p=>p.status==='pago').length;
  const totalEmp=emps.reduce((s,e)=>s+Number(e.valor||0),0);
  const totalRec=todasP.filter(p=>p.status==='pago').reduce((s,p)=>s+Number(p.valor_pago||p.valor||0),0);
  const saldoDevedor=emps.reduce((s,e)=>s+Number(e.saldo_devedor!=null?e.saldo_devedor:e.valor||0),0);

  const empRows=emps.map(e=>{
    const parcsEmp=parcelas.filter(p=>p.emprestimo_id===e.id).sort((a,b)=>a.numero-b.numero);
    const pgCnt=parcsEmp.filter(p=>p.status==='pago').length;
    return`<tr style="border-bottom:1px solid #eee">
      <td style="padding:6px 8px">${fmtDate(e.data_emprestimo)}</td>
      <td style="padding:6px 8px">${fmtR(e.valor)}</td>
      <td style="padding:6px 8px">${(e.juros*100).toFixed(1)}%</td>
      <td style="padding:6px 8px">${fmtR(e.valor*e.juros)}/mês</td>
      <td style="padding:6px 8px">${e.garantia||'—'}</td>
      <td style="padding:6px 8px">${pgCnt}/${parcsEmp.length} pagas</td>
    </tr>`;
  }).join('');

  const win=window.open('','_blank');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Ficha — ${tom.nome}</title>
  <style>body{font-family:Arial,sans-serif;padding:2rem;color:#111;max-width:800px;margin:0 auto}h1{font-size:1.5rem;margin-bottom:.25rem}h2{font-size:1rem;color:#666;font-weight:400;margin:0 0 1.5rem}table{width:100%;border-collapse:collapse;font-size:13px}th{background:#f3f4f6;padding:6px 8px;text-align:left;border-bottom:2px solid #ddd}.stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:1rem;margin-bottom:1.5rem}.stat{border:1px solid #ddd;border-radius:8px;padding:.75rem;text-align:center}.stat-label{font-size:10px;text-transform:uppercase;color:#666;margin-bottom:4px}.stat-val{font-size:1.2rem;font-weight:700}.footer{margin-top:2rem;font-size:11px;color:#999;text-align:right}

@media(max-width:640px){
  .relat-grid-a,.relat-grid-b{grid-template-columns:1fr!important}
  #chart-fluxo,#chart-proj,#chart-inad{max-height:180px}
  #chart-saude{max-height:140px}
  #chart-tipo{max-height:110px!important;max-width:110px!important}
}

/* ── BOTTOM NAV MOBILE ──────────────────────────────────── */
.bnav-item{display:flex;flex-direction:column;align-items:center;gap:2px;padding:.35rem .5rem;background:none;border:none;cursor:pointer;font-size:10px;font-weight:600;color:var(--n4);min-width:52px;border-radius:var(--rs);transition:color .15s}
.bnav-item.active{color:var(--grn)}
.bnav-item svg{width:20px;height:20px;stroke:currentColor}
body.bottom-nav-mode .sidebar{display:none!important}
body.bottom-nav-mode .app-body{min-height:calc(100vh - 56px - 60px)}
body.bottom-nav-mode .content{padding-bottom:80px}
body.bottom-nav-mode #bottom-nav{display:block!important}
@media(min-width:769px){
  body.bottom-nav-mode .sidebar{display:flex!important}
  body.bottom-nav-mode #bottom-nav{display:none!important}
}

/* ── MOBILE TABLE COLUMNS ───────────────────────────────────── */
@media(max-width:640px){
  .hide-mobile{display:none!important}
  /* Juros e Total também ficam menores */
  #th-sort-juros,#th-sort-total{display:none!important}
  .hide-mobile-juros{display:none!important}
}

@media(max-width:640px){.perfil-grid{grid-template-columns:1fr!important}}
/* ── SORT HEADERS ───────────────────────────────────────────── */
th.sortable{cursor:pointer;user-select:none;white-space:nowrap}
th.sortable:hover{background:#F3F4F6;color:var(--n1)}
th.sortable .sort-icon{display:inline-block;margin-left:4px;opacity:.35;font-size:10px;transition:opacity .15s}
th.sortable.asc .sort-icon::after{content:'↑';opacity:1}
th.sortable.desc .sort-icon::after{content:'↓';opacity:1}
th.sortable:not(.asc):not(.desc) .sort-icon::after{content:'↕'}
th.sortable.asc,th.sortable.desc{color:var(--grn)}

@media print{button{display:none}}
/* Badges de Planos */
.nav-badge.badge-bronze{background:linear-gradient(135deg,#CD7F32 0%,#A0522D 100%);color:#fff;border:none}
.nav-badge.badge-prata{background:linear-gradient(135deg,#C0C0C0 0%,#A8A8A8 100%);color:#fff;border:none}
.nav-badge.badge-ouro{background:linear-gradient(135deg,#FFD700 0%,#DAA520 100%);color:#fff;border:none}
.nav-badge.badge-platinum{background:linear-gradient(135deg,#E5E4E2 0%,#B8B8B8 100%);color:#1F2937;border:none;font-weight:800}
.nav-badge.badge-diamante{background:linear-gradient(135deg,#60A5FA 0%,#818CF8 60%,#C084FC 100%);color:#fff;border:none;font-weight:800;box-shadow:0 0 8px rgba(129,140,248,.45)}

</style>
  </head><body>
  <h1>${tom.nome}</h1>
  <h2>${tom.contato||''} ${tom.ocupacao?'· '+tom.ocupacao:''} · Impresso em ${new Date().toLocaleDateString('pt-BR')}</h2>
  <div class="stat-grid">
    <div class="stat"><div class="stat-label">Total Emprestado</div><div class="stat-val" style="color:#2563EB">${fmtR(totalEmp)}</div></div>
    <div class="stat"><div class="stat-label">Recebido</div><div class="stat-val" style="color:#16A34A">${fmtR(totalRec)}</div></div>
    <div class="stat"><div class="stat-label">Saldo Devedor</div><div class="stat-val" style="color:#DC2626">${fmtR(saldoDevedor)}</div></div>
    <div class="stat"><div class="stat-label">Parcelas Pagas</div><div class="stat-val">${pagas}/${todasP.length}</div></div>
  </div>
  <table><thead><tr><th>Data</th><th>Valor</th><th>Juros</th><th>Parcela</th><th>Garantia</th><th>Situação</th></tr></thead>
  <tbody>${empRows}</tbody></table>
  <div class="footer">GEPainel · ${session?.nome||''}</div>
  <br><button onclick="window.print()" style="padding:.5rem 1.5rem;background:#EA580C;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px">🖨 Imprimir</button>
  </body></html>`);
  win.document.close();
}

// ══ INIT ══
// STAR CANVAS ANIMATION
(function initStars(){
  var canvas=document.getElementById('stars-canvas');
  if(!canvas)return;
  var ctx=canvas.getContext('2d');
  var stars=[];
  function resize(){
    // Usa a altura real da viewport, considerando barras de navegação mobile
    const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
    canvas.width=window.innerWidth;
    canvas.height=vh;
  }
  resize();
  window.addEventListener('resize',resize);
  for(var i=0;i<220;i++){
    stars.push({x:Math.random(),y:Math.random(),r:Math.random()*1.3+.2,a:Math.random(),da:(Math.random()*.004+.001)*(Math.random()>.5?1:-1)});
  }
  function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    stars.forEach(function(s){
      s.a+=s.da;
      if(s.a<0||s.a>1)s.da=-s.da;
      ctx.beginPath();
      ctx.arc(s.x*canvas.width,s.y*canvas.height,s.r,0,2*Math.PI);
      ctx.fillStyle='rgba(255,255,255,'+s.a.toFixed(2)+')';
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  draw();
})();

window.addEventListener('DOMContentLoaded',async()=>{
  loadDarkMode();
  loadSavedCreds();
  loadWaNumber();
  session=readSession();
  if(session){
    document.getElementById('login-page').style.display='none';
    document.getElementById('app-page').style.display='flex';
    await bootApp();
  }
  _lastActivity=Date.now();
  ['click','keydown','mousedown','touchstart','scroll'].forEach(ev=>{
    document.addEventListener(ev,()=>{_lastActivity=Date.now();},{passive:true});
  });
  // Detecta se está rodando como PWA instalado (standalone)
  const _isStandalonePWA=window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone===true
    || document.referrer.includes('android-app://');
  
  // Timer de inatividade: só roda quando a aba está visível
  setInterval(()=>{
    if(!session)return;
    if(document.hidden)return; // Pausa quando aba está em background
    if(_isStandalonePWA)return; // No modo PWA instalado, sessão fica sempre ativa
    if(Date.now()-_lastActivity>TIMEOUT_MS){
      toast('Sessão encerrada por inatividade.',true);
      setTimeout(doLogout,1500);
    }
  },30000);
});

<!-- PWA: Service Worker (instalação como app) -->

// ═══════════════════════════════════════════════════════════
// EXPORTAÇÕES GLOBAIS (para HTML inline events)
// ═══════════════════════════════════════════════════════════
window.showRegister = showRegister;
window.showLogin = showLogin;
window.doLogin = doLogin;
window.doRegister = doRegister;
window.logout = logout;
window.doLogout = doLogout;
window.toggleSidebar = toggleSidebar;
window.closeSidebar = closeSidebar;
window.showPage = showPage;
window.openM = openM;
window.closeM = closeM;
window.openEmpModal = openEmpModal;
window.openTomModal = openTomModal;
window.openParcelas = openParcelas;
window.saveEmp = saveEmp;
window.saveTom = saveTom;
window.deleteTom = deleteTom;
window.deleteEmp = deleteEmp;
window.marcarPago = marcarPago;
window.deleteParcela = deleteParcela;
window.filterEmp = filterEmp;
window.filterTom = filterTom;
window.setEmpFilter = setEmpFilter;
window.setTomFilter = setTomFilter;
window.exportExcel = exportExcel;
window.maskTel = maskTel;
window.maskCurrency = maskCurrency;
window.updateEmpCalc = updateEmpCalc;
window.setTipoEmp = setTipoEmp;
window.addParcela = addParcela;
window.saveParcela = saveParcela;
window.sortEmp = sortEmp;
window.sortTom = sortTom;
window.openUserModal = openUserModal;
window.saveUsr = saveUsr;
window.deleteUser = deleteUser;
window.toggleUserStatus = toggleUserStatus;
window.closeEsqueciSenha = closeEsqueciSenha;
window.openEsqueciSenha = openEsqueciSenha;
window.enviarRecuperacaoSenha = enviarRecuperacaoSenha;
window.abrirRenovacao = abrirRenovacao;
window.abrirQuitacao = abrirQuitacao;
window.confirmarQuitacao = confirmarQuitacao;
window.salvarAbatimento = salvarAbatimento;
window.abrirModalAbatimento = abrirModalAbatimento;
window.marcarPendente = marcarPendente;
window.toggleSelecaoParc = toggleSelecaoParc;
window.toggleAllParcs = toggleAllParcs;
window.onChkParcChange = onChkParcChange;
window.confirmarPagamentoLote = confirmarPagamentoLote;
window.toggleSelectMode = toggleSelectMode;
window.toggleAllChk = toggleAllChk;
window.onChkChange = onChkChange;
window.deleteSelectedEmps = deleteSelectedEmps;
window.clearDateFilter = clearDateFilter;
window.toggleBottomNav = toggleBottomNav;
window.toggleCalcSidebar = toggleCalcSidebar;
window.toggleCalSidebar = toggleCalSidebar;
window.calcNav = calcNav;
window.calNav = calNav;
window.calcPress = calcPress;
window.togglePwd = togglePwd;
window.openClientView = openClientView;
window.closeClientView = closeClientView;
window.editarDadosCliente = editarDadosCliente;
window.salvarEdicaoCliente = salvarEdicaoCliente;
window.cancelarEdicaoCliente = cancelarEdicaoCliente;
window.abrirCobranca = abrirCobranca;
window.confirmarPagamentoCliente = confirmarPagamentoCliente;
window.abrirIndicacao = abrirIndicacao;
window.copiarCodigoIndicacao = copiarCodigoIndicacao;
window.compartilharIndicacao = compartilharIndicacao;
window.abrirWhatsApp = abrirWhatsApp;
window.saveWaNumber = saveWaNumber;
window.clearWaNumber = clearWaNumber;
window.testarMensagemWa = testarMensagemWa;
window.atualizarAvatar = atualizarAvatar;
window.removerAvatar = removerAvatar;
window.atualizarEmail = atualizarEmail;
window.atualizarSenha = atualizarSenha;
window.voltarParaPlanos = voltarParaPlanos;
window.escolherPlano = escolherPlano;
window.continuarComCpf = continuarComCpf;
window.formatarCpfInput = formatarCpfInput;
window.copiarPix = copiarPix;
window.avisarPagamento = avisarPagamento;
window.mostrarAvisoRenovacao = mostrarAvisoRenovacao;
window.instalarApp = instalarApp;
window.fecharIosInstallModal = fecharIosInstallModal;
window.toggleRemember = toggleRemember;
