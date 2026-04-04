import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

interface ButtonProps {
  variant?: ButtonVariant;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-amber-500 hover:bg-amber-400 text-gray-900 border border-amber-500',
  secondary: 'bg-transparent hover:bg-gray-700 text-amber-400 border border-amber-400',
  danger: 'bg-red-600 hover:bg-red-500 text-white border border-red-600',
};

export default function Button({
  variant = 'primary',
  disabled = false,
  onClick,
  children,
  className = '',
  type = 'button',
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={[
        'px-4 py-2 rounded font-semibold transition-colors duration-150',
        variantClasses[variant],
        disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer',
        className,
      ].join(' ')}
    >
      {children}
    </button>
  );
}
