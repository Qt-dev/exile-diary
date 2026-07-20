import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import Item from '../../src/renderer/components/Item/Item';

vi.mock('../../src/renderer/components/Item/Sockets', () => ({
  default: () => <div>Sockets</div>,
}));
vi.mock('../../src/renderer/components/Item/ItemTooltip', () => ({
  default: () => <div>Item Tooltip</div>,
}));
vi.mock('../../src/renderer/components/Item/CardTooltip', () => ({
  default: () => <div>Card Tooltip</div>,
}));

describe('Item component', () => {
  it('renders influence icons without relying on CommonJS require', () => {
    const item = {
      fractured: false,
      influence: ['shaper'],
      rawData: {
        frameType: 2,
      },
      sockets: [],
      styleModifiers: {},
      synthesised: false,
      veiled: false,
      getDisplayName: () => ['Shaped Item'],
      itemClass: 'Armor',
      rarity: 2,
    };

    render(<Item item={item} />);

    expect(screen.getByText('Shaped Item')).toBeInTheDocument();
    expect(screen.getByAltText('influence-shaper')).toBeInTheDocument();
  });
});
