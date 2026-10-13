import { useSyncExternalStore } from 'react';

const key = 'visionai-guidance-language';
const eventName = 'visionai-language-change';
let fallback = 'en';
function readLanguage() {
  try { return localStorage.getItem(key) === 'mr' ? 'mr' : 'en'; }
  catch { return fallback; }
}
function subscribe(callback) {
  window.addEventListener(eventName, callback);
  window.addEventListener('storage', callback);
  return () => { window.removeEventListener(eventName, callback); window.removeEventListener('storage', callback); };
}
export function usePatientLanguage() {
  const language = useSyncExternalStore(subscribe, readLanguage, () => 'en');
  const setLanguage = value => {
    fallback = value === 'mr' ? 'mr' : 'en';
    try { localStorage.setItem(key, fallback); } catch { /* Continue in memory when storage is unavailable. */ }
    window.dispatchEvent(new Event(eventName));
  };
  return { language, setLanguage, t: (english, marathi) => language === 'mr' ? marathi : english };
}
