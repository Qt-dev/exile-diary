import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import Prices from '../../src/renderer/routes/Prices';

vi.mock('../../src/renderer/electron.service', () => ({
  electronService: {
    getDivinePrice: vi.fn().mockResolvedValue(150),
    getPricesCatalog: vi.fn().mockResolvedValue([
      {
        id: 'Divine Orb',
        name: 'Divine Orb',
        category: 'Currency',
        unitChaosPrice: 150,
        unitDivinePrice: 1,
        droppedQuantity: 10,
        totalChaosValue: 1500,
        hasOverride: false,
      },
      {
        id: 'Mageblood',
        name: 'Mageblood',
        category: 'UniqueItem',
        unitChaosPrice: 35000,
        unitDivinePrice: 233.33,
        droppedQuantity: 0,
        totalChaosValue: 0,
        hasOverride: true,
        activeOverride: {
          price: 35000,
          currencyType: 'divine',
          inputPrice: 233.33,
          updatedAt: '2026-08-09 20:00:00',
        },
      },
    ]),
    getItemPriceDetails: vi.fn().mockResolvedValue({
      identifier: 'Divine Orb',
      category: 'Currency',
      unitChaosPrice: 150,
      unitDivinePrice: 1,
      divineChaosRate: 150,
      sparkline: [{ time: '2026-08-09T20:00:00.000Z', price: 150 }],
      activeOverride: undefined,
      drops: [],
      droppedQuantity: 10,
      totalChaosValue: 1500,
    }),
    addPriceOverride: vi.fn().mockResolvedValue({}),
    deletePriceOverride: vi.fn().mockResolvedValue(true),
    recalculatePrices: vi.fn().mockResolvedValue({ updatedRuns: 1, updatedItems: 5 }),
  },
}));

const { electronService: mockElectronService } = await import(
  '../../src/renderer/electron.service'
);

describe('Prices page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders catalog items and summary cards', async () => {
    render(<Prices />);

    await waitFor(() => {
      expect(screen.getByText('Prices & Loot Valuation')).toBeInTheDocument();
      expect(screen.getByText('Divine Orb')).toBeInTheDocument();
      expect(screen.getByText('Mageblood')).toBeInTheDocument();
    });

    expect(screen.getByText('Catalog Items')).toBeInTheDocument();
    expect(screen.getByText('Active Overrides')).toBeInTheDocument();
  });

  it('filters items when search input changes', async () => {
    render(<Prices />);

    await waitFor(() => {
      expect(screen.getByText('Divine Orb')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search items by name or category...');
    fireEvent.change(searchInput, { target: { value: 'Mageblood' } });

    expect(screen.getByText('Mageblood')).toBeInTheDocument();
    expect(screen.queryByText('Divine Orb')).not.toBeInTheDocument();
  });

  it('opens item price modal when clicking an item row', async () => {
    render(<Prices />);

    const divineRow = await screen.findByText('Divine Orb');
    fireEvent.click(divineRow);

    await waitFor(() => {
      expect(mockElectronService.getItemPriceDetails).toHaveBeenCalledWith('Divine Orb');
      expect(screen.getByText(/7-Day Market Trend/i)).toBeInTheDocument();
    });
  });

  it('opens recalculate dialog and executes recalculate', async () => {
    render(<Prices />);

    const recalcBtn = await screen.findByRole('button', { name: /recalculate prices/i });
    fireEvent.click(recalcBtn);

    expect(screen.getByText('Recalculate Historical Prices')).toBeInTheDocument();

    const executeBtn = screen.getByRole('button', { name: /execute recalculation/i });
    fireEvent.click(executeBtn);

    await waitFor(() => {
      expect(mockElectronService.recalculatePrices).toHaveBeenCalled();
    });
  });
});
