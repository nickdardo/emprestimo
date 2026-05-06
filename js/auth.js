// ════════════════════════════════════════════════════════════════
// AUTH — Login, Registro, Recuperar Senha
// ════════════════════════════════════════════════════════════════

// ══ ESQUECI MINHA SENHA ══
function openEsqueciSenha(){
  document.getElementById('esqueci-senha-modal').style.display='flex';
  document.getElementById('esqueci-input').value='';
  document.getElementById('esqueci-error').style.display='none';
  setTimeout(()=>document.getElementById('esqueci-input').focus(),100);
}

function closeEsqueciSenha(){
  document.getElementById('esqueci-senha-modal').style.display='none';
}

function showEsqueciErr(msg){
  const el=document.getElementById('esqueci-error');
  el.textContent=msg;
  el.style.display='block';
}

async function enviarRecuperacaoSenha(){
  const input=document.getElementById('esqueci-input').value.trim().toLowerCase();
  document.getElementById('esqueci-error').style.display='none';
  
  if(!input){showEsqueciErr('Informe seu login ou e-mail.');return;}
  
  const btn=document.getElementById('esqueci-btn');
  btn.textContent='Enviando...';
  btn.disabled=true;
  
  try{
    // Chama API serverless (mais seguro - API Key não fica exposta)
    const response=await fetch('/api/recuperar-senha',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({login:input})
    });
    
    const data=await response.json();
    
    if(!response.ok){
      showEsqueciErr(data.error||'Erro ao processar solicitação.');
      btn.textContent='Enviar →';
      btn.disabled=false;
      return;
    }
    
    toast('✓ '+data.message);
    closeEsqueciSenha();
    btn.textContent='Enviar →';
    btn.disabled=false;
    
  }catch(e){
    console.error('Erro:',e);
    showEsqueciErr('Erro ao processar solicitação.');
    btn.textContent='Enviar →';
    btn.disabled=false;
  }
}


async function sbWithRetry(fn, tentativas=3, delay=1500){
  for(let i=0;i<tentativas;i++){
    try{
      const r=await Promise.race([fn(),new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),8000))]);
      return r;
    }catch(e){
      if(i===tentativas-1)throw e;
      await new Promise(r=>setTimeout(r,delay*(i+1)));
    }
  }
}


// ══ AUTH ══
function showRegister(){document.getElementById('login-panel').style.display='none';document.getElementById('register-panel').style.display='block';document.getElementById('reg-error').style.display='none';}
function showLogin(){document.getElementById('register-panel').style.display='none';document.getElementById('login-panel').style.display='block';document.getElementById('login-error').style.display='none';}
function showErr(msg){const e=document.getElementById('login-error');e.textContent=msg;e.style.display='block';}
function showRegErr(msg){const e=document.getElementById('reg-error');e.textContent=msg;e.style.display='block';}

// ── LEMBRAR ACESSO ──
function toggleRemember(){
  _remember=!_remember;
  const tog=document.getElementById('remember-toggle');
  const knob=document.getElementById('remember-knob');
  const st=document.getElementById('remember-status');
  if(_remember){
    tog.style.background='#EA580C';
    knob.style.left='20px';
    st.textContent='Ativo';st.style.color='#EA580C';
  } else {
    tog.style.background='#D1D5DB';
    knob.style.left='2px';
    st.textContent='';
    // Ao desativar, limpa o que estava salvo
    try{localStorage.removeItem('ep_cred');}catch(e){}
  }
}
function loadSavedCreds(){
  try{
    const raw=localStorage.getItem('ep_cred');
    if(!raw)return;
    const c=JSON.parse(atob(raw));
    if(c&&c.l&&c.p){
      document.getElementById('lu').value=c.l;
      document.getElementById('lp').value=c.p;
      _remember=true;
      const tog=document.getElementById('remember-toggle');
      const knob=document.getElementById('remember-knob');
      const st=document.getElementById('remember-status');
      if(tog)tog.style.background='#EA580C';
      if(knob)knob.style.left='20px';
      if(st){st.textContent='Ativo';st.style.color='#EA580C';}
    }
  }catch(e){}
}

