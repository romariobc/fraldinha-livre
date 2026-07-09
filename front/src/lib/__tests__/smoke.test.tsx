import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { formatPrice } from '@/lib/utils';

describe('Smoke Tests', () => {
  it('should pass a pure math test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should import from alias and format price correctly', () => {
    const result = formatPrice(1800);
    expect(result).toBe('R$ 18,00');
  });

  it('should render and match with jest-dom', () => {
    const { container } = render(<div>ok</div>);
    const div = container.querySelector('div');
    expect(div).toBeInTheDocument();
    expect(div).toHaveTextContent('ok');
  });
});
