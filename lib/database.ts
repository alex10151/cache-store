import {Observable, BehaviorSubject, of, from, never, noop} from "rxjs";
import {
    IStore,
    Endmorphism,
    MaybeObservable,
    ICollectionOf,
    IItemStore,
    Predicate,
    IDatabase,
    toEither,
    Either
} from './store';
import {first, switchMap, map} from "rxjs/operators";
import {v4 as uuid} from 'uuid';

export class StoreSync<StateType> implements IStore<StateType, false> {
    stateSubject: BehaviorSubject<StateType>;
    state$: Observable<StateType>;
    isAsync: false;

    constructor(initState: StateType) {
        this.stateSubject = new BehaviorSubject<StateType>(initState);
        this.state$ = this.stateSubject.asObservable();
        this.isAsync = false;
    }

    get state() {
        return this.stateSubject.getValue();
    }

    dispatch(
        fn: Endmorphism<StateType>,
    ): StoreSync<StateType> {
        this.stateSubject.next(fn(this.state));
        return this;
    };

    destroy(): void {
        this.stateSubject.complete();
    };
}

export class StoreAsync<StateType> implements IStore<StateType, true> {
    stateSubject: BehaviorSubject<StateType>;
    state$: Observable<StateType>;
    isAsync: true;

    constructor(initState: StateType) {
        this.stateSubject = new BehaviorSubject<StateType>(initState);
        this.state$ = this.stateSubject.asObservable();
        this.isAsync = true;
    }

    dispatch(
        fn: Endmorphism<StateType>,
    ): Observable<StoreAsync<StateType>> {
        return new Observable(obs => {
            this.stateSubject.next(fn(this.stateSubject.value));
            obs.next(this);
            obs.complete();
        })
    };

    destroy(): void {
        this.stateSubject.complete();
    };
}

export class ArrayCollectionOf<T> implements ICollectionOf<T> {
    container: Array<T>;

    constructor(init: Array<T>) {
        this.container = init;
    }

    map(fn: Endmorphism<T>): ArrayCollectionOf<T> {
        return new ArrayCollectionOf<T>(this.container.map(fn));
    }

    filter(p: Predicate<T>): ArrayCollectionOf<T> {
        return new ArrayCollectionOf<T>(this.container.filter(p));
    }

    select(fn: (x: T) => boolean): T | undefined {
        return this.container.find(x => fn(x));
    }

    selectMany(fn: (x: T) => boolean): T[] {
        return this.container.filter(fn);
    }

    extend(xs: ArrayCollectionOf<T>): ArrayCollectionOf<T> {
        this.container = [...this.container, ...xs.container];
        return this;
    }

}

