import { Shield, Lock, Database, Eye, Trash2, Mail, FileText, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function PrivacidadePage() {
  const lastUpdate = "17 de maio de 2026";
  const companyName = "Capital Go CRM";
  const companyEmail = "contato@sistemacapital.com.br";

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="flex justify-center">
          <div className="p-4 bg-primary/10 rounded-full">
            <Shield className="h-10 w-10 text-primary" />
          </div>
        </div>
        <h1 className="text-3xl font-bold">Política de Privacidade</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Transparência total sobre como o <strong>{companyName}</strong> coleta, usa e protege
          seus dados, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).
        </p>
        <Badge variant="outline" className="text-xs">
          Última atualização: {lastUpdate}
        </Badge>
      </div>

      {/* Seções */}
      <div className="space-y-6">

        {/* 1. Quem somos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-primary" />
              1. Quem somos (Controlador dos Dados)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              O <strong className="text-foreground">{companyName}</strong> é um sistema de gestão
              comercial especializado em crédito consignado para servidores públicos federais.
            </p>
            <p>
              Para questões relacionadas à privacidade e proteção de dados, entre em contato:
            </p>
            <p className="font-medium text-foreground">
              📧 {companyEmail}
            </p>
          </CardContent>
        </Card>

        {/* 2. Dados coletados */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Database className="h-5 w-5 text-primary" />
              2. Quais dados coletamos
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-4">
            <div>
              <p className="font-semibold text-foreground mb-2">Dados dos usuários do sistema (consultores):</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Nome, e-mail e senha (armazenada com criptografia bcrypt)</li>
                <li>Endereço IP de acesso e User-Agent do navegador</li>
                <li>Horários e registros de login/logout</li>
                <li>Perfil comportamental DISC (quando realizado voluntariamente)</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-2">Dados de servidores públicos (base SIAPE):</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>CPF, nome, matrícula e órgão de lotação</li>
                <li>Dados de folha de pagamento: rendimentos, descontos e margem disponível</li>
                <li>Dados de contratos de crédito consignado existentes</li>
                <li>Informações de contracheque fornecidas por correspondentes bancários autorizados</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-2">Dados de auditoria e segurança:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Registro de consultas realizadas (CPF consultado, usuário, data/hora, IP)</li>
                <li>Tentativas de login com falha</li>
                <li>Eventos de segurança detectados automaticamente</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* 3. Finalidade */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-primary" />
              3. Para que usamos os dados
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <div className="grid gap-3">
              {[
                {
                  titulo: "Prestação do serviço",
                  desc: "Permitir que consultores autorizados consultem dados de margem disponível e realizem simulações de crédito.",
                  base: "Execução de contrato",
                },
                {
                  titulo: "Segurança do sistema",
                  desc: "Detectar acessos não autorizados, tentativas de ataque e uso indevido da plataforma.",
                  base: "Legítimo interesse",
                },
                {
                  titulo: "Auditoria e rastreabilidade",
                  desc: "Manter registro de quem acessou quais dados, para conformidade com regulamentações do setor financeiro.",
                  base: "Obrigação legal",
                },
                {
                  titulo: "Melhoria do sistema",
                  desc: "Analisar padrões de uso para melhorar funcionalidades e performance.",
                  base: "Legítimo interesse",
                },
              ].map((item) => (
                <div key={item.titulo} className="flex gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-semibold text-foreground text-sm">{item.titulo}</p>
                    <p className="text-xs mt-0.5">{item.desc}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs shrink-0 h-fit">
                    {item.base}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 4. Compartilhamento */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Eye className="h-5 w-5 text-primary" />
              4. Compartilhamento de dados
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>
              <strong className="text-foreground">Não vendemos nem compartilhamos dados pessoais com terceiros</strong> para fins
              comerciais ou de marketing.
            </p>
            <p>Os dados podem ser compartilhados apenas nos seguintes casos:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>
                <strong className="text-foreground">Correspondentes bancários autorizados:</strong> que fornecem
                os dados de folha e têm relação contratual com os servidores.
              </li>
              <li>
                <strong className="text-foreground">Autoridades competentes:</strong> quando exigido por lei,
                ordem judicial ou regulamentação do Banco Central.
              </li>
              <li>
                <strong className="text-foreground">Provedores de infraestrutura:</strong> Neon (banco de dados
                em nuvem) e Vercel (hospedagem), sob contratos de proteção de dados.
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* 5. Segurança */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Lock className="h-5 w-5 text-primary" />
              5. Como protegemos seus dados
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                "Senhas armazenadas com hash bcrypt (nunca em texto claro)",
                "Conexão HTTPS obrigatória em todo o sistema",
                "SSL com validação de certificado na conexão com o banco de dados",
                "Rate limiting para prevenção de ataques de força bruta",
                "Bloqueio automático de conta após 5 tentativas erradas de senha",
                "Detecção automática de comportamento de scraping/automação",
                "Log de auditoria de todas as consultas sensíveis",
                "Isolamento total entre ambientes de diferentes empresas (multi-tenant)",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2 p-2 bg-green-50 dark:bg-green-950/20 rounded-md">
                  <span className="text-green-600 font-bold shrink-0">✓</span>
                  <span className="text-xs">{item}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 6. Retenção */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Trash2 className="h-5 w-5 text-primary" />
              6. Por quanto tempo guardamos os dados
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <div className="space-y-3">
              {[
                { tipo: "Dados de folha SIAPE", prazo: "Até 2 competências (conforme configuração do sistema)" },
                { tipo: "Log de auditoria", prazo: "12 meses (obrigação legal do setor financeiro)" },
                { tipo: "Dados de usuários ativos", prazo: "Enquanto a conta estiver ativa" },
                { tipo: "Dados após encerramento da conta", prazo: "30 dias, então anonimizados ou excluídos" },
                { tipo: "Sessões de acesso", prazo: "30 dias de inatividade" },
              ].map((item) => (
                <div key={item.tipo} className="flex justify-between items-center py-2 border-b last:border-0">
                  <span className="font-medium text-foreground">{item.tipo}</span>
                  <span className="text-xs text-right max-w-[50%]">{item.prazo}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 7. Direitos do titular */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5 text-primary" />
              7. Seus direitos (LGPD — Art. 18)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>Você tem os seguintes direitos sobre seus dados pessoais:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[
                { direito: "Confirmação e acesso", desc: "Saber quais dados temos sobre você" },
                { direito: "Correção", desc: "Corrigir dados incompletos ou incorretos" },
                { direito: "Anonimização ou exclusão", desc: "Para dados tratados com base em consentimento" },
                { direito: "Portabilidade", desc: "Receber seus dados em formato estruturado" },
                { direito: "Oposição", desc: "Se opor a tratamentos em determinadas hipóteses" },
                { direito: "Revogação do consentimento", desc: "A qualquer momento, sem prejuízo" },
              ].map((item) => (
                <div key={item.direito} className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                  <p className="font-semibold text-foreground text-xs">{item.direito}</p>
                  <p className="text-xs mt-0.5">{item.desc}</p>
                </div>
              ))}
            </div>
            <p className="mt-4">
              Para exercer qualquer destes direitos, entre em contato:{" "}
              <strong className="text-foreground">{companyEmail}</strong>
            </p>
          </CardContent>
        </Card>

        {/* 8. Contato */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Mail className="h-5 w-5 text-primary" />
              8. Contato e Encarregado (DPO)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              Dúvidas, solicitações ou reclamações relacionadas à privacidade e proteção de dados:
            </p>
            <p className="text-foreground font-medium">📧 {companyEmail}</p>
            <p className="text-xs mt-4 border-t pt-3">
              Você também pode registrar reclamações perante a{" "}
              <strong className="text-foreground">
                Autoridade Nacional de Proteção de Dados (ANPD)
              </strong>{" "}
              pelo site{" "}
              <span className="text-primary">gov.br/anpd</span>.
            </p>
          </CardContent>
        </Card>

      </div>

      {/* Footer */}
      <div className="text-center text-xs text-muted-foreground pt-4 border-t">
        <p>{companyName} — Política de Privacidade</p>
        <p>Última atualização: {lastUpdate} — Em conformidade com a LGPD (Lei nº 13.709/2018)</p>
      </div>
    </div>
  );
}
