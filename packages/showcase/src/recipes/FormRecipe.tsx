import { useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import {
  Button,
  Card,
  ConfirmDialog,
  DatePicker,
  DetailItem,
  DetailList,
  Dialog,
  FormField,
  Input,
  Notice,
  Page,
  PageHeader,
  PageSkeleton,
  SectionHeading,
  Select,
  Textarea,
  ValidationSummary,
} from '@partrunner-ai/ui';
import { formatMoney } from './fixtures';
import { ErrorNotice, ForbiddenState, NoResults, type RecipeProps } from './states';

const FLEETS = [
  { value: 'aguilar', label: 'Transportes Aguilar del Norte' },
  { value: 'cumbres', label: 'Logística Cumbres' },
  { value: 'sierra', label: 'Fletes Sierra Madre' },
  { value: 'dorada', label: 'Ruta Dorada' },
];

const WEEKS = ['4', '6', '8', '12'].map((value) => ({ value, label: `${value} semanas` }));

type Field = 'fleet' | 'amount' | 'weeks' | 'start';
type Errors = Partial<Record<Field, string>>;

const LABELS: Record<Field, string> = {
  fleet: 'Flota',
  amount: 'Monto total',
  weeks: 'Plazo',
  start: 'Primer cobro',
};

const CONTROL_ID: Record<Field, string> = {
  fleet: 'plan-flota',
  amount: 'plan-monto',
  weeks: 'plan-plazo',
  start: 'plan-inicio',
};

function validate(values: Record<Field, string>): Errors {
  const errors: Errors = {};
  if (!values.fleet) errors.fleet = 'Elige la flota del plan.';
  const amount = Number(values.amount.replace(/,/g, ''));
  if (!values.amount.trim()) errors.amount = 'Escribe el monto total.';
  else if (!Number.isFinite(amount) || amount <= 0) errors.amount = 'El monto debe ser mayor a $0.00.';
  if (!values.weeks) errors.weeks = 'Elige en cuántas semanas se cobra.';
  if (!values.start) errors.start = 'Elige la fecha del primer cobro.';
  return errors;
}

const EMPTY = { fleet: '', amount: '', weeks: '', start: '', note: '' };

/** Recipe 2.4 · Form: a Dialog with FormFields, a ValidationSummary, and a destructive ConfirmDialog. */
export function FormRecipe({ state, onRetry }: RecipeProps) {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const openButton = useRef<HTMLButtonElement>(null);

  const set = (key: keyof typeof EMPTY, value: string) => {
    const next = { ...values, [key]: value };
    setValues(next);
    if (submitted && key !== 'note') setErrors(validate(next));
  };

  const close = () => {
    setOpen(false);
    setValues(EMPTY);
    setErrors({});
    setSubmitted(false);
  };

  const submit = () => {
    const found = validate(values);
    setErrors(found);
    setSubmitted(true);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    window.setTimeout(() => {
      setSaving(false);
      close();
      setCreated(true);
    }, 800);
  };

  const summary = (Object.keys(errors) as Field[]).map((key) => ({
    fieldId: CONTROL_ID[key],
    label: LABELS[key],
    message: errors[key] ?? '',
  }));

  const header = (
    <PageHeader
      title="Plan de pago"
      subtitle="Convierte un saldo a cargo en cobros semanales."
      actions={
        state === 'forbidden' || state === 'loading' ? undefined : (
          <Button ref={openButton} icon={Plus} onClick={() => setOpen(true)}>
            Nuevo plan de pago
          </Button>
        )
      }
    />
  );

  if (state === 'loading') {
    return (
      <Page width="default">
        <PageSkeleton variant="detail" label="Cargando plan de pago" />
      </Page>
    );
  }
  if (state === 'forbidden') {
    return (
      <Page width="default">
        {header}
        <ForbiddenState who="Finanzas" />
      </Page>
    );
  }

  return (
    <Page width="default">
      {header}
      {state === 'error' ? <ErrorNotice what="el plan de pago" onRetry={onRetry} /> : null}
      {created ? (
        <Notice tone="success" title="Plan creado" onDismiss={() => setCreated(false)} dismissLabel="Cerrar aviso">
          El primer cobro quedó programado. La flota recibe un aviso en su portal.
        </Notice>
      ) : null}
      {cancelled ? (
        <Notice tone="info" title="Plan cancelado" onDismiss={() => setCancelled(false)} dismissLabel="Cerrar aviso">
          El saldo regresa a la cola de saldos a cargo.
        </Notice>
      ) : null}

      {state === 'empty' || cancelled ? (
        <NoResults
          title="Esta flota no tiene un plan vigente"
          description="Crea un plan para cobrar el saldo en pagos semanales."
          action={
            <Button variant="secondary" onClick={() => setOpen(true)}>
              Nuevo plan de pago
            </Button>
          }
        />
      ) : (
        <Card>
          <SectionHeading
            title="Plan vigente"
            description="Logística Cumbres · creado el 17 nov 2026"
            actions={
              <Button size="sm" variant="outline" onClick={() => setConfirmOpen(true)}>
                Cancelar plan
              </Button>
            }
          />
          <DetailList columns={3}>
            <DetailItem label="Monto total" numeric>
              {formatMoney(18000)}
            </DetailItem>
            <DetailItem label="Cobro semanal" numeric>
              {formatMoney(1500)}
            </DetailItem>
            <DetailItem label="Avance">4 de 12 semanas</DetailItem>
            <DetailItem label="Primer cobro">24 nov 2026</DetailItem>
            <DetailItem label="Próximo cobro">1 dic 2026</DetailItem>
            <DetailItem label="Responsable">Mariana Lozano</DetailItem>
          </DetailList>
        </Card>
      )}

      <Dialog
        open={open}
        onClose={close}
        title="Nuevo plan de pago"
        description="Define cuánto y en cuántas semanas se cobra el saldo."
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={submit} loading={saving}>
              Crear plan
            </Button>
          </>
        }
      >
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="recipes-stack">
          {summary.length > 0 ? <ValidationSummary errors={summary} /> : null}
          <FormField label="Flota" required error={errors.fleet} controlId={CONTROL_ID.fleet} fullWidth>
            <Select
              options={FLEETS}
              placeholder="Elige una flota"
              value={values.fleet}
              onChange={(event) => set('fleet', event.target.value)}
            />
          </FormField>
          <FormField
            label="Monto total"
            required
            hint="En pesos mexicanos, con centavos."
            error={errors.amount}
            controlId={CONTROL_ID.amount}
            fullWidth
          >
            <Input
              inputMode="decimal"
              placeholder="$12,400.00"
              value={values.amount}
              onChange={(event) => set('amount', event.target.value)}
            />
          </FormField>
          <FormField label="Plazo" required error={errors.weeks} controlId={CONTROL_ID.weeks} fullWidth>
            <Select
              options={WEEKS}
              placeholder="Elige el plazo"
              value={values.weeks}
              onChange={(event) => set('weeks', event.target.value)}
            />
          </FormField>
          <FormField label="Primer cobro" required error={errors.start} controlId={CONTROL_ID.start} fullWidth>
            <DatePicker mode="single" value={values.start} onValueChange={(next) => set('start', next as string)} />
          </FormField>
          <FormField label="Nota interna" hint="Opcional. No la ve la flota." controlId="plan-nota" fullWidth>
            <Textarea rows={3} value={values.note} onChange={(event) => set('note', event.target.value)} />
          </FormField>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        destructive
        title="¿Cancelar el plan de pago?"
        description="Se detienen los cobros semanales y el saldo de $18,000.00 regresa a la cola. Esta acción no se puede deshacer."
        confirmLabel="Cancelar plan"
        cancelLabel="Conservar plan"
        loading={cancelling}
        onConfirm={() => {
          setCancelling(true);
          window.setTimeout(() => {
            setCancelling(false);
            setConfirmOpen(false);
            setCancelled(true);
          }, 600);
        }}
      />
    </Page>
  );
}