export class ItemStore<ItemType, StateType extends ArrayCollectionOf<ItemType>, IsAsync extends boolean>
    implements IItemStore<ItemType, StateType, IsAsync> {
    storeBase: Either<IsAsync, StoreAsync<StateType>, StoreSync<StateType>>;

    readonly isAsync: IsAsync;

    constructor(init: StateType, isAsync: IsAsync) {
        this.isAsync = isAsync;
        this.storeBase = toEither(isAsync, () => new StoreAsync<StateType>(init), () => new StoreSync<StateType>(init));
    }

    destroy(): void {
        this.storeBase.destroy();
    }

    private toReturn(x: StoreSync<StateType> | Observable<StoreAsync<StateType>>): MaybeObservable<IsAsync, this> {
        return toEither(
            this.isAsync,
            () => (x as Observable<StoreAsync<StateType>>).pipe(switchMap(() => of(this))),
            () => this,
        );
    }

    extend(items: StateType): MaybeObservable<IsAsync, ItemStore<ItemType, StateType, IsAsync>> {
        let fn = (xs: StateType) => {
            return xs.extend(items) as StateType;
        };
        return this.toReturn(this.storeBase.dispatch(fn));

    }

    map(fn: Endmorphism<ItemType>): MaybeObservable<IsAsync, ItemStore<ItemType, StateType, IsAsync>> {
        const fnCombine = (xs: StateType) => {
            return xs.map(fn) as StateType;
        };
        return this.toReturn(this.storeBase.dispatch(fnCombine));
    }

    predicateMap(
        fn: Endmorphism<ItemType>,
        p: Predicate<ItemType>,
    ): MaybeObservable<IsAsync, ItemStore<ItemType, StateType, IsAsync>> {
        const fnCombine: Endmorphism<StateType> = (xs: StateType) => (xs.map(x => p(x) ? fn(x) : x) as StateType);
        return this.toReturn(this.storeBase.dispatch(fnCombine));
    }

    filter(p: Predicate<ItemType>): MaybeObservable<IsAsync, ItemStore<ItemType, StateType, IsAsync>> {
        let fnCombine: Endmorphism<StateType> = (xs: StateType) => (xs.filter(p)) as StateType;
        return this.toReturn(this.storeBase.dispatch(fnCombine));
    }

    find(fn: Predicate<ItemType>): MaybeObservable<IsAsync, ItemType | undefined> {
        let target: (ItemType | undefined) | Observable<ItemType | undefined> = undefined;
        let fnCombine: Endmorphism<StateType> = (xs: StateType) => {
            target = xs.select(fn);
            return xs;
        };
        if (!this.isAsync) {
            (this.storeBase as StoreSync<StateType>).dispatch(fnCombine);
            return target as MaybeObservable<IsAsync, ItemType | undefined>;
        } else {
            return (this.storeBase as StoreAsync<StateType>).state$
                .pipe(
                    map((xs: StateType) => xs.select(fn)),
                    first()
                ) as MaybeObservable<IsAsync, ItemType | undefined>;
        }

    }

    findMany(fn: Predicate<ItemType>): MaybeObservable<IsAsync, ItemType[]> {
        let target: (ItemType[]) | Observable<ItemType[]> = [];
        let fnCombine: Endmorphism<StateType> = (xs: StateType) => {
            target = xs.selectMany(fn);
            return xs;
        };
        if (!this.isAsync) {
            (this.storeBase as StoreSync<StateType>).dispatch(fnCombine);
            return target as MaybeObservable<IsAsync, ItemType[]>;
        } else {
            return (this.storeBase as StoreAsync<StateType>).state$
                .pipe(
                    map((xs: StateType) => xs.selectMany(fn)),
                    first()
                ) as MaybeObservable<IsAsync, ItemType[]>;
        }
    }

    findObservable(fn: Predicate<ItemType>): Observable<ItemType> {
        let result = this.find(fn);
        return this.isAsync ? this.storeBase.state$.pipe(switchMap((xs: StateType) => {
            return of(xs.select(fn)) as Observable<ItemType>;
        })) : ((result === undefined)
            ? (new Observable<never>(obs => obs.complete())) :
            (of(result) as Observable<ItemType>));
    }

    findObservableMany(fn: Predicate<ItemType>): Observable<ItemType[]> {
        let result = this.findMany(fn);
        return this.isAsync ? this.storeBase.state$.pipe(switchMap((xs: StateType) => {
            return of(xs.selectMany(fn)) as Observable<ItemType[]>;
        })) : (((result as ItemType[]).length === 0)
            ? (new Observable<never>(obs => obs.complete())) :
            (of(result) as Observable<ItemType[]>));
    }
}

export interface Id {
    id: string;
}

export type Equal<op1, op2> = (x: op1, y: op2) => boolean;
export type ToSearchType<ItemType, SearchType> = (x: ItemType) => SearchType;

