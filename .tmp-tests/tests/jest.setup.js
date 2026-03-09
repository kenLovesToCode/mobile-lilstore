"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
if (typeof global.requestAnimationFrame !== "function") {
    global.requestAnimationFrame = (callback) => setTimeout(() => callback(Date.now()), 0);
}
if (typeof global.cancelAnimationFrame !== "function") {
    global.cancelAnimationFrame = (handle) => {
        clearTimeout(handle);
    };
}
