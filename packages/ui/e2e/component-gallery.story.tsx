import { useState, type ReactNode } from 'react';
import {
  Bell,
  Boxes,
  Check,
  CircleDollarSign,
  LayoutDashboard,
  Mail,
  MapPinned,
  PackageCheck,
  Plus,
  Search,
  Trash2,
  Truck,
  Users,
} from 'lucide-react';
import {
  AppShell,
  GlobalHeader,
  SidebarTrigger,
  StaffShellProvider,
  type NavSection,
  type StaffShellContextValue,
} from '@partrunner-ai/shell';
import {
  Badge,
  Button,
  Calendar,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  CheckboxGroup,
  Combobox,
  ConfirmDialog,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DatePicker,
  EmptyState,
  FileDropzone,
  FormField,
  IconButton,
  Input,
  MultiSelect,
  NavigationTabs,
  PageHeader,
  Pagination,
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
  RadioGroup,
  RichSelect,
  RichSelectContent,
  RichSelectEmpty,
  RichSelectGroup,
  RichSelectItem,
  RichSelectLabel,
  RichSelectSearch,
  RichSelectSeparator,
  RichSelectTrigger,
  RichSelectValue,
  Select,
  Spinner,
  StatTile,
  Switch,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogRoot,
  AlertDialogTitle,
  AlertDialogTrigger,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetRoot,
  SheetTitle,
  SheetTrigger,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Toolbar,
  ValidationSummary,
  type BadgeTone,
  type ButtonVariant,
  type ComboboxOption,
  type ChoiceOption,
  type MultiSelectOption,
  type NavigationTabsLinkProps,
  type RichSelectProps,
} from '@partrunner-ai/ui';
import './component-gallery.css';

const BUTTON_VARIANTS: ButtonVariant[] = [
  'primary',
  'secondary',
  'outline',
  'ghost',
  'danger',
  'success',
  'link',
];
const BADGE_TONES: BadgeTone[] = [
  'neutral',
  'yellow',
  'blue',
  'amber',
  'purple',
  'green',
  'rose',
  'danger',
  'success',
  'warning',
  'info',
];
const FLEETS: ComboboxOption[] = [
  { value: 'norte', label: 'Fletes del Norte' },
  { value: 'centro', label: 'Transportes Centro' },
  { value: 'bajio', label: 'Logística Bajío' },
];
const REGIONS: MultiSelectOption[] = [
  { value: 'cdmx', label: 'CDMX' },
  { value: 'gdl', label: 'Guadalajara' },
  { value: 'mty', label: 'Monterrey' },
  { value: 'qro', label: 'Querétaro' },
];

function CatalogNavigationLink({ href, children, ...props }: NavigationTabsLinkProps) {
  return (
    <a href={href} onClick={(event) => event.preventDefault()} {...props}>
      {children}
    </a>
  );
}
const REMOTE_DRIVERS: MultiSelectOption[] = [
  { value: '42', label: 'Ana Operadora', searchText: 'Ana Operadora 555 0101' },
  { value: '57', label: 'Carlos Ruta', searchText: 'Carlos Ruta 555 0120' },
  { value: '81', label: 'María Logística', searchText: 'María Logística 555 0199' },
];
const FILTER_STATUSES: MultiSelectOption[] = [
  {
    value: 'pending',
    label: 'Pendiente',
    leading: <span className="catalog__filter-dot catalog__filter-dot--warning" aria-hidden />,
  },
  {
    value: 'placed',
    label: 'Colocada',
    leading: <span className="catalog__filter-dot catalog__filter-dot--success" aria-hidden />,
  },
  {
    value: 'closed',
    label: 'Cerrada',
    leading: <span className="catalog__filter-dot catalog__filter-dot--muted" aria-hidden />,
  },
];
const COVERAGE_OPTIONS: ChoiceOption[] = [
  { value: 'norte', label: 'Norte', description: 'Monterrey y zona fronteriza.' },
  { value: 'bajio', label: 'Bajío' },
  { value: 'centro', label: 'Centro' },
];
const PRIORITY_OPTIONS: ChoiceOption[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'urgent', label: 'Urgente', description: 'Requiere seguimiento en vivo.' },
  { value: 'critical', label: 'Crítica', disabled: true },
];
function WorkspaceRichSelect({
  defaultValue = 'supply',
  searchable = true,
  ...props
}: {
  defaultValue?: string;
  searchable?: boolean;
} & Omit<RichSelectProps, 'children' | 'defaultValue'>) {
  return (
    <RichSelect {...props} defaultValue={defaultValue}>
      <RichSelectTrigger fullWidth>
        <RichSelectValue placeholder="Choose a workspace" />
      </RichSelectTrigger>
      <RichSelectContent>
        {searchable ? <RichSelectSearch placeholder="Search workspaces" /> : null}
        <RichSelectGroup>
          <RichSelectLabel>Operations apps</RichSelectLabel>
          <RichSelectItem value="supply" textValue="Supply operations">
            <span>Supply</span><Badge tone="blue">Operations</Badge>
          </RichSelectItem>
          <RichSelectItem value="liveops" textValue="LiveOps monitoring">
            <span>LiveOps</span><Badge tone="amber">Live</Badge>
          </RichSelectItem>
          <RichSelectItem value="requests" textValue="Solicitudes intake">
            <span>Solicitudes</span><Badge tone="purple">Intake</Badge>
          </RichSelectItem>
        </RichSelectGroup>
        <RichSelectSeparator />
        <RichSelectItem value="legacy" disabled>Legacy workspace</RichSelectItem>
        <RichSelectEmpty>No matching workspace</RichSelectEmpty>
      </RichSelectContent>
    </RichSelect>
  );
}

