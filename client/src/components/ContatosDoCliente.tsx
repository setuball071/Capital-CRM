import { useState } from "react";
import { Phone, Mail, MapPin, User, Star, Copy, Pencil, ChevronDown } from "lucide-react";

/**
 * Contatos e endereço do cliente, à vista dentro do card "Dados do cliente".
 *
 * Vive aqui, e não dentro da página, porque DUAS telas mostram a mesma ficha:
 * a Consulta Individual e a Lista Manual. Antes era código copiado, e tudo que
 * melhorava em uma ficava faltando na outra.
 *
 * Devolve células soltas — quem usa coloca dentro do próprio grid.
 */

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "-";
  const clean = String(phone).replace(/\D/g, "");
  if (clean.length === 11) return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  if (clean.length === 10) return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  return String(phone);
}

export function formatCep(cep: string | null | undefined): string {
  const limpo = String(cep || "").replace(/\D/g, "");
  return limpo.length === 8 ? `${limpo.slice(0, 5)}-${limpo.slice(5)}` : String(cep || "");
}

// Glifo do WhatsApp — o lucide não tem marca, e o balão genérico não era
// reconhecido de imediato na ficha.
export function IconeWhatsApp({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.53.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.05 1.02-1.05 2.49s1.08 2.89 1.23 3.09c.15.2 2.12 3.24 5.14 4.54.72.31 1.28.5 1.71.64.72.23 1.37.2 1.89.12.58-.09 1.76-.72 2.01-1.42.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35z" />
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2zm0 18.01h-.01c-1.52 0-3.02-.41-4.32-1.18l-.31-.18-3.21.84.86-3.13-.2-.32a8.2 8.2 0 01-1.26-4.37c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.82 2.42a8.17 8.17 0 012.41 5.82c0 4.54-3.7 8.23-8.23 8.23z" />
    </svg>
  );
}

type TelefoneBase = {
  telefone: string;
  principal?: boolean;
  tipo?: string;
  fonte?: string | null;
  nao_perturbe?: boolean;
};
type Contato = { value: string; label?: string | null; naoPerturbe?: boolean };

// Fonte do numero, como o corretor ve ao passar o mouse. So existem tres:
// o que nao vier marcado como Lemit ou Serasa aparece como Anatel.
function nomeDaFonte(fonte: string | null | undefined): string {
  const f = String(fonte || "").toUpperCase();
  if (f === "LEMIT") return "Lemit";
  if (f === "SERASA") return "Serasa";
  return "Anatel";
}

interface Props {
  /** telefones vindos da base (higienização) */
  telefonesBase?: TelefoneBase[];
  /** e-mails vindos da base */
  emailsBase?: string[];
  /** telefones cadastrados à mão */
  telefonesManuais?: Contato[];
  /** e-mails cadastrados à mão */
  emailsManuais?: Contato[];
  /** registro da pessoa: endereço, filiação e o cache do Lemit */
  clienteBase?: any;
  /** abre o painel de contatos para editar e acrescentar */
  onGerenciar?: () => void;
  /** copia um texto para a área de transferência */
  onCopiar: (texto: string) => void;
}

