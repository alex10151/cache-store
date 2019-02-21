"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var rxjs_1 = require("rxjs");
var operators_1 = require("rxjs/operators");
function main() {
    console.log('Test');
    rxjs_1.interval(100)
        .pipe(operators_1.take(10))
        .subscribe(function (x) { return console.log(x); }, rxjs_1.noop, function () { return console.log('Done'); });
}
exports.main = main;
main();
