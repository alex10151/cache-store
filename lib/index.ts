import { interval, noop } from 'rxjs';
import { take } from 'rxjs/operators';
export function main() {
    console.log('Test');
    interval(100)
        .pipe(take(10))
        .subscribe((x) => console.log(x), noop, () => console.log('Done'));
}

main();
