import React from 'react';
import ChaosIcon from './ChaosIcon';
import DivineIcon from './DivineIcon';
import './Pricing.css';

export const formatPriceNumber = (value, compact = false) => {
  const numericValue = parseFloat(value) || 0;
  const roundedValue = parseFloat(numericValue.toFixed(2));
  if (!compact || Math.abs(roundedValue) < 100_000) return roundedValue;

  const divisor = Math.abs(roundedValue) >= 1_000_000 ? 1_000_000 : 1_000;
  const suffix = divisor === 1_000_000 ? 'm' : 'k';
  return `${parseFloat((roundedValue / divisor).toFixed(2))}${suffix}`;
};

const OptionalDivineValue = ({ value, divinePrice, displayChaos, compact }) => {
  const parsedDivinePrice = parseFloat(divinePrice);
  const parsedValue = parseFloat(value);
  if (parsedDivinePrice > 0 && parsedValue > 0.01 * parsedDivinePrice) {
    return (
      <>
        {displayChaos && '('}
        {formatPriceNumber(parsedValue / parsedDivinePrice, compact)}
        <DivineIcon />
        {displayChaos && ')'}
      </>
    );
  }
  return <></>;
};

const Price = ({ value, divinePrice = 0, displayChaos = true, compact = false }) => {
  const realDivinePrice = divinePrice ?? 0;
  const shouldDisplayChaos = displayChaos || value < realDivinePrice;
  const formattedValue = parseFloat(parseFloat(value).toFixed(2)); // We make sure all values are formatted to 2 decimal places
  return (
    <span className="Price">
      {shouldDisplayChaos && (
        <>
          {formatPriceNumber(formattedValue, compact)}
          <ChaosIcon />{' '}
        </>
      )}
      <OptionalDivineValue
        value={formattedValue}
        divinePrice={realDivinePrice}
        displayChaos={shouldDisplayChaos}
        compact={compact}
      />
    </span>
  );
};

export default Price;
