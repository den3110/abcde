/* eslint-disable react/prop-types */
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  Box,
  Card,
  Stack,
  Typography,
  Chip,
  Divider,
  IconButton,
  Button,
  Paper,
  TextField,
  MenuItem,
  Tooltip,
  CircularProgress,
  Snackbar,
  Alert,
  Zoom,
  Checkbox,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  RadioGroup,
  Radio,
} from "@mui/material";
import {
  PlayArrow,
  Stop,
  Add,
  Remove,
  Refresh,
  Flag,
  SportsScore,
  Keyboard as KeyboardIcon,
  SportsTennis as ServeIcon,
  Stadium as StadiumIcon,
  Info as InfoIcon,
  GridView as PoolIcon,
  ExpandMore as ExpandMoreIcon,
  FilterAlt as FilterAltIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import { keyframes } from "@emotion/react";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";

import {
  // ✨ Hooks mới cho sidebar (nhớ thêm trong tournamentsApiSlice như đã hướng dẫn):
  useGetRefereeTournamentsQuery,
  useGetRefereeBracketsQuery,
  useListRefereeMatchesByTournamentQuery,
  // Chi tiết + thao tác trận giữ nguyên:
  useGetMatchQuery,
  useRefereeIncPointMutation,
  useRefereeSetGameScoreMutation,
  useRefereeSetStatusMutation,
  useRefereeSetWinnerMutation,
} from "slices/tournamentsApiSlice";
import { useSocket } from "context/SocketContext";
import RefereeMatchesPanel from "./RefereeMatchesPanel";

/* ================= helpers ================= */
// Việt hoá đầy đủ trạng thái trận
export const VI_MATCH_STATUS = {
  all: { label: "Tất cả", color: "default" },
  scheduled: { label: "Chưa xếp", color: "default" },
  queued: { label: "Trong hàng đợi", color: "info" },
  assigned: { label: "Đã gán sân", color: "secondary" },
  live: { label: "Đang thi đấu", color: "warning" },
  finished: { label: "Đã kết thúc", color: "success" },
};
export const getMatchStatusChip = (s) =>
  VI_MATCH_STATUS[s] || { label: s || "—", color: "default" };

// đặt cạnh các helpers khác
const isEditableTarget = (el) => {
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  // input/textarea/select thật sự
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  // contenteditable
  if (el.isContentEditable) return true;
  // MUI input wrapper hoặc những nơi ta đánh dấu bỏ qua
  if (
    el.closest?.(
      '.MuiInputBase-root, [role="combobox"], [contenteditable="true"], [data-hotkeys-ignore="true"]'
    )
  ) {
    return true;
  }
  return false;
};

function nickOrName(p) {
  return p?.nickname || p?.nick || p?.shortName || p?.fullName || p?.name || "N/A";
}
export function pairLabel(reg, eventType = "double") {
  if (!reg) return "—";
  const p1 = nickOrName(reg.player1 || reg.p1);
  const p2 = nickOrName(reg.player2 || reg.p2);
  return eventType === "single" || !p2 ? p1 : `${p1} & ${p2}`;
}
const needWins = (bestOf = 3) => Math.floor(bestOf / 2) + 1;
const isGameWin = (a = 0, b = 0, pointsToWin = 11, winByTwo = true) => {
  const max = Math.max(a, b);
  const min = Math.min(a, b);
  if (max < pointsToWin) return false;
  const diff = max - min;
  return winByTwo ? diff >= 2 : diff >= 1;
};

// Gợi ý chú thích vòng bảng
export const poolNote = (m) => {
  const isGroup =
    (m?.format || "").toLowerCase() === "group" ||
    (m?.bracket?.type || "").toLowerCase() === "group";
  if (!isGroup) return "";
  const poolName = m?.pool?.name ? `Bảng ${m.pool.name}` : "Vòng bảng";
  const rr = Number.isFinite(Number(m?.rrRound)) ? ` • Lượt ${m.rrRound}` : "";
  return `${poolName}${rr}`;
};

const isGroupType = (m) =>
  (m?.format || "").toLowerCase() === "group" || (m?.bracket?.type || "").toLowerCase() === "group";

/** Trả về số thứ tự trận để hiển thị (#)
 * - Vòng bảng: +1
 * - Khác: giữ nguyên
 * - Nếu không có order: group -> 1, non-group -> 0
 */
export const displayOrder = (m) => {
  const hasOrd = Number.isFinite(Number(m?.order));
  const ord = hasOrd ? Number(m.order) : null;
  if (ord === null) return isGroupType(m) ? 1 : 0;
  return isGroupType(m) ? ord + 1 : ord;
};

// Mã trận: KO/PO -> R{round}#{order}, Group -> G{pool}#{displayOrder}, còn lại fallback R{round}#{order}
export function matchCode(m) {
  const t = (m?.bracket?.type || m?.format || "").toLowerCase();
  const ord = Number.isFinite(Number(m?.order)) ? Number(m.order) : 0;
  if (t === "knockout" || t === "ko" || t === "roundelim" || t === "po") {
    return `R${m?.round ?? "?"}#${ord}`;
  }
  if (t === "group") {
    const pool = m?.pool?.name ? String(m.pool.name) : "";
    return `G${pool || "-"}#${displayOrder(m)}`;
  }
  return `R${m?.round ?? "?"}#${ord}`;
}

// debounce nho nhỏ cho ô tìm kiếm
function useDebounced(value, delay = 400) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

/* ======== Animations ======== */
const pulse = keyframes`
  0%   { transform: scale(1); box-shadow: 0 0 0 0 rgba(25,118,210,.35); }
  40%  { transform: scale(1.02); box-shadow: 0 0 0 10px rgba(25,118,210,0); }
  100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(25,118,210,0); }
`;
const ring = keyframes`
  0%   { opacity: 0.9; transform: translate(-50%,-50%) scale(.8); }
  100% { opacity: 0;   transform: translate(-50%,-50%) scale(2.6); }
`;
const pop = keyframes`
  0%   { opacity: 0; transform: translate(-50%,-50%) scale(.6); }
  40%  { opacity: 1; transform: translate(-50%,-50%) scale(1.2); }
  100% { opacity: 0; transform: translate(-50%,-50%) scale(.9); }
`;
const sparkle = keyframes`
  0%   { opacity: 0; transform: translate(-50%,-50%) rotate(0) scale(.5); }
  30%  { opacity: 1; }
  100% { opacity: 0; transform: translate(-50%,-50%) rotate(40deg) scale(1.4); }
`;

function ScoreBurst({ show, color = "primary.main" }) {
  return (
    <Zoom in={show} timeout={200} unmountOnExit>
      <Box
        sx={{
          pointerEvents: "none",
          position: "absolute",
          top: 12,
          left: "50%",
          transform: "translateX(-50%)",
          width: 96,
          height: 72,
        }}
      >
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: 10,
            height: 10,
            borderRadius: "50%",
            bgcolor: color,
            transform: "translate(-50%,-50%)",
            animation: `${pop} 600ms ease-out`,
          }}
        />
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: 14,
            height: 14,
            borderRadius: "50%",
            border: "2px solid",
            borderColor: color,
            transform: `translate(-50%,-50%)`,
            animation: `${ring} 700ms ease-out`,
          }}
        />
        {[-22, 12, 36].map((deg, i) => (
          <Box
            key={i}
            sx={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: 8,
              height: 8,
              borderRadius: "2px",
              bgcolor: color,
              transformOrigin: "0 0",
              animation: `${sparkle} 750ms ease-out`,
              filter: "brightness(1.1)",
              "&::after": {
                content: '""',
                position: "absolute",
                width: 5,
                height: 5,
                borderRadius: "1px",
                bgcolor: color,
                top: -6,
                left: 2,
              },
              transform: `translate(-50%,-50%) rotate(${deg}deg)`,
            }}
          />
        ))}
      </Box>
    </Zoom>
  );
}

