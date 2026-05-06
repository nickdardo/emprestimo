// ════════════════════════════════════════════════════════════════
// PARCELAS — CRUD, pagamentos, mora, quitação, seleção em lote
// ════════════════════════════════════════════════════════════════

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

