import React, { useMemo, useState } from 'react';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: 'w-5 h-5 text-[10px]',
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-12 h-12 text-base',
};

export interface UserAvatarProps {
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  size?: AvatarSize;
  sizeClassName?: string;
  className?: string;
  fallbackClassName?: string;
  title?: string;
  onClick?: () => void;
}

function getInitials(name: string): string {
  const parts = name
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((part) => part[0]);

  if (parts.length >= 2) {
    return `${parts[0]}${parts[parts.length - 1]}`.toUpperCase();
  }

  return name.slice(0, 2).toUpperCase();
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  username,
  displayName,
  avatarUrl,
  size = 'md',
  sizeClassName,
  className = '',
  fallbackClassName = 'bg-neutral-800 text-neutral-300 border border-neutral-700',
  title,
  onClick,
}) => {
  const [hasImageError, setHasImageError] = useState(false);
  const initials = useMemo(() => getInitials(displayName || username), [displayName, username]);
  const resolvedSizeClassName = sizeClassName || SIZE_CLASSES[size];
  const baseClassName = `${resolvedSizeClassName} rounded-full flex-shrink-0 flex items-center justify-center font-bold uppercase overflow-hidden ${className}`.trim();
  const label = title || displayName || username;

  const content = avatarUrl && !hasImageError ? (
    <img
      src={avatarUrl}
      alt={username}
      className="w-full h-full object-cover"
      onError={() => setHasImageError(true)}
    />
  ) : (
    <span className={`${baseClassName} ${fallbackClassName}`.trim()}>{initials}</span>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={baseClassName} title={label}>
        {content}
      </button>
    );
  }

  return (
    <div className={baseClassName} title={label}>
      {content}
    </div>
  );
};

export default UserAvatar;
