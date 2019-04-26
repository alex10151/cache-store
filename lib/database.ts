import { Observable, BehaviorSubject, of, zip, noop, from } from "rxjs";
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
import { first, switchMap, map, filter } from "rxjs/operators";
import { v4 as uuid } from 'uuid';
import { Communicator } from "./middleware";
import { cmp } from './utils';
import 'reflect-metadata';
import *  as _ from 'lodash'

export class KEYS {
    static readonly REMOVE = 'remove';
    static readonly INSERT = 'insert';
    static readonly UPDATE = 'update';
    static readonly UPSERT = 'upsert';
}

export class FUNCTION_KEYS {
    static readonly INSERT = 'insert';
    static readonly INSERT_MANY = 'insertMany';
    static readonly REMOVE = 'remove';
    static readonly REMOVE_MANY = 'removeMany';
    static readonly UPDATE = 'update';
    static readonly UPDATE_MANY = 'updateMany';
    static readonly UPSERT = 'upsert';
    static readonly UPSERT_MANY = 'upsertMany';
}

export type MarkType = 'remove' | 'insert' | 'update' | 'upsert';

export interface marker {
    mark: MarkType;
}

export class StoreSync<StateType> implements IStore<StateType, false> {
    stateSubject: BehaviorSubject<StateType>;
    state$: Observable<StateType>;
    isAsync: false;

    constructor(initState: StateType) {
        this.stateSubject = new BehaviorSubject<StateType>(_.cloneDeep(initState));
        this.state$ = this.stateSubject.asObservable();
        this.isAsync = false;
    }

    get state() {
        return this.stateSubject.getValue();
    }

    dispatch(
        fn: Endmorphism<StateType>,
    ): StoreSync<StateType> {
        this.stateSubject.next(_.cloneDeep(fn(this.state)));
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
        this.stateSubject = new BehaviorSubject<StateType>(_.cloneDeep(initState));
        this.state$ = this.stateSubject.asObservable();
        this.isAsync = true;
    }

