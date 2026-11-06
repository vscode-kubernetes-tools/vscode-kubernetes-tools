import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as net from 'net';
import * as path from 'path';
import { shellEnvironment } from './shell';
import { showWorkspaceFolderPick } from './hostutils';
import { Dictionary } from './utils/dictionary';

export interface Host {
    showErrorMessage(message: string, ...items: string[]): Thenable<string | undefined>;
    showWarningMessage(message: string, ...items: string[]): Thenable<string | undefined>;
    showInformationMessage(message: string, ...items: string[]): Thenable<string | undefined>;
    showInputBox(options: vscode.InputBoxOptions, token?: vscode.CancellationToken): Thenable<string | undefined>;
    showQuickPick(items: string[], options: vscode.QuickPickOptions): Thenable<string | undefined>;
    showQuickPick<T extends vscode.QuickPickItem>(items: T[], options: vscode.QuickPickOptions): Thenable<T | undefined>;
    withProgress<R>(task: (progress: vscode.Progress<{ message?: string }>) => Thenable<R>): Thenable<R>;
    getConfiguration(key: string): any;
    createTerminal(name?: string, shellPath?: string, shellArgs?: string[], iconPath?: vscode.ThemeIcon): vscode.Terminal;
    runProcessInTerminal(options: ProcessTerminalOptions, signal?: AbortSignal): Promise<ProcessTerminalExecution>;
    onDidCloseTerminal(listener: (e: vscode.Terminal) => any): vscode.Disposable;
    onDidChangeConfiguration(listener: (ch: vscode.ConfigurationChangeEvent) => any): vscode.Disposable;
    activeDocument(): vscode.TextDocument | undefined;
    showDocument(uri: vscode.Uri): Promise<vscode.TextDocument>;
    readDocument(uri: vscode.Uri): Promise<vscode.TextDocument>;
    selectRootFolder(): Promise<string | undefined>;
    longRunning<T>(uiOptions: string | LongRunningUIOptions, action: () => Promise<T>): Promise<T>;
}

export const host: Host = {
    showErrorMessage : showErrorMessage,
    showWarningMessage : showWarningMessage,
    showInformationMessage : showInformationMessage,
    showQuickPick : showQuickPickAny,
    withProgress: withProgress,
    getConfiguration : getConfiguration,
    createTerminal : createTerminal,
    runProcessInTerminal: runProcessInTerminal,
    onDidCloseTerminal : onDidCloseTerminal,
    onDidChangeConfiguration : onDidChangeConfiguration,
    showInputBox : showInputBox,
    activeDocument : activeDocument,
    showDocument : showDocument,
    readDocument : readDocument,
    selectRootFolder : selectRootFolder,
    longRunning : longRunning
};

export interface LongRunningUIOptions {
    readonly title: string;
    readonly operationKey?: string;
}

export interface ProcessTerminalOptions {
    readonly name: string;
    readonly executable: string;
    readonly args: readonly string[];
    readonly cwd?: string;
    readonly env?: NodeJS.ProcessEnv;
}

export interface ProcessTerminalExecution {
    readonly completed: Promise<void>;
    terminate(): void;
}

function showInputBox(options: vscode.InputBoxOptions, token?: vscode.CancellationToken): Thenable<string | undefined> {
    return vscode.window.showInputBox(options, token);
}

function showErrorMessage(message: string, ...items: string[]): Thenable<string | undefined> {
    return vscode.window.showErrorMessage(message, ...items);
}

function showWarningMessage(message: string, ...items: string[]): Thenable<string | undefined> {
    return vscode.window.showWarningMessage(message, ...items);
}

function showInformationMessage(message: string, ...items: string[]): Thenable<string | undefined> {
    return vscode.window.showInformationMessage(message, ...items);
}

function showQuickPickStr(items: string[], options?: vscode.QuickPickOptions): Thenable<string | undefined> {
    return vscode.window.showQuickPick(items, options);
}

function showQuickPickT<T extends vscode.QuickPickItem>(items: T[], options?: vscode.QuickPickOptions): Thenable<T | undefined> {
    return vscode.window.showQuickPick(items, options);
}

