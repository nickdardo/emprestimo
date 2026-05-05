/**
 * GEPainel - Configuração do Supabase
 * Este arquivo contém a configuração e inicialização do cliente Supabase
 */

// ═══════════════════════════════════════════════════════════
// CONFIGURAÇÃO DO SUPABASE
// ═══════════════════════════════════════════════════════════

const SUPABASE_URL = 'https://efdwdjwncbwbgmcudizh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmZHdkanduY2J3YmdtY3VkaXpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzMyNDE4NjksImV4cCI6MjA0ODgxNzg2OX0.eHVTFvKfP_DEFmPH9IvqoFm-0zLkPn4ZQ4_-XmOoL0c';

// Inicializar cliente Supabase
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ═══════════════════════════════════════════════════════════
// FUNÇÕES DE RETRY COM TIMEOUT
// ═══════════════════════════════════════════════════════════

/**
 * Executa uma função com retry em caso de falha
 * @param {Function} fn - Função a ser executada
 * @param {number} tentativas - Número de tentativas (padrão: 3)
 * @param {number} delay - Delay entre tentativas em ms (padrão: 1500)
 * @returns {Promise} - Resultado da função
 */
async function sbWithRetry(fn, tentativas = 3, delay = 1500) {
  for (let i = 0; i < tentativas; i++) {
    try {
      const resultado = await Promise.race([
        fn(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('timeout')), 8000)
        )
      ]);
      return resultado;
    } catch (erro) {
      if (i === tentativas - 1) throw erro;
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
    }
  }
}

// Exportar para uso global
window.sbWithRetry = sbWithRetry;
