import { ArrayCollectionOf, Database, ItemStore, Id, marker, KEYS, FUNCTION_KEYS, Equal, FromUpdateType } from "./database";
import { BehaviorSubject, interval, Observable, of, Subscription, noop, Subject } from "rxjs";
import { switchMap, concatAll, map, filter, distinctUntilChanged, tap, takeUntil } from "rxjs/operators";
import { IDatabase, Predicate } from "./store";
import * as _ from 'lodash';

interface IMiddleWare<BlockType extends Id, DBSync extends ItemStore<BlockType, ArrayCollectionOf<BlockType>, false>,
    DBAsync extends IDatabase<any, any, any, any, any, true>> {
    connect(): BehaviorSubject<any>;

    destroy(): void;

    updateKernelAsync(item: Array<BlockType & marker>): void;

    updateKernelSync(item: any, updateEqual: Equal<BlockType, BlockType>, fromUpdate: FromUpdateType<BlockType, BlockType>): any;
}
//db Async generic type must be the same ?
export class Communicator<BlockType extends Id, DBSyncKernel extends ItemStore<BlockType, ArrayCollectionOf<BlockType>, false>,
    DBAsync extends IDatabase<any, BlockType, BlockType, BlockType, BlockType, true>>
    implements IMiddleWare<BlockType, DBSyncKernel, DBAsync> {
    taskSubject: BehaviorSubject<Array<BlockType & marker>>;
    taskObservable: Observable<Array<BlockType & marker>>;

    taskToSubmit: Array<BlockType & marker>;
    sigToRelease: Subject<any>;
    sigToReleaseForTask: Subject<any>;

    defaultUpdateEqual = ((x: any, y: any) => (x.type === y.type) && (x.id === y.id)) as Equal<BlockType, BlockType>;
    defaultFromUpdate = ((x: any, y: any) => { return { ...y, ...x } }) as FromUpdateType<BlockType, BlockType>;
    constructor(private dbSyncKernel: DBSyncKernel, private dbAsync: DBAsync) {
        this.taskToSubmit = [];
        this.sigToRelease = new Subject();
        this.sigToReleaseForTask = new Subject();
        this.taskSubject = new BehaviorSubject<Array<BlockType & marker>>(this.taskToSubmit);
        this.taskObservable = this.taskSubject.asObservable();
    }

    DefaultSubmitKernel(type: string, value: any) {
        switch (type) {
            case FUNCTION_KEYS.INSERT: {
                return this.submit({ ...value, mark: KEYS.INSERT });
            }
            case FUNCTION_KEYS.INSERT_MANY: {
                return (value as Array<any>).forEach(x => this.submit({ ...x, mark: KEYS.INSERT }));
            }
            case FUNCTION_KEYS.REMOVE: {
                return this.submit({ ...value, mark: KEYS.REMOVE });
            }
            case FUNCTION_KEYS.REMOVE_MANY: {
                return (value as Array<any>).forEach(x => this.submit({ ...x, mark: KEYS.REMOVE }));
            }
            case FUNCTION_KEYS.UPDATE: {
                return this.submit({ ...value, mark: KEYS.UPDATE });
            }
            case FUNCTION_KEYS.UPDATE_MANY: {
                return (value as Array<any>).forEach(x => this.submit({ ...x, mark: KEYS.UPDATE }));
            }
            case FUNCTION_KEYS.UPSERT: {
                return this.submit({ ...value, mark: KEYS.UPSERT });
            }
            case FUNCTION_KEYS.UPSERT_MANY: {
                return (value as Array<any>).forEach(x => this.submit({ ...x, mark: KEYS.UPSERT }));
            }
            default:
                return undefined;
        }
    };

    destroy() {
        this.taskSubject.complete();
        this.sigToRelease.next();
        this.sigToReleaseForTask.next();
    }

    connect(): BehaviorSubject<Array<BlockType & marker>> {
        this.taskObservable.pipe(
            map(tasks => _.cloneDeep(tasks),
                takeUntil(this.sigToRelease))).subscribe((tasks) => {
                    if (tasks.length) {
                        this.updateKernelAsync(tasks);
                    }
                }, console.error);
        return this.taskSubject;
    }

    autoTimeIntervalWatch(timeInterval: number) {
        return interval(timeInterval).pipe(
            tap(() => this.taskSubject.next(this.taskToSubmit),
                takeUntil(this.sigToRelease),
            ),
        );
    }

    preload(itemOrFn: BlockType | Function, updateEqual = this.defaultUpdateEqual, fromUpdate = this.defaultFromUpdate): Observable<any> {
        return this.updateKernelSync(itemOrFn, updateEqual, fromUpdate);
    }

    submit(task: BlockType & marker) {
        this.taskToSubmit.push(task);
    }

    private taskResolve(task: BlockType & marker): Observable<BlockType | undefined> {
        const { mark, ...residual } = task;
        switch (mark) {
            case KEYS.REMOVE: {
                return this.dbAsync.remove(residual as Exclude<BlockType & marker, marker>);
            }
            case KEYS.INSERT: {
                return this.dbAsync.insert(residual as Exclude<BlockType & marker, marker>);
            }
            case KEYS.UPDATE: {
                return this.dbAsync.update(residual as Exclude<BlockType & marker, marker>);
            }
            case KEYS.UPSERT: {
                return this.dbAsync.upsert(residual as Exclude<BlockType & marker, marker>);
            }
            default:
                throw new Error('task type not identified.');
        }
    }

    updateKernelAsync(tasks: Array<BlockType & marker>): void {
        console.log('on solving the tasks', this.taskToSubmit);
        this.taskToSubmit.splice(0, this.taskToSubmit.length);
        of(...tasks.map(task => this.taskResolve(task))).pipe(concatAll(), takeUntil(this.sigToReleaseForTask)).subscribe(
            noop, console.error);
    }
    updateKernelSync(itemOrFn: BlockType | Function, updateEqual: Equal<BlockType, BlockType>, fromUpdate: FromUpdateType<BlockType, BlockType>): Observable<any> {
        const dbInterface = new Database<BlockType, BlockType, any, any, BlockType, false>(this.dbSyncKernel, updateEqual, undefined, undefined, fromUpdate, false);
        const obs = (typeof (itemOrFn) === 'function') ? this.dbAsync.search(itemOrFn as Predicate<BlockType>) : this.dbAsync.searchEqualTo(itemOrFn as BlockType);

        return obs.pipe(map((item: BlockType | undefined) => { return item === undefined ? item : dbInterface.upsert(item) }));
    }
    //can be applied to Rest DB?
    // forceSynchronizeDB(): void {
    //     (this.dbAsync).dbCore.storeBase.dispatch(state => {
    //         state.container.splice(0, state.container.length);
    //         this.dbSyncKernel.storeBase.state.container.forEach(item => state.container.push(item));
    //         return state;
    //     }).subscribe(noop, console.error);
    // }
}