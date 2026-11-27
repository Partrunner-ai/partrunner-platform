import { useState } from 'react';
import { Archive, Send, Trash2 } from 'lucide-react';
import {
  Button,
  Card,
  FormField,
  Input,
  Notice,
  Page,
  PageHeader,
  PageSkeleton,
  SectionHeading,
  Stack,
  toast,
  useConfirm,
} from '@partrunner-ai/ui';
import { ErrorNotice, ForbiddenState, NoResults, type RecipeProps } from './states';

const RFC_PATTERN = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;

/**
 * Recipe · Feedback: one channel for each message.
 *
 * - A wrong field: `FormField error`.
 * - A state that stays until somebody fixes it: `Notice`.
 * - The result of the action the person just did: `toast` (the app mounts one `Toaster`).
 * - Before an action that deletes data or cannot be undone: `useConfirm` (a promise-based
 *   `ConfirmDialog`). Never `window.confirm`.
 */
export function FeedbackRecipe({ state, onRetry }: RecipeProps) {
  const [rfc, setRfc] = useState('');
  const [rfcError, setRfcError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [archived, setArchived] = useState(false);
  const { confirm, dialog } = useConfirm();

  if (state === 'loading') {
    return (
      <Page width="wide">
        <PageSkeleton variant="detail" label="Cargando flota" />
      </Page>
    );
  }
  if (state === 'forbidden') {
    return (
      <Page width="wide">
        <PageHeader title="Datos fiscales" />
        <ForbiddenState who="Finanzas" />
      </Page>
    );
  }
  if (state === 'empty') {
    return (
      <Page width="wide">
        <PageHeader title="Datos fiscales" />
        <NoResults title="No encontramos esta flota" description="El enlace puede estar incompleto o la flota ya no existe." />
      </Page>
    );
  }

  function saveRfc() {
    const value = rfc.trim().toUpperCase();
    if (!RFC_PATTERN.test(value)) {
      // A wrong field: the message goes under the field, not in a toast.
      setRfcError('Escribe un RFC de 12 o 13 caracteres.');
      return;
    }
    setRfcError(undefined);
    setSaving(true);
    // The result of the action: a toast. An error stays until the person closes it.
    void toast
      .promise(new Promise<void>((resolve) => window.setTimeout(resolve, 600)), {
        loading: 'Guardando RFC…',
        success: 'RFC guardado',
        error: 'No se pudo guardar el RFC',
        errorDescription: 'Revisa tu conexión e intenta de nuevo.',
        errorAction: { label: 'Reintentar', onClick: saveRfc },
      })
      .finally(() => setSaving(false));
  }

  function sendInvoice() {
    toast.error('No se pudo enviar la factura', {
      description: 'El SAT no respondió. Tu factura sigue guardada.',
      action: { label: 'Reintentar', onClick: () => toast.success('Factura enviada') },
    });
  }

  function archiveRoute() {
    // An action that can be undone needs no ConfirmDialog: run it and offer «Deshacer».
    setArchived(true);
    toast.success('Ruta 1042 archivada', {
      action: {
        label: 'Deshacer',
        onClick: () => {
          setArchived(false);
          toast.info('Ruta 1042 restaurada');
        },
      },
    });
  }

  async function deleteRecord() {
    // Before an action that cannot be undone: ask first, in a ConfirmDialog.
    const confirmed = await confirm({
      title: '¿Eliminar el registro de la ruta 1042?',
      description: 'Se borran sus cargos y evidencias. No se puede deshacer.',
      confirmLabel: 'Eliminar registro',
      destructive: true,
    });
    if (!confirmed) return;
    toast.success('Registro eliminado');
  }

  return (
    <Page width="wide">
      <PageHeader title="Datos fiscales" subtitle="Transportes del Bajío" />
      {state === 'error' ? <ErrorNotice what="los datos fiscales" onRetry={onRetry} /> : null}

      {/* A state of the page that stays until somebody fixes it: a Notice. */}
      <Notice tone="warning" title="Pago de la semana 47 retenido">
        Falta la constancia de situación fiscal vigente. Se libera cuando Finanzas la valide.
      </Notice>

      <Card>
        <Stack gap="lg">
          <SectionHeading title="RFC de la flota" />
          <FormField label="RFC" required error={rfcError} hint="Como aparece en la constancia fiscal.">
            <Input value={rfc} onChange={(event) => setRfc(event.target.value)} placeholder="TBA010203AB1" />
          </FormField>
          <div>
            <Button onClick={saveRfc} loading={saving}>
              Guardar RFC
            </Button>
          </div>
        </Stack>
      </Card>

      <Card>
        <Stack gap="lg">
          <SectionHeading title="Acciones de la ruta 1042" />
          <Stack gap="sm">
            <div>
              <Button variant="secondary" icon={Send} onClick={sendInvoice}>
                Enviar factura
              </Button>
            </div>
            <div>
              <Button variant="secondary" icon={Archive} onClick={archiveRoute} disabled={archived}>
                {archived ? 'Ruta archivada' : 'Archivar ruta'}
              </Button>
            </div>
            <div>
              <Button variant="danger" icon={Trash2} onClick={deleteRecord}>
                Eliminar registro
              </Button>
            </div>
          </Stack>
        </Stack>
      </Card>

      {dialog}
    </Page>
  );
}
