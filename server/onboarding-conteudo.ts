// Conteúdo do Onboarding do Entrante — perguntas COM gabarito (server-side only).
// Os endpoints servem as perguntas sem o campo `correta`.
// RASCUNHO INICIAL — conteúdo editável pelo gestor/admin conforme a operação evoluir.

export interface OnboardingPergunta {
  id: number;
  pergunta: string;
  opcoes: string[];
  correta: number; // índice da opção correta
  nivel: "fundamental" | "avancado"; // sem experiência responde só as fundamentais
}

// ===== BLOCO 2 — Teste de nível de conhecimento =====
export const ONBOARDING_TESTE_PERGUNTAS: OnboardingPergunta[] = [
  {
    id: 1,
    pergunta: "O que é o crédito consignado?",
    opcoes: [
      "Um empréstimo em que a parcela é descontada direto da folha de pagamento ou do benefício",
      "Um cartão de crédito comum com limite alto",
      "Um financiamento de imóvel para servidores",
      "Um empréstimo que só pode ser usado para quitar dívidas",
    ],
    correta: 0,
    nivel: "fundamental",
  },
  {
    id: 2,
    pergunta: "Quem pode contratar crédito consignado?",
    opcoes: [
      "Qualquer pessoa com conta em banco",
      "Apenas quem tem carteira assinada em empresa privada",
      "Aposentados e pensionistas do INSS, servidores públicos e militares",
      "Somente quem nunca pegou empréstimo antes",
    ],
    correta: 2,
    nivel: "fundamental",
  },
  {
    id: 3,
    pergunta: "O que é a margem consignável?",
    opcoes: [
      "O lucro do banco em cada contrato",
      "A parte da renda do cliente que pode ser comprometida com parcelas de consignado",
      "A taxa de juros máxima permitida",
      "O valor mínimo de empréstimo que o banco aceita",
    ],
    correta: 1,
    nivel: "fundamental",
  },
  {
    id: 4,
    pergunta: "Por que a taxa do consignado costuma ser menor que a de outros empréstimos?",
    opcoes: [
      "Porque o governo paga parte dos juros",
      "Porque o desconto é automático na folha/benefício, o que reduz o risco de calote",
      "Porque os bancos são obrigados a dar prejuízo nesse produto",
      "Porque só clientes ricos podem contratar",
    ],
    correta: 1,
    nivel: "fundamental",
  },
  {
    id: 5,
    pergunta: "O que é a PORTABILIDADE de consignado?",
    opcoes: [
      "Pegar um empréstimo novo por cima do que já existe",
      "Transferir o contrato que o cliente já tem para outro banco com taxa menor",
      "Mudar a data de vencimento da parcela",
      "Aumentar a margem consignável do cliente",
    ],
    correta: 1,
    nivel: "fundamental",
  },
  {
    id: 6,
    pergunta: "Qual é o principal benefício da portabilidade para o cliente?",
    opcoes: [
      "Receber dinheiro novo imediatamente",
      "Parcela menor e/ou sobra de margem, sem se endividar mais",
      "Cancelar o empréstimo sem pagar nada",
      "Aumentar o prazo sem mudar a taxa",
    ],
    correta: 1,
    nivel: "fundamental",
  },
  {
    id: 7,
    pergunta: "No PRIMEIRO contato pelo WhatsApp, o que você NÃO deve fazer?",
    opcoes: [
      "Se identificar com nome e empresa",
      "Chamar o cliente pelo nome",
      "Mandar um textão com promessas exageradas do tipo 'dinheiro fácil garantido'",
      "Fazer uma pergunta curta para abrir conversa",
    ],
    correta: 2,
    nivel: "fundamental",
  },
  {
    id: 8,
    pergunta: "O que é o 'troco' quando falamos de portabilidade com refinanciamento?",
    opcoes: [
      "A comissão do corretor",
      "O valor que o cliente paga a mais ao banco antigo",
      "A diferença liberada em dinheiro ao cliente quando o novo contrato supera o saldo devedor",
      "O desconto na primeira parcela",
    ],
    correta: 2,
    nivel: "avancado",
  },
  {
    id: 9,
    pergunta: "O que é o CET de um contrato?",
    opcoes: [
      "Custo Efetivo Total — a taxa de juros somada a todos os encargos do contrato",
      "Cadastro Especial de Tomadores",
      "O prazo máximo do contrato",
      "A margem que sobra depois da parcela",
    ],
    correta: 0,
    nivel: "avancado",
  },
  {
    id: 10,
    pergunta: "Para portar um contrato, o que é preciso obter do banco atual do cliente?",
    opcoes: [
      "Uma carta de recomendação",
      "O saldo devedor atualizado do contrato (via banco de origem)",
      "O extrato dos últimos 5 anos",
      "A senha do aplicativo do cliente",
    ],
    correta: 1,
    nivel: "avancado",
  },
];

