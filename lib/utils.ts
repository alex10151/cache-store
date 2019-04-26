export function cmp(x: any, y: any): boolean {
    const flag = [];
    if (!(x instanceof Object) && !(y instanceof Object)) {
        if (x == y) {
            flag.push(true);
        }
        else {
            flag.push(false);
        }
    }
    else if ((x instanceof Object) && (y instanceof Object)) {
        for (const key1 of Object.keys(x)) {
            if (y.hasOwnProperty(key1)) {
                flag.push(cmp(x[key1], y[key1]));
            }
            else {
                flag.push(false);
            }

        }
    }
    else {
        flag.push(false);
    }
    return flag.filter(function (x) { return x === false; }).length === 0 ? true : false;
}