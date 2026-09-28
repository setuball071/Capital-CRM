import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { AVISO_DOCUMENTO, TEXTO_CONFIRMACAO, VERSAO_AVISO } from "@shared/avisos-legais";
import { AlertTriangle, Loader2 } from "lucide-react";

/**
 * Confirmacao obrigatoria antes de gerar ou baixar uma proposta.
 *
 * O registro (quem, quando, qual versao do aviso) vai para o servidor ANTES de
 * o documento ser gerado. Se o registro falhar, o documento sai do mesmo jeito:
 * travar a venda por causa do log seria pior que o problema que ele resolve.
 */
export function ConfirmarConferenciaDialog({
  open,
  onOpenChange,
  tipo,
  referencia,
  onConfirmado,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Identifica o documento no registro, ex.: "proposta-amortizacao". */
  tipo: string;
  /** Numero da proposta ou CPF, quando houver. */
  referencia?: string;
  onConfirmado: () => void;
}) {
  const { toast } = useToast();
  const [marcado, setMarcado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const confirmar = async () => {
    setEnviando(true);
    try {
      await apiRequest("POST", "/api/documentos/confirmacao", {
        tipo,
        versaoAviso: VERSAO_AVISO,
        referencia,
      });
    } catch {
      // Sem internet ou erro no servidor: segue com o documento e avisa.
      toast({
        title: "Não consegui registrar a confirmação",
        description: "O documento vai ser gerado, mas esta confirmação não ficou registrada.",
      });
    } finally {
      setEnviando(false);
      setMarcado(false);
      onOpenChange(false);
      onConfirmado();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setMarcado(false); }}>
      <DialogContent className="max-w-lg z-[10050]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Antes de gerar o documento
          </DialogTitle>
          <DialogDescription>{AVISO_DOCUMENTO}</DialogDescription>
        </DialogHeader>

        <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer">
          <Checkbox
            checked={marcado}
            onCheckedChange={(v) => setMarcado(v === true)}
            className="mt-0.5"
            data-testid="checkbox-confirmar-conferencia"
          />
          <span className="text-sm leading-relaxed">{TEXTO_CONFIRMACAO}</span>
        </label>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancelar-conferencia">
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={!marcado || enviando} data-testid="button-confirmar-conferencia">
            {enviando ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Registrando...</>) : "Confirmar e gerar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
