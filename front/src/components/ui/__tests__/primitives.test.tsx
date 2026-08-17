import React from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

// UI Primitives under test
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from "@/components/ui/table"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
  PopoverClose,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu"
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command"
import { Calendar } from "@/components/ui/calendar"
import {
  Sidebar,
  SidebarProvider,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarGroupAction,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
  SidebarTrigger,
  SidebarRail,
  SidebarInset,
  useSidebar,
} from "@/components/ui/sidebar"

describe("UI Primitives Adversarial Test Suite", () => {
  describe("Card Components", () => {
    it("renders Card and merges custom class names", () => {
      render(
        <Card data-testid="card-root" className="custom-card-class">
          <CardHeader data-testid="card-header" className="custom-header">
            <CardTitle data-testid="card-title" className="custom-title">
              Card Title
            </CardTitle>
            <CardDescription data-testid="card-desc" className="custom-desc">
              Description text
            </CardDescription>
          </CardHeader>
          <CardContent data-testid="card-content" className="custom-content">
            Content body
          </CardContent>
          <CardFooter data-testid="card-footer" className="custom-footer">
            Footer content
          </CardFooter>
        </Card>
      )

      const card = screen.getByTestId("card-root")
      expect(card).toHaveClass("custom-card-class")
      expect(card).toHaveClass("rounded-xl")
      expect(card).toHaveAttribute("data-slot", "card")

      expect(screen.getByTestId("card-header")).toHaveClass("custom-header")
      expect(screen.getByTestId("card-title")).toHaveClass("custom-title")
      expect(screen.getByTestId("card-desc")).toHaveClass("custom-desc")
      expect(screen.getByTestId("card-content")).toHaveClass("custom-content")
      expect(screen.getByTestId("card-footer")).toHaveClass("custom-footer")
    })

    it("forwards arbitrary DOM props to Card", () => {
      const handleClick = vi.fn()
      render(
        <Card
          data-testid="card-clickable"
          onClick={handleClick}
          aria-label="Interactive Card"
        />
      )
      const el = screen.getByTestId("card-clickable")
      fireEvent.click(el)
      expect(handleClick).toHaveBeenCalledTimes(1)
      expect(el).toHaveAttribute("aria-label", "Interactive Card")
    })
  })

  describe("Table Components", () => {
    it("renders Table and subcomponents with correct semantic HTML and classes", () => {
      render(
        <Table data-testid="table-el" className="custom-table">
          <TableCaption data-testid="caption-el" className="custom-caption">
            Caption
          </TableCaption>
          <TableHeader data-testid="thead-el" className="custom-thead">
            <TableRow data-testid="tr-head-el" className="custom-tr">
              <TableHead data-testid="th-el" className="custom-th">
                Header
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody data-testid="tbody-el" className="custom-tbody">
            <TableRow data-testid="tr-body-el">
              <TableCell data-testid="td-el" className="custom-td">
                Data cell
              </TableCell>
            </TableRow>
          </TableBody>
          <TableFooter data-testid="tfoot-el" className="custom-tfoot">
            <TableRow>
              <TableCell>Footer cell</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      )

      const table = screen.getByTestId("table-el")
      expect(table.tagName).toBe("TABLE")
      expect(table).toHaveClass("custom-table")
      expect(screen.getByTestId("caption-el").tagName).toBe("CAPTION")
      expect(screen.getByTestId("thead-el").tagName).toBe("THEAD")
      expect(screen.getByTestId("tbody-el").tagName).toBe("TBODY")
      expect(screen.getByTestId("tfoot-el").tagName).toBe("TFOOT")
      expect(screen.getByTestId("th-el").tagName).toBe("TH")
      expect(screen.getByTestId("td-el").tagName).toBe("TD")
    })
  })

  describe("Popover Component", () => {
    it("renders Popover and checks PopoverAnchor availability", () => {
      expect(Popover).toBeDefined()
      expect(PopoverTrigger).toBeDefined()
      expect(PopoverContent).toBeDefined()
      expect(PopoverClose).toBeDefined()
      // PopoverAnchor check
      expect(PopoverAnchor).toBeDefined()
    })
  })

  describe("Tooltip Component", () => {
    it("renders Tooltip with Provider, Trigger and Content", () => {
      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger data-testid="tooltip-trigger">Hover me</TooltipTrigger>
            <TooltipContent data-testid="tooltip-content" className="custom-tooltip">
              Tooltip text
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
      expect(screen.getByTestId("tooltip-trigger")).toBeInTheDocument()
    })
  })

  describe("DropdownMenu Component", () => {
    it("renders DropdownMenu components without crashing", () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger data-testid="dropdown-trigger">
            Open Menu
          </DropdownMenuTrigger>
        </DropdownMenu>
      )
      expect(screen.getByTestId("dropdown-trigger")).toBeInTheDocument()
    })

    it("verifies DropdownMenu subcomponents can be instantiated", () => {
      render(
        <div>
          <DropdownMenuShortcut data-testid="shortcut" className="custom-shortcut">
            ⌘K
          </DropdownMenuShortcut>
        </div>
      )
      const shortcut = screen.getByTestId("shortcut")
      expect(shortcut).toHaveTextContent("⌘K")
      expect(shortcut).toHaveClass("custom-shortcut")
    })
  })

  describe("Command Component", () => {
    it("renders Command and manages search state via CommandInput", () => {
      const handleValueChange = vi.fn()
      render(
        <Command data-testid="command-root" className="custom-command">
          <CommandInput
            data-testid="command-input"
            placeholder="Type a command..."
            onValueChange={handleValueChange}
          />
          <CommandList data-testid="command-list">
            <CommandEmpty data-testid="command-empty">No results found</CommandEmpty>
            <CommandGroup heading="Suggestions" data-testid="command-group">
              <CommandItem data-testid="item-1">Calendar</CommandItem>
              <CommandItem data-testid="item-2" disabled>
                Calculator
              </CommandItem>
            </CommandGroup>
            <CommandSeparator data-testid="command-sep" />
          </CommandList>
        </Command>
      )

      expect(screen.getByTestId("command-root")).toHaveClass("custom-command")
      const input = screen.getByTestId("command-input") as HTMLInputElement
      fireEvent.change(input, { target: { value: "test query" } })
      expect(handleValueChange).toHaveBeenCalledWith("test query")
      expect(input.value).toBe("test query")
    })

    it("handles CommandItem click and keyboard selection (Enter, Space)", () => {
      const handleSelect = vi.fn()
      render(
        <Command>
          <CommandList>
            <CommandItem data-testid="active-item" onSelect={handleSelect}>
              Selectable Item
            </CommandItem>
            <CommandItem data-testid="disabled-item" disabled onSelect={handleSelect}>
              Disabled Item
            </CommandItem>
          </CommandList>
        </Command>
      )

      const activeItem = screen.getByTestId("active-item")
      fireEvent.click(activeItem)
      expect(handleSelect).toHaveBeenCalledTimes(1)

      fireEvent.keyDown(activeItem, { key: "Enter" })
      expect(handleSelect).toHaveBeenCalledTimes(2)

      fireEvent.keyDown(activeItem, { key: " " })
      expect(handleSelect).toHaveBeenCalledTimes(3)

      const disabledItem = screen.getByTestId("disabled-item")
      fireEvent.click(disabledItem)
      expect(handleSelect).toHaveBeenCalledTimes(3) // should not increase
    })
  })

  describe("Calendar Component", () => {
    it("renders Calendar in single date mode and allows selecting a day", () => {
      const handleSelect = vi.fn()
      const initialDate = new Date(2026, 7, 1) // Aug 2026

      render(
        <Calendar
          initialMonth={initialDate}
          mode="single"
          onSelect={handleSelect}
        />
      )

      expect(screen.getByText("Agosto 2026")).toBeInTheDocument()
      expect(screen.getByText("Dom")).toBeInTheDocument()
      expect(screen.getByText("Seg")).toBeInTheDocument()

      const day15 = screen.getByText("15")
      fireEvent.click(day15)
      expect(handleSelect).toHaveBeenCalled()
      const selectedDate = handleSelect.mock.calls[0][0]
      expect(selectedDate.getDate()).toBe(15)
      expect(selectedDate.getMonth()).toBe(7)
      expect(selectedDate.getFullYear()).toBe(2026)
    })

    it("navigates months using previous and next buttons", () => {
      const initialDate = new Date(2026, 7, 1) // Aug 2026
      render(<Calendar initialMonth={initialDate} />)

      expect(screen.getByText("Agosto 2026")).toBeInTheDocument()

      const nextBtn = screen.getByRole("button", { name: "Próximo mês" })
      fireEvent.click(nextBtn)
      expect(screen.getByText("Setembro 2026")).toBeInTheDocument()

      const prevBtn = screen.getByRole("button", { name: "Mês anterior" })
      fireEvent.click(prevBtn)
      expect(screen.getByText("Agosto 2026")).toBeInTheDocument()
    })

    it("respects disabled dates callback", () => {
      const handleSelect = vi.fn()
      const initialDate = new Date(2026, 7, 1)
      render(
        <Calendar
          initialMonth={initialDate}
          disabled={(date) => date.getDate() === 20}
          onSelect={handleSelect}
        />
      )

      const day20 = screen.getByText("20")
      expect(day20).toBeDisabled()
      fireEvent.click(day20)
      expect(handleSelect).not.toHaveBeenCalled()
    })

    it("handles range mode selection", () => {
      const handleSelect = vi.fn()
      const initialDate = new Date(2026, 7, 1)

      const { rerender } = render(
        <Calendar
          initialMonth={initialDate}
          mode="range"
          selected={{ from: undefined, to: undefined }}
          onSelect={handleSelect}
        />
      )

      const day10 = screen.getByText("10")
      fireEvent.click(day10)
      expect(handleSelect).toHaveBeenCalledWith(
        expect.objectContaining({ from: expect.any(Date), to: undefined })
      )

      // Simulate range state update
      const fromDate = new Date(2026, 7, 10)
      rerender(
        <Calendar
          initialMonth={initialDate}
          mode="range"
          selected={{ from: fromDate, to: undefined }}
          onSelect={handleSelect}
        />
      )

      const day20 = screen.getByText("20")
      fireEvent.click(day20)
      expect(handleSelect).toHaveBeenLastCalledWith(
        expect.objectContaining({ from: fromDate, to: expect.any(Date) })
      )
    })
  })

  describe("Sidebar Components", () => {
    it("renders Sidebar within SidebarProvider and toggles state via SidebarTrigger", () => {
      function TestSidebar() {
        const { state } = useSidebar()
        return (
          <div>
            <span data-testid="sidebar-state">{state}</span>
            <SidebarTrigger data-testid="sidebar-trigger" />
            <Sidebar data-testid="sidebar-root">
              <SidebarHeader data-testid="sidebar-header">Header</SidebarHeader>
              <SidebarContent data-testid="sidebar-content">
                <SidebarGroup>
                  <SidebarGroupLabel>Menu Group</SidebarGroupLabel>
                  <SidebarGroupAction data-testid="group-action">+</SidebarGroupAction>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      <SidebarMenuItem>
                        <SidebarMenuButton data-testid="btn-item-1" isActive>
                          <span>Item 1</span>
                        </SidebarMenuButton>
                        <SidebarMenuBadge data-testid="badge-1">5</SidebarMenuBadge>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          data-testid="btn-item-2"
                          render={<a href="/test">Item 2 Link</a>}
                        />
                      </SidebarMenuItem>
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              </SidebarContent>
              <SidebarFooter data-testid="sidebar-footer">Footer</SidebarFooter>
            </Sidebar>
            <SidebarRail data-testid="sidebar-rail" />
            <SidebarInset data-testid="sidebar-inset">Main Inset</SidebarInset>
          </div>
        )
      }

      render(
        <SidebarProvider defaultOpen={true}>
          <TestSidebar />
        </SidebarProvider>
      )

      expect(screen.getByTestId("sidebar-state")).toHaveTextContent("expanded")
      const trigger = screen.getByTestId("sidebar-trigger")
      fireEvent.click(trigger)
      expect(screen.getByTestId("sidebar-state")).toHaveTextContent("collapsed")
      fireEvent.click(trigger)
      expect(screen.getByTestId("sidebar-state")).toHaveTextContent("expanded")

      expect(screen.getByTestId("badge-1")).toHaveTextContent("5")
    })

    it("throws error when useSidebar is used outside SidebarProvider", () => {
      function BadComponent() {
        useSidebar()
        return null
      }
      expect(() => render(<BadComponent />)).toThrow(
        "useSidebar must be used within a SidebarProvider."
      )
    })
  })
})