// ===== BLOCO 3 — Compreensão dos exemplos de abordagem =====
// As perguntas referenciam os exemplos de shared/academia-conteudo.ts (ONBOARDING_EXEMPLOS_PORTABILIDADE)
export const ONBOARDING_COMPREENSAO_PERGUNTAS: OnboardingPergunta[] = [
  {
    id: 101,
    pergunta: "Por que o Exemplo 1 (abertura recomendada) tende a gerar resposta?",
    opcoes: [
      "Porque promete dinheiro rápido",
      "Porque é curto, usa o nome do cliente, traz um benefício concreto e termina com pergunta simples",
      "Porque usa muitos emojis e letras maiúsculas",
      "Porque pressiona o cliente com urgência",
    ],
    correta: 1,
    nivel: "fundamental",
  },
  {
    id: 102,
    pergunta: "Qual é o principal erro do Exemplo 3 (abordagem ruim)?",
    opcoes: [
      "Ser curto demais",
      "Não usar emoji",
      "Textão com promessa vaga, urgência falsa e sem identificação — cara de golpe",
      "Chamar o cliente pelo nome",
    ],
    correta: 2,
    nivel: "fundamental",
  },
  {
    id: 103,
    pergunta: "Por que dizer 'sem pegar dinheiro novo' ajuda na abordagem de portabilidade?",
    opcoes: [
      "Porque reduz o medo do cliente de se endividar mais — a portabilidade só melhora o contrato que ele já tem",
      "Porque é uma exigência legal",
      "Porque impede o cliente de pedir simulação",
      "Porque esconde o valor da parcela",
    ],
    correta: 0,
    nivel: "fundamental",
  },
  {
    id: 104,
    pergunta: "O cliente responde: 'Quem é você? Como conseguiu meu número?'. Qual a melhor reação?",
    opcoes: [
      "Ignorar a pergunta e mandar a simulação",
      "Se identificar de novo com calma (nome, empresa), explicar o motivo do contato e se colocar à disposição",
      "Dizer que é do banco dele para ganhar confiança",
      "Apagar a mensagem e partir para o próximo",
    ],
    correta: 1,
    nivel: "fundamental",
  },
  {
    id: 105,
    pergunta: "O cliente diz 'não tenho interesse'. O que fazer?",
    opcoes: [
      "Insistir com mais 5 mensagens seguidas",
      "Responder de forma agressiva",
      "Respeitar, agradecer e deixar a porta aberta ('qualquer coisa estou por aqui') — e registrar no sistema",
      "Bloquear o cliente",
    ],
    correta: 2,
    nivel: "fundamental",
  },
  {
    id: 106,
    pergunta: "O cliente pergunta 'quanto fica minha parcela?'. Qual a atitude correta?",
    opcoes: [
      "Chutar um valor baixo para prender o cliente",
      "Prometer a menor taxa do mercado",
      "Explicar que precisa de alguns dados para fazer a simulação real e pedir os dados na sequência",
      "Mandar ele ligar para o banco",
    ],
    correta: 2,
    nivel: "fundamental",
  },
];

/** Filtra as perguntas conforme a experiência declarada do entrante. */
export function perguntasParaPerfil(
  perguntas: OnboardingPergunta[],
  experienciaDeclarada: boolean | null | undefined,
): OnboardingPergunta[] {
  if (experienciaDeclarada) return perguntas; // experiente responde tudo
  return perguntas.filter((p) => p.nivel === "fundamental");
}

/** Classifica o baseline a partir do percentual de acertos. */
export function classificarBaseline(percentual: number): string {
  if (percentual >= 80) return "avancado";
  if (percentual >= 50) return "tem_nocao";
  return "cru";
}
