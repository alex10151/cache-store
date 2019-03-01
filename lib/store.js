"use strict";
exports.__esModule = true;
function toEither(p, tfn, ffn) {
    return p ? tfn() : ffn();
}
exports.toEither = toEither;
// export class StoreOld<T> {
//   private subject: BehaviorSubject<T[]>;
//   readonly state$: Observable<T[]>;
//   constructor(
//     initailState: T[] = [],
//     private eq: (a: T, b: T) => boolean = (a: T, b: T) => a === b,
//   ) {
//     this.subject = new BehaviorSubject<T[]>(initailState);
//     this.state$ = this.subject.asObservable();
//   }
//   map(fn: (s: T[]) => T[]) {
//     return this.subject.next(fn(this.subject.value));
//   }
//   insert(...values: T[]) {
//     return this.map((state) => [...state, ...values]);
//   }
//   update(...values: T[]) {
//     const result = values.reduce(
//       (xs, v) => {
//         return xs.map((x) => (this.eq(x, v) ? v : x));
//       },
//       [...this.subject.value],
//     );
//     this.subject.next(result);
//   }
//   upsert(...values: T[]) {
//     const result = values.reduce(
//       (xs, v) => {
//         return xs.some((x) => this.eq(x, v))
//           ? xs.map((x) => (this.eq(x, v) ? v : x))
//           : [...xs, v];
//       },
//       [...this.subject.value],
//     );
//     this.subject.next(result);
//   }
//   delete(...values: T[]) {
//     const result = values.reduce(
//       (xs, v) => {
//         return xs.filter((x) => !this.eq(x, v));
//       },
//       [...this.subject.value],
//     );
//     this.subject.next(result);
//   }
//   get state() {
//     return this.subject.value;
//   }
//   set state(newState: T[]) {
//     this.subject.next(newState);
//   }
//   destory() {
//     this.subject.complete();
//   }
// }
