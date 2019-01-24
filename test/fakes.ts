// import { ShellResult } from '../src/shell';

// function nop(...args: any[]) {
//     return [];
// }

// export interface FakeHostSettings {
//     errors?: string[];
//     warnings?: string[];
//     infos?: string[];
//     configuration?: any;
// }

// export interface FakeFSSettings {
//     existentPaths?: string[];
//     onDirSync?: (path: string) => string[];
// }

// export interface FakeCommand {
//     command: string;
//     code: number;
//     stdout?: string;
//     stderr?: string;
// }

// export interface FakeShellSettings {
//     isWindows?: boolean;
//     isUnix?: boolean;
//     home?: string;
//     recognisedCommands?: FakeCommand[];
//     execCallback?: (cmd: string) => ShellResult;
// }

// export interface FakeKubectlSettings {
//     asLines?: (cmd: string) => string[] | ShellResult;
//     invokeAsync?: (cmd: string) => ShellResult;
// }

// export function host(settings: FakeHostSettings = {}): any {
//     return {
//         showErrorMessage: (message: string, ...items: string[]) => {
//             if (settings.errors) settings.errors.push(message);
//             return { then: (s) => s('Close') };
//         },
//         showWarningMessage: (message: string, ...items: string[]) => {
//             if (settings.warnings) settings.warnings.push(message);
//             return { then: (s) => s('Close') };
//         },
//         showInformationMessage: (message: string, ...items: string[]) => {
//             if (settings.infos) settings.infos.push(message);
//             return { then: (s) => s('Close') };
//         },
//         getConfiguration: (key: string) => {
//             if (key !== 'vs-kubernetes') {
//                 throw 'unexpected configuration section';
//             }
//             return settings.configuration || { };
//         }
//     };
// }

// export function fs(settings: FakeFSSettings = {}): any {
//     return {
//         existsSync: (path) => (settings.existentPaths || []).indexOf(path) >= 0,
//         dirSync: (path) => (settings.onDirSync || nop)(path),
//     };
// }

// export function shell(settings: FakeShellSettings = {}): any {
//     return {
//         isWindows: () => (settings.isWindows === undefined ? true : settings.isWindows),
//         isUnix: () => (settings.isUnix === undefined ? false : settings.isUnix),
//         home: () => settings.home || (settings.isWindows ? 'z:\\home' : '/fake/path/to/home'),
//         combinePath: (b: string, r: string) => (settings.isWindows ? `${b}\\${r}` : `${b}/${r}`),
//         execCore: (cmd, opts) => fakeShellExec(settings, cmd),
//         exec: (cmd) => fakeShellExec(settings, cmd),
//     };
// }

// function fakeShellExec(settings: FakeShellSettings, cmd: string): Promise<ShellResult> {
//     const defRecognised = settings.recognisedCommands || [];
//     const matching = defRecognised.filter((c) => c.command === cmd);
//     const result = (matching.length > 0) ?
//         { code: matching[0].code, stdout: matching[0].stdout || '', stderr: matching[0].stderr || ''} :
//         settings.execCallback ?
//             settings.execCallback(cmd) :
//             { code : 9876, stdout: '', stderr: 'command was not properly faked!'};
//     return new Promise<ShellResult>((resolve, reject) => resolve(result));
// }

// export function kubectl(settings: FakeKubectlSettings = {}): any {
//     const asLines = settings.asLines || ((s: string) => []);
//     const invokeAsync = settings.invokeAsync || ((s: string) => ({ code: 0, stderr: "", stdout: ""}));
//     return {
//         asLines: async (cmd) => asLines(cmd),
//         invokeAsync: async (cmd) => invokeAsync(cmd),
//     };
// }
