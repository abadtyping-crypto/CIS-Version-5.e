import { useEffect, useRef, useState } from 'react';

const RouteTransitionOverlay = ({
  active,
  animationPath = '/acis_loading.json',
  title = 'ACIS',
  text = 'Switching workspace...',
  dismissible = false,
  onClose = null,
}) => {
  const [animationData, setAnimationData] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!active) return undefined;

    let alive = true;
    setLoadFailed(false);
    setAnimationData(null);

    fetch(animationPath)
      .then((response) => response.json())
      .then((data) => {
        if (alive) setAnimationData(data);
      })
      .catch(() => {
        if (alive) {
          setAnimationData(null);
          setLoadFailed(true);
        }
      });

    return () => {
      alive = false;
    };
  }, [active, animationPath]);

  useEffect(() => {
    const containerElement = containerRef.current;
    if (!active || !animationData || !containerElement) return undefined;

    let animationInstance = null;
    let alive = true;

    import('lottie-web').then((module) => {
      if (!alive || !containerElement) return;
      const lottie = module.default || module;
      animationInstance = lottie.loadAnimation({
        container: containerElement,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        animationData,
      });
    }).catch(() => {});

    return () => {
      alive = false;
      if (animationInstance) animationInstance.destroy();
      containerElement.innerHTML = '';
    };
  }, [active, animationData]);

  if (!active) return null;

  return (
    <div className="route-transition-overlay" aria-hidden="true">
      <div className="route-transition-card">
        {dismissible ? (
          <button
            type="button"
            onClick={onClose}
            className="route-transition-close"
          >
            Close
          </button>
        ) : null}
        <div className="route-transition-animation">
          {animationData ? (
            <div ref={containerRef} className="h-full w-full" />
          ) : (
            <div className="route-transition-fallback" />
          )}
        </div>
        <div className="route-transition-copy">
          <p className="route-transition-title">{title}</p>
          <p className="route-transition-text">
            {loadFailed ? 'Animation preview could not be loaded.' : text}
          </p>
        </div>
      </div>
    </div>
  );
};

export default RouteTransitionOverlay;
