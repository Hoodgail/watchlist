import React, { useEffect } from 'react';

export interface ModalFrameProps {
  children: React.ReactNode;
  onClose: () => void;
  className?: string;
  backdropClassName?: string;
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
}

export const ModalFrame: React.FC<ModalFrameProps> = ({
  children,
  onClose,
  className = 'modal-backdrop',
  backdropClassName = '',
  closeOnEscape = true,
  closeOnBackdrop = true,
}) => {
  useEffect(() => {
    if (!closeOnEscape) {
      return undefined;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [closeOnEscape, onClose]);

  return (
    <div
      className={`${className} ${backdropClassName}`.trim()}
      onClick={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      {children}
    </div>
  );
};

export default ModalFrame;
