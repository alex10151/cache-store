import {Observable, BehaviorSubject, of, from} from "rxjs";
import {distinctUntilChanged} from 'rxjs/operators';

export type MaybeObservable<IsAsync extends boolean, T> = IsAsync extends false
    ? T
    : Observable<T>;

export type Endmorphism<T> = (x: T) => T;
export type Predicate<T> = (x: T) => boolean;

// General Store, provide seperated write(dispatch), read(state), watch(state$)
export interface IStore<StateType, IsAsync extends boolean> {
    dispatch(
        fn: Endmorphism<StateType>,
    ): MaybeObservable<IsAsync, IStore<StateType, IsAsync>>;

    readonly state$: Observable<StateType>;
    readonly isAsync: IsAsync;

    destroy(): void;
}

// At first, we may use CollectionOf<T> = T[]
export interface ICollectionOf<T> {
    map(fn: Endmorphism<T>): ICollectionOf<T>;

    filter(p: Predicate<T>): ICollectionOf<T>;

    extend(xs: ICollectionOf<T>): ICollectionOf<T>;

    select(fn: (x: T) => boolean): T | undefined;

    selectMany(fn: (x: T) => boolean): T[];
}

// Collection-like store
export interface IItemStore<ItemType,
    StateType extends ICollectionOf<ItemType>,
    IsAsync extends boolean> {
    // Implement using Store<StateType, IsAsync>
    // State level operations, for operations () => ItemType, i.e. insert
    readonly isAsync: IsAsync;

    extend(items: StateType): MaybeObservable<IsAsync,IItemStore<ItemType, StateType, IsAsync>>;

    // Item level operations
    map(
        fn: Endmorphism<ItemType>,
    ): MaybeObservable<IsAsync, IItemStore<ItemType, StateType, IsAsync>>;

    predicateMap(
        fn: Endmorphism<ItemType>,
        p: Predicate<ItemType>,
    ): MaybeObservable<IsAsync, IItemStore<ItemType, StateType, IsAsync>>;

    filter(
        fn: Predicate<ItemType>,
    ): MaybeObservable<IsAsync, IItemStore<ItemType, StateType, IsAsync>>;

    // Read methods
    find(fn: Predicate<ItemType>): MaybeObservable<IsAsync, ItemType | undefined>;

    findMany(fn: Predicate<ItemType>): MaybeObservable<IsAsync, ItemType[]>;

    findObservable(fn: Predicate<ItemType>): Observable<ItemType>;

    findObservableMany(fn: Predicate<ItemType>): Observable<ItemType[]>;
}

// NAME: subscription or subscribe or watch?

export interface IDatabase<InsertType,
    UpdateType,
    RemoveType,
    SearchType,
    ItemType,
    IsAsync extends boolean> {
    // Implement based on ItemStore<ItemType, StateType, IsAsync>
    // In general, equality comperators (a: UpdateType, b: ItemType): boolean, (a: RemoveType, b: ItemType): boolean need to be provided
    // This three functions maybe helpful

    insert(x: InsertType): MaybeObservable<IsAsync, ItemType>;

    update(x: UpdateType): MaybeObservable<IsAsync, ItemType|undefined>;

    upsert(x: InsertType | UpdateType): MaybeObservable<IsAsync, ItemType>;

    remove(x: RemoveType): MaybeObservable<IsAsync, ItemType|undefined >;

    search(fn: Predicate<SearchType>): MaybeObservable<IsAsync, ItemType|undefined >;

    findObservable(fn: Predicate<SearchType>): Observable<ItemType>;

    insertMany(...xs: InsertType[]): MaybeObservable<IsAsync, ItemType[]>;

    upsertMany(
        ...xs: (InsertType | UpdateType)[]
    ): MaybeObservable<IsAsync, ItemType[]>;

    updateMany(...xs: UpdateType[]): MaybeObservable<IsAsync, ItemType[]>;

    removeMany(...xs: RemoveType[]): MaybeObservable<IsAsync, ItemType[]>;

    searchMany(fn: Predicate<SearchType>): MaybeObservable<IsAsync, ItemType[]>;

    findObservableMany(fn: Predicate<SearchType>): Observable<ItemType[]>;

}

type WithId<T, IdType> = T & IdType;

export interface IDatabaseWithIdProxy<ModelType, IdType, IsAsync extends boolean>
    extends IDatabase<ModelType,
        WithId<ModelType, IdType>,
        IdType,
        IdType,
        WithId<ModelType, IdType>,
        IsAsync> {
}

// export class StoreOld<T> {
//   private subject: BehaviorSubject<T[]>;
//   readonly state$: Observable<T[]>;
//   constructor(
//     initailState: T[] = [],
//     private eq: (a: T, b: T) => boolean = (a: T, b: T) => a === b,
//   ) {
//     this.subject = new BehaviorSubject<T[]>(initailState);
//     this.state$ = this.subject.asObservable();
//   }
//   map(fn: (s: T[]) => T[]) {
//     return this.subject.next(fn(this.subject.value));
//   }
//   insert(...values: T[]) {
//     return this.map((state) => [...state, ...values]);
//   }
//   update(...values: T[]) {
//     const result = values.reduce(
//       (xs, v) => {
//         return xs.map((x) => (this.eq(x, v) ? v : x));
//       },
//       [...this.subject.value],
//     );
//     this.subject.next(result);
//   }
//   upsert(...values: T[]) {
//     const result = values.reduce(
//       (xs, v) => {
//         return xs.some((x) => this.eq(x, v))
//           ? xs.map((x) => (this.eq(x, v) ? v : x))
//           : [...xs, v];
//       },
//       [...this.subject.value],
//     );
//     this.subject.next(result);
//   }
//   delete(...values: T[]) {
//     const result = values.reduce(
//       (xs, v) => {
//         return xs.filter((x) => !this.eq(x, v));
//       },
//       [...this.subject.value],
//     );
//     this.subject.next(result);
//   }
//   get state() {
//     return this.subject.value;
//   }
//   set state(newState: T[]) {
//     this.subject.next(newState);
//   }
//   destory() {
//     this.subject.complete();
//   }
// }