export class Database<InsertType extends Object,
    UpdateType extends Object,
    RemoveType extends Object,
    SearchType extends Object,
    ItemType extends Id & UpdateType & RemoveType & SearchType & InsertType,
    IsAsync extends boolean> implements IDatabase<InsertType,
    UpdateType,
    RemoveType,
    SearchType,
    ItemType,
    IsAsync> {
    dbCore: ItemStore<ItemType, ArrayCollectionOf<ItemType>, IsAsync>;

    constructor(kernel: ItemStore<ItemType, ArrayCollectionOf<ItemType>, IsAsync>,
                private updateEqual?: Equal<UpdateType, ItemType>, private removeEqual?: Equal<RemoveType, ItemType>,
                private toSearch?: ToSearchType<ItemType, SearchType>) {
        this.dbCore = kernel;
    }

    destroy(): void {
        this.dbCore.destroy();
    }


    insert(x: InsertType): MaybeObservable<IsAsync, ItemType> {
        return (this.dbCore.isAsync ? of(this.insertKernel(x)) : this.insertKernel(x)) as MaybeObservable<IsAsync, ItemType>;
    }

    insertMany(...xs: InsertType[]): MaybeObservable<IsAsync, ItemType[]> {
        let result = Array<ItemType>();
        xs.forEach(x => {
            let id = uuid();
            let item = {id: id, ...(x as Object)};
            result.push(item as ItemType);
        });
        this.dbCore.extend(new ArrayCollectionOf<ItemType>(result));
        return (this.dbCore.isAsync ? of(result) : result) as MaybeObservable<IsAsync, ItemType[]>;
    }

    remove(x: RemoveType): MaybeObservable<IsAsync, ItemType | undefined> {
        if (this.removeEqual === undefined) {
            throw new Error('removeEqual() is undefined.');
        }
        let result: (ItemType | undefined) = undefined;
        this.dbCore.filter(y => {
            if (!(this.removeEqual as Equal<RemoveType, ItemType>)(x, y)) {
                return true
            } else {
                result = y;
                return false
            }
        });
        return (this.dbCore.isAsync ?
            ((result === undefined) ?
                new Observable<never>() : of(result)) : result) as MaybeObservable<IsAsync, ItemType | undefined>;
    }

    removeMany(...xs: RemoveType[]): MaybeObservable<IsAsync, ItemType[]> {
        if (this.removeEqual === undefined) {
            throw new Error('removeEqual() is undefined.');
        }
        let result: ItemType[] = [];
        this.dbCore.filter(y => {
            let flag = true;
            xs.forEach(x => {
                if ((this.removeEqual as Equal<RemoveType, ItemType>)(x, y)) {
                    result.push(y);
                    flag = false;
                }
            });
            return flag;
        });
        return (this.dbCore.isAsync ?
            ((result === []) ? new Observable<never>() : of(result)) : result) as MaybeObservable<IsAsync, ItemType[]>;
    }

    search(fn: Predicate<SearchType>): MaybeObservable<IsAsync, ItemType | undefined> {
        if (this.toSearch === undefined) {
            throw new Error('toSearch() is undefined.');
        }
        return this.dbCore.find(x => fn((this.toSearch as ToSearchType<ItemType, SearchType>)(x)));
    }

    searchMany(fn: Predicate<SearchType>): MaybeObservable<IsAsync, ItemType[]> {
        if (this.toSearch === undefined) {
            throw new Error('toSearch() is undefined.');
        }
        return this.dbCore.findMany(x => fn((this.toSearch as ToSearchType<ItemType, SearchType>)(x)));
    }

    findObservable(fn: Predicate<SearchType>): Observable<ItemType> {
        if (this.toSearch === undefined) {
            throw new Error('toSearch() is undefined.');
        }
        return this.dbCore.findObservable(x => fn((this.toSearch as ToSearchType<ItemType, SearchType>)(x)));
    }

    findObservableMany(fn: Predicate<SearchType>): Observable<ItemType[]> {
        if (this.toSearch === undefined) {
            throw new Error('toSearch() is undefined.');
        }
        return this.dbCore.findObservableMany(x => fn((this.toSearch as ToSearchType<ItemType, SearchType>)(x)));
    }

    update(x: UpdateType): MaybeObservable<IsAsync, ItemType | undefined> {
        if (this.updateEqual === undefined) {
            throw new Error('updateEqual() is undefined.');
        }
        return (this.dbCore.isAsync ?
            ((this.updateKernel(x) === undefined) ? new Observable<never>() : of(this.updateKernel(x)))
            : this.updateKernel(x)) as MaybeObservable<IsAsync, ItemType | undefined>;
    }


    updateMany(...xs: UpdateType[]): MaybeObservable<IsAsync, ItemType[]> {
        if (this.updateEqual === undefined) {
            throw new Error('updateEqual() is undefined.');
        }
        let result: (ItemType | undefined)[] = [];
        xs.forEach(x => {
            result.push(this.updateKernel(x))
        });
        return (this.dbCore.isAsync ?
            ((result === []) ? new Observable<never>() : of(result)) : result) as MaybeObservable<IsAsync, ItemType[]>;
    }

    upsert(x: UpdateType): MaybeObservable<IsAsync, ItemType> {
        if (this.updateEqual === undefined) {
            throw new Error('updateEqual() is undefined.');
        }
        let result = this.updateKernel(x);
        return (result === undefined) ?
            this.insert(this.updateToInsert(x)) :
            ((this.dbCore.isAsync) ? of(result) : result) as MaybeObservable<IsAsync, ItemType>;
    }

    upsertMany(...xs: UpdateType[]): MaybeObservable<IsAsync, ItemType[]> {
        if (this.updateEqual === undefined) {
            throw new Error('updateEqual() is undefined.');
        }
        const result = xs.map(x => this.updateKernel(x)).map((x, index) => {
            return (x === undefined) ? this.insertKernel(this.updateToInsert(xs[index])) : x;
        });
        return (this.dbCore.isAsync ? of(result) : result) as MaybeObservable<IsAsync, ItemType[]>;
    }

    private updateToInsert(x: UpdateType): InsertType {
        let result = {} as InsertType;
        // for (let key1 in Object.keys(x)) {
        //     for (let key2 in Object.keys(result)) {
        //         if (key1 === key2) {
        //             (<any>result)[key2] = (<any>x)[key1];
        //         }
        //     }
        // }
        result = {...x, ...result};
        return result;
    }

    private updateKernel(x: UpdateType): ItemType | undefined {
        let result: (ItemType | undefined) = undefined;
        let fn = (y: ItemType) => {
            // for (let key1  in Object.keys(y)) {
            //     for (let key2 in Object.keys(x)) {
            //         if (key1 === key2) {
            //             (<any>y)[key1] = (<any>x)[key2];
            //         }
            //     }
            // }
            result = {...y, ...x};
            return result;
        };
        let fnEq = (y: ItemType) => (this.updateEqual as Equal<UpdateType, ItemType>)(x, y);
        this.dbCore.predicateMap(fn, fnEq);
        return result;
    }

    private insertKernel(x: InsertType): ItemType {
        let id = uuid();
        let item = {id: id, ...x} as ItemType;
        this.dbCore.extend(new ArrayCollectionOf<ItemType>([item]));
        return item;
    }
}
