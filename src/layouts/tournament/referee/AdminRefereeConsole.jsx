/* eslint-disable react/prop-types */
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  Box,
  Card,
  Stack,
  Typography,
  Chip,
  List,
  ListItemButton,
  ListItemText,
  ListSubheader,
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
} from "@mui/icons-material";
import { keyframes } from "@emotion/react";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";

import {
  useListRefereeMatchesQuery,
  useGetMatchQuery,
  useRefereeIncPointMutation,
  useRefereeSetGameScoreMutation,
  useRefereeSetStatusMutation,
  useRefereeSetWinnerMutation,
} from "slices/tournamentsApiSlice";
import { useSocket } from "context/SocketContext";

/* ================= helpers ================= */
const statusChip = (s) =>
  s === "live"
    ? { color: "warning", label: "Đang diễn ra" }
    : s === "finished"
    ? { color: "success", label: "Đã kết thúc" }
    : { color: "default", label: "Chưa diễn ra" };

function pairLabel(reg, eventType = "double") {
  if (!reg) return "—";
  const p1 = reg.player1?.fullName || reg.player1?.name || "N/A";
  const p2 = reg.player2?.fullName || reg.player2?.name;
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

/* ======== Animations (YouTube-like pulse/burst) ======== */
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

/* Tiny burst overlay */
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
        {/* center dot pop */}
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
        {/* expanding ring */}
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
            transform: "translate(-50%,-50%)",
            animation: `${ring} 700ms ease-out`,
          }}
        />
        {/* sparkles */}
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
              // offset per sparkle
              ...(i === 0 && { transform: "translate(-50%,-50%) rotate(-22deg)" }),
              ...(i === 1 && { transform: "translate(-50%,-50%) rotate(12deg)" }),
              ...(i === 2 && { transform: "translate(-50%,-50%) rotate(36deg)" }),
            }}
          />
        ))}
      </Box>
    </Zoom>
  );
}

