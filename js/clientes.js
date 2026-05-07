// ════════════════════════════════════════════════════════════════
// CLIENTES — CRUD tomadores, ficha do cliente, exportação Excel
// ════════════════════════════════════════════════════════════════

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
    <td style="color:var(--n4);font-size:12px">${i}</td>
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
  return emps.every(e=>isEmprestimoQuitado(e));
}

function tomTbodyHTML(list){
  if(!list.length)return`<tr><td colspan="8"><div class="empty"><div style="font-size:2rem;margin-bottom:.5rem;color:var(--n5)">—</div><div class="empty-text">Nenhum cliente.</div></div></td></tr>`;
  
  const ativos=list.filter(t=>!_isClienteQuitado(t));
  const quitados=list.filter(t=>_isClienteQuitado(t));
  
  let html='';
  // Ativos — numeração invertida (topo recebe o maior número, decresce até 1)
  if(ativos.length){
    html+=ativos.map((t,i)=>_tomRow(t,ativos.length-i)).join('');
  }
  // Separador + Quitados (contagem independente, também invertida)
  if(quitados.length){
    html+=`<tr><td colspan="7" style="padding:.75rem 1rem;background:#F0FDF4;border-top:2px solid #D1FAE5;border-bottom:1px solid #D1FAE5">
      <div style="display:flex;align-items:center;gap:.5rem">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        <span style="font-size:12px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:.05em">Quitados (${quitados.length})</span>
      </div>
    </td></tr>`;
    html+=quitados.map((t,i)=>{
      const row=_tomRow(t,quitados.length-i);
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

