import React, { useState } from 'react';
import Cropper from 'react-easy-crop';
import { RotateCcw, RotateCw, ZoomIn, ZoomOut, Image as ImageIcon, Check, X, SlidersHorizontal, Maximize, Trash2 } from 'lucide-react';

/**
 * ImageStudio: The advanced, interactive image cropping and editing component.
 * Replaces the old slider-only ImageZoomTool with a direct-interact, 
 * mouse-driven experience.
 */
const ImageStudio = ({
    sourceUrl,
    onReset,
    onFileChange,
    onCropComplete, // (croppedArea, croppedAreaPixels)
    zoom = 1,
    setZoom = () => { },
    rotation = 0,
    setRotation = () => { },
    filter = 'natural',
    setFilter = () => { },
    filterMap = {},
    title = "Image Studio",
    aspect = 1, // 1 for square (avatars/logos)
    cropShape = 'rect', // default square frame for icon workflows
    showFilters = true,
    workspaceHeightClass = 'h-[220px] sm:h-[260px] lg:h-[280px]',
    minZoom = 1,
    maxZoom = 3,
    wheelZoomSpeed = 0.24,
}) => {
    const [crop, setCrop] = useState({ x: 0, y: 0 });

    const onCropChange = (crop) => {
        setCrop(crop);
    };

    const handleZoomIn = () => setZoom(Math.min(maxZoom, zoom + 0.2));
    const handleZoomOut = () => setZoom(Math.max(minZoom, zoom - 0.2));
    const handleRotateLeft = () => setRotation(rotation - 90);
    const handleRotateRight = () => setRotation(rotation + 90);

    return (
        <div className="flex flex-col overflow-hidden rounded-3xl border border-[var(--c-border)] bg-[var(--c-surface)] shadow-2xl transition-all duration-300">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--c-border)] bg-[var(--c-panel)] px-5 py-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--c-accent)]/10 text-[var(--c-accent)]">
                        <ImageIcon className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-[var(--c-text)]">{title}</h3>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--c-muted)]">Interactive Workspace</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onReset}
                        className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--c-muted)] transition hover:bg-rose-500/10 hover:text-rose-500"
                        title="Clear Workspace"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Main Interactive Work Area */}
            <div className={`relative w-full overflow-hidden bg-[#0a0a0a] ${workspaceHeightClass}`}>
                {sourceUrl ? (
                    <Cropper
                        image={sourceUrl}
                        crop={crop}
                        zoom={zoom}
                        zoomSpeed={wheelZoomSpeed}
                        rotation={rotation}
                        aspect={aspect}
                        cropShape={cropShape}
                        showGrid={true}
                        onCropChange={onCropChange}
                        onCropComplete={onCropComplete}
                        minZoom={minZoom}
                        maxZoom={maxZoom}
                        onZoomChange={setZoom}
                        onRotationChange={setRotation}
                        style={{
                            containerStyle: { background: '#0a0a0a' },
                            cropAreaStyle: { border: '2px solid var(--c-accent)' },
                        }}
                    />
                ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-[var(--c-panel)] text-center p-8">
                        <div className="h-16 w-16 mb-2 rounded-full border-2 border-dashed border-[var(--c-border)] flex items-center justify-center text-[var(--c-border)]">
                            <ImageIcon className="h-8 w-8" />
                        </div>
                        <p className="text-sm font-bold text-[var(--c-text)]">No image selected</p>
                        <p className="max-w-[200px] text-xs leading-relaxed text-[var(--c-muted)]">Upload a high-quality logo or photo to start editing in the studio.</p>
                        <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-2xl bg-[var(--c-accent)] px-6 py-3 text-xs font-black text-white shadow-lg shadow-[var(--c-accent)]/20 transition hover:scale-105 active:scale-95">
                            UPLOAD PHOTO
                            <input type="file" accept="image/*" className="hidden" onChange={onFileChange} />
                        </label>
                    </div>
                )}
            </div>

            {/* Controls Bar */}
            {sourceUrl && (
                <div className="flex flex-col gap-5 bg-[var(--c-panel)] p-4 sm:p-5">
                    {/* Visual Controls */}
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto]">
                        <div className="flex flex-wrap items-center gap-4">
                            {/* Zoom Slider */}
                            <div className="flex flex-1 min-w-[140px] flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-[var(--c-muted)]">Zoom Precision</span>
                                    <span className="text-[10px] font-bold text-[var(--c-accent)]">{(zoom * 100).toFixed(0)}%</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button onClick={handleZoomOut} className="text-[var(--c-muted)] hover:text-[var(--c-accent)]"><ZoomOut className="h-4 w-4" /></button>
                                    <input
                                        type="range"
                                        min={minZoom}
                                        max={maxZoom}
                                        step="0.01"
                                        value={zoom}
                                        onChange={(e) => setZoom(Number(e.target.value))}
                                        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[var(--c-surface)] accent-[var(--c-accent)]"
                                    />
                                    <button onClick={handleZoomIn} className="text-[var(--c-muted)] hover:text-[var(--c-accent)]"><ZoomIn className="h-4 w-4" /></button>
                                </div>
                            </div>

                            {/* Rotation Buttons */}
                            <div className="flex flex-col gap-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--c-muted)]">Orientation</span>
                                <div className="flex items-center gap-1 rounded-2xl bg-[var(--c-surface)] p-1">
                                    <button
                                        onClick={handleRotateLeft}
                                        className="flex h-10 w-10 items-center justify-center rounded-xl transition hover:bg-[var(--c-panel)] hover:text-[var(--c-accent)]"
                                    >
                                        <RotateCcw className="h-4 w-4" />
                                    </button>
                                    <div className="h-4 w-[1px] bg-[var(--c-border)] mx-1" />
                                    <button
                                        onClick={handleRotateRight}
                                        className="flex h-10 w-10 items-center justify-center rounded-xl transition hover:bg-[var(--c-panel)] hover:text-[var(--c-accent)]"
                                    >
                                        <RotateCw className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Change Photo Button */}
                            <div className="flex flex-col gap-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--c-muted)]">Source</span>
                                <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] px-5 text-xs font-bold text-[var(--c-text)] transition hover:border-[var(--c-accent)] hover:bg-[var(--c-accent)]/5">
                                    Change Image
                                    <input type="file" accept="image/*" className="hidden" onChange={onFileChange} />
                                </label>
                            </div>
                        </div>

                        {/* Tip Box */}
                        <div className="hidden items-center gap-4 rounded-2xl bg-[var(--c-accent)]/5 px-4 lg:flex">
                            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
                                <Maximize className="h-5 w-5 text-[var(--c-accent)]" />
                            </div>
                            <p className="max-w-[150px] text-[10px] font-medium leading-relaxed text-[var(--c-text)]">
                                <span className="font-black text-[var(--c-accent)]">SMART TIP:</span> Use mouse drag to move and wheel to zoom instantly.
                            </p>
                        </div>
                    </div>

                    {/* Filter Presets */}
                    {showFilters && Object.keys(filterMap).length > 0 && (
                        <div className="border-t border-[var(--c-border)] pt-5">
                            <div className="mb-3 flex items-center justify-between">
                                <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--c-muted)]">
                                    <SlidersHorizontal className="h-3 w-3" />
                                    Visual Enhancement
                                </span>
                                <span className="text-[10px] font-bold text-[var(--c-accent)]">{filterMap[filter]?.label || 'Natural'}</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(filterMap).map(([key, option]) => (
                                    <button
                                        key={key}
                                        onClick={() => setFilter(key)}
                                        className={`flex-1 min-w-[80px] rounded-xl px-4 py-3 text-center text-[10px] font-black uppercase transition-all duration-300 ${filter === key
                                            ? 'bg-[var(--c-accent)] text-white shadow-lg shadow-[var(--c-accent)]/20 shadow-[-4px_-4px_10px_rgba(255,255,255,0.1)]'
                                            : 'bg-[var(--c-surface)] text-[var(--c-muted)] border border-[var(--c-border)] hover:border-[var(--c-accent)] hover:text-[var(--c-text)]'
                                            }`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ImageStudio;
