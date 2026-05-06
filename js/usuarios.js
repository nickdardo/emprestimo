// ════════════════════════════════════════════════════════════════
// USUARIOS — Administração: CRUD usuários e renovações
// ════════════════════════════════════════════════════════════════

// ══ USUÁRIOS ══
async function renderUsuarios(){
  const mc=document.getElementById('main-content');
  mc.innerHTML=`
    <div class="sec-hdr">
      <span class="sec-title">Usuários</span>
      <button class="btn btn-p btn-sm" onclick="openUsrModal(null)">+ Novo Usuário</button>
    </div>
    <div id="renov-pendentes-section"></div>
    <div id="usr-list">${usrListHTML()}</div>`;

  // Carrega renovações pendentes
  await carregarRenovacoesPendentes();
}

async function carregarRenovacoesPendentes(){
  const sec=document.getElementById('renov-pendentes-section');
  if(!sec)return;
  try{
    const{data,error}=await sb.from('renovacoes').select('*').eq('status','pendente').order('created_at',{ascending:false});
    if(error||!data||!data.length){sec.innerHTML='';return;}

    sec.innerHTML=`
      <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:var(--r);padding:1.25rem;margin-bottom:1.25rem">
        <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.85rem">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span style="font-weight:700;color:#92400E;font-size:14px">Renovações Pendentes (${data.length})</span>
        </div>
        ${data.map(r=>`
          <div style="background:#fff;border:1px solid #FDE68A;border-radius:var(--rs);padding:.85rem 1rem;display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem;gap:.75rem;flex-wrap:wrap">
            <div>
              <div style="font-weight:700;font-size:14px">${r.user_nome}</div>
              <div style="font-size:12px;color:var(--n4)">@${r.user_login} · ${r.plano} · <strong style="color:#EA580C">R$ ${Number(r.valor).toFixed(2).replace('.',',')}</strong></div>
              <div style="font-size:11px;color:var(--n4);margin-top:2px">${new Date(r.created_at).toLocaleString('pt-BR')}</div>
            </div>
            <div style="display:flex;gap:.4rem">
              <button class="btn btn-sm" style="background:#16A34A;color:#fff" onclick="confirmarRenovacao('${r.id}','${r.user_id}',${r.dias})">✓ Confirmar</button>
              <button class="btn btn-d btn-sm" onclick="rejeitarRenovacao('${r.id}')">✕ Rejeitar</button>
            </div>
          </div>`).join('')}
      </div>`;
  }catch(e){console.warn('Erro ao carregar renovacoes',e);}
}

async function confirmarRenovacao(renovId, userId, dias){
  if(!confirm('Confirmar pagamento e renovar acesso por '+dias+' dias?'))return;
  // Calcula nova data de expiração
  const u=users.find(x=>x.id===userId);
  const base=u?.expires_at&&new Date(u.expires_at)>new Date()?new Date(u.expires_at):new Date();
  base.setDate(base.getDate()+dias);
  const novaData=base.toISOString().split('T')[0];

  // Atualiza user
  const{error:ue}=await sb.from('users').update({expires_at:novaData}).eq('id',userId);
  if(ue){toast('Erro ao atualizar acesso',true);return;}

  // Marca renovação como confirmada
  await sb.from('renovacoes').update({status:'confirmado'}).eq('id',renovId);

  // Atualiza local
  users=users.map(u=>u.id===userId?{...u,expires_at:novaData}:u);

  toast('✓ Acesso renovado até '+new Date(novaData).toLocaleDateString('pt-BR')+'!');
  renderUsuarios();
}

async function rejeitarRenovacao(renovId){
  if(!confirm('Rejeitar esta solicitação?'))return;
  await sb.from('renovacoes').update({status:'rejeitado'}).eq('id',renovId);
  toast('Solicitação rejeitada.');
  renderUsuarios();
}

function usrListHTML(){
  return users.map(u=>{
    const isSelf=u.id===session.id;
    const av=u.role==='admin'?'background:#FDE68A;color:#78350F':'background:#D1FAE5;color:#065F46';
    return`<div style="background:#fff;border:1px solid #E5E7EB;border-radius:var(--r);padding:1rem 1.25rem;display:flex;align-items:center;gap:1rem;margin-bottom:.65rem;box-shadow:var(--sh)">
      <div style="width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;flex-shrink:0;${av}">${ini(u.nome)}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:17px;color:#1E293B;margin-bottom:3px">
          ${u.nome}${isSelf?' <span style="font-size:11px;color:#64748B;font-weight:400">(você)</span>':''}
          ${u.email?`<span style="font-size:13px;color:#64748B;font-weight:400;margin-left:8px">· ${u.email}</span>`:''}
        </div>
        <div style="font-size:12px;color:#64748B;display:flex;align-items:center;gap:.4rem;flex-wrap:wrap">
          @${u.login} · ${getPlanBadgeHTML(u)}
          ${(()=>{
            if(u.role==='admin')return'';
            if(!u.expires_at)return'<span class="bdg" style="background:#DCFCE7;color:#166534">✓ Vitalício</span>';
            const dias=Math.ceil((new Date(u.expires_at)-new Date())/(1000*60*60*24));
            if(dias<0)return'<span class="bdg" style="background:#FEE2E2;color:#991B1B">⛔ Expirado</span>';
            if(dias<=7)return`<span class="bdg" style="background:#FEF3C7;color:#92400E">⚠ ${dias}d restantes</span>`;
            if(dias<=30)return`<span class="bdg" style="background:#FFF7ED;color:#EA580C">Free · ${dias}d restantes</span>`;
            return`<span class="bdg" style="background:#EFF6FF;color:#1d4ed8">Ativo · ${dias}d</span>`;
          })()}
        </div>
      </div>
      <div style="display:flex;gap:.4rem">
        <button class="btn btn-g btn-sm" onclick="openUsrModal('${u.id}')"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Editar</button>
        ${!isSelf?`<button class="btn btn-d btn-sm" onclick="deleteUsr('${u.id}')">✕</button>`:''}
      </div>
    </div>`;
  }).join('');
}

