import { StoreSync, StoreAsync, ArrayCollectionOf, ItemStore, Database } from './database';
import { } from 'jasmine';
import { TestScheduler } from "rxjs/testing";
import { expect } from 'chai';
import { noop, Observable, } from "rxjs";
import { switchMap, take } from "rxjs/operators";
import { cmp } from './utils';

interface ItemType {
    price: number;
    name: string;
    id: string;
    from: string[];
}

interface InsertType {
    price: number;
    name: string;
    from: string[];
}

interface UpdateType {
    price?: number;
    name: string;
    from?: string[];
}

interface RemoveType {
    price?: number;
    name: string;
    id?: string;
    from?: string[];
}

interface SearchType {
    name: string;
}

type StateType = ArrayCollectionOf<ItemType>;

const withoutId = (x: any) => {
    let res: any = {};
    for (let key1 in x) {
        if (x.hasOwnProperty(key1) && (key1 !== 'id')) {
            (<any>res)[key1] = (<any>x)[key1];
        }
    }
    return res;
};

describe('StoreSync', () => {
    let store: StoreSync<number>;
    let scheduler = new TestScheduler((actual, expected) => {
        expect(actual).deep.equal(expected);
    });
    beforeEach(() => {
        store = new StoreSync<number>(0);
        jasmine.clock().install();
    });
    afterEach(() => {
        store.destroy();
        jasmine.clock().uninstall();
    });
    it('init state', function () {
        expect(store.state).to.equal(0);
    });
    it('isAsync flag', () => {
        expect(store.isAsync).to.equal(false);
    });
    it('dispatch test', () => {
        store.dispatch((state) => state ** 2 + 3);
        expect(store.state).to.equal(3);
    });
    it('state$ flow test', () => {
        scheduler.run((helpers) => {
            const { expectObservable, hot } = helpers;
            const observable = new Observable<number>(obs => {
                obs.next(0);
                obs.next(1);
                obs.next(3);
            });
            let i = 0;
            const expectRes = [0, 1, 3];
            observable.subscribe((x) => expect(x).equal(expectRes[i++]));

        });

    });
}
);
describe('StoreAsync', () => {
    let store: StoreAsync<number>;
    const scheduler = new TestScheduler((actual, expected) => {
        expect(actual).deep.equal(expected);
    });
    beforeEach(() => {
        store = new StoreAsync<number>(0);
    });
    afterEach(() => {
        store.destroy();
    });
    it('isAsync flag', () => {
        expect(store.isAsync).to.be.true;
        // expect(true).to.be.true;
    });
    it('dispatch test', (done) => {
        const expectedRes = [0, 1, 3];
        let index = 0;
        store.state$.pipe(take(3)).subscribe(x => expect(x).equal(expectedRes[index++]), noop, done);
        store.dispatch((state) => state + 1).pipe(switchMap(store => store.dispatch((state) => state + 2))
        ).subscribe();
    });
    it('should return an observable after dispatch', (done) => {
        scheduler.run(helpers => {
            const obs = store.dispatch((state) => state + 3);
            obs.subscribe(
                state => {
                    expect(state).equal(store);
                }, noop,
                done);
        });


    });
});
describe('ArrayCollectionOf', () => {
    let collection: ArrayCollectionOf<number>;
    beforeEach(() => {
        collection = new ArrayCollectionOf<number>([1, 2, 3]);
    });
    it('should map to correct values', function () {
        const fn = (x: number) => x + 2;
        const expected = [3, 4, 5];
        expect(collection.map(fn).container).is.deep.equal(expected);
    });
    it('should filter expected values', function () {
        const p = (x: number) => x !== 2;
        const expected = [1, 3];
        expect(collection.filter(p).container).deep.equal(expected);
    });
    it('should select expected value', function () {
        const p = (x: number) => x === 2;
        const expected = 2;
        expect(collection.select(p)).is.deep.equal(expected);
    });
    it('should select single expected value or undefined', function () {
        const p = (x: number) => x !== 2;
        const expected = 1;
        expect((collection.select(p))).is.equal(expected);
        const p1 = (x: number) => x == 4;
        expect(collection.select(p1)).is.equal(undefined);
    });
    it('should select multiple expected values', function () {
        const p = (x: number) => x !== 2;
        const expected = [1, 3];
        expect(collection.selectMany(p)).is.deep.equal(expected);
        expect(collection.selectMany(p).length).is.greaterThan(1);
    });
    it('should combine  2 collections', function () {
        const collection1 = new ArrayCollectionOf<number>([4, 5]);
        const expected = [1, 2, 3, 4, 5];
        expect(collection.extend(collection1).container).is.deep.equal(expected);
    });
});
describe('sync ItemStore', () => {
    let itemStore: ItemStore<number, ArrayCollectionOf<number>, false>;
    let scheduler: TestScheduler;
    beforeEach(() => {
        itemStore = new ItemStore<number, ArrayCollectionOf<number>, false>
            (new ArrayCollectionOf<number>([1, 2, 3]), false);
        scheduler = new TestScheduler((actual, expected) => {
            expect(actual).deep.equal(expected);
        });

    });
    it('should have a false flag', function () {
        expect(itemStore.isAsync).to.be.false;
    });
    it('should have sync kernel', function () {
        expect(itemStore.storeBase).to.be.instanceof(StoreSync);
    });
    it('should add new State to old State', function () {
        expect(itemStore.extend(new ArrayCollectionOf<number>([4, 5])).storeBase.state.container)
            .is.deep.equal([1, 2, 3, 4, 5]);
    });
    it('should map to the right values', function () {
        const fn = (x: number) => x + 1;
        expect(itemStore.map(fn).storeBase.state.container).is.deep.equal([2, 3, 4]);

    });
    it('should (predicate and map) to the right values', function () {
        const fn = (x: number) => x + 1;
        const p = (x: number) => x !== 2;
        expect(itemStore.predicateMap(fn, p).storeBase.state.container).is.deep.equal([2, 2, 4]);

    });
    it('should filter right values', function () {
        const p = (x: number) => x !== 2;
        expect(itemStore.filter(p).storeBase.state.container).is.deep.equal([1, 3]);

    });
    it('should find single value or undefined', function () {
        const p = (x: number) => x !== 2;
        expect(itemStore.find(p)).is.equal(1);
        const p1 = (x: number) => x == 4;
        expect(itemStore.find(p1)).is.equal(undefined);
    });
    it('should find multiple values or void array', function () {
        const p = (x: number) => x !== 2;
        expect(itemStore.findMany(p).length).is.greaterThan(1);
        const p1 = (x: number) => x == 4;
        expect(itemStore.findMany(p1)).is.deep.equal([]);
    });
    it('should find a single value and return as observable', function () {
        const p = (x: number) => x !== 2;
        itemStore.findObservable(p).subscribe(x => expect(x).is.equal(1));
        const p1 = (x: number) => x === 4;
        scheduler.run(helpers => {
            const { expectObservable } = helpers;
            expectObservable(itemStore.findObservable(p1)).toBe('');
        });
    });
    it('should find multiple values and return as observable', function () {
        const p = (x: number) => x !== 2;
        itemStore.findObservableMany(p).subscribe(x => expect(x).deep.equal([1, 3]));
    });
    it('should return as observable of never if nothing found', function () {
        scheduler.run(helpers => {
            const { expectObservable } = helpers;
            const p = (x: number) => x === 4;
            expectObservable(itemStore.findObservableMany(p)).toBe('a', { a: [] });
        });
    });

});
describe('Async ItemStore', () => {
    let itemStore: ItemStore<number, ArrayCollectionOf<number>, true>;
    let scheduler: TestScheduler;
    beforeEach(() => {
        itemStore = new ItemStore<number, ArrayCollectionOf<number>, true>
            (new ArrayCollectionOf<number>([1, 2, 3]), true);
        scheduler = new TestScheduler((actual, expected) => {
            expect(actual).deep.equal(expected);
        });
    });
    it('should have a true flag', function () {
        expect(itemStore.isAsync).to.be.true;
    });
    it('should have Async kernel', function () {
        expect(itemStore.storeBase).to.be.instanceof(StoreAsync);
    });
    it('should add new State to old State', function () {
        itemStore.extend(new ArrayCollectionOf<number>([4, 5])).pipe(
            switchMap(store => store.storeBase.state$)).subscribe(x =>
                expect(x.container).is.deep.equal([1, 2, 3, 4, 5]));
    });
    it('should map to the correct values and return as observable', function () {
        itemStore.map((x) => x + 1).pipe(
            switchMap(store => store.storeBase.state$)).subscribe(x =>
                expect(x.container).is.deep.equal([2, 3, 4]));
    });
    it('should (predicate and map) to the right values', function () {
        const fn = (x: number) => x + 1;
        const p = (x: number) => x !== 2;
        itemStore.predicateMap(fn, p)
            .pipe(
                switchMap(store => store.storeBase.state$)
            ).subscribe(x => expect(x.container).is.deep.equal([2, 2, 4]));
    });
    it('should filter the correct values and return as observable', function () {
        itemStore.filter((x) => x !== 2).pipe(
            switchMap(store => store.storeBase.state$)).subscribe(x =>
                expect(x.container).is.deep.equal([1, 3]));
    });
    it('should find single value or undefined', function () {
        const p = (x: number) => x !== 2;
        itemStore.find(p).subscribe(x => expect(x).is.deep.equal(1));
        scheduler.run(helpers => {
            const p1 = (x: number) => x == 4;
            const { expectObservable } = helpers;
            expectObservable(itemStore.find(p1)).toBe('(x|)', { x: undefined });
        });

    });
    it('should find multiple values or void array', function () {
        const p = (x: number) => x !== 2;
        itemStore.findMany(p).subscribe(x => expect(x.length).is.greaterThan(1));
        const p1 = (x: number) => x == 4;
        itemStore.findMany(p1).subscribe(x => expect(x).is.deep.equal([]));
    });
    it('should find a single value and return as observable and continue to watch this flow',
        function () {
            const p = (x: number) => x !== 1;
            let index = 0;
            const expectedRes = [2, 3];
            itemStore.findObservable(p).subscribe(x => expect(x).is.equal(expectedRes[index++]));
            itemStore.map(y => y + 2);
            const p1 = (x: number) => x === 4;
            scheduler.run(helpers => {
                const { expectObservable } = helpers;
                expectObservable(itemStore.findObservable(p1))
                    .toBe('');
            });
        });
    it('should find multiple values and return as observable and continue to watch this flow',
        function () {
            const p = (x: number) => x !== 2;
            let index = 0;
            const expectedRes = [[1, 3], [3, 4, 5]];
            itemStore.findObservableMany(p).subscribe(x => expect(x).deep.equal(expectedRes[index++]));
            itemStore.map(y => y + 2);
        });
});
describe('sync database in memory', () => {
    const initValues: ItemType[] = [
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
    let store: ItemStore<ItemType, StateType, false>;
    beforeEach(() => {
        store = new ItemStore<ItemType, StateType, false>(new ArrayCollectionOf<ItemType>(initValues), false);
    });
    afterEach(() => store.destroy());
    it('should insert obj into the kernel correctly', function () {
        const db = new Database<InsertType, UpdateType, RemoveType, SearchType, ItemType, false>(store);
        const expected = db.insert({ price: 20, name: 'item4', from: ['cn'] });
        expect(db.dbCore.find((x) => x.name === 'item4')).is.deep.equal(expected);
    });
    it('should insert many values correctly', function () {
        const db = new Database<InsertType, UpdateType, RemoveType, SearchType, ItemType, false>(store);
        const expected = db.insertMany(
            { price: 20, name: 'item4', from: ['cn'] },
            { price: 21, name: 'item5', from: ['cn'] });
        expect(db.dbCore.find(x => x.name === 'item4')).is.deep.equal(expected[0]);
        expect(db.dbCore.find(x => x.name === 'item5')).is.deep.equal(expected[1]);
    });
    it('should remove the target item', function () {
        const fn = (x: RemoveType, y: ItemType) => {
            return x.name === y.name
        };
        const db = new Database<InsertType, UpdateType, RemoveType, SearchType, ItemType, false>
            (store, undefined, fn);
        db.remove({ name: 'item2' });
        expect(db.dbCore.find(x => x.name === 'item2')).is.undefined;
    });
    it('should throw error if removeEqual() undefined in remove', function () {
        const db = new Database<InsertType, UpdateType, RemoveType, SearchType, ItemType, false>
            (store, undefined, undefined, undefined);
        expect(db.remove).to.throw();
    });
    it('should remove many target items', function () {
        const fn = (x: RemoveType, y: ItemType) => {
            return x.name === y.name
        };
        const db = new Database<InsertType, UpdateType, RemoveType, SearchType, ItemType, false>
            (store, undefined, fn);
        db.removeMany({ name: 'item2' }, { name: 'item1' });
        expect(db.dbCore.find(x => x.name === 'item2')).is.undefined;
        expect(db.dbCore.find(x => x.name === 'item1')).is.undefined;
        expect(db.dbCore.storeBase.state.container).is.deep.equal([{
            price: 2,
            name: 'item3',
            id: '333333',
            from: ['cn', 'us', 'uk'],
        }]);
    });
    it('should find the right value or undefined', function () {
        const toSearch = (x: ItemType) => {
            return { name: x.name }
        };
        const fn = (x: SearchType) => x.name === 'item2';
        const db = new Database<InsertType, UpdateType, RemoveType, SearchType, ItemType, false>
            (store, undefined, undefined, toSearch);
        expect(db.search(fn)).is.deep.equal({
            price: 100,
            name: 'item2',
            id: '222222',
            from: ['cn'],
        });
    });
    it('should throw error if toSearch() undefined in search', function () {
        const fn = (x: SearchType) => x.name === 'item2';
        const db = new Database<InsertType, UpdateType, RemoveType, SearchType, ItemType, false>
            (store, undefined, undefined, undefined);
        expect(db.search).to.throw();
    });
    it('should find the right values or undefined', function () {
        const toSearch = (x: ItemType) => {
            return { name: x.name }
        };
        const fn = (x: SearchType) => x.name !== 'item2';
        const db = new Database<InsertType, UpdateType, RemoveType, SearchType, ItemType, false>
            (store, undefined, undefined, toSearch);
        expect(db.searchMany(fn)).is.deep.equal([
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
            }]);
    });
    it('should throw error if toSearch is undefined in searchMany', function () {
        const fn = (x: SearchType) => x.name !== 'item2';
        const db = new Database<InsertType, UpdateType, RemoveType, SearchType, ItemType, false>
            (store, undefined, undefined, undefined);
        expect(db.searchMany).to.throw();
    });
    it('should find value as observable', function () {
        const toSearch = (x: ItemType) => {
            return { name: x.name }
        };
        const fn = (x: SearchType) => {
            return x.name === 'item2'
        };
        const db = new Database<InsertType, UpdateType, RemoveType, SearchType, ItemType, false>
            (store, undefined, undefined, toSearch);
        db.findObservable(fn).subscribe(x => expect(x).is.deep.equal({
            price: 100,
            name: 'item2',
            id: '222222',
            from: ['cn'],
        }));
    });
    it('should throw error if toSearch is undefined in findObservable', function () {
        const fn = (x: SearchType) => x.name !== 'item2';
        const db = new Database<InsertType, UpdateType, RemoveType, SearchType, ItemType, false>
            (store, undefined, undefined, undefined);
        expect(db.findObservable).to.throw();
    });
    it('should find values as observables', function () {
        const toSearch = (x: ItemType) => {
            return { name: x.name }
        };
        const fn = (x: SearchType) => {
            return x.name !== 'item2'
        };
        const db = new Database<InsertType, UpdateType, RemoveType, SearchType, ItemType, false>
            (store, undefined, undefined, toSearch);
        db.findObservableMany(fn).subscribe(x => expect(x).is.deep.equal([
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
            }]));
    });
    it('should update the right item', function () {
        const updatefn = (x: UpdateType, y: ItemType) => {
            return (x.name === y.name)
        };
        const fromUpdatefn = (x: UpdateType, y: ItemType) => {
            return { ...x, id: y.id } as ItemType
        };
        const expected = {
            name: 'item2',
            price: 1,
            id: '222222',
        };
        const db = new Database<InsertType, UpdateType, RemoveType, SearchType, ItemType, false>
            (store, updatefn, undefined, undefined, fromUpdatefn);
        const res = db.update({ name: 'item2', price: 1 });
        expect(db.dbCore.storeBase.state.container.find(x => x.name === 'item2')).is.deep.equal(expected);
        expect(res).is.deep.equal(expected);
    });
    it('should return undefined if nothing to be updated', function () {
        const updatefn = (x: UpdateType, y: ItemType) => {
            return (x.name === y.name)
        };
        const fromUpdatefn = (x: UpdateType, y: ItemType) => {
            return { ...x, id: y.id } as ItemType
        };
        const db = new Database<InsertType, UpdateType, RemoveType, SearchType, ItemType, false>
            (store, updatefn, undefined, undefined, fromUpdatefn);
        const res = db.update({ name: 'item5', price: 1 });
        expect(db.dbCore.storeBase.state.container.find(x => x.name === 'item5')).is.deep.equal(undefined);
        expect(res).is.deep.equal(undefined);
    });
    it('should throw no updateEqual() error', function () {
        const db = new Database<InsertType, UpdateType, RemoveType, SearchType, ItemType, false>
            (store, undefined, undefined, undefined, undefined);
        expect(db.update).to.throw();
    });
    it('should update the right items', function () {
        const updatefn = (x: UpdateType, y: ItemType) => {
            return (x.name === y.name)
        };
        const fromUpdatefn = (x: UpdateType, y: ItemType) => {
            return { ...x, id: y.id } as ItemType
        };
        const expected = [{
            name: 'item2',
            price: 1,
            id: '222222',
        }, {
            price: 2,
            name: 'item1',
            id: '111111',
        }];
        const db = new Database<InsertType, UpdateType, RemoveType, SearchType, ItemType, false>
            (store, updatefn, undefined, undefined, fromUpdatefn);
        const res = db.updateMany({ name: 'item2', price: 1 }, { name: 'item1', price: 2 });
        expect(db.dbCore.storeBase.state.container.find(x => x.name === 'item2')).is.deep.equal(expected[0]);
        expect(db.dbCore.storeBase.state.container.find(x => x.name === 'item1')).is.deep.equal(expected[1]);
        expect(res).is.deep.equal(expected);
    });
    it('should return undefined when updating fails', function () {
        const updatefn = (x: UpdateType, y: ItemType) => {
            return (x.name === y.name)
        };
        const fromUpdatefn = (x: UpdateType, y: ItemType) => {
            return { ...x, id: y.id } as ItemType
        };
        const db = new Database<InsertType, UpdateType, RemoveType, SearchType, ItemType, false>
            (store, updatefn, undefined, undefined, fromUpdatefn);
        const expected = [undefined, {
            price: 2,
            name: 'item1',
            id: '111111',
        }];
        const res = db.updateMany({ name: 'item5', price: 1 }, { name: 'item1', price: 2 });
        expect(db.dbCore.storeBase.state.container.find(x => x.name === 'item5')).is.deep.equal(expected[0]);
        expect(db.dbCore.storeBase.state.container.find(x => x.name === 'item1')).is.deep.equal(expected[1]);
        expect(res).is.deep.equal(expected);
    });
    it('should update directly if there is a match of target item', function () {
        const updatefn = (x: UpdateType, y: ItemType) => {
            return (x.name === y.name)
        };
        const fromUpdatefn = (x: UpdateType, y: ItemType) => {
            return { ...x, id: y.id } as ItemType
        };
        const expected = {
            name: 'item2',
            price: 1,
            id: '222222',
        };
        const db = new Database<InsertType, UpdateType, RemoveType, SearchType, ItemType, false>
            (store, updatefn, undefined, undefined, fromUpdatefn);
        const res = db.upsert({ name: 'item2', price: 1 });
        expect(db.dbCore.storeBase.state.container.find(x => x.name === 'item2')).is.deep.equal(expected);
        expect(res).is.deep.equal(expected);
    });
    it('should insert if there is no match of target item', function () {
        const updatefn = (x: UpdateType, y: ItemType) => {
            return (x.name === y.name)
        };
        const fromUpdatefn = (x: UpdateType, y: ItemType) => {
            return { ...x, id: y.id } as ItemType
        };
        const db = new Database<InsertType, UpdateType, RemoveType, SearchType, ItemType, false>
            (store, updatefn, undefined, undefined, fromUpdatefn);
        const res = db.upsert({ name: 'item5', price: 1, from: ['uk'] });
        expect(db.dbCore.storeBase.state.container.find(x => x.name === 'item5')).is.deep.equal(res);
        expect(db.dbCore.storeBase.state.container.length).is.equal(4);
    });
    it('should update if there is a match otherwise insert in a list of items', function () {
        const updatefn = (x: UpdateType, y: ItemType) => {
            return (x.name === y.name)
        };
        const fromUpdatefn = (x: UpdateType, y: ItemType) => {
            return { ...x, id: y.id } as ItemType
        };
        const db = new Database<InsertType, UpdateType, RemoveType, SearchType, ItemType, false>
            (store, updatefn, undefined, undefined, fromUpdatefn);
        const res = db.upsertMany({ name: 'item2', price: 1 }, { name: 'item4', price: 2 });
        expect(db.dbCore.storeBase.state.container.find(x => x.name === 'item2')).is.deep.equal(res[0]);
        expect(db.dbCore.storeBase.state.container.find(x => x.name === 'item4')).is.deep.equal(res[1]);
        expect(db.dbCore.storeBase.state.container.length).is.equal(4);
    });
    it('should be applied multiple different dbs', () => {
        const initvals = [{ id: '12313', name: 'testB', price: 112 }, { name: 'testA', id: '55555', price: 100 }];
        type InsertTypeNew = { name: string };
        const storeNew = new ItemStore<any, ArrayCollectionOf<any>, false>(new ArrayCollectionOf<any>(initvals), false);
        const db1 = new Database<InsertTypeNew, any, any, any, ItemType, false>
            (storeNew, undefined, undefined, undefined, undefined);
        const db2 = new Database<InsertType, UpdateType, RemoveType, SearchType, ItemType, false>
            (storeNew, undefined, undefined, undefined, undefined);
        const toSearch = (x: any) => x;
        const db3 = new Database<any, any, any, any, any, false>(storeNew, undefined, undefined, toSearch);
        db1.insert({ name: 'testA' });
        db2.insert({ price: 111, name: 'testB', from: ['cn'] });
        expect(storeNew.storeBase.state.container.length).is.equal(4);
        expect(db3.searchMany((x: any) => x.name === 'testB').length).is.equal(2);
        expect(db3.searchEqualTo(initvals[1])).is.deep.equal(initvals[1]);
    });
});
describe('Async database in memory', () => {
    const initValues: ItemType[] = [
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
    let store: ItemStore<ItemType, StateType, true>;
    beforeEach(() => {
        store = new ItemStore<ItemType, StateType, true>(new ArrayCollectionOf<ItemType>(initValues), true);
    });
    afterEach(() => store.destroy());
    it('should insert obj into the kernel correctly', function () {
        const db = new Database<InsertType, UpdateType, RemoveType, SearchType, ItemType, true>(store);
        const expected = { price: 20, name: 'item4', from: ['cn'] };
        db.insert(expected).pipe(switchMap(() => db.dbCore.find(x => x.name === 'item4')))
            .subscribe(item => expect(withoutId(item)).deep.equal(expected));
    });
    it('should insert many values correctly', function () {
        const db = new Database<InsertType, UpdateType, RemoveType, SearchType, ItemType, true>(store);
        const values = [{ price: 20, name: 'item4', from: ['cn'] },
        { price: 21, name: 'item5', from: ['cn'] }];
        db.insertMany(values[0], values[1]).pipe(switchMap(() => db.dbCore.findMany(x => x.name === 'item4' || x.name === 'item5')))
            .subscribe(items => {
                expect(items.length === 2);
                expect(items.map(withoutId)).deep.equal(values)
            });
    });
    it('should remove the target item', function () {
        const fn = (x: RemoveType, y: ItemType) => {
            return x.name === y.name
        };
        const db = new Database<InsertType, UpdateType, RemoveType, SearchType, ItemType, true>
            (store, undefined, fn);
        db.remove({ name: 'item2' }).pipe(switchMap(() => db.dbCore.find(item => item.name === 'item2')))
            .subscribe(x => expect(x).is.undefined);
    });
    it('should throw error if removeEqual() undefined in remove', function () {
        const db = new Database<InsertType, UpdateType, RemoveType, SearchType, ItemType, true>
            (store, undefined, undefined, undefined);
        expect(db.remove).to.throw();
    });
    it('should remove many target items', function () {
        const fn = (x: RemoveType, y: ItemType) => {
            return x.name === y.name
        };
        const db = new Database<InsertType, UpdateType, RemoveType, SearchType, ItemType, true>
            (store, undefined, fn);
        db.removeMany({ name: 'item2' }, { name: 'item1' })
            .pipe(
                switchMap(() => db.dbCore.findMany(item => (item.name === 'item2') || (item.name === 'item1'))))
            .subscribe(result => expect(result).is.deep.equal([]));
    });
    it('should find the right value or undefined', function () {
        const toSearch = (x: ItemType) => {
            return { name: x.name }
        };
        const expected = {
            price: 100,
            name: 'item2',
            id: '222222',
            from: ['cn'],
        };
        const fn = (x: SearchType) => x.name === 'item2';
        const db = new Database<InsertType, UpdateType, RemoveType, SearchType, ItemType, true>
            (store, undefined, undefined, toSearch);
        db.search(fn).subscribe(result => expect(result).is.deep.equal(expected));
    });
    it('should throw error if toSearch() undefined in search', function () {
        const fn = (x: SearchType) => x.name === 'item2';
        const db = new Database<InsertType, UpdateType, RemoveType, SearchType, ItemType, true>
            (store, undefined, undefined, undefined);
        expect(db.search).to.throw();
    });
    it('should find the right values or undefined', function () {
        const toSearch = (x: ItemType) => {
            return { name: x.name }
        };
        const fn = (x: SearchType) => x.name !== 'item2';
        const db = new Database<InsertType, UpdateType, RemoveType, SearchType, ItemType, true>
            (store, undefined, undefined, toSearch);
        db.searchMany(fn).subscribe(result => expect(result).is.deep.equal([
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
            }]));
    });
    it('should throw error if toSearch is undefined in searchMany', function () {
        const fn = (x: SearchType) => x.name !== 'item2';
        const db = new Database<InsertType, UpdateType, RemoveType, SearchType, ItemType, true>
            (store, undefined, undefined, undefined);
        expect(db.searchMany).to.throw();
    });
    it('should find value as observable', function () {
        const toSearch = (x: ItemType) => {
            return { name: x.name }
        };
        const fn = (x: SearchType) => {
            return x.name === 'item2'
        };
        const db = new Database<InsertType, UpdateType, RemoveType, SearchType, ItemType, true>
            (store, undefined, undefined, toSearch);
        db.findObservable(fn).subscribe(x => expect(x).is.deep.equal({
            price: 100,
            name: 'item2',
            id: '222222',
            from: ['cn'],
        }));
    });
    it('should throw error if toSearch is undefined in findObservable', function () {
        const fn = (x: SearchType) => x.name !== 'item2';
        const db = new Database<InsertType, UpdateType, RemoveType, SearchType, ItemType, true>
            (store, undefined, undefined, undefined);
        expect(db.findObservable).to.throw();
    });
    it('should find values as observables', function () {
        const toSearch = (x: ItemType) => {
            return { name: x.name }
        };
        const search = { name: 'item2' } as SearchType;
        const db = new Database<InsertType, UpdateType, RemoveType, SearchType, ItemType, true>
            (store, undefined, undefined, toSearch);
        db.findObservableEqualTo(search).subscribe(x => expect(x).is.deep.equal(
            {
                price: 100,
                name: 'item2',
                id: '222222',
                from: ['cn'],
            }));
        const fn = (x: SearchType) => {
            return x.name !== 'item2'
        };
        db.findObservableMany(fn).subscribe(x => expect(x).is.deep.equal([
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
            }]));
    });
    it('should update the right item', function () {
        const updatefn = (x: UpdateType, y: ItemType) => {
            return (x.name === y.name)
        };
        const fromUpdatefn = (x: UpdateType, y: ItemType) => {
            return { ...x, id: y.id } as ItemType
        };
        const expected = {
            name: 'item2',
            price: 1,
            id: '222222',
        };
        const db = new Database<InsertType, UpdateType, RemoveType, SearchType, ItemType, true>
            (store, updatefn, undefined, undefined, fromUpdatefn);
        db.update({ name: 'item2', price: 1 }).pipe(switchMap(() => db.dbCore.find(x => x.name === 'item2')))
            .subscribe(x => {
                expect(x).is.deep.equal(expected);
            });
    });
    it('should return undefined if nothing to be updated', function () {
        const updatefn = (x: UpdateType, y: ItemType) => {
            return (x.name === y.name)
        };
        const fromUpdatefn = (x: UpdateType, y: ItemType) => {
            return { ...x, id: y.id } as ItemType
        };
        const db = new Database<InsertType, UpdateType, RemoveType, SearchType, ItemType, true>
            (store, updatefn, undefined, undefined, fromUpdatefn);
        db.update({ name: 'item5', price: 1 }).pipe(switchMap(() => db.dbCore.find(x => x.name === 'item5')))
            .subscribe(x => expect(x).is.undefined);
    });
    it('should throw no updateEqual() error', function () {
        const db = new Database<InsertType, UpdateType, RemoveType, SearchType, ItemType, true>
            (store, undefined, undefined, undefined);
        expect(db.update).to.throw();
    });
    it('should update the right items', function () {
        const updatefn = (x: UpdateType, y: ItemType) => {
            return (x.name === y.name)
        };
        const fromUpdatefn = (x: UpdateType, y: ItemType) => {
            return { ...x, id: y.id } as ItemType
        };
        const expected = [
            {
                name: 'item1',
                price: 2,
                id: '111111',
            },
            {
                name: 'item2',
                price: 1,
                id: '222222',
            }];
        const db = new Database<InsertType, UpdateType, RemoveType, SearchType, ItemType, true>
            (store, updatefn, undefined, undefined, fromUpdatefn);
        db.updateMany({ name: 'item2', price: 1 }, {
            name: 'item1',
            price: 2
        }).pipe(switchMap(() => db.dbCore.findMany(x => x.name === 'item2' || x.name === 'item1')))
            .subscribe(result => expect(result).is.deep.equal(expected));
    });
    it('should return undefined when updating fails', function () {
        const updatefn = (x: UpdateType, y: ItemType) => {
            return (x.name === y.name)
        };
        const fromUpdatefn = (x: UpdateType, y: ItemType) => {
            return { ...x, id: y.id } as ItemType
        };
        const db = new Database<InsertType, UpdateType, RemoveType, SearchType, ItemType, true>
            (store, updatefn, undefined, undefined, fromUpdatefn);
        const expected = [undefined, {
            price: 2,
            name: 'item1',
            id: '111111',
        }];
        db.updateMany({ name: 'item5', price: 1 }, { name: 'item1', price: 2 })
            .pipe(switchMap(() => db.dbCore.findMany(x => x.name === 'item5' || x.name === 'item1')))
            .subscribe(result => expect(result).is.deep.equal(expected));
    });
    it('should update directly if there is a match of target item', function () {
        const updatefn = (x: UpdateType, y: ItemType) => {
            return (x.name === y.name)
        };
        const fromUpdatefn = (x: UpdateType, y: ItemType) => {
            return { ...x, id: y.id } as ItemType
        };
        const expected = {
            name: 'item2',
            price: 1,
            id: '222222',
        };
        const db = new Database<InsertType, UpdateType, RemoveType, SearchType, ItemType, true>
            (store, updatefn, undefined, undefined, fromUpdatefn);
        db.upsert({ name: 'item2', price: 1 }).pipe(switchMap(() => db.dbCore.find(x => x.name === 'item2')))
            .subscribe(result => expect(result).is.deep.equal(expected));
    });
    it('should insert if there is no match of target item', function () {
        const updatefn = (x: UpdateType, y: ItemType) => {
            return (x.name === y.name)
        };
        const fromUpdatefn = (x: UpdateType, y: ItemType) => {
            return { ...x, id: y.id } as ItemType
        };
        const db = new Database<InsertType, UpdateType, RemoveType, SearchType, ItemType, true>
            (store, updatefn, undefined, undefined, fromUpdatefn);
        db.upsert({
            name: 'item5',
            price: 1,
            from: ['uk']
        }).pipe(switchMap(() => db.dbCore.find(x => x.name === 'item5')))
            .subscribe(result => expect(result).is.not.undefined);
    });
    it('should update if there is a match otherwise insert in a list of items', function () {
        const updatefn = (x: UpdateType, y: ItemType) => {
            return (x.name === y.name)
        };
        const fromUpdatefn = (x: UpdateType, y: ItemType) => {
            return { ...x, id: y.id } as ItemType
        };
        const db = new Database<InsertType, UpdateType, RemoveType, SearchType, ItemType, true>
            (store, updatefn, undefined, undefined, fromUpdatefn);
        db.upsertMany({ name: 'item2', price: 1 }, {
            name: 'item4',
            price: 2
        }).pipe(switchMap(() => db.dbCore.findMany(x => x.name === 'item2' || x.name === 'item4')))
            .subscribe(result => {
                expect(result.filter(x => x.name === 'item2')).is.not.undefined;
                expect(result.filter(x => x.name === 'item4')).is.not.undefined;
            });
    });
});