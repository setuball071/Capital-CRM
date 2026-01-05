import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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

interface ComboboxProps {
  options: string[]
  value: string | undefined
  onValueChange: (value: string | undefined) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  allowClear?: boolean
  disabled?: boolean
  className?: string
  "data-testid"?: string
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Selecione...",
  searchPlaceholder = "Buscar...",
  emptyText = "Nenhum item encontrado.",
  allowClear = true,
  disabled = false,
  className,
  "data-testid": testId,
}: ComboboxProps) {
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
    if (selectedValue === value) {
      onValueChange(undefined)
    } else {
      onValueChange(selectedValue)
    }
    setOpen(false)
    setInputValue("")
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onValueChange(undefined)
    setInputValue("")
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
            className
          )}
          data-testid={testId}
        >
          <span className="truncate">
            {value || placeholder}
          </span>
          <div className="flex items-center gap-1 ml-2 shrink-0">
            {allowClear && value && (
              <X
                className="h-4 w-4 opacity-50 hover:opacity-100"
                onClick={handleClear}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
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
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
