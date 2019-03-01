"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("./database");
const testing_1 = require("rxjs/testing");
const chai_1 = require("chai");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
describe('StoreSync', () => {
    let store;
    let scheduler = new testing_1.TestScheduler((actual, expected) => {
        chai_1.expect(actual).deep.equal(expected);
    });
    beforeEach(() => {
        store = new database_1.StoreSync(0);
        jasmine.clock().install();
    });
    afterEach(() => {
        store.destroy();
        jasmine.clock().uninstall();
    });
    it('init state', function () {
        chai_1.expect(store.state).to.equal(0);
    });
    it('isAsync flag', () => {
        chai_1.expect(store.isAsync).to.equal(false);
    });
    it('dispatch test', () => {
        store.dispatch((state) => Math.pow(state, 2) + 3);
        chai_1.expect(store.state).to.equal(3);
    });
    it('state$ flow test', () => {
        scheduler.run((helpers) => {
            const { expectObservable, hot } = helpers;
            const observable = new rxjs_1.Observable(obs => {
                obs.next(0);
                obs.next(1);
                obs.next(3);
            });
            let i = 0;
            const expectRes = [0, 1, 3];
            observable.subscribe((x) => chai_1.expect(x).equal(expectRes[i++]));
        });
    });
});
describe('StoreAsync', () => {
    let store;
    const scheduler = new testing_1.TestScheduler((actual, expected) => {
        chai_1.expect(actual).deep.equal(expected);
    });
    beforeEach(() => {
        store = new database_1.StoreAsync(0);
    });
    afterEach(() => {
        store.destroy();
    });
    it('isAsync flag', () => {
        chai_1.expect(store.isAsync).to.be.true;
        // expect(true).to.be.true;
    });
    it('dispatch test', (done) => {
        const expectedRes = [0, 1, 3];
        let index = 0;
        store.state$.pipe(operators_1.take(3)).subscribe(x => chai_1.expect(x).equal(expectedRes[index++]), rxjs_1.noop, done);
        store.dispatch((state) => state + 1).pipe(operators_1.switchMap(store => store.dispatch((state) => state + 2))).subscribe();
    });
    it('should return an observable after dispatch', (done) => {
        scheduler.run(helpers => {
            const obs = store.dispatch((state) => state + 3);
            obs.subscribe(state => {
                chai_1.expect(state).equal(store);
            }, rxjs_1.noop, done);
        });
    });
});
describe('ArrayCollectionOf', () => {
    let collection;
    beforeEach(() => {
        collection = new database_1.ArrayCollectionOf([1, 2, 3]);
    });
    it('should map to correct values', function () {
        const fn = (x) => x + 2;
        const expected = [3, 4, 5];
        chai_1.expect(collection.map(fn).container).is.deep.equal(expected);
    });
    it('should filter expected values', function () {
        const p = (x) => x !== 2;
        const expected = [1, 3];
        chai_1.expect(collection.filter(p).container).deep.equal(expected);
    });
    it('should select expected value', function () {
        const p = (x) => x === 2;
        const expected = 2;
        chai_1.expect(collection.select(p)).is.deep.equal(expected);
    });
    it('should select single expected value or undefined', function () {
        const p = (x) => x !== 2;
        const expected = 1;
        chai_1.expect((collection.select(p))).is.equal(expected);
        const p1 = (x) => x == 4;
        chai_1.expect(collection.select(p1)).is.equal(undefined);
    });
    it('should select multiple expected values', function () {
        const p = (x) => x !== 2;
        const expected = [1, 3];
        chai_1.expect(collection.selectMany(p)).is.deep.equal(expected);
        chai_1.expect(collection.selectMany(p).length).is.greaterThan(1);
    });
    it('should combine  2 collections', function () {
        const collection1 = new database_1.ArrayCollectionOf([4, 5]);
        const expected = [1, 2, 3, 4, 5];
        chai_1.expect(collection.extend(collection1).container).is.deep.equal(expected);
    });
});
describe('sync ItemStore', () => {
    let itemStore;
    let scheduler;
    beforeEach(() => {
        itemStore = new database_1.ItemStore(new database_1.ArrayCollectionOf([1, 2, 3]), false);
        scheduler = new testing_1.TestScheduler((actual, expected) => {
            chai_1.expect(actual).deep.equal(expected);
        });
    });
    it('should have a false flag', function () {
        chai_1.expect(itemStore.isAsync).to.be.false;
    });
    it('should have sync kernel', function () {
        chai_1.expect(itemStore.storeBase).to.be.instanceof(database_1.StoreSync);
    });
    it('should add new State to old State', function () {
        chai_1.expect(itemStore.extend(new database_1.ArrayCollectionOf([4, 5])).storeBase.state.container)
            .is.deep.equal([1, 2, 3, 4, 5]);
    });
    it('should map to the right values', function () {
        const fn = (x) => x + 1;
        chai_1.expect(itemStore.map(fn).storeBase.state.container).is.deep.equal([2, 3, 4]);
    });
    it('should (predicate and map) to the right values', function () {
        const fn = (x) => x + 1;
        const p = (x) => x !== 2;
        chai_1.expect(itemStore.predicateMap(fn, p).storeBase.state.container).is.deep.equal([2, 2, 4]);
    });
    it('should filter right values', function () {
        const p = (x) => x !== 2;
        chai_1.expect(itemStore.filter(p).storeBase.state.container).is.deep.equal([1, 3]);
    });
    it('should find single value or undefined', function () {
        const p = (x) => x !== 2;
        chai_1.expect(itemStore.find(p)).is.equal(1);
        const p1 = (x) => x == 4;
        chai_1.expect(itemStore.find(p1)).is.equal(undefined);
    });
    it('should find multiple values or void array', function () {
        const p = (x) => x !== 2;
        chai_1.expect(itemStore.findMany(p).length).is.greaterThan(1);
        const p1 = (x) => x == 4;
        chai_1.expect(itemStore.findMany(p1)).is.deep.equal([]);
    });
    it('should find a single value and return as observable', function () {
        const p = (x) => x !== 2;
        itemStore.findObservable(p).subscribe(x => chai_1.expect(x).is.equal(1));
        const p1 = (x) => x === 4;
        scheduler.run(helpers => {
            const { expectObservable } = helpers;
            expectObservable(itemStore.findObservable(p1)).toBe('|');
        });
    });
    it('should find multiple values and return as observable', function () {
        const p = (x) => x !== 2;
        itemStore.findObservableMany(p).subscribe(x => chai_1.expect(x).deep.equal([1, 3]));
    });
    it('should return as observable of never if nothing found', function () {
        scheduler.run(helpers => {
            const { expectObservable } = helpers;
            const p = (x) => x === 4;
            expectObservable(itemStore.findObservableMany(p)).toBe('|');
        });
    });
});
describe('Async ItemStore', () => {
    let itemStore;
    let scheduler;
    beforeEach(() => {
        itemStore = new database_1.ItemStore(new database_1.ArrayCollectionOf([1, 2, 3]), true);
        scheduler = new testing_1.TestScheduler((actual, expected) => {
            chai_1.expect(actual).deep.equal(expected);
        });
    });
    it('should have a true flag', function () {
        chai_1.expect(itemStore.isAsync).to.be.true;
    });
    it('should have Async kernel', function () {
        chai_1.expect(itemStore.storeBase).to.be.instanceof(database_1.StoreAsync);
    });
    it('should add new State to old State', function () {
        itemStore.extend(new database_1.ArrayCollectionOf([4, 5])).pipe(operators_1.switchMap(store => store.storeBase.state$)).subscribe(x => chai_1.expect(x.container).is.deep.equal([1, 2, 3, 4, 5]));
    });
    it('should map to the correct values and return as observable', function () {
        itemStore.map((x) => x + 1).pipe(operators_1.switchMap(store => store.storeBase.state$)).subscribe(x => chai_1.expect(x.container).is.deep.equal([2, 3, 4]));
    });
    it('should (predicate and map) to the right values', function () {
        const fn = (x) => x + 1;
        const p = (x) => x !== 2;
        itemStore.predicateMap(fn, p)
            .pipe(operators_1.switchMap(store => store.storeBase.state$)).subscribe(x => chai_1.expect(x.container).is.deep.equal([2, 2, 4]));
    });
    it('should filter the correct values and return as observable', function () {
        itemStore.filter((x) => x !== 2).pipe(operators_1.switchMap(store => store.storeBase.state$)).subscribe(x => chai_1.expect(x.container).is.deep.equal([1, 3]));
    });
    it('should find single value or undefined', function () {
        const p = (x) => x !== 2;
        itemStore.find(p).subscribe(x => chai_1.expect(x).is.deep.equal(1));
        scheduler.run(helpers => {
            const p1 = (x) => x == 4;
            const { expectObservable } = helpers;
            expectObservable(itemStore.find(p1)).toBe('(x|)', { x: undefined });
        });
    });
    it('should find multiple values or void array', function () {
        const p = (x) => x !== 2;
        itemStore.findMany(p).subscribe(x => chai_1.expect(x.length).is.greaterThan(1));
        const p1 = (x) => x == 4;
        itemStore.findMany(p1).subscribe(x => chai_1.expect(x).is.deep.equal([]));
    });
    it('should find a single value and return as observable and continue to watch this flow', function () {
        const p = (x) => x !== 1;
        let index = 0;
        const expectedRes = [2, 3];
        itemStore.findObservable(p).subscribe(x => chai_1.expect(x).is.equal(expectedRes[index++]));
        itemStore.map(y => y + 2);
        const p1 = (x) => x === 4;
        scheduler.run(helpers => {
            const { expectObservable } = helpers;
            expectObservable(itemStore.findObservable(p1))
                .toBe('x', { x: undefined });
        });
    });
    it('should find multiple values and return as observable and continue to watch this flow', function () {
        const p = (x) => x !== 2;
        let index = 0;
        const expectedRes = [[1, 3], [3, 4, 5]];
        itemStore.findObservableMany(p).subscribe(x => chai_1.expect(x).deep.equal(expectedRes[index++]));
        itemStore.map(y => y + 2);
    });
});
describe('sync database in memory', () => {
    const initValues = [
        {
            price: 10,
            name: 'item1',
            id: '111111',
            from: ['cn', 'us'],
        },
        {
            price: 100,
            name: 'item2',
            id: '222222',
            from: ['cn'],
        },
        {
            price: 2,
            name: 'item3',
            id: '333333',
            from: ['cn', 'us', 'uk'],
        }
    ];
    let store;
    beforeEach(() => {
        store = new database_1.ItemStore(new database_1.ArrayCollectionOf(initValues), false);
    });
    it('should insert obj into the kernel correctly', function () {
        const db = new database_1.Database(store);
        const expected = db.insert({ price: 20, name: 'item4', from: ['cn'] });
        chai_1.expect(db.dbCore.find((x) => x.name === 'item4')).is.deep.equal(expected);
    });
    it('should insert many values correctly', function () {
        const db = new database_1.Database(store);
        const expected = db.insertMany({ price: 20, name: 'item4', from: ['cn'] }, { price: 21, name: 'item5', from: ['cn'] });
        chai_1.expect(db.dbCore.find(x => x.name === 'item4')).is.deep.equal(expected[0]);
        chai_1.expect(db.dbCore.find(x => x.name === 'item5')).is.deep.equal(expected[1]);
    });
    it('should remove the target item', function () {
        const fn = (x, y) => {
            return x.name === y.name;
        };
        const db = new database_1.Database(store, undefined, fn);
        db.remove({ name: 'item2' });
        chai_1.expect(db.dbCore.find(x => x.name === 'item2')).is.undefined;
    });
    it('should throw error if removeEqual() undefined in remove', function () {
        const db = new database_1.Database(store, undefined, undefined, undefined);
        chai_1.expect(db.remove).to.throw();
    });
    it('should remove many target items', function () {
        const fn = (x, y) => {
            return x.name === y.name;
        };
        const db = new database_1.Database(store, undefined, fn);
        db.removeMany({ name: 'item2' }, { name: 'item1' });
        chai_1.expect(db.dbCore.find(x => x.name === 'item2')).is.undefined;
        chai_1.expect(db.dbCore.find(x => x.name === 'item1')).is.undefined;
        chai_1.expect(db.dbCore.storeBase.state.container).is.deep.equal([{
                price: 2,
                name: 'item3',
                id: '333333',
                from: ['cn', 'us', 'uk'],
            }]);
    });
    it('should find the right value or undefined', function () {
        const toSearch = (x) => {
            return { name: x.name };
        };
        const fn = (x) => x.name === 'item2';
        const db = new database_1.Database(store, undefined, undefined, toSearch);
        chai_1.expect(db.search(fn)).is.deep.equal({
            price: 100,
            name: 'item2',
            id: '222222',
            from: ['cn'],
        });
    });
    it('should throw error if toSearch() undefined in search', function () {
        const fn = (x) => x.name === 'item2';
        const db = new database_1.Database(store, undefined, undefined, undefined);
        chai_1.expect(db.search).to.throw();
    });
    it('should find the right values or undefined', function () {
        const toSearch = (x) => {
            return { name: x.name };
        };
        const fn = (x) => x.name !== 'item2';
        const db = new database_1.Database(store, undefined, undefined, toSearch);
        chai_1.expect(db.searchMany(fn)).is.deep.equal([
            {
                price: 10,
                name: 'item1',
                id: '111111',
                from: ['cn', 'us'],
            }, {
                price: 2,
                name: 'item3',
                id: '333333',
                from: ['cn', 'us', 'uk'],
            }
        ]);
    });
    it('should throw error if toSearch is undefined in searchMany', function () {
        const fn = (x) => x.name !== 'item2';
        const db = new database_1.Database(store, undefined, undefined, undefined);
        chai_1.expect(db.searchMany).to.throw();
    });
    it('should find value as observable', function () {
        const toSearch = (x) => {
            return { name: x.name };
        };
        const fn = (x) => {
            return x.name === 'item2';
        };
        const db = new database_1.Database(store, undefined, undefined, toSearch);
        db.findObservable(fn).subscribe(x => chai_1.expect(x).is.deep.equal({
            price: 100,
            name: 'item2',
            id: '222222',
            from: ['cn'],
        }));
    });
    it('should throw error if toSearch is undefined in findObservable', function () {
        const fn = (x) => x.name !== 'item2';
        const db = new database_1.Database(store, undefined, undefined, undefined);
        chai_1.expect(db.findObservable).to.throw();
    });
    it('should find values as observables', function () {
        const toSearch = (x) => {
            return { name: x.name };
        };
        const fn = (x) => {
            return x.name !== 'item2';
        };
        const db = new database_1.Database(store, undefined, undefined, toSearch);
        db.findObservableMany(fn).subscribe(x => chai_1.expect(x).is.deep.equal([
            {
                price: 10,
                name: 'item1',
                id: '111111',
                from: ['cn', 'us'],
            }, {
                price: 2,
                name: 'item3',
                id: '333333',
                from: ['cn', 'us', 'uk'],
            }
        ]));
    });
    it('should update the right item', function () {
        const updatefn = (x, y) => {
            return (x.name === y.name);
        };
        const expected = {
            name: 'item2',
            price: 1,
            id: '222222',
            from: ['cn'],
        };
        const db = new database_1.Database(store, updatefn, undefined, undefined);
        const res = db.update({ name: 'item2', price: 1 });
        chai_1.expect(db.dbCore.storeBase.state.container.find(x => x.name === 'item2')).is.deep.equal(expected);
        chai_1.expect(res).is.deep.equal(expected);
    });
    it('should return undefined if nothing to be updated', function () {
        const updatefn = (x, y) => {
            return (x.name === y.name);
        };
        const db = new database_1.Database(store, updatefn, undefined, undefined);
        const res = db.update({ name: 'item5', price: 1 });
        chai_1.expect(db.dbCore.storeBase.state.container.find(x => x.name === 'item5')).is.deep.equal(undefined);
        chai_1.expect(res).is.deep.equal(undefined);
    });
    it('should throw no updateEqual() error', function () {
        const db = new database_1.Database(store, undefined, undefined, undefined);
        chai_1.expect(db.update).to.throw();
    });
    it('should update the right items', function () {
        const updatefn = (x, y) => {
            return (x.name === y.name);
        };
        const expected = [{
                name: 'item2',
                price: 1,
                id: '222222',
                from: ['cn'],
            }, {
                price: 2,
                name: 'item1',
                id: '111111',
                from: ['cn', 'us'],
            }];
        const db = new database_1.Database(store, updatefn, undefined, undefined);
        const res = db.updateMany({ name: 'item2', price: 1 }, { name: 'item1', price: 2 });
        chai_1.expect(db.dbCore.storeBase.state.container.find(x => x.name === 'item2')).is.deep.equal(expected[0]);
        chai_1.expect(db.dbCore.storeBase.state.container.find(x => x.name === 'item1')).is.deep.equal(expected[1]);
        chai_1.expect(res).is.deep.equal(expected);
    });
    it('should return undefined when updating fails', function () {
        const updatefn = (x, y) => {
            return (x.name === y.name);
        };
        const db = new database_1.Database(store, updatefn, undefined, undefined);
        const expected = [undefined, {
                price: 2,
                name: 'item1',
                id: '111111',
                from: ['cn', 'us'],
            }];
        const res = db.updateMany({ name: 'item5', price: 1 }, { name: 'item1', price: 2 });
        chai_1.expect(db.dbCore.storeBase.state.container.find(x => x.name === 'item5')).is.deep.equal(expected[0]);
        chai_1.expect(db.dbCore.storeBase.state.container.find(x => x.name === 'item1')).is.deep.equal(expected[1]);
        chai_1.expect(res).is.deep.equal(expected);
    });
    it('should update directly if there is a match of target item', function () {
        const updatefn = (x, y) => {
            return (x.name === y.name);
        };
        const expected = {
            name: 'item2',
            price: 1,
            id: '222222',
            from: ['cn'],
        };
        const db = new database_1.Database(store, updatefn, undefined, undefined);
        const res = db.upsert({ name: 'item2', price: 1 });
        chai_1.expect(db.dbCore.storeBase.state.container.find(x => x.name === 'item2')).is.deep.equal(expected);
        chai_1.expect(res).is.deep.equal(expected);
    });
    it('should insert if there is no match of target item', function () {
        const updatefn = (x, y) => {
            return (x.name === y.name);
        };
        const db = new database_1.Database(store, updatefn, undefined, undefined);
        const res = db.upsert({ name: 'item5', price: 1, from: ['uk'] });
        chai_1.expect(db.dbCore.storeBase.state.container.find(x => x.name === 'item5')).is.deep.equal(res);
        chai_1.expect(db.dbCore.storeBase.state.container.length).is.equal(4);
    });
    it('should update if there is a match otherwise insert in a list of items', function () {
        const updatefn = (x, y) => {
            return (x.name === y.name);
        };
        const db = new database_1.Database(store, updatefn, undefined, undefined);
        const res = db.upsertMany({ name: 'item2', price: 1 }, { name: 'item4', price: 2 });
        chai_1.expect(db.dbCore.storeBase.state.container.find(x => x.name === 'item2')).is.equal(res[0]);
        chai_1.expect(db.dbCore.storeBase.state.container.find(x => x.name === 'item4')).is.equal(res[1]);
        chai_1.expect(db.dbCore.storeBase.state.container.length).is.equal(4);
    });
});