export default function AdminRefereeConsole() {
  // Sidebar list
  const {
    data: myMatches = [],
    isLoading: listLoading,
    error: listErr,
    refetch: refetchList,
  } = useListRefereeMatchesQuery();

  const [selectedId, setSelectedId] = useState(null);

  // Detail
  const {
    data: match,
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

  // join room & realtime
  useEffect(() => {
    if (!socket || !selectedId) return;

    socket.emit("match:join", { matchId: selectedId });

    const onPatched = (payload) => {
      if (payload?.matchId === selectedId) refetchDetail();
    };
    socket.on("match:patched", onPatched);
    socket.on("score:updated", onPatched);
    socket.on("status:updated", onPatched);
    socket.on("winner:updated", onPatched);
    socket.on("match:update", onPatched);
    socket.on("match:snapshot", onPatched);

    return () => {
      socket.emit("match:leave", { matchId: selectedId });
      socket.off("match:patched", onPatched);
      socket.off("score:updated", onPatched);
      socket.off("status:updated", onPatched);
      socket.off("winner:updated", onPatched);
      socket.off("match:update", onPatched);
      socket.off("match:snapshot", onPatched);
    };
  }, [socket, selectedId, refetchDetail]);

  const refresh = () => {
    refetchList();
    if (selectedId) refetchDetail();
  };

  /* ===== derived from detail ===== */
  const rules = match?.rules || { bestOf: 3, pointsToWin: 11, winByTwo: true };
  const eventType = (match?.tournament?.eventType || "double").toLowerCase();
  console.log("eventType", eventType);
  const isSingles = eventType === "single";
  const isDoubles = !isSingles;
  const gs = match?.gameScores || [];
  const needSetWinsVal = needWins(rules.bestOf);

  const currentIndex = Math.max(0, gs.length - 1);
  const curA = gs[currentIndex]?.a ?? 0;
  const curB = gs[currentIndex]?.b ?? 0;

  const serve = match?.serve || { side: "A", server: 2 };
  const isServingA = serve?.side === "A";
  const isServingB = serve?.side === "B";
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

  /* ===== score highlight states (auto detect from data changes) ===== */
  const [flashA, setFlashA] = useState(false);
  const [flashB, setFlashB] = useState(false);
  const prevRef = useRef({ matchId: null, gi: 0, a: 0, b: 0 });

  useEffect(() => {
    if (!match) return;
    const gi = currentIndex;
    const a = curA;
    const b = curB;

    // nếu cùng match & cùng ván -> kiểm tra tăng điểm
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

    // cập nhật mốc
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
      // hiệu ứng optimistic (phòng khi socket roundtrip chậm)
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

  // hotkeys
  useEffect(() => {
    const onKey = (e) => {
      if (!match) return;
      const k = e.key.toLowerCase();
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
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line
  }, [match?.status, selectedId, gs.length, curA, curB]);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box p={2} display="grid" gridTemplateColumns={{ xs: "1fr", md: "320px 1fr" }} gap={2}>
        {/* ===== Sidebar ===== */}
        <Card sx={{ p: 1, minHeight: 500 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" px={1}>
            <Typography variant="h6">Trận của tôi</Typography>
            <IconButton onClick={refresh} size="small" title="Làm mới">
              <Refresh fontSize="small" />
            </IconButton>
          </Stack>
          <Divider sx={{ my: 1 }} />
          {listLoading ? (
            <Box textAlign="center" py={4}>
              <CircularProgress size={20} />
            </Box>
          ) : listErr ? (
            <Alert severity="error">{listErr?.data?.message || listErr?.error}</Alert>
          ) : (myMatches || []).length === 0 ? (
            <Alert severity="info" sx={{ m: 1 }}>
              Chưa có trận nào được phân.
            </Alert>
          ) : (
            <List
              dense
              subheader={
                <ListSubheader component="div">Nhấn để mở console chấm điểm</ListSubheader>
              }
              sx={{ maxHeight: "calc(100vh - 220px)", overflowY: "auto" }}
            >
              {myMatches.map((m) => {
                const chip = statusChip(m.status);
                return (
                  <ListItemButton
                    key={m._id}
                    selected={selectedId === m._id}
                    onClick={() => setSelectedId(m._id)}
                  >
                    <ListItemText
                      primary={
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Typography variant="body2" fontWeight={700}>
                            {m.tournament?.name || "Giải ?"}
                          </Typography>
                          <Chip size="small" color={chip.color} label={chip.label} />
                        </Stack>
                      }
                      secondary={
                        <>
                          <Typography variant="caption" display="block">
                            Bracket: {m.bracket?.name} ({m.bracket?.type}) • Stage{" "}
                            {m.bracket?.stage}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            R{m.round} • #{m.order ?? 0}
                          </Typography>
                          <Typography variant="caption" display="block">
                            {pairLabel(m.pairA, m.tournament?.eventType)} vs{" "}
                            {pairLabel(m.pairB, m.tournament?.eventType)}
                          </Typography>
                        </>
                      }
                    />
                  </ListItemButton>
                );
              })}
            </List>
          )}
        </Card>

        {/* ===== Main ===== */}
        {!selectedId ? (
          <Box display="grid" placeItems="center" minHeight={400}>
            <Typography>Chọn một trận ở bên trái để bắt đầu chấm điểm.</Typography>
          </Box>
        ) : detailFetching ? (
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
            <Card sx={{ p: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="h5" fontWeight={700}>
                    {pairLabel(match.pairA, eventType)} <span style={{ opacity: 0.6 }}>vs</span>{" "}
                    {pairLabel(match.pairB, eventType)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {match.tournament?.name} • Bracket {match.bracket?.name} ({match.bracket?.type})
                    • Stage {match.bracket?.stage} • R{match.round} • #{match.order ?? 0}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Best-of {rules.bestOf} • Tới {rules.pointsToWin}{" "}
                    {rules.winByTwo ? "(phải chênh 2)" : "(không cần chênh 2)"}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip size="small" {...statusChip(match.status)} />
                  {isDoubles && (
                    <Chip
                      size="small"
                      color="info"
                      icon={<ServeIcon fontSize="small" />}
                      label={`Giao: ${serve.side}#${serve.server}`}
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
            </Card>

            {/* Big scoreboard */}
            <Card sx={{ p: 2 }}>
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
                    borderColor: isServingA ? "primary.main" : "divider",
                    boxShadow: isServingA
                      ? "0 0 0 2px rgba(25,118,210,.20) inset, 0 0 14px rgba(25,118,210,.25)"
                      : "none",
                    transition: "border-color .2s ease, box-shadow .2s ease",
                    animation: flashA ? `${pulse} 550ms ease-out` : "none",
                    "&::before": isServingA
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
                  {/* score burst */}
                  <ScoreBurst show={flashA} color="primary.main" />

                  <Typography fontWeight={800} textAlign="center" sx={{ mb: 1 }}>
                    A) {pairLabel(match.pairA, eventType)}
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
                    borderColor: isServingB ? "primary.main" : "divider",
                    boxShadow: isServingB
                      ? "0 0 0 2px rgba(25,118,210,.20) inset, 0 0 14px rgba(25,118,210,.25)"
                      : "none",
                    transition: "border-color .2s ease, box-shadow .2s ease",
                    animation: flashB ? `${pulse} 550ms ease-out` : "none",
                    "&::before": isServingB
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
                  {/* score burst */}
                  <ScoreBurst show={flashB} color="primary.main" />

                  <Typography fontWeight={800} textAlign="center" sx={{ mb: 1 }}>
                    B) {pairLabel(match.pairB, eventType)}
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

              {/* Pickleball callout */}
              {isDoubles && (
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={2}
                  alignItems="center"
                  mb={1}
                >
                  <Paper variant="outlined" sx={{ px: 2, py: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography fontWeight={700}>Cách đọc điểm:</Typography>
                      <Chip
                        color="primary"
                        label={`${callout} (đội giao - đội nhận - người giao)`}
                      />
                    </Stack>
                  </Paper>

                  {/* Optional: đổi giao thủ công nếu cần */}
                  <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
                    <Button
                      size="small"
                      variant="outlined"
                      sx={{ color: "primary.main" }}
                      onClick={() => {
                        try {
                          socket?.emit("serve:set", {
                            matchId: match._id,
                            side: "A",
                            server: serve.server || 2,
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
                      sx={{ color: "primary.main" }}
                      onClick={() => {
                        socket?.emit("serve:set", {
                          matchId: match._id,
                          side: "B",
                          server: serve.server || 2,
                        });
                        showSnack("info", `Đã đặt đội giao: B`);
                      }}
                    >
                      Giao: B
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      sx={{ color: "primary.main" }}
                      onClick={() => {
                        socket?.emit("serve:set", {
                          matchId: match._id,
                          side: serve.side || "A",
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
                      sx={{ color: "primary.main" }}
                      onClick={() => {
                        socket?.emit("serve:set", {
                          matchId: match._id,
                          side: serve.side || "A",
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

              <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center" mt={2}>
                <Tooltip title="Sang ván mới khi ván hiện tại đã đủ điều kiện thắng">
                  <span>
                    <Button
                      variant="contained"
                      onClick={startNextGame}
                      disabled={!gameDone || matchPointReached || match.status === "finished"}
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
