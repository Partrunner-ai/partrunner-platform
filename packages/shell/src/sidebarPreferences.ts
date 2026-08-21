export interface AppShellInitialState {
  collapsed: boolean;
  groups: Record<string, boolean>;
}

interface StoredGroupsV1 {
  version: 1;
  groups: Record<string, boolean>;
}

export function appShellGroupsKey(storageKey: string): string {
  return `${storageKey}:groups`;
}

function cookieValues(cookieHeader: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const entry of cookieHeader.split(';')) {
    const separator = entry.indexOf('=');
    if (separator < 0) continue;
    const name = entry.slice(0, separator).trim();
    if (!name) continue;
    values.set(name, entry.slice(separator + 1).trim());
  }
  return values;
}

function booleanRecord(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, boolean] => {
      return typeof entry[1] === 'boolean';
    }),
  );
}

export function decodeAppShellGroups(value: string | null | undefined): Record<string, boolean> {
  if (!value) return {};
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    // Legacy localStorage values are raw JSON and may contain a literal `%`.
  }

  try {
    const parsed = JSON.parse(decoded) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      (parsed as Partial<StoredGroupsV1>).version === 1
    ) {
      return booleanRecord((parsed as Partial<StoredGroupsV1>).groups);
    }
    // Backward compatibility with the original unversioned localStorage record.
    return booleanRecord(parsed);
  } catch {
    return {};
  }
}

export function encodeAppShellGroups(groups: Record<string, boolean>): string {
  const stored: StoredGroupsV1 = { version: 1, groups: booleanRecord(groups) };
  return encodeURIComponent(JSON.stringify(stored));
}

export function parseAppShellState(
  cookieHeader: string,
  storageKey = 'pr-sidebar-collapsed',
): AppShellInitialState {
  const values = cookieValues(cookieHeader);
  return {
    collapsed: values.get(storageKey) === '1',
    groups: decodeAppShellGroups(values.get(appShellGroupsKey(storageKey))),
  };
}
