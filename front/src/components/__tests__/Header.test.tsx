/// <reference types="vitest/globals" />

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import Header from '../Header'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

// Mock @/contexts/auth-context
const mockSignOutUser = vi.fn()
vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(),
}))

// Mock @/contexts/cart-context
vi.mock('@/contexts/cart-context', () => ({
  useCart: vi.fn(),
}))

import { useAuth } from '@/contexts/auth-context'
import { useCart } from '@/contexts/cart-context'

const mockUseAuth = vi.mocked(useAuth)
const mockUseCart = vi.mocked(useCart)

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Deslogado', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: null,
        profile: null,
        role: null,
        loading: false,
        signInGoogle: vi.fn(),
    signInEmail: vi.fn(),
    signUpEmail: vi.fn(),
        signOutUser: mockSignOutUser,
        updateProfile: vi.fn(),
      })
      mockUseCart.mockReturnValue({
        items: [],
        itemCount: 0,
        subtotal: 0,
        bySupplier: new Map(),
        addItem: vi.fn(),
        removeItem: vi.fn(),
        updateQty: vi.fn(),
        clear: vi.fn(),
      })
    })

    it('should display "Entrar" and "Criar conta grátis" buttons when logged out', () => {
      render(<Header />)

      expect(screen.getByRole('link', { name: /Entrar/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /Criar conta grátis/i })).toBeInTheDocument()
    })

    it('should not display account dropdown when logged out', () => {
      render(<Header />)

      expect(screen.queryByText('Minha conta')).not.toBeInTheDocument()
    })

    it('should display cart icons pointing to /sacola with no badge when itemCount is 0', () => {
      render(<Header />)

      const cartLinks = screen.getAllByLabelText('Sacola')
      expect(cartLinks.length).toBeGreaterThan(0)

      // All cart links should point to /sacola
      cartLinks.forEach((link) => {
        expect(link).toHaveAttribute('href', '/sacola')
        // Badge should not be present when itemCount is 0
        expect(link.querySelector('span')).not.toBeInTheDocument()
      })
    })
  })

  describe('Logado', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: {
          uid: 'user-123',
          email: 'user@example.com',
          displayName: 'John Doe',
        },
        profile: null,
        role: null,
        loading: false,
        signInGoogle: vi.fn(),
    signInEmail: vi.fn(),
    signUpEmail: vi.fn(),
        signOutUser: mockSignOutUser,
        updateProfile: vi.fn(),
      })
      mockUseCart.mockReturnValue({
        items: [],
        itemCount: 3,
        subtotal: 0,
        bySupplier: new Map(),
        addItem: vi.fn(),
        removeItem: vi.fn(),
        updateQty: vi.fn(),
        clear: vi.fn(),
      })
    })

    it('should display cart icons pointing to /sacola with badge when logged in', () => {
      render(<Header />)

      const cartLinks = screen.getAllByLabelText('Sacola')
      expect(cartLinks.length).toBeGreaterThan(0)

      // All cart links should point to /sacola and have badges
      cartLinks.forEach((link) => {
        expect(link).toHaveAttribute('href', '/sacola')
        const badge = link.querySelector('span')
        expect(badge).toBeInTheDocument()
        expect(badge).toHaveTextContent('3')
      })
    })

    it('should display user displayName as trigger button', () => {
      render(<Header />)

      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    it('should display email when displayName is not available', () => {
      mockUseAuth.mockReturnValue({
        user: {
          uid: 'user-123',
          email: 'user@example.com',
          displayName: null,
        },
        profile: null,
        role: null,
        loading: false,
        signInGoogle: vi.fn(),
    signInEmail: vi.fn(),
    signUpEmail: vi.fn(),
        signOutUser: mockSignOutUser,
        updateProfile: vi.fn(),
      })

      render(<Header />)

      expect(screen.getByText('user@example.com')).toBeInTheDocument()
    })

    it('should open account dropdown when clicking on name trigger', async () => {
      const user = userEvent.setup()
      render(<Header />)

      const trigger = screen.getByRole('button', { name: /John Doe/i })
      await user.click(trigger)

      // Menu items should appear
      expect(screen.getByRole('menuitem', { name: /Minha conta/i })).toBeInTheDocument()
      expect(screen.getByRole('menuitem', { name: /Sair/i })).toBeInTheDocument()
    })

    it('should toggle dropdown open/closed on trigger click', async () => {
      const user = userEvent.setup()
      render(<Header />)

      const trigger = screen.getByRole('button', { name: /John Doe/i })

      // First click: open
      await user.click(trigger)
      expect(screen.getByRole('menuitem', { name: /Minha conta/i })).toBeInTheDocument()

      // Second click: close
      await user.click(trigger)
      await waitFor(() => {
        expect(screen.queryByRole('menuitem', { name: /Minha conta/i })).not.toBeInTheDocument()
      })
    })

    it('should have Minha conta link with correct href in dropdown', async () => {
      const user = userEvent.setup()
      render(<Header />)

      const trigger = screen.getByRole('button', { name: /John Doe/i })
      await user.click(trigger)

      const minhaContaLink = screen.getByRole('menuitem', { name: /Minha conta/i })
      expect(minhaContaLink).toHaveAttribute('href', '/minha-conta')
    })

    it('should call signOutUser when clicking "Sair"', async () => {
      const user = userEvent.setup()
      render(<Header />)

      const trigger = screen.getByRole('button', { name: /John Doe/i })
      await user.click(trigger)

      const sairBtn = screen.getByRole('menuitem', { name: /Sair/i })
      await user.click(sairBtn)

      expect(mockSignOutUser).toHaveBeenCalled()
    })

    it('should close dropdown when clicking outside', async () => {
      const user = userEvent.setup()
      render(<Header />)

      const trigger = screen.getByRole('button', { name: /John Doe/i })
      await user.click(trigger)

      expect(screen.getByRole('menuitem', { name: /Minha conta/i })).toBeInTheDocument()

      // Click outside
      await user.click(document.body)

      await waitFor(() => {
        expect(screen.queryByRole('menuitem', { name: /Minha conta/i })).not.toBeInTheDocument()
      })
    })

    it('should close dropdown when pressing Escape', async () => {
      const user = userEvent.setup()
      render(<Header />)

      const trigger = screen.getByRole('button', { name: /John Doe/i })
      await user.click(trigger)

      expect(screen.getByRole('menuitem', { name: /Minha conta/i })).toBeInTheDocument()

      // Press Escape
      await user.keyboard('{Escape}')

      await waitFor(() => {
        expect(screen.queryByRole('menuitem', { name: /Minha conta/i })).not.toBeInTheDocument()
      })
    })

    it('should show trigger with aria-haspopup and aria-expanded attributes', async () => {
      const user = userEvent.setup()
      render(<Header />)

      const trigger = screen.getByRole('button', { name: /John Doe/i })
      expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
      expect(trigger).toHaveAttribute('aria-expanded', 'false')

      await user.click(trigger)

      expect(trigger).toHaveAttribute('aria-expanded', 'true')
    })

    it('should display cart badges with correct itemCount values', () => {
      mockUseCart.mockReturnValue({
        items: [],
        itemCount: 5,
        subtotal: 0,
        bySupplier: new Map(),
        addItem: vi.fn(),
        removeItem: vi.fn(),
        updateQty: vi.fn(),
        clear: vi.fn(),
      })

      render(<Header />)

      const cartLinks = screen.getAllByLabelText('Sacola')
      cartLinks.forEach((link) => {
        const badge = link.querySelector('span')
        expect(badge).toHaveTextContent('5')
      })
    })

    it('should not display cart badges when itemCount is 0', () => {
      mockUseCart.mockReturnValue({
        items: [],
        itemCount: 0,
        subtotal: 0,
        bySupplier: new Map(),
        addItem: vi.fn(),
        removeItem: vi.fn(),
        updateQty: vi.fn(),
        clear: vi.fn(),
      })

      render(<Header />)

      const cartLinks = screen.getAllByLabelText('Sacola')
      cartLinks.forEach((link) => {
        expect(link.querySelector('span')).not.toBeInTheDocument()
      })
    })

    it('should have correct dropdown role and menu items roles for a11y', async () => {
      const user = userEvent.setup()
      render(<Header />)

      const trigger = screen.getByRole('button', { name: /John Doe/i })
      await user.click(trigger)

      // Check dropdown has correct role
      const menu = screen.getByRole('menu')
      expect(menu).toBeInTheDocument()

      // Check all items have menuitem role
      const menuItems = screen.getAllByRole('menuitem')
      expect(menuItems.length).toBeGreaterThanOrEqual(2) // At least Minha conta, Sair
    })
  })

  describe('Mobile menu', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: {
          uid: 'user-123',
          email: 'user@example.com',
          displayName: 'John Doe',
        },
        profile: null,
        role: null,
        loading: false,
        signInGoogle: vi.fn(),
    signInEmail: vi.fn(),
    signUpEmail: vi.fn(),
        signOutUser: mockSignOutUser,
        updateProfile: vi.fn(),
      })
      mockUseCart.mockReturnValue({
        items: [],
        itemCount: 2,
        subtotal: 0,
        bySupplier: new Map(),
        addItem: vi.fn(),
        removeItem: vi.fn(),
        updateQty: vi.fn(),
        clear: vi.fn(),
      })
    })

    it('should display cart icon in mobile view', () => {
      render(<Header />)

      const cartLinks = screen.getAllByLabelText('Sacola')
      expect(cartLinks.length).toBeGreaterThan(0)
      cartLinks.forEach((link) => {
        expect(link).toHaveAttribute('href', '/sacola')
      })
    })

    it('should display "Minha conta" in mobile menu when logged in', async () => {
      const user = userEvent.setup()
      render(<Header />)

      // Open mobile menu
      const menuButton = screen.getByRole('button', { name: /Abrir menu/i })
      await user.click(menuButton)

      // Mobile menu should contain Minha conta link
      const links = screen.getAllByRole('link')
      const minhaContaLink = links.find((link) => link.textContent?.includes('Minha conta') && link.getAttribute('href') === '/minha-conta')

      expect(minhaContaLink).toBeInTheDocument()
    })

    it('should display "Sair" button in mobile menu when logged in', async () => {
      const user = userEvent.setup()
      render(<Header />)

      // Open mobile menu
      const menuButton = screen.getByRole('button', { name: /Abrir menu/i })
      await user.click(menuButton)

      const sairButtons = screen.getAllByRole('button', { name: /Sair/i })
      expect(sairButtons.length).toBeGreaterThan(0)
    })

    it('should not display account menu items in mobile menu when logged out', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        profile: null,
        role: null,
        loading: false,
        signInGoogle: vi.fn(),
    signInEmail: vi.fn(),
    signUpEmail: vi.fn(),
        signOutUser: mockSignOutUser,
        updateProfile: vi.fn(),
      })

      const user = userEvent.setup()
      render(<Header />)

      // Open mobile menu
      const menuButton = screen.getByRole('button', { name: /Abrir menu/i })
      await user.click(menuButton)

      // Should only show Entrar/Criar conta, not Minha conta
      expect(screen.queryByText('Minha conta')).not.toBeInTheDocument()
    })
  })
})
