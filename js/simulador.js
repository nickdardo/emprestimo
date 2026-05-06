// ════════════════════════════════════════════════════════════════
// SIMULADOR — Simulador de empréstimo com tabela de referência
// ════════════════════════════════════════════════════════════════

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


