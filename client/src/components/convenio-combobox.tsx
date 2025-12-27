import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, getErrorMessage } from "@/lib/queryClient";
import { Check, ChevronsUpDown, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import type { Convenio } from "@shared/schema";

interface ConvenioComboboxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  testId?: string;
}

export function ConvenioCombobox({ 
  value, 
  onChange, 
  placeholder = "Selecione ou crie um convênio...",
  disabled = false,
  testId = "combobox-convenio"
}: ConvenioComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const { toast } = useToast();
  
  const { data: convenios = [], isLoading } = useQuery<Convenio[]>({
    queryKey: ["/api/convenios"],
  });
  
  const createMutation = useMutation({
    mutationFn: async (label: string) => {
      const response = await apiRequest("POST", "/api/convenios", { label });
      return response.json();
    },
    onSuccess: (newConvenio: Convenio) => {
      queryClient.invalidateQueries({ queryKey: ["/api/convenios"] });
      onChange(newConvenio.code);
      setOpen(false);
      setSearchValue("");
      toast({
        title: "Convênio criado",
        description: `"${newConvenio.label}" foi adicionado com sucesso.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar convênio",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });
  
  const normalizeForSearch = (input: string): string => {
    return input
      .trim()
      .replace(/\s+/g, " ")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();
  };
  
  const searchNormalized = normalizeForSearch(searchValue);
  const existsInList = convenios.some(c => c.code === searchNormalized);
  const showCreateOption = searchValue.trim().length >= 2 && !existsInList;
  
  const selectedConvenio = convenios.find(c => c.code === value);
  
  const handleCreate = () => {
    if (searchValue.trim().length >= 2) {
      createMutation.mutate(searchValue.trim());
    }
  };
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
          data-testid={testId}
        >
          {isLoading ? (
            <span className="text-muted-foreground">Carregando...</span>
          ) : value ? (
            selectedConvenio?.label || value
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Buscar ou criar convênio..." 
            value={searchValue}
            onValueChange={setSearchValue}
            data-testid={`${testId}-search`}
          />
          <CommandList>
            <CommandEmpty>
              {searchValue.trim().length < 2 ? (
                "Digite pelo menos 2 caracteres..."
              ) : (
                "Nenhum convênio encontrado."
              )}
            </CommandEmpty>
            <CommandGroup>
              {convenios
                .filter(c => 
                  !searchNormalized || 
                  c.code.includes(searchNormalized) ||
                  c.label.toUpperCase().includes(searchNormalized)
                )
                .map((convenio) => (
                  <CommandItem
                    key={convenio.id}
                    value={convenio.code}
                    onSelect={() => {
                      onChange(convenio.code);
                      setOpen(false);
                      setSearchValue("");
                    }}
                    data-testid={`${testId}-option-${convenio.code}`}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === convenio.code ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {convenio.label}
                  </CommandItem>
                ))}
              {showCreateOption && (
                <CommandItem
                  value={`create-${searchNormalized}`}
                  onSelect={handleCreate}
                  className="text-primary"
                  data-testid={`${testId}-create`}
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Criar convênio "{searchValue.trim()}"
                    </>
                  )}
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
