import { describe, it, expect, vi } from 'vitest'
import { createWorkersAiChatCompletion } from '../src/lib/chat-completion'
import { notifySupplierOfNewOrder } from '../src/lib/notifications'
// @ts-expect-error import raw do Vite/Vitest para leitura estática do wrangler.jsonc
import rawWrangler from '../wrangler.jsonc?raw'

describe('OBS-001A — Higienização de Logs e Observabilidade Cloudflare', () => {
  describe('1. Configuração do Wrangler', () => {
    it('observability.enabled deve estar configurado como true no wrangler.jsonc', () => {
      // Remove comentários de linha // e trailing commas para permitir JSON.parse
      const sanitizedJson = rawWrangler
        .replace(/\/\/.*/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/,\s*([}\]])/g, '$1')
        .trim()
        
      const parsed = JSON.parse(sanitizedJson)
      expect(parsed.observability).toBeDefined()
      expect(parsed.observability.enabled).toBe(true)
      expect(parsed.observability.logs.enabled).toBe(true)
      expect(parsed.observability.logs.persist).toBe(true)
    })
  })

  describe('2. Higienização de Logs no Chat (chat-completion)', () => {
    it('não deve logar o conteúdo textual/bruto da mensagem do usuário nem a resposta crua', async () => {
      const sensitiveContent = 'Meu CPF é 123.456.789-00 e meu telefone é 11999998888 na Rua das Flores'
      const sensitiveResponse = 'Confirmando seus dados: 123.456.789-00'
      
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      const mockAi = {
        run: vi.fn().mockResolvedValue({
          response: sensitiveResponse,
          tool_calls: [
            {
              id: 'call_1',
              function: { name: 'search_products', arguments: { query: 'fralda' } },
            },
          ],
        }),
      }

      const runChatCompletion = createWorkersAiChatCompletion(mockAi as any)
      
      await runChatCompletion(
        [{ role: 'user', content: sensitiveContent }],
        [
          {
            name: 'search_products',
            description: 'Busca produtos',
            parameters: { type: 'object', properties: { query: { type: 'string' } } },
          },
        ],
      )

      expect(logSpy).toHaveBeenCalled()
      
      // Analisa todas as chamadas de console.log emitidas
      for (const callArgs of logSpy.mock.calls) {
        const fullLogMessage = callArgs.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg))).join(' ')
        
        // Garante que nenhum dado pessoal/sensível vazou no log
        expect(fullLogMessage).not.toContain(sensitiveContent)
        expect(fullLogMessage).not.toContain('123.456.789-00')
        expect(fullLogMessage).not.toContain('11999998888')
        expect(fullLogMessage).not.toContain(sensitiveResponse)
        
        // Se for o log de [chat-diag], valida que contém apenas metadados
        if (fullLogMessage.includes('[chat-diag]')) {
          const payload = JSON.parse(callArgs[1])
          expect(payload).toHaveProperty('hasUserMessage', true)
          expect(payload).toHaveProperty('userMessageLength', sensitiveContent.length)
          expect(payload).toHaveProperty('messagesCount', 1)
          expect(payload).toHaveProperty('responseLength', sensitiveResponse.length)
          expect(payload).toHaveProperty('toolCallsCount', 1)
          expect(payload).toHaveProperty('toolNames', ['search_products'])
          expect(payload).not.toHaveProperty('lastUserMessage')
          expect(payload).not.toHaveProperty('rawResponseText')
        }
      }

      logSpy.mockRestore()
    })
  })

  describe('3. Higienização de Logs em Notificações', () => {
    it('não deve expor endereço de e-mail completo do fornecedor ao simular envio', async () => {
      const secretEmail = 'fornecedor.confidencial.123@distribuidora.com.br'
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await notifySupplierOfNewOrder(
        {
          supplierEmail: secretEmail,
          orderId: 'ord-test-999',
          items: [{ productName: 'Fralda M', quantity: 2, unit: 'pct' }],
          totalCents: 5000,
        },
        {
          notificationsEnabled: false,
          sendEmail: vi.fn(),
        },
      )

      expect(logSpy).toHaveBeenCalled()
      
      for (const callArgs of logSpy.mock.calls) {
        const fullLogMessage = callArgs.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg))).join(' ')
        expect(fullLogMessage).not.toContain(secretEmail)
        if (fullLogMessage.includes('notification.simulated')) {
          const payload = JSON.parse(callArgs[0])
          expect(payload).toHaveProperty('event', 'notification.simulated')
          expect(payload).toHaveProperty('orderId', 'ord-test-999')
          expect(payload).not.toHaveProperty('supplierEmail')
        }
      }

      logSpy.mockRestore()
    })

    it('ao falhar envio, deve logar apenas mensagem técnica sanitizada sem expor o erro bruto', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const technicalError = new Error('Falha de conexão com Resend HTTP 503')

      await notifySupplierOfNewOrder(
        {
          supplierEmail: 'fornecedor@teste.com',
          orderId: 'ord-123',
          items: [{ productName: 'Fralda M', quantity: 1, unit: 'pct' }],
          totalCents: 2500,
        },
        {
          notificationsEnabled: true,
          sendEmail: vi.fn().mockRejectedValue(technicalError),
        },
      )

      expect(errorSpy).toHaveBeenCalled()
      const rawLog = errorSpy.mock.calls[0][0]
      const payload = JSON.parse(rawLog)
      expect(payload).toHaveProperty('level', 'error')
      expect(payload).toHaveProperty('event', 'notification.failed')
      expect(payload).toHaveProperty('orderId', 'ord-123')
      expect(payload).toHaveProperty('error', 'Falha de conexão com Resend HTTP 503')

      errorSpy.mockRestore()
    })
  })
})
