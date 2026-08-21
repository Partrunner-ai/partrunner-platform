import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useStaffShell } from './StaffShellContext';

describe('useStaffShell', () => {
  it('fails clearly when the host adapter is missing', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() => renderHook(() => useStaffShell())).toThrow(
        'useStaffShell must be used within StaffShellProvider',
      );
    } finally {
      consoleError.mockRestore();
    }
  });
});
