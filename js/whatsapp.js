// ════════════════════════════════════════════════════════════════
// WHATSAPP — Modal de escolha + envio para gestor
// ════════════════════════════════════════════════════════════════

// ══ WHATSAPP CHOICE ══

function openWhatsAppChoice(tomadorId, parcela = null) {
  const tom = tomadores.find(t => t.id === tomadorId);
  if (!tom || !tom.contato) {
    toast('Cliente sem contato cadastrado', true);
    return;
  }
  
  _whatsAppData = { tom, parcela };
  
  // Salva o conteúdo original na primeira vez
  const body = document.getElementById('whatsapp-choice-body');
  if (!_whatsAppOriginalContent) {
    _whatsAppOriginalContent = body.innerHTML;
  } else {
    // Restaura o conteúdo original
    body.innerHTML = _whatsAppOriginalContent;
  }
  
  document.getElementById('whatsapp-choice-modal').style.display = 'flex';
}

function closeWhatsAppChoice() {
  document.getElementById('whatsapp-choice-modal').style.display = 'none';
  // Não limpa _whatsAppData aqui para permitir voltar
}

function enviarWhatsAppManual() {
  if (!_whatsAppData) return;
  const numero = _whatsAppData.tom.contato.replace(/\D/g, '');
  window.open(`https://wa.me/55${numero}`, '_blank');
  _whatsAppData = null;
  closeWhatsAppChoice();
}

function mostrarPreviaWhatsApp() {
  if (!_whatsAppData) return;
  
  const { tom, parcela } = _whatsAppData;
  
  // Pega a parcela mais próxima do vencimento se não foi especificada
  let parcelaEscolhida = parcela;
  if (!parcelaEscolhida) {
    const hoje = new Date();
    const parcelasPendentes = parcelas.filter(p => {
      const emp = emprestimos.find(e => e.id === p.emprestimo_id);
      return emp && emp.tomador_id === tom.id && p.status === 'pendente';
    }).sort((a, b) => new Date(a.vencimento) - new Date(b.vencimento));
    
    parcelaEscolhida = parcelasPendentes[0];
  }
  
  if (!parcelaEscolhida) {
    toast('Nenhuma parcela pendente encontrada', true);
    return;
  }
  
  // Busca a chave PIX do usuário logado
  const chavePix = session.pix || session.contato || session.email || '[SUA_CHAVE_PIX]';
  
  // Monta a mensagem
  const nome = tom.nome;
  const valor = fmtR(parcelaEscolhida.valor);
  const data = fmtDate(parcelaEscolhida.vencimento);
  
  const mensagem = `Olá ${nome},

Você tem uma parcela de ${valor} com vencimento em ${data}.

💳 Pix: ${chavePix}
💵 Dinheiro: Combinar entrega

Qualquer dúvida, estou aqui!`;
  
  // Mostra prévia editável
  const body = document.getElementById('whatsapp-choice-body');
  body.innerHTML = `
    <div style="margin-bottom:1rem">
      <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.75rem">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
        <span style="font-weight:700;font-size:14px;color:var(--n1)">Prévia da Mensagem</span>
      </div>
      <div style="font-size:11px;color:var(--n4);margin-bottom:.75rem">Você pode editar a mensagem antes de enviar:</div>
      <textarea id="whatsapp-message-preview" style="width:100%;min-height:200px;padding:.75rem;border:2px solid var(--border);border-radius:var(--rs);font-family:var(--FM);font-size:13px;color:var(--n1);background:var(--card);resize:vertical">${mensagem}</textarea>
    </div>
    <div style="display:flex;gap:.5rem">
      <button onclick="voltarEscolhaWhatsApp()" class="btn btn-g btn-sm" style="flex:1">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
        Voltar
      </button>
      <button onclick="confirmarEnvioWhatsApp()" class="btn btn-grn btn-sm" style="flex:2">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
        Enviar WhatsApp
      </button>
    </div>
  `;
}

function voltarEscolhaWhatsApp() {
  const body = document.getElementById('whatsapp-choice-body');
  if (_whatsAppOriginalContent) {
    body.innerHTML = _whatsAppOriginalContent;
  }
}

function confirmarEnvioWhatsApp() {
  if (!_whatsAppData) return;
  
  const mensagem = document.getElementById('whatsapp-message-preview').value;
  const numero = _whatsAppData.tom.contato.replace(/\D/g, '');
  const mensagemEncoded = encodeURIComponent(mensagem);
  
  window.open(`https://wa.me/55${numero}?text=${mensagemEncoded}`, '_blank');
  _whatsAppData = null;
  closeWhatsAppChoice();
}

