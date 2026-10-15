export const YEARS = [1921, 1953, 1986, 2019, 2052];
export const INTRO_SECONDS = 35;
export const SEEN_KEY = 'party-draft-dark-intro-v1';
export const ERAS = [
  { year:1921, name:'The first passage', ka:'პირველი გასასვლელი', sky:0x171511, fog:0x302a22, rock:0x726455, ground:0x393429, leaf:0x33372a, light:0xe9b26a, accent:'#e3c399', density:.038 },
  { year:1953, name:'Echoes in the forest', ka:'ტყის გამოძახილი', sky:0x151711, fog:0x34352a, rock:0x6b7262, ground:0x303b2d, leaf:0x334936, light:0xffc478, accent:'#e9cc88', density:.032 },
  { year:1986, name:'A fracture in time', ka:'ბზარი დროში', sky:0x100f1f, fog:0x262436, rock:0x535568, ground:0x232833, leaf:0x252f42, light:0xc5afff, accent:'#c7b3ed', density:.027 },
  { year:2019, name:'The familiar becomes strange', ka:'ნაცნობი უცნაურად იქცევა', sky:0x11171a, fog:0x303c40, rock:0x72716a, ground:0x5a5140, leaf:0x343d32, light:0xd3dee0, accent:'#c4ae75', density:.036 },
  { year:2052, name:'What remains', ka:'რაც დარჩა', sky:0x21130c, fog:0x493022, rock:0x766151, ground:0x483a2b, leaf:0x2c251f, light:0xffa059, accent:'#eeb27c', density:.046 }
];
export const wrapYear = (index, delta) => (index + delta + YEARS.length) % YEARS.length;
export function introCard(t) {
  if (t < 7) return {id:'winden',text:'WINDEN'};
  if (t < 14) return {id:'years',text:'1921  1953  1986  2019  2052'};
  if (t < 24) return {id:'beginning',text:'THE BEGINNING IS THE END'};
  if (t < 30) return {id:'dark',text:'DARK'};
  return {id:'dissolve',text:''};
}
export function readSeen(storage) { try { return storage.getItem(SEEN_KEY)==='1'; } catch { return false; } }
export function markSeen(storage) { try { storage.setItem(SEEN_KEY,'1'); } catch { /* Private browsing must not block entry. */ } }