    dispatch(
        fn: Endmorphism<StateType>,
    ): Observable<StoreAsync<StateType>> {
        return new Observable(obs => {
            this.stateSubject.next(_.cloneDeep(fn(this.stateSubject.value)));
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
        this.container = _.cloneDeep(init);
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
        // let result = this.find(fn);
        return this.storeBase.state$.pipe(switchMap((xs: StateType) => {
            return of(xs.select(fn)).pipe(filter(x => x !== undefined)) as Observable<ItemType>;
        }));
        //  : ((result === undefined)
        //     ? (new Observable<never>(obs => obs.complete())) :
        //     (of(result) as Observable<ItemType>));
    }

    findObservableMany(fn: Predicate<ItemType>): Observable<ItemType[]> {
        // let result = this.findMany(fn);
        return this.storeBase.state$.pipe(switchMap((xs: StateType) => {
            return of(xs.selectMany(fn)).pipe(filter(xs => xs !== [])) as Observable<ItemType[]>;
        }));
        // : (((result as ItemType[]).length === 0)
        //     ? (new Observable<never>(obs => obs.complete())) :
        //     (of(result) as Observable<ItemType[]>));
    }
}

export interface Id {
    id: string;
}

export type Equal<op1, op2> = (x: op1, y: op2) => boolean;
export type ToSearchType<ItemType, SearchType> = (x: ItemType) => SearchType;
export type FromUpdateType<UpdateType, ItemType> = (x: UpdateType, y: ItemType) => ItemType;

// function getSomeValue(){
//     return (this as any).communicator.DefaultSubmitKernel(name, value)
// }

const share = (target: any, name: string, descriptor: PropertyDescriptor) => {
    let method = descriptor.value;
    descriptor.value = function fn() {
        const value = method.apply(this, arguments);
        if (((this as any).communicator !== undefined) && (this as any).isShareInfoToCommunicator) {
            (this as any).communicator.DefaultSubmitKernel(name, value);
        }
        return value;
    }
};

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
    dbCore: ItemStore<any, ArrayCollectionOf<any>, IsAsync>;
    addCommunicator: Function;
    fetchData: Function;
    communicator?: Communicator<any, any, any>;
    isShareInfoToCommunicator: boolean;
    constructor(kernel: ItemStore<any, ArrayCollectionOf<any>, IsAsync>,
        private updateEqual?: Equal<UpdateType, ItemType>,
        private removeEqual?: Equal<RemoveType, ItemType>,
        private toSearch?: ToSearchType<ItemType, SearchType>,
        private fromUpdate?: FromUpdateType<UpdateType, ItemType>,
        isShareInfoToCommunicator?: boolean
    ) {
        this.dbCore = kernel;
        this.isShareInfoToCommunicator = isShareInfoToCommunicator === undefined ? true : isShareInfoToCommunicator;
        this.addCommunicator = this.dbCore.isAsync ? noop : (communicator: Communicator<any, any, any>) => {
            this.communicator = communicator;
        };
        this.fetchData = this.dbCore.isAsync ? noop : (item: ItemType) => {
            (this.dbCore as ItemStore<ItemType, ArrayCollectionOf<ItemType>, false>)
                .storeBase.dispatch(
                    state => state.extend(new ArrayCollectionOf<ItemType>([item])));
        };

    }

    destroy(): void {
        this.dbCore.destroy();
    }
    @share
    insert(x: InsertType): MaybeObservable<IsAsync, ItemType> {
        const result = (this.insertKernel(x)) as MaybeObservable<IsAsync, ItemType>;
        return result;
    }

    @share
    insertMany(...xs: InsertType[]): MaybeObservable<IsAsync, ItemType[]> {
        let result = Array<ItemType>();
        xs.forEach(x => {
            let id = uuid();
            let item = { id: id, ...(x as Object) };
            result.push(item as ItemType);
        });
        if (!this.dbCore.isAsync) {
            this.dbCore.extend(new ArrayCollectionOf<ItemType>(result));
            return result as MaybeObservable<IsAsync, ItemType[]>;
        } else {
            return (this.dbCore.extend(new ArrayCollectionOf<ItemType>(result)) as
                Observable<ItemStore<ItemType, ArrayCollectionOf<ItemType>, IsAsync>>)
                .pipe(
                    switchMap((store: ItemStore<ItemType, ArrayCollectionOf<ItemType>, IsAsync>) => {
                        return store.findMany(
                            (x: ItemType) => {
                                return !(result.find(y => y.id === x.id) === undefined);
                            }) as Observable<ItemType[]>;
                    })) as MaybeObservable<IsAsync, ItemType[]>;
        }
    }

    @share
    remove(x: RemoveType): MaybeObservable<IsAsync, ItemType | undefined> {
        if (this.removeEqual === undefined) {
            throw new Error('removeEqual() is undefined.');
        }
        let result: (ItemType | undefined) = undefined;
        const ob = this.dbCore.filter(y => {
            if (!(this.removeEqual as Equal<RemoveType, ItemType>)(x, y)) {
                return true
            } else {
                if (!this.dbCore.isAsync)
                    result = y;
                return false
            }
        });
        return (this.dbCore.isAsync ?
            (ob as Observable<ItemStore<ItemType, ArrayCollectionOf<ItemType>, IsAsync>>)
                .pipe(switchMap(() => of(result))) : result) as MaybeObservable<IsAsync, ItemType | undefined>;
    }

    @share
    removeMany(...xs: RemoveType[]): MaybeObservable<IsAsync, ItemType[]> {
        if (this.removeEqual === undefined) {
            throw new Error('removeEqual() is undefined.');
        }
        const result: ItemType[] = [];
        const ob = this.dbCore.filter(y => {
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
            (ob as Observable<ItemStore<ItemType, ArrayCollectionOf<ItemType>, IsAsync>>)
                .pipe(switchMap(() => of(result))) : result) as MaybeObservable<IsAsync, ItemType[]>;
    }
    @share
    search(fn: Predicate<SearchType>): MaybeObservable<IsAsync, ItemType | undefined> {
        if (this.toSearch === undefined) {
            throw new Error('toSearch() is undefined.');
        }
        return this.dbCore.find(x => fn((this.toSearch as ToSearchType<ItemType, SearchType>)(x)));
    }
    @share
    searchEqualTo(x: SearchType): MaybeObservable<IsAsync, ItemType | undefined> {
        let fn = (y: SearchType) => cmp(x, y);
        return this.search(fn);
    }

    @share
    searchMany(fn: Predicate<SearchType>): MaybeObservable<IsAsync, ItemType[]> {
        if (this.toSearch === undefined) {
            throw new Error('toSearch() is undefined.');
        }
        return this.dbCore.findMany(x => fn((this.toSearch as ToSearchType<ItemType, SearchType>)(x)));
    }

    @share
    findObservable(fn: Predicate<SearchType>): Observable<ItemType> {
        if (this.toSearch === undefined) {
            throw new Error('toSearch() is undefined.');
        }
        return this.dbCore.findObservable(x => fn((this.toSearch as ToSearchType<ItemType, SearchType>)(x)));
    }
    @share
    findObservableEqualTo(x: SearchType): Observable<ItemType> {
        let fn = (y: SearchType) => cmp(x, y);
        return this.findObservable(fn);
    }
    @share
    findObservableMany(fn: Predicate<SearchType>): Observable<ItemType[]> {
        if (this.toSearch === undefined) {
            throw new Error('toSearch() is undefined.');
        }
        return this.dbCore.findObservableMany(x => fn((this.toSearch as ToSearchType<ItemType, SearchType>)(x)));
    }

    @share
    update(x: UpdateType): MaybeObservable<IsAsync, ItemType | undefined> {
        if (this.updateEqual === undefined) {
            throw new Error('updateEqual() is undefined.');
        }
        if (this.fromUpdate === undefined) {
            throw new Error('fromUpdate() is undefined.');
        }
        const result = this.updateKernel(x) as MaybeObservable<IsAsync, ItemType | undefined>;
        return result;
    }

    @share
    updateMany(...xs: UpdateType[]): MaybeObservable<IsAsync, ItemType[]> {
        if (this.updateEqual === undefined) {
            throw new Error('updateEqual() is undefined.');
        }
        if (this.fromUpdate === undefined) {
            throw new Error('fromUpdate() is undefined.');
        }

        if (this.dbCore.isAsync) {
            const xs_res = xs.map(x => this.updateKernel(x) as Observable<ItemType | undefined>);
            return zip(...xs_res) as MaybeObservable<IsAsync, ItemType[]>;

        } else {
            const result = xs.map(x => this.updateKernel(x) as ItemType);
            return result as MaybeObservable<IsAsync, ItemType[]>;
        }
    }

    @share
    upsert(x: UpdateType): MaybeObservable<IsAsync, ItemType> {
        if (this.updateEqual === undefined) {
            throw new Error('updateEqual() is undefined.');
        }
        if (this.fromUpdate === undefined) {
            throw new Error('fromUpdate() is undefined.');
        }

        if (!this.dbCore.isAsync) {
            let result = this.updateKernel(x);
            return (result === undefined ? this.insert(this.updateToInsert(x)) : result) as MaybeObservable<IsAsync, ItemType>;
        } else {
            return (this.updateKernel(x) as Observable<ItemType | undefined>).pipe(switchMap((item) => {
                return (item === undefined ? this.insert(this.updateToInsert(x)) : of(item)) as Observable<ItemType>
            })) as MaybeObservable<IsAsync, ItemType>;
        }
    }

    @share
    upsertMany(...xs: UpdateType[]): MaybeObservable<IsAsync, ItemType[]> {
        if (this.updateEqual === undefined) {
            throw new Error('updateEqual() is undefined.');
        }
        if (this.fromUpdate === undefined) {
            throw new Error('fromUpdate() is undefined.');
        }
        if (this.dbCore.isAsync) {
            return zip(xs.map(x => this.updateKernel(x) as Observable<ItemType>)).pipe(switchMap((items: ItemType[]) => zip(items.map((item, index) => {
                return (item === undefined) ? this.insertKernel(this.updateToInsert(xs[index])) : of(item)
            })))) as MaybeObservable<IsAsync, ItemType[]>;
        } else {
            const result = xs.map(x => this.updateKernel(x)).map((x, index) => {
                return (x === undefined) ? this.insertKernel(this.updateToInsert(xs[index])) : x;
            });
            return result as MaybeObservable<IsAsync, ItemType[]>;
        }
    }

    private updateToInsert(x: UpdateType): InsertType {
        let result = {} as InsertType;

        result = { ...x, ...result };
        return result;
    }

    private updateKernel(x: UpdateType): (ItemType | undefined) | Observable<ItemType | undefined> {
        let result: (ItemType | undefined) = undefined;
        let fn = (y: ItemType) => {
            result = (this.fromUpdate as FromUpdateType<UpdateType, ItemType>)(x, y);
            return result;
        };
        let fnEq = (y: ItemType) => (this.updateEqual as Equal<UpdateType, ItemType>)(x, y);
        if (this.dbCore.isAsync)
            return (this.dbCore
                .predicateMap(fn, fnEq) as
                Observable<ItemStore<ItemType, ArrayCollectionOf<ItemType>, IsAsync>>)
                .pipe(
                    switchMap(
                        (store: ItemStore<ItemType, ArrayCollectionOf<ItemType>, IsAsync>) => (result === undefined) ?
                            new Observable<undefined>(undefined) :
                            store.find(x => x.id === (result as ItemType).id) as Observable<ItemType | undefined>));
        else {
            this.dbCore.predicateMap(fn, fnEq);
            return result;
        }
    }

    private insertKernel(x: InsertType): ItemType | Observable<ItemType | undefined> {
        let id = uuid();
        let item = { id: id, ...x } as ItemType;
        if (this.dbCore.isAsync)
            return (this.dbCore
                .extend(new ArrayCollectionOf<ItemType>([item])) as
                Observable<ItemStore<ItemType, ArrayCollectionOf<ItemType>, IsAsync>>)
                .pipe(switchMap((store: ItemStore<ItemType, ArrayCollectionOf<ItemType>, IsAsync>) => store.find(x => x.id === id) as Observable<ItemType | undefined>));
        else {
            this.dbCore.extend(new ArrayCollectionOf<ItemType>([item]));
            return item;
        }

    }
}

