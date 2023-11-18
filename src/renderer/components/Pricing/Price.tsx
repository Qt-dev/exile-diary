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
  const shouldDisplayChaos = displayChaos || value < divinePrice;
  return (
    <span className="Price">
      {shouldDisplayChaos && (
        <>
          {value}
          <ChaosIcon />{' '}
        </>
      )}
      <OptionalDivineValue
        value={value}
        divinePrice={divinePrice}
        displayChaos={shouldDisplayChaos}
      />
    </span>
  );
};

export default Price;
