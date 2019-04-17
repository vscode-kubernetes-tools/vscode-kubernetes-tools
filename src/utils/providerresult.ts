import * as vscode from 'vscode';

export function append<T>(first: vscode.ProviderResult<T[]>, ...rest: Thenable<T[]>[]): vscode.ProviderResult<T[]> {
    if (isThenable(first)) {
        return appendAsync(first, ...rest);
    } else {
        return appendSyncAsync(first, ...rest);
    }
}

export function transform<T>(obj: T | Thenable<T>, f: (t: T) => void): T | Thenable<T> {
    if (isThenableStrict(obj)) {
        return transformThenable(obj, f);
    }
    f(obj);
    return obj;
}

export function map<T, U>(source: vscode.ProviderResult<T[]>, f: (t: T) => U): U[] | vscode.ProviderResult<U[]> {
    if (isThenable(source)) {
        return mapThenable(source, f);
    }
    if (!source) {
        return source;
    }
    return source.map(f);
}

function isThenable<T>(r: vscode.ProviderResult<T>): r is Thenable<T | null | undefined> {
    return !!((r as Thenable<T>).then);
}

function isThenableStrict<T>(r: T | Thenable<T>): r is Thenable<T> {
    return !!((r as Thenable<T>).then);
}

async function appendAsync<T>(first: Thenable<T[] | null | undefined>, ...rest: Thenable<T[]>[]): Promise<T[]> {
    return appendSyncAsync(await first, ...rest);
}

async function appendSyncAsync<T>(first: T[] | null | undefined, ...rest: Thenable<T[]>[]): Promise<T[]> {
    const f = first || [];
    const r = await Promise.all(rest);
    return f.concat(...r);
}

async function transformThenable<T>(obj: Thenable<T>, f: (t: T) => void): Promise<T> {
    f(await obj);
    return obj;
}

async function mapThenable<T, U>(obj: Thenable<T[] | null | undefined>, f: (t: T) => U): Promise<U[] | null | undefined> {
    const sequence = await obj;
    if (!sequence) {
        return sequence;
    }
    return sequence.map(f);
}
