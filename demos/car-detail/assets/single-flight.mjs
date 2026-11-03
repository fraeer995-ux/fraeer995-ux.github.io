export function createSingleFlight(task) {
  let inFlight = null;
  const run = (...args) => {
    if (inFlight) return inFlight;
    const request = Promise.resolve().then(() => task(...args));
    inFlight = request;
    const clear = () => {
      if (inFlight === request) inFlight = null;
    };
    request.then(clear, clear);
    return request;
  };
  run.reset = () => { inFlight = null; };
  return run;
}
