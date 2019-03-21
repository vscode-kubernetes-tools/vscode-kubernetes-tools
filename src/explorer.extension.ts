export interface ExplorerExtender<T> {
    contributesChildren(parent?: T): boolean;
    getChildren(parent?: T): Promise<T[]>;
}
