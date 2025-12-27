import { useEffect } from "react";
import { useLocation } from "wouter";

export default function CrmConsultaClientePage() {
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    setLocation("/consulta-cliente");
  }, [setLocation]);
  
  return null;
}
