import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export interface ContratoAtual {
  banco: string;
  parcela: number;
  prazo: number;
}

export interface NovaParcela {
  parcela: number;
  prazo: number;
  troco: number;
}

export interface PropostaFill {
  contratos: ContratoAtual[];
  novas: NovaParcela[];
}

interface PropostaCtx {
  fill: PropostaFill | null;
  sendToProposta: (data: PropostaFill) => void;
  clearFill: () => void;
}

const PropostaContext = createContext<PropostaCtx | null>(null);

interface PropostaProviderProps {
  children: ReactNode;
  onNavigateToProposta: () => void;
}

export function PropostaProvider({ children, onNavigateToProposta }: PropostaProviderProps) {
  const [fill, setFill] = useState<PropostaFill | null>(null);

  const sendToProposta = useCallback(
    (data: PropostaFill) => {
      setFill(data);
      onNavigateToProposta();
    },
    [onNavigateToProposta]
  );

  const clearFill = useCallback(() => {
    setFill(null);
  }, []);

  return (
    <PropostaContext.Provider value={{ fill, sendToProposta, clearFill }}>
      {children}
    </PropostaContext.Provider>
  );
}

export function useProposta(): PropostaCtx | null {
  return useContext(PropostaContext);
}
