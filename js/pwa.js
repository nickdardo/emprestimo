// ════════════════════════════════════════════════════════════════
// PWA — Service Worker + Install Prompt
// ════════════════════════════════════════════════════════════════

// ── Service Worker ──
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js')
        .then((reg) => {
          console.log('[PWA] Service Worker registrado:', reg.scope);
          // Quando uma nova versão estiver disponível, ativa imediatamente
          reg.addEventListener('updatefound', () => {
            const newSW = reg.installing;
            if (!newSW) return;
            newSW.addEventListener('statechange', () => {
              if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[PWA] Nova versão disponível.');
              }
            });
          });
        })
        .catch((err) => console.warn('[PWA] Falha no registro:', err));
    });
  }

// ── Install Prompt (Android nativo + iOS modal explicativo) ──
(function(){
  let deferredPrompt = null;
  const installBtn = document.getElementById('install-btn');
  const installBanner = document.getElementById('login-install-banner');

  function showInstallUI(){
    if (installBtn) installBtn.style.display = 'flex';
    if (installBanner) installBanner.style.display = 'block';
  }
  function hideInstallUI(){
    if (installBtn) installBtn.style.display = 'none';
    if (installBanner) installBanner.style.display = 'none';
  }

  // Detectar se já está rodando como PWA instalado (standalone)
  function isStandalone(){
    return window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true
        || document.referrer.includes('android-app://');
  }
  function isIOS(){
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  }
  function isAndroid(){
    return /Android/i.test(navigator.userAgent);
  }
  function isMobile(){
    return isIOS() || isAndroid();
  }

  // Lê flag de "já instalado neste navegador" (sobrevive entre sessões)
  function jaInstalouAqui(){
    try{ return localStorage.getItem('ep_pwa_installed') === '1'; }catch(e){ return false; }
  }
  function marcarComoInstalado(){
    try{ localStorage.setItem('ep_pwa_installed','1'); }catch(e){}
  }

  // ─── Cenário 1: já está aberto como PWA → esconde tudo, marca flag e sai
  if (isStandalone()){
    marcarComoInstalado();
    hideInstallUI();
    return;
  }

  // ─── Cenário 2: já instalou pelo menos 1x neste navegador → esconde
  if (jaInstalouAqui()){
    console.log('[PWA] Já instalado neste navegador, banner oculto');
    hideInstallUI();
    return;
  }

  // ─── Cenário 3: ainda não instalou — decide se mostra
  // Em mobile, mostra SEMPRE (independente do beforeinstallprompt)
  // Em desktop, mostra apenas quando o navegador permitir (beforeinstallprompt)
  if (isMobile()){
    if (isIOS()){
      const loginHint = document.getElementById('login-install-hint');
      if (loginHint) loginHint.textContent = 'Adicione à Tela de Início pelo Safari';
    }
    showInstallUI();
    console.log('[PWA] Mobile detectado, banner visível');
  }

  // Captura evento de instalação (Android/Desktop com Chrome/Edge)
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallUI();
    console.log('[PWA] Instalador nativo disponível');
  });

  // Após instalação bem-sucedida
  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App instalado com sucesso');
    marcarComoInstalado();
    hideInstallUI();
    deferredPrompt = null;
    if (typeof toast === 'function') toast('App instalado com sucesso! 🎉');
  });

  // Função chamada ao clicar no botão/banner
  window.instalarApp = async function(){
    // iOS: sempre abre o modal explicativo
    if (isIOS()){
      const modal = document.getElementById('ios-install-modal');
      if (modal) modal.style.display = 'flex';
      return;
    }

    // Android/Desktop com prompt nativo disponível
    if (deferredPrompt){
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log('[PWA] Resultado:', outcome);
      if (outcome === 'accepted'){
        marcarComoInstalado();
        hideInstallUI();
      }
      deferredPrompt = null;
      return;
    }

    // Fallback: sem prompt nativo (Android sem critérios PWA, ou já recusou antes)
    if (isAndroid()){
      alert('Para instalar o GEPainel:\n\n1. Toque no menu (⋮) do navegador\n2. Toque em "Instalar app" ou "Adicionar à tela inicial"');
    } else {
      alert('Para instalar o GEPainel no computador:\n\n1. Clique no menu (⋮) do navegador\n2. Procure "Instalar GEPainel..."\n\nFunciona melhor no Chrome ou Edge.');
    }
  };

  // Fechar modal iOS
  window.fecharIosInstallModal = function(){
    const modal = document.getElementById('ios-install-modal');
    if (modal) modal.style.display = 'none';
  };
  document.getElementById('ios-install-modal')?.addEventListener('click', function(e){
    if (e.target === this) fecharIosInstallModal();
  });
})();
