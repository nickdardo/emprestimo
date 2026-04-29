// api/webhook-asaas.js
// Recebe notificações do Asaas e atualiza expires_at no Supabase automaticamente
// Variáveis de ambiente necessárias no Vercel:
//   ASAAS_WEBHOOK_TOKEN  → token de verificação (configure no painel do Asaas)
//   ASAAS_API_KEY        → para consultar detalhes do pagamento
//   ASAAS_ENV            → "sandbox" ou "production"
//   SUPABASE_URL         → URL do seu projeto Supabase
//   SUPABASE_SERVICE_KEY → chave service_role do Supabase

const ASAAS_BASE = process.env.ASAAS_ENV === 'production'
  ? 'https://api.asaas.com/api/v3'
  : 'https://sandbox.asaas.com/api/v3';

// Planos: dias de cada label
const PLANO_DIAS = {
  '30 dias': 30,
  '60 dias': 60,
  '90 dias': 90,
  '6 meses': 180,
  '1 ano':   365,
};

// ── Atualiza expires_at no Supabase via REST (service role) ────────────────
async function atualizarExpiracao(userId, planoDias, planoLabel) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_KEY;

  // 1. Busca expires_at atual do usuário
  const getRes = await fetch(
    `${supabaseUrl}/rest/v1/users?id=eq.${userId}&select=expires_at,plan_type`,
    {
      headers: {
        'apikey':        serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      },
    }
  );
  const users = await getRes.json();
  const user  = users?.[0];

  // 2. Calcula nova data de expiração
  // Se ainda tem dias restantes, acumula a partir da data atual; senão, conta de hoje
  const base = user?.expires_at && new Date(user.expires_at) > new Date()
    ? new Date(user.expires_at)
    : new Date();

  base.setDate(base.getDate() + planoDias);
  const novaData = base.toISOString().split('T')[0]; // YYYY-MM-DD

  // 3. Atualiza o usuário
  const updateRes = await fetch(
    `${supabaseUrl}/rest/v1/users?id=eq.${userId}`,
    {
      method: 'PATCH',
      headers: {
        'apikey':        serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type':  'application/json',
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify({
        expires_at: novaData,
        plan_type:  planoLabel || null,
      }),
    }
  );

  if (!updateRes.ok) {
    const errText = await updateRes.text();
    throw new Error(`Supabase update falhou: ${errText}`);
  }

  return novaData;
}

// ── Atualiza renovacoes/renewals como confirmado ───────────────────────────
async function confirmarRenovacaoSupabase(userId, paymentId, planoLabel) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_KEY;

  // Atualiza na tabela renovacoes (status pendente → confirmado)
  await fetch(
    `${supabaseUrl}/rest/v1/renovacoes?user_id=eq.${userId}&status=eq.pendente`,
    {
      method: 'PATCH',
      headers: {
        'apikey':        serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type':  'application/json',
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify({
        status:           'confirmado',
        asaas_payment_id: paymentId,
        confirmed_at:     new Date().toISOString(),
      }),
    }
  );
}

// ── Handler principal ──────────────────────────────────────────────────────
export default async function handler(req, res) {
  // Só aceita POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Verifica token de autenticação do Asaas (opcional mas recomendado)
  const webhookToken = process.env.ASAAS_WEBHOOK_TOKEN;
  if (webhookToken) {
    const receivedToken = req.headers['asaas-access-token'];
    if (receivedToken !== webhookToken) {
      console.warn('[webhook-asaas] Token inválido');
      return res.status(401).json({ error: 'Token inválido' });
    }
  }

  try {
    const event = req.body;
    console.log('[webhook-asaas] Evento recebido:', event?.event, event?.payment?.id);

    // Só processa pagamentos confirmados/recebidos
    const eventosValidos = ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'];
    if (!eventosValidos.includes(event?.event)) {
      return res.status(200).json({ ok: true, msg: 'Evento ignorado: ' + event?.event });
    }

    const payment = event.payment;
    if (!payment?.id) {
      return res.status(400).json({ error: 'Dados do pagamento ausentes' });
    }

    // userId fica em externalReference (definido em criar-cobranca.js)
    const userId = payment.externalReference;
    if (!userId) {
      return res.status(400).json({ error: 'externalReference (userId) ausente' });
    }

    // Infere o plano pela descrição do pagamento ("GEPainel — 90 dias")
    const desc       = payment.description || '';
    const planoLabel = Object.keys(PLANO_DIAS).find(k => desc.includes(k)) || null;
    const planoDias  = PLANO_DIAS[planoLabel] || 30;

    // Atualiza Supabase
    const novaData = await atualizarExpiracao(userId, planoDias, planoLabel);
    await confirmarRenovacaoSupabase(userId, payment.id, planoLabel);

    console.log(`[webhook-asaas] ✅ User ${userId} renovado até ${novaData} (${planoLabel})`);
    return res.status(200).json({ ok: true, userId, novaData, planoLabel });

  } catch (err) {
    console.error('[webhook-asaas] Erro:', err);
    // Retorna 200 para evitar reenvio em loop pelo Asaas
    return res.status(200).json({ ok: false, error: err.message });
  }
}
