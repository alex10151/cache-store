"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const rxjs_1 = require("rxjs");
const store_1 = require("./store");
const operators_1 = require("rxjs/operators");
const uuid_1 = require("uuid");
class StoreSync {
    constructor(initState) {
        this.stateSubject = new rxjs_1.BehaviorSubject(initState);
        this.state$ = this.stateSubject.asObservable();
        this.isAsync = false;
    }
    get state() {
        return this.stateSubject.getValue();
    }
    dispatch(fn) {
        this.stateSubject.next(fn(this.state));
        return this;
    }
    ;
    destroy() {
        this.stateSubject.complete();
    }
    ;
}
exports.StoreSync = StoreSync;
class StoreAsync {
    constructor(initState) {
        this.stateSubject = new rxjs_1.BehaviorSubject(initState);
        this.state$ = this.stateSubject.asObservable();
        this.isAsync = true;
    }
    dispatch(fn) {
        return new rxjs_1.Observable(obs => {
            this.stateSubject.next(fn(this.stateSubject.value));
            obs.next(this);
            obs.complete();
        });
    }
    ;
    destroy() {
        this.stateSubject.complete();
    }
    ;
}
exports.StoreAsync = StoreAsync;
class ArrayCollectionOf {
    constructor(init) {
        this.container = init;
    }
    map(fn) {
        return new ArrayCollectionOf(this.container.map(fn));
    }
    filter(p) {
        return new ArrayCollectionOf(this.container.filter(p));
    }
    select(fn) {
        return this.container.find(x => fn(x));
    }
    selectMany(fn) {
        return this.container.filter(fn);
    }
    extend(xs) {
        this.container = [...this.container, ...xs.container];
        return this;
    }
}
exports.ArrayCollectionOf = ArrayCollectionOf;
class ItemStore {
    constructor(init, isAsync) {
        this.isAsync = isAsync;
        this.storeBase = store_1.toEither(isAsync, () => new StoreAsync(init), () => new StoreSync(init));
    }
    destroy() {
        this.storeBase.destroy();
    }
    toReturn(x) {
        return store_1.toEither(this.isAsync, () => x.pipe(operators_1.switchMap(() => rxjs_1.of(this))), () => this);
    }
    extend(items) {
        let fn = (xs) => {
            return xs.extend(items);
        };
        return this.toReturn(this.storeBase.dispatch(fn));
    }
    map(fn) {
        const fnCombine = (xs) => {
            return xs.map(fn);
        };
        return this.toReturn(this.storeBase.dispatch(fnCombine));
    }
    predicateMap(fn, p) {
        const fnCombine = (xs) => xs.map(x => p(x) ? fn(x) : x);
        return this.toReturn(this.storeBase.dispatch(fnCombine));
    }
    filter(p) {
        let fnCombine = (xs) => (xs.filter(p));
        return this.toReturn(this.storeBase.dispatch(fnCombine));
    }
    find(fn) {
        let target = undefined;
        let fnCombine = (xs) => {
            target = xs.select(fn);
            return xs;
        };
        if (!this.isAsync) {
            this.storeBase.dispatch(fnCombine);
            return target;
        }
        else {
            return this.storeBase.state$
                .pipe(operators_1.map((xs) => xs.select(fn)), operators_1.first());
        }
    }
    findMany(fn) {
        let target = [];
        let fnCombine = (xs) => {
            target = xs.selectMany(fn);
            return xs;
        };
        if (!this.isAsync) {
            this.storeBase.dispatch(fnCombine);
            return target;
        }
        else {
            return this.storeBase.state$
                .pipe(operators_1.map((xs) => xs.selectMany(fn)), operators_1.first());
        }
    }
    findObservable(fn) {
        let result = this.find(fn);
        return this.isAsync ? this.storeBase.state$.pipe(operators_1.switchMap((xs) => {
            return rxjs_1.of(xs.select(fn));
        })) : ((result === undefined)
            ? (new rxjs_1.Observable(obs => obs.complete())) :
            rxjs_1.of(result));
    }
    findObservableMany(fn) {
        let result = this.findMany(fn);
        return this.isAsync ? this.storeBase.state$.pipe(operators_1.switchMap((xs) => {
            return rxjs_1.of(xs.selectMany(fn));
        })) : ((result.length === 0)
            ? (new rxjs_1.Observable(obs => obs.complete())) :
            rxjs_1.of(result));
    }
}
exports.ItemStore = ItemStore;
class Database {
    constructor(kernel, updateEqual, removeEqual, toSearch) {
        this.updateEqual = updateEqual;
        this.removeEqual = removeEqual;
        this.toSearch = toSearch;
        this.dbCore = kernel;
    }
    destroy() {
        this.dbCore.destroy();
    }
    insert(x) {
        return (this.dbCore.isAsync ? rxjs_1.of(this.insertKernel(x)) : this.insertKernel(x));
    }
    insertMany(...xs) {
        let result = Array();
        xs.forEach(x => {
            let id = uuid_1.v4();
            let item = Object.assign({ id: id }, x);
            result.push(item);
        });
        this.dbCore.extend(new ArrayCollectionOf(result));
        return (this.dbCore.isAsync ? rxjs_1.of(result) : result);
    }
    remove(x) {
        if (this.removeEqual === undefined) {
            throw new Error('removeEqual() is undefined.');
        }
        let result = undefined;
        this.dbCore.filter(y => {
            if (!this.removeEqual(x, y)) {
                return true;
            }
            else {
                result = y;
                return false;
            }
        });
        return (this.dbCore.isAsync ?
            ((result === undefined) ?
                new rxjs_1.Observable() : rxjs_1.of(result)) : result);
    }
    removeMany(...xs) {
        if (this.removeEqual === undefined) {
            throw new Error('removeEqual() is undefined.');
        }
        let result = [];
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
        return (this.dbCore.isAsync ?
            ((result === []) ? new rxjs_1.Observable() : rxjs_1.of(result)) : result);
    }
    search(fn) {
        if (this.toSearch === undefined) {
            throw new Error('toSearch() is undefined.');
        }
        return this.dbCore.find(x => fn(this.toSearch(x)));
    }
    searchMany(fn) {
        if (this.toSearch === undefined) {
            throw new Error('toSearch() is undefined.');
        }
        return this.dbCore.findMany(x => fn(this.toSearch(x)));
    }
    findObservable(fn) {
        if (this.toSearch === undefined) {
            throw new Error('toSearch() is undefined.');
        }
        return this.dbCore.findObservable(x => fn(this.toSearch(x)));
    }
    findObservableMany(fn) {
        if (this.toSearch === undefined) {
            throw new Error('toSearch() is undefined.');
        }
        return this.dbCore.findObservableMany(x => fn(this.toSearch(x)));
    }
    update(x) {
        if (this.updateEqual === undefined) {
            throw new Error('updateEqual() is undefined.');
        }
        return (this.dbCore.isAsync ?
            ((this.updateKernel(x) === undefined) ? new rxjs_1.Observable() : rxjs_1.of(this.updateKernel(x)))
            : this.updateKernel(x));
    }
    updateMany(...xs) {
        if (this.updateEqual === undefined) {
            throw new Error('updateEqual() is undefined.');
        }
        let result = [];
        xs.forEach(x => {
            result.push(this.updateKernel(x));
        });
        return (this.dbCore.isAsync ?
            ((result === []) ? new rxjs_1.Observable() : rxjs_1.of(result)) : result);
    }
    upsert(x) {
        if (this.updateEqual === undefined) {
            throw new Error('updateEqual() is undefined.');
        }
        let result = this.updateKernel(x);
        return (result === undefined) ?
            this.insert(this.updateToInsert(x)) :
            ((this.dbCore.isAsync) ? rxjs_1.of(result) : result);
    }
    upsertMany(...xs) {
        if (this.updateEqual === undefined) {
            throw new Error('updateEqual() is undefined.');
        }
        const result = xs.map(x => this.updateKernel(x)).map((x, index) => {
            return (x === undefined) ? this.insertKernel(this.updateToInsert(xs[index])) : x;
        });
        return (this.dbCore.isAsync ? rxjs_1.of(result) : result);
    }
    updateToInsert(x) {
        let result = {};
        // for (let key1 in Object.keys(x)) {
        //     for (let key2 in Object.keys(result)) {
        //         if (key1 === key2) {
        //             (<any>result)[key2] = (<any>x)[key1];
        //         }
        //     }
        // }
        result = Object.assign({}, x, result);
        return result;
    }
    updateKernel(x) {
        let result = undefined;
        let fn = (y) => {
            // for (let key1  in Object.keys(y)) {
            //     for (let key2 in Object.keys(x)) {
            //         if (key1 === key2) {
            //             (<any>y)[key1] = (<any>x)[key2];
            //         }
            //     }
            // }
            result = Object.assign({}, y, x);
            return result;
        };
        let fnEq = (y) => this.updateEqual(x, y);
        this.dbCore.predicateMap(fn, fnEq);
        return result;
    }
    insertKernel(x) {
        let id = uuid_1.v4();
        let item = Object.assign({ id: id }, x);
        this.dbCore.extend(new ArrayCollectionOf([item]));
        return item;
    }
}
exports.Database = Database;