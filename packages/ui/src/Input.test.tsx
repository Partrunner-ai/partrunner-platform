import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Input } from './Input';
import { EmptyState, Spinner } from './Feedback';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './Card';
import { Badge } from './Badge';

describe('Input', () => {
  it('ties the label to the field without needing an explicit id', async () => {
    render(<Input label="Correo" />);
    const field = screen.getByLabelText('Correo');
    await userEvent.type(field, 'ada@example.com');
    expect((field as HTMLInputElement).value).toBe('ada@example.com');
  });

  it('respects an id the caller supplies', () => {
    render(<Input id="mio" label="Correo" />);
    expect(screen.getByLabelText('Correo').id).toBe('mio');
  });

  it('describes the field with its hint', () => {
    render(<Input label="Correo" hint="Usá el corporativo." />);
    const field = screen.getByLabelText('Correo');
    const describedBy = field.getAttribute('aria-describedby');
    expect(describedBy).not.toBeNull();
    expect(document.getElementById(describedBy!)?.textContent).toBe('Usá el corporativo.');
  });

  describe('error', () => {
    it('marks the field invalid and announces the reason', () => {
      render(<Input label="Correo" error="Dominio no autorizado." />);
      const field = screen.getByLabelText('Correo');

      // The whole point: a hand-rolled field renders the message in a loose
      // span, so the field still reads as valid and the reason is never said.
      expect(field.getAttribute('aria-invalid')).toBe('true');
      const alert = screen.getByRole('alert');
      expect(alert.textContent).toBe('Dominio no autorizado.');
      expect(field.getAttribute('aria-describedby')).toBe(alert.id);
    });

    it('replaces the hint rather than stacking two messages', () => {
      render(<Input label="Correo" hint="Usá el corporativo." error="No autorizado." />);
      expect(screen.queryByText('Usá el corporativo.')).toBeNull();
      expect(screen.getByText('No autorizado.')).toBeTruthy();
    });
  });
});

describe('Spinner', () => {
  it('has an accessible name so the wait is not silent', () => {
    render(<Spinner />);
    expect(screen.getByRole('status').textContent).toBe('Cargando');
  });

  it('is muted by default, so existing call sites do not shift', () => {
    render(<Spinner />);
    expect(screen.getByRole('status').className).toContain('pr-spinner--muted');
  });

  it('emits no colour class when told to inherit', () => {
    // Absence, not `currentColor`. Package CSS is unlayered, so any declaration here —
    // including `currentColor` — would outrank a Tailwind `text-*` utility and
    // prevent caller-owned tinting.
    render(<Spinner tone="inherit" className="text-brand-600" />);
    const el = screen.getByRole('status');
    expect(el.className).not.toContain('pr-spinner--muted');
    expect(el.className).toContain('text-brand-600');
  });

  it('takes a caller label', () => {
    render(<Spinner label="Guardando rutas" />);
    expect(screen.getByRole('status').textContent).toBe('Guardando rutas');
  });
});

describe('EmptyState', () => {
  it('renders the title, description and a way out', () => {
    render(
      <EmptyState
        title="Sin rutas"
        description="Todavía no importaste nada."
        action={<button type="button">Importar</button>}
      />,
    );
    expect(screen.getByText('Sin rutas')).toBeTruthy();
    expect(screen.getByText('Todavía no importaste nada.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Importar' })).toBeTruthy();
  });
});

describe('Card', () => {
  it('defaults to the surface and lifts onto elevated when raised', () => {
    const { rerender } = render(<Card data-testid="c">x</Card>);
    expect(screen.getByTestId('c').className).toContain('pr-card--pad-md');
    expect(screen.getByTestId('c').className).not.toContain('pr-card--raised');

    rerender(
      <Card data-testid="c" raised padding="lg">
        x
      </Card>,
    );
    expect(screen.getByTestId('c').className).toContain('pr-card--raised');
    expect(screen.getByTestId('c').className).toContain('pr-card--pad-lg');
  });

  it('bleeds only the body, leaving the header padded', () => {
    // `padding="none"` on the Card cannot express this: the padding lives on the card,
    // so removing it takes the header's inset with it. Bleed lets dense content
    // reach the card edge without unpadding the title.
    render(
      <Card data-testid="c">
        <CardHeader title="Desglose" />
        <CardContent data-testid="body" bleed>
          tabla
        </CardContent>
      </Card>,
    );
    expect(screen.getByTestId('c').className).toContain('pr-card--pad-md');
    expect(screen.getByTestId('body').className).toContain('pr-card__content--bleed');
  });

  it('does not bleed unless asked', () => {
    render(
      <Card>
        <CardContent data-testid="body">tabla</CardContent>
      </Card>,
    );
    expect(screen.getByTestId('body').className).not.toContain('pr-card__content--bleed');
  });

  it('keeps header actions out of the heading', () => {
    render(
      <Card>
        <CardHeader title="Rutas" actions={<button type="button">Ver</button>} />
      </Card>,
    );
    const heading = screen.getByText('Rutas').closest('.pr-card__heading');
    expect(heading?.querySelector('button')).toBeNull();
    expect(screen.getByRole('button', { name: 'Ver' })).toBeTruthy();
  });
});

