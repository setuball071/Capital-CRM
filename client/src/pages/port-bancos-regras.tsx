// ═══════════════════════════════════════════════════════════════════════════
// BANCOS E REGRAS — área administrativa (master) do motor multibanco.
//
// Só cadastra e atualiza: bancos, infográficos importados, exceções e suas
// vigências. A análise em si acontece no simulador de portabilidade, que lê o
// extrato e mostra o resultado de todos os bancos — aqui não se digita cliente
// nem contrato.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { ORIGENS } from "@shared/portability/engine";

interface BancoApi {
  id: number; nome: string; codigo: string | null; ativo: boolean; ordem: number;
  inativo_motivo?: string | null; inativo_em?: string | null;
  regraVigente: { id: number; hash: string; fonteDescricao: string | null; vigenciaInicio: string; regras: any } | null;
  excecoes: { id: number; tipo: string; parametros: any; motivo: string | null; criado_em: string }[];
}

const inputCls = "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-violet-500/40";
const labelCls = "block text-[11px] font-semibold text-muted-foreground mb-1";
const cardCls = "rounded-xl border border-border bg-card p-4";

export default function PortBancosRegras() {
  const { user } = useAuth();
  const master = Boolean(user?.isMaster || user?.role === "master");
  const [bancos, setBancos] = useState<BancoApi[]>([]);
  const convenio = "SIAPE";

  const carregar = useCallback(async () => {
    try {
      const r = await fetch(`/api/port/bancos?convenio=${convenio}`, { credentials: "include" });
      setBancos(r.ok ? await r.json() : []);
    } catch { setBancos([]); }
  }, []);
  useEffect(() => { if (master) carregar(); }, [master, carregar]);

  if (!master) {
    return <div className="p-6 text-sm text-muted-foreground">Área restrita ao usuário master.</div>;
  }
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-xl font-bold">Bancos e Regras</h1>
      <p className="text-[13px] text-muted-foreground mt-1">
        O que é cadastrado aqui alimenta sozinho a análise por banco do Simulador de Portabilidade.
      </p>
      <PainelBancos bancos={bancos} convenio={convenio} aoMudar={carregar} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════

function PainelBancos({ bancos, convenio, aoMudar }: { bancos: BancoApi[]; convenio: string; aoMudar: () => void }) {
  const [modelos, setModelos] = useState<any[]>([]);
  const [msg, setMsg] = useState<string>("");
  const [novoBanco, setNovoBanco] = useState("");
  const [historico, setHistorico] = useState<Record<number, any[]>>({});
  const [formExc, setFormExc] = useState<Record<number, { origem: string; porta: boolean; pagasMin: string; motivo: string }>>({});

  useEffect(() => {
    fetch("/api/port/modelos", { credentials: "include" }).then(r => r.ok ? r.json() : []).then(setModelos).catch(() => setModelos([]));
  }, []);

  async function chamar(url: string, metodo: string, corpo?: any) {
    const r = await fetch(url, { method: metodo, credentials: "include", headers: { "Content-Type": "application/json" }, body: corpo ? JSON.stringify(corpo) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.message || "erro " + r.status);
    return j;
  }
  const executar = async (fn: () => Promise<string>) => {
    try { setMsg(await fn()); aoMudar(); } catch (e: any) { setMsg("Erro: " + e.message); }
  };

  return (
    <div className="mt-5 space-y-4">
      {msg && <div className="rounded-md bg-violet-50 dark:bg-violet-950/40 px-3 py-2 text-[12px] text-violet-800 dark:text-violet-200">{msg}</div>}

      <div className={cardCls}>
        <div className="text-sm font-bold mb-1">Importar infográfico</div>
        <p className="text-[12px] text-muted-foreground mb-2">
          Cada modelo é uma arte já transcrita. Importar grava uma versão nova das regras — a vigência começa agora —
          e cria as exceções sugeridas que ainda não existirem. As exceções atuais continuam valendo.
        </p>
        {modelos.map(m => (
          <div key={m.id} className="flex items-center justify-between gap-3 border-t border-border py-2 text-[12px]">
            <div><b>{m.banco} · {m.convenio}</b><div className="text-muted-foreground">{m.fonteDescricao}{m.excecoesSugeridas ? ` · ${m.excecoesSugeridas} exceção(ões) sugerida(s)` : ""}</div></div>
            <button onClick={() => executar(async () => {
              const j = await chamar("/api/port/importar-modelo", "POST", { modeloId: m.id });
              return `${m.banco}: ${j.regraNova ? "nova versão de regras gravada" : "regras idênticas às vigentes, nada mudou"}; ${j.excecoesCriadas} exceção(ões) criada(s).`;
            })} className="rounded-md bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold px-3 py-1.5 whitespace-nowrap">Importar</button>
          </div>
        ))}
      </div>

      <div className={cardCls}>
        <div className="flex items-end gap-2 mb-3">
          <div className="flex-1 max-w-xs">
            <label className={labelCls}>Novo banco (fica sem regras até importar)</label>
            <input className={inputCls} value={novoBanco} onChange={e => setNovoBanco(e.target.value)} placeholder="ex.: Safra" />
          </div>
          <button onClick={() => executar(async () => { await chamar("/api/port/bancos", "POST", { nome: novoBanco }); setNovoBanco(""); return "Banco criado."; })}
            disabled={!novoBanco.trim()} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50">Criar</button>
        </div>

        {!bancos.length && <div className="text-[12px] text-muted-foreground">Nenhum banco cadastrado ainda.</div>}
        {bancos.map(b => {
          const f = formExc[b.id] || { origem: "", porta: true, pagasMin: "0", motivo: "" };
          const setF = (p: Partial<typeof f>) => setFormExc(s => ({ ...s, [b.id]: { ...f, ...p } }));
          return (
            <div key={b.id} className="border-t border-border py-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="text-sm font-bold">{b.nome}</div>
                <label className="flex items-center gap-1.5 text-[12px] cursor-pointer">
                  <input type="checkbox" checked={b.ativo} onChange={e => {
                    const ligar = e.target.checked;
                    // desligar sem dizer o porquê vira mistério depois; religar limpa o motivo
                    const motivo = ligar ? "" : (window.prompt(`Por que o ${b.nome} está saindo da análise? (ex.: suspenso por problema técnico)`) ?? "").trim();
                    if (!ligar && motivo === "" ) return;   // cancelou o prompt: não desliga
                    executar(async () => {
                      await chamar(`/api/port/bancos/${b.id}`, "PATCH", { ativo: ligar, motivo });
                      return `${b.nome} ${ligar ? "ligado — volta para a análise" : "desligado — sai da análise"}.`;
                    });
                  }} />ativo
                </label>
                {!b.ativo && (
                  <span className="text-[11px] rounded bg-amber-100 text-amber-800 px-1.5 py-0.5">
                    desligado{b.inativo_em ? ` desde ${new Date(b.inativo_em).toLocaleDateString("pt-BR")}` : ""}
                    {b.inativo_motivo ? ` — ${b.inativo_motivo}` : ""}
                  </span>
                )}
                <div className="text-[11px] text-muted-foreground">
                  {b.regraVigente
                    ? <>Regras {convenio}: {b.regraVigente.fonteDescricao || "cadastro manual"} · vigentes desde {new Date(b.regraVigente.vigenciaInicio).toLocaleString("pt-BR")} · #{b.regraVigente.id}</>
                    : <>Sem regras para {convenio}.</>}
                </div>
                <button className="text-[11px] font-semibold text-violet-700 dark:text-violet-300" onClick={async () => {
                  if (historico[b.id]) { setHistorico(h => { const n = { ...h }; delete n[b.id]; return n; }); return; }
                  const r = await fetch(`/api/port/bancos/${b.id}/regras`, { credentials: "include" });
                  setHistorico(h => ({ ...h, [b.id]: r.ok ? [] : [] }));
                  if (r.ok) { const j = await r.json(); setHistorico(h => ({ ...h, [b.id]: j })); }
                }}>{historico[b.id] ? "ocultar versões" : "versões"}</button>
              </div>

              {historico[b.id] && (
                <div className="mt-2 ml-2 text-[11px] space-y-0.5">
                  {historico[b.id].map((v: any) => (
                    <div key={v.id} className={v.vigencia_fim ? "text-muted-foreground" : ""}>
                      #{v.id} · {v.convenio} · {new Date(v.vigencia_inicio).toLocaleString("pt-BR")} → {v.vigencia_fim ? new Date(v.vigencia_fim).toLocaleString("pt-BR") : "vigente"}
                      {v.criado_por_nome ? ` · ${v.criado_por_nome}` : ""} · {v.fonte_descricao || "manual"}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-2 ml-2">
                <div className="text-[11px] font-bold text-muted-foreground mb-1">Exceções ({convenio}) — vencem o infográfico e sobrevivem à troca de arte</div>
                {!b.excecoes.length && <div className="text-[11px] text-muted-foreground">nenhuma</div>}
                {b.excecoes.map(e => (
                  <div key={e.id} className="flex items-start gap-2 text-[12px] py-0.5">
                    <span className="font-semibold whitespace-nowrap">{e.parametros.origem}</span>
                    <span className="whitespace-nowrap">{e.parametros.porta ? `porta com ${e.parametros.pagasMin ?? 0} pagas` : "não porta"}</span>
                    <span className="text-muted-foreground flex-1">{e.motivo}</span>
                    <button className="text-red-600 text-[11px] font-semibold whitespace-nowrap" onClick={() => {
                      if (!confirm(`Desativar a exceção de ${e.parametros.origem}? Ela fica no histórico.`)) return;
                      executar(async () => { await chamar(`/api/port/excecoes/${e.id}`, "DELETE"); return "Exceção desativada (continua no histórico)."; });
                    }}>desativar</button>
                  </div>
                ))}

                <div className="mt-2 grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
                  <div className="md:col-span-1">
                    <label className={labelCls}>Banco de origem</label>
                    <select className={inputCls} value={f.origem} onChange={e => setF({ origem: e.target.value })}>
                      <option value="">escolha</option>
                      {ORIGENS.map(o => <option key={o.chave} value={o.nome}>{o.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Regra</label>
                    <select className={inputCls} value={f.porta ? "sim" : "nao"} onChange={e => setF({ porta: e.target.value === "sim" })}>
                      <option value="sim">porta</option><option value="nao">não porta</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Pagas mín.</label>
                    <input className={inputCls} value={f.pagasMin} disabled={!f.porta} onChange={e => setF({ pagasMin: e.target.value.replace(/\D/g, "") })} />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelCls}>Motivo (obrigatório)</label>
                    <input className={inputCls} value={f.motivo} onChange={e => setF({ motivo: e.target.value })} placeholder="de onde veio essa exceção" />
                  </div>
                  <button disabled={!f.origem || f.motivo.trim().length < 5}
                    onClick={() => executar(async () => {
                      await chamar(`/api/port/bancos/${b.id}/excecoes`, "POST", { convenio, parametros: { origem: f.origem, porta: f.porta, pagasMin: Number(f.pagasMin) || 0 }, motivo: f.motivo });
                      setFormExc(s => ({ ...s, [b.id]: { origem: "", porta: true, pagasMin: "0", motivo: "" } }));
                      return "Exceção criada.";
                    })}
                    className="rounded-md bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-2">+ exceção</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
