import React from 'react';
import ChaosIcon from './ChaosIcon';
import DivineIcon from './DivineIcon';
import { electronService } from '../../electron.service';
import './Pricing.css';

const { logger } = electronService;

const OptionalDivineValue = ({ value, divinePrice }) => {
  const parsedDivinePrice = parseFloat(divinePrice);
  const parsedValue = parseFloat(value);
  if(parsedDivinePrice > 0 && parsedValue > (0.01 * parsedDivinePrice)) {
    return <>({(parsedValue / parsedDivinePrice).toFixed(2)}<DivineIcon />)</>;
  }
  return <></>;
}

const Price = ({ value, divinePrice = 0 }) => {
  return (
    <span className="Price">
      {value}<ChaosIcon /><OptionalDivineValue value={value} divinePrice={divinePrice} />
    </span>
  );
}

export default Price;