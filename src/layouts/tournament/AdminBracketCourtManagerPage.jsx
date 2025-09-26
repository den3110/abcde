// src/pages/admin/AdminBracketCourtManagerPage.jsx
/* eslint-disable react/prop-types */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useSocket } from "context/SocketContext";
import {
  useUpsertCourtsMutation,
  useBuildGroupsQueueMutation,
  useAssignNextHttpMutation,
  useListMatchesQuery,
} from "slices/adminCourtApiSlice";
import { skipToken } from "@reduxjs/toolkit/query";

// MUI
import {
  Box,
  Grid,
  Paper,
  Stack,
  Typography,
  TextField,
  Button,
  Divider,
  IconButton,
  Tooltip,
  RadioGroup,
  FormControlLabel,
  Radio,
  Chip,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  Autocomplete,
  DialogActions,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveIcon from "@mui/icons-material/Save";
import QueuePlayNextIcon from "@mui/icons-material/QueuePlayNext";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { DataGrid } from "@mui/x-data-grid";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import { toast } from "react-toastify";
import EditNoteIcon from "@mui/icons-material/EditNote"; /* ⭐ NEW: icon sửa trận */
import RestartAltIcon from "@mui/icons-material/RestartAlt"; /* ⭐ NEW: icon reset all */
import CloseIcon from "@mui/icons-material/Close";

/* ================= Helpers (labels, formatters) ================= */
const isNum = (x) => typeof x === "number" && Number.isFinite(x);

// Nhận diện Playoff (PO)
const isPO = (m) => {
  const t = String(m?.type || m?.format || "").toLowerCase();
  return t === "po" || m?.meta?.po === true;
};

// Nhận diện Knockout (KO)
const isKO = (m) => {
  const t = String(m?.type || m?.format || "").toLowerCase();
  return t === "ko" || t === "knockout" || t === "elimination" || m?.meta?.knockout === true;
};

// Chỉ coi là group-like nếu KHÔNG phải KO/PO
const isGroupLike = (m) => {
  if (!m) return false;
  if (isPO(m) || isKO(m)) return false;
  const t = String(m?.type || m?.format || "").toLowerCase();
  if (t === "group" || t === "rr" || t === "roundrobin" || t === "round_robin") return true;
  return !!m?.pool;
};

const viMatchStatus = (s) => {
  switch (s) {
    case "scheduled":
      return "Đã lên lịch";
    case "queued":
      return "Trong hàng đợi";
    case "assigned":
      return "Đã gán trận";
    case "live":
      return "Đang thi đấu";
    case "finished":
      return "Đã kết thúc";
    default:
      return s || "";
  }
};

const matchStatusColor = (s) => {
  switch (s) {
    case "assigned":
      return "info";
    case "live":
      return "warning";
    case "finished":
      return "success";
    case "queued":
    default:
      return "default";
  }
};

const viCourtStatus = (courtStatus) => {
  if (courtStatus === "idle") return "Trống";
  if (courtStatus === "maintenance") return "Bảo trì";
  if (courtStatus === "live") return "Đang thi đấu";
  if (courtStatus === "assigned") return "Đã gán trận";
  return courtStatus || "";
};

const letterToIndex = (s) => {
  const ch = String(s || "")
    .trim()
    .toUpperCase();
  if (/^[A-Z]$/.test(ch)) return ch.charCodeAt(0) - 64;
  return null;
};

const poolBoardLabel = (m) => {
  const p = m?.pool || {};
  if (isNum(p.index)) return `B${p.index}`;
  const raw = String(p.code || p.name || "").trim();
  if (!raw) return "B?";
  const byLetter = letterToIndex(raw);
  if (byLetter) return `B${byLetter}`;
  const m1 = raw.match(/^B(\d+)$/i);
  if (m1) return `B${m1[1]}`;
  if (/^\d+$/.test(raw)) return `B${raw}`;
  return raw;
};

const stageIndexOf = (m) => {
  if (isNum(m?.stageIndex)) return m.stageIndex;
  const lk = String(m?.labelKey || "");
  const hit = /^V(\d+)/i.exec(lk);
  return hit ? Number(hit[1]) : null;
};

const roundTag = (m) => {
  if (!m) return "";
  if (m.roundName) return String(m.roundName).toUpperCase();
  if (typeof m.round === "string") return m.round.toUpperCase();
  if (isGroupLike(m) && isNum(m.round)) return `B${m.round}`;
  if (isNum(m.rrRound)) return `V${m.rrRound}`;
  if ((isKO(m) || isPO(m)) && isNum(m.round)) return `R${m.round}`;
  if (isNum(m.round)) return `R${m.round}`;
  return "";
};

const roundIndexKOPO = (m) => {
  if (isNum(m?.roundIndex)) return m.roundIndex;
  if (isNum(m?.round)) return m.round;
  const tryParse = (str) => {
    const hit = /R(\d+)/i.exec(String(str || ""));
    return hit ? Number(hit[1]) : null;
  };
  return tryParse(m?.labelKey) ?? tryParse(m?.roundName) ?? tryParse(roundTag(m)) ?? null;
};

// ==== QUY ƯỚC MÃ TRẬN (mới) ====
// Ưu tiên dùng code server (global) -> nếu chưa có, FE tính fallback theo rule V-B-T / V-T

const isGlobalCodeString = (s) => typeof s === "string" && /^V\d+(?:-B\d+)?-T\d+$/.test(s);

const poolIndexNumber = (m) => {
  const lbl = poolBoardLabel(m); // thường dạng "B3" hoặc chữ A/B/C...
  const hit = /^B(\d+)$/i.exec(lbl);
  if (hit) return Number(hit[1]);
  // nếu pool.name là chữ cái A/B/C...
  const byLetter = letterToIndex(m?.pool?.name || m?.pool?.code || "");
  return byLetter || 1;
};

// Fallback khi server chưa cung cấp code toàn cục
// - Group-like:  V1-Bx-T{order+1}
// - Non-group:   V{(m.elimOffset||0) + (m.round||1)}-T{order+1}
const fallbackGlobalCode = (m, idx) => {
  const baseOrder =
    typeof m?.order === "number" && Number.isFinite(m.order)
      ? m.order
      : Number.isFinite(idx)
      ? idx
      : 0;
  const T = baseOrder + 1;

  if (isGroupLike(m)) {
    const B = poolIndexNumber(m);
    return `V1-B${B}-T${T}`;
  }

  const elimOffset = Number.isFinite(Number(m?.elimOffset)) ? Number(m.elimOffset) : 0;
  const r = Number.isFinite(Number(m?.round)) ? Number(m.round) : 1;
  const V = elimOffset + r;
  return `V${V}-T${T}`;
};

const buildMatchCode = (m, idx) => {
  if (!m) return "";
  // 1) Ưu tiên code server nếu đúng định dạng global
  if (isGlobalCodeString(m.globalCode)) return m.globalCode;
  if (isGlobalCodeString(m.code)) return m.code;
  // 2) Fallback FE
  return fallbackGlobalCode(m, idx);
};

/* ================= Helpers (labels, formatters) ================= */
const personName = (p) => {
  if (!p || typeof p !== "object") return "";
  // Ưu tiên nickname ở mọi nơi có thể (user, profile…)
  const cands = [
    p.nickname,
    p.nickName,
    p.user?.nickname,
    p.user?.nickName,
    p.profile?.nickname,
    p.profile?.nickName,
    // fallback nếu không có nickname
    p.displayName,
    p.fullName,
    p.name,
    p.email,
    p.phone,
  ];
  for (const v of cands) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
};

const pairName = (pair) => {
  if (!pair) return "";
  // Với đôi, vẫn ưu tiên nickname người chơi hơn là displayName/name ghép sẵn
  const names = [];
  if (pair.player1) names.push(personName(pair.player1));
  if (pair.player2) names.push(personName(pair.player2));

  if (!names.length && Array.isArray(pair.participants)) {
    for (const it of pair.participants) names.push(personName(it?.user || it));
  }

  // Nếu không lấy được từ thành viên, mới fallback sang nhãn của pair
  if (!names.filter(Boolean).length) {
    const label =
      pair.nickname ||
      pair.nickName ||
      pair.shortName ||
      pair.code ||
      pair.displayName ||
      pair.name ||
      "";
    return String(label || "").trim();
  }
  return names.filter(Boolean).join(" & ");
};

const fmtTime = (v) => {
  if (!v) return "";
  try {
    return new Date(v).toLocaleString();
  } catch {
    return "";
  }
};

const STATUS_RANK = { queued: 0, scheduled: 1, assigned: 2, live: 3, finished: 4 };
const statusRank = (s) => STATUS_RANK[String(s || "").toLowerCase()] ?? 9;

const parseTripletFromCode = (code) => {
  const m = /^V(\d+)(?:-B(\d+))?-T(\d+)$/.exec(String(code || "").trim());
  if (!m) return null;
  return { v: Number(m[1]), b: m[2] ? Number(m[2]) : null, t: Number(m[3]) };
};

// Trích {v,b,t} để sort
const tripletOf = (m, idx) => {
  const code = isGlobalCodeString(m?.globalCode)
    ? m.globalCode
    : isGlobalCodeString(m?.code)
    ? m.code
    : fallbackGlobalCode(m, idx);
  const p = parseTripletFromCode(code);
  if (p) return p;

  // Fallback cứng nếu ko parse được
  const t = (Number.isFinite(m?.order) ? m.order : Number.isFinite(idx) ? idx : 0) + 1;
  const b = isGroupLike(m) ? poolIndexNumber(m) : null;
  const v = isGroupLike(m) ? 1 : (Number(m?.elimOffset) || 0) + (Number(m?.round) || 1);
  return { v, b, t };
};

/* ================= Component ================= */
export default function AdminBracketCourtManagerPage() {
  const { bracketId } = useParams();
  const socket = useSocket();
  const navigate = useNavigate();
  const location = useLocation();

  // ---- Lấy tournamentId từ state hoặc query (?tournamentId= / ?t=)
  const searchParams = new URLSearchParams(location.search || "");
  const tournamentId =
    location?.state?.tournamentId || searchParams.get("tournamentId") || searchParams.get("t");
  const bracketName = location?.state?.bracketName || "";
  const tournamentName = location?.state?.tournamentName || "";
  const bracket = bracketId;

  // ---------- UI state ----------
  const [mode, setMode] = useState("count");
  const [count, setCount] = useState(10);
  const [namesText, setNamesText] = useState("Sân 1\nSân 2\nSân 3");

  const names = useMemo(
    () =>
      namesText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    [namesText]
  );

  // realtime state
  const [courts, setCourts] = useState([]);
  const [queue, setQueue] = useState([]);
  const [socketMatches, setSocketMatches] = useState([]);
  const notifQueueRef = useRef([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "info" });

  /* ⭐ NEW: state cho dialog sửa trận */
  const [assignDlgOpen, setAssignDlgOpen] = useState(false);
  const [assignDlgCourt, setAssignDlgCourt] = useState(null); // court object
  const [assignDlgMatchId, setAssignDlgMatchId] = useState("");
  // ---------- RTKQ mutations ----------
  const [upsertCourts, { isLoading: savingCourts }] = useUpsertCourtsMutation();
  const [buildQueue, { isLoading: buildingQueue }] = useBuildGroupsQueueMutation();
  const [assignNextHttp] = useAssignNextHttpMutation();

  // ---------- RTKQ query: finished matches ----------
  const finishedArgs =
    bracket || tournamentId ? { tournamentId, bracket, status: "finished", limit: 500 } : skipToken;

  const {
    data: finishedList = [],
    isFetching: loadingFinished,
    refetch: refetchFinished,
  } = useListMatchesQuery(finishedArgs, {
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  // build map nhanh: id -> match từ socket
  const matchMap = useMemo(() => {
    const map = new Map();
    for (const m of socketMatches) map.set(String(m._id || m.id), m);
    return map;
  }, [socketMatches]);
  /* ⭐ NEW: list các trận có thể chọn để "sửa vào sân" */
  const selectableMatches = useMemo(() => {
    const STATUS_RANK = { queued: 0, scheduled: 1, assigned: 2, live: 3, finished: 4 };
    const statusRank = (s) => STATUS_RANK[String(s || "").toLowerCase()] ?? 9;

    const isGlobalCodeString = (s) => typeof s === "string" && /^V\d+(?:-B\d+)?-T\d+$/.test(s);

    const parseTripletFromCode = (code) => {
      const m = /^V(\d+)(?:-B(\d+))?-T(\d+)$/.exec(String(code || "").trim());
      return m ? { v: Number(m[1]), b: m[2] ? Number(m[2]) : null, t: Number(m[3]) } : null;
    };

    const poolIndexNumber = (m) => {
      const lbl = poolBoardLabel(m); // "B3" hoặc A/B/C...
      const hit = /^B(\d+)$/i.exec(lbl);
      if (hit) return Number(hit[1]);
      const byLetter = letterToIndex(m?.pool?.name || m?.pool?.code || "");
      return byLetter || 1;
    };

    // Fallback V-B-T / V-T nếu server chưa có globalCode
    const fallbackGlobalCode = (m) => {
      const baseOrder = Number.isFinite(m?.order) ? m.order : 0;
      const T = baseOrder + 1;
      if (isGroupLike(m)) {
        const B = poolIndexNumber(m);
        return `V1-B${B}-T${T}`;
      }
      const elimOffset = Number.isFinite(Number(m?.elimOffset)) ? Number(m.elimOffset) : 0;
      const r = Number.isFinite(Number(m?.round)) ? Number(m.round) : 1;
      return `V${elimOffset + r}-T${T}`;
    };

    const tripletOf = (m) => {
      const code = isGlobalCodeString(m?.globalCode)
        ? m.globalCode
        : isGlobalCodeString(m?.code)
        ? m.code
        : fallbackGlobalCode(m);
      const p = parseTripletFromCode(code);
      if (p) return p;
      // Fallback cứng
      const t = (Number.isFinite(m?.order) ? m.order : 0) + 1;
      const b = isGroupLike(m) ? poolIndexNumber(m) : null;
      const v = isGroupLike(m) ? 1 : (Number(m?.elimOffset) || 0) + (Number(m?.round) || 1);
      return { v, b, t };
    };

    const seen = new Set();
    const out = [];
    const push = (m) => {
      if (!m) return;
      const id = String(m._id || m.id);
      if (seen.has(id)) return;
      seen.add(id);
      out.push(m);
    };

    // Ưu tiên lấy từ queue trước, rồi bổ sung từ socket (scheduled/queued/assigned)
    for (const m of queue || []) push(m);
    for (const m of socketMatches || []) {
      const st = String(m?.status || "");
      if (["scheduled", "queued", "assigned"].includes(st)) push(m);
    }

    // ===== Sort mới =====
    out.sort((a, b) => {
      const ta = tripletOf(a); // {v,b,t}
      const tb = tripletOf(b);
      if (ta.v !== tb.v) return ta.v - tb.v; // ƯU TIÊN V TRƯỚC

      const ga = isGroupLike(a);
      const gb = isGroupLike(b);

      if (ga && gb) {
        // Group: T ↑ rồi B ↑
        if (ta.t !== tb.t) return ta.t - tb.t;
        const ba = ta.b ?? 999,
          bb = tb.b ?? 999;
        if (ba !== bb) return ba - bb;
      } else if (!ga && !gb) {
        // KO/PO: T ↑ (V cùng nhau rồi)
        if (ta.t !== tb.t) return ta.t - tb.t;
      } else {
        // Cùng V mà khác kiểu: ưu tiên group trước
        return ga ? -1 : 1;
      }

      // Sau cùng mới tới status (tie-break)
      const sdiff = statusRank(a.status) - statusRank(b.status);
      if (sdiff !== 0) return sdiff;

      // Tie-break thêm
      const oa = Number.isFinite(a.order) ? a.order : 9999;
      const ob = Number.isFinite(b.order) ? b.order : 9999;
      if (oa !== ob) return oa - ob;

      const qa = Number.isFinite(a.queueOrder) ? a.queueOrder : 9999;
      const qb = Number.isFinite(b.queueOrder) ? b.queueOrder : 9999;
      if (qa !== qb) return qa - qb;

      const sa = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
      const sb = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
      return sa - sb;
    });

    return out;
  }, [queue, socketMatches]);

  const matchListLabel = (m) => {
    if (!m) return "";
    const code = buildMatchCode(m);
    // Ưu tiên tên đôi từ người chơi (nickname) -> rồi mới tới pairAName/pairBName
    const A = (m.pairA ? pairName(m.pairA) : "") || m.pairAName || "Đội A";
    const B = (m.pairB ? pairName(m.pairB) : "") || m.pairBName || "Đội B";
    const st = viMatchStatus(m.status);
    return `${code} · ${A} vs ${B} · ${st}`;
  };

  const courtIdToName = useMemo(() => {
    const map = new Map();
    for (const c of courts || []) {
      map.set(String(c._id || c.id), c.name || c.label || c.title || c.code || "");
    }
    return map;
  }, [courts]);

  const courtLabelOf = (m) =>
    m?.courtLabel ||
    courtIdToName.get(String(m?.court || "")) ||
    m?.courtName ||
    m?.courtCode ||
    "";

  // ---------- Socket rooms ----------
  useEffect(() => {
    if (!socket || !tournamentId || !bracket) return;

    socket.emit("scheduler:join", { tournamentId, bracket });

    const onState = ({ courts, matches }) => {
      setCourts(courts || []);
      setSocketMatches(matches || []);
      setQueue((matches || []).map((m) => ({ id: m._id || m.id, ...m })));
    };
    const onNotify = (msg) => {
      notifQueueRef.current = [msg, ...notifQueueRef.current].slice(0, 20);
      setSnackbar({ open: true, message: msg?.message || "", severity: msg?.level || "info" });
    };

    const reqState = () => socket.emit("scheduler:requestState", { tournamentId, bracket });
    const onMatchFinish = () => {
      reqState();
      refetchFinished?.();
    };
    const onMatchUpdate = () => {
      reqState();
    };

    socket.on("scheduler:state", onState);
    socket.on("scheduler:notify", onNotify);
    socket.on?.("match:finish", onMatchFinish);
    socket.on?.("match:update", onMatchUpdate);

    reqState();
    refetchFinished?.();

    const interval = setInterval(() => {
      reqState();
      refetchFinished?.();
    }, 60000);

    return () => {
      clearInterval(interval);
      socket.emit("scheduler:leave", { tournamentId, bracket });
      socket.off("scheduler:state", onState);
      socket.off("scheduler:notify", onNotify);
      socket.off?.("match:finish", onMatchFinish);
      socket.off?.("match:update", onMatchUpdate);
    };
  }, [socket, tournamentId, bracket, refetchFinished]);

  // ---------- handlers ----------
  const handleSaveCourts = async (e) => {
    e.preventDefault();
    if (!tournamentId || !bracket) {
      toast.error("Thiếu mã giải đấu (tournamentId) hoặc giai đoạn (bracket).");
      return;
    }
    const payload =
      mode === "names"
        ? { tournamentId, bracket, names }
        : { tournamentId, bracket, count: Number(count) || 0 };

    try {
      await upsertCourts(payload).unwrap();
      toast.success("Đã lưu danh sách sân và sắp xếp theo hàng đợi.");
      socket?.emit?.("scheduler:requestState", { tournamentId, bracket });
    } catch (err) {
      toast.error(err?.data?.message || err?.error || "Lỗi lưu sân");
    }
  };

  const handleBuildQueue = async () => {
    if (!tournamentId || !bracket) {
      toast.error("Thiếu mã giải đấu (tournamentId) hoặc giai đoạn (bracket).");
      return;
    }
    try {
      const res = await buildQueue({ tournamentId, bracket }).unwrap();
      toast.success(`Đã xếp ${res?.totalQueued ?? 0} trận vào hàng đợi.`);
    } catch (e) {
      toast.error(e?.data?.message || e?.error || "Xếp hàng đợi thất bại");
    } finally {
      socket?.emit?.("scheduler:requestState", { tournamentId, bracket });
    }
  };

  const handleAssignNext = async (courtId) => {
    if (!tournamentId || !bracket || !courtId) return;
    socket?.emit?.("scheduler:assignNext", { tournamentId, courtId, bracket });
    await assignNextHttp({ tournamentId, courtId, bracket }).unwrap();
  };

  /* ⭐ NEW: mở dialog sửa trận vào sân C */
  const openAssignDialog = (court) => {
    setAssignDlgCourt(court || null);
    setAssignDlgMatchId("");
    setAssignDlgOpen(true);
  };
  const closeAssignDialog = () => {
    setAssignDlgOpen(false);
    setAssignDlgCourt(null);
    setAssignDlgMatchId("");
  };

  /* ⭐ NEW: xác nhận gán matchId cụ thể vào court */
  const handleAssignSpecific = async () => {
    if (!tournamentId || !bracket || !assignDlgCourt || !assignDlgMatchId) {
      toast.error("Thiếu thông tin sân hoặc trận để gán.");
      return;
    }
    try {
      // Emit socket: BE nên xử lý thay thế nếu sân đang có trận
      socket?.emit?.("scheduler:assignSpecific", {
        tournamentId,
        bracket,
        courtId: assignDlgCourt._id || assignDlgCourt.id,
        matchId: assignDlgMatchId,
        replace: true,
      });
      setSnackbar({ open: true, severity: "success", message: "Đã yêu cầu gán trận vào sân." });
    } catch (e) {
      setSnackbar({ open: true, severity: "error", message: "Gán trận thất bại." });
    } finally {
      socket?.emit?.("scheduler:requestState", { tournamentId, bracket });
      closeAssignDialog();
    }
  };

  /* ⭐ NEW: reset tất cả sân và gán */
  const handleResetAllCourts = async () => {
    if (!tournamentId || !bracket) return;
    const ok = window.confirm("Xoá TẤT CẢ sân và các gán trận hiện tại?");
    if (!ok) return;
    try {
      // Emit socket reset-all (BE cần hiện thực: xóa courts & dọn gán)
      socket?.emit?.("scheduler:resetAll", { tournamentId, bracket });
      setSnackbar({ open: true, severity: "success", message: "Đã gửi lệnh reset tất cả sân." });
      // (Tuỳ chọn) nếu muốn xoá hết court về 0 qua HTTP:
      // await upsertCourts({ tournamentId, bracket, count: 0 }).unwrap();
    } catch (e) {
      setSnackbar({ open: true, severity: "error", message: "Reset thất bại." });
    } finally {
      socket?.emit?.("scheduler:requestState", { tournamentId, bracket });
      refetchFinished?.();
    }
  };

  const handleRefresh = () => {
    if (!tournamentId || !bracket) return;
    socket?.emit?.("scheduler:requestState", { tournamentId, bracket });
    refetchFinished?.();
  };

  const goMatch = (matchId) => {
    if (!matchId) return;
    navigate(`/admin/matches/${matchId}`);
  };

  // ===== Helpers read-from-socket ONLY =====
  const getMatchForCourt = (c) => {
    if (c?.currentMatchObj) return c.currentMatchObj;
    if (c?.currentMatch) return matchMap.get(String(c.currentMatch)) || null;
    return null;
  };

  const courtDerivedStatus = (c) => {
    const m = getMatchForCourt(c); // đã có helper
    if (c?.status) return c.status; // ưu tiên status từ BE nếu có
    if (!m) return "idle"; // không có trận -> idle
    if (m.status === "live") return "live";
    return "assigned";
  };

  const getMatchCodeForCourt = (c) => {
    const m = getMatchForCourt(c);
    if (!m) return "";
    return buildMatchCode(m); // <-- dùng builder mới
  };

  const getTeamsForCourt = (c) => {
    const m = getMatchForCourt(c);
    if (!m) return { A: "", B: "" };
    const A = (m.pairA ? pairName(m.pairA) : "") || m.pairAName || "";
    const B = (m.pairB ? pairName(m.pairB) : "") || m.pairBName || "";
    return { A, B };
  };

  // ======= Finished matches table =======
  const finishedRows = useMemo(() => {
    const apiItems = Array.isArray(finishedList) ? finishedList : [];
    const normApi = apiItems.map((m) => ({
      id: String(m._id || m.id),
      finishedAt: m.finishedAt || m.endedAt || m.updatedAt || m.endAt || m.completedAt || null,
      ...m,
    }));

    const fromSocket =
      (socketMatches || [])
        .filter((m) => m?.status === "finished")
        .map((m) => ({
          id: String(m._id || m.id),
          finishedAt: m.finishedAt || m.endedAt || m.updatedAt || m.endAt || m.completedAt || null,
          ...m,
        })) || [];

    const map = new Map();
    for (const m of [...normApi, ...fromSocket]) map.set(m.id, m);
    const rows = [...map.values()];

    rows.sort((a, b) => {
      const ta = a.finishedAt ? new Date(a.finishedAt).getTime() : 0;
      const tb = b.finishedAt ? new Date(b.finishedAt).getTime() : 0;
      return tb - ta;
    });
    return rows;
  }, [finishedList, socketMatches]);

  // ===== Decide showing columns =====
  const showPoolQueue = useMemo(() => (queue || []).some((r) => isGroupLike(r)), [queue]);
  const showPoolFinished = useMemo(
    () => (finishedRows || []).some((r) => isGroupLike(r)),
    [finishedRows]
  );

  const showRRQueue = useMemo(
    () => (queue || []).some((r) => isGroupLike(r) && isNum(r?.rrRound)),
    [queue]
  );
  const showRRFinished = useMemo(
    () => (finishedRows || []).some((r) => isGroupLike(r) && isNum(r?.rrRound)),
    [finishedRows]
  );

  const filterMatches = (options, inputValue) => {
    if (!inputValue) return options;
    const rx = buildLooseCodeRegex(inputValue);
    if (!rx) return options;

    const scored = options
      .map((o) => {
        const fields = [
          o?.globalCode, // "V1-B2-T27"
          o?.code, // nếu có
          o?.courtLabel, // "Sân 1"
          o?.pairA?.teamName,
          o?.pairB?.teamName,
        ]
          .filter(Boolean)
          .map(String);

        const hit = fields.some((f) => rx.test(f));
        if (!hit) return null;

        // ưu tiên match theo mã
        let score = 0;
        if (o?.globalCode && rx.test(String(o.globalCode))) score += 4;
        if (o?.code && rx.test(String(o.code))) score += 3;
        if (o?.courtLabel && rx.test(String(o.courtLabel))) score += 1;
        if (
          (o?.pairA?.teamName && rx.test(String(o.pairA.teamName))) ||
          (o?.pairB?.teamName && rx.test(String(o.pairB.teamName)))
        )
          score += 1;

        return { o, score };
      })
      .filter(Boolean)
      .sort(
        (a, b) =>
          b.score - a.score || new Date(a.o.scheduledAt || 0) - new Date(b.o.scheduledAt || 0)
      )
      .map((x) => x.o);

    return scored;
  };

  // Column defs
  const poolColDef = {
    field: "pool",
    headerName: "Bảng",
    width: 110,
    valueGetter: (p) => (isGroupLike(p.row) ? poolBoardLabel(p.row) : ""),
  };

  const rrColDef = {
    field: "rrRound",
    headerName: "Lượt (RR)",
    width: 110,
    valueGetter: (p) => (isGroupLike(p.row) && isNum(p.row?.rrRound) ? p.row.rrRound : ""),
  };

  const queueColumns = useMemo(() => {
    const base = [
      {
        field: "code",
        headerName: "Mã trận",
        width: 170,
        valueGetter: (p) => buildMatchCode(p.row),
      },
      {
        field: "pairAName",
        headerName: "Đội A",
        flex: 1,
        minWidth: 140,
        // Ưu tiên lấy từ pair (nickname), rồi mới fallback pairAName
        valueGetter: (p) => (p.row?.pairA ? pairName(p.row.pairA) : "") || p.row?.pairAName || "",
      },
      {
        field: "pairBName",
        headerName: "Đội B",
        flex: 1,
        minWidth: 140,
        valueGetter: (p) => (p.row?.pairB ? pairName(p.row.pairB) : "") || p.row?.pairBName || "",
      },
      {
        field: "status",
        headerName: "Trạng thái",
        width: 130,
        valueGetter: (p) => viMatchStatus(p.row?.status),
      },
      { field: "queueOrder", headerName: "Thứ tự", width: 90 },
      ...(showPoolQueue ? [poolColDef] : []),
      ...(showRRQueue ? [rrColDef] : []),
      { field: "round", headerName: "Vòng", width: 90, valueGetter: (p) => roundTag(p.row) },
      { field: "order", headerName: "#", width: 70 },
      {
        field: "courtLabel",
        headerName: "Sân",
        width: 120,
        valueGetter: (p) => p.row?.courtLabel || "",
      },
    ];
    return base;
  }, [showPoolQueue, showRRQueue]);

  const finishedColumns = useMemo(() => {
    const base = [
      {
        field: "code",
        headerName: "Mã trận",
        width: 170,
        valueGetter: (p) => buildMatchCode(p.row),
      },
      {
        field: "pairAName",
        headerName: "Đội A",
        flex: 1,
        minWidth: 160,
        valueGetter: (p) => (p.row?.pairA ? pairName(p.row.pairA) : "") || p.row?.pairAName || "",
      },
      {
        field: "pairBName",
        headerName: "Đội B",
        flex: 1,
        minWidth: 160,
        valueGetter: (p) => (p.row?.pairB ? pairName(p.row.pairB) : "") || p.row?.pairBName || "",
      },
      { field: "court", headerName: "Sân", width: 140, valueGetter: (p) => courtLabelOf(p.row) },
      { field: "round", headerName: "Vòng", width: 100, valueGetter: (p) => roundTag(p.row) },
      ...(showPoolFinished ? [poolColDef] : []),
      ...(showRRFinished ? [rrColDef] : []),
      {
        field: "finishedAt",
        headerName: "Kết thúc lúc",
        type: "dateTime",
        width: 190,
        valueGetter: (p) => (p.row?.finishedAt ? new Date(p.row.finishedAt) : null),
        renderCell: (p) => fmtTime(p.row?.finishedAt),
      },
      {
        field: "status",
        headerName: "Trạng thái",
        width: 130,
        valueGetter: (p) => viMatchStatus(p.row?.status),
      },
    ];
    return base;
  }, [showPoolFinished, showRRFinished]);

  /* ⭐ NEW: Dialog sửa trận vào sân */
  const AssignDialog = () => {
    const currentLabel =
      assignDlgCourt?.name ||
      assignDlgCourt?.label ||
      assignDlgCourt?.title ||
      assignDlgCourt?.code ||
      "";
    const valueObj =
      selectableMatches.find((m) => String(m._id || m.id) === assignDlgMatchId) || null;
    return (
      <Dialog open={assignDlgOpen} onClose={closeAssignDialog} fullWidth maxWidth="sm">
        <DialogTitle
          sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
        >
          Gán trận vào sân
          <IconButton onClick={closeAssignDialog} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Alert severity="info">
              Sân: <strong>{currentLabel || "(không rõ)"}</strong>
            </Alert>
            <Autocomplete
              options={selectableMatches}
              getOptionKey={(o) => String(o._id || o.id)}
              getOptionLabel={(o) => matchListLabel(o)}
              value={valueObj}
              onChange={(e, v) => setAssignDlgMatchId(v ? String(v._id || v.id) : "")}
              renderInput={(params) => <TextField {...params} label="Chọn trận để gán" />}
              isOptionEqualToValue={(o, v) => String(o._id || o.id) === String(v._id || v.id)}
            />
            <Typography variant="caption" color="text.secondary">
              * Hệ thống sẽ thay thế trận đang gán (nếu có) bằng trận bạn chọn.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeAssignDialog}>Huỷ</Button>
          <Button variant="contained" onClick={handleAssignSpecific} disabled={!assignDlgMatchId}>
            Xác nhận gán
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />

      <Box sx={{ mx: "auto", p: 2, maxWidth: 1400 }}>
        {/* Header */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            alignItems={{ xs: "flex-start", sm: "center" }}
            justifyContent="space-between"
            spacing={2}
          >
            <Box>
              <Typography variant="h5" fontWeight={700}>
                Điều phối sân
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {bracketName && (
                  <>
                    Giai đoạn: <strong>{bracketName}</strong>
                  </>
                )}
                {tournamentName && (
                  <>
                    {" "}
                    • Giải đấu: <em>{tournamentName}</em>
                  </>
                )}
                {bracketId && (
                  <>
                    {" "}
                    • ID giai đoạn: <code>{bracketId}</code>
                  </>
                )}
                {tournamentId ? (
                  <>
                    {" "}
                    • Mã giải đấu: <code>{tournamentId}</code>
                  </>
                ) : (
                  <span style={{ color: "#d32f2f", marginLeft: 8 }}>
                    (Thiếu tournamentId — thêm vào state hoặc query ?t=)
                  </span>
                )}
              </Typography>
            </Box>

            <Stack direction="row" spacing={1} alignItems="center">
              <Tooltip title="Reset tất cả sân (xoá sân & gỡ gán)">
                <Button
                  onClick={handleResetAllCourts}
                  size="small"
                  variant="outlined"
                  color="error"
                  startIcon={<RestartAltIcon />}
                >
                  Reset tất cả sân
                </Button>
              </Tooltip>
              <Tooltip title="Làm mới">
                <IconButton onClick={handleRefresh}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
              <Button
                onClick={() => navigate(-1)}
                size="small"
                variant="outlined"
                startIcon={<ArrowBackIcon />}
              >
                Quay lại
              </Button>
            </Stack>
          </Stack>
        </Paper>

        {/* Config + Build */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={6}>
            <Paper component="form" onSubmit={handleSaveCourts} sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Cấu hình sân cho giai đoạn
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <RadioGroup value={mode} onChange={(e) => setMode(e.target.value)} row sx={{ mb: 2 }}>
                <FormControlLabel value="count" control={<Radio />} label="Theo số lượng" />
                <FormControlLabel value="names" control={<Radio />} label="Theo tên từng sân" />
              </RadioGroup>

              {mode === "count" ? (
                <TextField
                  label="Số lượng sân"
                  type="number"
                  inputProps={typeof window !== "undefined" ? { min: 1 } : {}}
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                  fullWidth
                  sx={{ mb: 2 }}
                />
              ) : (
                <TextField
                  label="Tên sân (mỗi dòng 1 tên)"
                  value={namesText}
                  onChange={(e) => setNamesText(e.target.value)}
                  fullWidth
                  multiline
                  minRows={6}
                  sx={{ mb: 2 }}
                />
              )}

              <Button
                type="submit"
                variant="contained"
                startIcon={<SaveIcon />}
                disabled={savingCourts}
              >
                {savingCourts ? "Đang lưu..." : "Lưu danh sách sân"}
              </Button>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Xếp hàng đợi theo lượt (Vòng bảng/RR)
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Thuật toán: A1, B1, C1, D1… sau đó A2, B2… (tránh trùng VĐV đang{" "}
                <em>chờ vào sân/đang thi đấu</em>).
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Button
                  onClick={handleBuildQueue}
                  variant="contained"
                  startIcon={<QueuePlayNextIcon />}
                  disabled={buildingQueue}
                >
                  {buildingQueue ? "Đang xếp..." : "Xếp hàng đợi"}
                </Button>
              </Stack>
            </Paper>
          </Grid>
        </Grid>

        {/* Realtime panel */}
        <Paper sx={{ p: 2 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="stretch">
            {/* COURTS */}
            <Box sx={{ flex: 1 }}>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ mb: 1 }}
              >
                <Typography variant="subtitle1">Danh sách sân</Typography>
                <Typography variant="caption" color="text.secondary">
                  {courts.length} sân
                </Typography>
              </Stack>

              <Stack spacing={1}>
                {courts.map((c) => {
                  const m = getMatchForCourt(c);
                  const hasMatch = Boolean(m);
                  const statusLabel = viCourtStatus(courtDerivedStatus(c));
                  const code = getMatchCodeForCourt(c);
                  const teams = getTeamsForCourt(c);
                  const cs = courtDerivedStatus(c);
                  return (
                    <Paper
                      key={c._id}
                      sx={{
                        p: 1.5,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Chip
                          label={c.name}
                          color={
                            cs === "idle"
                              ? "default"
                              : cs === "live"
                              ? "success"
                              : cs === "maintenance"
                              ? "warning"
                              : "info"
                          }
                        />
                        <Typography variant="body2">{statusLabel}</Typography>

                        {hasMatch && (
                          <Chip
                            size="small"
                            color={matchStatusColor(m.status)}
                            label={`Trận: ${viMatchStatus(m.status)}`}
                          />
                        )}

                        {hasMatch && (
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                            {code && (
                              <Chip
                                size="small"
                                variant="outlined"
                                label={`Mã trận: ${code}`}
                                onClick={() => goMatch(m._id || c.currentMatch)}
                                sx={{ cursor: "pointer" }}
                              />
                            )}
                            {(teams.A || teams.B) && (
                              <Typography variant="body2" sx={{ opacity: 0.85 }}>
                                {teams.A || "Đội A"} <b>vs</b> {teams.B || "Đội B"}
                              </Typography>
                            )}
                            {isGroupLike(m) && (
                              <Chip size="small" label={`Bảng ${poolBoardLabel(m)}`} />
                            )}
                            {isGroupLike(m) && isNum(m?.rrRound) && (
                              <Chip size="small" label={`Lượt ${m.rrRound}`} />
                            )}
                          </Stack>
                        )}
                      </Stack>

                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<EditNoteIcon />}
                          onClick={() => openAssignDialog(c)}
                        >
                          Sửa trận vào sân
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<AutorenewIcon />}
                          disabled={courtDerivedStatus(c) !== "idle"}
                          onClick={() => handleAssignNext(c._id)}
                        >
                          Gán trận kế tiếp
                        </Button>
                      </Stack>
                    </Paper>
                  );
                })}

                {courts.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    Chưa có sân nào cho giai đoạn này.
                  </Typography>
                )}
              </Stack>
            </Box>

            {/* QUEUE */}
            <Box sx={{ flex: 1 }}>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ mb: 1 }}
              >
                <Typography variant="subtitle1">Hàng đợi trận đấu</Typography>
                <Tooltip title="Làm mới">
                  <IconButton onClick={handleRefresh} size="small">
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>

              <div style={{ height: 520, width: "100%" }}>
                <DataGrid
                  rows={queue}
                  getRowId={(r) => r.id}
                  columns={queueColumns}
                  disableRowSelectionOnClick
                  pageSizeOptions={[10, 25, 50]}
                  initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
                  onRowClick={(p) => navigate(`/admin/matches/${p.row._id || p.row.id}`)}
                />
              </div>
            </Box>
          </Stack>
        </Paper>

        {/* ======== Finished matches list ======== */}
        <Paper sx={{ p: 2, mt: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="subtitle1">
              Trận đã kết thúc{" "}
              <Typography component="span" variant="caption" color="text.secondary">
                ({loadingFinished ? "đang tải..." : finishedRows.length})
              </Typography>
            </Typography>
            <Tooltip title="Làm mới">
              <IconButton onClick={handleRefresh} size="small">
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>

          <div style={{ height: 520, width: "100%" }}>
            <DataGrid
              rows={finishedRows}
              getRowId={(r) => r.id}
              columns={finishedColumns}
              disableRowSelectionOnClick
              pageSizeOptions={[10, 25, 50]}
              initialState={{
                pagination: { paginationModel: { pageSize: 25 } },
                sorting: { sortModel: [{ field: "finishedAt", sort: "desc" }] },
              }}
              onRowClick={(p) => navigate(`/admin/matches/${p.row._id || p.row.id}`)}
            />
          </div>
        </Paper>

        {/* mini log cho notify */}
        {notifQueueRef.current.length > 0 && (
          <Paper sx={{ p: 2, mt: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              Thông báo gần đây
            </Typography>
            <Stack spacing={1}>
              {notifQueueRef.current.map((n, idx) => (
                <Stack key={idx} direction="row" spacing={1} alignItems="center">
                  <Chip size="small" label={n.level || "info"} variant="outlined" />
                  <Typography variant="body2">
                    {new Date(n.at).toLocaleTimeString()} — {n.message}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Paper>
        )}

        <Snackbar
          open={snackbar.open}
          autoHideDuration={2500}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert
            onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
            severity={snackbar.severity}
            variant="filled"
            sx={{ width: "100%" }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
      <AssignDialog />
    </DashboardLayout>
  );
}
