// ════════════════════════════════════════════════════════════════
// SIDEBAR — Sidebar, Bottom Nav, Calculadora, Calendário, Pop-ups
// ════════════════════════════════════════════════════════════════

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


