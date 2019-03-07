export interface ExplorerExtender<T> {
    contributesChildren(parent?: T): boolean;
    getChildren(parent?: T): Promise<T[]>;
}

export interface ExplorerExtendable<T> {
    register(extender: ExplorerExtender<T>): void;
}
