import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import AssistentePage from '../page'

vi.mock('@/components/assistente/ChatUI', () => ({
  default: () => <div data-testid="chat-ui" />,
}))

it('shows the release notice and catalog link instead of starting chat', () => {
  render(<AssistentePage />)
  expect(screen.getByText('O assistente está indisponível nesta versão.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Abrir catálogo' })).toHaveAttribute('href', '/catalogo')
  expect(screen.queryByTestId('chat-ui')).not.toBeInTheDocument()
})
