import { LocalRedirectionDebuggerV1 } from "../../contract/localredirectiondebugger/v1";
import { LocalRedirectionDebugger } from '../../../components/localredirectiondebugger/localredirectiondebugger';

export function impl(localDebugger: LocalRedirectionDebugger): LocalRedirectionDebuggerV1 {
    return new LocalRedirectionDebuggerV1Impl(localDebugger);
}

class LocalRedirectionDebuggerV1Impl implements LocalRedirectionDebuggerV1 {
    constructor(private readonly localDebugger: LocalRedirectionDebugger) {}

    register(provider: LocalRedirectionDebuggerV1.LocalRedirectionDebugger): void {
        this.localDebugger.register(provider);
    }
}
