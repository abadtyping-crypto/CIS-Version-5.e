import React from 'react';

const ImageZoomTool = ({
    sourceUrl,
    onReset,
    zoom,
    setZoom,
    offsetX,
    setOffsetX,
    offsetY,
    setOffsetY,
    filter,
    setFilter,
    filterMap,
    onFileChange,
    title = "Zoom & Cropping Tool",
    tip = "Tip: Zoom in first to enable more precise panning.",
    previewBgClass = "bg-[var(--c-surface)]",
    previewFrame = true,
    previewRoundedClass = "rounded-full",
    rotation = 0,
    setRotation = () => { },
    showRotation = false,
}) => {
    const previewFilter = filterMap[filter]?.css || 'none';

    return (
        <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] p-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-[var(--c-border)] pb-3">
                <p className="text-sm font-bold text-[var(--c-text)]">{title}</p>
                <button
                    type="button"
                    onClick={onReset}
                    className="text-xs font-semibold text-[var(--c-accent)] hover:underline"
                >
                    Reset Tool
                </button>
            </div>
            <div className="mt-4 grid gap-6 lg:grid-cols-[auto_1fr]">
                <div className="flex flex-col items-center gap-3">
                    <div className={`relative h-40 w-40 overflow-hidden ${previewRoundedClass} shadow-md ${previewBgClass} ${previewFrame ? 'border-4 border-[var(--c-surface)]' : ''}`}>
                        <img
                            src={sourceUrl || '/avatar.png'}
                            alt="Preview"
                            className="h-full w-full object-cover"
                            style={{
                                transform: `scale(${zoom}) rotate(${rotation}deg) translate(${offsetX / zoom}%, ${offsetY / zoom}%)`,
                                filter: previewFilter,
                                transformOrigin: 'center center',
                            }}
                        />
                    </div>
                    <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--c-accent)] px-4 py-2 text-xs font-bold text-white transition hover:opacity-90">
                        Choose Photo
                        <input type="file" accept="image/*" className="hidden" onChange={onFileChange} />
                    </label>
                </div>

                <div className="grid gap-4">
                    <div className="grid grid-cols-2 gap-4">
                        <label className="text-[10px] font-bold tracking-tight text-[var(--c-muted)] uppercase">
                            Zoom Level
                            <input
                                type="range"
                                min="1"
                                max="3"
                                step="0.01"
                                value={zoom}
                                onChange={(event) => setZoom(Number(event.target.value || 1))}
                                className="accent-[var(--c-accent)] mt-2 w-full cursor-pointer"
                            />
                        </label>
                        <label className="text-[10px] font-bold tracking-tight text-[var(--c-muted)] uppercase">
                            Color Filter
                            <select
                                className="mt-1 block w-full rounded-lg border-none bg-[var(--c-surface)] px-2 py-1.5 text-xs text-[var(--c-text)] focus:ring-0"
                                value={filter}
                                onChange={(event) => setFilter(event.target.value)}
                            >
                                {Object.entries(filterMap).map(([key, option]) => (
                                    <option key={key} value={key}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <label className="text-[10px] font-bold tracking-tight text-[var(--c-muted)] uppercase">
                            Horizontal Pan
                            <input
                                type="range"
                                min="-100"
                                max="100"
                                step="1"
                                value={offsetX}
                                onChange={(event) => setOffsetX(Number(event.target.value || 0))}
                                className="accent-[var(--c-accent)] mt-2 w-full cursor-pointer"
                            />
                        </label>
                        <label className="text-[10px] font-bold tracking-tight text-[var(--c-muted)] uppercase">
                            Vertical Pan
                            <input
                                type="range"
                                min="-100"
                                max="100"
                                step="1"
                                value={offsetY}
                                onChange={(event) => setOffsetY(Number(event.target.value || 0))}
                                className="accent-[var(--c-accent)] mt-2 w-full cursor-pointer"
                            />
                        </label>
                    </div>
                    {showRotation ? (
                        <label className="text-[10px] font-bold tracking-tight text-[var(--c-muted)] uppercase">
                            Rotation
                            <input
                                type="range"
                                min="-180"
                                max="180"
                                step="1"
                                value={rotation}
                                onChange={(event) => setRotation(Number(event.target.value || 0))}
                                className="accent-[var(--c-accent)] mt-2 w-full cursor-pointer"
                            />
                        </label>
                    ) : null}
                    <p className="text-[10px] text-[var(--c-muted)] italic">
                        {tip}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ImageZoomTool;
