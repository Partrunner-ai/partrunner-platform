import { useMemo, useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  DetailItem,
  DetailList,
  EmptyState,
  Input,
  ItemList,
  ItemRow,
  Page,
  PageHeader,
  PageSkeleton,
  SearchField,
  SectionHeading,
  SegmentedControl,
  Separator,
  Stack,
  SplitView,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@partrunner-ai/ui';
import { INBOX_FLEETS, formatDate, formatMoney, type InboxFleet } from './fixtures';
import { ErrorNotice, ForbiddenState, NoResults, type RecipeProps } from './states';

type Filter = 'all' | 'unread';

function isWide(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(min-width: 900px)').matches;
}

function Conversation({ fleet }: { fleet: InboxFleet }) {
  const [draft, setDraft] = useState('');
  return (
    <Stack>
      <div className="chat" role="log" aria-label={`Conversación con ${fleet.name}`}>
        {fleet.messages.map((message) => (
          <div
            key={message.id}
            className={`chat__bubble${message.from === 'team' ? ' chat__bubble--team' : ''}`}
          >
            {message.text}
            <span className="chat__meta">
              {message.author} · {message.time}
            </span>
          </div>
        ))}
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
        title={fleet.name}
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

/** Recipe 2.3 · Inbox: SplitView with a list and a detail pane. */
export function InboxRecipe({ state, onRetry }: RecipeProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    isWide() ? (INBOX_FLEETS[0]?.id ?? null) : null,
  );

  const header = <PageHeader title="Bandeja de flotas" subtitle="Mensajes y aclaraciones que esperan al equipo." />;

  const fleets = useMemo(() => {
    if (state === 'empty') return [];
    const needle = query.trim().toLowerCase();
    return INBOX_FLEETS.filter((fleet) => {
      if (filter === 'unread' && fleet.unread === 0) return false;
      return !needle || fleet.name.toLowerCase().includes(needle) || fleet.rfc.toLowerCase().includes(needle);
    }).sort((a, b) => Number(b.unread > 0) - Number(a.unread > 0));
  }, [filter, query, state]);

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

  const unreadTotal = INBOX_FLEETS.reduce((sum, fleet) => sum + (fleet.unread > 0 ? 1 : 0), 0);
  const selected = fleets.find((fleet) => fleet.id === selectedId) ?? null;

  return (
    <Page width="wide">
      <PageHeader
        title="Bandeja de flotas"
        subtitle="Mensajes y aclaraciones que esperan al equipo."
        actions={
          <SegmentedControl<Filter>
            aria-label="Vista"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'Todas' },
              { value: 'unread', label: 'Sin leer', count: state === 'empty' ? 0 : unreadTotal },
            ]}
          />
        }
      />
      {state === 'error' ? <ErrorNotice what="la bandeja" onRetry={onRetry} /> : null}
      <SplitView
        listLabel="Conversaciones"
        detailLabel="Detalle de la flota"
        detailOpen={selected !== null}
        onBack={() => setSelectedId(null)}
        backLabel="Volver a la bandeja"
        listHeader={
          <SearchField
            fullWidth
            aria-label="Buscar flota"
            placeholder="Buscar flota o RFC"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        }
        list={
          fleets.length === 0 ? (
            <NoResults
              title={state === 'empty' ? 'La bandeja está al día' : 'Ninguna flota coincide'}
              description={
                state === 'empty'
                  ? 'No hay conversaciones abiertas con flotas.'
                  : 'Prueba con otro nombre o RFC.'
              }
            />
          ) : (
            <ItemList aria-label="Flotas">
              {fleets.map((fleet) => (
                <ItemRow
                  key={fleet.id}
                  title={fleet.name}
                  description={fleet.lastMessage}
                  descriptionLines={2}
                  meta={fleet.lastSeen}
                  leading={<Avatar name={fleet.name} size="sm" />}
                  trailing={fleet.unread > 0 ? <Badge tone="neutral">{fleet.unread}</Badge> : undefined}
                  unread={fleet.unread > 0}
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