function showQuickPickAny(items: any, options: vscode.QuickPickOptions): any {
    if (!Array.isArray(items)) {
        throw 'unexpected type passed to showQuickPick';
    }

    if (items.length === 0) {
        return showQuickPickStr(items, options);
    }

    const item = items[0];
    if (typeof item === 'string' || item instanceof String) {
        return showQuickPickStr(items, options);
    } else {
        return showQuickPickT(items, options);
    }
}

function withProgress<R>(task: (progress: vscode.Progress<{ message?: string }>) => Thenable<R>): Thenable<R> {
    return vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, task);
}

function getConfiguration(key: string): any {
    return vscode.workspace.getConfiguration(key);
}

function createTerminal(name?: string, shellPath?: string, shellArgs?: string[], iconPath?: vscode.ThemeIcon): vscode.Terminal {
    const terminalOptions = {
        name: name,
        shellPath: shellPath,
        shellArgs: shellArgs,
        env: shellEnvironment(process.env),
        iconPath: iconPath
    };
    return vscode.window.createTerminal(terminalOptions);
}

export interface ProcessTerminalLaunch {
    readonly terminalOptions: vscode.TerminalOptions;
    readonly started: Promise<void>;
    dispose(): void;
}

export async function createProcessTerminalLaunch(options: ProcessTerminalOptions): Promise<ProcessTerminalLaunch> {
    const payload = Buffer.from(JSON.stringify(await processTerminalPayload(options)), 'utf8');
    if (payload.length > 16 * 1024 * 1024) {
        throw new Error('The process terminal invocation exceeded the 16 MiB limit.');
    }
    const token = crypto.randomBytes(32).toString('base64url');
    const tokenBuffer = Buffer.from(token, 'utf8');
    const sockets = new Set<net.Socket>();
    let resolveStarted!: () => void;
    let rejectStarted!: (error: Error) => void;
    let settled = false;
    let disposed = false;
    let transportClosed = false;
    let startupTimer: NodeJS.Timeout | undefined;
    const started = new Promise<void>((resolve, reject) => {
        resolveStarted = resolve;
        rejectStarted = reject;
    });
    const server = net.createServer((socket) => {
        sockets.add(socket);
        let authenticated = false;
        let authentication = Buffer.alloc(0);
        socket.setTimeout(5000, () => socket.destroy(new Error('Process terminal authentication timed out.')));
        socket.on('data', (chunk: Buffer) => {
            if (authenticated || disposed) {
                return;
            }
            authentication = Buffer.concat([authentication, chunk]);
            const newline = authentication.indexOf(0x0a);
            if (newline < 0) {
                if (authentication.length > tokenBuffer.length) {
                    socket.destroy();
                }
                return;
            }
            const supplied = authentication.subarray(0, newline);
            if (newline !== authentication.length - 1 || supplied.length !== tokenBuffer.length ||
                !crypto.timingSafeEqual(supplied, tokenBuffer)) {
                socket.destroy();
                return;
            }
            authenticated = true;
            const header = Buffer.allocUnsafe(4);
            header.writeUInt32BE(payload.length);
            socket.end(Buffer.concat([header, payload]));
            sockets.delete(socket);
            succeed();
        });
        socket.on('error', (error) => {
            if (authenticated) {
                fail(error);
            }
        });
        socket.on('close', () => {
            sockets.delete(socket);
            if (authenticated && !settled) {
                fail(new Error('The process terminal payload connection closed early.'));
            }
        });
    });
    const closeTransport = () => {
        if (transportClosed) {
            return;
        }
        transportClosed = true;
        if (startupTimer) {
            clearTimeout(startupTimer);
            startupTimer = undefined;
        }
        server.close();
        sockets.forEach((socket) => socket.destroy());
        sockets.clear();
    };
    const succeed = () => {
        if (settled || disposed) {
            return;
        }
        settled = true;
        closeTransport();
        resolveStarted();
    };
    const fail = (error: Error) => {
        if (settled) {
            return;
        }
        settled = true;
        closeTransport();
        rejectStarted(error);
    };
    await new Promise<void>((resolve, reject) => {
        const onError = (error: Error) => {
            server.off('listening', onListening);
            reject(error);
        };
        const onListening = () => {
            server.off('error', onError);
            resolve();
        };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(0, '127.0.0.1');
    });
    server.on('error', fail);
    startupTimer = setTimeout(() => fail(new Error('Timed out starting the process terminal.')), 10000);
    startupTimer.unref();
    const address = server.address();
    if (!address || typeof address === 'string') {
        fail(new Error('Unable to allocate the process terminal payload channel.'));
        await started;
        throw new Error('unreachable');
    }
    return {
        terminalOptions: {
            name: options.name,
            ...processTerminalRunner(address.port, token),
            strictEnv: true,
            isTransient: true,
        },
        started,
        dispose: () => {
            disposed = true;
            fail(new Error('The process terminal was disposed before startup.'));
            closeTransport();
        },
    };
}

