// ════════════════════════════════════════════════════════════════
// NOTIFICACOES — Notificações push do navegador, alertas de vencimento
// ════════════════════════════════════════════════════════════════

// ══ NOTIFICAÇÕES DO NAVEGADOR ══
let _notifInterval = null;

function _notifAtivo(){
  // Ativo = permissão concedida E não foi desativado manualmente
  return Notification.permission==='granted' && localStorage.getItem('ep_notif_off')!=='1';
}

function atualizarBadgeNotif(){
  const track = document.getElementById('notif-toggle-track');
  const knob  = document.getElementById('notif-toggle-knob');
  const label = document.getElementById('notif-toggle-label');
  const pmsg  = document.getElementById('notif-perm-msg');
  const tbtn  = document.getElementById('btn-testar-notif');
  if(!track) return;

  const perm    = Notification.permission;
  const ativo   = _notifAtivo();
  const bloq    = perm==='denied';

  if(ativo){
    track.style.background='#16A34A';
    knob.style.left='22px';
    label.textContent='Ativo'; label.style.color='#166534';
    if(pmsg){pmsg.style.display='block';pmsg.textContent='Alertas automáticos a cada 30 min.';}
    if(tbtn) tbtn.style.display='';
  } else if(bloq){
    track.style.background='#D1D5DB';
    knob.style.left='2px';
    label.textContent='Bloqueado pelo navegador'; label.style.color='#DC2626';
    if(pmsg){pmsg.style.display='block';pmsg.style.color='#DC2626';pmsg.textContent='Clique no cadeado na barra de endereço para permitir notificações.';}
    if(tbtn) tbtn.style.display='none';
  } else {
    track.style.background='#D1D5DB';
    knob.style.left='2px';
    label.textContent='Desativado'; label.style.color='var(--n4)';
    if(pmsg){pmsg.style.display='none';pmsg.textContent='';}
    if(tbtn) tbtn.style.display='none';
  }
}

async function toggleNotificacoes(){
  if(!('Notification' in window)){toast('⚠ Seu navegador não suporta notificações',true);return;}

  if(_notifAtivo()){
    // Desativar
    localStorage.setItem('ep_notif_off','1');
    if(_notifInterval){clearInterval(_notifInterval);_notifInterval=null;}
    atualizarBadgeNotif();
    toast('Alertas desativados');
  } else if(Notification.permission==='denied'){
    toast('⚠ Permissão bloqueada. Libere nas configurações do navegador.',true);
  } else {
    // Ativar — solicita permissão se ainda não concedida
    const perm = Notification.permission==='granted'?'granted':await Notification.requestPermission();
    if(perm==='granted'){
      localStorage.removeItem('ep_notif_off');
      atualizarBadgeNotif();
      iniciarVerificacaoAutomatica();
      toast('✓ Alertas ativados!');
    } else {
      toast('⚠ Permissão negada.',true);
      atualizarBadgeNotif();
    }
  }
}

// Mantém compatibilidade com chamadas antigas
async function ativarNotificacoes(){ await toggleNotificacoes(); }

function dispararNotificacao(titulo, corpo, tag){
  ativarPulsoWa();
  tocarAudioAlerta();

  if(!_notifAtivo())return;
  if(navigator.vibrate)navigator.vibrate([300,100,300,100,500]);
  const icon="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%23111827'/><text x='16' y='22' font-size='18' text-anchor='middle' fill='%23F97316'>$</text></svg>";
  const n=new Notification(titulo,{body:corpo,icon,tag:tag||'agpainel',renotify:true});
  n.onclick=()=>{window.focus();showPage('dashboard');n.close();};
}

function testarNotificacao(){
  // Botão de teste manual — dispara uma notificação de exemplo imediatamente
  if(Notification.permission!=='granted'){toast('⚠ Ative os alertas primeiro',true);return;}
  dispararNotificacao(
    '🔔 GEPainel — Teste de alerta',
    'Os alertas estão funcionando! Você receberá avisos automáticos de vencimento.',
    'agpainel-teste'
  );
  toast('✓ Notificação de teste enviada!');
}

function verificarVencimentos(){
  if(Notification.permission!=='granted'||!session)return;

  const hoje=new Date(); hoje.setHours(0,0,0,0);

  // Controle de quais alertas já foram disparados hoje
  let jaDisparados={};
  try{jaDisparados=JSON.parse(localStorage.getItem('ep_notif_sent')||'{}');}catch(e){}

  const alertas=[];

  parcelas.filter(p=>p.status==='pendente').forEach(p=>{
    const venc=new Date(p.vencimento+'T12:00:00'); venc.setHours(0,0,0,0);
    const diff=Math.round((venc-hoje)/(1000*60*60*24));
    const emp=emprestimos.find(e=>e.id===p.emprestimo_id);
    const tom=tomadores.find(t=>t.id===emp?.tomador_id);
    if(!tom)return;

    if(diff===7){
      const key='7d_'+p.id;
      if(!jaDisparados[key]){
        alertas.push({key,titulo:'⏰ Vence em 7 dias',corpo:tom.nome+' — '+fmtR(p.valor)+' ('+fmtDate(p.vencimento)+')',tag:'agpainel-7d-'+p.id});
        jaDisparados[key]=today();
      }
    } else if(diff===3){
      const key='3d_'+p.id;
      if(!jaDisparados[key]){
        alertas.push({key,titulo:'🔴 Vence em 3 dias',corpo:tom.nome+' — '+fmtR(p.valor)+' ('+fmtDate(p.vencimento)+')',tag:'agpainel-3d-'+p.id});
        jaDisparados[key]=today();
      }
    } else if(diff<0){
      const key='atras_'+p.id+'_'+today();
      if(!jaDisparados[key]){
        alertas.push({key,titulo:'⛔ Parcela em atraso',corpo:tom.nome+' — '+fmtR(p.valor)+' (venceu '+fmtDate(p.vencimento)+')',tag:'agpainel-atras-'+p.id});
        jaDisparados[key]=today();
      }
    }
  });

  // Dispara cada alerta com intervalo de 900ms para não sobrepor
  alertas.forEach((a,i)=>setTimeout(()=>dispararNotificacao(a.titulo,a.corpo,a.tag),i*900));

  // Limpa chaves com mais de 10 dias e salva
  const limite=new Date(); limite.setDate(limite.getDate()-10);
  Object.keys(jaDisparados).forEach(k=>{
    try{if(new Date(jaDisparados[k]+'T12:00:00')<limite)delete jaDisparados[k];}catch(e){}
  });
  try{localStorage.setItem('ep_notif_sent',JSON.stringify(jaDisparados));}catch(e){}
}

function iniciarVerificacaoAutomatica(){
  if(_notifInterval)clearInterval(_notifInterval);
  // Verifica imediatamente e depois a cada 30 minutos
  setTimeout(verificarVencimentos,1500);
  _notifInterval=setInterval(()=>{
    if(Notification.permission==='granted'&&session)verificarVencimentos();
  },30*60*1000);
}


