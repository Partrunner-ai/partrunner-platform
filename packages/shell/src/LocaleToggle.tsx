import type { StaffLocale } from './StaffShellContext';

export interface LocaleToggleProps {
  locale: StaffLocale;
  onLocaleChange: (locale: StaffLocale) => void;
  label?: string;
  className?: string;
}

const LOCALE_NAMES: Record<StaffLocale, string> = {
  es: 'Español',
  en: 'English',
};

/** Compact ES/EN control. Product-copy translation remains host-owned. */
export function LocaleToggle({
  locale,
  onLocaleChange,
  label: labelOverride,
  className,
}: LocaleToggleProps) {
  const nextLocale: StaffLocale = locale === 'es' ? 'en' : 'es';
  const label =
    labelOverride ??
    `Idioma: ${LOCALE_NAMES[locale]}. Cambiar a ${LOCALE_NAMES[nextLocale]}`;

  return (
    <button
      type="button"
      className={`pr-iconbtn pr-locale-toggle${className ? ` ${className}` : ''}`}
      aria-label={label}
      title={label}
      onClick={() => void onLocaleChange(nextLocale)}
    >
      <span aria-hidden>{locale.toUpperCase()}</span>
    </button>
  );
}