function ControlledWorkspaceRichSelect() {
  const [open, setOpen] = useState(false);
  return (
    <WorkspaceRichSelect
      open={open}
      onOpenChange={setOpen}
      aria-label="On-demand client"
    />
  );
}

function ControlledRemoteMultiSelect() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const normalizedQuery = query.trim().toLowerCase();
  const options = REMOTE_DRIVERS.filter(
    (option) =>
      selected.includes(option.value) ||
      (normalizedQuery.length >= 3 &&
        (option.searchText ?? option.label).toLowerCase().includes(normalizedQuery)),
  );

  return (
    <MultiSelect
      options={options}
      value={selected}
      onChange={setSelected}
      open={open}
      onOpenChange={setOpen}
      onQueryChange={setQuery}
      placeholder="Select drivers"
      searchLabel="Search drivers"
      emptyLabel={
        normalizedQuery.length < 3 ? 'Type at least 3 characters' : 'No matching drivers'
      }
      aria-label="On-demand drivers"
    />
  );
}

type CatalogMode = 'light' | 'dark';

function CatalogSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="catalog__section">
      <div className="catalog__section-header">
        <h2 className="catalog__section-title">{title}</h2>
        <p className="catalog__section-description">{description}</p>
      </div>
      <div className="catalog__surface">{children}</div>
    </section>
  );
}