async function runProcessInTerminal(options: ProcessTerminalOptions, signal?: AbortSignal): Promise<ProcessTerminalExecution> {
    if (signal?.aborted) {
        throw new Error('Process terminal launch cancelled.');
    }
    const launch = await createProcessTerminalLaunch(options);
    if (signal?.aborted) {
        launch.dispose();
        await launch.started.catch(() => {});
        throw new Error('Process terminal launch cancelled.');
    }
    let terminal: vscode.Terminal | undefined;
    let closeListener: vscode.Disposable | undefined;
    let resolveCompleted!: () => void;
    let settled = false;
    const completed = new Promise<void>((resolve) => { resolveCompleted = resolve; });
    const complete = () => {
        closeListener?.dispose();
        closeListener = undefined;
        signal?.removeEventListener('abort', terminate);
        launch.dispose();
        if (settled) {
            return;
        }
        settled = true;
        resolveCompleted();
    };
    const terminate = () => {
        try {
            terminal?.dispose();
        } finally {
            complete();
        }
    };
    signal?.addEventListener('abort', terminate, { once: true });
    try {
        if (signal?.aborted) {
            throw new Error('Process terminal launch cancelled.');
        }
        terminal = vscode.window.createTerminal(launch.terminalOptions);
        closeListener = vscode.window.onDidCloseTerminal((closedTerminal) => {
            if (closedTerminal === terminal) {
                complete();
            }
        });
        if (signal?.aborted) {
            throw new Error('Process terminal launch cancelled.');
        }
        terminal.show();
        await launch.started;
        if (signal?.aborted) {
            throw new Error('Process terminal launch cancelled.');
        }
        return {
            completed,
            terminate,
        };
    } catch (error) {
        terminate();
        await launch.started.catch(() => {});
        if (signal?.aborted) {
            throw new Error('Process terminal launch cancelled.');
        }
        throw error;
    }
}

interface ProcessTerminalPayload {
    readonly executable: string;
    readonly args: readonly string[];
    readonly cwd: string;
    readonly env: Readonly<Record<string, string>>;
}

const POSIX_PROCESS_TERMINAL_CHILD = [
    'set -m',
    'exec 6>&1 7>&2',
    'exec 1>/dev/null 2>/dev/null',
    '"$@" 1>&6 2>&7 4>&- 6>&- 7>&- &',
    'group=$!',
    'printf "%s\\n" "$group" >&4',
    'exec 3<&- 4>&- 5>&- 6>&- 7>&-',
    'fg %1 >/dev/null 2>&1',
    'status=$?',
    'kill -KILL -- "-$group" 2>/dev/null || true',
    'exit "$status"',
].join('\n');

const POSIX_PROCESS_TERMINAL_GUARDIAN = [
    'const fs=require("fs");',
    'const {spawn}=require("child_process");',
    'let cleaning=false;let reported=false;',
    'const fail=(error)=>{try{console.error(error.message)}catch{};report(1);cleanup("SIGTERM",250);};',
    'const report=(code)=>{if(reported)return;reported=true;try{fs.writeSync(5,String(code)+"\\n")}catch{}};',
    'const signalGroup=(signal)=>{try{process.kill(-process.pid,signal)}catch(error){if(error.code!=="ESRCH")try{console.error(error.message)}catch{}}};',
    'const cleanup=(signal,delay)=>{if(cleaning)return;cleaning=true;signalGroup(signal);setTimeout(()=>signalGroup("SIGKILL"),delay);};',
    'for(const signal of ["SIGHUP","SIGINT","SIGQUIT","SIGTERM"])process.on(signal,()=>cleanup(signal,2000));',
    'const readExactly=(buffer)=>{let offset=0;while(offset<buffer.length){const count=fs.readSync(3,buffer,offset,buffer.length-offset,null);if(count<=0)throw new Error("Process terminal payload closed early.");offset+=count;}};',
    'try{',
    'const header=Buffer.alloc(4);readExactly(header);const length=header.readUInt32BE(0);if(length>16*1024*1024)throw new Error("Process terminal payload was too large.");',
    'const body=Buffer.alloc(length);readExactly(body);const payload=JSON.parse(body.toString("utf8"));',
    'const lease=()=>fs.read(3,Buffer.alloc(1),0,1,null,(error,count)=>{if(error||count===0)cleanup("SIGHUP",2000);else lease()});lease();',
    'const target=spawn(payload.executable,payload.args,{cwd:payload.cwd,env:payload.env,shell:false,stdio:"inherit",windowsHide:true});',
    'target.once("error",fail);target.once("close",(code)=>{report(code??1);cleanup("SIGTERM",250)});',
    '}catch(error){fail(error);}',
].join('');

