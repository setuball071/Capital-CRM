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

A chave é gerada no painel em **Administração → API Keys Externas** e exibida apenas uma vez no momento da criação. Guarde-a com segurança.

---

## Endpoint

### `GET /api/external/v1/clientes/:cpf`

Consulta um cliente por CPF e retorna dados básicos, margens e contratos.

**Parâmetro de rota:**
- `:cpf` — CPF com ou sem máscara (ex: `12345678900` ou `123.456.789-00`)

---

### Resposta de sucesso `200`

```json
{
  "cpf": "12345678900",
  "nome": "FULANO DE TAL",
  "convenio": "SIAPE",
  "orgao": "MINISTÉRIO DA EDUCAÇÃO",
  "sit_func": "ATIVO",
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

> **Nota sobre margens:** o campo `limitado_por_global: true` indica que o saldo de cartão 5% foi limitado ao saldo disponível da margem global (35%), conforme regra SIAPE. O valor já retornado em `saldo` é o valor efetivo disponível.

---

### Respostas de erro

| Código | Descrição |
|--------|-----------|
| `400`  | CPF inválido |
| `401`  | API Key ausente ou inválida/desativada |
| `404`  | Cliente não encontrado no ambiente desta chave |
| `429`  | Rate limit excedido (máximo 120 req/minuto por chave) |
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
const data = await resp.json();
```

---

## Isolamento multi-tenant

Cada API Key está vinculada a um ambiente específico do CRM. A consulta retorna somente clientes presentes naquele ambiente — nunca dados de outros clientes/tenants.
