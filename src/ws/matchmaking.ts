// src/ws/matchmaking.ts
type Role = "listener" | "talker";
type PairKey = string;

const listeners = new Set<number>();
const talkers = new Set<number>();
const inChat = new Set<number>();            // กันคนมีห้องซ้ำ
const joinedAt = new Map<number, number>();  // เวลาเข้าคิว (ไว้คำนวณรอนานแค่ไหน)

// DEBUG log
const DBG = process.env.DEBUG_WS === "1";
const dbg = (...a: any[]) => { if (DBG) console.log(...a); };

// ===== นโยบายจับคู่ =====
// กันเจอคู่เดิมภายใน X นาที (คูลดาวน์)
const COOLDOWN_MS = Number(process.env.MATCH_COOLDOWN_MS ?? 10 * 60 * 1000); // default 10 นาที
// ถ้ารอนานเกินกี่ ms จึงยอมให้ "แมตช์ซ้ำ" ได้ (fallback)
const LONG_WAIT_MS = Number(process.env.MATCH_FALLBACK_WAIT_MS ?? 2 * 60 * 1000); // default 2 นาที
// ต้องให้ "ทั้งสองฝ่าย" รอนานหรือไม่ (1 = ต้องทั้งคู่, 0 = ฝ่ายใดฝ่ายหนึ่งพอ)
const REQUIRE_BOTH_LONG_WAIT = (process.env.MATCH_FALLBACK_REQUIRE_BOTH ?? "1") === "1";

// ===== เก็บคู่ที่เพิ่งคุยกัน (คูลดาวน์) =====
const recentPairs = new Map<PairKey, number>(); // key -> expiresAt(ms)

