import * as querystring from 'querystring';
import * as path from 'path';

export enum HelmSyntaxVersion {
    Unknown = 1,
    V2 = 2,
    V3 = 3,
    V4 = 4,
}

export type HelmInspectMode = 'chart' | 'values';

export interface HelmChartRequest {
    readonly chart: string;
    readonly version?: string;
}

const MAX_HELM_QUERY_LENGTH = 8192;
const MAX_HELM_CHART_REFERENCE_LENGTH = 1024;
const MAX_HELM_REPOSITORY_NAME_LENGTH = 253;
const MAX_HELM_VERSION_LENGTH = 256;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/;
const HELM_REPOSITORY_VERSION = /^v?[0-9]+(?:\.[0-9]+){0,2}(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export function helmDryRunArgs(version: HelmSyntaxVersion, chartPath: string): string[] {
    return [
        'install',
        version === HelmSyntaxVersion.V4 ? '--dry-run=client' : '--dry-run',
        ...(version === HelmSyntaxVersion.V3 || version === HelmSyntaxVersion.V4 ? ['--generate-name'] : []),
        '--debug',
        chartPath,
    ];
}

export function helmTemplatePreviewArgs(version: HelmSyntaxVersion, chartPath: string, templatePath: string): string[] {
    const templateFlag = version === HelmSyntaxVersion.V3 || version === HelmSyntaxVersion.V4 ? '--show-only' : '--execute';
    return ['template', chartPath, templateFlag, templatePath];
}

export function helmRepoSearchArgs(version: HelmSyntaxVersion, repository: string): string[] {
    const modernSyntax = version === HelmSyntaxVersion.V3 || version === HelmSyntaxVersion.V4;
    const pattern = helmRepositorySearchPattern(repository, !modernSyntax);
    return [
        'search',
        ...(modernSyntax ? ['repo'] : []),
        '--regexp',
        '--versions',
        modernSyntax ? '--max-col-width' : '--col-width',
        '0',
        '--',
        pattern,
    ];
}

export function helmRepositorySearchPattern(repository: string, caseInsensitive: boolean): string {
    const prefix = caseInsensitive ? '(?i)' : '';
    return `${prefix}^[^\\v]+\\v${escapeGoRegexpLiteral(repository)}/[^\\v]+\\v`;
}

export function helmInspectArgs(
    version: HelmSyntaxVersion,
    mode: HelmInspectMode,
    chart: string,
    chartVersion?: string
): string[] {
    return [
        'inspect',
        ...(mode === 'chart' && version !== HelmSyntaxVersion.V2 ? ['all'] : mode === 'values' ? ['values'] : []),
        chart,
        ...(chartVersion ? ['--version', chartVersion] : []),
    ];
}

export function helmFetchArgs(chart: string, version: string | undefined, destination: string, untar: boolean): string[] {
    return [
        'fetch',
        chart,
        ...(untar ? ['--untar'] : []),
        ...(version ? ['--version', version] : []),
        '-d',
        destination,
    ];
}

export function helmDependencyListArgs(version: HelmSyntaxVersion, chartPath: string): string[] {
    return [
        'dep',
        'list',
        ...(version === HelmSyntaxVersion.V4 ? ['--max-col-width', '0'] : []),
        chartPath,
    ];
}

export function helmInstallArgs(
    syntaxVersion: HelmSyntaxVersion,
    chart: string,
    version: string | undefined,
    namespace: string | undefined
): string[] {
    return [
        'install',
        chart,
        ...(version ? ['--version', version] : []),
        ...(namespace ? ['--namespace', namespace] : []),
        ...(syntaxVersion === HelmSyntaxVersion.V3 || syntaxVersion === HelmSyntaxVersion.V4 ? ['--generate-name'] : []),
    ];
}

export function helmFetchedChartDirectoryName(chartReference: string): string | undefined {
    const parts = chartReference.split('/');
    if (parts.length !== 2 || !isSafeHelmRepositoryName(parts[0]) ||
        !/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(parts[1])) {
        return undefined;
    }
    return parts[1];
}

export function isExplicitHelmLocalChartReference(chartReference: string): boolean {
    return /^[A-Za-z]:/.test(chartReference) || path.isAbsolute(chartReference) || path.win32.isAbsolute(chartReference) ||
        chartReference.startsWith('./') || chartReference.startsWith('../') ||
        chartReference.startsWith('.\\') || chartReference.startsWith('..\\');
}

export function isSafeHelmRepositoryName(value: unknown): value is string {
    return isSafeHelmValue(value, MAX_HELM_REPOSITORY_NAME_LENGTH) &&
        !value.startsWith('.') && !value.includes('/') && !value.includes('\\');
}

export function isSafeHelmChartReference(value: unknown): value is string {
    return isSafeHelmValue(value, MAX_HELM_CHART_REFERENCE_LENGTH);
}

export function isSafeHelmChartVersion(value: unknown): value is string {
    return isSafeHelmValue(value, MAX_HELM_VERSION_LENGTH);
}

export function isSafeHelmRepositoryChartReference(value: unknown, repository: string, caseInsensitive: boolean): value is string {
    if (!isSafeHelmChartReference(value) || isExplicitHelmLocalChartReference(value)) {
        return false;
    }
    const prefix = `${repository}/`;
    const hasPrefix = caseInsensitive ? value.toLowerCase().startsWith(prefix.toLowerCase()) : value.startsWith(prefix);
    if (!hasPrefix) {
        return false;
    }
    const suffix = value.substring(prefix.length);
    return suffix.length > 0 && !suffix.includes('\\') &&
        !suffix.split('/').some((part) => part.length === 0 || part === '.' || part === '..');
}

function escapeGoRegexpLiteral(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function isSafeHelmRepositoryChartVersion(value: unknown): value is string {
    return typeof value === 'string' && value.length <= MAX_HELM_VERSION_LENGTH &&
        !CONTROL_CHARACTERS.test(value) && HELM_REPOSITORY_VERSION.test(value);
}

export function helmChartQuery(chart: string, version?: string): string {
    return querystring.stringify({ chart, ...(version ? { version } : {}) });
}

export function helmFileQuery(path: string): string {
    return querystring.stringify({ path });
}

export function parseHelmChartQuery(query: string): HelmChartRequest | undefined {
    const parsed = parseQuery(query, ['chart'], ['version']);
    if (!parsed) {
        return undefined;
    }
    const chart = parsed.chart;
    const version = parsed.version;
    if (!isSafeHelmChartReference(chart) || (version !== undefined && !isSafeHelmChartVersion(version))) {
        return undefined;
    }
    return { chart, ...(version ? { version } : {}) };
}

export function parseHelmRepositoryChartQuery(query: string): HelmChartRequest | undefined {
    const parsed = parseQuery(query, ['chart'], ['version']);
    if (!parsed) {
        return undefined;
    }
    const chart = parsed.chart;
    const separator = chart.indexOf('/');
    if (separator <= 0) {
        return undefined;
    }
    const repository = chart.substring(0, separator);
    const version = parsed.version;
    if (!isSafeHelmRepositoryName(repository) ||
        !isSafeHelmRepositoryChartReference(chart, repository, false) ||
        (version !== undefined && !isSafeHelmRepositoryChartVersion(version))) {
        return undefined;
    }
    return { chart, ...(version ? { version } : {}) };
}

export function parseHelmFileQuery(query: string): string | undefined {
    const parsed = parseQuery(query, ['path'], []);
    const filePath = parsed?.path;
    const isNativePath = !!filePath && path.isAbsolute(filePath);
    const isWindowsPath = !!filePath && process.platform === 'win32' && path.win32.isAbsolute(filePath);
    return filePath && !CONTROL_CHARACTERS.test(filePath) && (isNativePath || isWindowsPath) ? filePath : undefined;
}

function isSafeHelmValue(value: unknown, maxLength: number): value is string {
    return typeof value === 'string' && value.length > 0 && value.length <= maxLength && value.trim() === value &&
        !value.startsWith('-') && !CONTROL_CHARACTERS.test(value);
}

function parseQuery(
    query: string,
    requiredKeys: readonly string[],
    optionalKeys: readonly string[]
): Record<string, string> | undefined {
    if (query.length > MAX_HELM_QUERY_LENGTH) {
        return undefined;
    }
    const parsed = querystring.parse(query, '&', '=', { maxKeys: 0 });
    const allowedKeys = new Set([...requiredKeys, ...optionalKeys]);
    if (Object.keys(parsed).some((key) => !allowedKeys.has(key))) {
        return undefined;
    }
    const result: Record<string, string> = {};
    for (const key of requiredKeys) {
        const value = parsed[key];
        if (typeof value !== 'string' || value.length === 0) {
            return undefined;
        }
        result[key] = value;
    }
    for (const key of optionalKeys) {
        const value = parsed[key];
        if (value !== undefined) {
            if (typeof value !== 'string' || value.length === 0) {
                return undefined;
            }
            result[key] = value;
        }
    }
    return result;
}