/* ======= Helper: chốt ván sớm -> tạo tỉ số tối thiểu hợp lệ ======= */
function computeEarlyFinalizeScore(curA, curB, { pointsToWin = 11, winByTwo = true }, winner) {
  const needGap = winByTwo ? 2 : 1;
  if (winner === "A") {
    const base = Math.max(pointsToWin, curA, curB + needGap);
    const finalA = base;
    const finalB = Math.min(curB, finalA - needGap);
    return { a: finalA, b: finalB };
  } else {
    const base = Math.max(pointsToWin, curB, curA + needGap);
    const finalB = base;
    const finalA = Math.min(curA, finalB - needGap);
    return { a: finalA, b: finalB };
  }
}

/* =================================================================== */
/* ===================== MAIN: Referee Console ======================= */
/* =================================================================== */

export default function AdminRefereeConsole() {
  const [selectedId, setSelectedId] = useState(null);

  // Chi tiết trận
  const {
    data: match,
    isLoading: detailLoading,
    isFetching: detailFetching,
    error: detailErr,
    refetch: refetchDetail,
  } = useGetMatchQuery(selectedId, { skip: !selectedId });

  const [incPoint] = useRefereeIncPointMutation();
  const [setGame] = useRefereeSetGameScoreMutation();
  const [setStatus] = useRefereeSetStatusMutation();
  const [setWinner] = useRefereeSetWinnerMutation();

  const socket = useSocket();

  const [snack, setSnack] = useState({ open: false, type: "success", msg: "" });
  const showSnack = (type, msg) => setSnack({ open: true, type, msg });

  // Tuỳ chọn tự sang ván tiếp theo (mặc định: tắt)
  const [autoNextGame, setAutoNextGame] = useState(false);

  // Hộp thoại kết thúc ván sớm
  const [earlyOpen, setEarlyOpen] = useState(false);
  const [earlyWinner, setEarlyWinner] = useState("A");
  const [useCurrentScore, setUseCurrentScore] = useState(false);

  // join room & realtime
  useEffect(() => {
    if (!socket || !selectedId) return;

    socket.emit("match:join", { matchId: selectedId });

    const onPatched = (payload) => {
      const id = payload?.matchId || payload?.data?._id || payload?._id;
      if (id === selectedId) refetchDetail();
    };
    socket.on("status:updated", onPatched);
    socket.on("winner:updated", onPatched);
    socket.on("match:patched", onPatched);
    socket.on("match:update", onPatched);
    socket.on("match:snapshot", onPatched);

    return () => {
      socket.emit("match:leave", { matchId: selectedId });
      socket.off("match:patched", onPatched);
      socket.off("status:updated", onPatched);
      socket.off("winner:updated", onPatched);
      socket.off("match:update", onPatched);
      socket.off("match:snapshot", onPatched);
    };
  }, [socket, selectedId, refetchDetail]);

  const refreshDetail = () => {
    if (selectedId) refetchDetail();
  };

  /* ===== derived from detail ===== */
  const rules = match?.rules || { bestOf: 3, pointsToWin: 11, winByTwo: true };
  const eventType = (match?.tournament?.eventType || "double").toLowerCase();
  const isSingles = eventType === "single";
  const isDoubles = !isSingles;
  const gs = match?.gameScores || [];
  const needSetWinsVal = needWins(rules.bestOf);

  const currentIndex = Math.max(0, gs.length - 1);
  const curA = gs[currentIndex]?.a ?? 0;
  const curB = gs[currentIndex]?.b ?? 0;

  const serve = match?.serve || { side: "A", server: 2 };
  const callout = isDoubles
    ? serve.side === "A"
      ? `${curA}-${curB}-${serve.server}`
      : `${curB}-${curA}-${serve.server}`
    : "";

  const gameDone = isGameWin(curA, curB, rules.pointsToWin, rules.winByTwo);
  const aWins = gs.filter(
    (g) => isGameWin(g?.a, g?.b, rules.pointsToWin, rules.winByTwo) && g.a > g.b
  ).length;
  const bWins = gs.filter(
    (g) => isGameWin(g?.a, g?.b, rules.pointsToWin, rules.winByTwo) && g.b > g.a
  ).length;
  const matchPointReached = aWins === needSetWinsVal || bWins === needSetWinsVal;

  /* ===== score highlight states ===== */
  const [flashA, setFlashA] = useState(false);
  const [flashB, setFlashB] = useState(false);
  const prevRef = useRef({ matchId: null, gi: 0, a: 0, b: 0 });

  useEffect(() => {
    if (!match) return;
    const gi = currentIndex;
    const a = curA;
    const b = curB;

    if (prevRef.current.matchId === match._id && prevRef.current.gi === gi) {
      if (a > prevRef.current.a) {
        setFlashA(true);
        setTimeout(() => setFlashA(false), 750);
      }
      if (b > prevRef.current.b) {
        setFlashB(true);
        setTimeout(() => setFlashB(false), 750);
      }
    }
    prevRef.current = { matchId: match._id, gi, a, b };
  }, [match?._id, currentIndex, curA, curB]);

  /* ===== actions ===== */
  const onStart = async () => {
    if (!match) return;
    try {
      await setStatus({ matchId: match._id, status: "live" }).unwrap();
      socket?.emit("status:update", { matchId: match._id, status: "live" });
      if (gs.length === 0) {
        await setGame({ matchId: match._id, gameIndex: 0, a: 0, b: 0 }).unwrap();
      }
    } catch (e) {
      showSnack("error", e?.data?.message || e?.error || "Không thể start");
    }
  };
  const onFinish = async () => {
    if (!match) return;
    let w = match.winner || "";
    if (aWins !== bWins) w = aWins > bWins ? "A" : "B";
    try {
      if (w) await setWinner({ matchId: match._id, winner: w }).unwrap();
      await setStatus({ matchId: match._id, status: "finished" }).unwrap();
      socket?.emit("status:update", { matchId: match._id, status: "finished", winner: w });
    } catch (e) {
      showSnack("error", e?.data?.message || e?.error || "Không thể finish");
    }
  };
  const onPickWinner = async (w) => {
    if (!match) return;
    try {
      await setWinner({ matchId: match._id, winner: w }).unwrap();
      socket?.emit("winner:update", { matchId: match._id, winner: w });
    } catch (e) {
      showSnack("error", e?.data?.message || e?.error || "Không thể đặt winner");
    }
  };

  const inc = async (side /* 'A'|'B' */) => {
    if (!match || match.status !== "live") return;
    try {
      await incPoint({ matchId: match._id, side, delta: +1 }).unwrap();
      socket?.emit("score:inc", { matchId: match._id, side, delta: +1 });
      if (side === "A") {
        setFlashA(true);
        setTimeout(() => setFlashA(false), 750);
      } else {
        setFlashB(true);
        setTimeout(() => setFlashB(false), 750);
      }
    } catch (e) {
      showSnack("error", e?.data?.message || e?.error || "Không thể cộng điểm");
    }
  };
  const dec = async (side) => {
    if (!match || match.status === "finished") return;
    try {
      await incPoint({ matchId: match._id, side, delta: -1 }).unwrap();
      socket?.emit("score:inc", { matchId: match._id, side, delta: -1 });
    } catch (e) {
      showSnack("error", e?.data?.message || e?.error || "Không thể trừ điểm");
    }
  };

  const startNextGame = async () => {
    if (!match) return;
    if (!gameDone || matchPointReached) return;
    try {
      await setGame({ matchId: match._id, gameIndex: gs.length, a: 0, b: 0 }).unwrap();
      socket?.emit("match:patched", { matchId: match._id });
    } catch (e) {
      showSnack("error", e?.data?.message || e?.error || "Không thể tạo ván mới");
    }
  };

  const onClickStartNext = () => {
    if (!match) return;
    if (autoNextGame) {
      startNextGame();
    } else {
      setEarlyWinner("A");
      setUseCurrentScore(false);
      setEarlyOpen(true);
    }
  };

  const confirmEarlyEnd = async () => {
    if (!match) return;
    try {
      if (useCurrentScore) {
        if (curA === curB) {
          showSnack(
            "error",
            "Đang hòa, không thể ghi nhận đúng tỉ số hiện tại. Hãy bỏ chọn hoặc chọn đội thắng."
          );
          return;
        }
        await setGame({
          matchId: match._id,
          gameIndex: currentIndex,
          a: curA,
          b: curB,
        }).unwrap();

        if (!matchPointReached && gs.length < rules.bestOf) {
          await setGame({ matchId: match._id, gameIndex: gs.length, a: 0, b: 0 }).unwrap();
        }

        socket?.emit("match:patched", { matchId: match._id });
        setEarlyOpen(false);
        showSnack(
          "success",
          `Đã chốt ván #${currentIndex + 1} (${curA > curB ? "A" : "B"} thắng) và bắt đầu ván mới`
        );
        return;
      }

      const winner = curA === curB ? earlyWinner : curA > curB ? "A" : "B";
      const fin = computeEarlyFinalizeScore(curA, curB, rules, winner);

      await setGame({
        matchId: match._id,
        gameIndex: currentIndex,
        a: fin.a,
        b: fin.b,
      }).unwrap();

      if (!matchPointReached && gs.length < rules.bestOf) {
        await setGame({ matchId: match._id, gameIndex: gs.length, a: 0, b: 0 }).unwrap();
      }

      socket?.emit("match:patched", { matchId: match._id });
      setEarlyOpen(false);
      showSnack(
        "success",
        `Đã chốt ván #${currentIndex + 1} (thắng: ${winner}) và bắt đầu ván mới`
      );
    } catch (e) {
      showSnack("error", e?.data?.message || e?.error || "Không thể kết thúc ván sớm");
    }
  };

  // hotkeys
  useEffect(() => {
    const onKey = (e) => {
      // ❗ BỎ QUA khi đang gõ trong input/textarea/autocomplete hoặc đang mở dialog
      if (isEditableTarget(e.target) || earlyOpen) return;

      if (!match) return;
      const k = e.key.toLowerCase();

      // chỉ chặn khi thực sự dùng hotkeys ngoài input
      if (["a", "z", "k", "m", " "].includes(k)) e.preventDefault();

      if (k === "a") inc("A");
      if (k === "z") dec("A");
      if (k === "k") inc("B");
      if (k === "m") dec("B");
      if (k === " ") {
        if (match.status !== "live") onStart();
        else onFinish();
      }
    };

    window.addEventListener("keydown", onKey, { passive: false });
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line
  }, [match?.status, selectedId, gs.length, curA, curB, earlyOpen]);

  // Auto-next khi ván kết thúc
  const lastGameDoneRef = useRef(false);
  useEffect(() => {
    if (!match) return;
    if (
      autoNextGame &&
      match.status === "live" &&
      !matchPointReached &&
      gs.length < rules.bestOf &&
      gameDone &&
      !lastGameDoneRef.current
    ) {
      startNextGame();
    }
    lastGameDoneRef.current = gameDone;
    // eslint-disable-next-line
  }, [autoNextGame, gameDone, match?.status, matchPointReached, gs.length, rules.bestOf]);

  const startBtnDisabled = autoNextGame
    ? !(match?.status === "live" && gameDone && !matchPointReached && gs.length < rules.bestOf)
    : !(match?.status === "live" && !matchPointReached && gs.length < rules.bestOf);

  /* ================= Render ================= */
  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box p={2} display="grid" gridTemplateColumns={{ xs: "1fr", md: "380px 1fr" }} gap={2}>
        {/* ===== Sidebar mới: accordion theo giải ===== */}
        <RefereeMatchesPanel selectedId={selectedId} onPickMatch={(id) => setSelectedId(id)} />

        {/* ===== Main ===== */}
        {!selectedId ? (
          <Box display="grid" placeItems="center" minHeight={400}>
            <Typography>Chọn một trận ở bên trái để bắt đầu chấm điểm.</Typography>
          </Box>
        ) : detailLoading && !match ? (
          <Box textAlign="center" py={6}>
            <CircularProgress />
          </Box>
        ) : detailErr ? (
          <Alert severity="error">{detailErr?.data?.message || detailErr?.error}</Alert>
        ) : !match ? (
          <Alert severity="warning">Không tìm thấy trận.</Alert>
        ) : (
          <Stack spacing={2}>
            {/* Header */}
            <Card sx={{ p: 2, position: "relative" }}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                flexWrap="wrap"
                rowGap={1}
              >
                <Box>
                  <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                    <Typography variant="h5" fontWeight={700}>
                      {pairLabel(
                        match.pairA,
                        (match?.tournament?.eventType || "double").toLowerCase()
                      )}{" "}
                      <span style={{ opacity: 0.6 }}>vs</span>{" "}
                      {pairLabel(
                        match.pairB,
                        (match?.tournament?.eventType || "double").toLowerCase()
                      )}
                    </Typography>
                  </Stack>

                  {/* dòng mô tả */}
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Typography variant="body2" color="text.secondary">
                      {match.tournament?.name} • Nhánh {match.bracket?.name} ({match.bracket?.type})
                      • Giai đoạn {match.bracket?.stage} • Ván {match.round} • Trận #
                      {displayOrder(match)}
                    </Typography>
                    {poolNote(match) && (
                      <Chip
                        size="small"
                        icon={<PoolIcon sx={{ fontSize: 14 }} />}
                        label={poolNote(match)}
                        color="info"
                        variant="outlined"
                      />
                    )}
                    {(match.court?.name || match.courtName) && (
                      <Chip
                        size="small"
                        icon={<StadiumIcon sx={{ fontSize: 14 }} />}
                        label={match.court?.name || match.courtName}
                        variant="outlined"
                      />
                    )}
                  </Stack>

                  <Typography variant="caption" color="text.secondary">
                    Thắng {Math.ceil(rules.bestOf / 2)}/{rules.bestOf} ván • Tới {rules.pointsToWin}{" "}
                    điểm {rules.winByTwo ? "(phải hơn 2 điểm)" : "(không cần hơn 2 điểm)"}
                  </Typography>
                </Box>

                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  {/* Trạng thái trận */}
                  <Chip size="small" {...getMatchStatusChip(match.status)} />
                  {isDoubles && (
                    <Chip
                      size="small"
                      color="info"
                      icon={<ServeIcon fontSize="small" />}
                      label={`Giao: ${match?.serve?.side || "A"}#${match?.serve?.server || 2}`}
                    />
                  )}
                  {Number.isFinite(Number(match?.queueOrder)) && match.status === "queued" && (
                    <Chip
                      size="small"
                      icon={<InfoIcon sx={{ fontSize: 16 }} />}
                      label={`Thứ tự hàng đợi: ${match.queueOrder}`}
                      variant="outlined"
                    />
                  )}
                  <Tooltip title="Phím tắt: A/Z (A +/−), K/M (B +/−), Space (Start/Finish)">
                    <KeyboardIcon fontSize="small" />
                  </Tooltip>
                  <Tooltip title="Bắt đầu (live)">
                    <span>
                      <IconButton onClick={onStart} disabled={match.status === "live"}>
                        <PlayArrow />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Kết thúc trận">
                    <span>
                      <IconButton onClick={onFinish} disabled={match.status === "finished"}>
                        <Stop />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              </Stack>

              {/* progress mỏng khi refetch */}
              {detailFetching && (
                <Box
                  sx={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: -2,
                    height: 2,
                    bgcolor: "action.hover",
                  }}
                />
              )}
            </Card>

            {/* Big scoreboard */}
            <Card sx={{ p: 2, position: "relative" }}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="stretch">
                {/* Team A */}
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    flex: 1,
                    display: "grid",
                    position: "relative",
                    borderWidth: 2,
                    borderColor: match?.serve?.side === "A" ? "primary.main" : "divider",
                    boxShadow:
                      match?.serve?.side === "A"
                        ? "0 0 0 2px rgba(25,118,210,.20) inset, 0 0 14px rgba(25,118,210,.25)"
                        : "none",
                    transition: "border-color .2s ease, box-shadow .2s ease",
                    animation: flashA ? `${pulse} 550ms ease-out` : "none",
                    "&::before":
                      match?.serve?.side === "A"
                        ? {
                            content: '""',
                            position: "absolute",
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: 6,
                            bgcolor: "primary.main",
                            borderTopLeftRadius: 8,
                            borderBottomLeftRadius: 8,
                          }
                        : {},
                  }}
                >
                  <ScoreBurst show={flashA} color="primary.main" />
                  <Typography fontWeight={800} textAlign="center" sx={{ mb: 1 }}>
                    A){" "}
                    {pairLabel(
                      match.pairA,
                      (match?.tournament?.eventType || "double").toLowerCase()
                    )}
                  </Typography>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto 1fr",
                      alignItems: "center",
                      gap: 2,
                      py: 1,
                    }}
                  >
                    <IconButton
                      onClick={() => dec("A")}
                      disabled={match.status === "finished"}
                      size="large"
                    >
                      <Remove fontSize="inherit" />
                    </IconButton>
                    <Typography
                      variant="h2"
                      textAlign="center"
                      fontWeight={900}
                      sx={{
                        lineHeight: 1,
                        transition: "color .2s ease, text-shadow .2s ease",
                        color: flashA ? "primary.main" : "inherit",
                        textShadow: flashA ? "0 0 10px rgba(25,118,210,.35)" : "none",
                      }}
                    >
                      {curA}
                    </Typography>
                    <IconButton
                      onClick={() => inc("A")}
                      disabled={match.status !== "live" || matchPointReached || gameDone}
                      size="large"
                    >
                      <Add fontSize="inherit" />
                    </IconButton>
                  </Box>
                </Paper>

                {/* middle */}
                <Box
                  sx={{
                    px: 2,
                    display: "grid",
                    alignContent: "center",
                    justifyItems: "center",
                    minWidth: 120,
                  }}
                >
                  <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
                    SET #{currentIndex + 1 || 1}
                  </Typography>
                  <Typography variant="subtitle2" color="text.secondary">
                    (cần thắng {needSetWinsVal} set)
                  </Typography>
                </Box>

                {/* Team B */}
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    flex: 1,
                    display: "grid",
                    position: "relative",
                    borderWidth: 2,
                    borderColor: match?.serve?.side === "B" ? "primary.main" : "divider",
                    boxShadow:
                      match?.serve?.side === "B"
                        ? "0 0 0 2px rgba(25,118,210,.20) inset, 0 0 14px rgba(25,118,210,.25)"
                        : "none",
                    transition: "border-color .2s ease, box-shadow .2s ease",
                    animation: flashB ? `${pulse} 550ms ease-out` : "none",
                    "&::before":
                      match?.serve?.side === "B"
                        ? {
                            content: '""',
                            position: "absolute",
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: 6,
                            bgcolor: "primary.main",
                            borderTopLeftRadius: 8,
                            borderBottomLeftRadius: 8,
                          }
                        : {},
                  }}
                >
                  <ScoreBurst show={flashB} color="primary.main" />
                  <Typography fontWeight={800} textAlign="center" sx={{ mb: 1 }}>
                    B){" "}
                    {pairLabel(
                      match.pairB,
                      (match?.tournament?.eventType || "double").toLowerCase()
                    )}
                  </Typography>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto 1fr",
                      alignItems: "center",
                      gap: 2,
                      py: 1,
                    }}
                  >
                    <IconButton
                      onClick={() => dec("B")}
                      disabled={match.status === "finished"}
                      size="large"
                    >
                      <Remove fontSize="inherit" />
                    </IconButton>
                    <Typography
                      variant="h2"
                      textAlign="center"
                      fontWeight={900}
                      sx={{
                        lineHeight: 1,
                        transition: "color .2s ease, text-shadow .2s ease",
                        color: flashB ? "primary.main" : "inherit",
                        textShadow: flashB ? "0 0 10px rgba(25,118,210,.35)" : "none",
                      }}
                    >
                      {curB}
                    </Typography>
                    <IconButton
                      onClick={() => inc("B")}
                      disabled={match.status !== "live" || matchPointReached || gameDone}
                      size="large"
                    >
                      <Add fontSize="inherit" />
                    </IconButton>
                  </Box>
                </Paper>
              </Stack>

              <Divider sx={{ my: 2 }} />

              {/* Pickleball callout + chỉnh giao bóng */}
              {isDoubles && (
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={2}
                  alignItems="center"
                  mb={1}
                  flexWrap="wrap"
                >
                  <Paper variant="outlined" sx={{ px: 2, py: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Typography fontWeight={700}>Cách đọc điểm:</Typography>
                      <Chip
                        color="primary"
                        label={`${callout} (đội giao - đội nhận - người giao)`}
                      />
                    </Stack>
                  </Paper>

                  <Stack
                    direction="row"
                    spacing={1}
                    flexWrap="wrap"
                    alignItems="center"
                    sx={{ rowGap: 1 }}
                  >
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        try {
                          socket?.emit("serve:set", {
                            matchId: match._id,
                            side: "A",
                            server: match?.serve?.server || 2,
                          });
                          showSnack("info", `Đã đặt đội giao: A`);
                        } catch (e) {
                          showSnack("error", e?.data?.message || e?.error || "Không thể đổi giao");
                        }
                      }}
                    >
                      Giao: A
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        socket?.emit("serve:set", {
                          matchId: match._id,
                          side: "B",
                          server: match?.serve?.server || 2,
                        });
                        showSnack("info", `Đã đặt đội giao: B`);
                      }}
                    >
                      Giao: B
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        socket?.emit("serve:set", {
                          matchId: match._id,
                          side: match?.serve?.side || "A",
                          server: 1,
                        });
                        showSnack("info", `Đã đặt người giao: #1`);
                      }}
                    >
                      Người #1
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        socket?.emit("serve:set", {
                          matchId: match._id,
                          side: match?.serve?.side || "A",
                          server: 2,
                        });
                        showSnack("info", `Đã đặt người giao: #2`);
                      }}
                    >
                      Người #2
                    </Button>
                  </Stack>
                </Stack>
              )}

              {/* sets */}
              <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
                <SportsScore fontSize="small" />
                <Typography fontWeight={700}>Tỷ số từng ván</Typography>
                {Array.from({ length: Math.max(gs.length, rules.bestOf) }).map((_, i) => {
                  const a = gs[i]?.a;
                  const b = gs[i]?.b;
                  const done = isGameWin(a, b, rules.pointsToWin, rules.winByTwo);
                  const lbl =
                    typeof a === "number" && typeof b === "number"
                      ? `#${i + 1} ${a}-${b}`
                      : `#${i + 1} —`;
                  const winA = done && a > b;
                  const winB = done && b > a;
                  return (
                    <Chip
                      key={i}
                      size="small"
                      label={lbl}
                      color={winA ? "success" : winB ? "success" : "default"}
                      variant={done ? "filled" : "outlined"}
                    />
                  );
                })}
              </Stack>

              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                alignItems="center"
                mt={2}
                flexWrap="wrap"
              >
                {/* Checkbox chế độ tự động */}
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={autoNextGame}
                      onChange={(e) => setAutoNextGame(e.target.checked)}
                    />
                  }
                  label="Tự động sang ván tiếp theo khi ván hiện tại kết thúc"
                />

                <Tooltip
                  title={
                    autoNextGame
                      ? "Sang ván mới khi ván hiện tại đủ điều kiện thắng"
                      : "Cho phép sang ván mới ngay cả khi chưa đủ điểm (sẽ hỏi xác nhận)"
                  }
                >
                  <span>
                    <Button
                      variant="contained"
                      onClick={onClickStartNext}
                      disabled={startBtnDisabled || match.status === "finished"}
                    >
                      Bắt đầu ván tiếp theo
                    </Button>
                  </span>
                </Tooltip>

                <Tooltip title="Kết thúc trận (tự chọn winner theo số ván đã thắng nếu chưa chọn)">
                  <span>
                    <Button
                      color="success"
                      variant="contained"
                      onClick={onFinish}
                      disabled={match.status === "finished"}
                    >
                      Kết thúc trận
                    </Button>
                  </span>
                </Tooltip>

                <Stack direction="row" spacing={1} alignItems="center">
                  <Flag fontSize="small" />
                  <Typography>Winner:</Typography>
                  <TextField
                    select
                    size="small"
                    value={match.winner || ""}
                    onChange={(e) => onPickWinner(e.target.value)}
                    disabled={match.status !== "finished"}
                    sx={{ width: 160 }}
                  >
                    <MenuItem value="">
                      <em>— chưa chọn —</em>
                    </MenuItem>
                    <MenuItem value="A">A</MenuItem>
                    <MenuItem value="B">B</MenuItem>
                  </TextField>
                </Stack>
              </Stack>
            </Card>
          </Stack>
        )}
      </Box>

      <Footer />

      {/* Dialog kết thúc ván sớm */}
      <Dialog open={earlyOpen} onClose={() => setEarlyOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Kết thúc ván hiện tại sớm?</DialogTitle>
        <DialogContent dividers>
          <Typography>
            Ván #{currentIndex + 1}: <b>{curA}</b> - <b>{curB}</b>
          </Typography>

          {curA === curB ? (
            <>
              <Typography sx={{ mt: 2 }}>Hai đội đang hòa. Chọn đội thắng ván này:</Typography>
              <RadioGroup
                row
                value={earlyWinner}
                onChange={(e) => setEarlyWinner(e.target.value)}
                sx={{ mt: 1 }}
              >
                <FormControlLabel
                  value="A"
                  control={<Radio />}
                  label={`A) ${pairLabel(
                    match?.pairA,
                    (match?.tournament?.eventType || "double").toLowerCase()
                  )}`}
                />
                <FormControlLabel
                  value="B"
                  control={<Radio />}
                  label={`B) ${pairLabel(
                    match?.pairB,
                    (match?.tournament?.eventType || "double").toLowerCase()
                  )}`}
                />
              </RadioGroup>

              <FormControlLabel
                sx={{ mt: 1 }}
                control={
                  <Checkbox
                    checked={useCurrentScore}
                    onChange={(e) => setUseCurrentScore(e.target.checked)}
                    disabled
                  />
                }
                label="Ghi nhận đúng tỉ số hiện tại (không ép về tỉ số tối thiểu)"
              />
              <Typography variant="caption" color="text.secondary">
                Đang hòa nên không thể ghi nhận đúng tỉ số hiện tại. Hãy chọn đội thắng hoặc dùng
                chế độ theo luật.
              </Typography>
            </>
          ) : (
            <>
              <Alert sx={{ mt: 2 }} severity="info">
                Sẽ chốt thắng ván cho đội <b>{curA > curB ? "A" : "B"}</b>.
              </Alert>

              <FormControlLabel
                sx={{ mt: 1 }}
                control={
                  <Checkbox
                    checked={useCurrentScore}
                    onChange={(e) => setUseCurrentScore(e.target.checked)}
                  />
                }
                label="Ghi nhận đúng tỉ số hiện tại (không ép về tỉ số tối thiểu)"
              />
            </>
          )}

          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            {useCurrentScore ? (
              "Hệ thống sẽ ghi nhận đúng tỉ số hiện tại và tạo ván mới."
            ) : (
              <>
                Hệ thống sẽ ghi nhận tỉ số tối thiểu hợp lệ theo luật (tới {rules.pointsToWin}
                {rules.winByTwo ? ", chênh ≥2" : ", chênh ≥1"}) và tạo ván mới.
              </>
            )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEarlyOpen(false)}>Hủy</Button>
          <Button
            variant="contained"
            onClick={confirmEarlyEnd}
            disabled={useCurrentScore && curA === curB}
          >
            Xác nhận
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snack.type} variant="filled">
          {snack.msg}
        </Alert>
      </Snackbar>
    </DashboardLayout>
  );
}
