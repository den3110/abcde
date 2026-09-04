// utils/parseContacts.js
// Trích xuất liên hệ {email,name,avatar,phone,extId} từ nội dung file
// (JSON array như tệp PickVN, hoặc CSV/TSV, hoặc text chứa email).

const EMAIL_RE = /[^\s@<>()[\]{},;:"']+@[^\s@<>()[\]{},;:"']+\.[a-zA-Z]{2,}/g;
const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || "").trim());

const KEYS = {
  email: ["email", "mail", "e-mail", "địa chỉ email"],
  name: ["name", "fullname", "full_name", "họ tên", "hoten", "ho ten", "username", "tên"],
  avatar: ["avatar_src", "avatar", "avatarurl", "avatar_url", "photo", "image", "picture", "anh", "ảnh"],
  phone: ["phone", "mobile", "phonenumber", "sdt", "sđt", "số điện thoại", "tel"],
  extId: ["id", "code", "ext", "extid", "mã"],
};

function pick(obj, keys) {
  const map = {};
  Object.keys(obj || {}).forEach((k) => (map[k.toLowerCase().trim()] = obj[k]));
  for (const cand of keys) {
    const v = map[cand];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function fromObjects(arr) {
  const out = [];
  for (const o of arr) {
    if (!o || typeof o !== "object") continue;
    const email = pick(o, KEYS.email).toLowerCase();
    if (!isEmail(email)) continue;
    out.push({
      email,
      name: pick(o, KEYS.name),
      avatar: pick(o, KEYS.avatar),
      phone: pick(o, KEYS.phone),
      extId: pick(o, KEYS.extId),
    });
  }
  return out;
}

function splitCsvLine(line, delim) {
  const res = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else q = !q;
    } else if (c === delim && !q) {
      res.push(cur);
      cur = "";
    } else cur += c;
  }
  res.push(cur);
  return res.map((s) => s.trim());
}

function fromDelimited(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (!lines.length) return [];
  const delim = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : ",";
  const header = splitCsvLine(lines[0], delim).map((h) => h.toLowerCase().trim());
  const idxOf = (keys) => header.findIndex((h) => keys.includes(h));
  const iEmail = idxOf(KEYS.email);
  if (iEmail < 0) return []; // không có header email -> để fallback regex
  const iName = idxOf(KEYS.name);
  const iAv = idxOf(KEYS.avatar);
  const iPhone = idxOf(KEYS.phone);
  const iExt = idxOf(KEYS.extId);
  const out = [];
  for (let r = 1; r < lines.length; r += 1) {
    const cells = splitCsvLine(lines[r], delim);
    const email = String(cells[iEmail] || "").trim().toLowerCase();
    if (!isEmail(email)) continue;
    out.push({
      email,
      name: iName >= 0 ? cells[iName] || "" : "",
      avatar: iAv >= 0 ? cells[iAv] || "" : "",
      phone: iPhone >= 0 ? cells[iPhone] || "" : "",
      extId: iExt >= 0 ? cells[iExt] || "" : "",
    });
  }
  return out;
}

function dedupe(list) {
  const seen = new Set();
  const out = [];
  for (const c of list) {
    if (seen.has(c.email)) continue;
    seen.add(c.email);
    out.push(c);
  }
  return out;
}

/**
 * @param {string} text nội dung file
 * @returns {{contacts:Array, format:string}}
 */
export function parseContacts(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return { contacts: [], format: "empty" };

  // 1) JSON
  if (trimmed[0] === "[" || trimmed[0] === "{") {
    try {
      const data = JSON.parse(trimmed);
      const arr = Array.isArray(data)
        ? data
        : data.items || data.data || data.contacts || data.results || [];
      if (Array.isArray(arr) && arr.length) {
        return { contacts: dedupe(fromObjects(arr)), format: "json" };
      }
    } catch {
      /* rơi xuống các cách khác */
    }
  }

  // 2) CSV/TSV có header email
  const delimited = fromDelimited(trimmed);
  if (delimited.length) return { contacts: dedupe(delimited), format: "csv" };

  // 3) Fallback: bắt mọi email trong text
  const found = (trimmed.match(EMAIL_RE) || [])
    .map((e) => e.trim().toLowerCase())
    .filter(isEmail)
    .map((email) => ({ email, name: "", avatar: "", phone: "", extId: "" }));
  return { contacts: dedupe(found), format: found.length ? "text" : "unknown" };
}
