import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';

interface User {
  id: number;
  name: string;
  horarioAcessoInicio?: string | null;
  horarioAcessoFim?: string | null;
  diasAcessoPermitidos?: string | null;
  restringirPorIp?: boolean | null;
  ipsPermitidos?: string | null;
}

interface ConfigurarAcessoModalProps {
  user: User | null;
  open: boolean;
  onClose: () => void;
  onSave: () => void;
}

export function ConfigurarAcessoModal({ user, open, onClose, onSave }: ConfigurarAcessoModalProps) {
  const { toast } = useToast();
  const [horarioInicio, setHorarioInicio] = useState('');
  const [horarioFim, setHorarioFim] = useState('');
  const [diasSelecionados, setDiasSelecionados] = useState<string[]>([]);
  const [restringirIP, setRestringirIP] = useState(false);
  const [ipsPermitidos, setIpsPermitidos] = useState('');
  const [saving, setSaving] = useState(false);

  // Sync state when user changes or modal opens
  useEffect(() => {
    if (user && open) {
      setHorarioInicio(user.horarioAcessoInicio || '');
      setHorarioFim(user.horarioAcessoFim || '');
      try {
        setDiasSelecionados(user.diasAcessoPermitidos ? JSON.parse(user.diasAcessoPermitidos) : []);
      } catch {
        setDiasSelecionados([]);
      }
      setRestringirIP(user.restringirPorIp || false);
      try {
        setIpsPermitidos(user.ipsPermitidos ? JSON.parse(user.ipsPermitidos).join('\n') : '');
      } catch {
        setIpsPermitidos('');
      }
    }
  }, [user, open]);

  const diasDaSemana = [
    { value: 'seg', label: 'Segunda' },
    { value: 'ter', label: 'Terça' },
    { value: 'qua', label: 'Quarta' },
    { value: 'qui', label: 'Quinta' },
    { value: 'sex', label: 'Sexta' },
    { value: 'sab', label: 'Sábado' },
    { value: 'dom', label: 'Domingo' }
  ];

  const toggleDia = (dia: string) => {
    if (diasSelecionados.includes(dia)) {
      setDiasSelecionados(diasSelecionados.filter(d => d !== dia));
    } else {
      setDiasSelecionados([...diasSelecionados, dia]);
    }
  };

  const salvar = async () => {
    if (!user) return;
    
    try {
      setSaving(true);
      
      if (restringirIP && !ipsPermitidos.trim()) {
        toast({
          title: "Erro",
          description: "Informe pelo menos um IP permitido",
          variant: "destructive",
        });
        return;
      }

      const ipsArray = ipsPermitidos
        .split('\n')
        .map(ip => ip.trim())
        .filter(ip => ip.length > 0);

      const dados = {
        horario_acesso_inicio: horarioInicio || null,
        horario_acesso_fim: horarioFim || null,
        dias_acesso_permitidos: JSON.stringify(diasSelecionados),
        restringir_por_ip: restringirIP,
        ips_permitidos: restringirIP ? JSON.stringify(ipsArray) : null
      };

      const response = await fetch(`/api/users/${user.id}/acesso`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(dados)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao salvar');
      }

      toast({
        title: "Sucesso",
        description: "Configurações de acesso salvas!",
      });
      onSave();
      onClose();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar configurações",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Configurar Acesso - {user?.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <h4 className="font-semibold mb-3">Horário de Acesso</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Início</Label>
                <Input
                  type="time"
                  value={horarioInicio}
                  onChange={(e) => setHorarioInicio(e.target.value)}
                  data-testid="input-horario-inicio"
                />
              </div>
              <div>
                <Label>Fim</Label>
                <Input
                  type="time"
                  value={horarioFim}
                  onChange={(e) => setHorarioFim(e.target.value)}
                  data-testid="input-horario-fim"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Deixe em branco para acesso 24h
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-3">Dias Permitidos</h4>
            <div className="grid grid-cols-4 gap-3">
              {diasDaSemana.map((dia) => (
                <div key={dia.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={dia.value}
                    checked={diasSelecionados.includes(dia.value)}
                    onCheckedChange={() => toggleDia(dia.value)}
                    data-testid={`checkbox-dia-${dia.value}`}
                  />
                  <label htmlFor={dia.value} className="text-sm cursor-pointer">
                    {dia.label}
                  </label>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Deixe vazio para permitir todos os dias
            </p>
          </div>

          <div>
            <div className="flex items-center space-x-2 mb-3">
              <Checkbox
                id="restringir-ip"
                checked={restringirIP}
                onCheckedChange={(checked) => setRestringirIP(checked === true)}
                data-testid="checkbox-restringir-ip"
              />
              <label htmlFor="restringir-ip" className="font-semibold cursor-pointer">
                Restringir Acesso por IP
              </label>
            </div>

            {restringirIP && (
              <div>
                <Label>IPs Permitidos (um por linha)</Label>
                <textarea
                  value={ipsPermitidos}
                  onChange={(e) => setIpsPermitidos(e.target.value)}
                  placeholder="192.168.1.100&#10;192.168.1.101&#10;177.20.30.40"
                  rows={5}
                  className="w-full border rounded p-2 font-mono text-sm bg-background"
                  data-testid="textarea-ips-permitidos"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Usuário só poderá acessar destes IPs
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} data-testid="button-cancelar-acesso">
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={saving} data-testid="button-salvar-acesso">
              {saving ? 'Salvando...' : 'Salvar Configurações'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
