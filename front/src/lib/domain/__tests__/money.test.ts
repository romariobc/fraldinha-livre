import { describe, it, expect } from 'vitest'
import { addMoney, multiplyMoney, sumMoney } from '../money'

describe('money domain', () => {
  describe('addMoney', () => {
    it('should add two positive amounts', () => {
      expect(addMoney(1000, 500)).toBe(1500)
    })

    it('should add zero', () => {
      expect(addMoney(1000, 0)).toBe(1000)
      expect(addMoney(0, 1000)).toBe(1000)
    })

    it('should throw on non-integer first parameter', () => {
      expect(() => addMoney(1000.5, 500)).toThrow(
        /addMoney: parameter a must be an integer/
      )
    })

    it('should throw on non-integer second parameter', () => {
      expect(() => addMoney(1000, 500.5)).toThrow(
        /addMoney: parameter b must be an integer/
      )
    })
  })

  describe('multiplyMoney', () => {
    it('should multiply correctly', () => {
      expect(multiplyMoney(1000, 5)).toBe(5000)
    })

    it('should multiply by zero', () => {
      expect(multiplyMoney(1000, 0)).toBe(0)
    })

    it('should multiply zero amount', () => {
      expect(multiplyMoney(0, 10)).toBe(0)
    })

    it('should throw on non-integer quantity', () => {
      expect(() => multiplyMoney(1000, 2.5)).toThrow(
        /multiplyMoney: quantity must be an integer/
      )
    })

    it('should throw on negative quantity', () => {
      expect(() => multiplyMoney(1000, -1)).toThrow(
        /multiplyMoney: quantity must be non-negative/
      )
    })

    it('should throw on non-integer value', () => {
      expect(() => multiplyMoney(1000.5, 2)).toThrow(
        /multiplyMoney: parameter value must be an integer/
      )
    })
  })

  describe('sumMoney', () => {
    it('should sum multiple amounts', () => {
      expect(sumMoney([1000, 2000, 3000])).toBe(6000)
    })

    it('should return zero for empty array', () => {
      expect(sumMoney([])).toBe(0)
    })

    it('should sum single item', () => {
      expect(sumMoney([1000])).toBe(1000)
    })

    it('should include zeros in sum', () => {
      expect(sumMoney([1000, 0, 500])).toBe(1500)
    })

    it('should throw on non-integer element', () => {
      expect(() => sumMoney([1000, 500.5, 2000])).toThrow(
        /sumMoney: array element must be an integer/
      )
    })

    it('should throw on first non-integer', () => {
      expect(() => sumMoney([1000.5, 500, 2000])).toThrow(
        /sumMoney: array element must be an integer/
      )
    })
  })
})
