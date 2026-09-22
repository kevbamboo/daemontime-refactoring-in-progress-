import { useState } from 'react';

type PasswordToggleProps = {
  visible: boolean;
  onToggle: () => void;
};

export default function PasswordToggle({ visible, onToggle }: PasswordToggleProps) {
  const [bouncing, setBouncing] = useState(false);

  function handleClick() {
    onToggle();
    setBouncing(false);
    window.requestAnimationFrame(() => setBouncing(true));
  }

  return (
    <button
      type="button"
      className={`password-toggle${bouncing ? ' is-bouncing' : ''}`}
      onClick={handleClick}
      onAnimationEnd={() => setBouncing(false)}
      aria-label={visible ? 'Hide password' : 'Show password'}
      aria-pressed={visible}
    >
      {visible ? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx="12"
            cy="12"
            r="3"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M3 3l18 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M10.6 10.6a2 2 0 0 0 2.8 2.8"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M9.9 4.2A10.8 10.8 0 0 1 12 4c5.5 0 9.5 5 10 8-.2 1.1-.8 2.1-1.5 3"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M6.2 6.2C3.9 7.8 2.4 10.2 2 12c.5 3 4.5 8 10 8 1.6 0 3-.4 4.3-1"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  );
}