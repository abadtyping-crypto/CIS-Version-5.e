import { useTheme } from '../../context/useTheme';

const WatermarkOverlay = ({
  className = '',
  imageClassName = '',
}) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <div
      className={[
        'pointer-events-none absolute z-0 select-none',
        className,
      ].filter(Boolean).join(' ')}
      aria-hidden="true"
    >
      <div
        className={[
          'relative overflow-hidden rounded-[1.35rem] border backdrop-blur-sm',
          isDark
            ? 'border-white/14 bg-[rgba(255,255,255,0.04)] shadow-[0_18px_44px_-30px_rgba(0,0,0,0.6)]'
            : 'border-[color:color-mix(in_srgb,var(--c-border)_70%,white_30%)] bg-[rgba(255,255,255,0.2)] shadow-[0_18px_44px_-30px_rgba(15,23,42,0.22)]',
        ].join(' ')}
      >
        <div
          className={[
            'absolute inset-[1px] rounded-[calc(1.35rem-2px)]',
            isDark
              ? 'border border-white/8 bg-[linear-gradient(145deg,rgba(255,255,255,0.09),rgba(255,255,255,0.02))]'
              : 'border border-white/35 bg-[linear-gradient(145deg,rgba(255,255,255,0.58),rgba(255,255,255,0.12))]',
          ].join(' ')}
        />
        <div
          className={[
            'absolute inset-0',
            isDark
              ? 'bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.12),transparent_52%)]'
              : 'bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.56),transparent_52%)]',
          ].join(' ')}
        />
        <div className="relative px-4 py-3">
          <img
            src="/ACIS Icon/waterMark.png"
            alt=""
            className={[
              'h-auto w-[160px] max-w-[30vw] saturate-[0.95]',
              isDark ? 'opacity-[0.22] brightness-[1.4] contrast-[1.05]' : 'opacity-[0.14]',
              imageClassName,
            ].filter(Boolean).join(' ')}
          />
        </div>
      </div>
    </div>
  );
};

export default WatermarkOverlay;
