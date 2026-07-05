import React from 'react';
import { render, screen } from '@testing-library/react';
import Item from '../../src/renderer/components/Item/Item';

jest.mock('../../src/renderer/components/Item/Sockets', () => () => <div>Sockets</div>);
jest.mock('../../src/renderer/components/Item/ItemTooltip', () => () => <div>Item Tooltip</div>);
jest.mock('../../src/renderer/components/Item/CardTooltip', () => () => <div>Card Tooltip</div>);

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
