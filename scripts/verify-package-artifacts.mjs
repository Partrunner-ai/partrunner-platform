import assert from 'node:assert/strict';
import { parse } from 'acorn';
import * as acornWalk from 'acorn-walk';
import postcss from 'postcss';
import valueParser from 'postcss-value-parser';
import {
  gte as semverGte,
  prerelease as semverPrerelease,
  valid as validSemver,
} from 'semver';
import { Buffer } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { isBuiltin } from 'node:module';
import {
  copyFile,
  lstat,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  basename,
  dirname,
  isAbsolute,
  join,
  posix,
  relative,
  resolve,
} from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { TextDecoder } from 'node:util';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_REGISTRY = 'https://registry.npmjs.org';
function retainedArtifactDirectory(value) {
  if (!value?.trim()) return null;
  assert(
    !isAbsolute(value),
    'Retained artifact output must be repository-relative',
  );
  const target = resolve(ROOT, value);
  const pathFromRoot = relative(ROOT, target);
  assert(
    pathFromRoot.startsWith(`.artifacts${posix.sep}`) &&
      !pathFromRoot.includes('\\'),
    'Retained artifact output must be inside .artifacts/',
  );
  return target;
}

const RETAINED_ARTIFACT_DIRECTORY = retainedArtifactDirectory(
  process.env.PARTRUNNER_ARTIFACT_OUTPUT_DIR,
);
assert.throws(
  () => retainedArtifactDirectory('../outside'),
  /inside \.artifacts|repository-relative/,
);
const ROOT_LICENSE_TEXT = await readFile(join(ROOT, 'LICENSE'), 'utf8');
const ROOT_TRADEMARK_TEXT = await readFile(
  join(ROOT, 'TRADEMARKS.md'),
  'utf8',
);
const ALLOWED_REGISTRY_HOSTS = new Set(['registry.npmjs.org']);
const MIT_REQUIRED_BODY = `
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();
const EXPECTED_PACKAGES = [
  '@partrunner-ai/api-core',
  '@partrunner-ai/app-registry',
  '@partrunner-ai/seamless',
  '@partrunner-ai/shell',
  '@partrunner-ai/tokens',
  '@partrunner-ai/ui',
];
const REACT_LINES = [
  {
    name: 'react18',
    react: '18.3.1',
    reactDom: '18.3.1',
    reactTypes: '18.3.31',
    reactDomTypes: '18.3.7',
    lucide: '0.460.0',
  },
  {
    name: 'react19',
    react: '19.2.8',
    reactDom: '19.2.8',
    reactTypes: '19.2.18',
    reactDomTypes: '19.2.3',
    lucide: '1.32.0',
  },
];
const SENSITIVE_CONTENT = [
  [
    'private key',
    /-----BEGIN (?:(?:DSA |EC |ENCRYPTED |OPENSSH |RSA )?PRIVATE KEY|PGP PRIVATE KEY BLOCK)-----/,
  ],
  ['PuTTY private key', /PuTTY-User-Key-File-[23]:/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{20,}\b/],
  ['fine-grained GitHub token', /\bgithub_pat_[A-Za-z0-9_]{20,}\b/],
  ['npm token', /\bnpm_[A-Za-z0-9]{20,}\b/],
  ['AWS access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['Supabase secret key', /\bsb_secret_[A-Za-z0-9_-]{20,}\b/],
  ['Stripe secret key', /\bsk_(?:live|test)_[A-Za-z0-9]{20,}\b/],
  [
    'credential-bearing URL',
    /\bhttps?:\/\/[^/\s:@]+:[^/\s@]+@[^\s/]+/i,
  ],
  [
    'Yarn npm auth token',
    /["']?npmAuthToken["']?\s*:\s*(?!["']?\$\{)["']?[^"'\s#]+["']?/i,
  ],
  [
    'netrc credential',
    /\b(?:machine\s+\S+|default)(?:\s+(?:login|user)\s+\S+)?\s+password\s+\S+/i,
  ],
  [
    'literal registry auth credential',
    /\/\/[^\s"'=]+:(?:_authToken|_auth|_password)["']?\s*(?:=|:)\s*(?!["']?\$\{)["']?[^"'\s]+/i,
  ],
];
const OPTIONAL_RUNTIME_IMPORTS = new Map([
  ['@partrunner-ai/api-core', new Set(['bcryptjs'])],
]);
const FORBIDDEN_PUBLISH_SCRIPTS = [
  'preinstall',
  'install',
  'postinstall',
  'prepublish',
  'prepare',
  'prepublishOnly',
  'prepack',
  'postpack',
  'publish',
  'postpublish',
];
const FORBIDDEN_PATHS = [
  /(^|\/)\.env(?:\.|$)/i,
  /(^|\/)(?:\.envrc|\.netrc|_netrc)$/i,
  /(^|\/)\.npmrc$/i,
  /(^|\/)\.yarnrc(?:\.ya?ml)?$/i,
  /(^|\/)binding\.gyp$/i,
  /(^|\/)\.git(?:\/|$)/i,
  /(^|\/)src\//i,
  /(^|\/)(?:__fixtures__|__tests__|fixtures?|tests?)(?:\/|$)/i,
  /\.(?:der|jks|key|keystore|node|p8|p12|pem|pfx|pk8|ppk)$/i,
  /\.(?:jsx|tsx)$/i,
  /(?<!\.d)\.(?:cts|mts|ts)$/i,
  /\.(?:spec|test)\.[cm]?[jt]sx?$/i,
];

assert(
  FORBIDDEN_PATHS.some((pattern) =>
    pattern.test('dist/signing.pk8'),
  ),
);

function verifySensitivePatterns() {
  const samples = new Map([
    ['private key', `-----BEGIN ${'PRIVATE'} KEY-----`],
    ['PuTTY private key', `PuTTY-User-Key-File-3: ${'ssh-rsa'}`],
    ['GitHub token', `ghp_${'a'.repeat(36)}`],
    ['fine-grained GitHub token', `github_pat_${'a_'.repeat(20)}`],
    ['npm token', `npm_${'a'.repeat(36)}`],
    ['AWS access key', `AKIA${'A'.repeat(16)}`],
    ['Supabase secret key', `sb_secret_${'a'.repeat(24)}`],
    ['Stripe secret key', `sk_live_${'a'.repeat(24)}`],
    [
      'credential-bearing URL',
      `https://${'fixture-user'}:${'fixture-password'}@registry.example.test/`,
    ],
    ['Yarn npm auth token', `"npmAuthToken": "${'literal-value'}"`],
    [
      'netrc credential',
      `machine registry.example.test login ${'fixture-user'} password ${'fixture-password'}`,
    ],
    [
      'literal registry auth credential',
      `const npmrc = "//registry.example.test/private/:_authToken=${'literal-value'}"`,
    ],
  ]);

  for (const [label, pattern] of SENSITIVE_CONTENT) {
    assert(
      pattern.test(samples.get(label)),
      `Credential detector has no passing regression sample for ${label}`,
    );
  }
  const privateKeyPattern = SENSITIVE_CONTENT.find(
    ([label]) => label === 'private key',
  )?.[1];
  assert(privateKeyPattern?.test(`-----BEGIN ${'ENCRYPTED'} PRIVATE KEY-----`));
  assert(privateKeyPattern?.test(`-----BEGIN ${'PGP'} PRIVATE KEY BLOCK-----`));
  const awsKeyPattern = SENSITIVE_CONTENT.find(
    ([label]) => label === 'AWS access key',
  )?.[1];
  assert(awsKeyPattern?.test(`ASIA${'A'.repeat(16)}`));
  const yarnTokenPattern = SENSITIVE_CONTENT.find(
    ([label]) => label === 'Yarn npm auth token',
  )?.[1];
  const registryCredentialPattern = SENSITIVE_CONTENT.find(
    ([label]) => label === 'literal registry auth credential',
  )?.[1];
  const placeholder = '${' + 'NPM_TOKEN}';
  assert(!yarnTokenPattern?.test(`npmAuthToken: ${placeholder}`));
  assert(
    !registryCredentialPattern?.test(
      `//registry.example.test/:_authToken=${placeholder}`,
    ),
  );
  assert(
    !registryCredentialPattern?.test(
      `"//registry.example.test/:_authToken": "${placeholder}"`,
    ),
  );
  assert(
    registryCredentialPattern?.test(
      `"//registry.example.test/:_auth": "${'base64-value'}"`,
    ),
  );
  const netrcPattern = SENSITIVE_CONTENT.find(
    ([label]) => label === 'netrc credential',
  )?.[1];
  assert(
    netrcPattern?.test(
      `default login ${'fixture-user'} password ${'fixture-password'}`,
    ),
  );
}

verifySensitivePatterns();

function verifyNoPublishLifecycle(manifest, source) {
  for (const script of FORBIDDEN_PUBLISH_SCRIPTS) {
    assert(
      !manifest.scripts?.[script],
      `${manifest.name} ${source} manifest uses ${script}, so publish could differ from the validated pack`,
    );
  }
}

function verifyManifestShape(manifest, source) {
  assert(
    typeof manifest.name === 'string' && manifest.name.trim(),
    `${source} package name must be a non-empty string`,
  );
  assert(
    typeof manifest.version === 'string' &&
      validSemver(manifest.version) === manifest.version,
    `${manifest.name} ${source} version must be canonical semver`,
  );
  assert(
    typeof manifest.license === 'string' && manifest.license.trim(),
    `${manifest.name} ${source} license must be a non-empty string`,
  );
  assert.equal(
    manifest.type,
    'module',
    `${manifest.name} ${source} must declare type module`,
  );
  assert(
    Array.isArray(manifest.files) &&
      manifest.files.length > 0 &&
      manifest.files.every(
        (entry) =>
          typeof entry === 'string' &&
          entry.trim() === entry &&
          entry.length > 0 &&
          !entry.startsWith('/') &&
          !entry.includes('\\') &&
          !/(^|\/)\.\.?(?:\/|$)/.test(entry),
      ),
    `${manifest.name} ${source} files must contain safe non-empty paths`,
  );
  if (manifest.directories !== undefined) {
    assert(
      manifest.directories &&
        typeof manifest.directories === 'object' &&
        !Array.isArray(manifest.directories) &&
        manifest.directories.bin === undefined,
      `${manifest.name} ${source} must use explicit bin metadata instead of directories.bin`,
    );
  }
  if (manifest.bin !== undefined) {
    const bins =
      typeof manifest.bin === 'string'
        ? [manifest.bin]
        : manifest.bin &&
            typeof manifest.bin === 'object' &&
            !Array.isArray(manifest.bin)
          ? Object.values(manifest.bin)
          : [];
    assert(
      bins.length > 0 &&
        bins.every(
          (entry) =>
            typeof entry === 'string' &&
            entry.trim() === entry &&
            entry.length > 0 &&
            !entry.startsWith('/') &&
            !entry.includes('\\') &&
            !/(^|\/)\.\.?(?:\/|$)/.test(entry),
        ),
      `${manifest.name} ${source} bin targets must be safe non-empty paths`,
    );
  }
  assert(
    manifest.gypfile === undefined || manifest.gypfile === false,
    `${manifest.name} ${source} must not trigger an implicit native build`,
  );
  assert(
    manifest.repository &&
      typeof manifest.repository === 'object' &&
      !Array.isArray(manifest.repository) &&
      manifest.repository.type === 'git' &&
      typeof manifest.repository.url === 'string' &&
      manifest.repository.url.trim(),
    `${manifest.name} ${source} repository must declare a git URL`,
  );
  let repositoryUrl;
  try {
    repositoryUrl = new URL(manifest.repository.url);
  } catch {
    throw new Error(`${manifest.name} ${source} repository URL is invalid`);
  }
  assert.equal(
    repositoryUrl.protocol,
    'https:',
    `${manifest.name} ${source} repository must use HTTPS`,
  );
  assert(
    !repositoryUrl.username &&
      !repositoryUrl.password &&
      !repositoryUrl.search &&
      !repositoryUrl.hash,
    `${manifest.name} ${source} repository URL contains unsafe metadata`,
  );
  if (manifest.repository.directory !== undefined) {
    const directory = manifest.repository.directory;
    assert(
      typeof directory === 'string' &&
        directory.trim() === directory &&
        directory.length > 0 &&
        !directory.startsWith('/') &&
        !directory.includes('\\') &&
        !/(^|\/)\.\.?(?:\/|$)/.test(directory),
      `${manifest.name} ${source} repository directory is invalid`,
    );
  }
  assert(
    manifest.publishConfig &&
      typeof manifest.publishConfig === 'object' &&
      !Array.isArray(manifest.publishConfig),
    `${manifest.name} ${source} publishConfig must be an object`,
  );
  assert(
    manifest.publishConfig.directory === undefined,
    `${manifest.name} ${source} must publish from its package root`,
  );
  if (manifest.publishConfig.access !== undefined) {
    assert(
      ['public', 'restricted'].includes(manifest.publishConfig.access),
      `${manifest.name} ${source} publish access is invalid`,
    );
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? ROOT,
    encoding: 'utf8',
    env: options.env ?? process.env,
    stdio: options.stdio ?? 'pipe',
  });

  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr]
      .filter(Boolean)
      .join('\n');
    throw new Error(
      `${command} ${args.join(' ')} failed${detail ? `:\n${detail}` : ''}`,
    );
  }

  return result.stdout;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      assert(
        !entry.isSymbolicLink(),
        `Package extraction contains symbolic link ${path}`,
      );
      if (entry.isDirectory()) return walk(path);
      assert(entry.isFile(), `Package extraction contains special file ${path}`);
      return [path];
    }),
  );
  return paths.flat();
}