function enviarWhatsAppAutomatico() {
  if (!_whatsAppData) return;
  
  const { tom, parcela } = _whatsAppData;
  const numero = tom.contato.replace(/\D/g, '');
  
  // Pega a parcela mais próxima do vencimento se não foi especificada
  let parcelaEscolhida = parcela;
  if (!parcelaEscolhida) {
    const hoje = new Date();
    const parcelasPendentes = parcelas.filter(p => {
      const emp = emprestimos.find(e => e.id === p.emprestimo_id);
      return emp && emp.tomador_id === tom.id && p.status === 'pendente';
    }).sort((a, b) => new Date(a.vencimento) - new Date(b.vencimento));
    
    parcelaEscolhida = parcelasPendentes[0];
  }
  
  if (!parcelaEscolhida) {
    toast('Nenhuma parcela pendente encontrada', true);
    return;
  }
  
  // Busca a chave PIX do usuário logado
  const chavePix = session.pix || session.contato || session.email || '[SUA_CHAVE_PIX]';
  
  // Monta a mensagem
  const nome = tom.nome;
  const valor = fmtR(parcelaEscolhida.valor);
  const data = fmtDate(parcelaEscolhida.vencimento);
  
  const mensagem = `Olá ${nome},

Você tem uma parcela de ${valor} com vencimento em ${data}.

💳 Pix: ${chavePix}
💵 Dinheiro: Combinar entrega

Qualquer dúvida, estou aqui!`;
  
  const mensagemEncoded = encodeURIComponent(mensagem);
  window.open(`https://wa.me/55${numero}?text=${mensagemEncoded}`, '_blank');
  closeWhatsAppChoice();
}


function ativarPulsoWa(){
  const btn=document.getElementById('wa-nav-btn');
  if(btn&&!btn.classList.contains('unset')){
    btn.classList.add('wa-pulsing');
    _waPulseAtivo=true;
  }
}
function desativarPulsoWa(){
  const btn=document.getElementById('wa-nav-btn');
  if(btn){btn.classList.remove('wa-pulsing');}
  _waPulseAtivo=false;
}
function tocarAudioAlerta(){
  try{
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    const osc=ctx.createOscillator();
    const gain=ctx.createGain();
    osc.connect(gain);gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880,ctx.currentTime);
    osc.frequency.setValueAtTime(660,ctx.currentTime+0.1);
    osc.frequency.setValueAtTime(880,ctx.currentTime+0.2);
    gain.gain.setValueAtTime(0.3,ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.4);
    osc.start(ctx.currentTime);osc.stop(ctx.currentTime+0.4);
  }catch(e){}
}


// ══ WHATSAPP GESTOR ══
function loadWaNumber(){
  try{
    const num=localStorage.getItem('ep_wa_num');
    const btn=document.getElementById('wa-nav-btn');
    const lbl=document.getElementById('wa-nav-label');
    if(num&&btn&&lbl){
      btn.classList.remove('unset');
      lbl.textContent=num;
    }
  }catch(e){}
}

function openWaModal(){
  desativarPulsoWa();
  try{
    const saved=localStorage.getItem('ep_wa_num')||'';
    const savedPix=localStorage.getItem('ep_pix')||session?.pix||'';
    document.getElementById('wa-num-input').value=saved;
    document.getElementById('pix-input').value=savedPix;
  }catch(e){}
  const box=document.getElementById('wa-preview-box');
  if(box)box.style.display='none';
  openM('wa-modal');
  setTimeout(atualizarBadgeNotif, 50);
}

function saveWaNumber(){
  const num=document.getElementById('wa-num-input').value.trim();
  const pix=document.getElementById('pix-input').value.trim();
  
  if(!num){toast('⚠ Informe o número',true);return;}
  
  // Salva no localStorage
  try{
    localStorage.setItem('ep_wa_num',num);
    if(pix) localStorage.setItem('ep_pix',pix);
  }catch(e){}
  
  // Atualiza session
  if(session){
    session.contato=num;
    if(pix) session.pix=pix;
    saveSession(session);
    
    // Atualiza no banco de dados
    (async()=>{
      try{
        const updates={contato:num};
        if(pix) updates.pix=pix;
        
        await sbWithRetry(()=>sb.from('usuarios').update(updates).eq('id',session.id));
        toast('✓ WhatsApp e PIX salvos!');
      }catch(err){
        console.error('Erro ao salvar:',err);
        toast('✓ Salvo localmente!');
      }
    })();
  }
  
  const btn=document.getElementById('wa-nav-btn');
  const lbl=document.getElementById('wa-nav-label');
  if(btn)btn.classList.remove('unset');
  if(lbl)lbl.textContent=num;
  closeM('wa-modal');
}

