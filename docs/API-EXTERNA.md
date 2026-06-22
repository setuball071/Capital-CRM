# API Externa — Capital CRM

Documentação para sistemas parceiros que consultam clientes por CPF em tempo real.

---

## Autenticação

Envie a API Key em um dos headers abaixo:

```
X-API-Key: <sua_chave>
```
ou
```
Authorization: Bearer <sua_chave>
```

A chave é gerada no painel em **Administração → API Keys Externas** e exibida apenas uma vez no momento da criação. Guarde-a com segurança — depois disso só fica armazenado o hash.

---

## Escopos da chave

Cada chave tem escopos que definem **quais blocos** ela pode retornar:

| Bloco | Sempre incluído? | Conteúdo |
|-------|------------------|----------|
| **Básicos** | ✅ Sim | `cpf`, `nome`, `nascimento`, `situacao_funcional`, `orgao`, `orgao_codigo`, `convenio` |
| **Margens** | Só se a chave tiver o escopo | objeto `margens` (35%, cartão 5%, benefício 5%, 70%, salário) |
| **Contratos** | Só se a chave tiver o escopo | array `contratos` (empréstimos ativos) |

Os escopos são definidos na criação e podem ser editados a qualquer momento no painel. Se a chave **não** tiver o escopo `margens` ou `contratos`, o bloco correspondente simplesmente **não aparece** no JSON (a chave não recebe `null` — a chave é omitida).

---

## Endpoint

### `GET /api/external/v1/clientes/:cpf`

Consulta um cliente por CPF.

**Parâmetro de rota:**
- `:cpf` — CPF com ou sem máscara (ex: `12345678900` ou `123.456.789-00`). A API remove a máscara automaticamente.

---

### Resposta de sucesso `200`

Exemplo com chave que tem **todos** os escopos:

```json
{
  "cpf": "12345678900",
  "nome": "FULANO DE TAL",
  "nascimento": "1963-01-17",
  "situacao_funcional": "APOSENTADO",
  "orgao": "DPRF - DEPTO. DE POLICIA RODOVIARIA FEDERAL",
  "orgao_codigo": "30802",
  "convenio": "SIAPE",
  "margens": {
    "competencia": "2024-12",
    "global_35": {
      "bruta": 1500.00,
      "utilizada": 800.00,
      "saldo": 700.00
    },
    "cartao_credito_5": {
      "bruta": 250.00,
      "utilizada": 30.00,
      "saldo": 220.00,
      "limitado_por_global": false
    },
    "cartao_beneficio_5": {
      "bruta": 250.00,
      "utilizada": 0.00,
      "saldo": 250.00,
      "limitado_por_global": false
    },
    "total_70": {
      "bruta": 3500.00,
      "utilizada": 2200.00,
      "saldo": 1300.00
    },
    "salario_bruto": 5000.00,
    "salario_liquido": 2800.00
  },
  "contratos": [
    {
      "tipo": "EMPRESTIMO CONSIGNADO",
      "banco": "BANCO DO BRASIL",
      "valor_parcela": 320.00,
      "saldo_devedor": 8500.00,
      "parcelas_restantes": 36,
      "numero_contrato": "123456789",
      "competencia": "2024-12"
    }
  ]
}
```

### Campos básicos

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `cpf` | string | CPF com 11 dígitos, sem máscara |
| `nome` | string | Nome do cliente |
| `nascimento` | string \| null | Data de nascimento no formato `YYYY-MM-DD` |
| `situacao_funcional` | string \| null | Ex: `ATIVO`, `APOSENTADO`, `PENSIONISTA` |
| `orgao` | string \| null | **Nome** do órgão (resolvido via nomenclaturas). Se o nome não estiver cadastrado, retorna o código |
| `orgao_codigo` | string \| null | Código bruto do órgão (ex: `30802`) |
| `convenio` | string \| null | Ex: `SIAPE` |

> **Nota sobre margens:** `limitado_por_global: true` indica que o saldo de cartão 5% foi limitado ao saldo disponível da margem global (35%), conforme regra SIAPE. O valor em `saldo` já é o efetivo disponível.

---

### Respostas de erro

| Código | Descrição |
|--------|-----------|
| `400`  | CPF inválido (não tem 11 dígitos) |
| `401`  | API Key ausente ou inválida/desativada |
| `404`  | Cliente não encontrado |
| `429`  | Rate limit excedido (máximo **120 req/minuto** por chave) |
| `500`  | Erro interno |

Formato das respostas de erro:
```json
{ "error": "mensagem descritiva" }
```

---

## Exemplos

### cURL

```bash
curl -H "X-API-Key: sua_chave_aqui" \
  https://sistemacapital.com.br/api/external/v1/clientes/12345678900
```

### JavaScript (fetch)

```js
const resp = await fetch(
  "https://sistemacapital.com.br/api/external/v1/clientes/12345678900",
  { headers: { "X-API-Key": "sua_chave_aqui" } }
);
if (resp.status === 404) {
  // cliente não encontrado na base
} else if (resp.ok) {
  const data = await resp.json();
  // data.nome, data.orgao, data.margens (se a chave tiver o escopo), ...
}
```

---

## Observação sobre a base de clientes

A base de clientes do Capital CRM é **compartilhada**: a consulta retorna o cliente independentemente de qual ambiente o cadastrou, espelhando o comportamento da consulta interna do sistema. Uma chave válida consegue consultar qualquer CPF presente na base.

> Se for necessário restringir cada parceiro a um subconjunto isolado de clientes, isso exige uma mudança no servidor (filtro estrito por tenant) — fale com o time de desenvolvimento.
