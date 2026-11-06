export class EditingEngineError extends Error {
  constructor(code, message, { path, cause } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "EditingEngineError";
    this.code = code;
    if (path !== undefined) this.path = path;
  }
}

export function isNotFound(error) {
  return error?.code === "not_found" || error?.code === "ENOENT";
}
