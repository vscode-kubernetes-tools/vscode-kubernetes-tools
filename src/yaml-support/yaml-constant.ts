import * as path from 'path';

export const KUBERNETES_SCHEMA = 'kubernetes';

export const KUBERNETES_SCHEMA_PREFIX = KUBERNETES_SCHEMA + '://schema/';

export const VSCODE_YAML_EXTENSION_ID = 'redhat.vscode-yaml';

export const KUBERNETES_SCHEMA_VERSION = '1.12.2';

export const KUBERNETES_SCHEMA_FILE = path.join(__dirname, `../../../schema/swagger-v${KUBERNETES_SCHEMA_VERSION}.json`);
export const FALLBACK_SCHEMA_FILE = path.join(__dirname, `../../../schema/swagger-v${KUBERNETES_SCHEMA_VERSION}.json`);

export const KUBERNETES_SCHEMA_ENUM_FILE = path.join(__dirname, `../../../schema/schema_enums-v${KUBERNETES_SCHEMA_VERSION}.json`);

export const KUBERNETES_GROUP_VERSION_KIND =  'x-kubernetes-group-version-kind';

export const GROUP_VERSION_KIND_SEPARATOR =  '@';
