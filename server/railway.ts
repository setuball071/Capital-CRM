// Integração com a Railway Public API (GraphQL) — domínios próprios de clientes.
// Subdomínios do curinga (*.WILDCARD_BASE_DOMAIN) NÃO passam por aqui: o wildcard
// já cobre todos, basta a linha em tenant_domains. Esta API é só para domínio
// próprio do cliente (ex.: crm.empresa.com.br), que precisa ser registrado no
// serviço do Railway para o SSL ser emitido.
//
// Env: RAILWAY_API_TOKEN (gerado pelo Fábio no painel). RAILWAY_SERVICE_ID e
// RAILWAY_ENVIRONMENT_ID são injetados automaticamente pelo próprio Railway.

const RAILWAY_GQL = "https://backboard.railway.com/graphql/v2";

export function railwayConfigured(): boolean {
  return Boolean(
    process.env.RAILWAY_API_TOKEN &&
      process.env.RAILWAY_SERVICE_ID &&
      process.env.RAILWAY_ENVIRONMENT_ID,
  );
}

// Registra um domínio próprio no serviço e retorna o alvo do CNAME que o
// cliente deve apontar no DNS dele.
export async function addCustomDomain(
  domain: string,
): Promise<{ id: string; cnameAlvo: string | null }> {
  if (!railwayConfigured()) {
    throw new Error(
      "Railway API não configurada (defina RAILWAY_API_TOKEN; SERVICE/ENVIRONMENT vêm do próprio Railway)",
    );
  }
  const res = await fetch(RAILWAY_GQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RAILWAY_API_TOKEN}`,
    },
    body: JSON.stringify({
      query: `mutation customDomainCreate($input: CustomDomainCreateInput!) {
        customDomainCreate(input: $input) {
          id
          domain
          status { dnsRecords { hostlabel requiredValue } }
        }
      }`,
      variables: {
        input: {
          domain,
          serviceId: process.env.RAILWAY_SERVICE_ID,
          environmentId: process.env.RAILWAY_ENVIRONMENT_ID,
        },
      },
    }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || data.errors?.length) {
    const msg = data.errors?.[0]?.message || `Railway API falhou (HTTP ${res.status})`;
    throw new Error(msg);
  }
  const created = data.data?.customDomainCreate;
  const cnameAlvo = created?.status?.dnsRecords?.[0]?.requiredValue || null;
  return { id: created?.id, cnameAlvo };
}