describe('a field with nothing around it', () => {
  it('renders one input and no wrappers', () => {
    const { container } = render(<Input placeholder="Buscar" />);
    expect(container.querySelectorAll('div')).toHaveLength(0);
    const input = container.querySelector('input')!;
    expect(input.className).toContain('pr-input');
    expect(input.className).toContain('pr-input--md');
    // Not the composite class — that one is transparent and borderless, so a bare
    // input carrying it would render invisible.
    expect(input.className).not.toContain('pr-field__input');
  });

  it('puts className on the input, where a shadcn call site expects it', () => {
    const { container } = render(<Input className="w-full text-sm" />);
    const input = container.querySelector('input')!;
    expect(input.className).toContain('w-full');
    expect(input.className).toContain('text-sm');
  });

  it('grows the moment it has anything to lay out', () => {
    for (const props of [{ label: 'Correo' }, { hint: 'Opcional' }, { error: 'Requerido' }, { leading: <span>@</span> }]) {
      const { container, unmount } = render(<Input {...props} />);
      expect(container.querySelector('.pr-field')).not.toBeNull();
      expect(container.querySelector('.pr-field__input')).not.toBeNull();
      unmount();
    }
  });

  it('keeps the invalid state expressible without a message', () => {
    const { container } = render(<Input aria-invalid="true" />);
    const input = container.querySelector('input')!;
    expect(input.className).toContain('pr-input');
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('carries fullWidth itself, since there is no container to widen', () => {
    const { container } = render(<Input fullWidth />);
    expect(container.querySelector('input')!.className).toContain('pr-input--block');
  });
});

describe('Card composition', () => {
  it('produces the same markup either way it is spelled', () => {
    const viaProps = render(<CardHeader title="Solicitudes" description="Hoy" />);
    const propsTitle = viaProps.container.querySelector('.pr-card__title')!;
    const propsDesc = viaProps.container.querySelector('.pr-card__description')!;
    expect(propsTitle.tagName).toBe('H3');
    expect(propsDesc.tagName).toBe('P');
    viaProps.unmount();

    const viaChildren = render(
      <CardHeader>
        <CardTitle>Solicitudes</CardTitle>
        <CardDescription>Hoy</CardDescription>
      </CardHeader>,
    );
    const childTitle = viaChildren.container.querySelector('.pr-card__title')!;
    const childDesc = viaChildren.container.querySelector('.pr-card__description')!;
    expect(childTitle.tagName).toBe('H3');
    expect(childDesc.tagName).toBe('P');
    expect(childTitle.textContent).toBe('Solicitudes');
    expect(childDesc.textContent).toBe('Hoy');
  });

  it('gives the body its own class so it can be separated from the header', () => {
    const { container } = render(
      <Card>
        <CardHeader title="T" />
        <CardContent>cuerpo</CardContent>
      </Card>,
    );
    expect(container.querySelector('.pr-card__content')!.textContent).toBe('cuerpo');
  });
});

describe('Card tones', () => {
  it('adds a class only when the tone is not the default surface', () => {
    const neutral = render(<Card>x</Card>);
    expect(neutral.container.firstElementChild!.className).not.toMatch(/pr-card--(yellow|blue|amber|purple|green|rose)/);
    neutral.unmount();

    const amber = render(<Card tone="amber">x</Card>);
    expect(amber.container.firstElementChild!.className).toContain('pr-card--amber');
  });

  it('uses the same tone vocabulary as Badge, so the two cannot disagree', () => {
    // A tinted card with a badge inside it should land on one colour, not two.
    for (const tone of ['yellow', 'blue', 'amber', 'purple', 'green', 'rose'] as const) {
      const { container, unmount } = render(
        <Card tone={tone}>
          <Badge tone={tone}>x</Badge>
        </Card>,
      );
      expect(container.querySelector(`.pr-card--${tone}`)).not.toBeNull();
      expect(container.querySelector(`.pr-badge--${tone}`)).not.toBeNull();
      unmount();
    }
  });
});

describe('Card as a link, and Card washed with a tone', () => {
  it('renders the child instead of a div under asChild, keeping the styling', () => {
    render(
      <Card asChild padding="lg" tone="amber" interactive>
        <a href="/wiki/guia">Guía</a>
      </Card>,
    );
    const link = screen.getByRole('link', { name: 'Guía' });
    expect(link.className).toContain('pr-card');
    expect(link.className).toContain('pr-card--pad-lg');
    expect(link.className).toContain('pr-card--amber');
    expect(link.className).toContain('pr-card--interactive');
    expect(link.getAttribute('href')).toBe('/wiki/guia');
  });

  it('needs a tone for the gradient to mean anything', () => {
    // The CSS only pairs `--gradient` with a tone; on its own it is the surface.
    const plain = render(<Card gradient>x</Card>);
    expect(plain.container.firstElementChild!.className).toContain('pr-card--gradient');
    expect(plain.container.firstElementChild!.className).not.toMatch(/pr-card--(yellow|green)/);
    plain.unmount();

    const washed = render(<Card gradient tone="green">x</Card>);
    const cls = washed.container.firstElementChild!.className;
    expect(cls).toContain('pr-card--gradient');
    expect(cls).toContain('pr-card--green');
  });
});

describe('Card resting shadow', () => {
  it('is off by default, so the card stays border-only', () => {
    const { container } = render(<Card>x</Card>);
    expect(container.firstElementChild!.className).not.toContain('pr-card--shadow');
  });

  it('lifts the card off the page without changing its surface', () => {
    const { container } = render(<Card shadow>x</Card>);
    const cls = container.firstElementChild!.className;
    expect(cls).toContain('pr-card--shadow');
    expect(cls).not.toContain('pr-card--raised');
  });

  it('does not stack with raised, which already carries one', () => {
    const { container } = render(
      <Card raised shadow>
        x
      </Card>,
    );
    const cls = container.firstElementChild!.className;
    expect(cls).toContain('pr-card--raised');
    expect(cls).not.toContain('pr-card--shadow');
  });
});

describe('Card adoption surfaces', () => {
  it('keeps glass opt-in and lets it compose with a semantic tone', () => {
    const plain = render(<Card>x</Card>);
    expect(plain.container.firstElementChild!.className).not.toContain('pr-card--glass');
    plain.unmount();

    const { container } = render(
      <Card glass tone="blue">
        x
      </Card>,
    );
    const cls = container.firstElementChild!.className;
    expect(cls).toContain('pr-card--glass');
    expect(cls).toContain('pr-card--blue');
  });

  it('gives glass precedence over the opaque gradient treatment', () => {
    const { container } = render(
      <Card glass gradient tone="green">
        x
      </Card>,
    );
    const cls = container.firstElementChild!.className;
    expect(cls).toContain('pr-card--glass');
    expect(cls).not.toContain('pr-card--gradient');
  });

  it('only emits a tone border when there is a tone to match', () => {
    const neutral = render(<Card toneBorder>x</Card>);
    expect(neutral.container.firstElementChild!.className).not.toContain('pr-card--tone-border');
    neutral.unmount();

    const bordered = render(
      <Card tone="rose" toneBorder>
        x
      </Card>,
    );
    expect(bordered.container.firstElementChild!.className).toContain('pr-card--tone-border');
  });
});

describe('Card padding="none"', () => {
  it('emits no padding class, so a className padding still applies', () => {
    // The trap: `padding: 0` from the package and `p-[18px]` from the app are the
    // same specificity, and this stylesheet loads later — so asserting zero wins and
    // flattens the card. Absence composes; zero fights.
    const { container } = render(<Card padding="none" className="p-[18px]">x</Card>);
    const cls = container.firstElementChild!.className;
    expect(cls).not.toContain('pr-card--pad');
    expect(cls).toContain('p-[18px]');
  });

  it('still emits a class for the sizes that mean something', () => {
    for (const p of ['sm', 'md', 'lg'] as const) {
      const { container, unmount } = render(<Card padding={p}>x</Card>);
      expect(container.firstElementChild!.className).toContain(`pr-card--pad-${p}`);
      unmount();
    }
  });
});
