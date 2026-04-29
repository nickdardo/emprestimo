// api/criar-cobranca.js
// Cria cobrança PIX no Asaas e retorna QR Code + paymentId
// Variáveis de ambiente necessárias no Vercel:
//   ASAAS_API_KEY        → sua chave de API do Asaas (começa com $aact_...)
//   ASAAS_ENV            → "sandbox" ou "production"
//   SUPABASE_URL         → URL do seu projeto Supabase
//   SUPABASE_SERVICE_KEY → chave service_role do Supabase (não a anon!)

const ASAAS_BASE = process.env.ASAAS_ENV === 'production'
  ? 'https://api.asaas.com/api/v3'
  : 'https://sandbox.asaas.com/api/v3';

const ASAAS_HEADERS = {
  'Content-Type': 'application/json',
  'access_token': process.env.ASAAS_API_KEY,
};

// ── Busca ou cria cliente no Asaas pelo CPF/email ──────────────────────────
async function upsertCustomer({ nome, email, cpf }) {
  // Tenta buscar cliente existente pelo CPF (se fornecido) ou email
  const searchParam = cpf ? `cpfCnpj=${cpf}` : `email=${encodeURIComponent(email)}`;
  const search = await fetch(`${ASAAS_BASE}/customers?${searchParam}&limit=1`, {
    headers: ASAAS_HEADERS,
  });
  const searchData = await search.json();

  if (searchData?.data?.length > 0) {
    return searchData.data[0].id; // cliente já existe
  }

  // Cria novo cliente
  const body = {
    name: nome,
    ...(email ? { email } : {}),
    ...(cpf   ? { cpfCnpj: cpf.replace(/\D/g,'') } : {}),
  };
  const create = await fetch(`${ASAAS_BASE}/customers`, {
    method: 'POST',
    headers: ASAAS_HEADERS,
    body: JSON.stringify(body),
  });
  const customer = await create.json();
  if (!customer.id) throw new Error('Erro ao criar cliente: ' + JSON.stringify(customer));
  return customer.id;
}

// ── Handler principal ──────────────────────────────────────────────────────
export default async function handler(req, res) {
  // Só aceita POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { userId, userName, userEmail, planoLabel, planoValor, planoDias } = req.body;

    if (!userId || !planoValor || !planoDias) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios ausentes' });
    }

    // 1. Busca ou cria cliente no Asaas
    const customerId = await upsertCustomer({
      nome:  userName  || 'Usuário GEPainel',
      email: userEmail || null,
      cpf:   null, // adicione CPF aqui se quiser
    });

    // 2. Data de vencimento = hoje + 1 dia (PIX expira em 24h)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);
    const dueDateStr = dueDate.toISOString().split('T')[0]; // YYYY-MM-DD

    // 3. Cria cobrança PIX
    const paymentBody = {
      customer:    customerId,
      billingType: 'PIX',
      value:       planoValor,
      dueDate:     dueDateStr,
      description: `GEPainel — ${planoLabel}`,
      externalReference: userId, // vincula ao userId do Supabase
    };

    const paymentRes = await fetch(`${ASAAS_BASE}/payments`, {
      method:  'POST',
      headers: ASAAS_HEADERS,
      body:    JSON.stringify(paymentBody),
    });
    const payment = await paymentRes.json();

    if (!payment.id) {
      throw new Error('Erro ao criar cobrança: ' + JSON.stringify(payment));
    }

    // 4. Busca QR Code PIX da cobrança
    const qrRes  = await fetch(`${ASAAS_BASE}/payments/${payment.id}/pixQrCode`, {
      headers: ASAAS_HEADERS,
    });
    const qrData = await qrRes.json();

    // 5. Retorna dados para o frontend
    return res.status(200).json({
      paymentId:   payment.id,
      pixCode:     qrData.payload,        // código copia-e-cola
      qrCodeImage: qrData.encodedImage,   // base64 PNG do QR Code
      value:       payment.value,
      dueDate:     payment.dueDate,
      planoDias,
      planoLabel,
    });

  } catch (err) {
    console.error('[criar-cobranca]', err);
    return res.status(500).json({ error: err.message });
  }
}
