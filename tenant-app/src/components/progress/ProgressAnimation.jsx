import { useTenant } from '../../context/useTenant';
import './GlobalProgress.css';

const ProgressAnimation = ({ size = 'md', className = '' }) => {
  const { tenant } = useTenant();

  const sizeClasses = {
    sm: 'h-12 w-12',
    md: 'h-24 w-24',
    lg: 'h-32 w-32'
  };

  return (
    <div className={`relative flex items-center justify-center ${sizeClasses[size]} ${className}`}>
      {/* Background Orbiting Rings */}
      <div className="absolute inset-0 animate-spin-slow rounded-full border-2 border-dashed border-(--c-accent)/20" />
      <div className="absolute inset-2 animate-reverse-pulse rounded-full border-2 border-dotted border-(--c-accent)/40" />
      
      {/* Central Branded Logo */}
      <div className="relative z-10 flex h-4/5 w-4/5 items-center justify-center rounded-2xl bg-(--c-panel) p-2 shadow-lg shadow-(--c-accent)/10 border border-(--c-border)/50">
        {tenant?.logoUrl ? (
          <img src={tenant.logoUrl} alt={tenant.name} className="h-full w-full object-contain" />
        ) : (
          <div className="flex flex-col items-center">
             <span className="text-xl font-black text-(--c-accent) tracking-tighter">ACIS</span>
             <div className="h-1 w-8 rounded-full bg-linear-to-r from-(--c-accent) to-transparent mt-0.5" />
          </div>
        )}
      </div>

      {/* Pulsing Dots */}
      <div className="absolute -top-1 -right-1 h-3 w-3 animate-ping rounded-full bg-(--c-accent)/60" />
      <div className="absolute -bottom-1 -left-1 h-3 w-3 animate-ping delay-300 rounded-full bg-(--c-accent)/40" />
    </div>
  );
};

export default ProgressAnimation;
