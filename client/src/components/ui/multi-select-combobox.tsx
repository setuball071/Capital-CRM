import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface MultiSelectComboboxProps {
  options: string[]
  value: string[]
  onValueChange: (value: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  className?: string
  maxDisplay?: number
  "data-testid"?: string
}

export function MultiSelectCombobox({
  options,
  value = [],
  onValueChange,
  placeholder = "Selecione...",
  searchPlaceholder = "Buscar...",
  emptyText = "Nenhum item encontrado.",
  disabled = false,
  className,
  maxDisplay = 3,
  "data-testid": testId,
}: MultiSelectComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("")

  const sortedOptions = React.useMemo(() => {
    return [...options].sort((a, b) => a.localeCompare(b, "pt-BR"))
  }, [options])

  const filteredOptions = React.useMemo(() => {
    if (!inputValue) return sortedOptions
    const lowerInput = inputValue.toLowerCase()
    return sortedOptions.filter((option) =>
      option.toLowerCase().includes(lowerInput)
    )
  }, [sortedOptions, inputValue])

  const handleSelect = (selectedValue: string) => {
    const newValue = value.includes(selectedValue)
      ? value.filter(v => v !== selectedValue)
      : [...value, selectedValue]
    onValueChange(newValue)
  }

  const handleRemove = (e: React.MouseEvent, itemToRemove: string) => {
    e.stopPropagation()
    onValueChange(value.filter(v => v !== itemToRemove))
  }

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation()
    onValueChange([])
  }

  const displayValue = React.useMemo(() => {
    if (value.length === 0) return placeholder
    if (value.length <= maxDisplay) {
      return value.join(", ")
    }
    return `${value.slice(0, maxDisplay).join(", ")} +${value.length - maxDisplay}`
  }, [value, maxDisplay, placeholder])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            !value.length && "text-muted-foreground",
            className
          )}
          disabled={disabled}
          data-testid={testId}
        >
          <span className="truncate flex-1 text-left">{displayValue}</span>
          <div className="flex items-center gap-1 ml-2 shrink-0">
            {value.length > 0 && (
              <X
                className="h-4 w-4 opacity-50 hover:opacity-100"
                onClick={handleClearAll}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={() => handleSelect(option)}
                  data-testid={`multiselect-option-${option}`}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value.includes(option) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        
        {value.length > 0 && (
          <div className="border-t p-2">
            <p className="text-xs text-muted-foreground mb-2">
              {value.length} selecionado(s)
            </p>
            <div className="flex flex-wrap gap-1">
              {value.map((item) => (
                <Badge
                  key={item}
                  variant="secondary"
                  className="text-xs cursor-pointer"
                  onClick={(e) => handleRemove(e, item)}
                  data-testid={`multiselect-badge-${item}`}
                >
                  {item}
                  <X className="ml-1 h-3 w-3" />
                </Badge>
              ))}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
