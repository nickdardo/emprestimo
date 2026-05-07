// ════════════════════════════════════════════════════════════════
// DASHBOARD — Renderização da página principal e selector de usuário
// ════════════════════════════════════════════════════════════════

// ══ DASHBOARD ══

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
  // Lucro Esperado: soma apenas dos ativos (lucro que ainda vai entrar)
  const totalLucro = empsAtivos.reduce((s,e)=>s+Number(e.lucro||0),0);
  const pRecebido  = parcs.filter(p=>p.status==='pago').reduce((s,p)=>s+Number(p.valor||0),0);
  const pPendente  = parcs.filter(p=>p.status==='pendente').reduce((s,p)=>s+Number(p.valor||0),0);
  const atrasadas  = parcs.filter(p=>isAtrasada(p));
  // Pendentes que ainda vão vencer (não estão atrasadas) — para subtítulo do card
  const aVencer    = parcs.filter(p=>p.status==='pendente'&&!isAtrasada(p));
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
        ${userAtivo ? '<span class="role-tag">Credor</span>' : ''}
      </div>
      <div style="display:flex;gap:.5rem">
        <button class="btn btn-grn btn-sm" onclick="openEmpModal(null)">+ Novo Empréstimo</button>
      </div>
    </div>
    <div class="stats">
      <div class="stat"><span class="stat-info" onclick="toggleStatInfo('total-emprestado',this)" title="O que é?"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></span><div class="stat-label">Total Emprestado</div><div class="stat-value" style="color:var(--blu)">${fmtR(totalEmp)}</div><div class="stat-sub">${empsAtivos.length} em aberto</div></div>
      <div class="stat"><span class="stat-info" onclick="toggleStatInfo('lucro-esperado',this)" title="O que é?"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></span><div class="stat-label">Lucro Esperado</div><div class="stat-value" style="color:var(--grn)">${fmtR(totalLucro)}</div><div class="stat-sub">em juros</div></div>
      <div class="stat"><span class="stat-info" onclick="toggleStatInfo('recebido',this)" title="O que é?"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></span><div class="stat-label">Recebido</div><div class="stat-value" style="color:var(--grn)">${fmtR(pRecebido)}</div><div class="stat-sub">em parcelas pagas</div></div>
      <div class="stat"><span class="stat-info" onclick="toggleStatInfo('proximas-parcelas',this)" title="O que é?"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></span><div class="stat-label">Próximas Parcelas</div><div class="stat-value" style="color:var(--amb)">${fmtR(pPendente)}</div><div class="stat-sub">${aVencer.length} a vencer${atrasadas.length?` · <span style="color:var(--red);font-weight:600">${atrasadas.length} em atraso</span>`:''}</div></div>
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
            
            // Ordenar por data de vencimento mais próxima
            return Object.values(porCliente)
              .sort((a, b) => {
                const dataA = a.parcelas.length > 0 ? new Date(a.parcelas[0].vencimento) : new Date();
                const dataB = b.parcelas.length > 0 ? new Date(b.parcelas[0].vencimento) : new Date();
                return dataA - dataB;
              })
              .map(item=>{
                // Pegar garantia do primeiro empréstimo (se houver)
                const garantia = item.parcelas[0]?.emp?.garantia || '';
                const nomeComGarantia = garantia ? `${item.tomador.nome} <span style="color:#64748B;font-weight:400;font-size:12px">(${garantia})</span>` : item.tomador.nome;
                
                // Ordenar parcelas por data de vencimento
                const parcelasOrdenadas = [...item.parcelas].sort((a, b) => {
                  return new Date(a.vencimento) - new Date(b.vencimento);
                });
                
                return `
              <div style="margin-bottom:.75rem;border:2px solid ${filtroAtivo==='hoje'?'#FECACA':filtroAtivo==='3dias'?'#FDE68A':'#CBD5E1'};border-radius:var(--rs);overflow:hidden;background:${filtroAtivo==='hoje'?'#FEF2F2':filtroAtivo==='3dias'?'#FFFBEB':'#F8FAFC'};cursor:pointer;transition:all .2s;box-shadow:0 2px 4px rgba(0,0,0,.1)" onclick="openClientView('${item.tomador.id}')" onmouseenter="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 8px rgba(0,0,0,.15)'" onmouseleave="this.style.transform='translateY(0)';this.style.boxShadow='0 2px 4px rgba(0,0,0,.1)'">
                <div style="padding:.75rem 1rem">
                  <div style="font-weight:700;color:#1E293B;margin-bottom:4px;font-size:14px">${nomeComGarantia}</div>
                  ${parcelasOrdenadas.map(p=>`
                    <div style="font-size:11px;color:#64748B;margin-top:2px">
                      • ${fmtR(p.valor)} · Venc: ${fmtDate(p.vencimento)} · ${p.numero}º ${p.emp?.tipo==='consignado'?'Parcela':'Juros'}
                    </div>
                  `).join('')}
                </div>
              </div>
            `}).join('');
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

