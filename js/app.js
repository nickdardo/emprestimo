// ════════════════════════════════════════════════════════════════
// APP — Boot, plano do usuário, avisos, logout, carregamento de dados
// ════════════════════════════════════════════════════════════════

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

