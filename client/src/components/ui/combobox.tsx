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
  clearOptionText?: string
  allowClear?: boolean
  disabled?: boolean
  className?: string
  creatable?: boolean
  createOptionLabel?: (inputValue: string) => string
  "data-testid"?: string
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Selecione...",
  searchPlaceholder = "Buscar...",
  emptyText = "Nenhum item encontrado.",
  clearOptionText = "Todos",
  allowClear = true,
  disabled = false,
  className,
  creatable = false,
  createOptionLabel = (inputValue: string) => `Usar "${inputValue}"`,
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

  const showCreateOption = React.useMemo(() => {
    if (!creatable || !inputValue.trim()) return false
    const lowerInput = inputValue.toLowerCase().trim()
    return !sortedOptions.some(opt => opt.toLowerCase() === lowerInput)
  }, [creatable, inputValue, sortedOptions])

  const handleSelect = (selectedValue: string) => {
    if (selectedValue === value) {
      onValueChange(undefined)
    } else {
      onValueChange(selectedValue)
    }
    setOpen(false)
    setInputValue("")
  }

  const handleCreateOption = () => {
    const trimmedValue = inputValue.trim()
    if (trimmedValue) {
      onValueChange(trimmedValue)
      setOpen(false)
      setInputValue("")
    }
  }

  const handleClearSelection = () => {
    onValueChange(undefined)
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
              {allowClear && !inputValue && (
                <CommandItem
                  value="__clear__"
                  onSelect={handleClearSelection}
                  className="cursor-pointer text-muted-foreground"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      !value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {clearOptionText}
                </CommandItem>
              )}
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
              {showCreateOption && (
                <CommandItem
                  value={`__create__${inputValue}`}
                  onSelect={handleCreateOption}
                  className="cursor-pointer text-primary"
                >
                  <span className="mr-2 h-4 w-4 flex items-center justify-center text-xs">+</span>
                  {createOptionLabel(inputValue.trim())}
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