const PROCESS_TERMINAL_RUNNER = [
    'const net=require("net");',
    'const {spawn}=require("child_process");',
    'const connection=JSON.parse(Buffer.from(process.argv[1],"base64url").toString("utf8"));',
    'const token=process.env.VSCODE_KUBERNETES_PROCESS_TOKEN;const persist=process.env.VSCODE_KUBERNETES_PROCESS_PERSIST==="1";delete process.env.VSCODE_KUBERNETES_PROCESS_TOKEN;delete process.env.VSCODE_KUBERNETES_PROCESS_PERSIST;delete process.env.ELECTRON_RUN_AS_NODE;',
    'let child;let group;let expected;let received=Buffer.alloc(0);let groupStatus="";let exitStatus="";',
    'let failed=false;',
    'let cancelled=false;',
    'let cleaning=false;',
    'let cleanupDone=false;',
    'let childClosed=false;',
    'let finished=false;',
    'let exitAfterChild=false;',
    'let cleanupTimer;',
    'const signalGroup=(signal)=>{if(!group)return false;try{process.kill(-group,signal);return true;}catch(error){if(error.code==="ESRCH")return false;fail(error);return false;}};',
    'const complete=()=>{if(finished||!childClosed||!cleanupDone)return;finished=true;if(exitAfterChild||!persist)process.exit();else if(process.stdin.isTTY&&process.stdout.isTTY)process.stdin.resume();};',
    'let cleanupSignal;const cleanGroup=(signal)=>{cleanupSignal||=signal;if(cleaning||!group)return;cleaning=true;if(!signalGroup(cleanupSignal))child.kill("SIGKILL");cleanupTimer=setTimeout(()=>{if(!childClosed&&!signalGroup("SIGKILL"))child.kill("SIGKILL");},persist?4000:250);};',
    'const forward=(signal,exit)=>{exitAfterChild||=exit;if(finished){if(exit)process.exit();return;}if(!child){cancelled=true;process.exit();return;}if(!persist){if(child.exitCode===null&&child.signalCode===null){child.kill(signal);const timer=setTimeout(()=>{if(child.exitCode===null&&child.signalCode===null)child.kill("SIGKILL");},2000);timer.unref();}return;}cleanGroup(signal);};',
    'process.on("SIGINT",()=>forward("SIGINT",false));',
    'process.on("SIGTERM",()=>forward("SIGTERM",true));',
    'if(process.platform!=="win32")process.on("SIGHUP",()=>forward("SIGHUP",true));',
    'const fail=(error)=>{failed=true;console.error(error.message);process.exitCode=1;};',
    'const start=(payload)=>{if(cancelled)return;if(!persist){child=spawn(payload.executable,payload.args,{cwd:payload.cwd,env:payload.env,shell:false,stdio:"inherit",windowsHide:true});child.once("error",fail);child.once("close",(code)=>{childClosed=true;cleanupDone=true;process.exitCode=failed?1:(code??1);complete();});return;}child=spawn("/bin/sh",["-i","-c",process.argv[2],"process-terminal",process.execPath,"-e",process.argv[3]],{cwd:payload.cwd,env:{PATH:"/usr/bin:/bin",ELECTRON_RUN_AS_NODE:"1"},shell:false,stdio:["inherit","inherit","inherit","pipe","pipe","pipe"],windowsHide:true});child.stdio[3].on("error",(error)=>{if(error.code!=="EPIPE")fail(error)});const body=Buffer.from(JSON.stringify(payload),"utf8");const header=Buffer.alloc(4);header.writeUInt32BE(body.length);child.stdio[3].write(Buffer.concat([header,body]));child.stdio[4].setEncoding("utf8");child.stdio[4].on("data",(chunk)=>{const newline=(groupStatus+=chunk).indexOf("\\n");if(newline<0)return;const value=groupStatus.slice(0,newline);groupStatus=groupStatus.slice(newline+1);if(group===undefined){group=Number(value);if(!Number.isSafeInteger(group)||group<=0){fail(new Error("Invalid process terminal group."));child.kill("SIGKILL");return;}if(cleanupSignal)cleanGroup(cleanupSignal);}});child.stdio[5].setEncoding("utf8");child.stdio[5].on("data",(chunk)=>{const newline=(exitStatus+=chunk).indexOf("\\n");if(newline<0)return;const value=exitStatus.slice(0,newline);exitStatus=exitStatus.slice(newline+1);const code=Number(value);if(!Number.isSafeInteger(code)||code<0||code>255)fail(new Error("Invalid process terminal exit status."));else process.exitCode=code;cleanGroup("SIGTERM");});child.once("error",fail);child.once("close",(code)=>{childClosed=true;cleanupDone=true;clearTimeout(cleanupTimer);child.stdio[3].destroy();if(process.exitCode===undefined)process.exitCode=failed?1:(code??1);complete();});};',
    'if(!token)throw new Error("Missing process terminal token.");',
    'const socket=net.createConnection({host:"127.0.0.1",port:connection.port});',
    'socket.setTimeout(10000,()=>socket.destroy(new Error("Process terminal payload timed out.")));',
    'socket.once("connect",()=>socket.write(token+"\\n"));',
    'socket.on("data",(chunk)=>{received=Buffer.concat([received,chunk]);if(expected===undefined&&received.length>=4){expected=received.readUInt32BE(0);if(expected>16*1024*1024){socket.destroy(new Error("Process terminal payload was too large."));return;}}if(expected!==undefined&&received.length>=expected+4){const body=received.subarray(4,expected+4);socket.removeAllListeners();socket.end();try{start(JSON.parse(body.toString("utf8")));}catch(error){fail(error);}}});',
    'socket.once("error",fail);',
].join('');

