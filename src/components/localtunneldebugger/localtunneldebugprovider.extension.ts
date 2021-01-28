export interface LocalTunnelDebugProvider {
    readonly id: string;
    startLocalTunnelDebugging(target?: any): void;
}
