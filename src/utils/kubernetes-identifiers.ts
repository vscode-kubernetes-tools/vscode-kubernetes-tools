const DNS_1123_LABEL_PATTERN = /^[a-z0-9](?:[-a-z0-9]*[a-z0-9])?$/;
const DNS_1123_SUBDOMAIN_PATTERN = /^[a-z0-9](?:[-a-z0-9]*[a-z0-9])?(?:\.[a-z0-9](?:[-a-z0-9]*[a-z0-9])?)*$/;
const DNS_1035_LABEL_PATTERN = /^[a-z](?:[-a-z0-9]*[a-z0-9])?$/;
const KUBERNETES_KIND_PATTERN = /^[A-Za-z][A-Za-z0-9-]{0,62}$/;
const KUBERNETES_VERSION_PATTERN = /^v[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const KUBERNETES_LABEL_NAME_PATTERN = /^[A-Za-z0-9](?:[-_.A-Za-z0-9]*[A-Za-z0-9])?$/;
const NON_PRINTABLE_CHARACTER_PATTERN = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/;
const CONFIG_DATA_KEY_PATTERN = /^[A-Za-z0-9._-]+$/;
const SAFE_IDENTIFIER_PATTERN = /^[^\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff/%]+$/;

export const INVALID_KUBERNETES_IDENTIFIER_MESSAGE = 'The Kubernetes endpoint returned an invalid identifier. The operation was stopped.';
export const INVALID_KUBERNETES_VERSION_MESSAGE = 'The Kubernetes endpoint returned an invalid Kubernetes server version. The operation was stopped.';

export function isValidDns1123Label(value: unknown): value is string {
    return typeof value === 'string' &&
        value.length > 0 &&
        value.length <= 63 &&
        matchesEntireValue(DNS_1123_LABEL_PATTERN, value);
}

export function isValidDns1123Subdomain(value: unknown): value is string {
    if (typeof value !== 'string' ||
        value.length === 0 ||
        value.length > 253 ||
        !matchesEntireValue(DNS_1123_SUBDOMAIN_PATTERN, value)) {
        return false;
    }
    return true;
}

export const isValidNamespaceName = isValidDns1123Label;
export const isValidContainerName = isValidDns1123Label;
export const isValidKubernetesResourceName = isValidDns1123Subdomain;

export function isSafeOpaqueIdentifier(value: unknown): value is string {
    return typeof value === 'string' &&
        matchesEntireValue(SAFE_IDENTIFIER_PATTERN, value) &&
        value !== '.' &&
        value !== '..';
}

export function isValidKubeconfigName(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0 && value.length <= 1024 && !NON_PRINTABLE_CHARACTER_PATTERN.test(value);
}

export function isValidKubernetesResourceType(value: unknown): value is string {
    if (typeof value !== 'string' || value.length === 0 || value.length > 253) {
        return false;
    }
    const parts = value.split('.');
    return parts.length > 0 &&
        isValidDns1035Label(parts[0]) &&
        (parts.length === 1 || isValidDns1123Subdomain(parts.slice(1).join('.')));
}

export function isValidDns1035Label(value: unknown): value is string {
    return typeof value === 'string' &&
        value.length > 0 &&
        value.length <= 63 &&
        matchesEntireValue(DNS_1035_LABEL_PATTERN, value);
}

export function isValidKubernetesResourceTypeList(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0 &&
        value.split(',').every(isValidKubernetesResourceType);
}

export function isValidKubernetesKind(value: unknown): value is string {
    return typeof value === 'string' &&
        matchesEntireValue(KUBERNETES_KIND_PATTERN, value) &&
        isValidDns1035Label(value.toLowerCase());
}

export function isValidKubernetesResourceReference(value: unknown): value is string {
    if (typeof value !== 'string') {
        return false;
    }
    const parts = value.split('/');
    return parts.length === 2 &&
        isValidKubernetesResourceType(parts[0]) &&
        isValidDns1123Subdomain(parts[1]);
}

export function isValidOpaqueResourceReference(value: unknown): value is string {
    if (typeof value !== 'string') {
        return false;
    }
    const parts = value.split('/');
    return parts.length === 2 &&
        isValidKubernetesResourceType(parts[0]) &&
        isSafeOpaqueIdentifier(parts[1]);
}

export function isValidKubernetesApiVersion(value: unknown): value is string {
    if (typeof value !== 'string') {
        return false;
    }
    const parts = value.split('/');
    if (parts.length === 1) {
        return isValidDns1035Label(parts[0]);
    }
    return parts.length === 2 &&
        isValidDns1123Subdomain(parts[0]) &&
        isValidDns1035Label(parts[1]);
}

export function isValidKubernetesVersion(value: unknown): value is string {
    return typeof value === 'string' &&
        value.length <= 128 &&
        matchesEntireValue(KUBERNETES_VERSION_PATTERN, value);
}

export function isValidConfigDataKey(value: unknown): value is string {
    return typeof value === 'string' &&
        value.length > 0 &&
        value.length <= 253 &&
        matchesEntireValue(CONFIG_DATA_KEY_PATTERN, value) &&
        value !== '.' &&
        value !== '..' &&
        !value.startsWith('..');
}

export function isValidKubernetesLabelSelector(selector: unknown): boolean {
    return kubernetesLabelSelectorToString(selector) !== undefined;
}

export function kubernetesLabelSelectorToString(selector: unknown): string | undefined {
    if (selector === undefined || selector === null) {
        return '';
    }
    if (!isObject(selector)) {
        return undefined;
    }
    const selectorValue = selector as { matchLabels?: unknown; matchExpressions?: unknown };
    const isStructuredSelector = Object.prototype.hasOwnProperty.call(selector, 'matchLabels') ||
        Object.prototype.hasOwnProperty.call(selector, 'matchExpressions');
    const matchLabels = isStructuredSelector ? selectorValue.matchLabels : selector;
    if (matchLabels !== undefined && matchLabels !== null && !isObject(matchLabels)) {
        return undefined;
    }
    const requirements: string[] = [];
    for (const key of Object.keys(matchLabels || {})) {
        const value = (matchLabels as { [key: string]: unknown })[key];
        if (!isValidKubernetesLabelKey(key) || !isValidKubernetesLabelValue(value)) {
            return undefined;
        }
        requirements.push(`${key}=${value}`);
    }

    const expressions = selectorValue.matchExpressions;
    if (expressions !== undefined && !Array.isArray(expressions)) {
        return undefined;
    }
    for (const expression of expressions || []) {
        if (!isObject(expression)) {
            return undefined;
        }
        const { key, operator, values } = expression as { key?: unknown; operator?: unknown; values?: unknown };
        if (typeof key !== 'string' || !isValidKubernetesLabelKey(key) || typeof operator !== 'string') {
            return undefined;
        }
        if (operator === 'In' || operator === 'NotIn') {
            if (!Array.isArray(values) || values.length === 0 || !values.every(isValidKubernetesLabelValue)) {
                return undefined;
            }
            requirements.push(`${key} ${operator === 'In' ? 'in' : 'notin'} (${values.join(',')})`);
        } else if (operator === 'Exists' || operator === 'DoesNotExist') {
            if (values !== undefined && (!Array.isArray(values) || values.length !== 0)) {
                return undefined;
            }
            requirements.push(operator === 'Exists' ? key : `!${key}`);
        } else {
            return undefined;
        }
    }
    return requirements.join(',');
}

function isValidKubernetesLabelValue(value: unknown): value is string {
    return typeof value === 'string' &&
        value.length <= 63 &&
        (value.length === 0 || matchesEntireValue(KUBERNETES_LABEL_NAME_PATTERN, value));
}

function isValidKubernetesLabelKey(key: string): boolean {
    const parts = key.split('/');
    if (parts.length === 1) {
        return parts[0].length <= 63 && matchesEntireValue(KUBERNETES_LABEL_NAME_PATTERN, parts[0]);
    }
    return parts.length === 2 &&
        isValidDns1123Subdomain(parts[0]) &&
        parts[1].length <= 63 &&
        matchesEntireValue(KUBERNETES_LABEL_NAME_PATTERN, parts[1]);
}

export function hasValidKubernetesMetadata(value: unknown): boolean {
    if (!isObject(value)) {
        return false;
    }
    const metadata = value as { name?: unknown; namespace?: unknown };
    return isValidDns1123Subdomain(metadata.name) &&
        (metadata.namespace === undefined || metadata.namespace === null || metadata.namespace === '' || isValidDns1123Label(metadata.namespace));
}

export function hasValidContainerNames(value: unknown): boolean {
    if (value === undefined || value === null) {
        return true;
    }
    return Array.isArray(value) && value.every((container) =>
        isObject(container) && isValidDns1123Label((container as { name?: unknown }).name)
    );
}

export function hasValidPodIdentifiers(value: unknown): boolean {
    if (!isObject(value) || !hasValidKubernetesMetadata((value as { metadata?: unknown }).metadata)) {
        return false;
    }
    const spec = (value as { spec?: unknown }).spec;
    if (!isObject(spec)) {
        return false;
    }
    const podSpec = spec as { containers?: unknown; initContainers?: unknown; nodeName?: unknown };
    return Array.isArray(podSpec.containers) &&
        hasValidContainerNames(podSpec.containers) &&
        hasValidContainerNames(podSpec.initContainers) &&
        (podSpec.nodeName === undefined || podSpec.nodeName === '' || isValidKubernetesResourceName(podSpec.nodeName));
}

export function sanitizeForDisplay(value: unknown): string {
    return String(value).replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, '?');
}

function isObject(value: unknown): value is object {
    return typeof value === 'object' && value !== null;
}

function matchesEntireValue(pattern: RegExp, value: string): boolean {
    const match = pattern.exec(value);
    return !!match && match[0].length === value.length;
}