const textDecoder = new TextDecoder('utf-8', { fatal: true });

function decodeText(buffer) {
  try {
    return textDecoder.decode(buffer);
  } catch {
    return null;
  }
}

function mustDecodeAsText(file) {
  return (
    /\.(?:[cm]?[jt]s|css|html|json|map|md|markdown|svg|txt|ya?ml)$/i.test(
      file,
    ) ||
    /(^|\/)(?:changelog|licen[cs]e|readme)(?:\..+)?$/i.test(file)
  );
}

function containsCompleteMitBody(content) {
  return content
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .includes(MIT_REQUIRED_BODY);
}

assert(containsCompleteMitBody(MIT_REQUIRED_BODY));
assert(
  !containsCompleteMitBody(
    'Permission is hereby granted. THE SOFTWARE IS PROVIDED "AS IS".',
  ),
);

function isPublicVersion(value) {
  const version =
    typeof value === 'string' ? validSemver(value) : null;
  return Boolean(
    version &&
      semverGte(version, '1.0.0') &&
      semverPrerelease(version) === null,
  );
}

assert(isPublicVersion('1.0.0'));
assert(!isPublicVersion('0.9.9'));
assert(!isPublicVersion('1.x'));
assert(!isPublicVersion('1.'));
assert(!isPublicVersion('1.0.0-alpha.1'));
assert(!isPublicVersion('1.0.1-alpha.1'));
assert(!isPublicVersion('2.0.0-beta.1'));

function verifySensitiveContent(content, context) {
  for (const [label, pattern] of SENSITIVE_CONTENT) {
    assert(
      !pattern.test(content),
      `${context} contains a possible ${label}`,
    );
  }
}

function verifyDecodedArtifactScanner() {
  const decoded = decodeText(
    Buffer.from(`prefix\u0000github_pat_${'a_'.repeat(20)}`, 'utf8'),
  );
  assert.equal(typeof decoded, 'string');
  assert.throws(
    () => verifySensitiveContent(decoded, 'NUL regression fixture'),
    /fine-grained GitHub token/,
  );
}

verifyDecodedArtifactScanner();

function parseSourceMap(content, context) {
  try {
    return JSON.parse(content);
  } catch {
    throw new Error(`${context} contains an invalid source map`);
  }
}

function inspectSourceMap(sourceMap, context) {
  assert(
    sourceMap &&
      typeof sourceMap === 'object' &&
      !Array.isArray(sourceMap),
    `${context} source map must be an object`,
  );
  let embeddedSources = 0;
  if (sourceMap.sourcesContent !== undefined) {
    assert(
      Array.isArray(sourceMap.sourcesContent),
      `${context} sourcesContent must be an array`,
    );
    for (const source of sourceMap.sourcesContent) {
      assert(
        source === null || typeof source === 'string',
        `${context} sourcesContent entries must be strings or null`,
      );
      if (typeof source === 'string' && source.length > 0) {
        embeddedSources += 1;
      }
    }
  }

  const scanValue = (value, valueContext) => {
    if (typeof value === 'string') {
      verifySensitiveContent(value, valueContext);
      for (const [index, inlineMap] of inlineSourceMaps(
        value,
        valueContext,
      ).entries()) {
        embeddedSources += inspectSourceMap(
          inlineMap,
          `${valueContext} inline map ${index}`,
        );
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry, index) =>
        scanValue(entry, `${valueContext} item ${index}`),
      );
      return;
    }
    if (value && typeof value === 'object') {
      Object.entries(value).forEach(([key, entry], index) => {
        scanValue(key, `${valueContext} key ${index}`);
        scanValue(entry, `${valueContext} field ${index}`);
      });
    }
  };

  Object.entries(sourceMap)
    .filter(([key]) => key !== 'sections')
    .forEach(([key, value], index) => {
      scanValue(key, `${context} key ${index}`);
      scanValue(value, `${context} field ${index}`);
    });

  if (sourceMap.sections !== undefined) {
    assert(
      Array.isArray(sourceMap.sections),
      `${context} source map sections must be an array`,
    );
    for (const [index, section] of sourceMap.sections.entries()) {
      assert(
        section &&
          typeof section === 'object' &&
          !Array.isArray(section) &&
          section.map &&
          typeof section.map === 'object',
        `${context} section ${index} must embed its map`,
      );
      Object.entries(section)
        .filter(([key]) => key !== 'map')
        .forEach(([key, value], fieldIndex) => {
          scanValue(
            key,
            `${context} section ${index} key ${fieldIndex}`,
          );
          scanValue(
            value,
            `${context} section ${index} field ${fieldIndex}`,
          );
        });
      embeddedSources += inspectSourceMap(
        section.map,
        `${context} section ${index}`,
      );
    }
  }
  return embeddedSources;
}