function pairKey(a: number, b: number): PairKey {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function notRecentlyPaired(a: number, b: number): boolean {
  const key = pairKey(a, b);
  const exp = recentPairs.get(key);
  if (!exp) return true;
  if (Date.now() > exp) {
    recentPairs.delete(key);
    return true;
  }
  return false;
}

function cleanupRecentPairs() {
  const now = Date.now();
  for (const [k, exp] of recentPairs) {
    if (exp <= now) recentPairs.delete(k);
  }
}

function waitedMs(uid: number) {
  const at = joinedAt.get(uid) ?? Date.now();
  return Date.now() - at;
}

// ===== API ที่ export ออกไปใช้กับ WS =====
export function snapshot() {
  return {
    talkers: Array.from(talkers),
    listeners: Array.from(listeners),
    inChat: Array.from(inChat),
    recentPairsSize: recentPairs.size,
  };
}

export function joinQueue(uid: number, role: Role) {
  if (inChat.has(uid)) return; // อยู่ในห้องแล้ว ไม่ต้องเข้าคิว

  // กันเผลออยู่สองคิวคนละบทบาทพร้อมกัน
  listeners.delete(uid);
  talkers.delete(uid);

  (role === "listener" ? listeners : talkers).add(uid);
  joinedAt.set(uid, Date.now());
  dbg("[Q] join", { uid, role, ...snapshot() });
}

export function leaveQueue(uid: number) {
  const t0 = talkers.size, l0 = listeners.size;
  listeners.delete(uid);
  talkers.delete(uid);
  joinedAt.delete(uid);
  if (t0 !== talkers.size || l0 !== listeners.size) {
    dbg("[Q] leave", { uid, ...snapshot() });
  }
}

/**
 * หาแมตช์โดย "หลีกเลี่ยงคู่ที่อยู่ในคูลดาวน์" ก่อนเสมอ (พาสหลัก)
 * ถ้าไม่มีคู่ที่ผ่านคูลดาวน์ → fallback: อนุญาตให้เจอซ้ำเมื่อรอนานเกินเกณฑ์
 * หมายเหตุ: Set เก็บลำดับ insertion → ได้ FIFO โดยประมาณ
 */
export function tryMatch(): { talkerId: number; listenerId: number } | null {
  cleanupRecentPairs();

  if (talkers.size === 0 || listeners.size === 0) {
    dbg("[Q] tryMatch NO CANDIDATES", snapshot());
    return null;
  }

  const talkerArr = Array.from(talkers);
  const listenerArr = Array.from(listeners);

  // ---- พาสหลัก: จับคู่ที่ "ไม่ติดคูลดาวน์" ----
  for (const t of talkerArr) {
    if (inChat.has(t)) continue;
    for (const l of listenerArr) {
      if (inChat.has(l)) continue;
      if (!notRecentlyPaired(t, l)) continue;

      // match!
      talkers.delete(t);
      listeners.delete(l);
      inChat.add(t);
      inChat.add(l);
      joinedAt.delete(t);
      joinedAt.delete(l);

      dbg("[Q] MATCH (non-recent)", { t, l, ...snapshot() });
      return { talkerId: t, listenerId: l };
    }
  }

  // ---- Fallback: ยอมให้ซ้ำเมื่อรอนาน ----
  const longWaitTalker = talkerArr.find((t) => !inChat.has(t) && waitedMs(t) > LONG_WAIT_MS);
  const longWaitListener = listenerArr.find((l) => !inChat.has(l) && waitedMs(l) > LONG_WAIT_MS);

  if (REQUIRE_BOTH_LONG_WAIT) {
    // ต้องทั้งสองฝ่ายรอนาน
    if (longWaitTalker != null && longWaitListener != null) {
      talkers.delete(longWaitTalker);
      listeners.delete(longWaitListener);
      inChat.add(longWaitTalker);
      inChat.add(longWaitListener);
      joinedAt.delete(longWaitTalker);
      joinedAt.delete(longWaitListener);

      dbg("[Q] MATCH (fallback: both long wait)", { t: longWaitTalker, l: longWaitListener, ...snapshot() });
      return { talkerId: longWaitTalker, listenerId: longWaitListener };
    }
  } else {
    // ฝ่ายใดฝ่ายหนึ่งรอนานก็ยอม
    if (longWaitTalker != null) {
      const l = listenerArr.find((id) => !inChat.has(id));
      if (l != null) {
        talkers.delete(longWaitTalker);
        listeners.delete(l);
        inChat.add(longWaitTalker);
        inChat.add(l);
        joinedAt.delete(longWaitTalker);
        joinedAt.delete(l);

        dbg("[Q] MATCH (fallback: talker long wait)", { t: longWaitTalker, l, ...snapshot() });
        return { talkerId: longWaitTalker, listenerId: l };
      }
    }
    if (longWaitListener != null) {
      const t = talkerArr.find((id) => !inChat.has(id));
      if (t != null) {
        talkers.delete(t);
        listeners.delete(longWaitListener);
        inChat.add(t);
        inChat.add(longWaitListener);
        joinedAt.delete(t);
        joinedAt.delete(longWaitListener);

        dbg("[Q] MATCH (fallback: listener long wait)", { t, l: longWaitListener, ...snapshot() });
        return { talkerId: t, listenerId: longWaitListener };
      }
    }
  }

  dbg("[Q] tryMatch NO MATCH (respect cooldown)", snapshot());
  return null;
}

/** เรียกเมื่อแชตจบ -> เอาออกจาก inChat + ใส่คูลดาวน์ให้คู่นี้ */
export function markChatEnded(talkerId: number, listenerId: number) {
  inChat.delete(talkerId);
  inChat.delete(listenerId);

  if (talkerId && listenerId && talkerId !== listenerId) {
    recentPairs.set(pairKey(talkerId, listenerId), Date.now() + COOLDOWN_MS);
  }

  dbg("[Q] markChatEnded", { talkerId, listenerId, ...snapshot() });
}

/*
หมายเหตุ:
- ถ้ารันหลาย instance: recentPairs ควรย้ายไป Redis ด้วย TTL
  ตัวอย่างคีย์: recent_pair:{minUid}:{maxUid} ค่า = 1, TTL = COOLDOWN_MS/1000
  - markChatEnded(): SETEX recent_pair:min:max TTL 1
  - tryMatch(): EXISTS recent_pair:min:max
- หากมี “บล็อกถาวร” ให้กรองก่อน notRecentlyPaired() อีกชั้นหนึ่ง
*/
