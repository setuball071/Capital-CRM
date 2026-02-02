import { Request, Response, NextFunction } from 'express';

export const validateAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as any;
    
    if (!user) {
      return next();
    }

    // 1. VALIDAR HORÁRIO
    if (user.horarioAcessoInicio && user.horarioAcessoFim) {
      const agora = new Date();
      const horaAtual = `${agora.getHours().toString().padStart(2, '0')}:${agora.getMinutes().toString().padStart(2, '0')}`;
      
      if (horaAtual < user.horarioAcessoInicio || horaAtual > user.horarioAcessoFim) {
        return res.status(403).json({
          error: 'Acesso negado',
          message: `Horário de acesso: ${user.horarioAcessoInicio} às ${user.horarioAcessoFim}`
        });
      }
    }

    // 2. VALIDAR DIA DA SEMANA
    if (user.diasAcessoPermitidos) {
      try {
        const diasPermitidos = JSON.parse(user.diasAcessoPermitidos);
        
        if (diasPermitidos.length > 0) {
          const hoje = new Date();
          const diaDaSemana = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'][hoje.getDay()];
          
          if (!diasPermitidos.includes(diaDaSemana)) {
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

    // 3. VALIDAR IP
    if (user.restringirPorIp && user.ipsPermitidos) {
      try {
        const ipsPermitidos = JSON.parse(user.ipsPermitidos);
        const ipCliente = req.ip || req.socket?.remoteAddress || req.headers['x-forwarded-for'];
        
        if (ipCliente && ipsPermitidos.length > 0) {
          // Limpar IP (remover ::ffff: se tiver)
          const ipLimpo = String(ipCliente).replace('::ffff:', '').split(',')[0].trim();
          
          if (!ipsPermitidos.includes(ipLimpo)) {
            console.log(`❌ IP bloqueado: ${ipLimpo} - Usuário: ${user.name}`);
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

    // Tudo OK, permitir acesso
    next();

  } catch (error) {
    console.error('Erro no middleware de validação:', error);
    next(); // Em caso de erro, permite acesso (segurança fail-open)
  }
};