function UiCatalog({ mode }: { mode: CatalogMode }) {
  const [fleet, setFleet] = useState<ComboboxOption | null>(FLEETS[0]!);
  const [regions, setRegions] = useState(['cdmx', 'gdl']);
  const [statuses, setStatuses] = useState(['pending', 'placed']);
  const [evidenceConfirmed, setEvidenceConfirmed] = useState(true);
  const [autoAssign, setAutoAssign] = useState(false);
  const [coverage, setCoverage] = useState<readonly string[]>(['norte']);
  const [priority, setPriority] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [paginationPage, setPaginationPage] = useState(2);
  const [catalogCsvFiles] = useState(() => [
    new File(['route_id,driver_id\n'.padEnd(18_432, '\n')], 'rutas-validado.csv', {
      type: 'text/csv',
    }),
  ]);

  const validationErrors = [
    ...(termsAccepted
      ? []
      : [{ fieldId: 'catalog-terms', label: 'Política operativa', message: 'Confirma la política.' }]),
    ...(priority
      ? []
      : [{ fieldId: 'catalog-priority', label: 'Prioridad', message: 'Selecciona una prioridad.' }]),
  ];

  return (
    <main className="catalog" data-testid={`ui-${mode}-catalog`}>
      <header className="catalog__hero">
        <div>
          <p className="catalog__eyebrow">PartRunner Platform · visual contract</p>
          <h1 className="catalog__title">
            {mode === 'light' ? 'Light' : 'Dark'} mode component catalog
          </h1>
          <p className="catalog__lede">
            Every public visual primitive on the canonical yellow, semantic surfaces, Barlow,
            and Bebas Neue foundation. Consumer CSS is not used to repair any component below.
          </p>
        </div>
        <span className="catalog__mode">
          <span aria-hidden>{mode === 'light' ? '☀' : '☾'}</span>{' '}
          {mode === 'light' ? 'Light' : 'Dark'} mode
        </span>
      </header>

      <CatalogSection
        title="Buttons"
        description="All actions share one geometry, focus contract, loading state, and tactile press response."
      >
        <div className="catalog__row">
          {BUTTON_VARIANTS.map((variant) => (
            <Button key={variant} variant={variant} icon={variant === 'primary' ? Plus : undefined}>
              {variant}
            </Button>
          ))}
        </div>
        <div className="catalog__row">
          <Button size="xs">Extra small</Button>
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
          <Button size="icon" icon={Search} aria-label="Buscar" />
          <Button loading>Guardando</Button>
          <Button disabled>Deshabilitado</Button>
        </div>
        <div className="catalog__row">
          <Button data-testid="direct-outline-sm" variant="outline" size="sm">
            Direct action
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button data-testid="menu-outline-sm" variant="outline" size="sm">
                Menu action
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Open details</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <span
            data-testid="raw-menu-context"
            style={{ fontFamily: 'Georgia', fontSize: 18, fontWeight: 700, lineHeight: '27px' }}
          >
            <DropdownMenu>
              <DropdownMenuTrigger data-testid="raw-menu-trigger">
                Raw menu trigger
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>Raw action</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        </div>
        {/* The popover trigger, in the same three arrangements as the menu trigger
            above: a plain Button to compare against, a Button slotted in with
            `asChild`, and a raw trigger inside a hostile type context. It is its own
            row because it was its own rule with an identical body, and only the menu
            one was corrected — so the gallery now carries both. */}
        <div className="catalog__row">
          <Button data-testid="direct-popover-peer" variant="outline" size="sm">
            Direct action
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button data-testid="popover-outline-sm" variant="outline" size="sm">
                Popover action
              </Button>
            </PopoverTrigger>
            <PopoverContent>
              <PopoverTitle>Detalle</PopoverTitle>
            </PopoverContent>
          </Popover>
          <span
            data-testid="raw-popover-context"
            style={{ fontFamily: 'Georgia', fontSize: 18, fontWeight: 700, lineHeight: '27px' }}
          >
            <Popover>
              <PopoverTrigger data-testid="raw-popover-trigger">
                Raw popover trigger
              </PopoverTrigger>
              <PopoverContent>
                <PopoverTitle>Detalle</PopoverTitle>
              </PopoverContent>
            </Popover>
          </span>
        </div>
        {/* Layer order is a separate axis from specificity. Package CSS is unlayered,
            so even `:where()` beats a consumer rule in `@layer utilities`. These plain
            controls prove composed children receive no package typography at all. */}
        <div className="catalog__row">
          <button
            type="button"
            className="catalog__layered-trigger"
            data-testid="direct-layered-trigger"
          >
            Direct layered action
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="catalog__layered-trigger"
                data-testid="menu-layered-trigger"
              >
                Menu layered action
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Layered menu action</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="catalog__layered-trigger"
                data-testid="popover-layered-trigger"
              >
                Popover layered action
              </button>
            </PopoverTrigger>
            <PopoverContent>
              <PopoverTitle>Layered popover action</PopoverTitle>
            </PopoverContent>
          </Popover>
        </div>
      </CatalogSection>

      <CatalogSection
        title="Badges"
        description="Operational tones remain semantic; the brand tone uses the exact approved yellow."
      >
        <div className="catalog__row">
          {BADGE_TONES.map((tone) => (
            <Badge key={tone} tone={tone} dot={tone === 'success'}>
              {tone}
            </Badge>
          ))}
        </div>
        <div className="catalog__row">
          <Badge tone="yellow" solid>Acción</Badge>
          <Badge tone="blue" outline>En revisión</Badge>
          <Badge tone="success" icon={Check}>Completo</Badge>
          <Badge tone="neutral" size="xs">XS</Badge>
          <Badge tone="neutral" size="sm">SM</Badge>
        </div>
      </CatalogSection>

      <CatalogSection
        title="Form controls"
        description="Labels, hints, errors, disabled states, and accessible descriptions are owned by the primitive."
      >
        <div className="catalog__grid">
          <Input
            aria-label="Entrada compacta"
            placeholder="Entrada compacta sin envoltura"
            inputSize="sm"
          />
          <Input label="Ruta" placeholder="ROUTE-001" hint="Identificador operativo" fullWidth />
          <Input
            label="Correo"
            defaultValue="operations@example.com"
            leading={<Mail size={16} aria-hidden />}
            fullWidth
          />
          <Input label="Placa" defaultValue="ABC-123" error="La placa ya está asignada" fullWidth />
          <Select
            label="Tipo de unidad"
            placeholder="Selecciona una opción"
            options={[
              { value: 'van', label: 'Small Van' },
              { value: 'car', label: 'Car' },
              { value: 'truck', label: '3.5 toneladas' },
            ]}
            selectSize="sm"
            fullWidth
          />
          <FormField
            label="Workspace"
            hint="Rich options, groups, and search stay package-owned."
            fullWidth
          >
            <WorkspaceRichSelect />
          </FormField>
          <FormField
            label="On-demand client"
            hint="Controlled open state activates remote data only while the menu is visible."
            fullWidth
          >
            <ControlledWorkspaceRichSelect />
          </FormField>
          <Textarea
            label="Observaciones"
            placeholder="Contexto útil para la operación"
            hint="Evita datos personales o sensibles."
            fullWidth
          />
          <Textarea
            label="Motivo de rechazo"
            defaultValue=""
            error="Explica por qué la solicitud no puede continuar."
            fullWidth
          />
          <FormField label="Flotilla" hint="Busca por razón social." required fullWidth>
            <Combobox
              value={fleet}
              onChange={setFleet}
              onSearch={async () => FLEETS}
              debounceMs={0}
            />
          </FormField>
          <FormField
            label="Regiones operativas"
            hint="Selecciona todas las regiones con cobertura."
            required
            fullWidth
          >
            <MultiSelect options={REGIONS} value={regions} onChange={setRegions} />
          </FormField>
          <FormField
            label="On-demand drivers"
            hint="Controlled visibility and query events activate remote multi-select options only while needed."
            fullWidth
          >
            <ControlledRemoteMultiSelect />
          </FormField>
          <FormField
            label="Filtro de estado"
            hint="Una selección múltiple compacta conserva el contexto del toolbar."
            fullWidth
          >
            <MultiSelect
              variant="filter"
              options={FILTER_STATUSES}
              value={statuses}
              onChange={setStatuses}
              placeholder="Estado"
              clearLabel="Todos — Estado"
              aria-label="Filtrar por estado"
            />
          </FormField>
          <Input label="Control deshabilitado" defaultValue="No editable" disabled fullWidth />
        </div>
      </CatalogSection>

      <CatalogSection
        title="File upload"
        description="Picker, drag, validation, and selected-file presentation share one native-input contract."
      >
        <div className="catalog__grid">
          <FileDropzone
            label="Plantilla de rutas"
            browseLabel="Elige un CSV o arrástralo aquí"
            description="Validaremos el archivo antes de enviar cambios."
            hint="CSV de hasta 10 MB."
            accept=".csv,text/csv"
            onFilesSelected={() => undefined}
            fullWidth
          />
          <FileDropzone
            label="Archivo con observaciones"
            browseLabel="Cambia el archivo o arrastra otro"
            description="Revisa la estructura antes de continuar."
            error="Falta la columna route_id."
            selectedFiles={catalogCsvFiles}
            onFilesSelected={() => undefined}
            fullWidth
          />
        </div>
      </CatalogSection>

      <CatalogSection
        title="Calendar and date selection"
        description="Date-only values, ranges, navigation, form serialization, and popup layering are one package contract."
      >
        <div className="catalog__calendar-grid">
          <Calendar
            mode="range"
            defaultValue={{ start: '2026-07-08', end: '2026-07-12' }}
            defaultMonth="2026-07-01"
            locale="es-MX"
            showActions
            aria-label="Operating calendar"
          />
          <div className="catalog__selection-stack">
            <FormField
              label="Delivery date"
              hint="Submits a stable YYYY-MM-DD value."
              fullWidth
            >
              <DatePicker
                name="catalog-delivery-date"
                defaultValue="2026-07-15"
                fullWidth
              />
            </FormField>
            <FormField
              label="Operating range"
              hint="Start and end serialize into separate form fields."
              fullWidth
            >
              <DatePicker
                mode="range"
                startName="catalog-range-start"
                endName="catalog-range-end"
                defaultValue={{ start: '2026-07-08', end: '2026-07-12' }}
                fullWidth
              />
            </FormField>
            <FormField label="Bounded schedule" hint="Unavailable dates stay disabled." fullWidth>
              <DatePicker
                defaultMonth="2026-07-01"
                min="2026-07-06"
                max="2026-07-24"
                disabledDates={['2026-07-13', '2026-07-14']}
                fullWidth
              />
            </FormField>
          </div>
        </div>
      </CatalogSection>

      <CatalogSection
        title="Selection and validation"
        description="Native checkboxes, switches, grouped choices, and error navigation share one package-owned form contract."
      >
        <div className="catalog__selection-grid">
          <div className="catalog__selection-stack">
            <Checkbox
              label="Confirmar evidencia"
              description="La fotografía debe mostrar la entrega completa."
              checked={evidenceConfirmed}
              onChange={(event) => setEvidenceConfirmed(event.currentTarget.checked)}
            />
            <Checkbox label="Selección parcial" indeterminate />
            <Checkbox label="Opción no disponible" disabled />
            <Switch
              label="Asignación automática"
              description="Usa disponibilidad y cobertura en tiempo real."
              checked={autoAssign}
              onChange={(event) => setAutoAssign(event.currentTarget.checked)}
            />
            <Checkbox
              id="catalog-terms"
              label="Confirmo la política operativa"
              checked={termsAccepted}
              onChange={(event) => setTermsAccepted(event.currentTarget.checked)}
              error={termsAccepted ? undefined : 'Debes confirmar antes de continuar.'}
              required
            />
          </div>
          <div className="catalog__selection-stack">
            <CheckboxGroup
              name="catalog-coverage"
              label="Cobertura operativa"
              hint="Selecciona todas las zonas que puede atender la flotilla."
              options={COVERAGE_OPTIONS}
              value={coverage}
              onValueChange={setCoverage}
              required
            />
            <RadioGroup
              id="catalog-priority"
              name="catalog-priority"
              label="Prioridad de atención"
              options={PRIORITY_OPTIONS}
              value={priority}
              onValueChange={setPriority}
              error={priority ? undefined : 'Selecciona una prioridad.'}
              orientation="horizontal"
              required
            />
          </div>
        </div>
        <div className="catalog__validation">
          <ValidationSummary errors={validationErrors} />
        </div>
      </CatalogSection>

      <CatalogSection
        title="Cards"
        description="Default, glass, bordered-tone, raised, and interactive surfaces without app-owned repair classes."
      >
        <div className="catalog__cards">
          <Card shadow>
            <CardHeader title="Entregas de hoy" description="Ejecución de última milla" />
            <CardContent>
              <p className="catalog__sample-copy">148 rutas activas con 96.4% de cumplimiento.</p>
            </CardContent>
          </Card>
          <Card glass>
            <CardHeader title="Seguimiento en contexto" description="Superficie translúcida adaptativa" />
            <CardContent>
              <p className="catalog__sample-copy">El desenfoque y la transparencia rotan con el tema.</p>
            </CardContent>
          </Card>
          <Card tone="rose" toneBorder>
            <CardHeader title="Atención operativa" description="Tres rutas necesitan revisión" />
            <CardContent>
              <Badge tone="rose">3 pendientes</Badge>
            </CardContent>
          </Card>
          <Card interactive raised tabIndex={0}>
            <CardHeader title="Capacidad disponible" description="Red nacional de flotillas" />
            <CardContent>
              <p className="catalog__sample-copy">Consulta cobertura y unidades listas para asignación.</p>
            </CardContent>
          </Card>
        </div>
      </CatalogSection>

      <CatalogSection
        title="Feedback"
        description="Loading, empty, and recovery states remain readable without page-specific layout assumptions."
      >
        <div className="catalog__grid">
          <Card>
            <EmptyState
              icon={PackageCheck}
              title="No hay pendientes"
              description="Todas las rutas de este periodo tienen evidencia completa."
              action={<Button size="sm" variant="secondary">Actualizar</Button>}
            />
          </Card>
          <Card>
            <div className="catalog__row">
              <Spinner label="Cargando rutas" />
              <Spinner size="sm" label="Cargando" />
              <Spinner size="lg" label="Sincronizando" />
            </div>
          </Card>
        </div>
      </CatalogSection>

      <CatalogSection
        title="Tabs"
        description="Automatic and manual activation, orientation, roving focus, and panel relationships are package-owned."
      >
        <div className="catalog__grid">
          <Tabs defaultValue="summary">
            <TabsList aria-label="Route record">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="evidence">Evidence</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
            <TabsContent value="summary">
              <Card padding="sm">Live route status and assignment summary.</Card>
            </TabsContent>
            <TabsContent value="evidence">
              <Card padding="sm">Delivery photos and recipient evidence.</Card>
            </TabsContent>
            <TabsContent value="history">
              <Card padding="sm">Chronological route activity.</Card>
            </TabsContent>
          </Tabs>

          <Tabs defaultValue="daily" orientation="vertical" activationMode="manual">
            <TabsList variant="line" aria-label="Report period">
              <TabsTrigger value="daily">Daily</TabsTrigger>
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
              <TabsTrigger value="monthly" disabled>Monthly</TabsTrigger>
            </TabsList>
            <TabsContent value="daily">
              <Card padding="sm">Daily operational performance.</Card>
            </TabsContent>
            <TabsContent value="weekly">
              <Card padding="sm">Weekly operational performance.</Card>
            </TabsContent>
            <TabsContent value="monthly">
              <Card padding="sm">Monthly operational performance.</Card>
            </TabsContent>
          </Tabs>
        </div>
      </CatalogSection>

      <CatalogSection
        title="Route navigation"
        description="Real links keep current-page state, counts, and narrow-screen overflow separate from in-panel tabs."
      >
        <NavigationTabs
          aria-label="Case workflow"
          currentPath="/workflow/send"
          LinkComponent={CatalogNavigationLink}
          items={[
            { href: '/workflow', label: 'Cases', exact: true, badge: 18 },
            { href: '/workflow/confirm', label: 'To confirm', badge: 7 },
            { href: '/workflow/send', label: 'To send', badge: 4 },
            { href: '/workflow/evidence', label: 'Evidence to approve', badge: 2 },
            { href: '/workflow/upload', label: 'To upload', badgeLoading: true },
            { href: '/workflow/penalties', label: 'Penalties' },
          ]}
        />
      </CatalogSection>

      <CatalogSection
        title="Dialogs and sheets"
        description="Centered workflows, destructive confirmations, and edge panels share one focus, layering, and responsive surface contract."
      >
        <div className="catalog__row">
          <DialogRoot>
            <DialogTrigger asChild>
              <Button variant="secondary">Open dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assign fleet</DialogTitle>
                <DialogDescription>
                  Confirm the unit and operating coverage before continuing.
                </DialogDescription>
              </DialogHeader>
              <Input label="Route" defaultValue="ROUTE-001" fullWidth />
              <FormField label="Operating team" fullWidth>
                <WorkspaceRichSelect defaultValue="liveops" />
              </FormField>
              <FormField label="Assignment date" fullWidth>
                <DatePicker defaultValue="2026-07-15" fullWidth />
              </FormField>
              <DialogFooter>
                <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                <DialogClose asChild><Button>Assign route</Button></DialogClose>
              </DialogFooter>
            </DialogContent>
          </DialogRoot>

          <AlertDialogRoot>
            <AlertDialogTrigger asChild>
              <Button variant="danger">Open confirmation</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete route?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone and removes its assignment history.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep route</AlertDialogCancel>
                <AlertDialogAction variant="danger">Delete route</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialogRoot>

          <SheetRoot>
            <SheetTrigger asChild>
              <Button variant="outline">Open sheet</Button>
            </SheetTrigger>
            <SheetContent side="right" width="md">
              <SheetHeader>
                <SheetTitle>Route filters</SheetTitle>
                <SheetDescription>Limit the routes visible in this workspace.</SheetDescription>
              </SheetHeader>
              <Input label="Client" placeholder="Search by client" fullWidth />
              <SheetFooter>
                <SheetClose asChild><Button>Apply filters</Button></SheetClose>
              </SheetFooter>
            </SheetContent>
          </SheetRoot>
        </div>
      </CatalogSection>

      <CatalogSection
        title="Pagination"
        description="Controlled result navigation owns range math, valid bounds, responsive labels, and accessible announcements."
      >
        <div className="catalog__pagination-stack">
          <Pagination
            page={paginationPage}
            pageSize={20}
            totalItems={94}
            onPageChange={setPaginationPage}
            aria-label="Route results pages"
          />
          <Pagination
            page={1}
            pageSize={20}
            totalItems={0}
            onPageChange={() => {}}
            disabled
            aria-label="Empty results pages"
          />
        </div>
      </CatalogSection>

      <CatalogSection
        title="Table"
        description="Data-driven and compound semantic tables share responsive overflow, density, row interaction, and theme behavior."
      >
        <div className="catalog__grid">
          <Table
            label="Rutas de ejemplo"
            stickyFirstColumn
            rows={[
              { id: 'ROUTE-001', client: 'Example Co.', status: 'En ruta', amount: 18450 },
              { id: 'ROUTE-002', client: 'Northwind', status: 'Entregada', amount: 22390 },
              { id: 'ROUTE-003', client: 'Contoso', status: 'Por asignar', amount: 12800 },
            ]}
            getRowKey={(row) => row.id}
            columns={[
              { key: 'id', header: 'Ruta' },
              { key: 'client', header: 'Cliente' },
              { key: 'status', header: 'Estado' },
              {
                key: 'amount',
                header: 'Importe',
                align: 'end',
                render: (row) => `$${row.amount.toLocaleString('es-MX')}`,
              },
            ]}
          />

          <Table
            aria-label="Workspace access"
            scrollLabel="Workspace access table"
            density="compact"
          >
            <TableCaption>Access by operating team</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead>Access</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                aria-label="Open Dispatcher permissions"
                data-state={selectedRole === 'dispatcher' ? 'selected' : undefined}
                onClick={() => setSelectedRole('dispatcher')}
              >
                <TableCell>Dispatcher</TableCell>
                <TableCell><Badge tone="green">Editor</Badge></TableCell>
                <TableCell><Button size="xs" variant="ghost">Review</Button></TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Operations</TableCell>
                <TableCell><Badge tone="neutral">Read only</Badge></TableCell>
                <TableCell>Managed centrally</TableCell>
              </TableRow>
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3}>2 team profiles</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </CatalogSection>

      <CatalogSection
        title="Page chrome"
        description="The standard page header, KPI tile, toolbar surface, icon-only button, and confirm dialog the staff apps share."
      >
        <div className="catalog__grid">
          <div style={{ display: 'grid', gap: '16px' }}>
            <PageHeader
              eyebrow="Finanzas"
              title="Cobranza"
              subtitle="Resumen de cobranza de la semana en curso."
              actions={
                <>
                  <Button size="sm" variant="secondary">Exportar</Button>
                  <Button size="sm" variant="primary">Nueva nota</Button>
                </>
              }
            />
            <Toolbar>
              <Input aria-label="Buscar" placeholder="Buscar cliente" />
              <Button size="sm" variant="ghost">Filtros</Button>
              <IconButton label="Actualizar" icon={<Search />} size="sm" />
            </Toolbar>
          </div>
          <div className="catalog__row">
            <StatTile
              label="Flotillas activas"
              value={42}
              hint="últimos 30 días"
              icon={Truck}
              tone="blue"
              trendValue={12}
            />
            <StatTile
              label="Cobranza vencida"
              value="$18,450"
              icon={CircleDollarSign}
              tone="rose"
              trendValue={-3}
              footer="vs. semana pasada"
            />
            <StatTile label="Rutas del día" value={128} icon={MapPinned} />
          </div>
          <div className="catalog__row">
            <IconButton label="Editar" icon={<Search />} size="sm" variant="default" />
            <IconButton label="Primario" icon={<Plus />} variant="primary" />
            <IconButton label="Peligro" icon={<Trash2 />} variant="danger" />
            <IconButton label="Compacto" icon={<Boxes />} compact />
            <Button size="sm" variant="secondary" onClick={() => setConfirmOpen(true)}>
              Abrir confirmación
            </Button>
            <ConfirmDialog
              open={confirmOpen}
              onOpenChange={setConfirmOpen}
              title="Eliminar registro"
              description="Esta acción no se puede deshacer."
              confirmLabel="Eliminar"
              destructive
              icon={Trash2}
              onConfirm={() => setConfirmOpen(false)}
            />
          </div>
        </div>
      </CatalogSection>
    </main>
  );
}