const WINDOWS_PROCESS_TERMINAL_CONSOLE = [
    'using System;using System.Diagnostics;using System.Runtime.InteropServices;using System.Collections.Generic;',
    'public static class ProcessTerminalConsole{',
    '[StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]struct StartupInfo{public int size;public string reserved,desktop,title;public int x,y,xSize,ySize,xChars,yChars,fill,flags;public short show,reservedSize;public IntPtr reservedBytes,input,output,error;}',
    '[StructLayout(LayoutKind.Sequential)]struct ProcessInfo{public IntPtr process,thread;public int processId,threadId;}',
    '[DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern IntPtr CreateFile(string name,uint access,uint share,IntPtr security,uint creation,uint flags,IntPtr template);',
    '[DllImport("kernel32.dll")]static extern IntPtr GetStdHandle(int id);',
    '[DllImport("kernel32.dll",SetLastError=true)]static extern bool SetHandleInformation(IntPtr handle,uint mask,uint flags);',
    '[DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool CreateProcess(string application,System.Text.StringBuilder command,IntPtr processSecurity,IntPtr threadSecurity,bool inherit,uint flags,IntPtr environment,string directory,ref StartupInfo startup,out ProcessInfo process);',
    '[DllImport("kernel32.dll",SetLastError=true)]static extern uint WaitForSingleObject(IntPtr handle,uint timeout);',
    '[DllImport("kernel32.dll",SetLastError=true)]static extern bool GetExitCodeProcess(IntPtr handle,out uint code);',
    '[DllImport("kernel32.dll")]static extern bool CloseHandle(IntPtr handle);',
    'static Exception Error(){return new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());}',
    'public static int Run(ProcessStartInfo start,bool interactive){',
    'if(!interactive){using(Process child=Process.Start(start)){child.WaitForExit();return child.ExitCode;}}',
    'IntPtr input=CreateFile("CONIN$",0xC0000000,3,IntPtr.Zero,3,0,IntPtr.Zero);if(input==new IntPtr(-1))throw Error();',
    'IntPtr environment=IntPtr.Zero;ProcessInfo process=new ProcessInfo();',
    'try{',
    'if(!SetHandleInformation(input,1,1))throw Error();',
    'StartupInfo startup=new StartupInfo();startup.size=Marshal.SizeOf(typeof(StartupInfo));startup.flags=0x100;startup.input=input;startup.output=GetStdHandle(-11);startup.error=GetStdHandle(-12);',
    'List<string> keys=new List<string>();foreach(string key in start.EnvironmentVariables.Keys)keys.Add(key);keys.Sort(StringComparer.OrdinalIgnoreCase);',
    'System.Text.StringBuilder block=new System.Text.StringBuilder();foreach(string key in keys){block.Append(key).Append("=").Append(start.EnvironmentVariables[key]).Append((char)0);}block.Append((char)0);environment=Marshal.StringToHGlobalUni(block.ToString());',
    'System.Text.StringBuilder command=new System.Text.StringBuilder();command.Append((char)34).Append(start.FileName).Append((char)34).Append(" ").Append(start.Arguments);',
    'if(!CreateProcess(start.FileName,command,IntPtr.Zero,IntPtr.Zero,true,0x400,environment,start.WorkingDirectory,ref startup,out process))throw Error();',
    'if(WaitForSingleObject(process.process,0xFFFFFFFF)!=0)throw Error();uint code;if(!GetExitCodeProcess(process.process,out code))throw Error();return unchecked((int)code);',
    '}finally{if(process.thread!=IntPtr.Zero)CloseHandle(process.thread);if(process.process!=IntPtr.Zero)CloseHandle(process.process);if(environment!=IntPtr.Zero)Marshal.FreeHGlobal(environment);CloseHandle(input);}',
    '}}',
].join('');