function inlineSourceMaps(content, context) {
  const maps = [];
  const pattern = /sourceMappingURL\s*=\s*(data:[^\s"]+)/gi;
  for (const match of content.matchAll(pattern)) {
    const dataUrl = match[1].replace(/\*\/$/, '');
    const comma = dataUrl.indexOf(',');
    assert(comma > 0, `${context} has an invalid inline source map`);
    const metadata = dataUrl.slice(0, comma);
    const payload = dataUrl.slice(comma + 1);
    let bytes;
    if (/;base64$/i.test(metadata)) {
      assert(
        /^[A-Za-z0-9+/]*={0,2}$/.test(payload) &&
          payload.length % 4 === 0,
        `${context} has invalid inline source-map base64`,
      );
      bytes = Buffer.from(payload, 'base64');
    } else {
      try {
        bytes = Buffer.from(decodeURIComponent(payload), 'utf8');
      } catch {
        throw new Error(`${context} has invalid inline source-map encoding`);
      }
    }
    const decoded = decodeText(bytes);
    assert(decoded !== null, `${context} inline source map must be UTF-8`);
    maps.push(parseSourceMap(decoded, `${context} inline source map`));
  }
  return maps;
}

function verifySourceMapScanner() {
  assert.throws(
    () =>
      inspectSourceMap(
        {
          sections: [
            {
              map: {
                sourcesContent: [
                  `PuTTY-User-Key-File-3: ${'ssh-rsa'}`,
                ],
              },
            },
          ],
        },
        'source-map regression fixture',
      ),
    /PuTTY private key/,
  );
  assert.throws(
    () =>
      inspectSourceMap(
        {
          sourceRoot: `https://${'fixture-user'}:${'fixture-password'}@example.test/`,
        },
        'source-root regression fixture',
      ),
    /credential-bearing URL/,
  );

  const inlineMap = Buffer.from(
    JSON.stringify({ sourcesContent: ['export const safe = true;'] }),
  ).toString('base64');
  for (const mime of [
    'application/json',
    'text/json',
    'application/octet-stream',
  ]) {
    const maps = inlineSourceMaps(
      `//# sourceMappingURL=data:${mime};base64,${inlineMap}`,
      'inline-map regression fixture',
    );
    assert.equal(maps.length, 1);
    assert.equal(
      inspectSourceMap(maps[0], 'inline-map regression fixture'),
      1,
    );
  }
  const percentEncodedMap = encodeURIComponent(
    JSON.stringify({
      sourceRoot: 'valid*)characters',
      sourcesContent: [`const value = 'safe';`],
    }),
  );
  const percentMaps = inlineSourceMaps(
    `/*# sourceMappingURL=data:application/json,${percentEncodedMap} */`,
    'percent-inline-map regression fixture',
  );
  assert.equal(percentMaps.length, 1);
  assert.equal(
    inspectSourceMap(
      percentMaps[0],
      'percent-inline-map regression fixture',
    ),
    1,
  );

  const nestedMap = Buffer.from(
    JSON.stringify({
      sourcesContent: [`PuTTY-User-Key-File-3: ${'ssh-rsa'}`],
    }),
  ).toString('base64');
  assert.throws(
    () =>
      inspectSourceMap(
        parseSourceMap(
          JSON.stringify({
            sourcesContent: [
              `//# sourceMappingURL=data:text/json;base64,${nestedMap}`,
            ],
          }),
          'nested-inline-map serialized fixture',
        ),
        'nested-inline-map regression fixture',
      ),
    /PuTTY private key/,
  );
  assert.throws(
    () =>
      inspectSourceMap(
        parseSourceMap(
          JSON.stringify({
            [`sourceMappingURL=data:text/json;base64,${nestedMap}`]:
              'custom field',
          }),
          'map-key serialized fixture',
        ),
        'map-key regression fixture',
      ),
    /PuTTY private key/,
  );
}

verifySourceMapScanner();

function normalizeRegistry(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Package registry must be a valid HTTPS URL');
  }
  assert.equal(url.protocol, 'https:', 'Package registry must use HTTPS');
  assert(
    !url.username && !url.password,
    'Package registry URL must not contain credentials',
  );
  assert(!url.search && !url.hash, 'Package registry URL must not contain query or fragment data');
  url.hostname = url.hostname.replace(/\.+$/, '');
  assert(
    ALLOWED_REGISTRY_HOSTS.has(url.hostname),
    'Package registry host is not approved for this repository',
  );
  assert(
    !url.port && url.pathname === '/',
    'Package registry must use the approved host root and default HTTPS port',
  );
  return url.href.replace(/\/+$/, '');
}

function effectiveRegistry(manifest) {
  const publishConfig = manifest.publishConfig ?? {};
  const scopedOverrides = Object.keys(publishConfig).filter((key) =>
    /:registry$/i.test(key),
  );
  assert.equal(
    scopedOverrides.length,
    0,
    `${manifest.name} must not use a scoped publish registry override`,
  );
  assert.equal(
    typeof publishConfig.registry,
    'string',
    `${manifest.name} must declare publishConfig.registry explicitly`,
  );
  return publishConfig.registry;
}

function verifyRegistryPolicy() {
  assert.equal(
    normalizeRegistry('https://registry.npmjs.org./'),
    normalizeRegistry(PUBLIC_REGISTRY),
  );
  assert.throws(
    () =>
      normalizeRegistry(
        `http://${'fixture-user'}:${'fixture-password'}@registry.example.test/`,
      ),
    /HTTPS/,
  );
  assert.throws(
    () => normalizeRegistry('https://registry.npmjs.com/'),
    /not approved/,
  );
  assert.throws(
    () => normalizeRegistry('https://npm.pkg.github.com/'),
    /not approved/,
  );
  assert.throws(
    () => normalizeRegistry('https://registry.npmjs.org/custom'),
    /host root/,
  );
  assert.throws(
    () => normalizeRegistry('https://registry.npmjs.org:8443/'),
    /default HTTPS port/,
  );
}

verifyRegistryPolicy();

function packageName(specifier) {
  if (specifier.startsWith('@')) {
    return specifier.split('/').slice(0, 2).join('/');
  }
  return specifier.split('/')[0];
}

function isRelativeSpecifier(specifier) {
  return (
    specifier === '.' ||
    specifier === '..' ||
    specifier.startsWith('./') ||
    specifier.startsWith('../')
  );
}

function staticSpecifier(node) {
  if (node?.type === 'Literal' && typeof node.value === 'string') {
    return node.value;
  }
  if (
    node?.type === 'TemplateLiteral' &&
    node.expressions.length === 0
  ) {
    return node.quasis[0]?.value.cooked ?? null;
  }
  if (node?.type === 'BinaryExpression' && node.operator === '+') {
    const left = staticSpecifier(node.left);
    const right = staticSpecifier(node.right);
    if (left !== null && right !== null) return `${left}${right}`;
  }
  return null;
}

function runtimeImports(file, content, packageType = 'module') {
  const imports = new Set();
  const extension = posix.extname(file).toLowerCase();
  const sourceType =
    extension === '.cjs'
      ? 'script'
      : extension === '.mjs'
        ? 'module'
        : extension === '.js'
          ? packageType === 'commonjs'
            ? 'script'
            : 'module'
          : null;
  const parseAs = (type) =>
    parse(content, {
      allowHashBang: true,
      allowReturnOutsideFunction: type === 'script',
      ecmaVersion: 'latest',
      sourceType: type,
    });
  let ast;
  try {
    ast = sourceType
      ? parseAs(sourceType)
      : parseAs('module');
  } catch {
    if (sourceType) {
      throw new Error(`${file} is not valid ${sourceType} JavaScript`);
    }
    try {
      ast = parseAs('script');
    } catch {
      throw new Error(`${file} is not valid auditable JavaScript`);
    }
  }
  const add = (node, kind) => {
    const specifier = staticSpecifier(node);
    assert(
      specifier,
      `${file} contains a non-static ${kind} that cannot be audited`,
    );
    if (specifier === 'module' || specifier === 'node:module') {
      throw new Error(`${file} contains unsupported loader syntax`);
    }
    imports.add(specifier);
  };
  const propertyName = (node) => {
    if (!node?.computed && node?.property?.type === 'Identifier') {
      return node.property.name;
    }
    return staticSpecifier(node?.property);
  };
  const unwrapSequence = (node) => {
    if (node?.type !== 'SequenceExpression') return node;
    return unwrapSequence(node.expressions.at(-1));
  };
  const directRequireName = (name) =>
    name === 'require' || name === '__require';
  const rejectUnsupportedLoader = () => {
    throw new Error(`${file} contains unsupported loader syntax`);
  };
  acornWalk.simple(ast, {
    ImportDeclaration: (node) => {
      if (
        node.specifiers.some(
          (specifier) =>
            specifier.type === 'ImportSpecifier' &&
            (specifier.imported.name ?? specifier.imported.value) ===
              'createRequire',
        )
      ) {
        rejectUnsupportedLoader();
      }
    },
    VariableDeclarator: (node) => {
      if (
        node.init?.type === 'MemberExpression' &&
        node.init.computed &&
        propertyName(node.init) === null &&
        ['ArrowFunctionExpression', 'FunctionExpression'].includes(
          node.init.object.type,
        )
      ) {
        rejectUnsupportedLoader();
      }
      if (
        node.id.type === 'ObjectPattern' &&
        node.id.properties.some((property) => {
          if (property.type !== 'Property') return false;
          if (property.computed) return true;
          const key =
            property.key.type === 'Identifier'
              ? property.key.name
              : staticSpecifier(property.key);
          return [
            'createRequire',
            'constructor',
            'eval',
            'Function',
            'getBuiltinModule',
            '_compile',
            '_load',
            '_resolveFilename',
            'require',
          ].includes(key);
        })
      ) {
        rejectUnsupportedLoader();
      }
      if (
        node.init?.type === 'Identifier' &&
        directRequireName(node.init.name)
      ) {
        rejectUnsupportedLoader();
      }
    },
    AssignmentExpression: (node) => {
      if (
        node.right.type === 'MemberExpression' &&
        node.right.computed &&
        propertyName(node.right) === null &&
        ['ArrowFunctionExpression', 'FunctionExpression'].includes(
          node.right.object.type,
        )
      ) {
        rejectUnsupportedLoader();
      }
      if (
        node.right.type === 'Identifier' &&
        directRequireName(node.right.name)
      ) {
        rejectUnsupportedLoader();
      }
    },
    MemberExpression: (node) => {
      if (
        [
          'createRequire',
          'constructor',
          'eval',
          'Function',
          'getBuiltinModule',
          '_compile',
          '_load',
          '_resolveFilename',
          'require',
        ].includes(
          propertyName(node),
        ) ||
        (node.computed &&
          node.object.type === 'Identifier' &&
          ['globalThis', 'module', 'process'].includes(
            node.object.name,
          ))
      ) {
        rejectUnsupportedLoader();
      }
    },
    CallExpression: (node) => {
      const callee = unwrapSequence(node.callee);
      if (
        callee?.type === 'MemberExpression' &&
        callee.computed &&
        propertyName(callee) === null
      ) {
        rejectUnsupportedLoader();
      }
      if (
        callee?.type === 'MemberExpression' &&
        ['apply', 'bind', 'call'].includes(propertyName(callee)) &&
        unwrapSequence(callee.object)?.type === 'Identifier' &&
        directRequireName(unwrapSequence(callee.object).name)
      ) {
        rejectUnsupportedLoader();
      }
      if (
        callee?.type === 'MemberExpression' &&
        callee.object.type === 'Identifier' &&
        callee.object.name === 'Reflect' &&
        propertyName(callee) === 'apply' &&
        node.arguments[0]?.type === 'Identifier' &&
        directRequireName(node.arguments[0].name)
      ) {
        rejectUnsupportedLoader();
      }
      if (
        node.callee.type === 'SequenceExpression' &&
        callee?.type === 'Identifier' &&
        directRequireName(callee.name)
      ) {
        rejectUnsupportedLoader();
      }
      if (
        callee?.type === 'Identifier' &&
        ['eval', 'Function'].includes(callee.name)
      ) {
        rejectUnsupportedLoader();
      }
    },
    NewExpression: (node) => {
      if (
        node.callee.type === 'Identifier' &&
        node.callee.name === 'Function'
      ) {
        rejectUnsupportedLoader();
      }
    },
    TaggedTemplateExpression: (node) => {
      if (
        node.tag.type === 'MemberExpression' &&
        node.tag.computed &&
        propertyName(node.tag) === null
      ) {
        rejectUnsupportedLoader();
      }
    },
  });
  acornWalk.ancestor(ast, {
    Identifier: (node, _state, ancestors) => {
      const parent = ancestors.at(-2);
      const grandparent = ancestors.at(-3);
      if (
        ['arguments', 'eval', 'Function', 'createRequire'].includes(
          node.name,
        )
      ) {
        rejectUnsupportedLoader();
      }
      if (
        node.name === 'Reflect' ||
        node.name === 'global' ||
        node.name === 'globalThis'
      ) {
        rejectUnsupportedLoader();
      }
      if (node.name === 'process') {
        const processEnv =
          parent?.type === 'MemberExpression' &&
          parent.object === node &&
          propertyName(parent) === 'env';
        if (!processEnv) rejectUnsupportedLoader();
      }
      if (node.name === 'module') {
        const moduleExports =
          parent?.type === 'MemberExpression' &&
          parent.object === node &&
          propertyName(parent) === 'exports';
        if (!moduleExports) rejectUnsupportedLoader();
      }
      if (/^_*require\d*$/.test(node.name) && !directRequireName(node.name)) {
        rejectUnsupportedLoader();
      }
      if (!directRequireName(node.name)) return;
      const directCall =
        parent?.type === 'CallExpression' && parent.callee === node;
      const directResolve =
        parent?.type === 'MemberExpression' &&
        parent.object === node &&
        propertyName(parent) === 'resolve' &&
        grandparent?.type === 'CallExpression' &&
        grandparent.callee === parent;
      if (!directCall && !directResolve) rejectUnsupportedLoader();
    },
    Property: (node, _state, ancestors) => {
      const parent = ancestors.at(-2);
      if (parent?.type !== 'ObjectPattern') return;
      const key =
        node.key.type === 'Identifier'
          ? node.key.name
          : staticSpecifier(node.key);
      if (
        [
          'createRequire',
          'constructor',
          'eval',
          'Function',
          'getBuiltinModule',
          '_compile',
          '_load',
          '_resolveFilename',
          'require',
        ].includes(key)
      ) {
        rejectUnsupportedLoader();
      }
    },
    MemberExpression: (node, _state, ancestors) => {
      if (
        node.object.type === 'MetaProperty' &&
        node.object.meta.name === 'import' &&
        node.object.property.name === 'meta' &&
        propertyName(node) === 'resolve'
      ) {
        const parent = ancestors.at(-2);
        if (
          parent?.type !== 'CallExpression' ||
          parent.callee !== node
        ) {
          rejectUnsupportedLoader();
        }
      }
    },
    MetaProperty: (node, _state, ancestors) => {
      if (
        node.meta.name === 'import' &&
        node.property.name === 'meta'
      ) {
        const parent = ancestors.at(-2);
        const grandparent = ancestors.at(-3);
        const directResolve =
          parent?.type === 'MemberExpression' &&
          parent.object === node &&
          propertyName(parent) === 'resolve' &&
          grandparent?.type === 'CallExpression' &&
          grandparent.callee === parent;
        if (!directResolve) rejectUnsupportedLoader();
      }
    },
    Literal: (node) => {
      if (
        node.value === 'constructor' ||
        (typeof node.value === 'string' &&
          /\b(?:import|require)\s*\(/.test(node.value))
      ) {
        rejectUnsupportedLoader();
      }
    },
    TemplateLiteral: (node) => {
      const value = staticSpecifier(node);
      if (
        value === 'constructor' ||
        (value && /\b(?:import|require)\s*\(/.test(value))
      ) {
        rejectUnsupportedLoader();
      }
    },
  });
  const createRequireFactories = new Set(['createRequire']);
  const moduleNamespaces = new Set();
  const requireAliases = new Set(['require']);
  const isRequireAlias = (name) =>
    requireAliases.has(name) || /^_*require\d*$/.test(name);
  const requireCallSpecifier = (candidate) => {
    const node = unwrapSequence(candidate);
    if (node?.type !== 'CallExpression') return null;
    const callee = unwrapSequence(node.callee);
    if (
      callee?.type === 'Identifier' &&
      isRequireAlias(callee.name)
    ) {
      return staticSpecifier(node.arguments[0]);
    }
    if (
      callee?.type === 'MemberExpression' &&
      callee.object.type === 'Identifier' &&
      callee.object.name === 'module' &&
      propertyName(callee) === 'require'
    ) {
      return staticSpecifier(node.arguments[0]);
    }
    if (callee?.type === 'MemberExpression') {
      const object = unwrapSequence(callee.object);
      const isAlias =
        object?.type === 'Identifier' &&
        isRequireAlias(object.name);
      const isModuleRequire =
        object?.type === 'MemberExpression' &&
        object.object.type === 'Identifier' &&
        object.object.name === 'module' &&
        propertyName(object) === 'require';
      const isCreatedRequire =
        object?.type === 'CallExpression' &&
        isCreateRequireCallee(object.callee);
      if (!isAlias && !isModuleRequire && !isCreatedRequire) return null;
      const member = propertyName(callee);
      if (member === 'call') return staticSpecifier(node.arguments[1]);
      if (
        member === 'apply' &&
        node.arguments[1]?.type === 'ArrayExpression'
      ) {
        return staticSpecifier(node.arguments[1].elements[0]);
      }
    }
    if (
      callee?.type === 'CallExpression' &&
      isCreateRequireCallee(callee.callee)
    ) {
      return staticSpecifier(node.arguments[0]);
    }
    return null;
  };
  const unwrapModuleInterop = (candidate) => {
    const node = unwrapSequence(candidate);
    if (node?.type === 'AwaitExpression') {
      return unwrapModuleInterop(node.argument);
    }
    const callee =
      node?.type === 'CallExpression'
        ? unwrapSequence(node.callee)
        : null;
    const helperName =
      callee?.type === 'Identifier'
        ? callee.name
        : callee?.type === 'MemberExpression'
          ? propertyName(callee)
          : null;
    if (
      helperName &&
      /^(?:__importDefault|__importStar|__toESM|_?interopRequireDefault|_?interopRequireWildcard)$/.test(
        helperName,
      )
    ) {
      return unwrapModuleInterop(node.arguments[0]);
    }
    return node;
  };
  const processBuiltinModuleSpecifier = (candidate) => {
    const node = unwrapSequence(candidate);
    if (
      node?.type === 'CallExpression' &&
      node.callee.type === 'MemberExpression' &&
      node.callee.object.type === 'Identifier' &&
      node.callee.object.name === 'process' &&
      propertyName(node.callee) === 'getBuiltinModule'
    ) {
      return staticSpecifier(node.arguments[0]);
    }
    return null;
  };
  const loadsNodeModule = (candidate) => {
    const node = unwrapModuleInterop(candidate);
    return (
      (node?.type === 'ImportExpression' &&
        ['module', 'node:module'].includes(
          staticSpecifier(node.source),
        )) ||
      ['module', 'node:module'].includes(
        requireCallSpecifier(node),
      ) ||
      ['module', 'node:module'].includes(
        processBuiltinModuleSpecifier(node),
      )
    );
  };
  const isModuleNamespaceReference = (candidate) => {
    const node = unwrapSequence(candidate);
    return (
      (node?.type === 'Identifier' &&
        moduleNamespaces.has(node.name)) ||
      (node?.type === 'MemberExpression' &&
        propertyName(node) === 'default' &&
        node.object.type === 'Identifier' &&
        moduleNamespaces.has(node.object.name))
    );
  };
  const isCreateRequireMember = (candidate) => {
    const node = unwrapSequence(candidate);
    return (
      node?.type === 'MemberExpression' &&
      propertyName(node) === 'createRequire' &&
      (isModuleNamespaceReference(node.object) ||
        loadsNodeModule(node.object))
    );
  };
  const isCreateRequireCallee = (candidate) => {
    const node = unwrapSequence(candidate);
    return (
      (node?.type === 'Identifier' &&
        createRequireFactories.has(node.name)) ||
      isCreateRequireMember(node)
    );
  };
  const isModuleRequireReference = (candidate) => {
    const node = unwrapSequence(candidate);
    return (
      node?.type === 'MemberExpression' &&
      node.object.type === 'Identifier' &&
      node.object.name === 'module' &&
      propertyName(node) === 'require'
    );
  };
  const isRequireFunctionReference = (candidate) => {
    const node = unwrapSequence(candidate);
    return (
      (node?.type === 'Identifier' && isRequireAlias(node.name)) ||
      isModuleRequireReference(node) ||
      (node?.type === 'CallExpression' &&
        isCreateRequireCallee(node.callee))
    );
  };
  const isRequireBindCall = (candidate) => {
    const node = unwrapSequence(candidate);
    return (
      node?.type === 'CallExpression' &&
      node.callee.type === 'MemberExpression' &&
      propertyName(node.callee) === 'bind' &&
      isRequireFunctionReference(node.callee.object)
    );
  };

  acornWalk.simple(ast, {
    ImportDeclaration: (node) => {
      const source = staticSpecifier(node.source);
      if (source !== 'node:module' && source !== 'module') return;
      for (const specifier of node.specifiers) {
        if (
          specifier.type === 'ImportDefaultSpecifier' ||
          specifier.type === 'ImportNamespaceSpecifier'
        ) {
          moduleNamespaces.add(specifier.local.name);
        }
        if (
          specifier.type === 'ImportSpecifier' &&
          specifier.imported.name === 'createRequire'
        ) {
          createRequireFactories.add(specifier.local.name);
        }
      }
    },
    VariableDeclarator: (node) => {
      if (node.id.type === 'Identifier') {
        if (loadsNodeModule(node.init)) {
          moduleNamespaces.add(node.id.name);
        }
        if (isRequireBindCall(node.init)) {
          requireAliases.add(node.id.name);
        }
        if (isCreateRequireMember(node.init)) {
          createRequireFactories.add(node.id.name);
        }
        if (
          node.init?.type === 'CallExpression' &&
          isCreateRequireCallee(node.init.callee)
        ) {
          requireAliases.add(node.id.name);
        }
        if (
          node.init?.type === 'Identifier' &&
          createRequireFactories.has(node.init.name)
        ) {
          createRequireFactories.add(node.id.name);
        }
        if (
          node.init?.type === 'Identifier' &&
          isRequireAlias(node.init.name)
        ) {
          requireAliases.add(node.id.name);
        }
      }

      if (
        node.id.type === 'ObjectPattern' &&
        ((node.init?.type === 'Identifier' &&
          moduleNamespaces.has(node.init.name)) ||
          loadsNodeModule(node.init))
      ) {
        for (const property of node.id.properties) {
          if (
            property.type === 'Property' &&
            property.key.type === 'Identifier' &&
            property.key.name === 'createRequire' &&
            property.value.type === 'Identifier'
          ) {
            createRequireFactories.add(property.value.name);
          }
        }
      }
    },
    AssignmentExpression: (node) => {
      if (
        node.left.type === 'Identifier' &&
        loadsNodeModule(node.right)
      ) {
        moduleNamespaces.add(node.left.name);
      }
      if (
        node.left.type === 'Identifier' &&
        isRequireBindCall(node.right)
      ) {
        requireAliases.add(node.left.name);
      }
      if (
        node.left.type === 'Identifier' &&
        isCreateRequireMember(node.right)
      ) {
        createRequireFactories.add(node.left.name);
      }
      if (
        node.left.type === 'Identifier' &&
        node.right.type === 'CallExpression' &&
        isCreateRequireCallee(node.right.callee)
      ) {
        requireAliases.add(node.left.name);
      }
      if (
        node.left.type === 'Identifier' &&
        node.right.type === 'Identifier'
      ) {
        if (createRequireFactories.has(node.right.name)) {
          createRequireFactories.add(node.left.name);
        }
        if (isRequireAlias(node.right.name)) {
          requireAliases.add(node.left.name);
        }
      }
    },
  });

  acornWalk.simple(ast, {
    ImportDeclaration: (node) => add(node.source, 'import'),
    ExportNamedDeclaration: (node) => {
      if (node.source) add(node.source, 'export');
    },
    ExportAllDeclaration: (node) => add(node.source, 'export'),
    ImportExpression: (node) => add(node.source, 'dynamic import'),
    CallExpression: (node) => {
      if (processBuiltinModuleSpecifier(node)) {
        add(node.arguments[0], 'process.getBuiltinModule');
        return;
      }
      const callee = unwrapSequence(node.callee);
      if (
        callee?.type === 'MemberExpression' &&
        propertyName(callee) === 'resolve' &&
        callee.object.type === 'MetaProperty' &&
        callee.object.meta.name === 'import' &&
        callee.object.property.name === 'meta'
      ) {
        add(node.arguments[0], 'import.meta.resolve');
        return;
      }
      if (isRequireFunctionReference(callee)) {
        add(node.arguments[0], 'require-producing call');
        return;
      }
      if (callee?.type !== 'MemberExpression') return;

      const member = propertyName(callee);
      const object = unwrapSequence(callee.object);
      if (member === 'resolve' && isRequireFunctionReference(object)) {
        add(node.arguments[0], 'require-producing resolve');
        return;
      }
      if (member === 'call' && isRequireFunctionReference(object)) {
        add(node.arguments[1], 'require-producing call');
      }
      if (member === 'apply' && isRequireFunctionReference(object)) {
        const args = node.arguments[1];
        assert(
          args?.type === 'ArrayExpression',
          `${file} contains non-static require.apply arguments`,
        );
        add(args.elements[0], 'require-producing apply');
      }
    },
  });
  return imports;
}

function verifyRuntimeImportParser() {
  const sample = `
    import value from 'esm-dependency';
    export { value as other } from 'export-dependency';
    await import(\`dynamic-dependency\`, { with: { type: 'json' } });
    require('commonjs-dependency');
    require.resolve('resolved-dependency');
    import.meta.resolve('esm-resolved-dependency');
    __require('generated-dependency');
  `;
  const found = runtimeImports('detector-fixture.mjs', sample);
  for (const expected of [
    'esm-dependency',
    'export-dependency',
    'dynamic-dependency',
    'commonjs-dependency',
    'resolved-dependency',
    'esm-resolved-dependency',
    'generated-dependency',
  ]) {
    assert(found.has(expected), `Runtime import parser missed ${expected}`);
  }

  for (const [index, unsupported] of [
    `import { createRequire } from 'node:module'; createRequire(import.meta.url)('dep');`,
    `import { "createRequire" as make } from 'node:module'; make(import.meta.url)('dep');`,
    `import Module from 'node:module'; Module._load('dep');`,
    `module.require('dep');`,
    `module._compile("require('dep')", __filename);`,
    `module['requ' + 'ire']('dep');`,
    `const { require: load } = module; load('dep');`,
    `const { ['requ' + 'ire']: load } = module; load('dep');`,
    `const m = module; const key = 'require'; const load = m[key]; load.bind(module)('dep');`,
    `require.call(null, 'dep');`,
    `require.apply(null, ['dep']);`,
    `require.bind(null)('dep');`,
    `(0, require)('dep');`,
    `const load = (0, require); load('dep');`,
    `const resolve = require.resolve; resolve('dep');`,
    `process.getBuiltinModule('node:module');`,
    `Reflect.apply(require, null, ['dep']);`,
    `Reflect.apply(Reflect.get(module, 'require'), module, ['dep']);`,
    `const load = require; load('dep');`,
    `const locate = import.meta.resolve; locate('dep');`,
    `const meta = import.meta; meta.resolve('dep');`,
    `const { resolve } = import.meta; resolve('dep');`,
    `const run = eval; run('require("dep")');`,
    `globalThis.Function('return require("dep")')();`,
    `Function\`return require("dep")\`;`,
    `(()=>{}).constructor('return import("dep")')();`,
    `const key = 'constructor'; const F = (()=>{})[key]; F('return import("dep")')();`,
    `const key = 'con' + 'structor'; const F = (()=>{})[key]; F('return import("dep")')()();`,
    `const key = ['con', 'structor'].join(''); const F = (()=>{})[key]; const body = ['return im', 'port("dep")'].join(''); F(body)()();`,
    `Object.getOwnPropertyDescriptor(Object.getPrototypeOf(()=>{}), 'constructor').value('return import("dep")')();`,
    `const load = arguments[1]; load('dep');`,
    `const key = 'eval'; const run = global[key]; run('import("dep")');`,
    `require7('dep');`,
  ].entries()) {
    assert.throws(
      () => runtimeImports('unsupported-loader.mjs', unsupported),
      /unsupported loader syntax/,
      `unsupported loader regression ${index} did not fail`,
    );
  }
  assert.throws(
    () =>
      runtimeImports(
        'dynamic-fixture.mjs',
        'const name = "dep"; import(`pkg/${name}`);',
      ),
    /non-static dynamic import/,
  );
  assert(
    runtimeImports(
      'extensionless-cli',
      '#!/usr/bin/env node\nrequire("extensionless-dependency");',
    ).has('extensionless-dependency'),
    'Runtime import parser missed an extensionless executable',
  );
  assert(
    runtimeImports(
      'wrapped.cjs',
      'return require("wrapped-commonjs-dependency");',
    ).has('wrapped-commonjs-dependency'),
    'Runtime import parser missed CommonJS wrapper semantics',
  );
  assert.throws(
    () =>
      verifyRuntimeDependencyClosure(
        { name: 'absolute-path-fixture' },
        'fixture.cjs',
        'require("/opt/host-helper");',
      ),
    /absolute host runtime path/,
  );
}

verifyRuntimeImportParser();

function verifyRuntimeDependencyClosure(manifest, file, content) {
  const declared = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
    ...(OPTIONAL_RUNTIME_IMPORTS.get(manifest.name) ?? []),
  ]);

  const imports = runtimeImports(file, content, manifest.type);
  for (const specifier of imports) {
    assert(
      !specifier.startsWith('/'),
      `${manifest.name}/${file} imports an absolute host runtime path`,
    );
    if (
      isRelativeSpecifier(specifier) ||
      isBuiltin(specifier)
    ) {
      continue;
    }
    const dependency = packageName(specifier);
    assert(
      declared.has(dependency),
      `${manifest.name}/${file} imports undeclared runtime dependency ${dependency}`,
    );
  }
  return imports;
}

function resolveRelativeRuntimeTarget(from, specifier, files) {
  assert(
    !/[?#]/.test(specifier),
    `${from} uses an ambiguous relative runtime specifier`,
  );
  assert(
    !/%[0-9a-f]{2}/i.test(specifier),
    `${from} uses an encoded relative runtime specifier`,
  );
  const path = specifier;
  const target = posix.normalize(
    posix.join(posix.dirname(from), path),
  );
  assert(
    target !== '..' &&
      !target.startsWith('../') &&
      !target.startsWith('/'),
    `${from} imports a runtime file outside the package`,
  );
  assert(
    files.has(target),
    `${from} must import an exact packed runtime file instead of ${specifier}`,
  );
  return target;
}

function verifyRuntimeGraph(
  manifest,
  files,
  decodedFiles,
  runtimeTargets,
) {
  const fileSet = new Set(files);
  const queue = [
    ...runtimeTargets,
    ...files.filter((file) => /\.[cm]?js$/i.test(file)),
    ...files.filter((file) => decodedFiles.get(file)?.startsWith('#!')),
  ];
  const bins = declaredBinTargets(manifest.bin);
  for (const bin of bins) {
    const content = decodedFiles.get(bin);
    assert.equal(
      typeof content,
      'string',
      `${manifest.name}/${bin} bin target must be UTF-8 text`,
    );
    assert(
      /^#![ \t]*(?:\/usr\/bin\/env(?:[ \t]+-S)?[ \t]+node|\/usr\/bin\/node)[ \t]*(?:\r?\n|$)/.test(
        content,
      ),
      `${manifest.name}/${bin} bin target must start with a Node shebang`,
    );
  }

  const visited = new Set();
  while (queue.length > 0) {
    const file = queue.shift();
    if (visited.has(file)) continue;
    visited.add(file);
    const content = decodedFiles.get(file);
    assert.equal(
      typeof content,
      'string',
      `${manifest.name}/${file} runtime target must be UTF-8 text`,
    );
    const imports = verifyRuntimeDependencyClosure(
      manifest,
      file,
      content,
    );
    for (const specifier of imports) {
      if (!isRelativeSpecifier(specifier)) continue;
      const target = resolveRelativeRuntimeTarget(
        file,
        specifier,
        fileSet,
      );
      if (target.endsWith('.json')) {
        try {
          JSON.parse(decodedFiles.get(target));
        } catch {
          throw new Error(
            `${manifest.name}/${target} contains invalid runtime JSON`,
          );
        }
        continue;
      }
      assert(
        !target.endsWith('.node'),
        `${manifest.name}/${file} uses an unaudited native runtime dependency`,
      );
      queue.push(target);
    }
  }
}

function decodeCssEscapes(value) {
  return value.replace(
    /\\([0-9a-f]{1,6})(?:\r\n|[ \t\r\n\f])?|\\([\s\S])/gi,
    (_match, hex, escaped) => {
      if (hex) {
        const codePoint = Number.parseInt(hex, 16);
        assert(
          codePoint > 0 && codePoint <= 0x10ffff,
          'CSS URL contains an invalid escape',
        );
        return String.fromCodePoint(codePoint);
      }
      return /[\r\n\f]/.test(escaped) ? '' : escaped;
    },
  );
}

function cssUrlTarget(node, kind) {
  const raw = valueParser.stringify(node.nodes).trim();
  assert(raw, `CSS ${kind} must have a static target`);
  const quoted =
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"));
  assert(
    quoted || !/(^|[^\\])\s/.test(raw),
    `CSS ${kind} must quote whitespace`,
  );
  return decodeCssEscapes(quoted ? raw.slice(1, -1) : raw);
}

function parsedCssAtRule(rule) {
  const serialized = rule.toString();
  const match = serialized.match(
    /^@((?:[-_a-z0-9]|\p{L}|\\(?:[0-9a-f]{1,6}(?:\r\n|[ \t\r\n\f])?|[^\r\n\f]))+)([\s\S]*)$/iu,
  );
  assert(match, 'CSS at-rule name must be statically parseable');
  return {
    name: decodeCssEscapes(match[1]),
    params: match[2].replace(/;\s*$/, '').trim(),
  };
}

function splitCssUrlFunctions(nodes) {
  const functions = [];
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (node.type === 'function') {
      const fragments = [];
      let cursor = index - 1;
      while (
        nodes[cursor]?.type === 'space' &&
        /^(?:\r\n|[ \t\r\n\f])$/.test(nodes[cursor].value) &&
        nodes[cursor - 1]?.type === 'word' &&
        /\\[0-9a-f]{1,6}$/i.test(nodes[cursor - 1].value)
      ) {
        fragments.unshift(decodeCssEscapes(nodes[cursor - 1].value));
        cursor -= 2;
      }
      if (
        fragments.length > 0 &&
        `${fragments.join('')}${decodeCssEscapes(node.value)}`.toLowerCase() ===
          'url'
      ) {
        functions.push(node);
      }
      functions.push(...splitCssUrlFunctions(node.nodes));
    }
  }
  return functions;
}