export function UiLightCatalog() {
  return <UiCatalog mode="light" />;
}

export function UiDarkCatalog() {
  return <UiCatalog mode="dark" />;
}

export function PaginationDemo({
  initialPage = 2,
  totalItems = 94,
}: {
  initialPage?: number;
  totalItems?: number;
}) {
  const [page, setPage] = useState(initialPage);
  return (
    <div style={{ boxSizing: 'border-box', width: '100%', padding: 24 }}>
      <Pagination
        page={page}
        pageSize={20}
        totalItems={totalItems}
        onPageChange={setPage}
        aria-label="Route results pages"
      />
    </div>
  );
}

export function InvalidPaginationDemo() {
  return (
    <Pagination
      page={0}
      pageSize={20}
      totalItems={94}
      onPageChange={() => {}}
      aria-label="Invalid route results pages"
    />
  );
}

function DialogCatalog({ mode }: { mode: CatalogMode }) {
  return (
    <div data-testid={`dialog-${mode}-catalog`}>
      <Dialog
        open
        onClose={() => {}}
        title="Asignar flotilla"
        description="Confirma la unidad y la cobertura antes de continuar."
        footer={
          <>
            <Button variant="ghost">Cancelar</Button>
            <Button>Asignar ruta</Button>
          </>
        }
      >
        <div className="catalog__grid">
          <Input label="Ruta" defaultValue="ROUTE-001" fullWidth />
          <Select
            label="Unidad"
            defaultValue="van"
            options={[{ value: 'van', label: 'Small Van' }]}
            fullWidth
          />
        </div>
      </Dialog>
    </div>
  );
}