const WINDOWS_PROCESS_TERMINAL_RUNNER = [
    '$ErrorActionPreference="Stop"',
    '$env:PSModulePath=$PSHOME+"\\Modules"',
    // .NET Process.Start replaces stdin with its cached managed handle. Supply
    // CONIN$ directly through native STARTUPINFO for children in the real terminal.
    `Add-Type -TypeDefinition '${WINDOWS_PROCESS_TERMINAL_CONSOLE}'`,
    'function Read-Exactly($Stream,[byte[]]$Buffer){$offset=0;while($offset -lt $Buffer.Length){$read=$Stream.Read($Buffer,$offset,$Buffer.Length-$offset);if($read -le 0){throw "Process terminal payload closed early."};$offset+=$read}}',
    String.raw`function Quote-Argument([string]$Value){if($Value.Length -gt 0 -and $Value -notmatch '[\s"]'){return $Value};$builder=New-Object System.Text.StringBuilder;[void]$builder.Append('"');$slashes=0;foreach($character in $Value.ToCharArray()){if($character -eq '\'){$slashes++;continue};if($character -eq '"'){[void]$builder.Append(('\' * ($slashes*2+1)));[void]$builder.Append('"');$slashes=0;continue};if($slashes){[void]$builder.Append(('\' * $slashes));$slashes=0};[void]$builder.Append($character)};if($slashes){[void]$builder.Append(('\' * ($slashes*2)))};[void]$builder.Append('"');return $builder.ToString()}`,
    '$port=[int]$env:VSCODE_KUBERNETES_PROCESS_PORT;$token=$env:VSCODE_KUBERNETES_PROCESS_TOKEN;$persist=$env:VSCODE_KUBERNETES_PROCESS_PERSIST -eq "1";Remove-Item Env:VSCODE_KUBERNETES_PROCESS_PORT,Env:VSCODE_KUBERNETES_PROCESS_TOKEN,Env:VSCODE_KUBERNETES_PROCESS_PERSIST -ErrorAction SilentlyContinue',
    '$client=New-Object System.Net.Sockets.TcpClient;$client.Connect("127.0.0.1",$port);$stream=$client.GetStream();$authentication=[System.Text.Encoding]::UTF8.GetBytes($token+"`n");$stream.Write($authentication,0,$authentication.Length)',
    '$header=New-Object byte[] 4;Read-Exactly $stream $header;$length=[System.Net.IPAddress]::NetworkToHostOrder([System.BitConverter]::ToInt32($header,0));if($length -lt 0 -or $length -gt 16777216){throw "Process terminal payload was too large."};$body=New-Object byte[] $length;Read-Exactly $stream $body;$client.Dispose();$payload=ConvertFrom-Json ([System.Text.Encoding]::UTF8.GetString($body))',
    '$start=New-Object System.Diagnostics.ProcessStartInfo;$start.FileName=[string]$payload.executable;$start.Arguments=(($payload.args|ForEach-Object { Quote-Argument ([string]$_) }) -join " ");$start.WorkingDirectory=[string]$payload.cwd;$start.UseShellExecute=$false;$start.CreateNoWindow=$false;$start.EnvironmentVariables.Clear();$payload.env.PSObject.Properties|ForEach-Object {$start.EnvironmentVariables[$_.Name]=[string]$_.Value}',
    '$exitCode=[ProcessTerminalConsole]::Run($start,$persist);if(-not $persist){exit $exitCode};while($true){Start-Sleep -Seconds 3600}',
].join(';');

