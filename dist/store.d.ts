import { Observable } from "rxjs";
export declare type Either<P extends boolean, T, F> = P extends true ? T : F;
export declare type MaybeObservable<P extends boolean, T> = Either<P, Observable<T>, T>;
export declare function toEither<P extends boolean, T, F>(p: P, tfn: () => T, ffn: () => F): Either<P, T, F>;
export declare type Endmorphism<T> = (x: T) => T;
export declare type Predicate<T> = (x: T) => boolean;
export interface IStore<StateType, IsAsync extends boolean> {
    dispatch(fn: Endmorphism<StateType>): MaybeObservable<IsAsync, IStore<StateType, IsAsync>>;
    readonly state$: Observable<StateType>;
    readonly isAsync: IsAsync;
    destroy(): void;
}
export interface ICollectionOf<T> {
    map(fn: Endmorphism<T>): ICollectionOf<T>;
    filter(p: Predicate<T>): ICollectionOf<T>;
    extend(xs: ICollectionOf<T>): ICollectionOf<T>;
    select(fn: (x: T) => boolean): T | undefined;
    selectMany(fn: (x: T) => boolean): T[];
}
export interface IItemStore<ItemType, StateType extends ICollectionOf<ItemType>, IsAsync extends boolean> {
    readonly isAsync: IsAsync;
    extend(items: StateType): MaybeObservable<IsAsync, IItemStore<ItemType, StateType, IsAsync>>;
    map(fn: Endmorphism<ItemType>): MaybeObservable<IsAsync, IItemStore<ItemType, StateType, IsAsync>>;
    predicateMap(fn: Endmorphism<ItemType>, p: Predicate<ItemType>): MaybeObservable<IsAsync, IItemStore<ItemType, StateType, IsAsync>>;
    filter(fn: Predicate<ItemType>): MaybeObservable<IsAsync, IItemStore<ItemType, StateType, IsAsync>>;
    find(fn: Predicate<ItemType>): MaybeObservable<IsAsync, ItemType | undefined>;
    findMany(fn: Predicate<ItemType>): MaybeObservable<IsAsync, ItemType[]>;
    findObservable(fn: Predicate<ItemType>): Observable<ItemType>;
    findObservableMany(fn: Predicate<ItemType>): Observable<ItemType[]>;
}
export interface IDatabase<InsertType, UpdateType, RemoveType, SearchType, ItemType, IsAsync extends boolean> {
    insert(x: InsertType): MaybeObservable<IsAsync, ItemType>;
    update(x: UpdateType): MaybeObservable<IsAsync, ItemType | undefined>;
    upsert(x: UpdateType): MaybeObservable<IsAsync, ItemType>;
    remove(x: RemoveType): MaybeObservable<IsAsync, ItemType | undefined>;
    search(fn: Predicate<SearchType>): MaybeObservable<IsAsync, ItemType | undefined>;
    findObservable(fn: Predicate<SearchType>): Observable<ItemType>;
    insertMany(...xs: InsertType[]): MaybeObservable<IsAsync, ItemType[]>;
    upsertMany(...xs: UpdateType[]): MaybeObservable<IsAsync, ItemType[]>;
    updateMany(...xs: UpdateType[]): MaybeObservable<IsAsync, ItemType[]>;
    removeMany(...xs: RemoveType[]): MaybeObservable<IsAsync, ItemType[]>;
    searchMany(fn: Predicate<SearchType>): MaybeObservable<IsAsync, ItemType[]>;
    findObservableMany(fn: Predicate<SearchType>): Observable<ItemType[]>;
}
declare type WithId<T, IdType> = T & IdType;
export interface IDatabaseWithIdProxy<ModelType, IdType, IsAsync extends boolean> extends IDatabase<ModelType, WithId<ModelType, IdType>, IdType, IdType, WithId<ModelType, IdType>, IsAsync> {
}
export {};