function openUsrModal(id){
  editUsr=id?users.find(u=>u.id===id):null;
  document.getElementById('usr-modal-title').textContent=editUsr?'Editar Usuário':'Novo Usuário';
  document.getElementById('um-nome').value=editUsr?.nome||'';
  document.getElementById('um-login').value=editUsr?.login||'';
  document.getElementById('um-role').value=editUsr?.role||'op';
  document.getElementById('um-pass').value='';document.getElementById('um-pass2').value='';
  document.getElementById('um-pass').placeholder=editUsr?'Deixe em branco para não alterar':'Mínimo 4 caracteres';
  document.getElementById('um-p2w').style.display=editUsr?'none':'flex';
  // Acesso
  const acessoSel=document.getElementById('um-acesso');
  const acessoInfo=document.getElementById('um-acesso-info');
  if(editUsr?.expires_at){
    const dias=Math.ceil((new Date(editUsr.expires_at)-new Date())/(1000*60*60*24));
    acessoSel.value='30'; // default, não altera
    if(acessoInfo) acessoInfo.textContent=dias>0?`Expira em ${dias} dias (${new Date(editUsr.expires_at).toLocaleDateString('pt-BR')})`:'⛔ Acesso expirado';
  } else if(editUsr){
    acessoSel.value='0';
    if(acessoInfo) acessoInfo.textContent='Acesso vitalício';
  } else {
    acessoSel.value='30';
    if(acessoInfo) acessoInfo.textContent='Novo usuário recebe 30 dias de trial';
  }
  acessoSel.onchange=()=>{
    const v=parseInt(acessoSel.value);
    if(acessoInfo) acessoInfo.textContent=v===0?'Sem data de expiração':`Acesso por ${v} dias a partir de hoje`;
  };
  openM('usr-modal');
}

async function saveUsr(){
  const nome=document.getElementById('um-nome').value.trim().toUpperCase();
  const login=document.getElementById('um-login').value.trim().toLowerCase();
  const role=document.getElementById('um-role').value;
  const pass=document.getElementById('um-pass').value;
  const pass2=document.getElementById('um-pass2').value;
  if(!nome||!login){toast('⚠ Preencha nome e login',true);return;}
  if(users.find(u=>u.login===login&&u.id!==editUsr?.id)){toast('⚠ Login já em uso',true);return;}
  const diasAcesso=parseInt(document.getElementById('um-acesso')?.value||'30');
  let expiresAt=null;
  if(diasAcesso>0){
    const d=new Date();d.setDate(d.getDate()+diasAcesso);
    expiresAt=d.toISOString().split('T')[0];
  }
  // Tenta salvar com expires_at; se a coluna não existir no banco, salva sem ela
  const payload={nome,login,role};
  try{payload.expires_at=expiresAt;}catch(e){}
  if(pass){if(pass.length<4){toast('⚠ Senha muito curta',true);return;}if(!editUsr&&pass!==pass2){toast('⚠ Senhas não coincidem',true);return;}payload.pass_hash=hp(pass);}
  if(editUsr){
    const{data,error}=await sb.from('users').update(payload).eq('id',editUsr.id).select().single();
    if(error){toast('Erro ao salvar',true);return;}
    users=users.map(u=>u.id===editUsr.id?data:u);
    if(editUsr.id===session.id){session={...session,...data};saveSession(session);}
    toast('✓ Usuário atualizado');
  } else {
    if(!pass){toast('⚠ Informe a senha',true);return;}
    const{data,error}=await sb.from('users').insert(payload).select().single();
    if(error){toast('Erro ao salvar',true);return;}
    users.push(data);toast('✓ Usuário criado');
  }
  closeM('usr-modal');renderUsuarios();
}

async function deleteUsr(id){
  if(id===session.id){toast('⚠ Não pode remover você mesmo',true);return;}
  const u=users.find(x=>x.id===id);
  if(!confirm(`Remover "${u?.nome}"?`))return;
  await sb.from('users').delete().eq('id',id);
  users=users.filter(x=>x.id!==id);toast('Usuário removido');renderUsuarios();
}




