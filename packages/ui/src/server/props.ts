/**
 * `T` without its event handler props (`onClick`, `onKeyDown`, ...). A Server
 * Component cannot pass a function to the client, so the server entry does not
 * accept one.
 */
export type WithoutHandlers<T> = {
  [K in keyof T as K extends `on${string}` ? never : K]: T[K];
};
