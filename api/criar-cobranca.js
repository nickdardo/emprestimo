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

// ── Helpers ────────────────────────────────────────────────────────────────
function limparDocumento(doc) {
  return (doc || '').replace(/\D/g, '');
}

function documentoValido(doc) {
  // Aceita CPF (11 dígitos) ou CNPJ (14 dígitos)
  return doc.length === 11 || doc.length === 14;
}

// ── Busca ou cria cliente no Asaas pelo CPF/email ──────────────────────────
async function upsertCustomer({ nome, email, cpf }) {
  // Prioriza busca por CPF/CNPJ (mais confiável que email)
  const searchParam = cpf
    ? `cpfCnpj=${cpf}`
    : `email=${encodeURIComponent(email)}`;

  const search = await fetch(`${ASAAS_BASE}/customers?${searchParam}&limit=1`, {
    headers: ASAAS_HEADERS,
  });
  const searchData = await search.json();

  if (searchData?.data?.length > 0) {
    const existing = searchData.data[0];

    // Se o cliente existe mas está sem CPF/CNPJ, atualiza
    if (cpf && !existing.cpfCnpj) {
      const updateRes = await fetch(`${ASAAS_BASE}/customers/${existing.id}`, {
        method: 'PUT',
        headers: ASAAS_HEADERS,
        body: JSON.stringify({ cpfCnpj: cpf }),
      });
      const updated = await updateRes.json();
      if (!updated.id) {
        throw new Error('Erro ao atualizar CPF do cliente: ' + JSON.stringify(updated));
      }
    }

    return existing.id;
  }

  // Cria novo cliente
  const body = {
    name: nome,
    cpfCnpj: cpf, // sempre enviado, já validado antes
    ...(email ? { email } : {}),
  };

  const create = await fetch(`${ASAAS_BASE}/customers`, {
    method: 'POST',
    headers: ASAAS_HEADERS,
    body: JSON.stringify(body),
  });
  const customer = await create.json();

  if (!customer.id) {
    throw new Error('Erro ao criar cliente: ' + JSON.stringify(customer));
  }
  return customer.id;
}

// ── Handler principal ──────────────────────────────────────────────────────
export default async function handler(req, res) {
  // Só aceita POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const {
      userId,
      userName,
      userEmail,
      userCpf,
      planoLabel,
      planoValor,
      planoDias,
    } = req.body;

    // 1. Validações de entrada
    if (!userId || !planoValor || !planoDias) {
      return res.status(400).json({
        error: 'Parâmetros obrigatórios ausentes (userId, planoValor, planoDias)',
      });
    }

    const cpfLimpo = limparDocumento(userCpf);
    if (!documentoValido(cpfLimpo)) {
      return res.status(400).json({
        error: 'CPF ou CNPJ inválido — é obrigatório para gerar cobrança PIX',
      });
    }

    // 2. Cria/recupera cliente no Asaas (com CPF garantido)
    const customerId = await upsertCustomer({
      nome:  userName  || 'Usuário GEPainel',
      email: userEmail || null,
      cpf:   cpfLimpo,
    });

    // 3. Data de vencimento = hoje + 1 dia (PIX expira em 24h)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);
    const dueDateStr = dueDate.toISOString().split('T')[0]; // YYYY-MM-DD

    // 4. Cria cobrança PIX
    const paymentBody = {
      customer:          customerId,
      billingType:       'PIX',
      value:             planoValor,
      dueDate:           dueDateStr,
      description:       `GEPainel — ${planoLabel}`,
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

    // 5. Busca QR Code PIX da cobrança
    const qrRes  = await fetch(`${ASAAS_BASE}/payments/${payment.id}/pixQrCode`, {
      headers: ASAAS_HEADERS,
    });
    const qrData = await qrRes.json();

    if (!qrData.payload) {
      throw new Error('Erro ao gerar QR Code: ' + JSON.stringify(qrData));
    }

    // 6. Retorna dados para o frontend
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
