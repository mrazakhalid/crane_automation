/**
 * Inline loading spinner.
 *
 * Purpose: Consistent busy indicator for buttons and full-page loading states.
 * Args: label — accessible label (visually hidden); size — px diameter.
 */
export function Spinner({ label = 'Loading', size = 18 }: { label?: string; size?: number }) {
  return (
    <span
      className="spinner"
      role="status"
      aria-label={label}
      style={{ width: size, height: size }}
    />
  );
}
