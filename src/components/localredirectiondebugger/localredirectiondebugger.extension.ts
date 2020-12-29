export interface LocalRedirectionDebuggerProvider {
    readonly id: string;
    startDebugging(target?: any): void;
}