// ══ FILTROS DE VENCIMENTO ══
// (filtroAtivo é declarado em state.js)

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

// ══ INFO MODAL DOS CARDS DE STATÍSTICAS DO DASHBOARD ══
const _STAT_INFOS = {
  'total-emprestado':{
    titulo:'Total Emprestado',
    cor:'var(--blu)',
    resumo:'Capital ativo na rua — dinheiro que ainda não voltou pro seu bolso.',
    detalhe:'Pega os empréstimos ativos (que têm pelo menos uma parcela pendente, ou são ilimitados sem prazo) e soma o saldo devedor de cada um. Quando há abatimento parcial (ex: cliente pagou metade do principal via "Quitar"), conta apenas o que ainda falta. Não inclui empréstimos quitados.'
  },
  'lucro-esperado':{
    titulo:'Lucro Esperado',
    cor:'var(--grn)',
    resumo:'Quanto ainda vai entrar de juros nos empréstimos ativos.',
    detalhe:'Soma o lucro previsto de cada empréstimo ativo. Para empréstimos a juros: total dos juros mensais que ainda serão cobrados. Para consignados: diferença entre o total das parcelas pendentes e o principal correspondente. Quitados não entram na conta.'
  },
  'recebido':{
    titulo:'Recebido',
    cor:'var(--grn)',
    resumo:'Dinheiro vivo que já entrou no seu caixa.',
    detalhe:'Soma o valor de todas as parcelas com status "pago". Inclui: juros mensais já cobrados em empréstimos a juros, parcelas pagas de consignados (que trazem parte do principal + parte do juro) e quitações registradas como parcela paga.'
  },
  'proximas-parcelas':{
    titulo:'Próximas Parcelas',
    cor:'var(--amb)',
    resumo:'Soma de todo o dinheiro agendado para entrar.',
    detalhe:'Soma o valor das parcelas com status "pendente". O subtítulo separa em duas situações: <strong style="color:var(--n2)">a vencer</strong> (vencimento ainda no futuro) e <strong style="color:var(--red)">em atraso</strong> (vencimento já passou e não foi pago).'
  }
};

function toggleStatInfo(key,btn){
  const existing=document.getElementById('stat-info-modal');
  // Se já existe e é da mesma chave → fecha (toggle off)
  if(existing){
    const sameKey=existing.getAttribute('data-key')===key;
    existing.remove();
    document.querySelectorAll('.stat-info.active').forEach(el=>el.classList.remove('active'));
    if(sameKey)return;
  }
  const info=_STAT_INFOS[key];
  if(!info)return;
  if(btn)btn.classList.add('active');
  const div=document.createElement('div');
  div.id='stat-info-modal';
  div.setAttribute('data-key',key);
  div.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:400;display:flex;align-items:center;justify-content:center;padding:1rem;animation:fadeIn .15s ease-out';
  div.onclick=e=>{if(e.target===div){div.remove();document.querySelectorAll('.stat-info.active').forEach(el=>el.classList.remove('active'));}};
  div.innerHTML=`<div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);width:100%;max-width:440px;padding:1.4rem 1.5rem 1.25rem;box-shadow:0 20px 50px rgba(0,0,0,.45);position:relative">
    <button onclick="document.getElementById('stat-info-modal').remove();document.querySelectorAll('.stat-info.active').forEach(el=>el.classList.remove('active'))" style="position:absolute;top:.5rem;right:.5rem;width:32px;height:32px;background:transparent;border:none;color:var(--n4);cursor:pointer;font-size:22px;line-height:1;border-radius:50%;transition:all .15s;display:flex;align-items:center;justify-content:center" onmouseenter="this.style.color='var(--red)';this.style.background='var(--card2)'" onmouseleave="this.style.color='var(--n4)';this.style.background='transparent'" aria-label="Fechar">×</button>
    <div style="font-family:var(--FT);font-size:1.15rem;color:${info.cor};margin-bottom:.6rem;padding-right:2rem;font-weight:700">${info.titulo}</div>
    <div style="font-size:13px;color:var(--n2);margin-bottom:1rem;line-height:1.5">${info.resumo}</div>
    <div style="font-size:10px;font-weight:700;color:var(--n4);text-transform:uppercase;letter-spacing:.06em;margin-bottom:.4rem">Como é calculado</div>
    <div style="font-size:12px;color:var(--n3);line-height:1.55">${info.detalhe}</div>
  </div>`;
  document.body.appendChild(div);
}
