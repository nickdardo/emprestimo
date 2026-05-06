// ════════════════════════════════════════════════════════════════
// SESSION — Gerenciamento de sessão (login/logout/persistência)
// ════════════════════════════════════════════════════════════════


function saveSession(s){try{localStorage.setItem('ep_s',JSON.stringify(s));document.cookie='ep_s='+encodeURIComponent(JSON.stringify(s))+';path=/;max-age='+(30*24*3600)+';SameSite=Lax';}catch(e){}}
function clearSession(){try{localStorage.removeItem('ep_s');}catch(e){}try{document.cookie='ep_s=;path=/;max-age=0';}catch(e){}}
function readSession(){
  try{const v=localStorage.getItem('ep_s');if(v){const p=JSON.parse(v);if(p&&p.id)return p;}}catch(e){}
  try{const m=document.cookie.match(/(?:^|;\s*)ep_s=([^;]*)/);if(m&&m[1]){const p=JSON.parse(decodeURIComponent(m[1]));if(p&&p.id)return p;}}catch(e){}
  return null;
}

