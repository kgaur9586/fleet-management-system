const STORAGE_KEY = 'fleet.auth.token';

// sessionStorage survives a page refresh but clears when the tab/browser closes.
let accessToken: string | null = sessionStorage.getItem(STORAGE_KEY);

export const authToken = {
  get: () => accessToken,
  set: (token: string) => { accessToken = token; sessionStorage.setItem(STORAGE_KEY, token); },
  clear: () => { accessToken = null; sessionStorage.removeItem(STORAGE_KEY); },
};