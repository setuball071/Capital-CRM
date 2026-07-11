// Conteúdo do Onboarding do Entrante — perguntas COM gabarito (server-side only).
// Os endpoints servem as perguntas sem o campo `correta`.
// Conteúdo editável pelo gestor/admin conforme a operação evoluir.
//
// NOTA de design das alternativas: o tamanho e a posição da resposta correta
// variam de propósito — a correta NÃO é sempre a mais longa nem a mais completa.
// Ao editar, mantenha distratores plausíveis e evite padrões detectáveis.

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
      "Um financiamento exclusivo para compra de imóveis.",
      "Empréstimo com a parcela descontada direto da folha ou do benefício.",
      "Um cartão de crédito com limite alto e anuidade reduzida para servidores públicos e aposentados.",
      "Uma linha de crédito sem juros.",
    ],
    correta: 1,
    nivel: "fundamental",
  },
  {
    id: 2,
    pergunta: "A margem consignável é:",
    opcoes: [
      "Um limite que o próprio corretor define conforme a negociação que faz com cada cliente.",
      "O lucro do banco na operação.",
      "A parte da renda que pode ser comprometida com parcelas de consignado.",
      "O valor mínimo de empréstimo que o banco aceita.",
    ],
    correta: 2,
    nivel: "fundamental",
  },
  {
    id: 3,
    pergunta: "Como o corretor pode INICIAR a prospecção no nosso sistema?",
    opcoes: [
      "Apenas disparando mensagens em massa no WhatsApp, que é o canal padrão da operação.",
      "Por Lista Manual ou pelo discador automático.",
      "Somente por e-mail.",
      "Esperando o cliente entrar em contato primeiro.",
    ],
    correta: 1,
    nivel: "fundamental",
  },
  {
    id: 4,
    pergunta: "Ao se conectar ao discador automático, o corretor:",
    opcoes: [
      "Precisa discar manualmente número por número.",
      "Só pode atender por WhatsApp.",
      "Fica impedido de registrar o atendimento no CRM enquanto a ligação estiver ativa.",
      "Recebe as ligações atendidas e consulta o cliente direto no CRM.",
    ],
    correta: 3,
    nivel: "fundamental",
  },
  {
    id: 5,
    pergunta: "Para quem está começando, o que costuma dar mais ritmo de atendimento?",
    opcoes: [
      "O discador automático.",
      "Envio de e-mail marketing segmentado por convênio e faixa de renda.",
      "Esperar indicações de outros clientes.",
      "Fazer visitas presenciais.",
    ],
    correta: 0,
    nivel: "fundamental",
  },
  {
    id: 6,
    pergunta: "Qual é a meta diária de abordagens?",
    opcoes: [
      "100 por dia, mas exclusivamente pelo WhatsApp oficial da empresa.",
      "50 por semana.",
      "100 por dia, em qualquer canal — ligação, WhatsApp ou os dois.",
      "Não existe meta definida.",
    ],
    correta: 2,
    nivel: "fundamental",
  },
  {
    id: 7,
    pergunta: "O que é a portabilidade de consignado?",
    opcoes: [
      "Renegociar a dívida direto com o banco de origem, mudando apenas o vencimento das parcelas.",
      "Pegar um empréstimo novo por cima do atual.",
      "Cancelar o contrato sem custo.",
      "Transferir o contrato atual para um banco com taxa menor.",
    ],
    correta: 3,
    nivel: "fundamental",
  },
  {
    id: 8,
    pergunta: "Qual é a nossa estratégia comercial com a portabilidade?",
    opcoes: [
      "Usá-la como porta de entrada: reduzir taxa e parcela, liberar margem e usar essa margem para crédito novo sem aumentar o custo mensal do cliente.",
      "Oferecer o máximo de crédito possível em todas as operações, mesmo que isso aumente bastante o valor que o cliente paga todo mês.",
      "Portar apenas contratos de valor alto.",
      "Evitar falar de crédito novo com o cliente.",
    ],
    correta: 0,
    nivel: "avancado",
  },
  {
    id: 9,
    pergunta: "O que é a Minha Carteira?",
    opcoes: [
      "Uma lista descartável de leads frios.",
      "A área com os clientes que você conquistou — fonte de novos contatos, indicações e pós-venda.",
      "Uma área visível apenas para o gestor, que decide quando o corretor pode consultá-la.",
      "O extrato de comissões do corretor.",
    ],
    correta: 1,
    nivel: "fundamental",
  },
  {
    id: 10,
    pergunta: "No nosso modelo de Customer Success, concluir a operação significa que o corretor:",
    opcoes: [
      "Encerra o relacionamento com o cliente.",
      "Transfere o cliente para outro consultor.",
      "Continua responsável pelo relacionamento — pós-venda, recompra e indicações.",
      "Só volta a falar com o cliente se ele reclamar de algum problema na operação.",
    ],
    correta: 2,
    nivel: "avancado",
  },
];

