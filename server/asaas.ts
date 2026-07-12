// Cliente do gateway Asaas (assinaturas recorrentes + cobranças avulsas).
// Checkout hospedado no Asaas: o app guarda só IDs e status — nunca dado de cartão.
// Env: ASAAS_API_KEY (obrigatória p/ usar), ASAAS_BASE_URL (default sandbox).

const BASE_URL = process.env.ASAAS_BASE_URL || "https://sandbox.asaas.com/api/v3";

export function asaasConfigured(): boolean {
  return Boolean(process.env.ASAAS_API_KEY);
}

async function asaasRequest<T = any>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: Record<string, any>,
): Promise<T> {
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) {
    throw new Error("ASAAS_API_KEY não configurada — gateway de pagamento indisponível");
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (data as any)?.errors?.[0]?.description ||
      `Asaas ${method} ${path} falhou (HTTP ${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

// Cria (ou retorna) um customer no Asaas para um ambiente cliente
export async function createCustomer(params: {
  name: string;
  email?: string;
  cpfCnpj?: string;
  phone?: string;
  externalReference?: string; // tenant id
}): Promise<{ id: string }> {
  return asaasRequest("POST", "/customers", params);
}

// Assinatura recorrente mensal (Fase 4)
export async function createSubscription(params: {
  customer: string; // asaas customer id
  value: number;
  nextDueDate: string; // YYYY-MM-DD
  cycle?: "MONTHLY" | "YEARLY";
  description?: string;
  billingType?: "UNDEFINED" | "BOLETO" | "CREDIT_CARD" | "PIX";
  externalReference?: string;
}): Promise<{ id: string; status: string }> {
  return asaasRequest("POST", "/subscriptions", {
    billingType: params.billingType || "UNDEFINED",
    ...params,
    cycle: params.cycle || "MONTHLY",
  });
}

// Cobrança avulsa (pedidos de serviço — Fase 3)
export async function createCharge(params: {
  customer: string;
  value: number;
  dueDate: string; // YYYY-MM-DD
  description?: string;
  billingType?: "UNDEFINED" | "BOLETO" | "CREDIT_CARD" | "PIX";
  externalReference?: string;
}): Promise<{ id: string; status: string; invoiceUrl?: string }> {
  return asaasRequest("POST", "/payments", {
    billingType: params.billingType || "UNDEFINED",
    ...params,
  });
}

export async function getPayment(
  paymentId: string,
): Promise<{ id: string; status: string; value: number; subscription?: string }> {
  return asaasRequest("GET", `/payments/${paymentId}`);
}

// Cancela a assinatura recorrente no Asaas (usado ao suspender/cancelar no painel)
export async function cancelSubscription(subscriptionId: string): Promise<{ deleted: boolean }> {
  return asaasRequest("DELETE", `/subscriptions/${subscriptionId}`);
}
