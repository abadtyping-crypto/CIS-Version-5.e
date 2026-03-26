import React from 'react';
import DirhamIcon from './DirhamIcon';

/**
 * Standardized component for displaying currency values with the Dirham icon.
 */
const CurrencyValue = ({
    value = 0,
    className = '',
    iconSize = 'h-3.5 w-3.5',
    showZero = true,
    decimalPlaces = 2
}) => {
    if (value === 0 && !showZero) return null;

    const formattedValue = Number(value).toLocaleString(undefined, {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
    });

    return (
        <span className={`inline-flex items-center gap-1.5 font-bold ${className}`}>
            <DirhamIcon className={iconSize} />
            <span>{formattedValue}</span>
        </span>
    );
};

export default CurrencyValue;
