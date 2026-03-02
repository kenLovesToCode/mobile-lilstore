if (typeof global.requestAnimationFrame !== "function") {
  global.requestAnimationFrame = (callback: FrameRequestCallback) =>
    setTimeout(() => callback(Date.now()), 0) as unknown as number;
}

if (typeof global.cancelAnimationFrame !== "function") {
  global.cancelAnimationFrame = (handle: number) => {
    clearTimeout(handle);
  };
}
