import React, { useEffect, useState, useMemo } from 'react';
import {
  Button,
  ButtonGroup,
  CircularProgress,
  IconButton,
  TextField,
  Tooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import StorefrontIcon from '@mui/icons-material/Storefront';
import Price from '../Pricing/Price';
import { electronService } from '../../electron.service';
import dayjs from 'dayjs';
import './ItemPriceModal.css';

type ItemPriceDetails = {
  identifier: string;
  category: string;
  icon?: string;
  unitChaosPrice: number;
  unitDivinePrice: number;
  divineChaosRate: number;
  sparkline: Array<{ time: string; price: number }>;
  activeOverride?: {
    price: number;
    currencyType: 'chaos' | 'divine';
    inputPrice: number;
    updatedAt: string;
  };
  drops: Array<{
    id: number;
    eventId: number;
    timestamp: string;
    value: number;
    stackSize: number;
    areaName?: string;
  }>;
  droppedQuantity: number;
  totalChaosValue: number;
};

interface ItemPriceModalProps {
  itemIdentifier: string;
  onClose: () => void;
  onOverrideUpdated?: () => void;
}

export default function ItemPriceModal({
  itemIdentifier,
  onClose,
  onOverrideUpdated,
}: ItemPriceModalProps) {
  const [details, setDetails] = useState<ItemPriceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form states
  const [priceInput, setPriceInput] = useState<string>('');
  const [currencyUnit, setCurrencyUnit] = useState<'chaos' | 'divine'>('chaos');
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    time: string;
    price: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const loadDetails = async (options: { silent?: boolean } = {}) => {
    if (!options.silent) setLoading(true);
    try {
      const data = await electronService.getItemPriceDetails(itemIdentifier);
      setDetails(data);
      if (data) {
        if (data.activeOverride) {
          setPriceInput(String(data.activeOverride.inputPrice));
          setCurrencyUnit(data.activeOverride.currencyType);
        } else if (data.unitChaosPrice > 0 && !priceInput) {
          setPriceInput(String(data.unitChaosPrice));
          setCurrencyUnit('chaos');
        }
      }
    } catch (err) {
      console.error('Failed to load item price details:', err);
    } finally {
      if (!options.silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadDetails();
  }, [itemIdentifier]);

  // Refresh the chart whenever prices update in the background (e.g. daily
  // auto-refresh, or the "Fetch Rates" debug action), without a loading flicker.
  useEffect(() => {
    const unsubscribe = electronService.on('pricesUpdated', () => {
      loadDetails({ silent: true });
    });
    return unsubscribe;
  }, [itemIdentifier]);

  const handleSaveOverride = async () => {
    setErrorMessage('');
    if (!priceInput || isNaN(Number(priceInput)) || Number(priceInput) < 0) {
      setErrorMessage('Please enter a valid price (>= 0)');
      return;
    }

    setSaving(true);
    try {
      await electronService.addPriceOverride({
        itemIdentifier,
        category: details?.category,
        price: Number(priceInput),
        currencyType: currencyUnit,
        inputPrice: Number(priceInput),
      });

      await loadDetails();
      if (onOverrideUpdated) onOverrideUpdated();
    } catch (err) {
      console.error('Failed to save override:', err);
      setErrorMessage('Failed to save override');
    } finally {
      setSaving(false);
    }
  };

  const handleResetToMarket = async () => {
    setDeleting(true);
    try {
      await electronService.deletePriceOverride(itemIdentifier);
      setPriceInput('');
      await loadDetails();
      if (onOverrideUpdated) onOverrideUpdated();
    } catch (err) {
      console.error('Failed to reset override:', err);
    } finally {
      setDeleting(false);
    }
  };

  // Build SVG chart geometry for 7-day 4-hour sparkline + static override flatline
  const chart = useMemo(() => {
    if (!details || !details.sparkline || details.sparkline.length === 0) return null;

    const width = 640;
    const height = 200;
    const padding = { top: 25, right: 30, bottom: 35, left: 55 };
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;

    const points = details.sparkline;
    const overridePrice = details.activeOverride ? details.activeOverride.price : null;

    const marketPrices = points.map((p) => p.price);
    const allPrices = overridePrice !== null ? [...marketPrices, overridePrice] : marketPrices;

    let minPrice = Math.min(...allPrices);
    let maxPrice = Math.max(...allPrices);

    if (minPrice === maxPrice) {
      minPrice = Math.max(0, minPrice * 0.8);
      maxPrice = maxPrice === 0 ? 10 : maxPrice * 1.2;
    }

    const priceRange = maxPrice - minPrice || 1;

    const getX = (index: number) =>
      padding.left + (index / (points.length - 1)) * innerWidth;
    const getY = (val: number) =>
      padding.top + innerHeight - ((val - minPrice) / priceRange) * innerHeight;

    const marketCoords = points.map((p, idx) => ({
      x: getX(idx),
      y: getY(p.price),
      time: p.time,
      price: p.price,
    }));

    const marketPath = marketCoords.reduce((acc, pt, idx) => {
      return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
    }, '');

    const marketAreaPath = `${marketPath} L ${padding.left + innerWidth} ${
      padding.top + innerHeight
    } L ${padding.left} ${padding.top + innerHeight} Z`;

    const overrideY = overridePrice !== null ? getY(overridePrice) : null;

    // Y Axis ticks
    const yTicks = [
      { val: maxPrice, y: getY(maxPrice) },
      { val: minPrice + priceRange / 2, y: getY(minPrice + priceRange / 2) },
      { val: minPrice, y: getY(minPrice) },
    ];

    // X Axis labels formatted from real timestamps
    const sampleIndices = points.length <= 5
      ? points.map((_, i) => i)
      : [
          0,
          Math.floor((points.length - 1) * 0.25),
          Math.floor((points.length - 1) * 0.5),
          Math.floor((points.length - 1) * 0.75),
          points.length - 1,
        ];
    const uniqueIndices = Array.from(new Set(sampleIndices));
    const xLabels = uniqueIndices.map((idx) => {
      const pt = points[idx];
      const date = dayjs(pt.time);
      return {
        label: date.isValid() ? date.format('MMM D') : `${idx}d`,
        x: getX(idx),
      };
    });

    return {
      width,
      height,
      padding,
      innerWidth,
      innerHeight,
      marketCoords,
      marketPath,
      marketAreaPath,
      overrideY,
      overridePrice,
      yTicks,
      xLabels,
    };
  }, [details]);

  return (
    <div className="ItemPriceModal__Overlay" onClick={onClose}>
      <div
        className="ItemPriceModal__Container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="ItemPriceModal__Header">
          <div className="ItemPriceModal__TitleGroup">
            {details?.icon ? (
              <img
                src={details.icon}
                alt={itemIdentifier}
                className="ItemPriceModal__Icon"
              />
            ) : (
              <div className="ItemPriceModal__IconPlaceholder">
                {itemIdentifier.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="ItemPriceModal__ItemName">{itemIdentifier}</h2>
              <span className="ItemPriceModal__Category">
                {details?.category || 'Item'}
              </span>
            </div>
          </div>
          <IconButton onClick={onClose} size="small" className="ItemPriceModal__CloseBtn">
            <CloseIcon />
          </IconButton>
        </div>

        {loading ? (
          <div className="ItemPriceModal__Loading">
            <CircularProgress size="2.5rem" />
            <span>Loading pricing details...</span>
          </div>
        ) : (
          <div className="ItemPriceModal__Content">
            {/* Stat Badges */}
            <div className="ItemPriceModal__StatsRow">
              <div className="ItemPriceModal__StatCard">
                <span className="ItemPriceModal__StatLabel">Current Value</span>
                <div className="ItemPriceModal__StatValue">
                  <Price value={details?.unitChaosPrice || 0} />
                  <span className="ItemPriceModal__StatSub">
                    ({details?.unitDivinePrice || 0} div)
                  </span>
                </div>
              </div>

              <div className="ItemPriceModal__StatCard">
                <span className="ItemPriceModal__StatLabel">Divine Ratio</span>
                <div className="ItemPriceModal__StatValue">
                  <span>1 div = {details?.divineChaosRate || 150} c</span>
                </div>
              </div>

              <div className="ItemPriceModal__StatCard">
                <span className="ItemPriceModal__StatLabel">Dropped Quantity</span>
                <div className="ItemPriceModal__StatValue">
                  <span>{details?.droppedQuantity || 0}</span>
                </div>
              </div>

              <div className="ItemPriceModal__StatCard">
                <span className="ItemPriceModal__StatLabel">Total Dropped Value</span>
                <div className="ItemPriceModal__StatValue">
                  <Price value={details?.totalChaosValue || 0} />
                </div>
              </div>
            </div>

            {/* 7-Day Price Chart */}
            <div className="ItemPriceModal__ChartSection">
              <div className="ItemPriceModal__ChartHeader">
                <div className="ItemPriceModal__ChartTitle">
                  <ShowChartIcon fontSize="small" />
                  <span>7-Day Market Trend (4h poe.ninja points) vs Override</span>
                </div>
                <div className="ItemPriceModal__ChartLegend">
                  <span className="ItemPriceModal__LegendItem market">
                    <span className="ItemPriceModal__LegendDot market"></span> Market (poe.ninja)
                  </span>
                  {details?.activeOverride && (
                    <span className="ItemPriceModal__LegendItem override">
                      <span className="ItemPriceModal__LegendDot override"></span> Static Override ({details.activeOverride.price} c)
                    </span>
                  )}
                </div>
              </div>

              {chart ? (
                <div className="ItemPriceModal__SvgWrapper">
                  <svg
                    viewBox={`0 0 ${chart.width} ${chart.height}`}
                    className="ItemPriceModal__Svg"
                  >
                    <defs>
                      <linearGradient id="marketGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Grid lines */}
                    {chart.yTicks.map((tick, i) => (
                      <g key={i}>
                        <line
                          x1={chart.padding.left}
                          y1={tick.y}
                          x2={chart.padding.left + chart.innerWidth}
                          y2={tick.y}
                          stroke="#334155"
                          strokeDasharray="3,3"
                        />
                        <text
                          x={chart.padding.left - 8}
                          y={tick.y + 4}
                          fill="#94a3b8"
                          fontSize="10"
                          textAnchor="end"
                        >
                          {Number(tick.val.toFixed(1))} c
                        </text>
                      </g>
                    ))}

                    {/* X Axis Labels */}
                    {chart.xLabels.map((xl, i) => (
                      <text
                        key={i}
                        x={xl.x}
                        y={chart.height - 10}
                        fill="#94a3b8"
                        fontSize="10"
                        textAnchor="middle"
                      >
                        {xl.label}
                      </text>
                    ))}

                    {/* Market Area & Line */}
                    <path d={chart.marketAreaPath} fill="url(#marketGrad)" />
                    <path
                      d={chart.marketPath}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="2.5"
                    />

                    {/* Static Override Flatline Bar */}
                    {chart.overrideY !== null && (
                      <g>
                        <line
                          x1={chart.padding.left}
                          y1={chart.overrideY}
                          x2={chart.padding.left + chart.innerWidth}
                          y2={chart.overrideY}
                          stroke="#f59e0b"
                          strokeWidth="2.5"
                          strokeDasharray="6,3"
                        />
                        <rect
                          x={chart.padding.left + chart.innerWidth - 120}
                          y={chart.overrideY - 18}
                          width="115"
                          height="16"
                          rx="3"
                          fill="#f59e0b"
                          opacity="0.9"
                        />
                        <text
                          x={chart.padding.left + chart.innerWidth - 62}
                          y={chart.overrideY - 6}
                          fill="#0f172a"
                          fontSize="9.5"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          Override: {chart.overridePrice} c
                        </text>
                      </g>
                    )}

                    {/* Interactive points */}
                    {chart.marketCoords.map((pt, i) => (
                      <circle
                        key={i}
                        cx={pt.x}
                        cy={pt.y}
                        r="4"
                        fill="#38bdf8"
                        stroke="#0f172a"
                        strokeWidth="2"
                        className="ItemPriceModal__ChartPoint"
                        onMouseEnter={() => setHoveredPoint(pt)}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                    ))}
                  </svg>

                  {/* Tooltip */}
                  {hoveredPoint && (
                    <div
                      className="ItemPriceModal__ChartTooltip"
                      style={{
                        left: `${hoveredPoint.x}px`,
                        top: `${hoveredPoint.y - 45}px`,
                      }}
                    >
                      <div className="ItemPriceModal__TooltipTime">
                        {dayjs(hoveredPoint.time).format('MMM D, HH:mm')}
                      </div>
                      <div className="ItemPriceModal__TooltipVal">
                        {hoveredPoint.price.toFixed(2)} chaos
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="ItemPriceModal__EmptyChart">
                  No 7-day rate history available for this item.
                </div>
              )}
            </div>

            {/* Static Price Override Control Box */}
            <div className="ItemPriceModal__OverrideSection">
              <h3 className="ItemPriceModal__SectionTitle">
                <StorefrontIcon fontSize="small" />
                <span>Static Price Override</span>
                {details?.activeOverride ? (
                  <span className="ItemPriceModal__ActiveTag">Active</span>
                ) : (
                  <span className="ItemPriceModal__MarketTag">Using Market</span>
                )}
              </h3>

              <div className="ItemPriceModal__OverrideCard">
                <div className="ItemPriceModal__FormRow">
                  <TextField
                    label="Override Unit Price"
                    variant="outlined"
                    size="small"
                    type="number"
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                    placeholder="Enter price..."
                    className="ItemPriceModal__Input"
                  />

                  <ButtonGroup size="small" className="ItemPriceModal__UnitToggle">
                    <Button
                      variant={currencyUnit === 'chaos' ? 'contained' : 'outlined'}
                      onClick={() => setCurrencyUnit('chaos')}
                      className={currencyUnit === 'chaos' ? 'active' : ''}
                    >
                      Chaos (c)
                    </Button>
                    <Button
                      variant={currencyUnit === 'divine' ? 'contained' : 'outlined'}
                      onClick={() => setCurrencyUnit('divine')}
                      className={currencyUnit === 'divine' ? 'active' : ''}
                    >
                      Divine (div)
                    </Button>
                  </ButtonGroup>

                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleSaveOverride}
                    disabled={saving}
                    className="ItemPriceModal__SaveBtn"
                  >
                    {saving ? (
                      <CircularProgress size="1.2rem" color="inherit" />
                    ) : (
                      'Apply Override'
                    )}
                  </Button>

                  {details?.activeOverride && (
                    <Button
                      variant="outlined"
                      color="warning"
                      onClick={handleResetToMarket}
                      disabled={deleting}
                      className="ItemPriceModal__ResetBtn"
                      startIcon={<DeleteIcon />}
                    >
                      {deleting ? (
                        <CircularProgress size="1.2rem" color="inherit" />
                      ) : (
                        'Reset to Market'
                      )}
                    </Button>
                  )}
                </div>

                {errorMessage && (
                  <div className="ItemPriceModal__Error">{errorMessage}</div>
                )}

                <div className="ItemPriceModal__HelpText">
                  {details?.activeOverride ? (
                    <span>
                      Active static override: <strong>{details.activeOverride.inputPrice} {details.activeOverride.currencyType}</strong> ({details.activeOverride.price} c). To backdate historical runs with this override, use <strong>Recalculate Prices</strong> on the Prices page.
                    </span>
                  ) : (
                    <span>
                      Setting a static override will force this fixed price for all current and future calculations of this item. To backdate historical runs, use the Recalculate Prices feature.
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Drop History Table */}
            {details?.drops && details.drops.length > 0 && (
              <div className="ItemPriceModal__TableSection">
                <h4 className="ItemPriceModal__TableTitle">
                  Drop History ({details.drops.length} drops)
                </h4>
                <table className="ItemPriceModal__Table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Quantity</th>
                      <th>Evaluated Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {details.drops.map((drop) => (
                      <tr key={drop.id}>
                        <td>{dayjs(drop.timestamp).format('YYYY-MM-DD HH:mm:ss')}</td>
                        <td>{drop.stackSize}</td>
                        <td>
                          <Price value={drop.value} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
