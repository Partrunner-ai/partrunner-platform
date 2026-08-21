import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './Tabs';

function BasicTabs({
  orientation = 'horizontal',
  activationMode = 'automatic',
}: {
  orientation?: 'horizontal' | 'vertical';
  activationMode?: 'automatic' | 'manual';
}) {
  return (
    <Tabs
      defaultValue="overview"
      orientation={orientation}
      activationMode={activationMode}
    >
      <TabsList aria-label="Solicitud">
        <TabsTrigger value="overview">Resumen</TabsTrigger>
        <TabsTrigger value="evidence" disabled>
          Evidencia
        </TabsTrigger>
        <TabsTrigger value="history">Historial</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">Resumen operativo</TabsContent>
      <TabsContent value="evidence">Evidencia fotográfica</TabsContent>
      <TabsContent value="history">Historial de cambios</TabsContent>
    </Tabs>
  );
}

describe('Tabs', () => {
  it('owns uncontrolled selection and wires each tab to its panel', async () => {
    const user = userEvent.setup();
    render(<BasicTabs />);

    const overview = screen.getByRole('tab', { name: 'Resumen' });
    const history = screen.getByRole('tab', { name: 'Historial' });
    expect(overview.getAttribute('aria-selected')).toBe('true');
    expect(overview.getAttribute('aria-controls')).toBe(
      screen.getByRole('tabpanel').getAttribute('id'),
    );
    expect(screen.getByRole('tabpanel').textContent).toBe('Resumen operativo');

    await user.click(history);
    expect(history.getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByText('Resumen operativo')).toBeNull();
    expect(screen.getByRole('tabpanel').textContent).toBe('Historial de cambios');
  });

  it('reports controlled changes without mutating the selected panel itself', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { rerender } = render(
      <Tabs value="overview" onValueChange={onValueChange}>
        <TabsList aria-label="Vista">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="history">Historial</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">Panel resumen</TabsContent>
        <TabsContent value="history">Panel historial</TabsContent>
      </Tabs>,
    );

    await user.click(screen.getByRole('tab', { name: 'Historial' }));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('history');
    expect(screen.getByRole('tabpanel').textContent).toBe('Panel resumen');

    rerender(
      <Tabs value="history" onValueChange={onValueChange}>
        <TabsList aria-label="Vista">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="history">Historial</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">Panel resumen</TabsContent>
        <TabsContent value="history">Panel historial</TabsContent>
      </Tabs>,
    );
    expect(screen.getByRole('tabpanel').textContent).toBe('Panel historial');
  });

  it('uses automatic horizontal arrow, Home, and End navigation while skipping disabled tabs', async () => {
    const user = userEvent.setup();
    render(<BasicTabs />);

    const overview = screen.getByRole('tab', { name: 'Resumen' });
    const evidence = screen.getByRole('tab', { name: 'Evidencia' });
    const history = screen.getByRole('tab', { name: 'Historial' });
    overview.focus();

    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(history);
    expect(history.getAttribute('aria-selected')).toBe('true');
    expect((evidence as HTMLButtonElement).disabled).toBe(true);

    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(overview);
    expect(overview.getAttribute('aria-selected')).toBe('true');

    await user.keyboard('{End}');
    expect(document.activeElement).toBe(history);
    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(overview);
  });

  it('supports vertical manual activation without changing panels on focus alone', async () => {
    const user = userEvent.setup();
    render(<BasicTabs orientation="vertical" activationMode="manual" />);

    const overview = screen.getByRole('tab', { name: 'Resumen' });
    const history = screen.getByRole('tab', { name: 'Historial' });
    overview.focus();
    await user.keyboard('{ArrowDown}');

    expect(document.activeElement).toBe(history);
    expect(overview.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel').textContent).toBe('Resumen operativo');

    await user.keyboard('{Enter}');
    expect(history.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel').textContent).toBe('Historial de cambios');
    expect(screen.getByRole('tablist').getAttribute('aria-orientation')).toBe('vertical');
  });

  it('forwards native attributes and refs while allowing force-mounted panels', () => {
    const triggerRef = createRef<HTMLButtonElement>();
    render(
      <Tabs defaultValue="one" className="consumer-tabs">
        <TabsList variant="line" className="consumer-list" aria-label="Secciones">
          <TabsTrigger ref={triggerRef} value="one" className="consumer-trigger">
            Uno
          </TabsTrigger>
          <TabsTrigger value="two">Dos</TabsTrigger>
        </TabsList>
        <TabsContent value="one">Primero</TabsContent>
        <TabsContent value="two" forceMount data-testid="forced-panel">
          Segundo
        </TabsContent>
      </Tabs>,
    );

    expect(triggerRef.current).toBe(screen.getByRole('tab', { name: 'Uno' }));
    expect(document.querySelector('.consumer-tabs')).toBeTruthy();
    expect(document.querySelector('.consumer-list')?.getAttribute('data-variant')).toBe('line');
    expect(document.querySelector('.consumer-trigger')).toBeTruthy();
    expect(screen.getByTestId('forced-panel').hasAttribute('hidden')).toBe(true);
  });
});
