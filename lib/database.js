"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
exports.__esModule = true;
var rxjs_1 = require("rxjs");
var store_1 = require("./store");
var operators_1 = require("rxjs/operators");
var uuid_1 = require("uuid");
var StoreSync = /** @class */ (function () {
    function StoreSync(initState) {
        this.stateSubject = new rxjs_1.BehaviorSubject(initState);
        this.state$ = this.stateSubject.asObservable();
        this.isAsync = false;
    }
    Object.defineProperty(StoreSync.prototype, "state", {
        get: function () {
            return this.stateSubject.getValue();
        },
        enumerable: true,
        configurable: true
    });
    StoreSync.prototype.dispatch = function (fn) {
        this.stateSubject.next(fn(this.state));
        return this;
    };
    ;
    StoreSync.prototype.destroy = function () {
        this.stateSubject.complete();
    };
    ;
    return StoreSync;
}());
exports.StoreSync = StoreSync;
var StoreAsync = /** @class */ (function () {
    function StoreAsync(initState) {
        this.stateSubject = new rxjs_1.BehaviorSubject(initState);
        this.state$ = this.stateSubject.asObservable();
        this.isAsync = true;
    }
    StoreAsync.prototype.dispatch = function (fn) {
        var _this = this;
        return new rxjs_1.Observable(function (obs) {
            _this.stateSubject.next(fn(_this.stateSubject.value));
            obs.next(_this);
            obs.complete();
        });
    };
    ;
    StoreAsync.prototype.destroy = function () {
        this.stateSubject.complete();
    };
    ;
    return StoreAsync;
}());
exports.StoreAsync = StoreAsync;
var ArrayCollectionOf = /** @class */ (function () {
    function ArrayCollectionOf(init) {
        this.container = init;
    }
    ArrayCollectionOf.prototype.map = function (fn) {
        return new ArrayCollectionOf(this.container.map(fn));
    };
    ArrayCollectionOf.prototype.filter = function (p) {
        return new ArrayCollectionOf(this.container.filter(p));
    };
    ArrayCollectionOf.prototype.select = function (fn) {
        return this.container.find(function (x) { return fn(x); });
    };
    ArrayCollectionOf.prototype.selectMany = function (fn) {
        return this.container.filter(fn);
    };
    ArrayCollectionOf.prototype.extend = function (xs) {
        this.container.concat(xs.container);
        return this;
    };
    return ArrayCollectionOf;
}());
exports.ArrayCollectionOf = ArrayCollectionOf;
var ItemStore = /** @class */ (function () {
    function ItemStore(init, isAsync) {
        this.isAsync = isAsync;
        this.storeBase = store_1.toEither(isAsync, function () { return new StoreAsync(init); }, function () { return new StoreSync(init); });
    }
    ItemStore.prototype.destroy = function () {
        this.storeBase.destroy();
    };
    ItemStore.prototype.toReturn = function (x) {
        var _this = this;
        return store_1.toEither(this.isAsync, function () { return x.pipe(operators_1.switchMap(function () { return rxjs_1.of(_this); })); }, function () { return _this; });
        // return this.isAsync ? (result as Observable<T>).pipe(switchMap(() => of(this))) : this;
    };
    ItemStore.prototype.extend = function (items) {
        var fn = function (xs) {
            return xs.extend(items);
        };
        return this.toReturn(this.storeBase.dispatch(fn));
        // return this.isAsync ?
        //     (((result as Observable<StoreAsync<StateType>>)
        //         .pipe(switchMap(() => of(this)))) as Observable<ItemStore<ItemType, StateType, IsAsync>>)
        //     : (this as ItemStore<ItemType, StateType, IsAsync> >);
    };
    ItemStore.prototype.map = function (fn) {
        var fnCombine = function (xs) {
            return xs.map(fn);
        };
        return this.toReturn(this.storeBase.dispatch(fnCombine));
        // let result = this.storeBase.dispatch(fnCombine);
        // return (this.isAsync ?
        //     ((result as Observable<StoreAsync<StateType>>).pipe(switchMap(() => of(this))))
        //     : this) as MaybeObservable<IsAsync, ItemStore<ItemType, StateType, IsAsync>>;
    };
    ItemStore.prototype.predicateMap = function (fn, p) {
        var fnCombine = function (xs) { return xs.map(function (x) { return p(x) ? fn(x) : x; }); };
        return this.toReturn(this.storeBase.dispatch(fnCombine));
        // return (this.isAsync ?
        //     (result as Observable<StoreAsync<StateType>>).pipe(switchMap(() => of(this))) : this) as
        //     MaybeObservable<IsAsync, ItemStore<ItemType, StateType, IsAsync>>;
    };
    ItemStore.prototype.filter = function (p) {
        var fnCombine = function (xs) { return (xs.filter(p)); };
        return this.toReturn(this.storeBase.dispatch(fnCombine));
        // return (this.isAsync ?
        //     (result as Observable<StoreAsync<StateType>>).pipe(switchMap(() => of(this))) : this) as
        //     MaybeObservable<IsAsync, ItemStore<ItemType, StateType, IsAsync>>;
    };
    ItemStore.prototype.find = function (fn) {
        var target = undefined;
        var fnCombine = function (xs) {
            target = xs.select(fn);
            return xs;
        };
        if (!this.isAsync) {
            this.storeBase.dispatch(fnCombine);
            return target;
        }
        else {
            return this.storeBase.state$
                .pipe(operators_1.map(function (xs) { return xs.select(fn); }), operators_1.first());
        }
    };
    ItemStore.prototype.findMany = function (fn) {
        var target = [];
        var fnCombine = function (xs) {
            target = xs.selectMany(fn);
            return xs;
        };
        if (!this.isAsync) {
            this.storeBase.dispatch(fnCombine);
            return target;
        }
        else {
            return this.storeBase.state$
                .pipe(operators_1.map(function (xs) { return xs.selectMany(fn); }), operators_1.first());
        }
    };
    ItemStore.prototype.findObservable = function (fn) {
        var result = this.find(fn);
        //         // if (!this.isAsync) {
        //         //     if (res != undefined) {
        //         //         return of(res);
        //         //     } else {
        //         //         return new Observable<never>();
        //         //     }
        //         // } else {
        //         //     return this.storeBase.state$.pipe(switchMap((xs: StateType) => xs.select(fn)));
        //         // }
        return this.isAsync ? this.storeBase.state$.pipe(operators_1.switchMap(function (xs) { return rxjs_1.of(xs.select(fn)); })) :
            rxjs_1.of(result);
    };
    ItemStore.prototype.findObservableMany = function (fn) {
        var result = this.findMany(fn);
        return this.isAsync ? this.storeBase.state$.pipe(operators_1.switchMap(function (xs) { return rxjs_1.of(xs.selectMany(fn)); })) :
            rxjs_1.of(result);
    };
    return ItemStore;
}());
exports.ItemStore = ItemStore;
var Database = /** @class */ (function () {
    function Database(kernel, updateEqual, removeEqual, toSearch) {
        this.updateEqual = updateEqual;
        this.removeEqual = removeEqual;
        this.toSearch = toSearch;
        this.dbCore = kernel;
    }
    Database.prototype.destroy = function () {
        this.dbCore.destroy();
    };
    Database.prototype.insert = function (x) {
        return (this.dbCore.isAsync ? rxjs_1.of(this.insertKernel(x)) : this.insertKernel(x));
    };
    Database.prototype.insertMany = function () {
        var xs = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            xs[_i] = arguments[_i];
        }
        var result = Array();
        xs.forEach(function (x) {
            var id = uuid_1.v4();
            var item = __assign({ id: id }, x);
            result.push(item);
        });
        this.dbCore.extend(new ArrayCollectionOf(result));
        return (this.dbCore.isAsync ? rxjs_1.of(result) : result);
    };
    Database.prototype.remove = function (x) {
        var _this = this;
        var result = undefined;
        this.dbCore.filter(function (y) {
            if (!_this.removeEqual(x, y)) {
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
    };
    Database.prototype.removeMany = function () {
        var _this = this;
        var xs = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            xs[_i] = arguments[_i];
        }
        var result = [];
        this.dbCore.filter(function (y) {
            var flag = true;
            xs.forEach(function (x) {
                if (_this.removeEqual(x, y)) {
                    result.push(y);
                    flag = false;
                }
            });
            return flag;
        });
        return (this.dbCore.isAsync ?
            ((result === []) ? new rxjs_1.Observable() : rxjs_1.of(result)) : result);
    };
    Database.prototype.search = function (fn) {
        var _this = this;
        return this.dbCore.find(function (x) { return fn(_this.toSearch(x)); });
    };
    Database.prototype.searchMany = function (fn) {
        var _this = this;
        return this.dbCore.findMany(function (x) { return fn(_this.toSearch(x)); });
    };
    Database.prototype.findObservable = function (fn) {
        var _this = this;
        return this.dbCore.findObservable(function (x) { return fn(_this.toSearch(x)); });
    };
    Database.prototype.findObservableMany = function (fn) {
        var _this = this;
        return this.dbCore.findObservableMany(function (x) { return fn(_this.toSearch(x)); });
    };
    Database.prototype.update = function (x) {
        return (this.dbCore.isAsync ?
            ((this.updateKernel(x) === undefined) ? new rxjs_1.Observable() : rxjs_1.of(this.updateKernel(x)))
            : this.updateKernel(x));
    };
    Database.prototype.updateMany = function () {
        var _this = this;
        var xs = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            xs[_i] = arguments[_i];
        }
        var result = [];
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
        xs.forEach(function (x) {
            result.push(_this.updateKernel(x));
        });
        return (this.dbCore.isAsync ?
            ((result === []) ? new rxjs_1.Observable() : rxjs_1.of(result)) : result);
    };
    Database.prototype.upsert = function (x) {
        var result = this.updateKernel(x);
        return (result === undefined) ?
            this.insert(this.updateToInsert(x)) :
            ((this.dbCore.isAsync) ? rxjs_1.of(result) : result);
    };
    Database.prototype.upsertMany = function () {
        var _this = this;
        var xs = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            xs[_i] = arguments[_i];
        }
        var result = [];
        xs.forEach(function (x) {
            result.push(_this.updateKernel(x));
        });
        result.forEach(function (x, index) {
            if (x === undefined) {
                return _this.insertKernel(_this.updateToInsert(xs[index]));
            }
            else {
                return x;
            }
        });
        return (this.dbCore.isAsync ? rxjs_1.of(result) : result);
    };
    Database.prototype.updateToInsert = function (x) {
        var result = {};
        for (var key1 in Object.keys(x)) {
            for (var key2 in Object.keys(result)) {
                if (key1 === key2) {
                    result[key2] = x[key1];
                }
            }
        }
        return result;
    };
    Database.prototype.updateKernel = function (x) {
        var _this = this;
        var result = undefined;
        var fn = function (y) {
            for (var key1 in Object.keys(y)) {
                for (var key2 in Object.keys(x)) {
                    if (key1 === key2) {
                        y[key1] = x[key2];
                    }
                }
            }
            result = y;
            return y;
        };
        var fnEq = function (y) { return _this.updateEqual(x, y); };
        this.dbCore.predicateMap(fn, fnEq);
        return result;
    };
    Database.prototype.insertKernel = function (x) {
        var id = uuid_1.v4();
        var item = __assign({ id: id }, x);
        this.dbCore.extend(new ArrayCollectionOf([item]));
        return item;
    };
    return Database;
}());
exports.Database = Database;
