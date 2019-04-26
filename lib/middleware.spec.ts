import { ArrayCollectionOf, Database, Id, ItemStore } from "./database";
import { Communicator } from './middleware';
import { expect } from 'chai';
import { from } from "rxjs";
import * as _ from 'lodash';

describe('test middle ware', () => {
    interface TestType {
        id: string;
        name: string;
        age: number;
    }

    interface InsertType {
        name: string;
        age: number;
    }

    type WithoutId<T> = Exclude<T, { id: string }>;
    const initVal = new ArrayCollectionOf<TestType>([{ id: '123123', name: 'sss', age: 11 }]);
    const toSearch = (x: TestType): TestType => x;
    const rmvfn = (x: TestType, y: TestType) => { return x.name === y.name };
    const updatefn = (x: TestType, y: TestType) => x.name === y.name;
    const fromUpdate = (x: TestType, y: TestType) => { return { ...y, ...x } };
    let db1Kernel: ItemStore<TestType, ArrayCollectionOf<TestType>, false>;
    let db2Kernel: ItemStore<TestType, ArrayCollectionOf<TestType>, true>;
    let db1: Database<InsertType, TestType, TestType, TestType, TestType, false>;
    let db2: Database<TestType, TestType, TestType, TestType, TestType, true>;
    let communicator: Communicator<TestType, ItemStore<TestType, ArrayCollectionOf<TestType>, false>,
        Database<TestType, TestType, TestType, TestType, TestType, true>>;
    beforeEach(() => {
        db1Kernel = new ItemStore<TestType, ArrayCollectionOf<TestType>, false>(initVal, false);
        db2Kernel = new ItemStore<TestType, ArrayCollectionOf<TestType>, true>(initVal, true);
        db2 = new Database<TestType, TestType, TestType, TestType, TestType, true>(db2Kernel, updatefn, rmvfn, toSearch, fromUpdate);
        communicator = new Communicator<TestType, ItemStore<TestType, ArrayCollectionOf<TestType>, false>,
            Database<TestType, TestType, TestType, TestType, TestType, true>>(db1Kernel, db2);
    });
    it('should update all the task correctly', function (done) {
        let expected: Array<TestType> = [
            { id: '1', name: 'alex', age: 13 },
            { id: '2', name: 'alex2', age: 14 },
            { id: '3', name: 'alex3', age: 15 },
        ];
        communicator.submit({ mark: "insert", id: '1', name: 'alex', age: 13 });
        communicator.submit({ mark: "insert", id: '2', name: 'alex2', age: 14 });
        communicator.submit({ mark: "insert", id: '3', name: 'alex3', age: 15 });
        expect(communicator.taskToSubmit.length).is.equal(3);
        communicator.updateKernelAsync(communicator.taskToSubmit);
        expect(communicator.taskToSubmit.length).is.equal(0);
        const expRes = [[], expected];
        let i = 0;
        (db2.searchMany((item: TestType) => item.name === 'alex' || item.name === 'alex2' || item.name === 'alex3'))
            .subscribe(res => expect(res).is.deep.equal(expRes[i++]), err => console.log(err), done);
    });
    it('should connect and can emit signal to update AsyncDB', function (done) {
        let expected: Array<InsertType> = [
            { name: 'async-alex', age: 13 },
            { name: 'async-alex2', age: 14 },
            { name: 'async-alex3', age: 15 },
        ];
        db1 = new Database<InsertType, TestType, TestType, TestType, TestType, false>(db1Kernel);
        let subject = communicator.connect();
        db1.addCommunicator(communicator);
        db1.insertMany(...expected);
        expect(communicator.taskToSubmit.length).is.equal(3);
        expect(db1Kernel.storeBase.state.container.length).is.equal(4);
        subject.next(communicator.taskToSubmit);
        setTimeout(() => {
            expect(communicator.taskToSubmit.length).is.equal(0);
            db2Kernel.storeBase.state$.subscribe(state => { expect(state.container.length).is.equal(4); done() });
        }, 200);
    });
    it('should watch in timeInterval', function (done) {
        let expected: Array<InsertType> = [
            { name: 'async-alex', age: 13 },
            { name: 'async-alex2', age: 14 },
            { name: 'async-alex3', age: 15 },
        ];
        db1 = new Database<InsertType, TestType, TestType, TestType, TestType, false>(db1Kernel);
        communicator.connect();
        communicator.autoTimeIntervalWatch(100).subscribe();
        db1.addCommunicator(communicator);
        db1.insertMany(...expected);
        setTimeout(() => {
            expect(communicator.taskToSubmit.length).is.equal(0);
            db2Kernel.storeBase.state$.subscribe(state => { expect(state.container.length).is.equal(4); done() });
        }, 150);
    });
    it('should remove required items', function (done) {
        let expected: Array<InsertType> = [
            { name: 'async-alex', age: 13 },
            { name: 'async-alex2', age: 14 },
            { name: 'async-alex3', age: 15 },
        ];
        let removal: Array<TestType> = [{ name: 'async-alex', id: '', age: 0 }, { name: 'async-alex2', id: '', age: 0 }];
        db1 = new Database<InsertType, TestType, TestType, TestType, TestType, false>(db1Kernel, updatefn, rmvfn, toSearch);
        communicator.connect();
        communicator.autoTimeIntervalWatch(100).subscribe();
        db1.addCommunicator(communicator);
        const res = db1.insertMany(...expected);
        db1.removeMany(...removal);
        setTimeout(() => {
            expect(communicator.taskToSubmit.length).is.equal(0);
            expect(db1.dbCore.storeBase.state.container.length).is.equal(2);
            expect(db1.searchMany(x => x.name === 'async-alex' || x.name === 'async-alex2')).is.deep.equal([]);
            db2Kernel.storeBase.state$.subscribe(state => { expect(state.container.length).is.equal(2); done() });
        }, 150);
    });
    it('should update items in both dbs', function (done) {
        let expected: Array<InsertType> = [
            { name: 'async-alex', age: 13 },
            { name: 'async-alex2', age: 14 },
            { name: 'async-alex3', age: 15 },
        ];
        let update: Array<TestType> = [{ name: 'async-alex', id: '2', age: 222 }, { name: 'async-alex2', id: '1', age: 333 }];
        db1 = new Database<InsertType, TestType, TestType, TestType, TestType, false>(db1Kernel, updatefn, undefined, toSearch, fromUpdate);
        communicator.connect();
        communicator.autoTimeIntervalWatch(100).subscribe();
        db1.addCommunicator(communicator);
        const res = db1.insertMany(...expected);
        db1.updateMany(...update);
        setTimeout(() => {
            expect(communicator.taskToSubmit.length).is.equal(0);
            expect(db1.searchMany(x => x.name === 'async-alex' || x.name === 'async-alex2')).is.deep.equal(update);
            db2Kernel.findMany(x => x.name === 'async-alex' || x.name === 'async-alex2').subscribe(items => { expect(items).is.deep.equal(update); done() });
        }, 150);
    });
    it('should load the right data', function (done) {
        db1Kernel = new ItemStore<TestType, ArrayCollectionOf<TestType>, false>(new ArrayCollectionOf<TestType>([]), false);
        db2Kernel = new ItemStore<TestType, ArrayCollectionOf<TestType>, true>(initVal, true);
        db2 = new Database<TestType, TestType, TestType, TestType, TestType, true>(db2Kernel, updatefn, rmvfn, toSearch, fromUpdate);
        communicator = new Communicator<TestType, ItemStore<TestType, ArrayCollectionOf<TestType>, false>,
            Database<TestType, TestType, TestType, TestType, TestType, true>>(db1Kernel, db2);
        db1 = new Database<TestType, TestType, TestType, TestType, TestType, false>(db1Kernel, updatefn, undefined, toSearch, fromUpdate);
        communicator.connect();
        communicator.autoTimeIntervalWatch(100).subscribe();
        db1.addCommunicator(communicator);
        expect(db1.dbCore.storeBase.state.container.length).is.equal(0);
        communicator.preload((x: any) => x.id === '123123').subscribe(
            () => {
                expect(db1.search(x => x.name === 'sss')).is.deep.equal({ id: '123123', name: 'sss', age: 11 });
                expect(db1.dbCore.storeBase.state.container.length).is.equal(1);
                done();
            }
        );
    });
});