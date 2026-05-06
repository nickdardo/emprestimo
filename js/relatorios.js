// ════════════════════════════════════════════════════════════════
// RELATORIOS — Renderização do relatório, gráficos, exportação PDF/CSV
// ════════════════════════════════════════════════════════════════

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