function splitCssUrlAtStart(nodes) {
  let index = nodes.findIndex(
    (node) => !['comment', 'space'].includes(node.type),
  );
  if (index < 0) return null;
  const fragments = [];
  while (
    nodes[index]?.type === 'word' &&
    /\\[0-9a-f]{1,6}$/i.test(nodes[index].value) &&
    nodes[index + 1]?.type === 'space' &&
    /^(?:\r\n|[ \t\r\n\f])$/.test(nodes[index + 1].value)
  ) {
    fragments.push(decodeCssEscapes(nodes[index].value));
    index += 2;
  }
  const node = nodes[index];
  if (
    fragments.length > 0 &&
    node?.type === 'function' &&
    `${fragments.join('')}${decodeCssEscapes(node.value)}`.toLowerCase() ===
      'url'
  ) {
    return node;
  }
  return null;
}

function cssReferences(content) {
  let root;
  try {
    root = postcss.parse(content);
  } catch {
    throw new Error('Package contains invalid CSS');
  }
  const references = [];

  root.walkAtRules((rule) => {
    const atRule = parsedCssAtRule(rule);
    if (atRule.name.toLowerCase() !== 'import') return;
    const parsed = valueParser(atRule.params);
    const first = parsed.nodes.find(
      (node) => node.type !== 'space' && node.type !== 'comment',
    );
    assert(first, 'CSS import must have a static target');
    const splitUrl = splitCssUrlAtStart(parsed.nodes);
    const target =
      splitUrl
        ? cssUrlTarget(splitUrl, 'import')
        : first.type === 'function' &&
      decodeCssEscapes(first.value).toLowerCase() === 'url'
          ? cssUrlTarget(first, 'import')
          : ['string', 'word'].includes(first.type)
            ? decodeCssEscapes(first.value)
            : null;
    assert(target, 'CSS import must have a static target');
    references.push({ kind: 'import', target });
  });

  root.walkDecls((declaration) => {
    const parsed = valueParser(declaration.value);
    for (const node of splitCssUrlFunctions(parsed.nodes)) {
      references.push({
        kind: 'url',
        target: cssUrlTarget(node, 'url'),
      });
    }
    parsed.walk((node) => {
      if (
        node.type === 'function' &&
        decodeCssEscapes(node.value).toLowerCase() === 'url'
      ) {
        references.push({
          kind: 'url',
          target: cssUrlTarget(node, 'url'),
        });
        return false;
      }
      return undefined;
    });
  });
  return references;
}

