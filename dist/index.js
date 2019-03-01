"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
function main() {
    console.log('Test');
    rxjs_1.interval(100)
        .pipe(operators_1.take(10))
        .subscribe((x) => console.log(x), rxjs_1.noop, () => console.log('Done'));
}
exports.main = main;
main();
