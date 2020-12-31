export interface LocalTunnelDebugProvider {
    readonly id: string;
    startDebugging(target?: any): void;
}
