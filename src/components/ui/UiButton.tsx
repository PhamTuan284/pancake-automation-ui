import MuiButton from '@mui/material/Button';
import type { ButtonProps as MuiButtonProps } from '@mui/material/Button';
import type { ReactNode } from 'react';

type UiButtonVariant = 'primary' | 'secondary' | 'tiny';
type UiButtonTone = 'default' | 'danger';

type UiButtonProps = Omit<MuiButtonProps, 'variant' | 'color'> & {
  variant?: UiButtonVariant;
  tone?: UiButtonTone;
  children: ReactNode;
};

function classForVariant(variant: UiButtonVariant): string {
  if (variant === 'secondary') return 'btn-secondary';
  if (variant === 'tiny') return 'btn-tiny';
  return 'btn';
}

function joinClasses(...parts: Array<string | undefined | false>): string {
  return parts.filter(Boolean).join(' ');
}

export function UiButton({
  variant = 'primary',
  tone = 'default',
  className,
  children,
  type = 'button',
  ...rest
}: UiButtonProps) {
  const muiVariant = variant === 'primary' ? 'contained' : 'outlined';
  const muiColor = tone === 'danger' ? 'error' : 'primary';

  return (
    <MuiButton
      type={type}
      variant={muiVariant}
      color={muiColor}
      size={variant === 'tiny' ? 'small' : 'medium'}
      className={joinClasses(
        classForVariant(variant),
        tone === 'danger' && variant === 'tiny' && 'btn-tiny-danger',
        className
      )}
      {...rest}
    >
      {children}
    </MuiButton>
  );
}