function verifyCssDependencyClosure(manifest, file, content, files) {
  const declared = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
  ]);
  for (const { kind, target } of cssReferences(content)) {
    assert(!target.includes('\\'), `${manifest.name}/${file} has an unsafe CSS path`);
    assert(
      target === target.trim() &&
        !Array.from(target).some((character) => {
          const code = character.charCodeAt(0);
          return code <= 0x1f || code === 0x7f;
        }),
      `${manifest.name}/${file} has unsafe CSS URL whitespace`,
    );
    const lowerTarget = target.toLowerCase();
    if (
      kind === 'import' &&
      (lowerTarget.startsWith('data:') ||
        /^https?:/i.test(target) ||
        target.startsWith('#') ||
        target.startsWith('//'))
    ) {
      throw new Error(
        `${manifest.name}/${file} uses an embedded or remote CSS import`,
      );
    }
    if (lowerTarget.startsWith('data:') || target.startsWith('#')) {
      continue;
    }
    if (/^https?:/i.test(target)) {
      let url;
      try {
        url = new URL(target);
      } catch {
        throw new Error(`${manifest.name}/${file} has an invalid CSS URL`);
      }
      assert(
        url.protocol === 'https:' && !url.username && !url.password,
        `${manifest.name}/${file} has an unsafe external CSS URL`,
      );
      continue;
    }
    assert(
      !/^[a-z][a-z0-9+.-]*:/i.test(target) &&
        !target.startsWith('//') &&
        !target.startsWith('/'),
      `${manifest.name}/${file} has an unsupported CSS URL`,
    );

    const encodedPath = target.split(/[?#]/, 1)[0];
    assert(
      !/%(?:2f|5c)/i.test(encodedPath),
      `${manifest.name}/${file} uses an encoded CSS path separator`,
    );
    let path;
    try {
      path = decodeURIComponent(encodedPath);
    } catch {
      throw new Error(
        `${manifest.name}/${file} has invalid CSS URL encoding`,
      );
    }
    assert(
      !path.includes('\\') &&
        !path.includes('\u0000') &&
        !/[?#]/.test(path),
      `${manifest.name}/${file} has ambiguous CSS URL encoding`,
    );
    const resolved = posix.normalize(
      posix.join(posix.dirname(file), path),
    );
    assert(
      resolved !== '..' &&
        !resolved.startsWith('../') &&
        !resolved.startsWith('/'),
      `${manifest.name}/${file} references CSS outside the package`,
    );
    if (files.has(resolved)) continue;

    if (kind === 'import' && !isRelativeSpecifier(path)) {
      const dependency = packageName(path);
      assert(
        declared.has(dependency),
        `${manifest.name}/${file} imports undeclared CSS dependency ${dependency}`,
      );
      continue;
    }
    throw new Error(
      `${manifest.name}/${file} references missing CSS asset ${target}`,
    );
  }
}

function verifyCssScanner() {
  const manifest = {
    name: 'css-fixture',
    dependencies: { 'theme-package': '1.0.0', u: '1.0.0' },
  };
  const files = new Set([
    'styles/index.css',
    'styles/font.woff2',
    'styles/font face.woff2',
    'styles/safe/%2e%2e/encoded.woff2',
    'styles/ https:/cdn.example/theme.css',
  ]);
  verifyCssDependencyClosure(
    manifest,
    'styles/index.css',
    '@import "theme-package/base.css"; .x { src: url("./font.woff2"), url(./font\\ face.woff2); background: url(DATA:image/gif;base64,R0lGODlhAQABAIAAAAAAAP); }',
    files,
  );
  assert.throws(
    () =>
      verifyCssDependencyClosure(
        manifest,
        'styles/index.css',
        '.x { background: url("./missing.woff2"); }',
        files,
      ),
    /missing CSS asset/,
  );
  assert.throws(
    () =>
      verifyCssDependencyClosure(
        manifest,
        'styles/index.css',
        '@import "./missing.css" supports(background: \\75 \\72 l("./font.woff2"));',
        files,
      ),
    /missing CSS asset/,
  );
  assert.throws(
    () =>
      verifyCssDependencyClosure(
        manifest,
        'styles/index.css',
        '@import \\75 \\72 l("./missing.css");',
        files,
      ),
    /missing CSS asset/,
  );
  assert.throws(
    () =>
      verifyCssDependencyClosure(
        manifest,
        'styles/index.css',
        '@im\\70\r\nort "./missing.css";',
        files,
      ),
    /missing CSS asset/,
  );
  assert.throws(
    () =>
      verifyCssDependencyClosure(
        manifest,
        'styles/index.css',
        '.x { src: \\75 \\72 l("./missing.png"); }',
        files,
      ),
    /missing CSS asset/,
  );
  verifyCssDependencyClosure(
    manifest,
    'styles/index.css',
    '.x { custom: u rl("./not-a-url.png"); }',
    files,
  );
  verifyCssDependencyClosure(
    manifest,
    'styles/index.css',
    '.x { custom: \\75  rl("./not-a-url.png"); }',
    files,
  );
  assert.throws(
    () =>
      verifyCssDependencyClosure(
        manifest,
        'styles/index.css',
        '.x { src: url(./missing\\ font.woff2); }',
        files,
      ),
    /missing CSS asset/,
  );
  assert.throws(
    () =>
      verifyCssDependencyClosure(
        manifest,
        'styles/index.css',
        '.x { src: url("./safe/%2e%2e/encoded.woff2"); }',
        files,
      ),
    /missing CSS asset/,
  );
  assert.throws(
    () =>
      verifyCssDependencyClosure(
        manifest,
        'styles/index.css',
        '.x { src: url("./safe%2fencoded.woff2"); }',
        files,
      ),
    /encoded CSS path separator/,
  );
  assert.throws(
    () =>
      verifyCssDependencyClosure(
        manifest,
        'styles/index.css',
        '@im\\70ort "./missing.css";',
        files,
      ),
    /missing CSS asset/,
  );
  assert.throws(
    () =>
      verifyCssDependencyClosure(
        manifest,
        'styles/index.css',
        '.x { src: u\\72l("./missing.png"); }',
        files,
      ),
    /missing CSS asset/,
  );
  assert.throws(
    () =>
      verifyCssDependencyClosure(
        manifest,
        'styles/index.css',
        '.x { src: \\000075 rl("./missing.png"); }',
        files,
      ),
    /missing CSS asset/,
  );
  assert.throws(
    () =>
      verifyCssDependencyClosure(
        manifest,
        'styles/index.css',
        '.x { src: url("./\\5c 66oo("); }',
        files,
      ),
    /unsafe CSS path/,
  );
  for (const remoteImport of [
    '@import "https://cdn.example.test/theme.css";',
    '@import url(data:text/css,%40import%20%22hidden.css%22);',
  ]) {
    assert.throws(
      () =>
        verifyCssDependencyClosure(
          manifest,
          'styles/index.css',
          remoteImport,
          files,
        ),
      /embedded or remote CSS import/,
    );
  }
  assert.throws(
    () =>
      verifyCssDependencyClosure(
        manifest,
        'styles/index.css',
        '@import " https://cdn.example/theme.css";',
        files,
      ),
    /unsafe CSS URL whitespace/,
  );
}

verifyCssScanner();

function exportedTargets(value) {
  if (typeof value === 'string') {
    assert(
      value.startsWith('./'),
      `Package export target must be relative: ${value}`,
    );
    return [value.slice(2)];
  }
  if (value === null) return [];
  assert(
    typeof value === 'object',
    'Package export leaves must be relative strings or null',
  );
  return Object.values(value).flatMap(exportedTargets);
}

function exportedRuntimeTargets(value, condition = null) {
  if (typeof value === 'string') {
    if (
      condition === 'types' ||
      /\.(?:css|eot|gif|jpe?g|json|map|otf|png|svg|ttf|webp|woff2?)$/i.test(
        value,
      ) ||
      /\.d\.[cm]?ts$/i.test(value)
    ) {
      return [];
    }
    return value.startsWith('./') ? [value.slice(2)] : [];
  }
  if (value === null) return [];
  assert(
    typeof value === 'object',
    'Package runtime export leaves must be relative strings or null',
  );
  return Object.entries(value).flatMap(([key, target]) =>
    exportedRuntimeTargets(target, key),
  );
}

function verifyExportMapScanner() {
  assert.throws(
    () => exportedTargets({ browser: false }),
    /relative strings or null/,
  );
  assert.deepEqual(exportedTargets({ browser: null }), []);
}

verifyExportMapScanner();

function verifyDualTypeExports(manifest, source) {
  for (const [subpath, value] of Object.entries(manifest.exports ?? {})) {
    if (typeof value === 'string') {
      assert(
        !/\.(?:[cm]?js|d\.[cm]?ts)$/i.test(value),
        `${manifest.name} ${source} JavaScript export ${subpath} must use import/require type conditions`,
      );
      continue;
    }
    if (value === null) continue;
    assert(
      value && typeof value === 'object' && !Array.isArray(value),
      `${manifest.name} ${source} export ${subpath} must be an object`,
    );
    const importBranch = value.import;
    const requireBranch = value.require;
    assert(
      importBranch &&
        typeof importBranch === 'object' &&
        !Array.isArray(importBranch) &&
        typeof importBranch.types === 'string' &&
        importBranch.types.endsWith('.d.ts') &&
        typeof importBranch.default === 'string' &&
        importBranch.default.endsWith('.js') &&
        Object.keys(importBranch).join(',') === 'types,default',
      `${manifest.name} ${source} export ${subpath} must declare ESM types and runtime`,
    );
    assert(
      requireBranch &&
        typeof requireBranch === 'object' &&
        !Array.isArray(requireBranch) &&
        typeof requireBranch.types === 'string' &&
        requireBranch.types.endsWith('.d.cts') &&
        typeof requireBranch.default === 'string' &&
        requireBranch.default.endsWith('.cjs') &&
        Object.keys(requireBranch).join(',') === 'types,default',
      `${manifest.name} ${source} export ${subpath} must declare CommonJS types and runtime`,
    );
  }
}

function verifyDualTypeExportScanner() {
  const manifest = { name: 'dual-type-fixture' };
  assert.throws(
    () =>
      verifyDualTypeExports(
        { ...manifest, exports: { '.': './dist/index.js' } },
        'fixture',
      ),
    /must use import\/require type conditions/,
  );
  assert.throws(
    () =>
      verifyDualTypeExports(
        {
          ...manifest,
          exports: {
            '.': {
              import: {
                default: './dist/index.js',
                types: './dist/index.d.ts',
              },
              require: {
                types: './dist/index.d.cts',
                default: './dist/index.cjs',
              },
            },
          },
        },
        'fixture',
      ),
    /must declare ESM types and runtime/,
  );
  assert.doesNotThrow(() =>
    verifyDualTypeExports(
      { ...manifest, exports: { './styles.css': './styles.css' } },
      'fixture',
    ),
  );
}

verifyDualTypeExportScanner();

function declaredBinTargets(bin) {
  if (bin === undefined) return [];
  if (typeof bin === 'string') return [bin.replace(/^\.\//, '')];
  if (bin && typeof bin === 'object' && !Array.isArray(bin)) {
    return Object.values(bin).map((target) =>
      String(target).replace(/^\.\//, ''),
    );
  }
  return [];
}

function verifyRuntimeGraphScanner() {
  const manifest = {
    name: 'runtime-graph-fixture',
    bin: undefined,
  };
  assert.throws(
    () =>
      verifyRuntimeGraph(
        manifest,
        ['index.js', 'chunk.txt'],
        new Map([
          ['index.js', 'require("./chunk.txt");'],
          ['chunk.txt', 'require("undeclared-dependency");'],
        ]),
        new Set(['index.js']),
      ),
    /undeclared runtime dependency/,
  );
  assert.throws(
    () =>
      verifyRuntimeGraph(
        manifest,
        ['index.cjs', 'safe#payload'],
        new Map([
          ['index.cjs', 'require("./safe#payload");'],
          ['safe#payload', 'module.exports = true;'],
        ]),
        new Set(['index.cjs']),
      ),
    /ambiguous relative runtime specifier/,
  );
  assert.throws(
    () =>
      verifyRuntimeGraph(
        manifest,
        ['index.js', 'safe/%2e%2e/payload'],
        new Map([
          ['index.js', 'import "./safe/%2e%2e/payload";'],
          ['safe/%2e%2e/payload', 'export default true;'],
        ]),
        new Set(['index.js']),
      ),
    /encoded relative runtime specifier/,
  );
  assert.throws(
    () =>
      verifyRuntimeGraph(
        { ...manifest, bin: 'cli' },
        ['cli'],
        new Map([['cli', 'require("node:path");']]),
        new Set(['cli']),
      ),
    /Node shebang/,
  );
  assert.throws(
    () =>
      verifyRuntimeGraph(
        { ...manifest, bin: 'cli' },
        ['cli'],
        new Map([
          [
            'cli',
            '#!/usr/bin/env -S node --require=undeclared-package\n',
          ],
        ]),
        new Set(['cli']),
      ),
    /Node shebang/,
  );
  assert.throws(
    () =>
      verifyRuntimeGraph(
        { ...manifest, bin: 'cli' },
        ['cli'],
        new Map([['cli', '#!\v/usr/bin/env node\n']]),
        new Set(['cli']),
      ),
    /Node shebang/,
  );
}

verifyRuntimeGraphScanner();

function parsePackResult(output) {
  const start = output.indexOf('{');
  assert.notEqual(start, -1, `pnpm pack did not return JSON:\n${output}`);
  return JSON.parse(output.slice(start));
}

function anonymousRegistryEnvironment(userConfig, globalConfig, cache) {
  const environment = { ...process.env };
  for (const name of Object.keys(environment)) {
    if (
      ['GITHUB_TOKEN', 'NODE_AUTH_TOKEN', 'NPM_TOKEN'].includes(name) ||
      /^(?:NPM|PNPM)_CONFIG_/i.test(name)
    ) {
      delete environment[name];
    }
  }
  environment.NPM_CONFIG_ALWAYS_AUTH = 'false';
  environment.NPM_CONFIG_CACHE = cache;
  environment.NPM_CONFIG_GLOBALCONFIG = globalConfig;
  environment.NPM_CONFIG_REGISTRY = PUBLIC_REGISTRY;
  environment.NPM_CONFIG_USERCONFIG = userConfig;
  environment.PNPM_CONFIG_GLOBALCONFIG = globalConfig;
  environment.PNPM_CONFIG_REGISTRY = PUBLIC_REGISTRY;
  environment.PNPM_CONFIG_USERCONFIG = userConfig;
  return environment;
}

function parseProjectNpmConfig(content) {
  let rootRegistry = null;
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;
    const registry = line.match(/^registry\s*=\s*(.+)$/i);
    if (registry) {
      assert.equal(
        rootRegistry,
        null,
        'Project npm config repeats the root registry',
      );
      rootRegistry = registry[1].trim();
      continue;
    }
    const key = line.split('=', 1)[0].trim();
    throw new Error(
      `Project npm config contains unsupported setting ${key}`,
    );
  }
  assert(rootRegistry, 'Project npm config must declare the root registry');
  assert.equal(
    normalizeRegistry(rootRegistry),
    normalizeRegistry(PUBLIC_REGISTRY),
    'Project npm config must use public npm',
  );
  return new Map();
}

assert.deepEqual(
  parseProjectNpmConfig(`registry=${PUBLIC_REGISTRY}\n`),
  new Map(),
);
assert.throws(
  () =>
    parseProjectNpmConfig(
      `registry=${PUBLIC_REGISTRY}\n//registry.npmjs.org/:_authToken=\${NPM_TOKEN}\n`,
    ),
  /unsupported setting/,
);
assert.throws(
  () =>
    parseProjectNpmConfig(
      `@partrunner-ai:registry=${PUBLIC_REGISTRY}\n`,
    ),
  /unsupported setting/,
);

async function projectScopeRegistries() {
  let content;
  try {
    content = await readFile(join(ROOT, '.npmrc'), 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error(
        'Project npm config is required for public release',
        { cause: error },
      );
    }
    throw error;
  }
  return parseProjectNpmConfig(content);
}

function environmentScopeRegistries(
  scope,
  environment = process.env,
) {
  const expected = new Set([
    `npm_config_${scope}:registry`.toLowerCase(),
    `pnpm_config_${scope}:registry`.toLowerCase(),
  ]);
  return Object.entries(environment)
    .filter(
      ([name, value]) =>
        expected.has(name.toLowerCase()) &&
        typeof value === 'string' &&
        value.trim(),
    )
    .map(([, value]) => value.trim());
}

assert.deepEqual(
  environmentScopeRegistries('@fixture', {
    'npm_config_@fixture:registry': PUBLIC_REGISTRY,
  }),
  [PUBLIC_REGISTRY],
);

async function discoverPackages() {
  const scopedRegistries = await projectScopeRegistries();
  const workspaces = JSON.parse(
    run('pnpm', ['list', '--recursive', '--depth', '-1', '--json']),
  );
  assert(Array.isArray(workspaces), 'pnpm workspace listing must be an array');
  const packages = [];

  for (const workspace of workspaces) {
    assert(
      typeof workspace.path === 'string',
      'pnpm workspace entry must include its path',
    );
    const directory = resolve(workspace.path);
    if (directory === ROOT) continue;
    const workspacePath = relative(ROOT, directory);
    assert(
      workspacePath &&
        !workspacePath.startsWith('..') &&
        !isAbsolute(workspacePath),
      'pnpm workspace package must stay inside the repository',
    );
    const manifest = await readJson(join(directory, 'package.json'));
    assert(
      manifest.private === undefined ||
        typeof manifest.private === 'boolean',
      `${manifest.name} private metadata must be boolean`,
    );
    if (manifest.private !== true) {
      verifyManifestShape(manifest, 'source');
      verifyDualTypeExports(manifest, 'source');
      verifyNoPublishLifecycle(manifest, 'source');
      const registry = normalizeRegistry(effectiveRegistry(manifest));
      const scope = manifest.name.startsWith('@')
        ? manifest.name.split('/')[0]
        : null;
      const scopedRegistry = scope ? scopedRegistries.get(scope) : null;
      if (scopedRegistry) {
        assert.equal(
          normalizeRegistry(scopedRegistry),
          registry,
          `${manifest.name} registry disagrees with project npm scope configuration`,
        );
      }
      if (scope) {
        for (const override of environmentScopeRegistries(scope)) {
          assert.equal(
            normalizeRegistry(override),
            registry,
            `${manifest.name} registry disagrees with scoped environment configuration`,
          );
        }
      }
      if (registry === normalizeRegistry(PUBLIC_REGISTRY)) {
        assert.equal(
          manifest.publishConfig.access,
          'public',
          `${manifest.name} source manifest must publish publicly on npm`,
        );
      }
      packages.push({ directory, manifest, registry });
    }
  }

  packages.sort((left, right) =>
    left.manifest.name.localeCompare(right.manifest.name),
  );
  assert.deepEqual(
    packages.map(({ manifest }) => manifest.name),
    EXPECTED_PACKAGES,
    'The publishable package allowlist is stale. Review every new or removed package explicitly.',
  );
  return packages;
}

function verifyInternalDependencyVersions(manifest, workspaceVersions) {
  for (const field of ['dependencies', 'optionalDependencies']) {
    for (const [name, version] of Object.entries(manifest[field] ?? {})) {
      const expectedVersion = workspaceVersions.get(name);
      if (!expectedVersion) continue;
      assert.equal(
        version,
        expectedVersion,
        `${manifest.name} ${field}.${name} must match the packed workspace version`,
      );
    }
  }
}

assert.throws(
  () =>
    verifyInternalDependencyVersions(
      {
        name: '@partrunner-ai/fixture',
        dependencies: { '@partrunner-ai/tokens': '1.0.0' },
      },
      new Map([['@partrunner-ai/tokens', '2.0.0']]),
    ),
  /must match the packed workspace version/,
);

async function inspectTarball(
  packageInfo,
  tarball,
  extractionRoot,
  workspaceVersions,
) {
  const archivePaths = run('tar', ['-tzf', tarball])
    .trim()
    .split('\n')
    .filter(Boolean);
  const archiveDetails = run('tar', ['-tvzf', tarball])
    .trim()
    .split('\n')
    .filter(Boolean);
  assert(
    archivePaths.every(
      (path) =>
        path === 'package' ||
        (path.startsWith('package/') &&
          !path.includes('../') &&
          !path.includes('\\')),
    ),
    `${packageInfo.manifest.name} produced an unsafe archive path`,
  );
  assert(
    archiveDetails.every((line) => line[0] === '-' || line[0] === 'd'),
    `${packageInfo.manifest.name} contains a link or special archive entry`,
  );

  await mkdir(extractionRoot, { recursive: true });
  run('tar', ['-xzf', tarball, '-C', extractionRoot]);
  const packageRoot = join(extractionRoot, 'package');
  const files = (await walk(packageRoot))
    .map((path) => relative(packageRoot, path))
    .sort();
  const packedManifest = await readJson(join(packageRoot, 'package.json'));
  for (const file of files) {
    const metadata = await lstat(join(packageRoot, file));
    assert(
      metadata.isFile(),
      `${packageInfo.manifest.name} contains non-regular file ${file}`,
    );
  }

  assert.equal(packedManifest.name, packageInfo.manifest.name);
  assert.equal(packedManifest.version, packageInfo.manifest.version);
  assert(
    packedManifest.private === undefined ||
      packedManifest.private === false,
    `${packedManifest.name} packed private metadata must be false or absent`,
  );
  verifyManifestShape(packedManifest, 'packed');
  verifyDualTypeExports(packedManifest, 'packed');
  verifyNoPublishLifecycle(packedManifest, 'packed');
  const expectedLicense =
    packedManifest.name === '@partrunner-ai/tokens' ||
    packedManifest.name === '@partrunner-ai/ui'
      ? '(MIT AND OFL-1.1)'
      : 'MIT';
  assert.equal(
    packedManifest.license,
    expectedLicense,
    `${packedManifest.name} must declare its complete license expression`,
  );
  for (const requiredFile of [
    'LICENSE',
    'README.md',
    'TRADEMARKS.md',
  ]) {
    assert(
      files.includes(requiredFile),
      `${packedManifest.name} must include ${requiredFile}`,
    );
  }
  const packageLicense = await readFile(
    join(packageRoot, 'LICENSE'),
    'utf8',
  );
  assert.equal(
    packageLicense.trim(),
    ROOT_LICENSE_TEXT.trim(),
    `${packedManifest.name} license must match the repository license`,
  );
  const packageReadme = await readFile(
    join(packageRoot, 'README.md'),
    'utf8',
  );
  assert(
    packageReadme.includes(`# ${packedManifest.name}`),
    `${packedManifest.name} README must identify the package`,
  );
  const packageTrademarks = await readFile(
    join(packageRoot, 'TRADEMARKS.md'),
    'utf8',
  );
  const normalizedRootTrademarks = ROOT_TRADEMARK_TEXT.replace(
    /\s+/g,
    ' ',
  );
  const normalizedPackageTrademarks = packageTrademarks.replace(
    /\s+/g,
    ' ',
  );
  for (const phrase of [
    'The MIT License does not grant permission to use PartRunner trademarks',
    'Other trademark use requires separate permission from PartRunner.',
  ]) {
    assert(normalizedRootTrademarks.includes(phrase));
    assert(
      normalizedPackageTrademarks.includes(phrase),
      `${packedManifest.name} trademark notice is incomplete`,
    );
  }
  if (
    packedManifest.name === '@partrunner-ai/tokens' ||
    packedManifest.name === '@partrunner-ai/ui'
  ) {
    for (const fontLicense of [
      'styles/fonts/LICENSE-Barlow.txt',
      'styles/fonts/LICENSE-Bebas-Neue.txt',
    ]) {
      assert(
        files.includes(fontLicense),
        `${packedManifest.name} must include ${fontLicense}`,
      );
      const text = await readFile(join(packageRoot, fontLicense), 'utf8');
      assert(
        text.includes('SIL Open Font License, Version 1.1'),
        `${packedManifest.name}/${fontLicense} must contain the OFL`,
      );
    }
  }
  assert(
    Object.keys(packedManifest.exports ?? {}).every(
      (key) => !key.includes('*'),
    ),
    `${packedManifest.name} uses a wildcard export that the artifact gate cannot enumerate`,
  );
  assert(
    !packedManifest.imports ||
      Object.keys(packedManifest.imports).length === 0,
    `${packedManifest.name} uses package imports that the dependency audit does not support`,
  );

  const targets = new Set(
    [
      packedManifest.main,
      packedManifest.module,
      packedManifest.types,
      ...exportedTargets(packedManifest.exports),
      ...declaredBinTargets(packedManifest.bin),
    ]
      .filter(Boolean)
      .map((target) => target.replace(/^\.\//, '')),
  );
  const runtimeTargets = new Set(
    [
      packedManifest.main,
      packedManifest.module,
      ...exportedRuntimeTargets(packedManifest.exports),
      ...declaredBinTargets(packedManifest.bin),
    ]
      .filter(Boolean)
      .map((target) => target.replace(/^\.\//, '')),
  );

  for (const target of targets) {
    assert(
      files.includes(target),
      `${packedManifest.name} is missing exported file ${target}`,
    );
  }

  for (const file of files) {
    assert(
      !file.includes('\\') &&
        (file === 'package.json' ||
          posix.basename(file).toLowerCase() !== 'package.json') &&
        !FORBIDDEN_PATHS.some((pattern) => pattern.test(file)),
      `${packedManifest.name} contains forbidden path ${file}`,
    );
  }

  for (const field of [
    'dependencies',
    'optionalDependencies',
    'peerDependencies',
  ]) {
    for (const [name, version] of Object.entries(
      packedManifest[field] ?? {},
    )) {
      assert(
        !String(version).startsWith('workspace:'),
        `${packedManifest.name} leaves workspace protocol in ${field}.${name}`,
      );
    }
  }
  verifyInternalDependencyVersions(packedManifest, workspaceVersions);

  const registry = normalizeRegistry(effectiveRegistry(packedManifest));
  assert.equal(
    registry,
    packageInfo.registry,
    `${packedManifest.name} packed registry differs from its source manifest`,
  );
  assert.equal(
    packedManifest.publishConfig.access ?? null,
    packageInfo.manifest.publishConfig.access ?? null,
    `${packedManifest.name} packed access differs from its source manifest`,
  );
  assert.equal(
    registry,
    normalizeRegistry(PUBLIC_REGISTRY),
    `${packedManifest.name} must publish on public npm`,
  );
  assert.equal(
    packedManifest.publishConfig?.access,
    'public',
    `${packedManifest.name} must publish publicly on npm`,
  );
  assert.equal(
    packedManifest.license,
    expectedLicense,
    `${packedManifest.name} must declare its complete public license expression`,
  );
  assert(
    isPublicVersion(packedManifest.version),
    `${packedManifest.name} public npm versions must start at 1.0.0 or later`,
  );
  const rootLicense = files.find(
    (file) =>
      !file.includes('/') && /^licen[cs]e(?:\..+)?$/i.test(file),
  );
  assert(
    rootLicense,
    `${packedManifest.name} public tarball must contain its license text`,
  );
  const licenseText = decodeText(
    await readFile(join(packageRoot, rootLicense)),
  );
  assert(
    licenseText && containsCompleteMitBody(licenseText),
    `${packedManifest.name} root license does not contain the complete MIT body`,
  );

  const decodedFiles = new Map();
  for (const file of files) {
    decodedFiles.set(
      file,
      decodeText(await readFile(join(packageRoot, file))),
    );
  }

  let embeddedSourceFiles = 0;
  for (const file of files) {
    const content = decodedFiles.get(file);
    if (content === null) {
      assert(
        !mustDecodeAsText(file),
        `${packedManifest.name}/${file} must be valid UTF-8 text`,
      );
      assert(
        !runtimeTargets.has(file),
        `${packedManifest.name}/${file} uses an unsupported binary runtime target`,
      );
      continue;
    }
    const context = `${packedManifest.name}/${file}`;
    verifySensitiveContent(content, context);
    if (/\.css$/i.test(file)) {
      verifyCssDependencyClosure(
        packedManifest,
        file,
        content,
        new Set(files),
      );
    }
    if (!/\.map$/i.test(file)) {
      for (const [index, sourceMap] of inlineSourceMaps(
        content,
        context,
      ).entries()) {
        embeddedSourceFiles += inspectSourceMap(
          sourceMap,
          `${context} inline map ${index}`,
        );
      }
    }
    if (/\.map$/i.test(file)) {
      embeddedSourceFiles += inspectSourceMap(
        parseSourceMap(content, context),
        context,
      );
    }
  }
  verifyRuntimeGraph(
    packedManifest,
    files,
    decodedFiles,
    runtimeTargets,
  );

  return {
    files: files.length,
    embeddedSourceFiles,
    packedManifest,
    registry,
  };
}

function fixturePackageJson(tarballs, reactLine) {
  return {
    name: 'partrunner-package-artifact-fixture',
    version: '0.0.0',
    private: true,
    type: 'module',
    dependencies: {
      ...Object.fromEntries(
        tarballs.map(({ name, tarball }) => [name, `file:${tarball}`]),
      ),
      '@supabase/supabase-js': '2.90.1',
      '@types/node': '22.20.1',
      '@types/react': reactLine.reactTypes,
      '@types/react-dom': reactLine.reactDomTypes,
      '@vercel/node': '5.5.24',
      'lucide-react': reactLine.lucide,
      next: '15.5.21',
      react: reactLine.react,
      'react-dom': reactLine.reactDom,
    },
  };
}

const ESM_FIXTURE = `
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as apiCore from '@partrunner-ai/api-core';
import * as appRegistry from '@partrunner-ai/app-registry';
import * as seamless from '@partrunner-ai/seamless';
import * as shell from '@partrunner-ai/shell';
import * as tokens from '@partrunner-ai/tokens';
import * as ui from '@partrunner-ai/ui';

assert.equal(typeof apiCore.tbl, 'function');
assert.equal(typeof appRegistry.buildAppUrl, 'function');
assert.equal(seamless.safeNextPath('//evil.example'), '/');
assert.equal(typeof shell.AppShell, 'function');
assert.equal(typeof tokens.THEMES, 'object');
assert.ok(ui.Button);

const subpaths = JSON.parse(
  readFileSync(new URL('./verify-subpaths.json', import.meta.url), 'utf8'),
);
for (const path of subpaths) assert.ok(import.meta.resolve(path), path);
`;

const CJS_FIXTURE = `
const assert = require('node:assert/strict');
const subpaths = require('./verify-subpaths.json');
const apiCore = require('@partrunner-ai/api-core');
const appRegistry = require('@partrunner-ai/app-registry');
const seamless = require('@partrunner-ai/seamless');
const shell = require('@partrunner-ai/shell');
const tokens = require('@partrunner-ai/tokens');
const ui = require('@partrunner-ai/ui');

assert.equal(typeof apiCore.tbl, 'function');
assert.equal(typeof appRegistry.buildAppUrl, 'function');
assert.equal(seamless.safeNextPath('//evil.example'), '/');
assert.equal(typeof shell.AppShell, 'function');
assert.equal(typeof tokens.THEMES, 'object');
assert.ok(ui.Button);
for (const path of subpaths) assert.ok(require.resolve(path), path);
`;

const TYPES_FIXTURE = `
import { type SchemaName } from '@partrunner-ai/api-core';
import * as apiAuth from '@partrunner-ai/api-core/auth';
import { type HandlerOptions } from '@partrunner-ai/api-core/vercel';
import * as apiWeek from '@partrunner-ai/api-core/week';
import { APPS, type AppLink } from '@partrunner-ai/app-registry';
import { buildAppUrl as buildStandaloneUrl } from '@partrunner-ai/app-registry/url';
import { safeNextPath, type NexusSession } from '@partrunner-ai/seamless';
import * as seamlessReact from '@partrunner-ai/seamless/react';
import * as seamlessServer from '@partrunner-ai/seamless/server';
import { AppShell, type StaffShellContextValue } from '@partrunner-ai/shell';
import * as shellPreferences from '@partrunner-ai/shell/preferences';
import { THEMES, type ThemeName } from '@partrunner-ai/tokens';
import { Button, type ButtonProps } from '@partrunner-ai/ui';

const schema: SchemaName = 'core';
const handlerOptions = null as HandlerOptions | null;
const app: AppLink = APPS[0]!;
const session: NexusSession = {
  userId: 'fixture-user',
  email: 'fixture@example.com',
  roles: [],
};
const theme: ThemeName = 'nexus';
const button: ButtonProps = { children: THEMES[theme].light.accent };
void [
  AppShell,
  Button,
  apiAuth,
  apiWeek,
  app,
  buildStandaloneUrl,
  button,
  handlerOptions,
  safeNextPath('/'),
  schema,
  seamlessReact,
  seamlessServer,
  session,
  shellPreferences,
];
const shellContext = null as StaffShellContextValue | null;
void shellContext;
`;

const NEXT_TYPES_FIXTURE = `
import {
  getNexusSession,
  nexusMiddlewareGuard,
} from '@partrunner-ai/seamless/next';

void [getNexusSession, nexusMiddlewareGuard];
`;

function exportedSubpaths(manifest) {
  return Object.keys(manifest.exports ?? {})
    .filter((key) => key !== '.' && !key.includes('*'))
    .map((key) => `${manifest.name}${key.slice(1)}`);
}

function exportedTypedSubpaths(manifest) {
  return Object.entries(manifest.exports ?? {})
    .filter(([, value]) => value && typeof value === 'object')
    .map(([key]) =>
      key === '.' ? manifest.name : `${manifest.name}${key.slice(1)}`,
    );
}

async function verifyFixture(manager, reactLine, tarballs, subpaths, root) {
  const fixture = join(root, `${manager}-${reactLine.name}`);
  await mkdir(fixture, { recursive: true });
  await mkdir(join(fixture, 'next-stubs'), { recursive: true });
  await writeFile(
    join(fixture, 'package.json'),
    `${JSON.stringify(fixturePackageJson(tarballs, reactLine), null, 2)}\n`,
  );
  const overrides = tarballs
    .map(
      ({ name, tarball }) =>
        `  ${JSON.stringify(name)}: ${JSON.stringify(`file:${tarball}`)}`,
    )
    .join('\n');
  await writeFile(
    join(fixture, 'pnpm-workspace.yaml'),
    `packages:\n  - .\nautoInstallPeers: false\nstrictPeerDependencies: true\noverrides:\n${overrides}\n`,
  );
  await writeFile(
    join(fixture, '.npmrc'),
    `registry=${PUBLIC_REGISTRY}\nalways-auth=false\n`,
  );
  await writeFile(join(fixture, 'global.npmrc'), '');
  await writeFile(
    join(fixture, 'verify-subpaths.json'),
    `${JSON.stringify(subpaths, null, 2)}\n`,
  );
  await writeFile(join(fixture, 'verify-esm.mjs'), ESM_FIXTURE);
  await writeFile(join(fixture, 'verify-cjs.cjs'), CJS_FIXTURE);
  await writeFile(join(fixture, 'verify-types.ts'), TYPES_FIXTURE);
  await writeFile(join(fixture, 'verify-types.cts'), TYPES_FIXTURE);
  await writeFile(
    join(fixture, 'verify-next-types.ts'),
    NEXT_TYPES_FIXTURE,
  );
  await writeFile(
    join(fixture, 'verify-next-types.cts'),
    NEXT_TYPES_FIXTURE,
  );
  await writeFile(
    join(fixture, 'next-stubs', 'server.d.ts'),
    'export interface NextRequest {}\nexport declare class NextResponse {}\n',
  );
  await writeFile(
    join(fixture, 'next-stubs', 'headers.d.ts'),
    'export declare function cookies(): Promise<unknown>;\n',
  );
  await writeFile(
    join(fixture, 'tsconfig.next-stub.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          strict: true,
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          target: 'ES2022',
          baseUrl: '.',
          paths: {
            'next/headers': ['next-stubs/headers.d.ts'],
            'next/server': ['next-stubs/server.d.ts'],
          },
        },
        files: ['verify-next-types.ts', 'verify-next-types.cts'],
      },
      null,
      2,
    )}\n`,
  );

  const home = join(fixture, '.home');
  const xdgConfig = join(home, '.config');
  const xdgCache = join(home, '.cache');
  const appData = join(home, '.appdata');
  await Promise.all([
    mkdir(xdgConfig, { recursive: true }),
    mkdir(xdgCache, { recursive: true }),
    mkdir(appData, { recursive: true }),
    mkdir(join(home, '.pnpm'), { recursive: true }),
  ]);
  const environment = anonymousRegistryEnvironment(
    join(fixture, '.npmrc'),
    join(fixture, 'global.npmrc'),
    join(fixture, '.npm-cache'),
  );
  environment.APPDATA = appData;
  environment.HOME = home;
  environment.LOCALAPPDATA = appData;
  environment.PNPM_HOME = join(home, '.pnpm');
  environment.PNPM_CONFIG_STORE_DIR = join(fixture, '.pnpm-store');
  environment.USERPROFILE = home;
  environment.XDG_CACHE_HOME = xdgCache;
  environment.XDG_CONFIG_HOME = xdgConfig;
  const installArgs =
    manager === 'npm'
      ? [
          'install',
          '--ignore-scripts',
          '--no-audit',
          '--no-fund',
          '--package-lock=false',
          '--strict-peer-deps',
        ]
      : [
          'install',
          '--ignore-scripts',
          '--no-frozen-lockfile',
          '--strict-peer-dependencies',
          '--store-dir',
          join(fixture, '.pnpm-store'),
        ];
  run(manager, installArgs, { cwd: fixture, env: environment });
  run(process.execPath, ['verify-esm.mjs'], {
    cwd: fixture,
    env: environment,
  });
  run(process.execPath, ['verify-cjs.cjs'], {
    cwd: fixture,
    env: environment,
  });
  run(
    join(ROOT, 'node_modules', '.bin', 'tsc'),
    ['--project', 'tsconfig.next-stub.json'],
    { cwd: fixture, env: environment },
  );
  run(
    join(ROOT, 'node_modules', '.bin', 'tsc'),
    [
      '--noEmit',
      '--strict',
      '--module',
      'NodeNext',
      '--moduleResolution',
      'NodeNext',
      '--target',
      'ES2022',
      'verify-types.ts',
      'verify-types.cts',
    ],
    { cwd: fixture, env: environment },
  );
  run(
    join(ROOT, 'node_modules', '.bin', 'tsc'),
    [
      '--noEmit',
      '--strict',
      '--skipLibCheck',
      '--module',
      'NodeNext',
      '--moduleResolution',
      'NodeNext',
      '--target',
      'ES2022',
      'verify-next-types.ts',
      'verify-next-types.cts',
    ],
    { cwd: fixture, env: environment },
  );
}

const SERVER_ONLY_ESM_FIXTURE = `
import assert from 'node:assert/strict';
import { resolveConfig } from '@partrunner-ai/seamless/server';

const config = resolveConfig({
  UNIFIED_JWT_SECRET: 'fixture-secret',
  NEXT_PUBLIC_NEXUS_URL: 'https://portal.example.com',
});
assert.equal(config.nexusUrl, 'https://portal.example.com');
`;

const SERVER_ONLY_CJS_FIXTURE = `
const assert = require('node:assert/strict');
const { resolveConfig } = require('@partrunner-ai/seamless/server');

const config = resolveConfig({
  UNIFIED_JWT_SECRET: 'fixture-secret',
  NEXT_PUBLIC_NEXUS_URL: 'https://portal.example.com',
});
assert.equal(config.nexusUrl, 'https://portal.example.com');
`;

const SERVER_ONLY_ABSENCE_FIXTURE = `
const assert = require('node:assert/strict');

for (const specifier of ['react', 'react/jsx-runtime', 'lucide-react']) {
  let resolved = false;
  try {
    require.resolve(specifier);
    resolved = true;
  } catch (error) {
    if (error?.code !== 'MODULE_NOT_FOUND') throw error;
  }
  assert.equal(resolved, false, specifier + ' must not be installed');
}
`;

const SERVER_ONLY_TYPES_FIXTURE = `
import {
  resolveConfig,
  type SeamlessConfig,
} from '@partrunner-ai/seamless/server';

const config: SeamlessConfig = resolveConfig({
  UNIFIED_JWT_SECRET: 'fixture-secret',
  NEXT_PUBLIC_NEXUS_URL: 'https://portal.example.com',
});
void config;
`;

async function verifyFrameworkFreeServerFixture(manager, tarballs, root) {
  const fixture = join(root, `${manager}-server-only`);
  await mkdir(fixture, { recursive: true });
  const serverPackages = tarballs.filter(({ name }) =>
    [
      '@partrunner-ai/app-registry',
      '@partrunner-ai/seamless',
    ].includes(name),
  );
  assert.equal(serverPackages.length, 2);
  await writeFile(
    join(fixture, 'package.json'),
    `${JSON.stringify(
      {
        name: 'partrunner-server-only-artifact-fixture',
        version: '0.0.0',
        private: true,
        type: 'module',
        dependencies: Object.fromEntries(
          serverPackages.map(({ name, tarball }) => [
            name,
            `file:${tarball}`,
          ]),
        ),
      },
      null,
      2,
    )}\n`,
  );
  const overrides = serverPackages
    .map(
      ({ name, tarball }) =>
        `  ${JSON.stringify(name)}: ${JSON.stringify(`file:${tarball}`)}`,
    )
    .join('\n');
  await writeFile(
    join(fixture, 'pnpm-workspace.yaml'),
    `packages:\n  - .\nautoInstallPeers: false\nstrictPeerDependencies: true\noverrides:\n${overrides}\n`,
  );
  await writeFile(
    join(fixture, '.npmrc'),
    `registry=${PUBLIC_REGISTRY}\nalways-auth=false\n`,
  );
  await writeFile(join(fixture, 'global.npmrc'), '');
  await writeFile(
    join(fixture, 'verify-esm.mjs'),
    SERVER_ONLY_ESM_FIXTURE,
  );
  await writeFile(
    join(fixture, 'verify-cjs.cjs'),
    SERVER_ONLY_CJS_FIXTURE,
  );
  await writeFile(
    join(fixture, 'verify-absent.cjs'),
    SERVER_ONLY_ABSENCE_FIXTURE,
  );
  await writeFile(
    join(fixture, 'verify-types.ts'),
    SERVER_ONLY_TYPES_FIXTURE,
  );

  const home = join(fixture, '.home');
  const xdgConfig = join(home, '.config');
  const xdgCache = join(home, '.cache');
  const appData = join(home, '.appdata');
  await Promise.all([
    mkdir(xdgConfig, { recursive: true }),
    mkdir(xdgCache, { recursive: true }),
    mkdir(appData, { recursive: true }),
    mkdir(join(home, '.pnpm'), { recursive: true }),
  ]);
  const environment = anonymousRegistryEnvironment(
    join(fixture, '.npmrc'),
    join(fixture, 'global.npmrc'),
    join(fixture, '.npm-cache'),
  );
  environment.APPDATA = appData;
  environment.HOME = home;
  environment.LOCALAPPDATA = appData;
  environment.PNPM_HOME = join(home, '.pnpm');
  environment.PNPM_CONFIG_STORE_DIR = join(fixture, '.pnpm-store');
  environment.USERPROFILE = home;
  environment.XDG_CACHE_HOME = xdgCache;
  environment.XDG_CONFIG_HOME = xdgConfig;
  const installArgs =
    manager === 'npm'
      ? [
          'install',
          '--ignore-scripts',
          '--no-audit',
          '--no-fund',
          '--package-lock=false',
          '--strict-peer-deps',
        ]
      : [
          'install',
          '--ignore-scripts',
          '--no-frozen-lockfile',
          '--strict-peer-dependencies',
          '--store-dir',
          join(fixture, '.pnpm-store'),
        ];
  run(manager, installArgs, { cwd: fixture, env: environment });
  run(process.execPath, ['verify-esm.mjs'], {
    cwd: fixture,
    env: environment,
  });
  run(process.execPath, ['verify-cjs.cjs'], {
    cwd: fixture,
    env: environment,
  });
  run(process.execPath, ['verify-absent.cjs'], {
    cwd: fixture,
    env: environment,
  });
  run(
    join(ROOT, 'node_modules', '.bin', 'tsc'),
    [
      '--noEmit',
      '--strict',
      '--module',
      'NodeNext',
      '--moduleResolution',
      'NodeNext',
      '--target',
      'ES2022',
      'verify-types.ts',
    ],
    { cwd: fixture, env: environment },
  );
}

function verifyCleanArtifactSource(status) {
  assert.equal(
    status.trim(),
    '',
    'Retaining artifacts requires a clean committed worktree',
  );
}

verifyCleanArtifactSource('');
assert.throws(
  () => verifyCleanArtifactSource(' M package.json'),
  /clean committed worktree/,
);

async function retainVerifiedArtifacts(directory, tarballs) {
  if (!directory) return;
  verifyCleanArtifactSource(
    run('git', [
      'status',
      '--porcelain=v1',
      '--untracked-files=all',
    ]),
  );
  await mkdir(directory, { recursive: true });
  assert.deepEqual(
    await readdir(directory),
    [],
    'Retained artifact output directory must be empty',
  );
  const packages = [];
  for (const packageInfo of [...tarballs].sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const filename = basename(packageInfo.tarball);
    const destination = join(directory, filename);
    await copyFile(packageInfo.tarball, destination);
    const bytes = await readFile(destination);
    packages.push({
      name: packageInfo.name,
      version: packageInfo.version,
      filename,
      bytes: bytes.byteLength,
      integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}`,
    });
  }
  await writeFile(
    join(directory, 'manifest.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        source: {
          commit: run('git', ['rev-parse', 'HEAD']).trim(),
          tree: run('git', ['rev-parse', 'HEAD^{tree}']).trim(),
        },
        packages,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`Retained verified tarballs in ${relative(ROOT, directory)}`);
}

const temporaryRoot = await mkdtemp(
  join(tmpdir(), 'partrunner-package-artifacts-'),
);
try {
  const packages = await discoverPackages();
  const workspaceVersions = new Map(
    packages.map((packageInfo) => [
      packageInfo.manifest.name,
      packageInfo.manifest.version,
    ]),
  );
  const tarballRoot = join(temporaryRoot, 'tarballs');
  await mkdir(tarballRoot, { recursive: true });
  const tarballs = [];
  const subpaths = [];
  const typedSubpaths = [];
  const summary = [];

  for (const packageInfo of packages) {
    const pack = parsePackResult(
      run('pnpm', [
        '--dir',
        packageInfo.directory,
        'pack',
        '--pack-destination',
        tarballRoot,
        '--json',
      ]),
    );
    const tarball = isAbsolute(pack.filename)
      ? pack.filename
      : join(tarballRoot, pack.filename);
    const inspection = await inspectTarball(
      packageInfo,
      tarball,
      join(
        temporaryRoot,
        'unpacked',
        packageInfo.manifest.name.replaceAll('/', '-'),
      ),
      workspaceVersions,
    );
    tarballs.push({
      name: packageInfo.manifest.name,
      version: packageInfo.manifest.version,
      tarball,
    });
    subpaths.push(...exportedSubpaths(inspection.packedManifest));
    typedSubpaths.push(
      ...exportedTypedSubpaths(inspection.packedManifest),
    );
    summary.push({
      package: packageInfo.manifest.name,
      version: packageInfo.manifest.version,
      files: inspection.files,
      bytes: (await stat(tarball)).size,
      sourceFilesInMaps: inspection.embeddedSourceFiles,
      registry: inspection.registry,
    });
  }

  subpaths.sort();
  typedSubpaths.sort();
  const typeFixtures = `${TYPES_FIXTURE}\n${NEXT_TYPES_FIXTURE}`;
  for (const subpath of typedSubpaths) {
    assert(
      typeFixtures.includes(`'${subpath}'`),
      `Type fixtures do not cover ${subpath}`,
    );
  }
  for (const reactLine of REACT_LINES) {
    await verifyFixture(
      'npm',
      reactLine,
      tarballs,
      subpaths,
      join(temporaryRoot, 'fixtures'),
    );
    await verifyFixture(
      'pnpm',
      reactLine,
      tarballs,
      subpaths,
      join(temporaryRoot, 'fixtures'),
    );
  }
  await verifyFrameworkFreeServerFixture(
    'npm',
    tarballs,
    join(temporaryRoot, 'fixtures'),
  );
  await verifyFrameworkFreeServerFixture(
    'pnpm',
    tarballs,
    join(temporaryRoot, 'fixtures'),
  );
  await retainVerifiedArtifacts(
    RETAINED_ARTIFACT_DIRECTORY,
    tarballs,
  );

  console.table(summary);
  const embeddedSources = summary.reduce(
    (total, item) => total + item.sourceFilesInMaps,
    0,
  );
  if (embeddedSources > 0) {
    console.warn(
      `Review gate: ${embeddedSources} original source files are embedded in published source maps.`,
    );
  }
  console.log(
    'Package artifacts install and resolve anonymously with npm and pnpm on React 18 and 19; the server-only Seamless entry installs without React.',
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
