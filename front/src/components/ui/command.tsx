"use client"

import * as React from "react"
import { SearchIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

interface CommandContextValue {
  search: string
  setSearch: (search: string) => void
}

const CommandContext = React.createContext<CommandContextValue | null>(null)

function useCommand() {
  const context = React.useContext(CommandContext)
  return context
}

function Command({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  const [search, setSearch] = React.useState("")

  return (
    <CommandContext.Provider value={{ search, setSearch }}>
      <div
        data-slot="command"
        className={cn(
          "flex h-full w-full flex-col overflow-hidden rounded-lg bg-popover text-popover-foreground",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </CommandContext.Provider>
  )
}

function CommandDialog({
  title = "Command Palette",
  description = "Search for a command or item...",
  children,
  ...props
}: Omit<React.ComponentProps<typeof Dialog>, "children"> & {
  children?: React.ReactNode
  title?: string
  description?: string
}) {
  return (
    <Dialog {...props}>
      <DialogContent className="overflow-hidden p-0 shadow-lg sm:max-w-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Command className="[&_[data-slot=command-group]]:px-2 [&_[data-slot=command-group-heading]]:px-2 [&_[data-slot=command-group-heading]]:font-medium [&_[data-slot=command-group-heading]]:text-muted-foreground [&_[data-slot=command-item]]:px-3 [&_[data-slot=command-item]]:py-2.5">
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  )
}

function CommandInput({
  className,
  value,
  onValueChange,
  ...props
}: Omit<React.ComponentProps<"input">, "value" | "onChange"> & {
  value?: string
  onValueChange?: (value: string) => void
}) {
  const commandContext = useCommand()
  const val = value !== undefined ? value : commandContext?.search || ""

  return (
    <div
      data-slot="command-input-wrapper"
      className="flex items-center border-b border-border px-3.5"
    >
      <SearchIcon className="mr-2.5 size-4 shrink-0 opacity-50" />
      <input
        data-slot="command-input"
        className={cn(
          "flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        value={val}
        onChange={(e) => {
          if (onValueChange) {
            onValueChange(e.target.value)
          }
          if (commandContext) {
            commandContext.setSearch(e.target.value)
          }
        }}
        {...props}
      />
    </div>
  )
}

function CommandList({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="command-list"
      className={cn("max-h-[300px] overflow-y-auto overflow-x-hidden p-1", className)}
      {...props}
    />
  )
}

function CommandEmpty({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="command-empty"
      className={cn("py-6 text-center text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CommandGroup({
  className,
  heading,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  heading?: React.ReactNode
}) {
  return (
    <div
      data-slot="command-group"
      className={cn(
        "overflow-hidden p-1 text-foreground [&_[data-slot=command-group-heading]]:px-2 [&_[data-slot=command-group-heading]]:py-1.5 [&_[data-slot=command-group-heading]]:text-xs [&_[data-slot=command-group-heading]]:font-medium [&_[data-slot=command-group-heading]]:text-muted-foreground",
        className
      )}
      {...props}
    >
      {heading && (
        <div data-slot="command-group-heading" className="select-none">
          {heading}
        </div>
      )}
      {children}
    </div>
  )
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="command-separator"
      className={cn("-mx-1 h-px bg-border", className)}
      {...props}
    />
  )
}

function CommandItem({
  className,
  onSelect,
  disabled,
  ...props
}: React.ComponentProps<"div"> & {
  onSelect?: () => void
  disabled?: boolean
}) {
  return (
    <div
      data-slot="command-item"
      role="option"
      aria-selected={props["aria-selected"] ?? false}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={() => {
        if (!disabled && onSelect) {
          onSelect()
        }
      }}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ") && onSelect) {
          e.preventDefault()
          onSelect()
        }
      }}
      className={cn(
        "relative flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        disabled && "pointer-events-none opacity-50",
        className
      )}
      {...props}
    />
  )
}

function CommandShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
}