export function ContatosDoCliente({
  telefonesBase = [],
  emailsBase = [],
  telefonesManuais = [],
  emailsManuais = [],
  clienteBase,
  onGerenciar,
  onCopiar,
}: Props) {
  const [maisInfoAberto, setMaisInfoAberto] = useState(false);

  const telsBase = telefonesBase.map((t) => ({
    numero: t.telefone,
    marca: t.principal ? "principal" : t.tipo,
    fonte: nomeDaFonte(t.fonte),
    naoPerturbe: Boolean(t.nao_perturbe),
  }));
  const telsManuais = telefonesManuais.map((c) => ({
    numero: c.value,
    marca: c.label || "manual",
    fonte: nomeDaFonte(null),
    naoPerturbe: Boolean(c.naoPerturbe),
  }));
  const vistos = new Set<string>();
  const telefones = [...telsBase, ...telsManuais].filter((t) => {
    const chave = String(t.numero || "").replace(/\D/g, "");
    if (!chave || vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });

  const emails = Array.from(
    new Set([...(emailsBase || []), ...emailsManuais.map((c) => c.value)]),
  ).filter(Boolean);

  const cb: any = clienteBase || {};
  // O cache do Lemit guarda endereço detalhado (bairro, número); a base própria
  // só tem logradouro, cidade, UF e CEP (Anatel).
  const lemitEnd = (() => {
    const d = cb.lemitData || cb.lemit_data;
    const e = d?.enderecos?.[0] || d?.endereco;
    return e && typeof e === "object" ? e : {};
  })();
  const logradouro = cb.endereco || lemitEnd.logradouro || "";
  const numero = cb.endereco_numero || cb.enderecoNumero || lemitEnd.numero || "";
  const complemento = lemitEnd.complemento || "";
  const bairro = cb.endereco_bairro || cb.enderecoBairro || lemitEnd.bairro || "";
  const cidade = cb.cidade || lemitEnd.cidade || cb.municipio || "";
  const ufEnd = cb.endereco_uf || cb.enderecoUf || lemitEnd.uf || "";
  const cep = cb.cep || lemitEnd.cep || "";
  const temEndereco = Boolean(logradouro || cidade || cep);
  const nomeMae = cb.nome_mae || cb.nomeMae || lemitEnd.nome_mae || "";
  const nomePai = cb.nome_pai || cb.nomePai || "";

  // Uma linha só, do jeito que se cola num formulário de banco
  const enderecoCompleto = [
    [logradouro, numero].filter(Boolean).join(", ") + (complemento ? ` - ${complemento}` : ""),
    bairro,
    [cidade, ufEnd].filter(Boolean).join(" - "),
    cep ? `CEP ${formatCep(cep)}` : "",
  ]
    .filter((parte) => parte && parte.trim())
    .join(", ");

  return (
    <>
      <div className="space-y-1 md:col-span-2 lg:col-span-2">
        <p className="text-muted-foreground flex items-center gap-1">
          <Phone className="w-4 h-4" />Telefones
          {onGerenciar && (
            <button
              type="button"
              onClick={onGerenciar}
              className="ml-1 hover:text-foreground"
              title="Gerenciar telefones, e-mails e endereço"
              data-testid="button-painel-contato"
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          {telefones.slice(0, 6).map((t, idx) => (
            <span
              key={`tel-vista-${idx}`}
              className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 bg-muted/40"
              data-testid={`telefone-vista-${idx}`}
            >
              <span
                className="font-medium cursor-help"
                title={`Fonte: ${t.fonte}`}
                data-testid={`telefone-fonte-${idx}`}
              >
                {formatPhone(t.numero)}
              </span>
              {t.marca === "principal" && <Star className="h-3 w-3 text-yellow-500 fill-current" />}
              {/* So AVISO: o numero continua clicavel e copiavel. */}
              {t.naoPerturbe && (
                <span
                  className="cursor-help leading-none"
                  title="Não me perturbe"
                  aria-label="Não me perturbe"
                  data-testid={`telefone-nao-perturbe-${idx}`}
                >
                  ❗
                </span>
              )}
              <a
                href={`https://wa.me/55${String(t.numero).replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="text-green-600 hover:text-green-700"
                title="Abrir conversa no WhatsApp"
                data-testid={`telefone-wa-${idx}`}
              >
                <IconeWhatsApp className="h-4 w-4" />
              </a>
              <button
                type="button"
                onClick={() => onCopiar(t.numero)}
                className="text-muted-foreground hover:text-foreground"
                title="Copiar"
                data-testid={`telefone-copiar-${idx}`}
              >
                <Copy className="h-3 w-3" />
              </button>
            </span>
          ))}
          {telefones.length === 0 && <span className="text-muted-foreground">Não informado</span>}
        </div>
      </div>

      {emails.length > 0 && (
        <div className="space-y-1">
          <p className="text-muted-foreground flex items-center gap-1">
            <Mail className="w-4 h-4" />E-mail
          </p>
          {emails.slice(0, 3).map((e, idx) => (
            <p key={`email-vista-${idx}`} className="truncate" title={e} data-testid={`email-vista-${idx}`}>
              {e}
            </p>
          ))}
        </div>
      )}

      {/* Mais informações: expande em linha, sem modal. Campo vazio mostra
          "Não informado" em vez de sumir, para a área não ficar irregular. */}
      <div className="md:col-span-2 lg:col-span-3">
        <button
          type="button"
          onClick={() => setMaisInfoAberto((v) => !v)}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          data-testid="button-mais-informacoes"
        >
          {maisInfoAberto ? "Menos informações" : "Mais informações (filiação e endereço)"}
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-200 ${maisInfoAberto ? "rotate-180" : ""}`}
          />
        </button>

        <div
          className={`grid transition-all duration-200 ease-out ${maisInfoAberto ? "grid-rows-[1fr] opacity-100 mt-3" : "grid-rows-[0fr] opacity-0"}`}
        >
          <div className="overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-4">
              <div className="space-y-1">
                <p className="text-muted-foreground flex items-center gap-1">
                  <User className="w-4 h-4" />Filiação
                </p>
                <p data-testid="text-nome-mae" className="flex items-start gap-1.5">
                  <span>
                    <span className="text-muted-foreground">Mãe: </span>
                    {nomeMae || <span className="text-muted-foreground">Não informado</span>}
                  </span>
                  {nomeMae && (
                    <button
                      type="button"
                      onClick={() => onCopiar(nomeMae)}
                      className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
                      title="Copiar nome da mãe"
                      data-testid="button-copiar-nome-mae"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  )}
                </p>
                <p data-testid="text-nome-pai">
                  <span className="text-muted-foreground">Pai: </span>
                  {nomePai || <span className="text-muted-foreground">Não informado</span>}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-4 h-4" />Endereço
                  {temEndereco && (
                    <button
                      type="button"
                      onClick={() => onCopiar(enderecoCompleto)}
                      className="hover:text-foreground"
                      title="Copiar endereço completo"
                      data-testid="button-copiar-endereco"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  )}
                </p>
                {temEndereco ? (
                  <>
                    <p data-testid="text-endereco">
                      {logradouro || "Logradouro não informado"}
                      {numero ? `, ${numero}` : ""}
                      {complemento ? ` — ${complemento}` : ""}
                    </p>
                    {(bairro || cidade || ufEnd) && (
                      <p className="text-muted-foreground">
                        {[bairro, [cidade, ufEnd].filter(Boolean).join(" - ")].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {cep && <p className="text-muted-foreground">CEP {formatCep(cep)}</p>}
                  </>
                ) : (
                  <p className="text-muted-foreground" data-testid="text-endereco">Não informado</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