const WINDOWS_PROCESS_TERMINAL_ENVIRONMENT = /^(?:ALLUSERSPROFILE|APPDATA|CommonProgramFiles(?:\(x86\)|\(Arm\))?|CommonProgramW6432|COMPUTERNAME|DriverData|HOMEDRIVE|HOMEPATH|LOCALAPPDATA|LOGONSERVER|NUMBER_OF_PROCESSORS|OS|PROCESSOR_(?:ARCHITECTURE|ARCHITEW6432|IDENTIFIER|LEVEL|REVISION)|ProgramData|ProgramFiles(?:\(x86\)|\(Arm\))?|ProgramW6432|PUBLIC|SESSIONNAME|SystemDrive|TEMP|TMP|USERDNSDOMAIN|USERNAME|USERDOMAIN(?:_ROAMINGPROFILE)?|USERPROFILE)$/i;

export function processTerminalRunnerArgs(port: number): string[] {
    return [
        '-e',
        PROCESS_TERMINAL_RUNNER,
        Buffer.from(JSON.stringify({ port })).toString('base64url'),
        POSIX_PROCESS_TERMINAL_CHILD,
        POSIX_PROCESS_TERMINAL_GUARDIAN,
    ];
}

function processTerminalRunner(port: number, token: string): Pick<vscode.TerminalOptions, 'shellPath' | 'shellArgs' | 'cwd' | 'env'> {
    if (process.platform !== 'win32') {
        return {
            shellPath: process.execPath,
            shellArgs: processTerminalRunnerArgs(port),
            cwd: path.parse(process.execPath).root,
            env: {
                ELECTRON_RUN_AS_NODE: '1',
                VSCODE_KUBERNETES_PROCESS_PERSIST: '1',
                VSCODE_KUBERNETES_PROCESS_TOKEN: token,
            },
        };
    }
    const systemRoot = process.env.SystemRoot || process.env.SYSTEMROOT || process.env.windir || process.env.WINDIR;
    if (!systemRoot) {
        throw new Error('Unable to determine the Windows system directory.');
    }
    const powershell = path.win32.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    return {
        shellPath: powershell,
        shellArgs: ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(WINDOWS_PROCESS_TERMINAL_RUNNER, 'utf16le').toString('base64')],
        cwd: path.win32.parse(powershell).root,
        env: processTerminalEnvironment(token, port, systemRoot),
    };
}

async function processTerminalPayload(options: ProcessTerminalOptions): Promise<ProcessTerminalPayload> {
    const cwd = options.cwd || process.cwd();
    const env = definedEnvironment(options.env || process.env);
    let executable = options.executable;
    // CreateProcess searches the wrapper's PATH, not the environment supplied to
    // the child. Resolve against the execution environment before restricting it.
    if (process.platform === 'win32' && !/[\\/]/.test(executable) && !path.win32.isAbsolute(executable)) {
        const searchPath = Object.entries(env).find(([key]) => key.toLowerCase() === 'path')?.[1] || '';
        const directories = searchPath.split(';').filter(Boolean);
        const names = path.win32.extname(executable) ? [executable] : [executable, `${executable}.exe`];
        let resolved: string | undefined;
        for (const directory of directories) {
            for (const name of names) {
                const candidate = path.win32.resolve(cwd, directory.replace(/^"(.*)"$/, '$1'), name);
                if (await fs.promises.stat(candidate).then((stat) => stat.isFile(), () => false)) {
                    resolved = candidate;
                    break;
                }
            }
            if (resolved) {
                break;
            }
        }
        if (!resolved) {
            throw new Error(`Unable to find process terminal executable: ${executable}`);
        }
        executable = resolved;
    }
    return {
        executable,
        args: [...options.args],
        cwd,
        env,
    };
}

