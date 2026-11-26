# Recipe: Inbox

The person works through many records, with one open at a time.

This is the full source of a screen that compiles and is tested. Copy the structure and
the props. Replace the sample data with the data of the app.

- `./fixtures` is sample data and two format helpers (`formatMoney`, `formatDate`). Use the
  app's own data and its shared format helpers.
- `./states` is in `states.md`.
- The `state` prop exists only to show each state in the catalogue. In an app, the state
  comes from the data request.
- The rules are in `../DESIGN.md`.

<!-- Generated from packages/showcase/src/recipes/InboxRecipe.tsx. Do not edit. -->

```tsx
import { useMemo, useState } from 'react';
import { FileText, MessageSquare, Send } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  DetailItem,
  DetailList,
  EmptyState,
  FilterChip,
  FilterChipRow,
  Input,
  ItemList,
  ItemRow,
  MultiSelect,
  Page,
  PageHeader,
  PageSkeleton,
  SearchField,
  SectionHeading,
  Separator,
  Stack,
  SplitView,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Toolbar,
  ToolbarSpacer,
  toneFromString,
} from '@partrunner-ai/ui';
import {
  INBOX_FLEETS,
  INBOX_PEOPLE,
  formatDate,
  formatMoney,
  type ChatItem,
  type ChatMessage,
  type InboxFleet,
  type NextStep,
} from './fixtures';
import { ErrorNotice, ForbiddenState, NoResults, type RecipeProps } from './states';

type View = 'all' | NextStep | 'overdue';

const STEP_ORDER: Record<NextStep, number> = { reply: 0, work: 1, fleet: 2 };
const STATE_LABEL: Record<NextStep, string> = {
  reply: 'Espera respuesta',
  work: 'En proceso',
  fleet: 'Espera a la flota',
};

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Text of the third line: the state, what is open and who has it. The urgency badge goes before it. */
function rowFooter(fleet: InboxFleet): string {
  const parts: string[] = [];
  if (fleet.nextStep !== 'reply') parts.push(fleet.nextStep === 'work' ? 'En proceso' : 'Espera a la flota');
  if (fleet.openCases > 0) parts.push(plural(fleet.openCases, 'aclaración', 'aclaraciones'));
  if (fleet.openChats > 0) parts.push(plural(fleet.openChats, 'chat', 'chats'));
  parts.push(fleet.owner ? `Atiende ${fleet.owner}` : 'Sin asignar');
  return parts.join(' · ');
}

function isWide(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(min-width: 900px)').matches;
}

interface ThreadGroup {
  key: string;
  from: ChatMessage['from'];
  author: string;
  messages: ChatMessage[];
}

type ThreadBlock = { type: 'group'; group: ThreadGroup } | { type: 'event'; item: Extract<ChatItem, { kind: 'event' }> };

/** One group for each run of consecutive messages of one author. */
function toBlocks(items: ChatItem[]): ThreadBlock[] {
  const blocks: ThreadBlock[] = [];
  for (const item of items) {
    if (item.kind === 'event') {
      blocks.push({ type: 'event', item });
      continue;
    }
    const last = blocks[blocks.length - 1];
    if (last?.type === 'group' && last.group.author === item.author) {
      last.group.messages.push(item);
    } else {
      blocks.push({ type: 'group', group: { key: item.id, from: item.from, author: item.author, messages: [item] } });
    }
  }
  return blocks;
}

function Conversation({ fleet }: { fleet: InboxFleet }) {
  const [draft, setDraft] = useState('');
  return (
    <Stack>
      <div className="chat" role="log" aria-label={`Conversación con ${fleet.name}`}>
        {toBlocks(fleet.messages).map((block) =>
          block.type === 'event' ? (
            <div key={block.item.id} className="chat__event">
              <Badge tone="info" icon={FileText}>
                {block.item.label}
              </Badge>
              <Button variant="link" size="sm">
                {block.item.caseTitle}
              </Button>
              <span className="chat__event-time">{block.item.time}</span>
            </div>
          ) : (
            <div key={block.group.key} className={`chat__group chat__group--${block.group.from}`}>
              <div className="chat__author">
                <Avatar name={block.group.author} size="sm" tone={toneFromString(block.group.author)} decorative />
                <span>{block.group.author}</span>
              </div>
              {block.group.messages.map((message) => (
                <div key={message.id} className={`chat__bubble chat__bubble--${message.from}`}>
                  {message.text}
                  <span className="chat__meta">{message.time}</span>
                </div>
              ))}
            </div>
          ),
        )}
      </div>
      <Separator />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setDraft('');
        }}
      >
        <Input
          fullWidth
          aria-label="Escribir mensaje"
          placeholder="Escribe un mensaje a la flota"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          trailing={
            <Button type="submit" size="sm" icon={Send} disabled={draft.trim() === ''}>
              Enviar
            </Button>
          }
        />
      </form>
    </Stack>
  );
}

function Clarifications({ fleet }: { fleet: InboxFleet }) {
  if (fleet.cases.length === 0) {
    return (
      <EmptyState
        title="Sin aclaraciones abiertas"
        description="Esta flota no tiene casos pendientes con Finanzas."
      />
    );
  }
  return (
    <Stack>
      {fleet.cases.map((item, index) => (
        <div key={item.id} className="recipes-stack">
          {index > 0 ? <Separator /> : null}
          <SectionHeading
            headingLevel={3}
            title={item.title}
            actions={
              <Badge tone={item.status === 'open' ? 'warning' : 'success'}>
                {item.status === 'open' ? 'Abierta' : 'Respondida'}
              </Badge>
            }
          />
          <DetailList columns={2}>
            <DetailItem label="Motivo" span="full">
              {item.reason}
            </DetailItem>
            <DetailItem label="Monto" numeric>
              {formatMoney(item.amount)}
            </DetailItem>
            <DetailItem label="Abierta el">{formatDate(item.opened)}</DetailItem>
            <DetailItem label="Responsable">{item.owner}</DetailItem>
          </DetailList>
        </div>
      ))}
    </Stack>
  );
}

function Profile({ fleet }: { fleet: InboxFleet }) {
  const { profile } = fleet;
  return (
    <DetailList layout="inline">
      <DetailItem label="RFC">{fleet.rfc}</DetailItem>
      <DetailItem label="Régimen fiscal">{profile.regime}</DetailItem>
      <DetailItem label="Ciudad">{fleet.city}</DetailItem>
      <DetailItem label="Unidades" numeric>
        {profile.units}
      </DetailItem>
      <DetailItem label="Saldo a cargo" numeric>
        {formatMoney(profile.balance)}
      </DetailItem>
      <DetailItem label="Contacto">{profile.contact}</DetailItem>
      <DetailItem label="Teléfono">{profile.phone}</DetailItem>
      <DetailItem label="Cliente desde">{formatDate(profile.since)}</DetailItem>
    </DetailList>
  );
}

function FleetDetail({ fleet }: { fleet: InboxFleet }) {
  return (
    <Stack>
      <SectionHeading
        title={
          <>
            {fleet.name}{' '}
            <Badge tone={fleet.nextStep === 'reply' ? (fleet.urgency ?? 'warning') : 'neutral'}>
              {STATE_LABEL[fleet.nextStep]}
            </Badge>
          </>
        }
        description={`${fleet.rfc} · ${fleet.city}`}
        actions={
          <>
            <Button size="sm" variant="ghost">
              Abrir ficha
            </Button>
            <Button size="sm" variant="secondary">
              Marcar resuelta
            </Button>
          </>
        }
      />
      <Tabs defaultValue="chat" key={fleet.id}>
        <TabsList>
          <TabsTrigger value="chat">Conversación</TabsTrigger>
          <TabsTrigger value="cases">Aclaraciones</TabsTrigger>
          <TabsTrigger value="profile">Perfil</TabsTrigger>
        </TabsList>
        <TabsContent value="chat">
          <Conversation fleet={fleet} />
        </TabsContent>
        <TabsContent value="cases">
          <Clarifications fleet={fleet} />
        </TabsContent>
        <TabsContent value="profile">
          <Profile fleet={fleet} />
        </TabsContent>
      </Tabs>
    </Stack>
  );
}

/** Recipe 2.3 · Inbox: a ticket desk. Toolbar with filters above a SplitView. */
export function InboxRecipe({ state, onRetry }: RecipeProps) {
  const [view, setView] = useState<View>('all');
  const [people, setPeople] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    isWide() ? (INBOX_FLEETS[0]?.id ?? null) : null,
  );

  const header = <PageHeader title="Bandeja de flotas" subtitle="Mensajes y aclaraciones que esperan al equipo." />;

  const all = useMemo(
    () =>
      state === 'empty'
        ? []
        : [...INBOX_FLEETS].sort((a, b) => STEP_ORDER[a.nextStep] - STEP_ORDER[b.nextStep]),
    [state],
  );
  const counts = useMemo(
    () => ({
      all: all.length,
      reply: all.filter((fleet) => fleet.nextStep === 'reply').length,
      work: all.filter((fleet) => fleet.nextStep === 'work').length,
      fleet: all.filter((fleet) => fleet.nextStep === 'fleet').length,
      overdue: all.filter((fleet) => fleet.urgency === 'danger').length,
    }),
    [all],
  );
  const fleets = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return all.filter((fleet) => {
      if (view === 'overdue' ? fleet.urgency !== 'danger' : view !== 'all' && fleet.nextStep !== view) return false;
      if (people.length > 0 && !(fleet.owner && people.includes(fleet.owner))) return false;
      return !needle || fleet.name.toLowerCase().includes(needle) || fleet.rfc.toLowerCase().includes(needle);
    });
  }, [all, view, people, query]);
  const filtered = view !== 'all' || people.length > 0 || query.trim() !== '';
  const clearFilters = () => {
    setView('all');
    setPeople([]);
    setQuery('');
  };

  if (state === 'forbidden') {
    return (
      <Page width="wide">
        {header}
        <ForbiddenState who="Finanzas y Soporte a flotas" />
      </Page>
    );
  }
  if (state === 'loading') {
    return (
      <Page width="wide">
        <PageSkeleton variant="chat" label="Cargando bandeja" />
      </Page>
    );
  }

  const selected = fleets.find((fleet) => fleet.id === selectedId) ?? null;
  const chips: Array<{ value: View; label: string; tone?: 'danger' }> = [
    { value: 'all', label: 'Todas' },
    { value: 'reply', label: 'Esperan respuesta' },
    { value: 'work', label: 'En proceso' },
    { value: 'fleet', label: 'Esperan a la flota' },
    { value: 'overdue', label: 'Vencidas', tone: 'danger' },
  ];

  return (
    <Page width="wide">
      {header}
      {state === 'error' ? <ErrorNotice what="la bandeja" onRetry={onRetry} /> : null}
      <Toolbar>
        <FilterChipRow aria-label="Vista">
          {chips.map((chip) => (
            <FilterChip
              key={chip.value}
              active={view === chip.value}
              count={counts[chip.value]}
              tone={chip.tone}
              dot={chip.tone != null}
              onClick={() => setView(chip.value)}
            >
              {chip.label}
            </FilterChip>
          ))}
        </FilterChipRow>
        <ToolbarSpacer />
        <MultiSelect
          variant="filter"
          aria-label="Atiende"
          placeholder="Atiende"
          options={INBOX_PEOPLE.map((person) => ({ value: person, label: person }))}
          value={people}
          onChange={setPeople}
        />
      </Toolbar>
      <SplitView
        className="inbox-split"
        listWidth="lg"
        listLabel="Conversaciones"
        detailLabel="Detalle de la flota"
        detailOpen={selected !== null}
        onBack={() => setSelectedId(null)}
        backLabel="Volver a la bandeja"
        listHeader={
          <div className="inbox-list-head">
            <SearchField
              fullWidth
              aria-label="Buscar flota"
              placeholder="Buscar flota o RFC"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <SectionHeading
              headingLevel={3}
              title={
                filtered
                  ? `${fleets.length} de ${counts.all} flotas`
                  : plural(counts.all, 'flota', 'flotas')
              }
            />
          </div>
        }
        list={
          fleets.length === 0 ? (
            state === 'empty' ? (
              <NoResults title="La bandeja está al día" description="No hay conversaciones abiertas con flotas." />
            ) : (
              <EmptyState
                title="Ninguna flota con este filtro"
                description="Prueba con otro filtro o con otro nombre."
                action={
                  <Button variant="secondary" size="sm" onClick={clearFilters}>
                    Quitar filtros
                  </Button>
                }
              />
            )
          ) : (
            // compact = the dense work queue: three text lines in about 59 px a row. Do not restyle the row parts.
            <ItemList aria-label="Flotas" density="compact">
              {fleets.map((fleet) => (
                <ItemRow
                  key={fleet.id}
                  tone={fleet.urgency ?? undefined}
                  leading={<Avatar name={fleet.name} size="sm" tone={toneFromString(fleet.id)} decorative />}
                  title={fleet.name}
                  unread={fleet.nextStep === 'reply'}
                  description={
                    <>
                      <strong>{fleet.lastSpeaker}:</strong> {fleet.lastMessage}
                    </>
                  }
                  meta={fleet.lastSeen}
                  footer={
                    <>
                      {fleet.urgency && fleet.signal ? (
                        <Badge tone={fleet.urgency} size="sm">
                          {fleet.signal}
                        </Badge>
                      ) : null}
                      {rowFooter(fleet)}
                    </>
                  }
                  selected={fleet.id === selectedId}
                  onClick={() => setSelectedId(fleet.id)}
                />
              ))}
            </ItemList>
          )
        }
        detail={
          selected ? (
            <FleetDetail fleet={selected} />
          ) : (
            <EmptyState
              icon={MessageSquare}
              title="Elige una conversación"
              description="Selecciona una flota de la lista para ver sus mensajes y aclaraciones."
            />
          )
        }
      />
    </Page>
  );
}
```
