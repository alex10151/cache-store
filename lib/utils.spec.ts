import { cmp } from './utils';
import { expect } from 'chai';
import { from } from 'rxjs';
import * as _ from 'lodash';

describe('utils test', () => {
    it('should cmp 2 base types', () => {
        expect(cmp(1, 1)).is.true;
        expect(cmp(1, 2)).is.false;
        expect(cmp('str1', 'str2')).is.false;
        expect(cmp('str1', 'str1')).is.true;
    });
    it('should cmp 2 objs', () => {
        const obj1 = { id: 11, name: 22 };
        const obj2 = { id: 22, name: 33 };
        const obj3 = _.cloneDeep(obj1);
        expect(cmp(obj1, obj2)).is.false;
        expect(cmp(obj1, obj3)).is.true;
    });
    it('should cmp 2 nested objs', () => {
        const obj1 = { id: 11, use: { car: 1, bus: 2 } };
        const obj2 = { id: 11, use: { car: 1, bus: 3 } };
        const obj3 = { id: 11, use: { car: 1, bus: 2 } };
        const obj4 = { id: 11, use: { car: { car1: 'benz', car2: 'landrover' }, bus: 2 } };
        const obj5 = { id: 11, use: { car: { car1: 'benz2', car2: 'landrover2' }, bus: 2 } };
        expect(cmp(obj1, obj2)).is.false;
        expect(cmp(obj1, obj3)).is.true;
        expect(cmp(obj4, obj5)).is.false;
        expect(cmp(obj4, _.cloneDeep(obj4))).is.true;
    });
});