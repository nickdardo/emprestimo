// ════════════════════════════════════════════════════════════════
// PERFIL — Render perfil, avatar, senha, renovações pendentes (admin)
// ════════════════════════════════════════════════════════════════

// ══ PERFIL ══

// ══ RENOVAÇÕES (ADMIN) ══
async function renderRenovacoes(){
  if(session.role!=='admin'){navTo('dashboard');return;}
  
  const mc=document.getElementById('main-content');
  mc.innerHTML='<div style="text-align:center;padding:2rem"><div class="loading-dots"><span></span><span></span><span></span></div></div>';
  
  // Buscar renovações pendentes
  const{data:renovs,error}=await sb.from('renewals')
    .select('*,users(nome,email,login)')
    .order('created_at',{ascending:false});
  
  if(error){
    console.error(error);
    mc.innerHTML='<div class="empty">Erro ao carregar renovações</div>';
    return;
  }
  
  const pendentes=renovs.filter(r=>r.status==='pending');
  const confirmadas=renovs.filter(r=>r.status==='confirmed');
  
  mc.innerHTML=`
    <div class="sec-hdr">
      <span class="sec-title">Renovações PIX</span>
      <div style="display:flex;gap:.5rem">
        <span class="bdg" style="background:var(--amb0);color:var(--amb)">${pendentes.length} pendentes</span>
        <span class="bdg" style="background:var(--grn0);color:var(--grn)">${confirmadas.length} confirmadas</span>
      </div>
    </div>
    
    ${pendentes.length>0?`
      <div class="card">
        <div class="card-title" style="color:var(--amb)">⏳ Aguardando Confirmação</div>
        <div class="tbl-wrap">
          <table>
            <thead><tr>
              <th>Cliente</th>
              <th>Plano</th>
              <th>Valor</th>
              <th>Data</th>
              <th>Ações</th>
            </tr></thead>
            <tbody>
              ${pendentes.map(r=>{
                const user=r.users;
                const userName=user?.nome||user?.login||'—';
                return`<tr>
                  <td><strong>${userName}</strong><br><span style="font-size:11px;color:var(--n4)">${user?.email||''}</span></td>
                  <td><span class="bdg" style="background:var(--blu0);color:var(--blu)">${r.plan_type}</span></td>
                  <td style="font-weight:700;color:var(--grn)">R$ ${r.amount.toFixed(2).replace('.',',')}</td>
                  <td style="font-size:12px;color:var(--n3)">${new Date(r.created_at).toLocaleString('pt-BR')}</td>
                  <td>
                    <button class="btn btn-grn btn-sm" onclick="confirmarRenovacao('${r.id}','${r.user_id}',${r.dias})">
                      ✓ Confirmar ${r.plan_type}
                    </button>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `:`<div class="card"><div class="empty">Nenhuma renovação pendente</div></div>`}
    
    ${confirmadas.length>0?`
      <div class="card">
        <div class="card-title" style="color:var(--grn)">✓ Confirmadas</div>
        <div class="tbl-wrap">
          <table>
            <thead><tr>
              <th>Cliente</th>
              <th>Plano</th>
              <th>Valor</th>
              <th>Confirmado em</th>
            </tr></thead>
            <tbody>
              ${confirmadas.slice(0,20).map(r=>{
                const user=r.users;
                const userName=user?.nome||user?.login||'—';
                return`<tr style="opacity:0.7">
                  <td>${userName}</td>
                  <td><span class="bdg bdg-ok">${r.plan_type}</span></td>
                  <td style="color:var(--grn)">R$ ${r.amount.toFixed(2).replace('.',',')}</td>
                  <td style="font-size:12px">${r.confirmed_at?new Date(r.confirmed_at).toLocaleString('pt-BR'):'—'}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `:''}
  `;
}


function renderPerfil(){
  const mc=document.getElementById('main-content');
  const avatarHTML=session.avatar_url
    ?`<img src="${session.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`
    :`<span style="font-size:2rem;font-weight:700">${ini(session.nome)}</span>`;
  const avStyle=session.avatar_url?'background:transparent':'background:#FFF7ED';
  mc.innerHTML=`
    <div class="sec-hdr"><span class="sec-title">Meu Perfil</span><button class="btn btn-grn btn-sm" onclick="abrirIndicacao()">🎁 Indicar amigo</button></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;max-width:800px" class="perfil-grid">
      <div class="card">
        <div class="card-title">Foto de Perfil</div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:1.25rem">
          <div id="avatar-preview" style="width:100px;height:100px;border-radius:50%;${avStyle};display:flex;align-items:center;justify-content:center;color:#111;border:3px solid #E5E7EB;overflow:hidden;flex-shrink:0">
            ${avatarHTML}
          </div>
          <div style="text-align:center">
            <div style="font-weight:600;font-size:16px">${session.nome}</div>
            <div style="font-size:13px;color:var(--n4);margin-top:2px">@${session.login||''} · ${session.role==='admin'?'👑 Admin':(()=>{let pl=getUserPlan(session.plan_type);if(!pl&&session.expires_at){const d=Math.ceil((new Date(session.expires_at)-new Date())/(1000*60*60*24));pl=_inferPlanByDias(d);}return pl?pl.name:'👑 Vitalício';})()}</div>
          </div>
          <div style="width:100%">
            <div style="font-size:11px;font-weight:700;color:var(--n3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:.5rem">Selecionar foto</div>
            <input type="file" id="avatar-file" accept="image/*" onchange="previewAvatar(this)"
              style="width:100%;padding:.5rem;border:1px dashed #D1D5DB;border-radius:var(--rs);background:#F9FAFB;color:var(--n3);font-size:13px;cursor:pointer"/>
            <div style="font-size:11px;color:var(--n4);margin-top:.4rem">JPG, PNG ou WEBP · Máximo 2MB</div>
          </div>
          <button class="btn btn-p btn-full" onclick="uploadAvatar()">Salvar foto</button>
          ${session.avatar_url?`<button class="btn btn-g btn-full" onclick="removeAvatar()" style="margin-top:-.5rem">Remover foto</button>`:''}
        </div>
      </div>
      
      <div class="card">
        <div class="card-title">Dados Pessoais</div>
        <div style="display:flex;flex-direction:column;gap:.85rem">
          <div class="fg">
            <span class="lbl">Nome completo</span>
            <input type="text" id="p-nome" value="${session.nome||''}" placeholder="Seu nome completo"/>
          </div>
          <div class="fg">
            <span class="lbl">E-mail</span>
            <input type="email" id="p-email" value="${session.email||''}" placeholder="seu@email.com"/>
            <div style="font-size:11px;color:var(--n4);margin-top:.3rem">
              ${session.email?'✓ E-mail cadastrado':'⚠️ Adicione seu e-mail para recuperar senha'}
            </div>
          </div>
          <button class="btn btn-p btn-full" onclick="savePerfilDados()">Salvar dados</button>
        </div>
      </div>
      
      <div class="card">
        <div class="card-title">Trocar Senha</div>
        <div style="display:flex;flex-direction:column;gap:.85rem">
          <div class="fg"><span class="lbl">Senha atual</span><input type="password" id="p-pwd-old" placeholder="••••••••"/></div>
          <div class="fg">
            <span class="lbl">Nova senha</span>
            <input type="password" id="p-pwd-new" placeholder="Mínimo 4 caracteres"/>
          </div>
          <div class="fg">
            <span class="lbl">Confirmar nova senha</span>
            <input type="password" id="p-pwd-new2" placeholder="Repita a nova senha" oninput="checkPwdMatch()"/>
            <div id="pwd-match" style="margin-top:.3rem;font-size:11px"></div>
          </div>
          <button class="btn btn-p btn-full" onclick="savePerfilSenha()">Alterar senha</button>
          <div style="padding:.75rem 1rem;background:#F9FAFB;border-radius:var(--rs);font-size:12px;color:var(--n3);border:1px solid #E5E7EB">
            Use ao menos 4 caracteres. Recomendamos misturar letras, números e símbolos.
          </div>
        </div>
      </div>
    </div>

    <!-- PREFERÊNCIAS DO APP -->
    <div class="card" style="margin-top:1.25rem;max-width:800px">
      <div class="card-title">Preferências do App</div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:.5rem 0">
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--n1)">Barra de navegação inferior</div>
          <div style="font-size:12px;color:var(--n4);margin-top:2px">Substitui o menu lateral por barra no rodapé (ideal para mobile)</div>
        </div>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <div id="bottom-nav-toggle" onclick="toggleBottomNav()"
            style="width:44px;height:24px;border-radius:999px;background:${localStorage.getItem('ep_bottom_nav')==='1'?'#EA580C':'#D1D5DB'};position:relative;cursor:pointer;transition:background .2s;flex-shrink:0">
            <div id="bottom-nav-knob" style="width:20px;height:20px;border-radius:50%;background:#fff;position:absolute;top:2px;left:${localStorage.getItem('ep_bottom_nav')==='1'?'22':'2'}px;transition:left .2s;box-shadow:0 1px 3px rgba(0,0,0,.2)"></div>
          </div>
          <span id="bottom-nav-lbl" style="font-size:13px;font-weight:600;color:var(--n4)">${localStorage.getItem('ep_bottom_nav')==='1'?'Ativo':'Inativo'}</span>
        </label>
      </div>
    </div>`;
}

function previewAvatar(input){
  const file=input.files[0];
  if(!file)return;
  if(file.size>2*1024*1024){toast('⚠ Imagem muito grande (máx 2MB)',true);input.value='';return;}
  const reader=new FileReader();
  reader.onload=e=>{
    const prev=document.getElementById('avatar-preview');
    if(prev)prev.innerHTML=`<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`;
  };
  reader.readAsDataURL(file);
}

async function uploadAvatar(){
  const input=document.getElementById('avatar-file');
  if(!input||!input.files[0]){toast('⚠ Selecione uma foto',true);return;}
  const file=input.files[0];
  if(file.size>2*1024*1024){toast('⚠ Imagem muito grande (máx 2MB)',true);return;}
  const ext=file.name.split('.').pop();
  const path=`${session.id}/avatar.${ext}`;
  await sb.storage.from('avatars').remove([path]);
  const{error:upErr}=await sb.storage.from('avatars').upload(path,file,{upsert:true,contentType:file.type});
  if(upErr){toast('Erro ao enviar foto',true);return;}
  const{data:urlData}=sb.storage.from('avatars').getPublicUrl(path);
  const avatarUrl=urlData.publicUrl+'?t='+Date.now();
  const{error:dbErr}=await sb.from('users').update({avatar_url:avatarUrl}).eq('id',session.id);
  if(dbErr){toast('Erro ao salvar',true);return;}
  session.avatar_url=avatarUrl;saveSession(session);
  const nav_av=document.getElementById('nav-av');
  if(nav_av){nav_av.style.cssText='background:transparent;padding:0;overflow:hidden;';nav_av.innerHTML=`<img src="${avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`;}
  users=users.map(u=>u.id===session.id?{...u,avatar_url:avatarUrl}:u);
  toast('✓ Foto atualizada!');renderPerfil();
}

async function removeAvatar(){
  if(!confirm('Remover foto de perfil?'))return;
  const ext=session.avatar_url?.split('.').pop()?.split('?')[0]||'jpg';
  await sb.storage.from('avatars').remove([`${session.id}/avatar.${ext}`]);
  await sb.from('users').update({avatar_url:null}).eq('id',session.id);
  session.avatar_url=null;saveSession(session);
  const nav_av=document.getElementById('nav-av');
  if(nav_av){nav_av.innerHTML=ini(session.nome);nav_av.style.cssText=AV_STYLE[session.role]||AV_STYLE.op;}
  users=users.map(u=>u.id===session.id?{...u,avatar_url:null}:u);
  toast('✓ Foto removida');renderPerfil();
}

function checkPwdMatch(){
  const nw=document.getElementById('p-pwd-new')?.value||'';
  const nw2=document.getElementById('p-pwd-new2')?.value||'';
  const el=document.getElementById('pwd-match');if(!el||!nw2)return;
  if(nw===nw2){el.textContent='✓ Senhas coincidem';el.style.color='var(--grn)';}
  else{el.textContent='✕ Senhas não coincidem';el.style.color='var(--red)';}
}

async function savePerfilDados(){
  const nome=document.getElementById('p-nome')?.value?.trim()||'';
  const email=document.getElementById('p-email')?.value?.trim()||'';
  
  if(!nome){toast('⚠ Nome é obrigatório',true);return;}
  
  // Valida e-mail se preenchido
  if(email&&!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)){
    toast('⚠ E-mail inválido',true);return;
  }
  
  // Verifica se e-mail já está em uso
  if(email){
    const{data:existente}=await sb.from('users').select('id').eq('email',email).single();
    if(existente&&existente.id!==session.id){
      toast('⚠ Este e-mail já está cadastrado',true);return;
    }
  }
  
  const{error}=await sb.from('users').update({nome,email:email||null}).eq('id',session.id);
  if(error){toast('Erro ao salvar',true);return;}
  
  // Atualiza session e users
  session.nome=nome;
  session.email=email||null;
  saveSession(session);
  users=users.map(x=>x.id===session.id?{...x,nome,email:email||null}:x);
  
  toast('✓ Dados salvos com sucesso!');
  renderPerfil();
}

async function savePerfilSenha(){
  const old=document.getElementById('p-pwd-old')?.value||'';
  const nw=document.getElementById('p-pwd-new')?.value||'';
  const nw2=document.getElementById('p-pwd-new2')?.value||'';
  const u=users.find(x=>x.id===session.id);
  if(!u||u.pass_hash!==hp(old)){toast('⚠ Senha atual incorreta',true);return;}
  if(nw.length<4){toast('⚠ Nova senha muito curta',true);return;}
  if(nw!==nw2){toast('⚠ As senhas não coincidem',true);return;}
  const{error}=await sb.from('users').update({pass_hash:hp(nw)}).eq('id',session.id);
  if(error){toast('Erro ao salvar',true);return;}
  users=users.map(x=>x.id===session.id?{...x,pass_hash:hp(nw)}:x);
  document.getElementById('p-pwd-old').value='';
  document.getElementById('p-pwd-new').value='';
  document.getElementById('p-pwd-new2').value='';
  document.getElementById('pwd-match').textContent='';
  toast('✓ Senha alterada com sucesso!');
}

