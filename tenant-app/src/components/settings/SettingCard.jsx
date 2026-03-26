const SettingCard = ({
  title,
  description,
  icon: Icon,
  children,
  showHeader = true,
  showDescription = true,
}) => {
  return (
    <section className="rounded-2xl border border-(--c-border) bg-(--c-surface) p-4 shadow-[0_14px_30px_-24px_rgba(15,23,42,0.7)] sm:p-5 transition-all duration-300">
      {showHeader ? (
        <div className="flex items-center gap-3">
          {Icon ? (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-(--c-panel) text-(--c-accent) shadow-[0_4px_12px_-4px_rgba(0,0,0,0.5)]">
              <Icon className="h-5 w-5" />
            </div>
          ) : null}
          <h2 className="font-title text-xl font-bold text-(--c-text)">{title}</h2>
        </div>
      ) : null}
      {showDescription && description ? (
        <p className={`${showHeader ? 'mt-2' : ''} text-sm font-medium text-(--c-muted)`}>{description}</p>
      ) : null}
      <div className="mt-6">{children}</div>
    </section>
  );
};

export default SettingCard;
