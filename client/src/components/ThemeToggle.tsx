type ThemeToggleProps = {
  dark: boolean;
  onChange: (dark: boolean) => void;
};

export default function ThemeToggle({ dark, onChange }: ThemeToggleProps) {
  return (
    <label className="theme-toggle">
      <span>{dark ? "Dark" : "Light"}</span>
      <input
        type="checkbox"
        role="switch"
        checked={!dark}
        onChange={(event) => onChange(!event.target.checked)}
        aria-label="Switch color theme"
      />
      <span className="theme-slider" aria-hidden="true" />
    </label>
  );
}
