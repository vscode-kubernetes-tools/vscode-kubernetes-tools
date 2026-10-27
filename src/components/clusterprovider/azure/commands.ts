export const LIST_CLUSTERS_QUERY = '[].{name:name,resourceGroup:resourceGroup}';
export const LIST_LOCATIONS_QUERY = '[].{name:name,displayName:displayName}';

export interface AzureClusterCreateOptions {
    readonly metadata: {
        readonly clusterName: string;
        readonly resourceGroupName: string;
        readonly location: string;
    };
    readonly agentSettings: {
        readonly count: string | number;
        readonly vmSize: string;
    };
}

export const azureVersionArgs = (): string[] => ['--version'];

export const listSubscriptionsArgs = (): string[] => [
    'account', 'list', '--all', '--query', '[*].name', '-o', 'json',
];

export const setSubscriptionArgs = (subscription: string): string[] => [
    'account', 'set', '--subscription', subscription,
];

export const listClustersArgs = (): string[] => [
    'aks', 'list', '--query', LIST_CLUSTERS_QUERY, '-o', 'json',
];

export const listLocationsArgs = (): string[] => [
    'account', 'list-locations', '--query', LIST_LOCATIONS_QUERY, '-o', 'json',
];

export const listVmSizesArgs = (location: string): string[] => [
    'vm', 'list-sizes', '-l', location, '-o', 'json',
];

export const showResourceGroupArgs = (resourceGroup: string): string[] => [
    'group', 'show', '-n', resourceGroup, '-o', 'json',
];

export const createResourceGroupArgs = (resourceGroup: string, location: string): string[] => [
    'group', 'create', '-n', resourceGroup, '-l', location,
];

export function createClusterArgs(options: AzureClusterCreateOptions): string[] {
    return [
        'aks', 'create',
        '-n', options.metadata.clusterName,
        '-g', options.metadata.resourceGroupName,
        '-l', options.metadata.location,
        '--generate-ssh-keys',
        '--no-wait',
        '--node-count', String(options.agentSettings.count),
        '--node-vm-size', options.agentSettings.vmSize,
    ];
}

export const waitForClusterArgs = (clusterName: string, resourceGroup: string): string[] => [
    'aks', 'wait', '--created', '--interval', '5', '--timeout', '10',
    '-n', clusterName, '-g', resourceGroup, '-o', 'json',
];

export function getCredentialsArgs(clusterName: string, resourceGroup: string, kubeconfigFile?: string): string[] {
    return [
        'aks', 'get-credentials', '-n', clusterName, '-g', resourceGroup,
        ...(kubeconfigFile ? ['-f', kubeconfigFile] : []),
    ];
}

export const installKubectlArgs = (installFile: string): string[] => [
    'aks', 'install-cli', '--install-location', installFile,
];
