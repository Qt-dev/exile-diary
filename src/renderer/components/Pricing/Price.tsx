import React from 'react';
import ChaosIcon from './ChaosIcon';
import DivineIcon from './DivineIcon';
import './Pricing.css';

const OptionalDivineValue = ({ value, divinePrice, displayChaos }) => {
  const parsedDivinePrice = parseFloat(divinePrice);
  const parsedValue = parseFloat(value);
  if (parsedDivinePrice > 0 && parsedValue > 0.01 * parsedDivinePrice) {
    return (
      <>
        {displayChaos && '('}
        {(parsedValue / parsedDivinePrice).toFixed(2)}
        <DivineIcon />
        {displayChaos && ')'}
      </>
    );
  }
  return <></>;
};

const Price = ({ value, divinePrice = 0, displayChaos = true }) => {
  const realDivinePrice = divinePrice ?? 0;
  const shouldDisplayChaos = displayChaos || value < realDivinePrice;
  const formattedValue = parseFloat(parseFloat(value).toFixed(2)); // We make sure all values are formatted to 2 decimal places
  return (
    <span className="Price">
      {shouldDisplayChaos && (
        <>
          {formattedValue}
          <ChaosIcon />{' '}
        </>
      )}
      <OptionalDivineValue
        value={formattedValue}
        divinePrice={realDivinePrice}
        displayChaos={shouldDisplayChaos}
      />
    </span>
  );
};

export default Price;
