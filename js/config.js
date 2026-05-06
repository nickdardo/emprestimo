// ════════════════════════════════════════════════════════════════
// CONFIG — Supabase e constantes globais
// Cliente Supabase, chaves, timeouts e configurações de sessão.
// NOTA SOBRE SEGURANÇA: a SUPA_KEY é a "anon key" pública.
// Ela foi projetada para ser exposta no front-end. A segurança real do
// banco vem das policies de Row Level Security (RLS) configuradas no
// Supabase. Garanta que TODAS as tabelas tenham RLS habilitado.
// Para produção, considere mover para variáveis de ambiente do Vercel
// (process.env.NEXT_PUBLIC_*) e injetar via build step.
// ════════════════════════════════════════════════════════════════

// ══ SUPABASE ══
const SUPA_URL='https://abmwlhxdvfgnptmvtkla.supabase.co';
const SUPA_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFibXdsaHhkdmZnbnB0bXZ0a2xhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5NjU2NzQsImV4cCI6MjA5MTU0MTY3NH0.rHxMXklvuy1uktseEWAkPRp4cdvVlzl_mx97fAvKZY0';
const sb=supabase.createClient(SUPA_URL,SUPA_KEY);

// ══ SESSÃO ══
const TIMEOUT_MS=10*60*1000;
let session=null, _lastActivity=Date.now();