// ===== BLOCO 3 — Compreensão dos exemplos de abordagem =====
// As perguntas referenciam os exemplos de shared/academia-conteudo.ts (ONBOARDING_EXEMPLOS_PORTABILIDADE)
export const ONBOARDING_COMPREENSAO_PERGUNTAS: OnboardingPergunta[] = [
  {
    id: 101,
    pergunta: "Por que o exemplo recomendado tende a gerar resposta?",
    opcoes: [
      "Porque garante ao cliente que ele vai receber um valor alto na conta ainda hoje, sem qualquer análise.",
      "Porque é claro, cita benefícios concretos e convida para uma simulação.",
      "Porque usa muitos emojis.",
      "Porque pressiona o cliente com urgência.",
    ],
    correta: 1,
    nivel: "fundamental",
  },
  {
    id: 102,
    pergunta: "Qual é o principal erro da abordagem 'ruim' (textão em caixa alta com emojis)?",
    opcoes: [
      "É curta demais.",
      "Usa o nome do cliente.",
      "Não cita a taxa exata.",
      "Parece golpe: promessa exagerada, urgência falsa e nenhuma identificação.",
    ],
    correta: 3,
    nivel: "fundamental",
  },
  {
    id: 103,
    pergunta: "Na abordagem de portabilidade, o que devemos destacar?",
    opcoes: [
      "Que o cliente vai ficar livre de dívidas para sempre.",
      "Que é uma oferta relâmpago que expira hoje e não pode ser perdida de jeito nenhum.",
      "Reduzir parcela e taxa e liberar margem — que pode virar valor em conta sem aumentar o custo mensal.",
      "Que não há análise de crédito.",
    ],
    correta: 2,
    nivel: "fundamental",
  },
  {
    id: 104,
    pergunta: "Cliente responde: 'Quem é você? Como conseguiu meu número?'. Qual a melhor reação?",
    opcoes: [
      "Se identificar com calma, explicar a origem do contato e se colocar à disposição.",
      "Ignorar a pergunta e mandar logo a simulação com os valores para não perder o timing da conversa.",
      "Dizer que é do banco dele para ganhar confiança.",
      "Encerrar a conversa e partir para o próximo.",
    ],
    correta: 0,
    nivel: "fundamental",
  },
  {
    id: 105,
    pergunta: "O cliente diz 'não tenho interesse'. O que fazer?",
    opcoes: [
      "Insistir com várias mensagens seguidas.",
      "Rebater dizendo que ele está perdendo a melhor oportunidade financeira da vida dele.",
      "Bloquear o contato.",
      "Respeitar, agradecer, deixar a porta aberta e registrar no sistema.",
    ],
    correta: 3,
    nivel: "fundamental",
  },
  {
    id: 106,
    pergunta: "O cliente pergunta 'quanto fica minha parcela?'. Qual a atitude correta?",
    opcoes: [
      "Chutar o menor valor possível para prender o cliente na conversa até conseguir os documentos.",
      "Explicar que precisa de alguns dados para fazer a simulação real e pedi-los na sequência.",
      "Prometer a menor taxa do país.",
      "Mandar ele ligar para o banco.",
    ],
    correta: 1,
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
