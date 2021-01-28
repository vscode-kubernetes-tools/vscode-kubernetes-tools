import { LocalTunnelDebuggerV1 } from "../../contract/localtunneldebugger/v1";
import { LocalTunnelDebugger } from '../../../components/localtunneldebugger/localtunneldebugger';

export function impl(localDebugger: LocalTunnelDebugger): LocalTunnelDebuggerV1 {
    return new LocalTunnelDebuggerV1Impl(localDebugger);
}

class LocalTunnelDebuggerV1Impl implements LocalTunnelDebuggerV1 {
    constructor(private readonly localDebugger: LocalTunnelDebugger) {}

    registerLocalTunnelDebugProvider(localTunnelDebugProvider: LocalTunnelDebuggerV1.LocalTunnelDebugProvider): void {
        this.localDebugger.register(localTunnelDebugProvider);
    }

    startLocalTunnelDebugSession(target?: any): void {
        this.localDebugger.startLocalTunnelDebugSession(target);
    }
}
