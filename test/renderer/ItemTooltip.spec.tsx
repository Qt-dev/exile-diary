import React from 'react';
import { render, screen } from '@testing-library/react';
import ItemTooltip from '../../src/renderer/components/Item/ItemTooltip';

const makeItem = (rawData: Record<string, unknown>) => ({
  id: 'item-3-29',
  rawData: {
    id: 'item-3-29',
    name: 'Compatibility Test Item',
    typeLine: 'Test Base',
    icon: 'https://example.invalid/item.png',
    w: 1,
    h: 1,
    identified: true,
    ilvl: 86,
    properties: [],
    ...rawData,
  },
});

describe('ItemTooltip API compatibility', () => {
  it('renders structured 3.29 modifiers and applies modifier flag styling', () => {
    const item = makeItem({
      frameTypeId: 'rare',
      implicitMods: [{ description: '+20 to maximum Life', flags: {} }],
      explicitMods: [
        { description: '+42% to Fire Resistance', flags: { fractured: true } },
        { description: '+55 to maximum Life', flags: { crafted: true } },
      ],
    });

    const { container } = render(<ItemTooltip item={item} influenceIcons={[]} />);

    expect(screen.getByText('+20 to maximum Life')).toHaveClass('Text--Implicit');
    expect(screen.getByText('+42% to Fire Resistance')).toHaveClass('Text--Fractured');
    expect(screen.getByText('+55 to maximum Life')).toHaveClass('Text--Crafted');
    expect(container.querySelector('.Item-Tooltip__Container--Rare')).toBeInTheDocument();
  });

  it('continues to render legacy string modifier arrays and legacy crafted modifiers', () => {
    const item = makeItem({
      frameType: 2,
      implicitMods: ['+16 to maximum Life'],
      explicitMods: ['+35% to Cold Resistance'],
      craftedMods: ['+28 to maximum Life'],
    });

    render(<ItemTooltip item={item} influenceIcons={[]} />);

    expect(screen.getByText('+16 to maximum Life')).toHaveClass('Text--Implicit');
    expect(screen.getByText('+35% to Cold Resistance')).toHaveClass('Text--Explicit');
    expect(screen.getByText('+28 to maximum Life')).toHaveClass('Text--Crafted');
  });
});
