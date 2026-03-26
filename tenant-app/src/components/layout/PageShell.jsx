import UniversalPageHeader from './UniversalPageHeader';

const PageShell = ({
  pageID,
  title,
  subtitle,
  icon: Icon,
  iconKey,
  actionSlot,
  widthPreset = 'content',
  maxWidthClass = '',
  children,
}) => {
  const widthClassByPreset = {
    content: 'compact-page-width-content',
    form: 'compact-page-width-form',
    data: 'compact-page-width-data',
    full: 'compact-page-width-full',
  };
  const effectiveMaxWidth = maxWidthClass || widthClassByPreset[widthPreset] || widthClassByPreset.content;
  const derivedPageID = String(pageID || iconKey || title || '').trim();
  const enableRemoteConfig = Boolean(pageID);

  return (
    <section className="compact-page">
      <div className={`compact-page ${effectiveMaxWidth}`}>
        {(derivedPageID || title) ? (
          <UniversalPageHeader
            pageID={derivedPageID}
            title={title}
            subtitle={subtitle}
            icon={Icon}
            iconKey={iconKey}
            actionSlot={actionSlot}
            enableRemoteConfig={enableRemoteConfig}
          />
        ) : null}

        {children}
      </div>
    </section>
  );
};


export default PageShell;
