import { Request, Response, NextFunction } from 'express';

function getBrazilTime(): { horaAtual: string; diaDaSemana: string } {
  const agora = new Date();
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  }).formatToParts(agora);

  const h = parts.find(p => p.type === 'hour')!.value;
  const m = parts.find(p => p.type === 'minute')!.value;
  const weekdayRaw = parts.find(p => p.type === 'weekday')!.value.toLowerCase().replace('.', '');

  const weekdayMap: Record<string, string> = {
    dom: 'dom', seg: 'seg', ter: 'ter', qua: 'qua', qui: 'qui', sex: 'sex', sáb: 'sab', sab: 'sab',
  };

  return {
    horaAtual: `${h}:${m}`,
    diaDaSemana: weekdayMap[weekdayRaw] || weekdayRaw,
  };
}

export const validateAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as any;
    
    if (!user) {
      return next();
    }

    const { horaAtual, diaDaSemana } = getBrazilTime();

    if (user.horarioAcessoInicio && user.horarioAcessoFim) {
      const inicio = String(user.horarioAcessoInicio).substring(0, 5);
      const fim = String(user.horarioAcessoFim).substring(0, 5);
      
      let foraDoPeriodo: boolean;
      if (inicio <= fim) {
        foraDoPeriodo = horaAtual < inicio || horaAtual > fim;
      } else {
        foraDoPeriodo = horaAtual < inicio && horaAtual > fim;
      }
      
      if (foraDoPeriodo) {
        return res.status(403).json({
          error: 'Acesso negado',
          message: `Horário de acesso: ${inicio} às ${fim}`
        });
      }
    }

    if (user.diasAcessoPermitidos) {
      try {
        const diasPermitidos = JSON.parse(user.diasAcessoPermitidos);
        
        if (diasPermitidos.length > 0) {
          const normalized = diasPermitidos.map((d: string) => d.toLowerCase().replace('.', '').normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
          if (!normalized.includes(diaDaSemana)) {
            return res.status(403).json({
              error: 'Acesso negado',
              message: 'Você não tem permissão para acessar hoje'
            });
          }
        }
      } catch (e) {
        console.error('Erro ao parsear dias permitidos:', e);
      }
    }

    if (user.restringirPorIp && user.ipsPermitidos) {
      try {
        const ipsPermitidos = JSON.parse(user.ipsPermitidos);
        const ipCliente = req.ip || req.socket?.remoteAddress || req.headers['x-forwarded-for'];
        
        if (ipCliente && ipsPermitidos.length > 0) {
          const ipLimpo = String(ipCliente).replace('::ffff:', '').split(',')[0].trim();
          
          if (!ipsPermitidos.includes(ipLimpo)) {
            console.log(`IP bloqueado: ${ipLimpo} - Usuário: ${user.name}`);
            return res.status(403).json({
              error: 'Acesso negado',
              message: 'Seu IP não está autorizado a acessar o sistema'
            });
          }
        }
      } catch (e) {
        console.error('Erro ao parsear IPs permitidos:', e);
      }
    }

    next();

  } catch (error) {
    console.error('Erro no middleware de validação:', error);
    next();
  }
};