export function DialogLightCatalog() {
  return <DialogCatalog mode="light" />;
}

export function DialogDarkCatalog() {
  return <DialogCatalog mode="dark" />;
}

const SHELL_SECTIONS: NavSection[] = [
  {
    id: 'main',
    items: [{ href: '/inicio', label: 'Inicio', icon: LayoutDashboard }],
  },
  {
    id: 'operacion',
    label: 'Operación',
    items: [
      { href: '/rutas', label: 'Rutas', icon: MapPinned, badge: 4 },
      {
        id: 'red',
        label: 'Red de transporte',
        icon: Truck,
        children: [
          { href: '/flotillas', label: 'Flotillas', icon: Users },
          { href: '/unidades', label: 'Unidades', icon: Boxes },
        ],
      },
      { href: '/finanzas', label: 'Finanzas', icon: CircleDollarSign },
    ],
  },
];

const STAFF_SHELL: StaffShellContextValue = {
  user: { id: 'catalog-user', name: 'Mariana Example', email: 'mariana@example.com' },
  profileHref: '#perfil',
  preferences: { theme: 'light', locale: 'es' },
  notifications: {
    unreadCount: 1,
    href: '#notificaciones',
    items: [
      {
        id: 'catalog-notification',
        title: 'Ruta lista para revisión',
        body: 'ROUTE-001 recibió evidencia nueva.',
        createdAt: '2026-07-28T18:00:00.000Z',
        timeLabel: 'Hace 8 min',
      },
    ],
  },
  setTheme: () => {},
  setLocale: () => {},
  markNotificationRead: () => {},
  signOut: () => {},
};

