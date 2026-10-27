import * as net from 'net';

const TAG_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/;
const REPOSITORY_COMPONENT_PATTERN = /^[a-z0-9]+(?:(?:[._]|__|-+)[a-z0-9]+)*$/;
const DOMAIN_COMPONENT_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/;

export interface TaggedImageReference {
    readonly value: string;
    readonly registry?: string;
    readonly repository: string;
    readonly repositoryLeaf: string;
    readonly tag: string;
}

export function parseTaggedImageReference(value: string): TaggedImageReference | undefined {
    if (!value || value.includes('@') || /[\u0000-\u0020\u007f-\u009f]/.test(value)) {
        return undefined;
    }

    const lastSlash = value.lastIndexOf('/');
    const tagSeparator = value.lastIndexOf(':');
    if (tagSeparator <= lastSlash || tagSeparator === value.length - 1) {
        return undefined;
    }
    const name = value.substring(0, tagSeparator);
    const tag = value.substring(tagSeparator + 1);
    if (!TAG_PATTERN.test(tag)) {
        return undefined;
    }

    const components = name.split('/');
    if (components.some((component) => component.length === 0)) {
        return undefined;
    }
    const registryCandidate = components.length > 1 && isRegistryComponent(components[0]);
    if (registryCandidate && !isValidRegistry(components[0])) {
        return undefined;
    }
    const hasRegistry = registryCandidate;
    const registry = hasRegistry ? components.shift() : undefined;
    if (components.length === 0 || components.some((component) => !REPOSITORY_COMPONENT_PATTERN.test(component))) {
        return undefined;
    }
    const repository = components.join('/');
    const normalizedRepository = components.length === 1 &&
        (!registry || registry.toLowerCase() === 'docker.io' || registry.toLowerCase() === 'index.docker.io') ?
        `library/${repository}` : repository;
    if (Buffer.byteLength(normalizedRepository, 'utf8') > 255) {
        return undefined;
    }
    return {
        value,
        ...(registry ? { registry } : {}),
        repository,
        repositoryLeaf: components[components.length - 1],
        tag,
    };
}

export function requireTaggedImageReference(value: string): TaggedImageReference {
    const parsed = parseTaggedImageReference(value);
    if (!parsed) {
        throw new Error(`Invalid tagged container image reference: ${value}`);
    }
    return parsed;
}

export function isValidImageTag(value: string): boolean {
    return TAG_PATTERN.test(value);
}

export function sanitiseRepositoryComponent(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9._-]/g, '-');
}

function isRegistryComponent(value: string): boolean {
    return value === 'localhost' || value.startsWith('[') || /[.:A-Z]/.test(value);
}

function isValidRegistry(value: string): boolean {
    if (value.startsWith('[')) {
        const close = value.indexOf(']');
        const address = close < 0 ? '' : value.substring(1, close);
        if (!/^[A-Fa-f0-9:]+$/.test(address) || net.isIP(address) !== 6) {
            return false;
        }
        const suffix = value.substring(close + 1);
        return suffix === '' || /^:\d+$/.test(suffix);
    }

    const portSeparator = value.lastIndexOf(':');
    const host = portSeparator >= 0 ? value.substring(0, portSeparator) : value;
    const port = portSeparator >= 0 ? value.substring(portSeparator + 1) : undefined;
    return !!host && (port === undefined || /^\d+$/.test(port)) &&
        host.split('.').every((component) => DOMAIN_COMPONENT_PATTERN.test(component));
}
