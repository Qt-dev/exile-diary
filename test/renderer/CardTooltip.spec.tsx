import React from 'react';
import { render, screen } from '@testing-library/react';
import CardTooltip from '../../src/renderer/components/Item/CardTooltip';

describe('CardTooltip API compatibility', () => {
  it('renders structured 3.29 reward modifiers', () => {
    render(
      <CardTooltip
        item={{
          rawData: {
            artFilename: 'the-doctor',
            explicitMods: [{ description: '<default>{A Doctor}' }],
            flavourText: [],
            maxStackSize: 8,
            pickupStackSize: 1,
            stackSize: 1,
            typeLine: 'The Doctor',
          },
        }}
      />
    );

    expect(screen.getByText('A Doctor')).toBeInTheDocument();
  });
});
