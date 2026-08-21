import { useState } from 'react';
import { Combobox, type ComboboxOption } from '../src/Combobox';
import { Dialog } from '../src/Dialog';

const FLEETS: ComboboxOption[] = [
  { value: 'fleet-1', label: 'Transportes Uno' },
  { value: 'fleet-2', label: 'Fletes del Norte' },
];

export function FleetDialog() {
  const [value, setValue] = useState<ComboboxOption | null>(null);
  return (
    <Dialog open onClose={() => {}} title="Nueva solicitud">
      <Combobox
        value={value}
        onChange={setValue}
        onSearch={async (query) =>
          FLEETS.filter((fleet) => fleet.label.toLowerCase().includes(query.toLowerCase()))
        }
        debounceMs={0}
        placeholder="Buscar flotilla…"
      />
    </Dialog>
  );
}

export function NestedFleetDialog() {
  return (
    <>
      <Dialog open onClose={() => {}} title="Solicitud">
        <button type="button">Control exterior</button>
      </Dialog>
      <Dialog open onClose={() => {}} title="Asignar flotilla">
        <Combobox
          value={null}
          onChange={() => {}}
          onSearch={async () => FLEETS}
          debounceMs={0}
          placeholder="Buscar flotilla anidada…"
        />
      </Dialog>
    </>
  );
}
