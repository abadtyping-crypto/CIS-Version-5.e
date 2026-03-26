import React from 'react';
import InputActionField from './InputActionField';

const toTitleCase = (value) => {
    if (!value) return '';
    return String(value)
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
};

const AddressField = ({ 
    label = 'Address', 
    name = 'address', 
    value, 
    onValueChange, 
    placeholder = 'Flat/Office, Building, Area...', 
    className = '', 
    inputClassName = '', 
    rows = 2,
    fieldClassName = 'h-[96px] w-full',
    ...props 
}) => {
    const handleChange = (val) => {
        if (onValueChange) {
            onValueChange(toTitleCase(val));
        }
    };

    return (
        <div className={`space-y-2 ${className}`.trim()}>
            {label && (
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">
                    {label}
                </label>
            )}
            <InputActionField
                name={name}
                multiline
                rows={rows}
                value={value}
                onValueChange={handleChange}
                placeholder={placeholder}
                className={fieldClassName}
                inputClassName={`h-full text-sm font-bold ${inputClassName}`.trim()}
                {...props}
            />
        </div>
    );
};

export default AddressField;
