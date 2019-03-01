import { Observable, BehaviorSubject } from "rxjs";
import { IStore, Endmorphism, MaybeObservable, ICollectionOf, IItemStore, Predicate, IDatabase, Either } from './store';
export declare class StoreSync<StateType> implements IStore<StateType, false> {
    stateSubject: BehaviorSubject<StateType>;
    state$: Observable<StateType>;
    isAsync: false;
    constructor(initState: StateType);
    readonly state: StateType;
    dispatch(fn: Endmorphism<StateType>): StoreSync<StateType>;
    destroy(): void;
}
export declare class StoreAsync<StateType> implements IStore<StateType, true> {
    stateSubject: BehaviorSubject<StateType>;
    state$: Observable<StateType>;
    isAsync: true;
    constructor(initState: StateType);
    dispatch(fn: Endmorphism<StateType>): Observable<StoreAsync<StateType>>;
    destroy(): void;
}
export declare class ArrayCollectionOf<T> implements ICollectionOf<T> {
    container: Array<T>;
    constructor(init: Array<T>);
    map(fn: Endmorphism<T>): ArrayCollectionOf<T>;
    filter(p: Predicate<T>): ArrayCollectionOf<T>;
    select(fn: (x: T) => boolean): T | undefined;
    selectMany(fn: (x: T) => boolean): T[];
    extend(xs: ArrayCollectionOf<T>): ArrayCollectionOf<T>;
}
export declare class ItemStore<ItemType, StateType extends ArrayCollectionOf<ItemType>, IsAsync extends boolean> implements IItemStore<ItemType, StateType, IsAsync> {
    storeBase: Either<IsAsync, StoreAsync<StateType>, StoreSync<StateType>>;
    readonly isAsync: IsAsync;
    constructor(init: StateType, isAsync: IsAsync);
    destroy(): void;
    private toReturn;
    extend(items: StateType): MaybeObservable<IsAsync, ItemStore<ItemType, StateType, IsAsync>>;
    map(fn: Endmorphism<ItemType>): MaybeObservable<IsAsync, ItemStore<ItemType, StateType, IsAsync>>;
    predicateMap(fn: Endmorphism<ItemType>, p: Predicate<ItemType>): MaybeObservable<IsAsync, ItemStore<ItemType, StateType, IsAsync>>;
    filter(p: Predicate<ItemType>): MaybeObservable<IsAsync, ItemStore<ItemType, StateType, IsAsync>>;
    find(fn: Predicate<ItemType>): MaybeObservable<IsAsync, ItemType | undefined>;
    findMany(fn: Predicate<ItemType>): MaybeObservable<IsAsync, ItemType[]>;
    findObservable(fn: Predicate<ItemType>): Observable<ItemType>;
    findObservableMany(fn: Predicate<ItemType>): Observable<ItemType[]>;
}
export interface Id {
    id: string;
}
export declare type Equal<op1, op2> = (x: op1, y: op2) => boolean;
export declare type ToSearchType<ItemType, SearchType> = (x: ItemType) => SearchType;
export declare class Database<InsertType extends Object, UpdateType extends Object, RemoveType extends Object, SearchType extends Object, ItemType extends Id & UpdateType & RemoveType & SearchType & InsertType, IsAsync extends boolean> implements IDatabase<InsertType, UpdateType, RemoveType, SearchType, ItemType, IsAsync> {
    private updateEqual?;
    private removeEqual?;
    private toSearch?;
    dbCore: ItemStore<ItemType, ArrayCollectionOf<ItemType>, IsAsync>;
    constructor(kernel: ItemStore<ItemType, ArrayCollectionOf<ItemType>, IsAsync>, updateEqual?: Equal<UpdateType, ItemType> | undefined, removeEqual?: Equal<RemoveType, ItemType> | undefined, toSearch?: ToSearchType<ItemType, SearchType> | undefined);
    destroy(): void;
    insert(x: InsertType): MaybeObservable<IsAsync, ItemType>;
    insertMany(...xs: InsertType[]): MaybeObservable<IsAsync, ItemType[]>;
    remove(x: RemoveType): MaybeObservable<IsAsync, ItemType | undefined>;
    removeMany(...xs: RemoveType[]): MaybeObservable<IsAsync, ItemType[]>;
    search(fn: Predicate<SearchType>): MaybeObservable<IsAsync, ItemType | undefined>;
    searchMany(fn: Predicate<SearchType>): MaybeObservable<IsAsync, ItemType[]>;
    findObservable(fn: Predicate<SearchType>): Observable<ItemType>;
    findObservableMany(fn: Predicate<SearchType>): Observable<ItemType[]>;
    update(x: UpdateType): MaybeObservable<IsAsync, ItemType | undefined>;
    updateMany(...xs: UpdateType[]): MaybeObservable<IsAsync, ItemType[]>;
    upsert(x: UpdateType): MaybeObservable<IsAsync, ItemType>;
    upsertMany(...xs: UpdateType[]): MaybeObservable<IsAsync, ItemType[]>;
    private updateToInsert;
    private updateKernel;
    private insertKernel;
}
