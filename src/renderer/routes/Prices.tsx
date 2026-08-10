import React, { useEffect, useState, useMemo } from 'react';
import {
  Button,
  ButtonGroup,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Tooltip,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import FilterListIcon from '@mui/icons-material/FilterList';
import EditIcon from '@mui/icons-material/Edit';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import CalculateIcon from '@mui/icons-material/Calculate';
import Price from '../components/Pricing/Price';
import ItemPriceModal from '../components/Prices/ItemPriceModal';
import { electronService } from '../electron.service';
import './Prices.css';

type CatalogItem = {
  id: string;
  name: string;
  category: string;
  icon?: string;
  unitChaosPrice: number;
  unitDivinePrice: number;
  droppedQuantity: number;
  totalChaosValue: number;
  hasOverride: boolean;
  activeOverride?: {
    price: number;
    currencyType: 'chaos' | 'divine';
    inputPrice: number;
    updatedAt: string;
  };
};

type SortField = 'name' | 'category' | 'droppedQuantity' | 'unitChaosPrice' | 'totalChaosValue' | 'hasOverride';
type SortDirection = 'asc' | 'desc';
type TimeRangePreset = '1h' | '3h' | '6h' | '12h' | '1d' | '1w' | 'all' | 'custom';

const TIME_RANGE_PRESETS: { key: TimeRangePreset; label: string }[] = [
  { key: '1h', label: '1hr' },
  { key: '3h', label: '3hr' },
  { key: '6h', label: '6hr' },
  { key: '12h', label: '12hr' },
  { key: '1d', label: '1 Day' },
  { key: '1w', label: '1 Week' },
  { key: 'all', label: 'All Time' },
  { key: 'custom', label: 'Custom' },
];

export default function Prices() {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItemIdentifier, setSelectedItemIdentifier] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [timePreset, setTimePreset] = useState<TimeRangePreset>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'all' | 'dropped' | 'overrides'>('all');

  // Sorting & Pagination
  const [sortField, setSortField] = useState<SortField>('totalChaosValue');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [page, setPage] = useState(0);
  const rowsPerPage = 50;

  const [divinePrice, setDivinePrice] = useState(150);

  // Recalculate Dialog state
  const [recalcDialogOpen, setRecalcDialogOpen] = useState(false);
  const [recalcPreset, setRecalcPreset] = useState<TimeRangePreset>('all');
  const [recalcFrom, setRecalcFrom] = useState('');
  const [recalcTo, setRecalcTo] = useState('');
  const [recalculating, setRecalculating] = useState(false);
  const [recalcResult, setRecalcResult] = useState<{ updatedRuns: number; updatedItems: number } | null>(null);

  const loadDivinePrice = async () => {
    try {
      const p = await electronService.getDivinePrice();
      if (p > 0) setDivinePrice(p);
    } catch {
      // ignore
    }
  };

  const loadCatalog = async (options: { silent?: boolean } = {}) => {
    if (!options.silent) setLoading(true);
    try {
      const items = await electronService.getPricesCatalog({
        timePreset,
        from: customFrom,
        to: customTo,
        search: searchQuery,
        category: selectedCategory,
      });
      setCatalog(items || []);
    } catch (err) {
      console.error('Failed to load prices catalog:', err);
    } finally {
      if (!options.silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadDivinePrice();
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [timePreset, customFrom, customTo, selectedCategory]);

  // Refresh the catalog whenever prices update in the background (e.g. daily
  // auto-refresh, or the "Fetch Rates" debug action), without blanking the table.
  useEffect(() => {
    const unsubscribe = electronService.on('pricesUpdated', () => {
      loadDivinePrice();
      loadCatalog({ silent: true });
    });
    return unsubscribe;
  }, [timePreset, customFrom, customTo, searchQuery, selectedCategory]);

  const handleExecuteRecalculate = async () => {
    setRecalculating(true);
    setRecalcResult(null);
    try {
      const res = await electronService.recalculatePrices({
        timePreset: recalcPreset,
        from: recalcFrom,
        to: recalcTo,
      });

      setRecalcResult(res || { updatedRuns: 0, updatedItems: 0 });
      await loadCatalog();
    } catch (err) {
      console.error('Error recalculating prices:', err);
    } finally {
      setRecalculating(false);
    }
  };

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const item of catalog) {
      if (item.category) set.add(item.category);
    }
    return ['All', ...Array.from(set).sort()];
  }, [catalog]);

  const filteredAndSortedItems = useMemo(() => {
    let result = [...catalog];

    // Client-side instant text filter
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter === 'dropped') {
      result = result.filter((item) => item.droppedQuantity > 0);
    } else if (statusFilter === 'overrides') {
      result = result.filter((item) => item.hasOverride);
    }

    // Sorting
    result.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal || '').toLowerCase();
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      aVal = Number(aVal) || 0;
      bVal = Number(bVal) || 0;
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return result;
  }, [catalog, searchQuery, statusFilter, sortField, sortDirection]);

  // Pagination slice
  const paginatedItems = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredAndSortedItems.slice(start, start + rowsPerPage);
  }, [filteredAndSortedItems, page, rowsPerPage]);

  const totalPages = Math.ceil(filteredAndSortedItems.length / rowsPerPage);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setPage(0);
  };

  // Summary statistics
  const summaryStats = useMemo(() => {
    let totalItems = catalog.length;
    let overrideCount = 0;
    let droppedCount = 0;
    let totalLootValue = 0;

    for (const item of catalog) {
      if (item.hasOverride) overrideCount++;
      if (item.droppedQuantity > 0) {
        droppedCount += item.droppedQuantity;
        totalLootValue += item.totalChaosValue;
      }
    }

    return {
      totalItems,
      overrideCount,
      droppedCount,
      totalLootValue: Number(totalLootValue.toFixed(2)),
    };
  }, [catalog]);

  return (
    <div className="Prices">
      {/* Header */}
      <div className="Prices__Header">
        <div>
          <h1 className="Prices__Title">Prices & Loot Valuation</h1>
          <p className="Prices__Subtitle">
            Track economy rates, configure static price overrides, and analyze loot value over time.
          </p>
        </div>
        <div className="Prices__HeaderActions">
          <Button
            variant="contained"
            color="primary"
            startIcon={<CalculateIcon />}
            onClick={() => {
              setRecalcResult(null);
              setRecalcDialogOpen(true);
            }}
            className="Prices__RecalcBtn"
          >
            Recalculate Prices
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => loadCatalog()}
            disabled={loading}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="Prices__StatsRow">
        <div className="Prices__StatCard">
          <div className="Prices__StatLabel">Catalog Items</div>
          <div className="Prices__StatValue">{summaryStats.totalItems}</div>
        </div>
        <div className="Prices__StatCard">
          <div className="Prices__StatLabel">Active Overrides</div>
          <div className="Prices__StatValue" style={{ color: '#f59e0b' }}>
            {summaryStats.overrideCount}
          </div>
        </div>
        <div className="Prices__StatCard">
          <div className="Prices__StatLabel">Loot Dropped in Window</div>
          <div className="Prices__StatValue">{summaryStats.droppedCount} items</div>
        </div>
        <div className="Prices__StatCard">
          <div className="Prices__StatLabel">Total Dropped Value</div>
          <div className="Prices__StatValue">
            <Price value={summaryStats.totalLootValue} divinePrice={divinePrice} />
          </div>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="Prices__FilterBar">
        {/* Search Input */}
        <div className="Prices__SearchWrapper">
          <TextField
            variant="outlined"
            size="small"
            placeholder="Search items by name or category..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(0);
            }}
            InputProps={{
              startAdornment: <SearchIcon className="Prices__SearchIcon" fontSize="small" />,
            }}
            className="Prices__SearchField"
          />
        </div>

        {/* Time Preset Buttons */}
        <div className="Prices__TimePresetGroup">
          <span className="Prices__FilterLabel">Loot Window:</span>
          <ButtonGroup size="small" className="Prices__ButtonGroup">
            {TIME_RANGE_PRESETS.map(({ key, label }) => (
              <Button
                key={key}
                onClick={() => setTimePreset(key)}
                variant={timePreset === key ? 'contained' : 'outlined'}
                style={{
                  ...(timePreset === key
                    ? { background: '#4f6ef7', color: '#fff', borderColor: '#4f6ef7' }
                    : { color: '#94a3b8', borderColor: 'rgba(255,255,255,0.15)' }),
                }}
              >
                {label}
              </Button>
            ))}
          </ButtonGroup>
        </div>

        {/* Custom Range Inputs */}
        {timePreset === 'custom' && (
          <div className="Prices__CustomRange">
            <TextField
              type="datetime-local"
              size="small"
              label="From"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              type="datetime-local"
              size="small"
              label="To"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </div>
        )}

        {/* Category Dropdown */}
        <FormControl size="small" className="Prices__CategorySelect">
          <InputLabel id="category-select-label">Category</InputLabel>
          <Select
            labelId="category-select-label"
            value={selectedCategory}
            label="Category"
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(0);
            }}
          >
            {categories.map((cat) => (
              <MenuItem key={cat} value={cat}>
                {cat}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Status Filter Buttons */}
        <div className="Prices__StatusFilter">
          <ButtonGroup size="small" className="Prices__ButtonGroup">
            {(
              [
                { key: 'all', label: 'All' },
                { key: 'dropped', label: 'Dropped Only' },
                { key: 'overrides', label: 'Overrides Only' },
              ] as { key: typeof statusFilter; label: string }[]
            ).map(({ key, label }) => (
              <Button
                key={key}
                variant={statusFilter === key ? 'contained' : 'outlined'}
                onClick={() => {
                  setStatusFilter(key);
                  setPage(0);
                }}
                style={{
                  ...(statusFilter === key
                    ? { background: '#4f6ef7', color: '#fff', borderColor: '#4f6ef7' }
                    : { color: '#94a3b8', borderColor: 'rgba(255,255,255,0.15)' }),
                }}
              >
                {label}
              </Button>
            ))}
          </ButtonGroup>
        </div>
      </div>

      {/* Items Table */}
      <div className="Prices__TableContainer">
        {loading ? (
          <div className="Prices__Loading">
            <CircularProgress size="2.5rem" />
            <span>Loading pricing catalog...</span>
          </div>
        ) : filteredAndSortedItems.length === 0 ? (
          <div className="Prices__Empty">
            <FilterListIcon fontSize="large" style={{ opacity: 0.3 }} />
            <p>No items found matching your filters.</p>
          </div>
        ) : (
          <table className="Prices__Table">
            <thead>
              <tr>
                <th onClick={() => handleSort('name')} className="sortable">
                  <div className="Prices__ThContent">
                    <span>Item</span>
                    {sortField === 'name' && (
                      sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="inherit" /> : <ArrowDownwardIcon fontSize="inherit" />
                    )}
                  </div>
                </th>
                <th onClick={() => handleSort('category')} className="sortable">
                  <div className="Prices__ThContent">
                    <span>Category</span>
                    {sortField === 'category' && (
                      sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="inherit" /> : <ArrowDownwardIcon fontSize="inherit" />
                    )}
                  </div>
                </th>
                <th onClick={() => handleSort('unitChaosPrice')} className="sortable align-right">
                  <div className="Prices__ThContent right">
                    <span>Unit Price</span>
                    {sortField === 'unitChaosPrice' && (
                      sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="inherit" /> : <ArrowDownwardIcon fontSize="inherit" />
                    )}
                  </div>
                </th>
                <th onClick={() => handleSort('droppedQuantity')} className="sortable align-right">
                  <div className="Prices__ThContent right">
                    <span>Dropped Qty</span>
                    {sortField === 'droppedQuantity' && (
                      sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="inherit" /> : <ArrowDownwardIcon fontSize="inherit" />
                    )}
                  </div>
                </th>
                <th onClick={() => handleSort('totalChaosValue')} className="sortable align-right">
                  <div className="Prices__ThContent right">
                    <span>Total Dropped Value</span>
                    {sortField === 'totalChaosValue' && (
                      sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="inherit" /> : <ArrowDownwardIcon fontSize="inherit" />
                    )}
                  </div>
                </th>
                <th onClick={() => handleSort('hasOverride')} className="sortable align-center">
                  <div className="Prices__ThContent center">
                    <span>Override</span>
                    {sortField === 'hasOverride' && (
                      sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="inherit" /> : <ArrowDownwardIcon fontSize="inherit" />
                    )}
                  </div>
                </th>
                <th className="align-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map((item) => (
                <tr
                  key={item.id}
                  className="Prices__TableRow"
                  onClick={() => setSelectedItemIdentifier(item.name)}
                >
                  <td>
                    <div className="Prices__ItemCell">
                      {item.icon ? (
                        <img src={item.icon} alt={item.name} className="Prices__ItemIcon" />
                      ) : (
                        <div className="Prices__ItemIconPlaceholder">
                          {item.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="Prices__ItemName">{item.name}</span>
                    </div>
                  </td>
                  <td>
                    <span className="Prices__CategoryBadge">{item.category}</span>
                  </td>
                  <td className="align-right">
                    <div className="Prices__PriceCell">
                      <Price value={item.unitChaosPrice} divinePrice={divinePrice} />
                      <span className="Prices__DivineSub">({item.unitDivinePrice} div)</span>
                    </div>
                  </td>
                  <td className="align-right">
                    <span className={item.droppedQuantity > 0 ? 'Prices__DroppedActive' : 'Prices__DroppedZero'}>
                      {item.droppedQuantity}
                    </span>
                  </td>
                  <td className="align-right">
                    {item.totalChaosValue > 0 ? (
                      <Price value={item.totalChaosValue} divinePrice={divinePrice} />
                    ) : (
                      <span className="Prices__DroppedZero">0 c</span>
                    )}
                  </td>
                  <td className="align-center">
                    {item.hasOverride ? (
                      <span className="Prices__OverrideBadge">
                        {item.activeOverride?.inputPrice} {item.activeOverride?.currencyType}
                      </span>
                    ) : (
                      <span className="Prices__MarketBadge">Market</span>
                    )}
                  </td>
                  <td className="align-center">
                    <Tooltip title="View price history & set override">
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<EditIcon fontSize="small" />}
                        className="Prices__EditBtn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedItemIdentifier(item.name);
                        }}
                      >
                        Edit
                      </Button>
                    </Tooltip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="Prices__Pagination">
          <Button
            size="small"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Previous
          </Button>
          <span className="Prices__PageInfo">
            Page {page + 1} of {totalPages} ({filteredAndSortedItems.length} items)
          </span>
          <Button
            size="small"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          >
            Next
          </Button>
        </div>
      )}

      {/* Item Price History & Override Modal */}
      {selectedItemIdentifier && (
        <ItemPriceModal
          itemIdentifier={selectedItemIdentifier}
          onClose={() => setSelectedItemIdentifier(null)}
          onOverrideUpdated={loadCatalog}
        />
      )}

      {/* Recalculate Prices Dialog */}
      <Dialog
        open={recalcDialogOpen}
        onClose={() => !recalculating && setRecalcDialogOpen(false)}
        PaperProps={{
          style: {
            background: '#141724',
            color: '#e2e8f0',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '10px',
            minWidth: '420px',
          },
        }}
      >
        <DialogTitle style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
          Recalculate Historical Prices
        </DialogTitle>
        <DialogContent style={{ paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>
            Select the time window of historical runs and drops to backdate with active static price overrides and market rates:
          </p>

          <ButtonGroup size="small" variant="outlined" style={{ width: '100%', flexWrap: 'wrap' }}>
            {TIME_RANGE_PRESETS.map(({ key, label }) => (
              <Button
                key={key}
                onClick={() => setRecalcPreset(key)}
                variant={recalcPreset === key ? 'contained' : 'outlined'}
                style={{
                  flex: 1,
                  ...(recalcPreset === key
                    ? { background: '#4f6ef7', color: '#fff', borderColor: '#4f6ef7' }
                    : { color: '#94a3b8', borderColor: 'rgba(255,255,255,0.15)' }),
                }}
              >
                {label}
              </Button>
            ))}
          </ButtonGroup>

          {recalcPreset === 'custom' && (
            <div className="Prices__CustomRange" style={{ flexWrap: 'nowrap' }}>
              <TextField
                type="datetime-local"
                size="small"
                label="From"
                value={recalcFrom}
                onChange={(e) => setRecalcFrom(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                type="datetime-local"
                size="small"
                label="To"
                value={recalcTo}
                onChange={(e) => setRecalcTo(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </div>
          )}

          {recalcResult && (
            <div
              style={{
                background: 'rgba(34, 197, 94, 0.15)',
                border: '1px solid #22c55e',
                borderRadius: '6px',
                padding: '10px 14px',
                color: '#4ade80',
                fontSize: '0.85rem',
              }}
            >
              ✓ Successfully updated {recalcResult.updatedItems} items across {recalcResult.updatedRuns} runs.
            </div>
          )}
        </DialogContent>
        <DialogActions style={{ padding: '16px 24px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <Button onClick={() => setRecalcDialogOpen(false)} disabled={recalculating} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleExecuteRecalculate}
            disabled={recalculating}
            variant="contained"
            color="primary"
          >
            {recalculating ? <CircularProgress size="1.2rem" color="inherit" /> : 'Execute Recalculation'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