async function doLogin(){
  const login=document.getElementById('lu').value.trim().toLowerCase();
  const pass=document.getElementById('lp').value;
  if(!login||!pass){showErr('Preencha usuário e senha');return;}
  const btn=document.getElementById('login-btn');btn.textContent='Entrando...';btn.disabled=true;
  try{
    const{data,error}=await sb.from('users').select('*').eq('login',login).eq('pass_hash',hp(pass)).maybeSingle();
    btn.textContent='Entrar →';btn.disabled=false;
    if(error||!data){showErr('Usuário ou senha incorretos.');return;}
    if(data.ativo===false){showErr('Conta suspensa. Contate o administrador.');return;}
    if(data.role!=='admin'&&data.expires_at){
      const dias=Math.ceil((new Date(data.expires_at)-new Date())/(1000*60*60*24));
      if(dias<0){showErr('⛔ Seu acesso expirou. Contate o administrador.');return;}
      if(dias<=3){
        // avisa mas permite entrar
        setTimeout(()=>toast('⚠ Seu acesso expira em '+dias+' dia'+(dias!==1?'s':'')+'!',true),1500);
      }
    }
    // Salva ou limpa credenciais conforme toggle
    try{
      if(_remember){localStorage.setItem('ep_cred',btoa(JSON.stringify({l:login,p:pass})));}
      else{localStorage.removeItem('ep_cred');}
    }catch(e){}
    session=data;saveSession(session);await bootApp();
  }catch(e){btn.textContent='Entrar →';btn.disabled=false;showErr('Erro de conexão.');}
}

async function doRegister(){
  const nome=document.getElementById('reg-nome').value.trim();
  const login=document.getElementById('reg-login').value.trim().toLowerCase();
  const email=document.getElementById('reg-email').value.trim().toLowerCase();
  const pass=document.getElementById('reg-pass').value;
  const pass2=document.getElementById('reg-pass2').value;
  document.getElementById('reg-error').style.display='none';
  if(!nome){showRegErr('Informe seu nome.');return;}
  if(!login||login.length<3){showRegErr('Login deve ter ao menos 3 caracteres.');return;}
  if(!/^[a-z0-9._]+$/.test(login)){showRegErr('Login inválido. Use letras, números, ponto.');return;}
  if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){showRegErr('E-mail inválido.');return;}
  if(pass.length<4){showRegErr('Senha deve ter ao menos 4 caracteres.');return;}
  if(pass!==pass2){showRegErr('As senhas não coincidem.');return;}
  const btn=document.getElementById('register-btn');btn.textContent='Criando...';btn.disabled=true;
  try{
    const{data:ex}=await sb.from('users').select('id').eq('login',login).maybeSingle();
    if(ex){showRegErr('Login já em uso.');btn.textContent='Criar conta →';btn.disabled=false;return;}
    const{data:exEmail}=await sb.from('users').select('id').eq('email',email).maybeSingle();
    if(exEmail){showRegErr('E-mail já cadastrado.');btn.textContent='Criar conta →';btn.disabled=false;return;}
    const trialExp=new Date();trialExp.setDate(trialExp.getDate()+30);
    const trialExpStr=trialExp.toISOString().split('T')[0];
    // Cria conta com 30 dias de trial — SEM fallback que deixava vitalício
    const{data,error}=await sb.from('users').insert({nome,login,email,pass_hash:hp(pass),role:'op',ativo:true,expires_at:trialExpStr}).select().single();
    if(error||!data){
      console.error('[REGISTER] Erro ao criar conta:',error);
      showRegErr('Erro ao criar conta: '+(error?.message||'tente novamente'));
      btn.textContent='Criar conta →';btn.disabled=false;
      return;
    }
    // Garante que o objeto session local tem o trial mesmo se o banco não retornar
    if(!data.expires_at)data.expires_at=trialExpStr;
    session=data;saveSession(session);btn.textContent='Criar conta →';btn.disabled=false;
    const codInd=document.getElementById('reg-indicacao')?.value.trim().toUpperCase();
    if(codInd&&codInd.length>=8){await verificarCodigoIndicacao(codInd);}
    await bootApp();toast('✓ Bem-vindo(a), '+data.nome.split(' ')[0]+'! Você tem 30 dias grátis.');
  }catch(e){showRegErr('Erro de conexão.');btn.textContent='Criar conta →';btn.disabled=false;}
}


