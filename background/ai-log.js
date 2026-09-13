// Nhat ky moi lan goi AI, de doc lai va tinh chinh prompt.
// Luu ca user message da gui va JSON tho model tra ve, vi khi comment ra khong
// dung y thi can biet no sai o buoc nao: gui thieu du lieu, hay model viet do.

const KEY = 'aiLog';
const MAX = 50;

export async function list() {
  const { aiLog } = await chrome.storage.local.get(KEY);
  return aiLog || [];
}

export async function append(entry) {
  const log = await list();
  log.unshift({ at: Date.now(), ...entry });
  await chrome.storage.local.set({ [KEY]: log.slice(0, MAX) });
}

export async function clear() {
  await chrome.storage.local.set({ [KEY]: [] });
}
