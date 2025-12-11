export interface Licao {
  id: string;
  titulo: string;
  resumo: string;
  conteudo: string;
  atividadePratica: string;
}

export interface Nivel {
  id: number;
  nome: string;
  descricao: string;
  icone: string;
  licoes: Licao[];
}

export const NIVEIS_ACADEMIA: Nivel[] = [
  {
    id: 1,
    nome: "Descoberta",
    descricao: "Aprenda a iniciar conversas e criar conexão com o cliente",
    icone: "Search",
    licoes: [
      {
        id: "1.1",
        titulo: "Apresentação cordial e criação de rapport",
        resumo: "Como se apresentar de forma profissional e criar uma conexão inicial",
        conteudo: `## Apresentação Cordial e Criação de Rapport

A primeira impressão é fundamental no atendimento consultivo. O rapport é a técnica de criar uma conexão genuína com o cliente.

### Elementos de uma boa apresentação:
- **Cumprimento caloroso**: "Bom dia! Tudo bem com o senhor(a)?"
- **Identificação clara**: Diga seu nome e empresa
- **Tom de voz**: Calmo, confiante e amigável
- **Interesse genuíno**: Pergunte como está o dia do cliente

### Exemplo de abertura:
> "Bom dia, [nome do cliente]! Aqui é o João da ConsigOne. Tudo bem por aí? Espero que esteja tendo um ótimo dia! Estou entrando em contato porque identifiquei uma oportunidade que pode ser muito interessante para você..."

### Erros comuns a evitar:
- Começar vendendo direto
- Falar rápido demais
- Não se identificar corretamente
- Parecer robotizado ou ler um script`,
        atividadePratica: "Escreva sua abertura ideal para uma ligação. Inclua cumprimento, identificação e uma frase de conexão.",
      },
      {
        id: "1.2",
        titulo: "Perguntas abertas para entender o cenário do cliente",
        resumo: "Técnicas para descobrir a real situação financeira do cliente",
        conteudo: `## Perguntas Abertas para Entender o Cenário

Perguntas abertas não podem ser respondidas com "sim" ou "não". Elas incentivam o cliente a falar sobre sua situação.

### Tipos de perguntas abertas:
- **Situacionais**: "Como está sua situação financeira atual?"
- **Exploratórias**: "O que mais te preocupa em relação às suas contas?"
- **De contexto**: "Como você está se organizando para pagar as parcelas?"

### Exemplos práticos:
- "Me conta um pouco sobre os empréstimos que você tem atualmente..."
- "O que te fez pensar em buscar uma alternativa agora?"
- "Como está impactando no seu dia a dia esses compromissos?"

### Dica importante:
Escute ativamente! Anote as informações importantes e use-as na sua argumentação.`,
        atividadePratica: "Liste 5 perguntas abertas que você usaria para entender a situação de um cliente com dívidas.",
      },
      {
        id: "1.3",
        titulo: "Identificação de dores e necessidades",
        resumo: "Como identificar o que realmente incomoda o cliente",
        conteudo: `## Identificação de Dores e Necessidades

A "dor" é o problema real que tira o sono do cliente. Identificá-la é a chave para uma venda consultiva.

### Dores comuns no consignado:
- **Financeira**: Parcela muito alta, juros abusivos
- **Emocional**: Estresse, ansiedade, vergonha
- **Prática**: Nome negativado, não consegue crédito
- **Familiar**: Brigas por dinheiro, não consegue ajudar filhos

### Técnicas para identificar dores:
1. **Aprofunde**: "Você mencionou que está apertado... me conta mais sobre isso"
2. **Quantifique**: "Quanto isso representa no seu orçamento?"
3. **Emocionalize**: "Como você se sente em relação a isso?"

### Exemplo de diálogo:
> Cliente: "Minha parcela está muito alta"
> Corretor: "Entendo... e como isso está afetando seu dia a dia? Você consegue fazer outras coisas que gostaria?"`,
        atividadePratica: "Descreva 3 dores comuns de clientes e como você exploraria cada uma delas.",
      },
      {
        id: "1.4",
        titulo: "Entendendo contratos ativos e margens",
        resumo: "Como analisar a situação dos contratos do cliente",
        conteudo: `## Entendendo Contratos Ativos e Margens

Para fazer uma proposta assertiva, você precisa entender a situação contratual do cliente.

### Informações essenciais:
- **Margem consignável**: Quanto pode comprometer do salário (30% + 5% cartão)
- **Contratos ativos**: Banco, valor da parcela, saldo devedor
- **Parcelas restantes**: Quantas parcelas ainda faltam

### Como perguntar sobre contratos:
- "Você sabe quantos empréstimos tem ativos hoje?"
- "Lembra quanto está pagando por mês no total?"
- "Tem ideia de quanto ainda deve nesses contratos?"

### Cálculo básico de oportunidade:
Se o cliente paga R$ 800/mês em parcelas e a margem permite R$ 1.000, há R$ 200 de margem disponível para trabalhar.

### Dica importante:
Muitos clientes não sabem exatamente sua situação. Ofereça-se para ajudar: "Posso consultar para você sem compromisso"`,
        atividadePratica: "Simule uma conversa onde você descobre que o cliente tem 3 contratos ativos. Que perguntas faria?",
      },
      {
        id: "1.5",
        titulo: "Definindo objetivos da simulação",
        resumo: "Como estabelecer metas claras para a proposta",
        conteudo: `## Definindo Objetivos da Simulação

Antes de fazer qualquer simulação, você precisa ter clareza do objetivo.

### Tipos de objetivos:
1. **Redução de parcela**: Cliente quer pagar menos por mês
2. **Dinheiro no bolso**: Cliente precisa de valor em mãos
3. **Quitação de dívidas**: Cliente quer limpar o nome
4. **Troca de banco**: Cliente insatisfeito com taxas

### Perguntas para definir objetivo:
- "O que seria mais importante para você: reduzir o valor mensal ou ter um dinheiro extra?"
- "Se eu conseguisse liberar um valor para você, quanto precisaria?"
- "Qual seria o valor ideal de parcela para caber no seu orçamento?"

### Exemplo de fechamento da descoberta:
> "Então, [nome], pelo que entendi, o mais importante para você é reduzir a parcela e ainda colocar uns R$ 2.000 no bolso para pagar aquela conta do cartão, certo? Vou fazer uma simulação focada nisso!"

### Regra de ouro:
Nunca faça simulação sem antes entender o que o cliente realmente precisa.`,
        atividadePratica: "Escreva como você resumiria a situação de um cliente que quer reduzir parcela e ter dinheiro para quitar o cartão.",
      },
    ],
  },
  {
    id: 2,
    nome: "Explicação",
    descricao: "Aprenda a explicar produtos de forma clara e consultiva",
    icone: "BookOpen",
    licoes: [
      {
        id: "2.1",
        titulo: "Como funciona a compra de dívida",
        resumo: "Explicação didática do produto principal",
        conteudo: `## Como Funciona a Compra de Dívida

A compra de dívida (portabilidade com troco) é o produto mais vantajoso para clientes com contratos ativos.

### O que é:
Um banco "compra" os contratos do cliente de outros bancos, quita tudo e refaz um novo contrato.

### Benefícios para o cliente:
- **Taxa menor**: Geralmente conseguimos taxas melhores
- **Parcela reduzida**: Paga menos por mês
- **Dinheiro no bolso**: Diferença vai para o cliente
- **Simplificação**: De vários contratos para um só

### Como explicar para o cliente:
> "Funciona assim: eu vou pegar todos os seus empréstimos, quitar eles com um banco parceiro nosso que tem uma taxa melhor, e a diferença que sobrar vai direto para a sua conta. Você vai sair pagando menos e ainda com dinheiro no bolso!"

### Exemplo numérico:
- Cliente paga: R$ 1.200/mês (saldo devedor R$ 30.000)
- Novo contrato: R$ 900/mês (contrato de R$ 35.000)
- Resultado: -R$ 300/mês + R$ 5.000 no bolso`,
        atividadePratica: "Explique a compra de dívida para um cliente como se ele nunca tivesse ouvido falar disso.",
      },
      {
        id: "2.2",
        titulo: "Explicando o cartão de crédito consignado",
        resumo: "Benefícios e funcionamento do cartão consignado",
        conteudo: `## Cartão de Crédito Consignado

O cartão consignado é uma excelente opção para clientes que precisam de limite disponível com baixo custo.

### Diferenças do cartão normal:
- **Desconto em folha**: Pagamento automático, sem atrasos
- **Taxa muito menor**: Juros até 5x menores que cartão convencional
- **Limite alto**: Pode chegar a 10x a margem disponível
- **Saque**: Permite sacar parte do limite

### Como explicar:
> "É um cartão de crédito, mas com uma grande vantagem: o pagamento vem descontado direto do seu contracheque. Por isso, os juros são muito mais baixos e você nunca atrasa!"

### Público ideal:
- Quem tem cartão de crédito com parcelas altas
- Quem precisa de limite para emergências
- Quem quer trocar dívida cara por barata

### Cálculo de limite:
Margem de 5% x multiplicador do banco = limite disponível
Ex: R$ 200 margem x 10 = R$ 2.000 de limite`,
        atividadePratica: "Um cliente pergunta: 'Mas eu já tenho cartão, por que preciso desse?' - Como você responderia?",
      },
      {
        id: "2.3",
        titulo: "Explicando o cartão benefício",
        resumo: "Diferenças e vantagens do cartão benefício INSS",
        conteudo: `## Cartão Benefício (RMC)

O Cartão Benefício é específico para aposentados e pensionistas do INSS.

### O que é:
Um cartão consignado que usa a margem específica do RMC (Reserva de Margem Consignável).

### Vantagens:
- **Margem separada**: Não usa a margem de empréstimo
- **Limite com saque**: Permite sacar até 70% do limite
- **Taxas baixas**: Menores que cartão convencional
- **Facilidade**: Aprovação rápida para beneficiários

### Como explicar:
> "Esse cartão é especial para quem recebe do INSS. Ele não mexe na sua margem de empréstimo normal, então você pode ter os dois! E o melhor: pode sacar boa parte do limite direto na conta."

### Pontos de atenção:
- Verificar se o beneficiário está apto
- Alguns benefícios não permitem (BPC/LOAS tem restrições)
- Margem RMC é de 5% do benefício`,
        atividadePratica: "Explique a diferença entre cartão consignado normal e cartão benefício para um aposentado.",
      },
      {
        id: "2.4",
        titulo: "Linguagem simples e sem jargões",
        resumo: "Como adaptar sua comunicação ao cliente",
        conteudo: `## Linguagem Simples e Sem Jargões

O cliente não é do mercado financeiro. Use palavras que ele entenda.

### Tradução de termos técnicos:
- **Portabilidade** → "Trocar de banco"
- **Coeficiente** → "Taxa do banco"
- **Margem consignável** → "O quanto pode descontar do seu salário"
- **Saldo devedor** → "Quanto ainda deve"
- **Refinanciamento** → "Refazer o contrato"

### Dicas de comunicação:
1. **Evite siglas**: Em vez de "RMC", diga "margem do cartão"
2. **Use comparações**: "É como trocar uma dívida cara por uma barata"
3. **Confirme entendimento**: "Ficou claro até aqui?"
4. **Repita pontos importantes**: "O principal é: você vai pagar menos"

### Exemplo de simplificação:
❌ "Vamos fazer uma portabilidade com refinanciamento utilizando seu saldo devedor para gerar troco"
✅ "Vamos trocar seu empréstimo para um banco com taxa menor e você ainda vai receber um dinheiro extra"`,
        atividadePratica: "Reescreva esta frase em linguagem simples: 'A portabilidade com troco utiliza o saldo devedor remanescente para gerar valor líquido ao mutuário'",
      },
      {
        id: "2.5",
        titulo: "Gerando confiança com informação",
        resumo: "Como ser transparente gera mais vendas",
        conteudo: `## Gerando Confiança com Informação

Transparência é o melhor caminho para fechar vendas de qualidade.

### Por que ser transparente:
- Cliente informado toma melhores decisões
- Reduz cancelamentos e reclamações
- Gera indicações naturais
- Constrói relacionamento de longo prazo

### O que sempre explicar:
1. **Prazo do contrato**: Quantas parcelas vai pagar
2. **Valor total**: Quanto vai pagar ao final
3. **Taxa aplicada**: Qual o custo do dinheiro
4. **Comissão**: Não tenha medo de dizer que ganha

### Frases que geram confiança:
- "Vou te explicar tudo em detalhes antes de você decidir"
- "Se não for bom pra você, não vale pra mim também"
- "Minha comissão vem do banco, não de você"
- "Você pode pensar e me ligar depois, sem pressão"

### Clientes bem informados:
- Fecham mais rápido
- Reclamam menos
- Indicam mais
- Voltam a fazer negócio`,
        atividadePratica: "Escreva 3 frases que você usaria para mostrar transparência ao cliente sobre os custos da operação.",
      },
    ],
  },
  {
    id: 3,
    nome: "Oferta",
    descricao: "Aprenda a apresentar propostas de forma persuasiva",
    icone: "Gift",
    licoes: [
      {
        id: "3.1",
        titulo: "Apresentando a simulação de forma clara",
        resumo: "Como mostrar os números de forma impactante",
        conteudo: `## Apresentando a Simulação de Forma Clara

A forma como você apresenta a simulação faz toda a diferença no fechamento.

### Estrutura da apresentação:
1. **Situação atual**: "Hoje você paga R$ 1.200"
2. **Nova situação**: "Com a nossa proposta, vai pagar R$ 800"
3. **Benefício**: "São R$ 400 de economia todo mês!"
4. **Extra**: "E ainda vai receber R$ 5.000 na conta"

### Técnica do contraste:
Sempre compare o ANTES e o DEPOIS de forma visual ou numérica.

### Exemplo de apresentação:
> "Olha só o que consegui para você: Hoje você paga R$ 1.200 por mês nesses 3 empréstimos. Na nossa proposta, você passa a pagar apenas R$ 800. São R$ 400 a menos TODO MÊS! E o melhor: você ainda vai receber R$ 5.000 na sua conta em até 5 dias úteis!"

### Dica importante:
Deixe o cliente processar a informação. Faça uma pausa após apresentar os números.`,
        atividadePratica: "Crie uma apresentação de simulação para um cliente que vai reduzir de R$ 900 para R$ 600 e receber R$ 3.000.",
      },
      {
        id: "3.2",
        titulo: "Destacando benefícios vs. características",
        resumo: "A diferença entre falar do produto e falar do cliente",
        conteudo: `## Destacando Benefícios vs. Características

Características são do produto. Benefícios são para o cliente.

### Exemplos:
| Característica | Benefício |
|---------------|-----------|
| Taxa de 1,8% a.m. | "Você vai pagar muito menos juros" |
| Prazo de 84 meses | "Parcela que cabe no seu bolso" |
| Crédito em 5 dias | "Dinheiro rápido quando você precisa" |
| Desconto em folha | "Você nunca atrasa e não paga multa" |

### Como transformar:
Sempre pergunte "E daí?" após uma característica.
- "Taxa menor" → E daí? → "Você economiza dinheiro"
- "Prazo longo" → E daí? → "Parcela menor, sobra mais"

### Fórmula:
"Isso significa que você vai [BENEFÍCIO CONCRETO]"

### Exemplo:
> "Nossa taxa é a menor do mercado. Isso significa que você vai economizar mais de R$ 5.000 ao longo do contrato comparado com outros bancos!"`,
        atividadePratica: "Transforme estas características em benefícios: 1) Aprovação em 24h, 2) Sem consulta ao SPC, 3) Atendimento online",
      },
      {
        id: "3.3",
        titulo: "Personalizando a proposta ao cliente",
        resumo: "Como usar as informações da descoberta na oferta",
        conteudo: `## Personalizando a Proposta ao Cliente

Use as informações que você descobriu para personalizar sua proposta.

### Conecte com as dores:
Se o cliente disse que está "sufocado", use:
> "Com essa redução de R$ 400, você vai poder respirar mais tranquilo no final do mês"

### Conecte com os sonhos:
Se o cliente mencionou que quer ajudar os filhos:
> "Com esses R$ 5.000, você já pode ajudar na faculdade do seu filho como queria"

### Use o nome do cliente:
> "Maria, essa proposta foi feita pensando exatamente no que você me disse precisar"

### Relembre o objetivo:
> "Você me disse que o mais importante era reduzir a parcela e ter um dinheiro extra. Olha só: consegui as duas coisas!"

### Dica:
Anote tudo que o cliente diz na descoberta e use na hora da oferta.`,
        atividadePratica: "O cliente disse que precisa de dinheiro para reformar a casa. Como você personalizaria a oferta usando essa informação?",
      },
      {
        id: "3.4",
        titulo: "Técnicas de ancoragem de valor",
        resumo: "Como fazer o cliente perceber o valor real da proposta",
        conteudo: `## Técnicas de Ancoragem de Valor

Ancoragem é apresentar um valor de referência para que o real pareça mais atrativo.

### Tipos de ancoragem:

**1. Ancoragem de economia:**
> "Se você continuar pagando R$ 400 a mais por mês, em um ano são R$ 4.800 jogados fora!"

**2. Ancoragem de comparação:**
> "No banco X você pagaria R$ 1.100. Com a gente, R$ 800. É como ganhar R$ 300 todo mês"

**3. Ancoragem de valor total:**
> "Esses R$ 5.000 que você vai receber equivalem a quase 2 salários mínimos!"

**4. Ancoragem temporal:**
> "São R$ 400 de economia por mês. Em 12 meses, são R$ 4.800. Em 24 meses, quase R$ 10.000!"

### Regra:
Sempre coloque em perspectiva. Números soltos não impactam tanto quanto números contextualizados.`,
        atividadePratica: "Crie 3 frases de ancoragem para uma proposta que economiza R$ 250/mês e libera R$ 4.000.",
      },
      {
        id: "3.5",
        titulo: "Chamada para ação clara",
        resumo: "Como conduzir o cliente para o fechamento",
        conteudo: `## Chamada para Ação Clara

Após apresentar a proposta, você precisa conduzir o próximo passo.

### Tipos de chamada para ação:

**1. Fechamento direto:**
> "Vamos fazer? Só preciso de alguns dados para formalizar"

**2. Fechamento assumido:**
> "Vou preparar o contrato. Você prefere receber por e-mail ou WhatsApp?"

**3. Fechamento com urgência:**
> "Essa condição é válida até amanhã. Quer garantir agora?"

**4. Fechamento com alternativa:**
> "Você prefere a proposta de R$ 800 ou a de R$ 750 com um prazo maior?"

### O que NÃO fazer:
- Terminar sem perguntar nada
- Dizer "pensa aí e me liga"
- Deixar a decisão 100% com o cliente

### Dica:
Sempre tenha o próximo passo definido. Seja ele fechar, agendar nova ligação ou enviar documentos.`,
        atividadePratica: "Escreva 3 formas diferentes de fazer a chamada para ação após apresentar uma proposta.",
      },
    ],
  },
  {
    id: 4,
    nome: "Objeções",
    descricao: "Aprenda a contornar objeções com maestria",
    icone: "Shield",
    licoes: [
      {
        id: "4.1",
        titulo: "Objeções mais comuns e como responder",
        resumo: "As 10 objeções que você mais vai ouvir",
        conteudo: `## Objeções Mais Comuns e Como Responder

Objeções são parte natural da venda. Não tenha medo delas!

### Top 10 objeções:

**1. "Vou pensar"**
> "Entendo! O que exatamente você gostaria de pensar melhor? Posso ajudar?"

**2. "Está caro"**
> "Comparado com o quê? Deixa eu te mostrar quanto você está pagando hoje..."

**3. "Não confio em banco"**
> "Concordo que alguns bancos já decepcionaram. Por isso trabalho só com os melhores. Posso te mostrar?"

**4. "Meu gerente cuida disso"**
> "Que bom que você tem alguém de confiança! Mas ele consegue taxas melhores que as do mercado? Posso comparar sem compromisso"

**5. "Já tenho empréstimo demais"**
> "Por isso mesmo! Minha proposta é justamente reduzir o que você paga. Posso te mostrar como?"

**6. "Não quero me endividar mais"**
> "Perfeito! Minha proposta não é nova dívida, é trocar uma dívida cara por uma barata"

**7. "Minha esposa/marido precisa ver"**
> "Faz todo sentido decidir juntos! Quando posso ligar para vocês dois?"

**8. "Outro corretor já me ligou"**
> "E o que ele ofereceu? Posso fazer uma proposta melhor?"

**9. "Não estou precisando agora"**
> "Entendo! Mas você sabia que está pagando R$ X a mais por mês do que precisaria?"

**10. "Vou falar com meu banco primeiro"**
> "Ótimo! Mas lembre: eu posso conseguir condições que seu gerente não consegue. Quer comparar?"`,
        atividadePratica: "Escolha 3 objeções da lista e escreva suas próprias respostas personalizadas.",
      },
      {
        id: "4.2",
        titulo: "Técnica LACE para objeções",
        resumo: "Um método estruturado para contornar qualquer objeção",
        conteudo: `## Técnica LACE para Objeções

LACE é uma sigla que ajuda a lembrar os passos para contornar objeções.

### L - Legitimar
Reconheça que a objeção é válida:
> "Entendo sua preocupação..."
> "Faz total sentido você pensar assim..."

### A - Aprofundar
Entenda melhor a objeção:
> "Me conta mais sobre isso..."
> "O que exatamente te preocupa?"

### C - Contornar
Responda à objeção real:
> "O que eu posso te mostrar é que..."
> "Na verdade, o que acontece é..."

### E - Encaminhar
Volte para o fechamento:
> "Então, com isso esclarecido, podemos seguir?"
> "Faz sentido para você?"

### Exemplo completo:
**Objeção**: "Está muito longo esse prazo"

**L**: "Entendo, 84 meses parece muito tempo mesmo..."
**A**: "O que te preocupa mais: o prazo ou o valor total?"
**C**: "Se eu te mostrar que mesmo em 84 meses você paga menos que pagaria em 48 no seu banco atual, faria sentido?"
**E**: "Vamos fazer assim: te mostro as duas opções e você escolhe a que preferir?"`,
        atividadePratica: "Aplique a técnica LACE para a objeção: 'Não quero desconto em folha, prefiro boleto'",
      },
      {
        id: "4.3",
        titulo: "Objeções de preço e taxa",
        resumo: "Como lidar quando o cliente acha caro",
        conteudo: `## Objeções de Preço e Taxa

Objeções de preço são as mais comuns. Saiba como lidar.

### "Está caro"
Pergunte: "Comparado com o quê?"
Geralmente o cliente não tem parâmetro. Mostre a comparação.

### "A taxa está alta"
> "Concordo que taxa é importante! Você sabe qual taxa está pagando hoje nos seus contratos? Posso te mostrar a diferença"

### "Outro banco ofereceu menos"
> "Ótimo! Você tem a proposta aí? Posso analisar se realmente é melhor ou se tem algo escondido"

### Técnica do custo-benefício:
> "Se eu te mostrar que mesmo com essa taxa você vai economizar R$ 400 por mês, ainda acha caro?"

### Técnica da perspectiva:
> "Essa taxa de 1,8% significa R$ 18 para cada R$ 1.000 emprestados. Você pagaria R$ 18 para ter R$ 1.000 agora?"

### Lembre-se:
Preço é objeção, valor é percepção. Mostre o VALOR da sua proposta.`,
        atividadePratica: "O cliente diz: 'Vi na internet taxa de 1,5%, a sua é 1,9%'. Como você responde?",
      },
      {
        id: "4.4",
        titulo: "Objeções de confiança",
        resumo: "Quando o cliente não confia no processo ou no corretor",
        conteudo: `## Objeções de Confiança

A falta de confiança é uma barreira real. Saiba como construí-la.

### "Não confio em corretor"
> "Entendo! Muita gente já teve experiência ruim. Por isso, deixa eu te explicar como trabalho: sou regularizado, você pode consultar meu registro, e só ganho se você fechar satisfeito"

### "Como sei que isso é real?"
> "Ótima pergunta! Posso te mandar o contrato para você ler antes. E você pode pesquisar o banco no Banco Central. Quer que eu envie?"

### "Parece bom demais"
> "Parece mesmo! Mas deixa eu te mostrar por que funciona: os bancos querem seu contrato e pagam bem por ele. Minha margem é do banco, não da sua taxa"

### Ferramentas de confiança:
- Mostre seu registro (CRECI, se tiver)
- Envie links do banco parceiro
- Ofereça o contrato para análise
- Dê referências de clientes (com autorização)

### Dica:
Não force. Cliente desconfiado precisa de tempo e informação.`,
        atividadePratica: "Um cliente diz: 'Vou consultar meu advogado antes'. Como você responderia de forma que aumente a confiança?",
      },
      {
        id: "4.5",
        titulo: "Transformando objeções em oportunidades",
        resumo: "Como usar objeções a seu favor",
        conteudo: `## Transformando Objeções em Oportunidades

Toda objeção esconde uma necessidade. Descubra qual é.

### Objeção como sinal de interesse:
Cliente que não tem interesse não faz objeção. Ele simplesmente desliga.

### Exemplos de transformação:

**Objeção**: "Prazo muito longo"
**Oportunidade**: Cliente se preocupa com compromisso. Mostre flexibilidade.
> "Posso te mostrar opções com prazo menor. O que seria ideal pra você?"

**Objeção**: "Quero ver com minha esposa"
**Oportunidade**: Decisão conjunta. Inclua-a na conversa.
> "Perfeito! Que tal eu ligar quando vocês dois estiverem juntos?"

**Objeção**: "Meu banco oferece taxa menor"
**Oportunidade**: Ele está comparando. Quer o melhor.
> "Ótimo que você pesquisa! Deixa eu ver se consigo cobrir..."

### Mentalidade correta:
Objeção não é rejeição. É pedido de mais informação.

### Regra de ouro:
Nunca discuta com o cliente. Concorde, entenda e redirecione.`,
        atividadePratica: "Liste 3 objeções que você já ouviu e identifique qual necessidade escondida cada uma revela.",
      },
    ],
  },
  {
    id: 5,
    nome: "Fechamento",
    descricao: "Domine as técnicas de conclusão de vendas",
    icone: "CheckCircle",
    licoes: [
      {
        id: "5.1",
        titulo: "Identificando sinais de compra",
        resumo: "Como saber que o cliente está pronto para fechar",
        conteudo: `## Identificando Sinais de Compra

O cliente dá sinais quando está pronto. Aprenda a identificá-los.

### Sinais verbais:
- "E quando eu recebo o dinheiro?"
- "Quais documentos preciso?"
- "Posso pagar antes do prazo?"
- "Minha esposa também pode fazer?"
- "E se eu precisar de mais depois?"

### Sinais comportamentais:
- Faz perguntas sobre detalhes
- Fica mais relaxado na conversa
- Concorda com seus pontos
- Pede para repetir valores
- Pergunta sobre próximos passos

### O que fazer quando identificar:
PARE de vender e comece a fechar!

### Exemplo:
> Cliente: "E o dinheiro cai em quanto tempo?"
> Você (ERRADO): "Então, como eu estava dizendo, os benefícios são..."
> Você (CERTO): "Em até 5 dias úteis! Vamos fazer? Só preciso confirmar alguns dados"`,
        atividadePratica: "Liste 5 perguntas que um cliente pode fazer que indicam que ele está pronto para fechar.",
      },
      {
        id: "5.2",
        titulo: "Técnicas de fechamento",
        resumo: "Métodos práticos para concluir a venda",
        conteudo: `## Técnicas de Fechamento

Existem várias formas de conduzir o fechamento. Conheça as principais.

### 1. Fechamento Direto
Simplesmente pergunte:
> "Vamos fazer?"
> "Posso enviar o contrato?"

### 2. Fechamento Alternativo
Dê duas opções (ambas positivas):
> "Você prefere receber o dinheiro nesta conta ou em outra?"
> "Quer assinar agora ou prefere amanhã de manhã?"

### 3. Fechamento Assumido
Aja como se o cliente já tivesse decidido:
> "Vou preparar os documentos. Qual seu e-mail?"
> "Perfeito! Vou enviar o contrato para assinatura"

### 4. Fechamento por Urgência
Crie senso de tempo (sempre verdadeiro!):
> "Essa taxa é válida até sexta. Quer garantir?"
> "Esse banco está com campanha só essa semana"

### 5. Fechamento por Resumo
Recapitule todos os benefícios:
> "Então, resumindo: você vai reduzir R$ 400, receber R$ 5.000, e trocar 3 empréstimos por 1. Vamos fechar?"

### Dica:
Teste diferentes técnicas e veja qual funciona melhor para você.`,
        atividadePratica: "Escreva um script de fechamento usando a técnica que você acha mais natural para seu estilo.",
      },
      {
        id: "5.3",
        titulo: "Superando a hesitação final",
        resumo: "O que fazer quando o cliente trava na última hora",
        conteudo: `## Superando a Hesitação Final

É comum o cliente hesitar na hora H. Saiba como lidar.

### Por que acontece:
- Medo de tomar decisão errada
- Falta de segurança
- Precisa de validação
- Última tentativa de negociar

### Técnicas para superar:

**1. Validação emocional:**
> "É normal sentir um pouco de receio. Mas lembra: você já pensou bastante e essa é a melhor opção"

**2. Minimização do risco:**
> "Se você não gostar, pode cancelar nos primeiros 7 dias sem custo nenhum"

**3. Projeção de futuro:**
> "Imagina daqui 30 dias, com R$ 5.000 na conta e pagando R$ 400 a menos. Faz sentido?"

**4. Prova social:**
> "Ontem fechei com um cliente em situação parecida. Ele me ligou hoje super satisfeito"

**5. Pequeno compromisso:**
> "Que tal a gente só preencher a proposta? Se você não gostar do contrato final, não assina"

### Nunca faça:
- Pressionar demais
- Ficar irritado
- Desistir fácil demais`,
        atividadePratica: "O cliente diz 'Vou pensar mais um pouquinho'. Escreva 3 formas diferentes de responder.",
      },
      {
        id: "5.4",
        titulo: "Coleta de dados e documentação",
        resumo: "Como coletar informações sem perder a venda",
        conteudo: `## Coleta de Dados e Documentação

A coleta de dados é delicada. Faça de forma fluida.

### Ordem sugerida:
1. Dados básicos (nome completo, CPF)
2. Dados de contato (telefone, e-mail)
3. Dados bancários (banco, agência, conta)
4. Documentos (RG, comprovante de renda)

### Como pedir naturalmente:
> "Perfeito! Para eu preparar sua proposta, preciso só confirmar alguns dados. Me fala seu CPF completo?"

### Dicas importantes:
- Peça um dado por vez
- Confirme cada informação
- Explique por que precisa ("para enviar o contrato")
- Tenha paciência com idosos
- Nunca demonstre pressa

### Se o cliente resistir:
> "Entendo sua preocupação com segurança! Esses dados são só para gerar a proposta. Você confere tudo no contrato antes de assinar, e pode cancelar se não gostar"

### Após coletar:
Recapitule e confirme:
> "Deixa eu confirmar: seu nome é José da Silva, CPF 123... está correto?"`,
        atividadePratica: "Crie um roteiro de coleta de dados que pareça uma conversa natural, não um interrogatório.",
      },
      {
        id: "5.5",
        titulo: "Pós-venda e indicações",
        resumo: "Como garantir satisfação e gerar novas vendas",
        conteudo: `## Pós-Venda e Indicações

A venda não termina na assinatura. O pós-venda é onde você constrói seu negócio.

### Acompanhamento:
- **Dia 1**: Confirme que os documentos foram recebidos
- **Dia 3**: Informe status da análise
- **Dia do crédito**: Ligue para confirmar recebimento
- **7 dias depois**: Pergunte se está satisfeito

### Pedindo indicações:
> "Fico muito feliz que deu tudo certo! Você conhece alguém na mesma situação que você estava? Posso ajudar também!"

### Quando pedir:
- Depois do crédito cair
- Quando o cliente expressar satisfação
- Naturalmente, sem forçar

### Script de indicação:
> "[Nome], foi um prazer te ajudar! Se você conhecer alguém que também está pagando parcela alta, me indica? Eu cuido dessa pessoa tão bem quanto cuidei de você"

### Programa de indicações:
Considere oferecer um agradecimento:
- Desconto em nova operação
- Brinde simbólico
- Simplesmente gratidão

### Lembre-se:
Um cliente satisfeito é seu melhor marketing. Cuide bem dele!`,
        atividadePratica: "Crie um cronograma de acompanhamento pós-venda com 5 pontos de contato e o que dizer em cada um.",
      },
    ],
  },
];

export const TOTAL_LICOES = NIVEIS_ACADEMIA.reduce((acc, nivel) => acc + nivel.licoes.length, 0);

export function getLicaoById(licaoId: string): Licao | undefined {
  for (const nivel of NIVEIS_ACADEMIA) {
    const licao = nivel.licoes.find(l => l.id === licaoId);
    if (licao) return licao;
  }
  return undefined;
}

export function getNivelById(nivelId: number): Nivel | undefined {
  return NIVEIS_ACADEMIA.find(n => n.id === nivelId);
}

export function getLicoesByNivel(nivelId: number): Licao[] {
  const nivel = getNivelById(nivelId);
  return nivel?.licoes || [];
}