function processTerminalEnvironment(token: string, port: number, systemRoot: string): Record<string, string> {
    const environment: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined && WINDOWS_PROCESS_TERMINAL_ENVIRONMENT.test(key)) {
            environment[key] = value;
        }
    }
    const powershellRoot = path.win32.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0');
    environment.SystemRoot = systemRoot;
    environment.windir = systemRoot;
    environment.Path = [path.win32.join(systemRoot, 'System32'), systemRoot, powershellRoot].join(';');
    environment.PATHEXT = '.COM;.EXE;.BAT;.CMD';
    environment.ComSpec = path.win32.join(systemRoot, 'System32', 'cmd.exe');
    environment.PSModulePath = path.win32.join(powershellRoot, 'Modules');
    environment.VSCODE_KUBERNETES_PROCESS_PERSIST = '1';
    environment.VSCODE_KUBERNETES_PROCESS_PORT = String(port);
    environment.VSCODE_KUBERNETES_PROCESS_TOKEN = token;
    return environment;
}

function definedEnvironment(environment: NodeJS.ProcessEnv): Record<string, string> {
    return Object.fromEntries(
        Object.entries(environment).filter((entry): entry is [string, string] => entry[1] !== undefined)
    );
}

function onDidCloseTerminal(listener: (e: vscode.Terminal) => any): vscode.Disposable {
    return vscode.window.onDidCloseTerminal(listener);
}

function onDidChangeConfiguration(listener: (e: vscode.ConfigurationChangeEvent) => any): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration(listener);
}

function activeDocument(): vscode.TextDocument | undefined {
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
        return activeEditor.document;
    }
    return undefined;
}

async function showDocument(uri: vscode.Uri): Promise<vscode.TextDocument> {
    const document = await vscode.workspace.openTextDocument(uri);
    if (document) {
        await vscode.window.showTextDocument(document);
    }
    return document;
}

async function readDocument(uri: vscode.Uri): Promise<vscode.TextDocument> {
    return await vscode.workspace.openTextDocument(uri);
}

async function selectRootFolder(): Promise<string | undefined> {
    const folder = await showWorkspaceFolderPick();
    if (!folder) {
        return undefined;
    }
    if (folder.uri.scheme !== 'file') {
        vscode.window.showErrorMessage("This command requires a filesystem folder");  // TODO: make it not
        return undefined;
    }
    return folder.uri.fsPath;
}

const ACTIVE_LONG_RUNNING_OPERATIONS = Dictionary.of<boolean>();

async function longRunning<T>(uiOptions: string | LongRunningUIOptions, action: () => Promise<T>): Promise<T> {
    const uiOptionsObj = uiOptionsObjectOf(uiOptions);
    const options = {
        location: vscode.ProgressLocation.Notification,
        title: uiOptionsObj.title
    };
    return await underLongRunningOperationKeyGuard(uiOptionsObj.operationKey, async (alreadyShowingUI) =>
        alreadyShowingUI ?
            await action() :
            await vscode.window.withProgress(options, (_) => action())
    );
}

async function underLongRunningOperationKeyGuard<T>(operationKey: string | undefined, action: (alreadyShowingUI: boolean) => Promise<T>): Promise<T> {
    const alreadyShowingUI = !!operationKey && (ACTIVE_LONG_RUNNING_OPERATIONS[operationKey] || false);
    if (operationKey) {
        ACTIVE_LONG_RUNNING_OPERATIONS[operationKey] = true;
    }
    try {
        const result = await action(alreadyShowingUI);
        return result;
    } finally {
        if (operationKey) {
            delete ACTIVE_LONG_RUNNING_OPERATIONS[operationKey];
        }
    }
}

function uiOptionsObjectOf(uiOptions: string | LongRunningUIOptions): LongRunningUIOptions {
    if (isLongRunningUIOptions(uiOptions)) {
        return uiOptions;
    }
    return { title: uiOptions };
}

function isLongRunningUIOptions(obj: string | LongRunningUIOptions): obj is LongRunningUIOptions {
    return !!((obj as LongRunningUIOptions).title);
}
