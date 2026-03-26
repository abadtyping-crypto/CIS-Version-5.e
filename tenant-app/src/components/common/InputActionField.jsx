import { useState, useRef, useLayoutEffect } from 'react';
import { ClipboardPaste, Copy, Check, Plus } from 'lucide-react';

const baseWrapperClass = 'relative flex h-14 items-center overflow-hidden rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] text-[var(--c-text)] shadow-sm transition focus-within:border-[var(--c-accent)] focus-within:ring-4 focus-within:ring-[var(--c-accent)]/5 disabled:opacity-50';
const baseInputClass = 'h-full min-w-0 flex-1 bg-transparent px-4 text-sm font-semibold normal-case text-[var(--c-text)] outline-none placeholder:text-[var(--c-muted)] placeholder:font-medium';

const InputActionField = ({
    id,
    name,
    type = 'text',
    value = '',
    onValueChange,
    onBlur,
    placeholder = '',
    autoComplete,
    autoCorrect,
    spellCheck,
    required = false,
    maxLength,
    disabled = false,
    inputMode,
    rows = 3,
    multiline = false,
    className = '',
    inputClassName = '',
    showPasteButton = true,
    showCopyButton = false,
    onAppend,
    appendLabel = 'Add New',
    forceUppercase = false,
    leadIcon: LeadIcon,
}) => {
    const fieldRef = useRef(null);
    const [isCopied, setIsCopied] = useState(false);
    const selectionRef = useRef({ start: 0, end: 0 });

    const handleChange = (e) => {
        const input = e.target;
        const isTypeSupported = ['text', 'search', 'url', 'tel', 'password'].includes(input.type) || input.tagName === 'TEXTAREA';
        const normalizedValue = forceUppercase ? String(input.value || '').toUpperCase() : input.value;

        if (isTypeSupported) {
            selectionRef.current = { start: input.selectionStart, end: input.selectionEnd };
        }
        onValueChange?.(normalizedValue);
    };

    const handleBlur = (e) => {
        const normalizedValue = forceUppercase ? String(e.target.value || '').toUpperCase() : e.target.value;
        onBlur?.(normalizedValue, e);
    };

    useLayoutEffect(() => {
        if (fieldRef.current) {
            const isTypeSupported = ['text', 'search', 'url', 'tel', 'password'].includes(fieldRef.current.type) || fieldRef.current.tagName === 'TEXTAREA';
            if (isTypeSupported) {
                const { start, end } = selectionRef.current;
                try {
                    fieldRef.current.setSelectionRange(start, end);
                } catch {
                    // Silently ignore if selection is not supported
                }
            }
        }
    }, [value]);

    const handlePasteFromClipboard = async () => {
        if (disabled) return;
        try {
            const text = await navigator.clipboard.readText();
            if (typeof text === 'string' && text.length > 0) {
                onValueChange?.(forceUppercase ? text.toUpperCase() : text);
            }
        } catch (err) {
            console.warn('Clipboard read denied', err);
        }
    };

    const handleCopyToClipboard = async () => {
        if (!value) return;
        try {
            await navigator.clipboard.writeText(value);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        } catch (err) {
            console.warn('Clipboard write denied', err);
        }
    };

    if (multiline) {
        return (
            <div className={`${baseWrapperClass} ${className}`.trim()}>
                {LeadIcon && (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center border-r border-[var(--c-border)] bg-[var(--c-panel)]">
                        <LeadIcon className="h-6 w-6 text-[var(--c-muted)]" />
                    </div>
                )}
                <textarea
                    ref={fieldRef}
                    id={id}
                    name={name}
                    rows={rows}
                    required={required}
                    disabled={disabled}
                    maxLength={maxLength}
                    value={value}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder={placeholder}
                    autoComplete={autoComplete}
                    autoCorrect={autoCorrect}
                    spellCheck={spellCheck}
                    className={`h-full w-full resize-none bg-transparent px-4 pr-12 text-sm font-semibold normal-case text-[var(--c-text)] outline-none placeholder:text-[var(--c-muted)] placeholder:font-medium ${inputClassName}`.trim()}
                />
                <div className="absolute right-2 top-2 flex flex-col gap-1">
                    {showCopyButton && value ? (
                        <button
                            type="button"
                            onClick={handleCopyToClipboard}
                            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${isCopied ? 'text-emerald-500' : 'text-[var(--c-muted)] hover:bg-[var(--c-surface)] hover:text-[var(--c-accent)]'
                                }`}
                            title="Copy to clipboard"
                        >
                            {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </button>
                    ) : null}
                    {showPasteButton ? (
                        <button
                            type="button"
                            onClick={handlePasteFromClipboard}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--c-muted)] transition-colors hover:bg-[var(--c-surface)] hover:text-[var(--c-accent)]"
                            title="Paste from clipboard"
                        >
                            <ClipboardPaste className="h-4 w-4" />
                        </button>
                    ) : null}
                </div>
            </div>
        );
    }

    return (
        <div className={`${baseWrapperClass} ${className}`.trim()}>
            {LeadIcon && (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center border-r border-[var(--c-border)] bg-[var(--c-panel)]">
                    <LeadIcon className="h-6 w-6 text-[var(--c-muted)]" />
                </div>
            )}
            <input
                ref={fieldRef}
                id={id}
                name={name}
                type={type}
                required={required}
                disabled={disabled}
                maxLength={maxLength}
                value={value}
                inputMode={inputMode}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder={placeholder}
                autoComplete={autoComplete}
                autoCorrect={autoCorrect}
                spellCheck={spellCheck}
                className={`${baseInputClass} ${inputClassName}`.trim()}
            />
            {showCopyButton && value ? (
                <button
                    type="button"
                    onClick={handleCopyToClipboard}
                    className={`flex h-14 w-14 shrink-0 items-center justify-center transition-colors ${isCopied ? 'text-emerald-500' : 'text-[var(--c-muted)] hover:text-[var(--c-accent)]'
                        }`}
                    title="Copy to clipboard"
                >
                    {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
            ) : null}
            {showPasteButton ? (
                <button
                    type="button"
                    onClick={handlePasteFromClipboard}
                    className="flex h-14 w-14 shrink-0 items-center justify-center text-[var(--c-muted)] transition-colors hover:text-[var(--c-accent)]"
                    title="Paste from clipboard"
                >
                    <ClipboardPaste className="h-4 w-4" />
                </button>
            ) : null}
            {onAppend ? (
                <button
                    type="button"
                    onClick={onAppend}
                    className="flex h-14 w-14 shrink-0 items-center justify-center border-l border-[var(--c-border)] bg-[var(--c-panel)] text-[var(--c-muted)] transition hover:bg-[color:color-mix(in_srgb,var(--c-accent)_10%,var(--c-panel))] hover:text-[var(--c-accent)]"
                    aria-label={appendLabel}
                    title={appendLabel}
                >
                    <Plus className="h-4 w-4" />
                </button>
            ) : null}
        </div>
    );
};

export default InputActionField;