function clearWaNumber(){
  try{
    localStorage.removeItem('ep_wa_num');
    localStorage.removeItem('ep_pix');
  }catch(e){}
  
  // Limpa da session
  if(session){
    session.contato='';
    session.pix='';
    saveSession(session);
    
    // Limpa do banco
    (async()=>{
      try{
        await sbWithRetry(()=>sb.from('usuarios').update({contato:'',pix:''}).eq('id',session.id));
      }catch(err){
        console.error('Erro ao limpar:',err);
      }
    })();
  }
  
  const btn=document.getElementById('wa-nav-btn');
  const lbl=document.getElementById('wa-nav-label');
  if(btn)btn.classList.add('unset');
  if(lbl)lbl.textContent='Seu WhatsApp';
  document.getElementById('wa-num-input').value='';
  document.getElementById('pix-input').value='';
  closeM('wa-modal');
  toast('WhatsApp removido');
}

function testarMensagemWa(){
  const hoje=new Date();
  const em3=new Date();em3.setDate(hoje.getDate()+3);
  const em7=new Date();em7.setDate(hoje.getDate()+7);

  const linhas3=[];const linhas7=[];
  const linhasAtras=[];

  parcelas.filter(p=>p.status==='pendente').forEach(p=>{
    const venc=new Date(p.vencimento+'T12:00:00');
    const emp=emprestimos.find(e=>e.id===p.emprestimo_id);
    const tom=tomadores.find(t=>t.id===emp?.tomador_id);
    if(!emp||!tom)return;
    const linha='• '+tom.nome+' — '+fmtR(p.valor)+' (vence '+fmtDate(p.vencimento)+')';
    if(isAtrasada(p))linhasAtras.push(linha);
    else if(venc>=hoje&&venc<=em3)linhas3.push(linha);
    else if(venc>em3&&venc<=em7)linhas7.push(linha);
  });

  const box=document.getElementById('wa-preview-box');
  if(!box)return;

  if(!linhas3.length&&!linhas7.length&&!linhasAtras.length){
    box.style.display='block';
    box.style.background='#FFF7ED';box.style.borderColor='#FED7AA';box.style.color='#92400E';
    box.textContent='✓ Nenhuma parcela em atraso ou vencendo nos próximos 7 dias.';
    return;
  }

  const nl='\n';
  let msg='📊 *GEPainel — Avisos de Cobranças*'+nl;
  msg+='🗓 '+new Date().toLocaleDateString('pt-BR')+nl+nl;
  if(linhasAtras.length){msg+='⛔ *Em atraso ('+linhasAtras.length+'):*'+nl+linhasAtras.join(nl)+nl+nl;}
  if(linhas3.length){msg+='🔴 *Vencem em até 3 dias ('+linhas3.length+'):*'+nl+linhas3.join(nl)+nl+nl;}
  if(linhas7.length){msg+='⏰ *Vencem em 4–7 dias ('+linhas7.length+'):*'+nl+linhas7.join(nl)+nl;}

  box.style.display='block';
  box.style.background='#F0FDF4';box.style.borderColor='#BBF7D0';box.style.color='#166534';
  box.textContent=msg;
}

function enviarAvisosWa(){
  const num=localStorage.getItem('ep_wa_num');
  if(!num){toast('⚠ Configure seu número primeiro',true);openWaModal();return;}

  const hoje=new Date();
  const em3=new Date();em3.setDate(hoje.getDate()+3);
  const em7=new Date();em7.setDate(hoje.getDate()+7);

  const linhas3=[];const linhas7=[];const linhasAtras=[];

  parcelas.filter(p=>p.status==='pendente').forEach(p=>{
    const venc=new Date(p.vencimento+'T12:00:00');
    const emp=emprestimos.find(e=>e.id===p.emprestimo_id);
    const tom=tomadores.find(t=>t.id===emp?.tomador_id);
    if(!emp||!tom)return;
    const linha='• '+tom.nome+' — '+fmtR(p.valor)+' (vence '+fmtDate(p.vencimento)+')';
    if(isAtrasada(p))linhasAtras.push(linha);
    else if(venc>=hoje&&venc<=em3)linhas3.push(linha);
    else if(venc>em3&&venc<=em7)linhas7.push(linha);
  });

  if(!linhas3.length&&!linhas7.length&&!linhasAtras.length){toast('✓ Nenhuma parcela em atraso ou vencendo nos próximos 7 dias!');return;}

  const nl='\n';
  let msg='📊 *GEPainel — Avisos de Cobranças*'+nl;
  msg+='🗓 '+new Date().toLocaleDateString('pt-BR')+nl+nl;
  if(linhasAtras.length){msg+='⛔ *Em atraso ('+linhasAtras.length+'):*'+nl+linhasAtras.join(nl)+nl+nl;}
  if(linhas3.length){msg+='🔴 *Vencem em até 3 dias ('+linhas3.length+'):*'+nl+linhas3.join(nl)+nl+nl;}
  if(linhas7.length){msg+='⏰ *Vencem em 4–7 dias ('+linhas7.length+'):*'+nl+linhas7.join(nl)+nl;}

  const tel=num.replace(/\D/g,'');
  const url=`https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`;
  window.open(url,'_blank');
}

