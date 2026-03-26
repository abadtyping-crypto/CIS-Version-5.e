import React from 'react';

/**
 * Renders the Dirham icon from public/dirham.svg
 */
const Icon = ({ className = 'h-4 w-4', inField = false, insideTab = false }) => {
    const placeInsideField = inField || insideTab;
    const finalClassName = [
        placeInsideField ? 'pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2' : '',
        'dirham-icon inline-block select-none',
        className,
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <img
            src="/dirham.svg"
            alt="Dhs"
            className={finalClassName}
            draggable={false}
        />
    );
};

export default Icon;
