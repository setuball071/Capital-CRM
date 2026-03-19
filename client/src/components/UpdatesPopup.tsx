import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RefreshCw, Settings, User, Megaphone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";

interface SystemUpdate {
  id: number;
  title: string;
  content_what: string;
  content_how: string;
  content_impact: string;
  published_at: string;
  target_roles: string[];
}

export function UpdatesPopup() {
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);

  const { data: pending = [], isLoading } = useQuery<SystemUpdate[]>({
    queryKey: ["/api/system-updates/pending"],
    queryFn: () => apiRequest("GET", "/api/system-updates/pending").then(r => r.json()),
    enabled: !!user,
    staleTime: 0,
  });

  const readMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/system-updates/${id}/read`),
    onSuccess: () => {
      if (currentIndex + 1 < pending.length) {
        setCurrentIndex(prev => prev + 1);
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/system-updates/pending"] });
        setCurrentIndex(0);
      }
    },
  });

  if (isLoading || pending.length === 0) return null;

  const current = pending[currentIndex];
  if (!current) return null;

  const total = pending.length;
  const isLast = currentIndex === total - 1;

  function handleConfirm() {
    readMutation.mutate(current.id);
  }

  return (
    <Dialog open modal>
      <DialogContent
        className="max-w-lg [&>button:last-child]:hidden"
        onInteractOutside={e => e.preventDefault()}
        onEscapeKeyDown={e => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100">
                <Megaphone className="h-4 w-4 text-purple-700" />
              </div>
              <DialogTitle className="text-base font-semibold">Novidade no sistema</DialogTitle>
            </div>
            {total > 1 && (
              <span className="text-xs text-muted-foreground font-medium shrink-0">
                {currentIndex + 1} de {total}
              </span>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-sm mb-1">{current.title}</h3>
            <Badge variant="outline" className="text-xs text-muted-foreground">
              {format(new Date(current.published_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </Badge>
          </div>

          <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground mb-1.5">
              <RefreshCw className="h-3.5 w-3.5 text-blue-600" />
              O que mudou
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{current.content_what}</p>
          </div>

          <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground mb-1.5">
              <Settings className="h-3.5 w-3.5 text-amber-600" />
              Como funciona
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{current.content_how}</p>
          </div>

          <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground mb-1.5">
              <User className="h-3.5 w-3.5 text-green-600" />
              Impacto no seu dia a dia
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{current.content_impact}</p>
          </div>

          {isLast ? (
            <Button
              className="w-full font-semibold"
              style={{ backgroundColor: "#6C2BD9", color: "#fff" }}
              onClick={handleConfirm}
              disabled={readMutation.isPending}
              data-testid="button-confirm-update"
            >
              {readMutation.isPending ? "Confirmando..." : "Entendi, pode fechar"}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                className="flex-1 font-semibold"
                style={{ backgroundColor: "#6C2BD9", color: "#fff" }}
                onClick={handleConfirm}
                disabled={readMutation.isPending}
                data-testid="button-confirm-update"
              >
                {readMutation.isPending ? "Confirmando..." : "Entendi"}
              </Button>
              <Button
                variant="outline"
                onClick={handleConfirm}
                disabled={readMutation.isPending}
                data-testid="button-next-update"
              >
                Próxima ({currentIndex + 2}/{total})
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
