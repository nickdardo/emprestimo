// ════════════════════════════════════════════════════════════════
// EMPRESTIMOS — CRUD, importação Excel, exportação, filtros, ordenação
// ════════════════════════════════════════════════════════════════

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
  const b64='UEsDBBQABgAIAAAAIQASGN7dZAEAABgFAAATAAgCW0NvbnRlbnRfVHlwZXNdLnhtbCCiBAIooAACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADElM9uwjAMxu+T9g5VrlMb4DBNE4XD/hw3pLEHyBpDI9Ikig2Dt58bYJqmDoRA2qVRG/v7fnFjD8frxmYriGi8K0W/6IkMXOW1cfNSvE+f8zuRISmnlfUOSrEBFOPR9dVwugmAGWc7LEVNFO6lxKqGRmHhAzjemfnYKOLXOJdBVQs1Bzno9W5l5R2Bo5xaDTEaPsJMLS1lT2v+vCWJYFFkD9vA1qsUKgRrKkVMKldO/3LJdw4FZ6YYrE3AG8YQstOh3fnbYJf3yqWJRkM2UZFeVMMYcm3lp4+LD+8XxWGRDko/m5kKtK+WDVegwBBBaawBqLFFWotGGbfnPuCfglGmpX9hkPZ8SfhEjsE/cRDfO5DpeX4pksyRgyNtLOClf38SPeZcqwj6jSJ36MUBfmof4uD7O4k+IHdyhNOrsG/VNjsPLASRDHw3a9el/3bkKXB22aGdMxp0h7dMc230BQAA//8DAFBLAwQUAAYACAAAACEAtVUwI/QAAABMAgAACwAIAl9yZWxzLy5yZWxzIKIEAiigAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKySTU/DMAyG70j8h8j31d2QEEJLd0FIuyFUfoBJ3A+1jaMkG92/JxwQVBqDA0d/vX78ytvdPI3qyCH24jSsixIUOyO2d62Gl/pxdQcqJnKWRnGs4cQRdtX11faZR0p5KHa9jyqruKihS8nfI0bT8USxEM8uVxoJE6UchhY9mYFaxk1Z3mL4rgHVQlPtrYawtzeg6pPPm3/XlqbpDT+IOUzs0pkVyHNiZ9mufMhsIfX5GlVTaDlpsGKecjoieV9kbMDzRJu/E/18LU6cyFIiNBL4Ms9HxyWg9X9atDTxy515xDcJw6vI8MmCix+o3gEAAP//AwBQSwMEFAAGAAgAAAAhAChwVFCuAgAAMgYAAA8AAAB4bC93b3JrYm9vay54bWykVNtu4jAQfV9p/8Hye0gMNEDUUJVCtUi9oF5fkCqTGGLVsbOOw0VVn/cL9ov6YztOgEJ56bZRYmc8yfGZmeM5PlmmAs2ZzrmSISY1DyMmIxVzOQvx/d2508YoN1TGVCjJQrxiOT7p/vxxvFD6eaLUMwIAmYc4MSYLXDePEpbSvKYyJsEzVTqlBkw9c/NMMxrnCWMmFW7d83w3pVziCiHQn8FQ0ymPWF9FRcqkqUA0E9QA/TzhWb5BS6PPwKVUPxeZE6k0A4gJF9ysSlCM0igYzqTSdCIg7CU5QksNtw8P8WCob3YC18FWKY+0ytXU1ADarUgfxE88l5C9FCwPc/A5pKar2ZzbGm5Zaf+LrPwtlv8ORrxvoxGQVqmVAJL3RbSjLbc67h5PuWAPlXQRzbIrmtpKCYwEzc0g5obFIW6BqRZsb0EXWa/gArz1Tqt+hN3uVs4jDQbU/lQYpiU17ExJA1JbU/+urErss0SBiNEN+11wzeDsgIQgHBhpFNBJPqImQYUWIT4Lxvc5RDhmcUF1rGpK8Dnjmo77aiGFguM03tEhPRT9fyiRRjYRLgRfEazePyYCeOpgo7aR0Qjeh/0LyPgtnUP+ocrx+ngOIcGk8SQjHZCnF9Lvt7yG33Z6nU7LafoD32mfdohDmr1Gp97qtRqN81cIRvtBpGhhknVpLXSIm1DHA9clXW48xAsKHr/TePHWl2PnD8PG92oDtk3sgbNF/i4Ca6LlI5exWoTYIR40wdW+uSidjzw2CVAgzQ4clmrtF+OzBBgTv20XQeyWWYj3GPUrRudwOXbYY+TuUCrbJVArZyRLiV9e9wcX19CXbSstk4yRDuweehgTG9Pu18Or27ub+7c/b38Htzv/QP/a/lMvC7/ZKqIiGmlkJwvulc5Nu+/+AwAA//8DAFBLAwQUAAYACAAAACEASqmmYfoAAABHAwAAGgAIAXhsL19yZWxzL3dvcmtib29rLnhtbC5yZWxzIKIEASigAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAvJLNasQwDITvhb6D0b1xkv5Qyjp7KYW9ttsHMLESh01sY6k/efualO42sKSX0KMkNPMxzGb7OfTiHSN13ikoshwEutqbzrUKXvdPV/cgiLUzuvcOFYxIsK0uLzbP2GtOT2S7QCKpOFJgmcODlFRbHDRlPqBLl8bHQXMaYyuDrg+6RVnm+Z2MvzWgmmmKnVEQd+YaxH4Myflvbd80XY2Pvn4b0PEZC8mJC5Ogji2ygmn8XhZZAgV5nqFck+HDxwNZRD5xHFckp0u5BFP8M8xiMrdrwpDVEc0Lx1Q+OqUzWy8lc7MqDI996vqxKzTNP/ZyVv/qCwAA//8DAFBLAwQUAAYACAAAACEA09+AbHQQAABtfQAAGAAAAHhsL3dvcmtzaGVldHMvc2hlZXQxLnhtbLTdWW8b17KG4fsN7P8g8D6WSMlObFgOSLPneR7uZJm2hUiiN0UP2Qfnv5/VZFNaXS9t5ATpIPHwsGr1wI9NqhSoX//+/e725Otq83Czvr+cTJ+dTU5W99fr9zf3Hy8nRW7+8tvk5GF7df/+6nZ9v7qc/Ll6mPz+5t//ev1tvfnj4dNqtT1RK9w/XE4+bbefX52ePlx/Wt1dPTxbf17dq0c+rDd3V1v1183H04fPm9XV+13T3e3p7Ozsxend1c39ZL/Cq81fWWP94cPN9Wq5vv5yt7rf7hfZrG6vtmr/Hz7dfH44rHZ3/VeWu7va/PHl8y/X67vPaol3N7c32z93i05O7q5fOR/v15urd7fquL9PL66uT75v1L8z9d/5YTM7x5bubq4364f1h+0ztfLpfp95+C9PX55eXT+uxOP/S8tML043q6833RP4tNTs7+3S9PnjWrOnxc7/5mIvHhfrTtfm1Zeb95eT/znr//lF/T7tfjl7+uXw2P9O3rx+f6Oe4e6oTjarD5eT+fTVfPH8bHL65vUuQeXN6tuD9ueT7dW7bHW7ut6u1Famk5MuoO/W6z+6QkfRmVrz89X96uR79lk9zbuaP/s/qv3brj/7qw/bt6vb28vJ4mJycnW9vfm6ilXH5eTdertd36U3Hz9tdy+HrbIPm/V/V/e7/dltttvTbv3LiVpqX9rtq3hsv1K3pWOdg+3sd2C/Q85U7eLDf3ZnovuzWvn08TTofz6cEnP3uos3J+9XH66+3G7T9Td71e2/Ou6LZ+rwdsF99f7P5erhWr2S1Pl5tlv2en2r1lC/ntzddFcE9UK4+r4/oTfvt58uJ88nJ9dfHtTpqPZ/n3Y781ivYrOrV79/2z8+U1eQnzSo49o1qF3qG6Y/b1Db3zWo3w8N6qL1ky286BvU74cGtbGfNPzaN6j9ODSo3p80vDwctNZxdBOn+7O7e+aWV9urN683628n6oWvTvODCo+6jE5fdSese55mvz07ezzZj0/eD5459RR068y7hdQiXaAvJw8q8l/fnL0+/aoict2XLPqS2e5565reQpYQA2JCLIity6k61scDVvnAAZ8/Po9/9Wi7VdTRqq08Hu1UHG1foh0tZAkxICbEgti6DI62e/HKp/d8+uzl//vp7RbapeXxeGfiePcVak8eK86HFW9ZcTGsWLLi+bDCYMWLYYXJPf11WGGx4rdhhc2tvBxWOPsKPe1TEXf3SInIiHekRJxW/0iJOK/BkRJxYsMjJeLMRkdKxKmNj5SIc5scKREnNz1SIs5uxpKZOLv5kRJxdosjJeLslkdKxNmtjpSIs1sfKRFntzlSIs5ue6REnN35/EiNOL3zxZGap/M7uDqot4rB1aF7hT++fezfyHev+d2b98u/cdXoNnA5udi9G8jr4/4xdSF6vF5ciMN9e6REnLTloaR7v5lO1cc4cb0YPC4eNA+7132O6N6PLAk29+BcLOIcerTrnjhU90iJCKJ3pEQE0Zc7F0gIJUQSYgmJhFRCJiGXUEgoJVQSagmNhFbCfA7pPizv4tV9KNXf41Woxs11t4Ef5Xr/2CDX4iX6liXPRaqWh5If5Vp/XF4bzcPuPeZagr2H6fPdK/Pi+csLcb1yDh0/SfWREpnqIyUy1XLXAgmhhEhCLCGRkErIJOQSCgmlhEpCLaGR0EqYzyELTQapVl8KjJvqbgM/SvX+MbVrT1dr8ab9liXPxYVweSj5Uar1x+WF1jzs3mOqJdh7OKT6hZrziE9th46fpPpIiUz1kRKZarlrgYRQQiQhlpBISCVkEnIJhYRSQiWhltBIaCXM55CFJoNUq695x011t4Eu1YfYLPbw/OmrUAlLCYYEUy5qSbBliyMrXAmeBF9CICGUEEmIJSQSUgmZhFxCIaGUUEmoJTQSWgnzOaR/7nZP5iBF3bBY/zr3H/8k221gkKI9aCmSsJRgSDDlopYEW7Y4ssKV4EnwJQQSQgmRhFhCIiGVkEnIJRQSSgmVhFpCI6GVMJ9DFpoMUqTGaeOmqNvAIEV70FIkYSnBkGDKRS0JtmxxZIUrwZPgSwgkhBIiCbGEREIqIZOQSygklBIqCbWERkIrYT6HLDQZpGiqponjxmi3hUGOetGCBFlCDIiJlS2IjS4HNS7Eg/iQABJCIkgMSSApJIPkkAJSQipIDWkgLWQ+Jy10GkZMju3/8fe7brQ9vFT1okdsX/MkS9QYEBMrWxAbXQ5qXIgH8SEBJIREkBiSQFJIBskhBaSEVJAa0kBaiIqYfFLnC52GEZPfKPnnI7b/roX2yXy6Fz1iUpaoMSBmL08rWxAbXQ5qXIgH8SEBJIREkBiSQFJIBskhBaSEVJAa0kBaiIqYfFJVxDQaRqybVI/6qX33zevhG+V+Oq5HTMqy73qqMSAmVrYgNrr230zX98dFlwfxIQEkhESQGJJAUkgGySEFpIRUkBrSQFqIitj+CXt6dauIaTSMWDciHjdiciy96L6Foi6WesSkLFFjQMxe9KuY3JaNLgddLsSD+JAAEkIiSAxJICkkg+SQAlJCKkgNaSAtREWM32vQaRixbl47bsTkjHihRpwyYlKWqDEgZi96xOS2bHQ56HIhHsSHBJAQEkFiSAJJIRkkhxSQElJBakgDaSEqYhz86zSMWDc8HTdicmC7mO5Fv4pJWaLGgJi96BGT27LR5aDLhXgQHxJAQkgEiSEJJIVkkBxSQEpIBakhDaSFqIhxCq/TMGLdrHXciMlp7mK6Fz1iUpaoMSBmL3rE5LZsdDnociEexIcEkBASQWJIAkkhGSSHFJASUkFqSANpISpiHNHrNIxYN3YdN2Jy1Lvo/pdO8VlMyhI1BsTsRY+Y3JaNLgddLsSD+JAAEkIiSAxJICkkg+SQAlJCKkgNaSAtREWM83udhhHrZrLjRkzOgRfTvehXMSlL1BgQsxc9YnJbNrocdLkQD+JDAkgIiSAxJIGkkAySQwpICakgNaSBtBAVMQ73dRpEbDb6dH+3hcHQohctYpAlxICYWNmC2OhyUONCPIgPCSAhJILEkASSQjJIDikgJaSC1JAG0kLmc9JCp2HERp/uzzDd70WPGKb7qDEgJla2IDa6HNS4EA/iQwJICIkgMSSBpJAMkkMKSAmpIDWkgbQQFTFO93UaRmz06f4M0/1e9Ihhuo8aA2JiZQtio8tBjQvxID4kgISQCBJDEkgKySA5pICUkApSQxpIC1ER43Rfp2HERp/uz+QgeNGLHjFM91FjQEysbEFsdDmocSEexIcEkBASQWJIAkkhGSSHFJASUkFqSANpISpinO7rNIzY6NP9Gab7vegRw3QfNQbExMoWxEaXgxoX4kF8SAAJIREkhiSQFJJBckgBKSEVpIY0kBaiIsbpvk7DiI0+3Z9hut+LHjFM91FjQEysbEFsdDmocSEexIcEkBASQWJIAkkhGSSHFJASUkFqSANpISpinO7rNIzY6NP9Gab7vegRw3QfNQbExMoWxEaXgxoX4kF8SAAJIREkhiSQFJJBckgBKSEVpIY0kBaiIsbpvk7DiI0+3Z9hut+LHjFM91FjQEysbEFsdDmocSEexIcEkBASQWJIAkkhGSSHFJASUkFqSANpISpinO7rNIzY6NP97scTDP+XxF70iGG6jxoDYmJlC2Kjy0GNC/EgPiSAhJAIEkMSSArJIDmkgJSQClJDGkgLURHjdF+nYcRGn+7PMN3vRY8YpvuoMSAmVrYgNroc1LgQD+JDAkgIiSAxJIGkkAySQwpICakgNaSBtBAVMU73dRpErPtJION+A2m3hcF0vxctYpAlxICYWNmC2OhyUONCPIgPCSAhJILEkASSQjJIDikgJaSC1JAG0kLUj2XoYqM/qfOFTsOIjT7dP8d0vxc9Ypjuo8aAmFjZgtjoclDjQjyIDwkgISSCxJAEkkIySA4pICWkgtSQBtJCVMQ43ddpGLHRp/vnmO73okcM033UGBATK1sQG10OalyIB/EhASSERJAYkkBSSAbJIQWkhFSQGtJAWoiKGKf7Og0jNvp0/xzT/V70iGG6jxoDYmJlC2Kjy0GNC/EgPiSAhJAIEkMSSArJIDmkgJSQClJDGkgLURHjdF+nYcRGn+6fY7rfix4xTPdRY0BMrGxBbHQ5qHEhHsSHBJAQEkFiSAJJIRkkhxSQElJBakgDaSEqYpzu6zSM2OjT/XNM93vRI4bpPmoMiImVLYiNLgc1LsSD+JAAEkIiSAxJICkkg+SQAlJCKkgNaSAtREWM032dhhEbfbp/jul+L3rEMN1HjQExsbIFsdHloMaFeBAfEkBCSASJIQkkhWSQHFJASkgFqSENpIWoiHG6r9MwYqNP988x3e9Fjxim+6gxICZWtiA2uhzUuBAP4kMCSAiJIDEkgaSQDJJDCkgJqSA1pIG0EBUxTvd1GkZs9On+Oab7vegRw3QfNQbExMoWxEaXgxoX4kF8SAAJIREkhiSQFJJBckgBKSEVpIY0kBaiIsbpvk7DiI0+3T/HdL8XPWKY7qPGgJhY2YLY6HJQ40I8iA8JICEkgsSQBJJCMkgOKSAlpILUkAbSQlTEON3XaRCxi9Gn+7stDKb7vWgRgywhBsTEyhbERpeDGhfiQXxIAAkhESSGJJAUkkFySAEpIRWkhjSQFqJ+8Cyn+zoNIzb6dP8C0/1e9Ihhuo8aA2JiZQtio8tBjQvxID4kgISQCBJDEkgKySA5pICUkApSQxpIC1ER43Rfp2HERp/uX2C634seMUz3UWNATKxsQWx0OahxIR7EhwSQEBJBYkgCSSEZJIcUkBJSQWpIA2khKmKc7us0jNjo0/0LTPd70SOG6T5qDIiJlS2IjS4HNS7Eg/iQABJCIkgMSSApJIPkkAJSQipIDWkgLURFjNN9nYYRG326f4Hpfi96xDDdR40BMbGyBbHR5aDGhXgQHxJAQkgEiSEJJIVkkBxSQEpIBakhDaSFqIhxuq/TMGKjT/cvMN3vRY8YpvuoMSAmVrYgNroc1LgQD+JDAkgIiSAxJIGkkAySQwpICakgNaSBtBAVMU73dRpGbPTp/gWm+73oEcN0HzUGxMTKFsRGl4MaF+JBfEgACSERJIYkkBSSQXJIASkhFaSGNJAWoiLG6b5Ow4iNPt2/wHS/Fz1imO6jxoCYWNmC2OhyUONCPIgPCSAhJILEkASSQjJIDikgJaSC1JAG0kJUxDjd12kYsdGn+xeY7veiRwzTfdQYEBMrWxAbXQ5qXIgH8SEBJIREkBiSQFJIBskhBaSEVJAa0kBaiIoYp/s6DSM2+nT/AtP9XvSIYbqPGgNiYmULYqPLQY0L8SA+JICEkAgSQxJICskgOaSAlJAKUkMaSAtREeN0X6dBxNQ9ese+7ZccBHf3BRY/XwyyhBgQsxfthz9BbHQ5qHEhHsSHBJAQEkFiSAJJIRkkhxSQElJBakgDaSHqBlyc7uu0j9j+nsf7O+ferTYfV93dkR9OrtdfujsYz9Rt1B61v2v07JW6K6u655D06St1b9ruhnVPy3S3h/64Cq42H2/uH05u1S2au5si/6q+DNnsb5y8/4u6u/Puboz7ezXvb8yobmu+UjcuPHumij+s19vDX7oNPN4o/c3/AQAA//8DAFBLAwQUAAYACAAAACEA9xuqn7ACAAD/CQAAGAAAAHhsL3dvcmtzaGVldHMvc2hlZXQyLnhtbKyW22rjMBCG7xf2HYTuY1uJmzQmTimUsr1YWJY9XCuyHIvalpGUQ1n23XdG3rpu4kAJNj4fvn9Go5nx6u5YlWQvjVW6TikLIkpkLXSm6m1Kf/54nNxSYh2vM17qWqb0RVp6t/78aXXQ5tkWUjoChNqmtHCuScLQikJW3Aa6kTU8ybWpuINLsw1tYyTP/EdVGU6jaB5WXNW0JSTmIwyd50rIBy12laxdCzGy5A7st4Vq7CutEh/BVdw875qJ0FUDiI0qlXvxUEoqkTxta234pgS/jyzmghwNrFPYZq8y/v6ZUqWE0VbnLgBy2Np87v4yXIZcdKRz/z+EYXFo5F5hAN9Q0+tMYjcda/oGm10Jm3cwHC6T7FSW0j/R/2UCR4a7aBIx3PWWv3S9yhREGL0iRuYpvWfJPYtpuF75CfRLyYPtnROcjxutn/HBE+hE+Gp49u6jn4/fDMlkznel+64PX6TaFg4mfxzEYCcGOsleHqQVMMMAFMwQJXQJerAnlcJMgQnCj/54UJkrUnp7Q4nYWaer3+0N5i1ov/N2PHDH1yujDwRCDQDbcEwclsC5N2AZLDtIZ9UFk8AWxNwjJ6VzSsBUC8O2X8/iVbgH3wVsINYpQkRPFRdXCCImpQvvXB8PMR7FIeTAaPYduhl2CKI1iiJy0KPeEM6HFSE6oygiJ6XLvuJiWBECO4oick58vB1WhHEYRRE5J4rLYUVsMWOkAnLeK8bRsCKM/CiKyHkfx5gNKzJorGNkn+cMpR8braC0FaWfgPH0glMDJYVdVcTaooLOdWUsnl0QHavQsLbS9LMwvlA6ofGMVK3bWvNO87S6tU2rbRYN38qv3GxVbUkpc9+OFlA9TNuyogAvnG58P9loB93HnxbwoyWhPUQBPM+1dq8X2BS7X7f1PwAAAP//AwBQSwMEFAAGAAgAAAAhAOmmJbhmBgAAUxsAABMAAAB4bC90aGVtZS90aGVtZTEueG1s7FnNbhs3EL4X6DsQe08s2ZJiGZEDS5biNnFi2EqKHKldapcRd7kgKTu6FcmxQIGiadFLgd56KNoGSIBe0qdxm6JNgbxCh+RKWlpUbCcG+hcdbC334/zPcIa6eu1BytAhEZLyrBVUL1cCRLKQRzSLW8Gdfu/SeoCkwlmEGc9IK5gQGVzbfP+9q3hDJSQlCPZncgO3gkSpfGNlRYawjOVlnpMM3g25SLGCRxGvRAIfAd2UraxWKo2VFNMsQBlOgezt4ZCGBPU1yWBzSrzL4DFTUi+ETBxo0sTZYbDRqKoRciI7TKBDzFoB8In4UZ88UAFiWCp40Qoq5hOsbF5dwRvFJqaW7C3t65lPsa/YEI1WDU8RD2ZMq71a88r2jL4BMLWI63a7nW51Rs8AcBiCplaWMs1ab73antIsgezXRdqdSr1Sc/El+msLMjfb7Xa9WchiiRqQ/VpbwK9XGrWtVQdvQBZfX8DX2ludTsPBG5DFNxbwvSvNRs3FG1DCaDZaQGuH9noF9RlkyNmOF74O8PVKAZ+jIBpm0aVZDHmmlsVaiu9z0QOABjKsaIbUJCdDHEIUd3A6EBRrBniD4NIbuxTKhSXNC8lQ0Fy1gg9zDBkxp/fq+fevnj9Fr54/OX747PjhT8ePHh0//NHScjbu4Cwub3z57Wd/fv0x+uPpNy8ff+HHyzL+1x8++eXnz/1AyKC5RC++fPLbsycvvvr09+8ee+BbAg/K8D5NiUS3yBHa5ynoZgzjSk4G4nw7+gmmzg6cAG0P6a5KHOCtCWY+XJu4xrsroHj4gNfH9x1ZDxIxVtTD+UaSOsBdzlmbC68BbmheJQv3x1nsZy7GZdw+xoc+3h2cOa7tjnOomtOgdGzfSYgj5h7DmcIxyYhC+h0fEeLR7h6ljl13aSi45EOF7lHUxtRrkj4dOIE037RDU/DLxKczuNqxze5d1ObMp/U2OXSRkBCYeYTvE+aY8ToeK5z6SPZxysoGv4lV4hPyYCLCMq4rFXg6JoyjbkSk9O25LUDfktNvYKhXXrfvsknqIoWiIx/Nm5jzMnKbjzoJTnOvzDRLytgP5AhCFKM9rnzwXe5miH4GP+BsqbvvUuK4+/RCcIfGjkjzANFvxqKo2k79TWn2umLMKFTjd8V4ejptwdHkS4mdEyV4Ge5fWHi38TjbIxDriwfPu7r7ru4G//m6uyyXz1pt5wUWmuR5X2y65HRpkzykjB2oCSM3pemTJRwWUQ8WTQNvprjZ0JQn8LUo7g4uFtjsQYKrj6hKDhKcQ49dNSNfLAvSsUQ5lzDbmWUzfJITtM04SaHNNpNhXc8Mth5IrHZ5ZJfXyrPhjIyZFGMzf04ZrWkCZ2W2duXtmFWtVEvN5qpWNaKZUueoNlMZfLioGizOrAldCILeBazcgBFdyw6zCWYk0na3c/PULZr1hbpIJjgihY+03os+qhonTWNlGkYeH+k57xQflbg1Ndm34HYWJ5XZ1Zawm3rvbbw0HW7nXtJ5eyIdWVZOTpaho1bQrK/WAxTivBUMYayFr2kOXpe68cMshruhUAkb9qcmswnXuTeb/rCswk2FtfuCwk4dyIVU21gmNjTMqyIEWGaGcCP/ah3MelEK2Eh/AynW1iEY/jYpwI6ua8lwSEJVdnZpxdxRGEBRSvlYEXGQREdowMZiH4P7daiCPhGVcDthKoJ+gKs0bW3zyi3ORdKVL7AMzq5jlie4KLc6RaeZbOEmj2cymCcrrREPdPPKbpQ7vyom5S9IlXIY/89U0ecJXBesRdoDIdzkCox0vrYCLlTCoQrlCQ17Ai65TO2AaIHrWHgNQQX3yea/IIf6v805S8OkNUx9ap/GSFA4j1QiCNmDsmSi7xRi1eLssiRZQchEVElcmVuxB+SQsL6ugQ19tgcogVA31aQoAwZ3Mv7c5yKDBrFucv6pnY9N5vO2B7o7sC2W3X/GXqRWKvqlo6DpPftMTzUrB6852M951NqKtaDxav3MR20Olz5I/4Hzj4qQ2R8n9IHa5/tQWxH81mDbKwRRfck2HkgXSFseB9A42UUbTJqUbViK7vbC2yi4kS463RlfyNI36XTPaexZc+ayc3Lx9d3n+YxdWNixdbnT9ZgakvZkiur2aDrIGMeYX7XKPzzxwX1w9DZc8Y+ZkvZq/wFc8cGUYX8kgOS3zjVbN/8CAAD//wMAUEsDBBQABgAIAAAAIQAbFJpbgAQAAGEVAAANAAAAeGwvc3R5bGVzLnhtbNRY227bOBB9X6D/IOjdkaibL7BcxBcBBbrFAskCfaVlyiZKkQZFp3YX++87pCRLWduNkhhBkodYHJGHZy6cGXH8eZ8z64HIggoe2+jGtS3CU7GifB3bf98nvYFtFQrzFWaCk9g+kML+PPn0x7hQB0buNoQoCyB4EdsbpbYjxynSDclxcSO2hMObTMgcKxjKtVNsJcGrQi/KmeO5buTkmHK7RBjlaReQHMsfu20vFfkWK7qkjKqDwbKtPB19WXMh8ZIB1T0KcGrtUSQ9ay/rTYz0ZJ+cplIUIlM3gOuILKMpOaU7dIYOThskQH4ZEgod13uk+16+EClwJHmg2n32ZJwJrgorFTuuwJngS6Pt6AcXP3mi34G0mjYZF7+sB8xAgmxnMk4FE9JS4DswnZFwnJNyxgwzupRUT8twTtmhFHtaYNxdzcspGF8LHU2kpDMZL/Wsei+/2Uuul7GdJMmw76NIi5sNbyXF7ASItoCGJzj9gR+6SRecNqFTHGAEf11waqVOMaJp3xu4r8NACA28/nP1QcErDPzIU62oqD11Bcv4/QCF/wuv896+bN35zIu8JyLGRGABIUgZO56IgY59EEzGkDoUkTyBgVU93x+2EPkcslwZeGbeE7PXEh+QF3ZfUAhGV5rFembOW2XZxtdOi5k+R11YXABNFok/MwF0RdAmsq8IurgNB+7MWPF66qPEG/rXVh9OQH8xv8jU+AuibinkCmpqnYk98HgpmowZyRTkMUnXG/2rxBb+L4VSUHcm4xXFa8Ex0zm0XtFeCbUYym5sqw2UzTppV0E0R/NwPjXc9CbVHh1XGD6GTscFQLzm3XFFqeR5HStlwXQpYexOK/k9ayoZqLrPLL7Lk1x9WcU2VDZdYepHOCTVY2mrcqBt2EYrsduw0YtwrX123OASKx8IVqwC22pYISjJ1WoLb7fsoKuyrrfVCNY0o6mJomZ8y+ia56RcMBlDUS6H1kZI+guAdDVP4T2Bbgd6OkXTtuSnxNt7sjfbadvss8tWbfEPPzj/6CPyh6Cp46f/Tvg/FTIQJx+NMoRGTdlrW1k3zp1PaadTqRPya89ky8BAsJ3pfsv2zfhBoNbWfJQz3qc14bu2ZvsurTl85/zgwNT2g2LRORp1x/3MinaNs6MbhvNdQpdqDuX5jfLExer9VPbtoGDZYjyniTi7KXxhHpuvzjn/2y5fEpmYu6BWu/NmzU+tiWkIoQVs9ZmPusxjv2jpy4jY/qYZs1Y5WO4oU5Sf6TABc7Vvelbz9a/0TZTpZo+7gKNWJMM7pu6PL2O7ef6TrOguh9NfzfqLPghlIGK7ef6qPx/KWxPo6L4W0O3Dr7WTNLb/WUz7w/ki8XoDdzroBT4Je8NwOu+FwWw6nydD13Nn/7buw15xG2au76CNRMGoYHBnJitlK/J3jSy2W4OSvvlUAdpt7kMvcm9D5PYS30W9IMKD3iDyw14SIm8eBdNFmIQt7uELb81cB6Hy/k2TD0eK5oRRXvuq9lBbCk6C4W+UcGpPOM3d6OQ/AAAA//8DAFBLAwQUAAYACAAAACEAUZidyucCAACMCAAAFAAAAHhsL3NoYXJlZFN0cmluZ3MueG1spFbNTttAEL5X6juM3CKBVGyvEwNBSZCJDQ2KY+Q4qNdtsiWWbG/q3SB649pze+qpaqUieu8LNG+SJ+kkpgVs2BxqaTPyfvO3n7LfuHlwmSZwwXIR86ylEd3UgGUjPo6z85Y2jI629zQQkmZjmvCMtbQPTGgH7efPmkJIwNhMtLSJlNN9wxCjCUup0PmUZYi843lKJb7m54aY5oyOxYQxmSaGZZo7RkrjTIMRn2WypdlYZZbF72esc7thae2miNtN2XaOT9GVJbC4+gw+H7OEw5hBN53yXNL59fz76t1Lp/n8Rsg45aJpyHbTWIYXKRZfvgL0l440kSxnQIHnY5ZChosLGNG3bH5NkwkXOrhUUgEZh+IAHFzX8H3DwUeHk1nOxT7E2RJkYJkwpTlFu6FDyFJ+QQGDkziboMEuvTeef9oLgGaSrTbiou1cL/f4orzRD3yvvBd5Pe8o6Ff2z5xeEAKWCr1B5LhBOe5kGAYD2NzYKgO9YSeseBfZoiByemV/14mcVZ35x0HU9Suh5PdPOPP6na7v9aMKainRmhKtK1Fbie4o0V0luqdEG0qUmGpYzRZR00XUfBE1YUTNGFFTRtScETVpRM2atYY12zAJaohll/+cBBHrSaT2JFJ/FHmgO91MyHyGYvOruMb31afcxlEQ+k4UgOsMoBP0hn1nUHbp8AQOYaVoy2sOd09wGHaPnWj+KewGFY1YhnWKsL9KcBsZTEco4DR5NMQtQopr/a/UGSp6DiiA4Usd1pbFHpf6uxIS1JHbLN7l/kMNXJvndZFnpSN3p74vsWtTdBdXP5zDVTt3UjOAW+Eeo/CiJo9YgqMIHDm/wQ4rtHT90yCMnH5UkdLF1bf/VPJlBtUQqUwn9F/NFaAjFsvlfLFfwa6OP8TEhdZCa6Gtoa3jsqsn2myQLWg0yJ69XbN3yGPTBNwAosDH+RCCud7DWpujVva410S9XnsCrtftco8Gfk20/wAAAP//AwBQSwMEFAAGAAgAAAAhAKfzORZUAQAAcQIAABEACAFkb2NQcm9wcy9jb3JlLnhtbCCiBAEooAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIySy07DMBBF90j8Q+R94jxKhawklXh0RQWCIhA7Y09bi8S2bLdp/h4naUMrWLCzZ+4c3ztyPtvXVbADY4WSBUqiGAUgmeJCrgv0upyH1yiwjkpOKyWhQC1YNCsvL3KmCVMGnozSYJwAG3iStITpAm2c0wRjyzZQUxt5hfTNlTI1df5q1lhT9kXXgNM4nuIaHOXUUdwBQz0S0QHJ2YjUW1P1AM4wVFCDdBYnUYJ/tA5Mbf8c6Dsnylq4VvtMB7unbM6G5qjeWzEKm6aJmqy34f0n+H3x8NJHDYXsdsUAlTlnhBmgTpmyy6/bfZXjk2K3wIpat/C7XgngN215z7fUcBU8i08QRgWPldj5A83xb63n93GGR4AH3iAZ4hw7b9nt3XKOyjROp2E8CZNsmUxIGpMk++isnM13hodCfTD0b2I2JfHVCfEIKHvf55+k/AYAAP//AwBQSwMEFAAGAAgAAAAhANrUe9iWAQAAHgMAABAACAFkb2NQcm9wcy9hcHAueG1sIKIEASigAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAnJJBbtswEEX3AXoHgfuYilsEhUExCGIXKZDURiRnP6FGFhGaFMiJYPcCPUFPlIuFkmBHbhYFspuZP/h8/KS42m1N0qIP2tmMXUxSlqBVrtR2k7F18eP8O0sCgS3BOIsZ22NgV/LLmVh516AnjSGJFjZkrCZqZpwHVeMWwiTKNiqV81ug2PoNd1WlFc6detmiJT5N00uOO0JbYnneHA3Z4Dhr6bOmpVMdX3gs9k0EluK6aYxWQPGW8l4r74KrKFnsFBrBx6KIdDmqF69pL1PBx63IFRi8icayAhNQ8PeBuEXoQluB9kGKlmYtKnI+Cfp3jG3KkicI2OFkrAWvwVLE6taGpq9NE8jLlQGrTQ1B8KgPs74cr45r/U1O+4VYnC52BgNHFE4JC00Gw7Jagaf/AfcMA+6Ac7+cL+6WY74j6c9fefGwfv3z+neRf7hAH0lE+efwO22fw7op3BwID9meDkVeg8cyPscx++NA3MZYvelMbmqwGywPOx+F7ic8Dt9dXlxO0q9pfOTRTPD3jy3fAAAA//8DAFBLAQItABQABgAIAAAAIQASGN7dZAEAABgFAAATAAAAAAAAAAAAAAAAAAAAAABbQ29udGVudF9UeXBlc10ueG1sUEsBAi0AFAAGAAgAAAAhALVVMCP0AAAATAIAAAsAAAAAAAAAAAAAAAAAnQMAAF9yZWxzLy5yZWxzUEsBAi0AFAAGAAgAAAAhAChwVFCuAgAAMgYAAA8AAAAAAAAAAAAAAAAAwgYAAHhsL3dvcmtib29rLnhtbFBLAQItABQABgAIAAAAIQBKqaZh+gAAAEcDAAAaAAAAAAAAAAAAAAAAAJ0JAAB4bC9fcmVscy93b3JrYm9vay54bWwucmVsc1BLAQItABQABgAIAAAAIQDT34BsdBAAAG19AAAYAAAAAAAAAAAAAAAAANcLAAB4bC93b3Jrc2hlZXRzL3NoZWV0MS54bWxQSwECLQAUAAYACAAAACEA9xuqn7ACAAD/CQAAGAAAAAAAAAAAAAAAAACBHAAAeGwvd29ya3NoZWV0cy9zaGVldDIueG1sUEsBAi0AFAAGAAgAAAAhAOmmJbhmBgAAUxsAABMAAAAAAAAAAAAAAAAAZx8AAHhsL3RoZW1lL3RoZW1lMS54bWxQSwECLQAUAAYACAAAACEAGxSaW4AEAABhFQAADQAAAAAAAAAAAAAAAAD+JQAAeGwvc3R5bGVzLnhtbFBLAQItABQABgAIAAAAIQBRmJ3K5wIAAIwIAAAUAAAAAAAAAAAAAAAAAKkqAAB4bC9zaGFyZWRTdHJpbmdzLnhtbFBLAQItABQABgAIAAAAIQCn8zkWVAEAAHECAAARAAAAAAAAAAAAAAAAAMItAABkb2NQcm9wcy9jb3JlLnhtbFBLAQItABQABgAIAAAAIQDa1HvYlgEAAB4DAAAQAAAAAAAAAAAAAAAAAE0wAABkb2NQcm9wcy9hcHAueG1sUEsFBgAAAAALAAsAxgIAABkzAAAAAA==';
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
  else if(_empFilter==='quitado'){f=f.filter(e=>isEmprestimoQuitado(e));}
  else if(_empFilter==='ativo'){f=f.filter(e=>!isEmprestimoQuitado(e));}
  else if(_empFilter==='semparc'){f=f.filter(e=>parcelas.filter(p=>p.emprestimo_id===e.id).length===0);}
  else if(_empFilter==='juros'){f=f.filter(e=>(e.tipo||'juros')==='juros');}
  else if(_empFilter==='consig'){f=f.filter(e=>e.tipo==='consignado');}
  else {
    // Filtro padrão "todos": esconde os já quitados (continuam acessíveis pela pílula "Quitados")
    f=f.filter(e=>!isEmprestimoQuitado(e));
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
  const quitado=isEmprestimoQuitado(e);
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
      <td style="color:var(--n4);font-size:12px">${i}</td>
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
            // Só marca "Quitado" se TODAS as parcelas pagas E saldo devedor zerado.
            if(quitado) return`<button class="btn btn-xs btn-grn" onclick="openParcelas('${e.id}')">${svgCheck}Quitado</button>`;
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
          ${!quitado?`<button class="btn btn-xs" style="background:rgba(0,200,150,.15);border:1px solid var(--grn);color:var(--grn);font-size:10px;font-weight:700;padding:.2rem .5rem;border-radius:var(--rs)" onclick="abrirQuitacao('${e.id}')" title="Quitar empréstimo">Quitar</button>`:''}
          <button class="btn btn-xs btn-g" onclick="openEmpModal('${e.id}')" title="Editar"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          ${session.role==='admin'?'<button class="btn btn-xs btn-d" onclick="deleteEmp(\''+e.id+'\')">✕</button>':''}
        </div>
      </td>
    </tr>`;
}

function empTbodyHTML(list){
  if(!list.length)return'<tr><td colspan="12"><div class="empty"><div style="font-size:2rem;margin-bottom:.5rem;color:var(--n5)">—</div><div class="empty-text">Nenhum empréstimo.</div></div></td></tr>';
  const ativos=list.filter(e=>!isEmprestimoQuitado(e));
  const quitados=list.filter(e=>isEmprestimoQuitado(e));
  let html=ativos.map((e,i)=>_empRow(e,i+1)).join('');
  if(quitados.length){
    html+='<tr><td colspan="12" style="padding:.65rem 1rem;background:rgba(0,200,150,.06);border-top:2px solid rgba(0,200,150,.3);border-bottom:1px solid rgba(0,200,150,.2)"><div style="display:flex;align-items:center;gap:.5rem"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"13\" height=\"13\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#00C896\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"20 6 9 17 4 12\"/></svg><span style=\"font-size:11px;font-weight:700;color:var(--grn);text-transform:uppercase;letter-spacing:.05em\">Quitados ('+quitados.length+')</span></div></td></tr>';
    html+=quitados.map((e,i)=>{const row=_empRow(e,ativos.length+i+1);return row.replace('<tr id=','<tr style="opacity:.6" id=');}).join('');
  }
  return html||'<tr><td colspan="12"><div class="empty"><div class="empty-text">Nenhum empréstimo.</div></div></td></tr>';
}


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
        ${tom.contato?`<button onclick="openWhatsAppChoice('${tom.id}')" class="btn btn-sm" style="background:#16A34A;color:#fff;font-size:12px;padding:.3rem .7rem;cursor:pointer;border:none;display:flex;align-items:center;gap:.3rem">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          WhatsApp
        </button>`:''}
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

