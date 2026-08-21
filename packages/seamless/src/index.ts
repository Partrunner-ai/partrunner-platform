// Browser-safe framework-agnostic entry. Secret resolution, JWT verification,
// and cookie operations are available only from "@partrunner-ai/seamless/server".
export {
  BRAND,
  hasRole,
  isSuperAdmin,
  nexusHomeUrl,
  nexusLoginUrl,
  safeNextPath,
  type NexusSession,
  type NexusUrlConfig,
} from './core';
export {
  NEXUS_NAV_ITEM,
  buildNavManifest,
  isNavManifest,
  type NavAccent,
  type NavManifest,
  type NavManifestItem,
  type NavManifestSection,
} from './nav';
