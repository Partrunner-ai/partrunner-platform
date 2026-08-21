import { useState } from 'react';
import {
  Checkbox,
  Combobox,
  Input,
  MultiSelect,
  RadioGroup,
  Select,
  Switch,
  Textarea,
  type ComboboxOption,
} from '@partrunner-ai/ui';

const FLEETS: ComboboxOption[] = [
  { value: 'norte', label: 'Fletes del Norte' },
  { value: 'centro', label: 'Transportes Centro' },
];

const REGIONS = [
  { value: 'cdmx', label: 'CDMX' },
  { value: 'gdl', label: 'Guadalajara' },
];

export function HostileConsumerFields() {
  const [priority, setPriority] = useState('normal');
  const [fleet, setFleet] = useState<ComboboxOption | null>(null);
  const [regions, setRegions] = useState<string[]>([]);

  return (
    <main style={{ display: 'grid', gap: 24, maxWidth: 420, padding: 32 }}>
      <style>{`
        :focus-visible {
          outline: 4px solid rgb(255 0 0);
          border-radius: 999px;
          box-shadow: 0 0 0 8px rgb(255 0 0);
        }
      `}</style>

      <Input aria-label="Entrada compacta" placeholder="Entrada compacta" fullWidth />
      <Input label="Ruta" placeholder="PR0267347" fullWidth />
      <Select
        label="Tipo de unidad"
        placeholder="Selecciona una opción"
        options={[
          { value: 'van', label: 'Small Van' },
          { value: 'car', label: 'Car' },
        ]}
        fullWidth
      />
      <Textarea label="Observaciones" placeholder="Contexto operativo" fullWidth />

      <Checkbox label="Confirmar evidencia" />
      <Switch label="Asignación automática" />
      <RadioGroup
        name="consumer-priority"
        label="Prioridad"
        options={[
          { value: 'normal', label: 'Normal' },
          { value: 'urgent', label: 'Urgente' },
        ]}
        value={priority}
        onValueChange={setPriority}
      />

      <Combobox
        aria-label="Flotilla"
        placeholder="Buscar flotilla"
        value={fleet}
        onChange={setFleet}
        onSearch={async () => FLEETS}
        debounceMs={0}
      />
      <MultiSelect
        aria-label="Regiones"
        searchLabel="Buscar regiones"
        options={REGIONS}
        value={regions}
        onChange={setRegions}
      />
    </main>
  );
}
