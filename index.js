const typeChecker = require('js-type-checker');

const PENDING = 0;
const FULFILLED = 1;
const REJECTED = 2;

const thenable = value => {
    if (
        (typeChecker.isObject(value) || typeChecker.isFunction(value))
        && typeChecker.isFunction(value.then)
    ) {
        return value.then;
    }

    return null;
};

/***
 *
 * @param fn
 * @constructor
 *
 * Basic Promise Implementation Adapted From
 * https://www.promisejs.org/implementing/
 *
 */
function IPromise(fn) {
    let state = PENDING;

    let value = null;

    let handlers = [];

    function fulfill(val) {
        state = FULFILLED;
        value = val;
        handlers.forEach(handleResult);
        handlers = null;
    }


    function reject(val) {
        state = REJECTED;
        value = val;
        handlers.forEach(handleResult);
        handlers = null;
    }

    function resolve(val) {
        try {
            const then = thenable(val);
            if (then) {
                resolver(then.bind(val), resolve, reject);
                return;
            }
            fulfill(val);
        } catch (e) {
            reject(e);
        }
    }

    function resolver(fn, onFulfilled, onRejected) {
        let done = false;

        try {
            fn(value => {
                if (done) return;
                done = true;
                onFulfilled(value)
            }, err => {
                if (done) return;
                done = true;
                onRejected(err);
            });
        } catch(e) {
            if (done) return;
            done = true;
            onRejected(value);
        }
    }

    function handleResult(handle) {
        if(state === PENDING){
            handlers.push(handle);
        } else {
            if(state === FULFILLED && typeChecker.isFunction(handle.onFulfilled)) {
                handle.onFulfilled(value);
            }

            if(state === REJECTED && typeChecker.isFunction(handle.onRejected)) {
                handle.onRejected(value);
            }

            if(typeChecker.isFunction(handle.onFinally)) {
                handle.onFinally();
            }
        }
    }

    this.complete = function(onFulfilled, onRejected, onFinally) {
        setTimeout( _ => {
            handleResult({
                onFulfilled,
                onRejected,
                onFinally,
            });
        }, 0);
    };

    this.then = function (onFulfilled, onRejected) {
        const self = this;
        return new IPromise(function(resolve, reject){
            return self.complete(result => {
                if (typeChecker.isFunction(onFulfilled)) {
                    try {
                        return resolve(onFulfilled(result));
                    } catch (e) {
                        return reject(e);
                    }
                } else {
                    return resolve(result);
                }
            }, err => {
                if (typeChecker.isFunction(onRejected)) {
                    try {
                        return resolve(onRejected(error));
                    } catch (e) {
                        return reject(e);
                    }
                } else {
                    return reject(err);
                }
            });
        });
    };

    this.catch = function (onRejected) {
        const self = this;

        return new IPromise(function(resolve, reject){
            return self.complete(null, err => {
                if (typeChecker.isFunction(onRejected)) {
                    try {
                        return resolve(onRejected(err));
                    } catch (e) {
                        return reject(e);
                    }
                } else {
                    return reject(err);
                }
            });
        });
    };

    this.finally = function(onFinally){
        const self = this;

        return new IPromise(function(resolve, reject) {
            return self.complete(null, null, () => {
                if (typeChecker.isFunction(onFinally)) {
                    try {
                        return onFinally();
                    } catch (e) {
                        return reject(e);
                    }
                }
            });
        });
    };

    resolver(fn, resolve, reject);
}

IPromise.resolve = val => {
    return new IPromise(resolve => {
        resolve(val);
    });
};

IPromise.reject = err => {
    return new IPromise((_, reject) => {
        reject(err);
    });
};

IPromise.all = promises => {
    let resolved = [];
    return new IPromise((resolve, reject) => {
        for(let i = 0, len = promises.length; i < len; i++){
            (function resolveIt(index, innerLen) {
                const p = promises[index];
                if(p instanceof IPromise) {
                    p.then(result => {
                        resolved.push(result);
                        if(resolved.length >= innerLen){
                            return resolve(resolved);
                        }
                    }).catch(err => {
                        return reject(err);
                    });
                } else {
                    resolved.push(p);
                }
            }(i, len));
        }
    });
};

IPromise.race = promises => {
    return new IPromise(function(resolve, reject) {
        promises.forEach(p => {
            if(p instanceof IPromise) {
                p.then(resolve).catch(reject);
            } else {
                resolve(p)
            }
        })
    });
};

module.exports = IPromise;