function ShellCatalog({ mode }: { mode: CatalogMode }) {
  const shellContext: StaffShellContextValue = {
    ...STAFF_SHELL,
    preferences: { ...STAFF_SHELL.preferences, theme: mode },
  };

  return (
    <StaffShellProvider value={shellContext}>
      <AppShell
        sections={SHELL_SECTIONS}
        currentPath="/rutas"
        subtitle="Operations"
        primaryAction={<Button icon={Plus} fullWidth>Nueva ruta</Button>}
        globalHeader={
          <GlobalHeader
            currentSub="liveops"
            start={<SidebarTrigger />}
          />
        }
      >
        <main className="catalog__shell-content" data-testid={`shell-${mode}-catalog`}>
          <Card shadow>
            <CardHeader title="Rutas activas" />
            <CardContent><strong>148</strong></CardContent>
          </Card>
          <Card shadow>
            <CardHeader title="Cumplimiento" />
            <CardContent><strong>96.4%</strong></CardContent>
          </Card>
          <Card shadow>
            <CardHeader title="Alertas" />
            <CardContent><Badge tone="warning" icon={Bell}>4 abiertas</Badge></CardContent>
          </Card>
        </main>
      </AppShell>
    </StaffShellProvider>
  );
}

export function ShellLightCatalog() {
  return <ShellCatalog mode="light" />;
}

export function ShellDarkCatalog() {
  return <ShellCatalog mode="dark" />;
}
