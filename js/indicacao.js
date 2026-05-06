// ════════════════════════════════════════════════════════════════
// INDICACAO — Códigos de indicação para captação de novos usuários
// ════════════════════════════════════════════════════════════════

// ══ INDICAÇÃO ══
function gerarCodigoIndicacao(userId){return 'GE'+userId.substring(0,6).toUpperCase();}
async function abrirIndicacao(){
  const cod=gerarCodigoIndicacao(session.id);
  const el=document.getElementById('cod-indicacao');if(el)el.textContent=cod;
  const st=document.getElementById('indicacao-status');
  if(st){
    st.innerHTML='<div style="background:rgba(108,159,255,.08);border:1px solid rgba(108,159,255,.2);border-radius:var(--rs);padding:.65rem;font-size:12px;color:var(--n3)">⏳ Verificando indicações...</div>';
  }
  openM('indicacao-modal');
  // Busca quantos amigos foram indicados por este usuário
  try{
    const{data:indicados,error}=await sb.from('users').select('id,nome,created_at').eq('indicado_por',session.id).order('created_at',{ascending:false});
    if(st){
      if(error){
        // Coluna pode não existir ainda — fallback simples
        const usou=localStorage.getItem('ep_bonus_indicacao_usado');
        st.innerHTML=usou?'<div style="background:rgba(0,200,150,.08);border:1px solid rgba(0,200,150,.2);border-radius:var(--rs);padding:.65rem;font-size:12px;color:var(--grn)">✓ Bônus de indicação já utilizado.</div>':'<div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:var(--rs);padding:.65rem;font-size:12px;color:var(--amb)">○ Aguardando seu primeiro indicado.</div>';
      } else if(!indicados||indicados.length===0){
        st.innerHTML='<div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:var(--rs);padding:.65rem;font-size:12px;color:var(--amb)">○ Aguardando seu primeiro indicado.</div>';
      } else {
        const n=indicados.length;
        const dias=n*30;
        const lista=indicados.slice(0,3).map(u=>`<div style="font-size:11px;color:var(--n3);margin-top:4px">• ${u.nome||'Usuário'}</div>`).join('');
        const mais=n>3?`<div style="font-size:11px;color:var(--n4);margin-top:4px">e mais ${n-3}...</div>`:'';
        st.innerHTML=`<div style="background:rgba(0,200,150,.08);border:1px solid rgba(0,200,150,.25);border-radius:var(--rs);padding:.75rem;font-size:12px;color:var(--grn)"><div style="font-weight:700;margin-bottom:4px">✓ ${n} ${n===1?'amigo indicado':'amigos indicados'} · +${dias} dias ganhos</div>${lista}${mais}</div>`;
      }
    }
  }catch(e){
    if(st)st.innerHTML='<div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:var(--rs);padding:.65rem;font-size:12px;color:var(--amb)">○ Não foi possível verificar agora.</div>';
  }
}
function copiarCodigoIndicacao(){const cod=gerarCodigoIndicacao(session.id);navigator.clipboard.writeText(cod).then(()=>toast('✓ Código copiado!')).catch(()=>toast('Código: '+cod));}
function compartilharIndicacao(){const cod=gerarCodigoIndicacao(session.id);const url='https://gepainel.vercel.app';const msg=`Olá! Estou usando o *GEPainel* para gerenciar empréstimos! 🚀%0A%0ACadastre-se com meu código e ganhe 30 dias grátis:%0A*Código:* ${cod}%0A*Link:* ${url}`;window.open('https://wa.me/?text='+msg,'_blank');}
async function verificarCodigoIndicacao(cod){
  if(!cod||cod.length<8)return;
  const{data:allUsers}=await sb.from('users').select('id,nome,expires_at').limit(200);
  if(!allUsers)return;
  const indicador=allUsers.find(u=>gerarCodigoIndicacao(u.id)===cod&&u.id!==session.id);
  if(!indicador)return;
  
  // Acumula 30 dias: se já tem tempo futuro, soma a partir dessa data; senão, soma a partir de hoje
  const base=indicador.expires_at&&new Date(indicador.expires_at)>new Date()?new Date(indicador.expires_at):new Date();
  base.setDate(base.getDate()+30);
  
  // Atualiza expires_at do indicador (bônus)
  await sb.from('users').update({expires_at:base.toISOString().split('T')[0]}).eq('id',indicador.id);
  
  // Grava relacionamento indicado_por no novo usuário (se a coluna existir)
  try{
    await sb.from('users').update({indicado_por:indicador.id}).eq('id',session.id);
  }catch(e){console.warn('[INDICACAO] Coluna indicado_por não existe ainda:',e);}
  
  // Mantém localStorage como fallback
  localStorage.setItem('ep_bonus_dado_'+indicador.id,'1');
  toast('🎁 Código válido! Seu amigo ganhou 30 dias extras!');
}

