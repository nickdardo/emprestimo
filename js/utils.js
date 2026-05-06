// ════════════════════════════════════════════════════════════════
// UTILS — Helpers de formatação, máscaras, toast e modais
// ════════════════════════════════════════════════════════════════

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



// ══ TERMINOLOGIA POR TIPO DE EMPRÉSTIMO ══
function lblParcela(emp, plural=false){
  const tipo=emp?.tipo||'juros';
  if(tipo==='consignado') return plural?'Parcelas':'Parcela';
  return plural?'Juros':'Juros';
}
function lblProximo(emp){
  return (emp?.tipo||'juros')==='consignado'?'Próxima Parcela':'Próximo Vencimento';
}

// ══ REGRA DE QUITAÇÃO (centralizada) ══
// Empréstimo só está QUITADO quando:
//  - tipo='consignado': todas as parcelas pagas (parcelas amortizam o capital).
//  - tipo='juros':      todas as parcelas pagas E saldo devedor zerado
//                       (parcelas pagam só juros mensais; o capital só é quitado
//                       quando o credor confirma via "Quitar" ou abate até zero).
function isEmprestimoQuitado(emp){
  if(!emp) return false;
  const ep=parcelas.filter(p=>p.emprestimo_id===emp.id);
  if(ep.length===0) return false;
  const todasPagas=ep.every(p=>p.status==='pago');
  if(!todasPagas) return false;
  const tipo=emp.tipo||'juros';
  if(tipo==='consignado') return true;
  // tipo='juros': exige saldo devedor zerado
  const saldo=Number(emp.saldo_devedor!=null?emp.saldo_devedor:emp.valor||0);
  return saldo===0;
}


let _waPulseAtivo=false;
