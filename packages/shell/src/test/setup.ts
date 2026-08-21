import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=')[0]?.trim();
    if (name) document.cookie = `${name}=; path=/; max-age=0`;
  }
  document.documentElement.classList.remove('dark');
  delete document.documentElement.dataset.prTheme;
});
