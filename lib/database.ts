import {Observable, BehaviorSubject, of, from} from "rxjs";
import {IStore, Endmorphism, MaybeObservable, ICollectionOf, IItemStore, Predicate, IDatabase} from './store';
import {filter, first, switchMap, map} from "rxjs/operators";
import {v4 as uuid} from 'uuid';
import {type} from "os";

class StoreSync<StateType> implements IStore<StateType, false> {
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

class StoreAsync<StateType> implements IStore<StateType, true> {
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

class ArrayCollectionOf<T> implements ICollectionOf<T> {
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
        this.container.concat(xs.container);
        return this;
    }

}

class ItemStore<ItemType, StateType extends ArrayCollectionOf<ItemType>, IsAsync extends boolean>
    implements IItemStore<ItemType, StateType, IsAsync> {
    storeBase: StoreSync<StateType> | StoreAsync<StateType>;
    isAsync: IsAsync;

    constructor(init: StateType, isAsync: IsAsync) {
        this.isAsync = isAsync;
        this.storeBase = this.isAsync ? new StoreAsync<StateType>(init) : new StoreSync<StateType>(init);
    }

    destroy(): void {
        this.storeBase.destroy();
    }

    extend(items: StateType): MaybeObservable<IsAsync, IItemStore<ItemType, StateType, IsAsync>> {
        let fn = (xs: StateType) => {
            return xs.extend(items) as StateType;
        };
        let result = this.storeBase.dispatch(fn);
        return (this.isAsync ?
            ((result as Observable<StoreAsync<StateType>>)
                .pipe(switchMap(() => of(this))))
            : this) as MaybeObservable<IsAsync, IItemStore<ItemType, StateType, IsAsync>>;

    }

    map(fn: Endmorphism<ItemType>): MaybeObservable<IsAsync, ItemStore<ItemType, StateType, IsAsync>> {
        let fnCombine = (xs: StateType) => {
            return xs.map(fn) as StateType;
        };
        let result = this.storeBase.dispatch(fnCombine);
        return (this.isAsync ?
            ((result as Observable<StoreAsync<StateType>>).pipe(switchMap(() => of(this))))
            : this) as MaybeObservable<IsAsync, ItemStore<ItemType, StateType, IsAsync>>;
    }

    predicateMap(
        fn: Endmorphism<ItemType>,
        p: Predicate<ItemType>,
    ): MaybeObservable<IsAsync, ItemStore<ItemType, StateType, IsAsync>> {
        const fnCombine: Endmorphism<StateType> = (xs: StateType) => (xs.map(x => p(x) ? fn(x) : x) as StateType);
        const result = this.storeBase.dispatch(fnCombine);
        return (this.isAsync ?
            (result as Observable<StoreAsync<StateType>>).pipe(switchMap(() => of(this))) : this) as
            MaybeObservable<IsAsync, ItemStore<ItemType, StateType, IsAsync>>;
    }

    filter(p: Predicate<ItemType>): MaybeObservable<IsAsync, ItemStore<ItemType, StateType, IsAsync>> {
        let fnCombine: Endmorphism<StateType> = (xs: StateType) => (xs.filter(p)) as StateType;
        let result = this.storeBase.dispatch(fnCombine);
        return (this.isAsync ?
            (result as Observable<StoreAsync<StateType>>).pipe(switchMap(() => of(this))) : this) as
            MaybeObservable<IsAsync, ItemStore<ItemType, StateType, IsAsync>>;
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
        //         // if (!this.isAsync) {
        //         //     if (res != undefined) {
        //         //         return of(res);
        //         //     } else {
        //         //         return new Observable<never>();
        //         //     }
        //         // } else {
        //         //     return this.storeBase.state$.pipe(switchMap((xs: StateType) => xs.select(fn)));
        //         // }
        return this.isAsync ? this.storeBase.state$.pipe(switchMap((xs: StateType) => of(xs.select(fn)))) :
            (result ? of(result) : new Observable<never>());
    }

    findObservableMany(fn: Predicate<ItemType>): Observable<ItemType[]> {
        let result = this.findMany(fn);
        return this.isAsync ? this.storeBase.state$.pipe(switchMap((xs: StateType) => of(xs.selectMany(fn)))) :
            (result ? of(result) : new Observable<never>());
    }
}

// databaseSearchById = new DatabaseSync<SeT1>(kernel)
// databaseSearchByQuantiy = new DatabaseSync<SeT2>(kernel)
//
// databaseSearchById.search(...)

interface Id {
    id: string;
}

type Equal<op1, op2> = (x: op1, y: op2) => boolean;
type ToSearchType<ItemType, SearchType> = (x: ItemType) => SearchType;

class Database<InsertType extends Object,
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
                private updateEqual: Equal<UpdateType, ItemType>, private removeEqual: Equal<RemoveType, ItemType>,
                private toSearch: ToSearchType<ItemType, SearchType>) {
        this.dbCore = kernel;
    }

    destroy(): void {
        this.dbCore.destroy();
    }


    insert(x: InsertType): MaybeObservable<IsAsync, ItemType> {
        let id = uuid();
        let item = {id: id, ...(x as Object)} as ItemType;
        this.dbCore.extend(new ArrayCollectionOf<ItemType>([item]));
        return (this.dbCore.isAsync ? of(item) : item) as MaybeObservable<IsAsync, ItemType>;
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
        let result: (ItemType | undefined) = undefined;
        this.dbCore.filter(y => {
            if (!this.removeEqual(x, y)) {
                return true
            } else {
                result = y;
                return false
            }
        });
        return (this.dbCore.isAsync ? of(result) : result) as MaybeObservable<IsAsync, ItemType | undefined>;
    }

    removeMany(...xs: RemoveType[]): MaybeObservable<IsAsync, ItemType[]> {
        let result: ItemType[] = [];
        this.dbCore.filter(y => {
            let flag = true;
            xs.forEach(x => {
                if (this.removeEqual(x, y)) {
                    result.push(y);
                    flag = false;
                }
            });
            return flag;
        });
        return (this.dbCore.isAsync ? of(result) : result) as MaybeObservable<IsAsync, ItemType[]>;
    }

    search(fn: Predicate<SearchType>): MaybeObservable<IsAsync, ItemType | undefined> {
        return this.dbCore.find(x => fn(this.toSearch(x)));
    }

    searchMany(fn: Predicate<SearchType>): MaybeObservable<IsAsync, ItemType[]> {
        return this.dbCore.findMany(x => fn(this.toSearch(x)));
    }

    findObservable(fn: Predicate<SearchType>): Observable<ItemType> {
        return this.dbCore.findObservable(x => fn(this.toSearch(x)));
    }

    findObservableMany(fn: Predicate<SearchType>): Observable<ItemType[]> {
        return this.dbCore.findObservableMany(x => fn(this.toSearch(x)));
    }

    update(x: UpdateType): MaybeObservable<IsAsync, ItemType | undefined> {
        return (this.dbCore.isAsync ? of(this.updateKernel(x)) : this.updateKernel(x)) as
            MaybeObservable<IsAsync, ItemType | undefined>;
    }


    updateMany(...xs: UpdateType[]): MaybeObservable<IsAsync, ItemType[]> {
        let result: (ItemType|undefined)[] = [];
        // let fn = (y: ItemType) => {
        //     xs.forEach(x => {
        //         for (let key1  in Object.keys(y)) {
        //             for (let key2 in Object.keys(x)) {
        //                 if (key1 === key2) {
        //                     (<any>y)[key1] = (<any>x)[key2];
        //                 }
        //             }
        //         }
        //         result.push(y);
        //     });
        //     return y;
        // };
        // let fnEq = (y: ItemType) => {
        //     let flag = new Array<boolean>();
        //     xs.forEach(()=>flag.push(false));
        //     xs.forEach((x,index) => {
        //         if(this.updateEqual(x, y)){
        //             flag[index] = true;
        //         }
        //         return x;
        //     });
        //     if(flag.filter(x=>x===true).length===xs.length)
        //     return flag
        // };
        xs.forEach(x => {
            result.push(this.updateKernel(x))
        });
        return (this.dbCore.isAsync ? of(result) : result) as MaybeObservable<IsAsync, ItemType[]>;
    }

    upsert(x: InsertType | UpdateType): MaybeObservable<IsAsync, ItemType> {

    }

    upsertMany(...xs: (InsertType | UpdateType)[]): MaybeObservable<IsAsync, ItemType[]> {
        return undefined;
    }

    private updateKernel(x: UpdateType): ItemType | undefined {
        let result: (ItemType | undefined) = undefined;
        let fn = (y: ItemType) => {
            for (let key1  in Object.keys(y)) {
                for (let key2 in Object.keys(x)) {
                    if (key1 === key2) {
                        (<any>y)[key1] = (<any>x)[key2];
                    }
                }
            }
            result = y;
            return y;
        };
        let fnEq = (y: ItemType) => this.updateEqual(x, y);
        this.dbCore.predicateMap(fn, fnEq);
        return result;
    }

}
