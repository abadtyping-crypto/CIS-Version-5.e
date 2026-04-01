import SignatureCard from './SignatureCard';

const toTwoWords = (value) => {
  const words = String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length <= 2) return words.join(' ');
  return `${words[0]} ${words[1]}`.trim();
};

const CreatedByIdentityCard = ({
  uid = '',
  displayName = '',
  avatarUrl = '',
  className = '',
  contentClassName = '',
  ...rest
}) => {
  const resolvedName = toTwoWords(displayName) || 'System';

  return (
    <SignatureCard
      uid={uid}
      displayName={resolvedName}
      avatarUrl={avatarUrl || '/avatar.png'}
      className={className}
      contentClassName={contentClassName}
      titleMode="wrap"
      {...rest}
    />
  );
};

export default CreatedByIdentityCard;
