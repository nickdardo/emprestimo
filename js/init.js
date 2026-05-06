// ════════════════════════════════════════════════════════════════
// INIT — Dark mode, busca global, imprimir ficha, canvas, inicialização
// ════════════════════════════════════════════════════════════════

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
