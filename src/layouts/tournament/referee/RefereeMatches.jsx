/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Box,
  Card,
  Stack,
  Typography,
  CircularProgress,
  TextField,
  InputAdornment,
  MenuItem,
  Chip,
  IconButton,
  Button,
  Alert,
  Pagination,
  useMediaQuery,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Grid,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ClearAllIcon from "@mui/icons-material/ClearAll";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import { useNavigate } from "react-router-dom";

import { useListRefereeMatchesQuery, useGetMatchQuery } from "slices/tournamentsApiSlice";
import { useSocket } from "context/SocketContext";

function statusChipProps(s) {
  switch (s) {
    case "live":
      return { color: "warning", label: "Đang diễn ra" };
    case "finished":
      return { color: "success", label: "Đã kết thúc" };
    default:
      return { color: "default", label: "Chưa diễn ra" };
  }
}

function pairLabel(reg, eventType = "double") {
  if (!reg) return "—";
  const p1 = reg.player1?.fullName || reg.player1?.name || "N/A";
  const p2 = reg.player2?.fullName || reg.player2?.name;
  return eventType === "single" || !p2 ? p1 : `${p1} & ${p2}`;
}

const ALL = "all";

export default function RefereeMatches() {
  const nav = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  // Lấy danh sách trận của trọng tài hiện tại
  const {
    data: resp = { items: [], total: 0, page: 1, totalPages: 1 },
    isLoading,
    error,
    refetch,
  } = useListRefereeMatchesQuery({ page: 1, pageSize: 1000 });

  const myMatches = resp.items ?? [];

  // socket realtime
  const socket = useSocket();
  useEffect(() => {
    if (!socket) return;
    let tid = null;
    const safeRefetch = () => {
      if (tid) clearTimeout(tid);
      tid = setTimeout(() => refetch(), 200);
    };
    const onUpd = () => safeRefetch();
    socket.on("match:patched", onUpd);
    socket.on("score:updated", onUpd);
    socket.on("status:updated", onUpd);
    socket.on("winner:updated", onUpd);
    return () => {
      socket.off("match:patched", onUpd);
      socket.off("score:updated", onUpd);
      socket.off("status:updated", onUpd);
      socket.off("winner:updated", onUpd);
      if (tid) clearTimeout(tid);
    };
  }, [socket, refetch]);

  /** -------------------- FILTER STATE -------------------- **/
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(ALL);
  const [tournamentId, setTournamentId] = useState(ALL);
  const [bracketId, setBracketId] = useState(ALL);
  const [stage, setStage] = useState(ALL); // number | 'all'
  const [round, setRound] = useState(ALL); // number | 'all'
  const [matchId, setMatchId] = useState(ALL);
  const [page, setPage] = useState(1);
  const [rpp, setRpp] = useState(10);

  // Options phụ thuộc dữ liệu
  const tournamentOptions = useMemo(() => {
    const map = new Map();
    myMatches.forEach((m) => {
      const t = m.tournament;
      if (t?._id) map.set(String(t._id), t.name || "—");
    });
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [myMatches]);

  const bracketOptions = useMemo(() => {
    const map = new Map();
    myMatches.forEach((m) => {
      const tId = String(m.tournament?._id || "");
      if (!tId) return;
      if (tournamentId !== ALL && tId !== tournamentId) return;
      const b = m.bracket;
      if (b?._id) map.set(String(b._id), b.name || "—");
    });
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [myMatches, tournamentId]);

  const stageOptions = useMemo(() => {
    const set = new Set();
    myMatches.forEach((m) => {
      const tId = String(m.tournament?._id || "");
      const bId = String(m.bracket?._id || "");
      if (tournamentId !== ALL && tId !== tournamentId) return;
      if (bracketId !== ALL && bId !== bracketId) return;
      if (m.bracket?.stage != null) set.add(Number(m.bracket.stage));
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [myMatches, tournamentId, bracketId]);

  const roundOptions = useMemo(() => {
    const set = new Set();
    myMatches.forEach((m) => {
      const tId = String(m.tournament?._id || "");
      const bId = String(m.bracket?._id || "");
      if (tournamentId !== ALL && tId !== tournamentId) return;
      if (bracketId !== ALL && bId !== bracketId) return;
      if (stage !== ALL && Number(m.bracket?.stage) !== Number(stage)) return;
      if (m.round != null) set.add(Number(m.round));
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [myMatches, tournamentId, bracketId, stage]);

  const matchOptions = useMemo(() => {
    const arr = [];
    myMatches.forEach((m) => {
      const tId = String(m.tournament?._id || "");
      const bId = String(m.bracket?._id || "");
      if (tournamentId !== ALL && tId !== tournamentId) return;
      if (bracketId !== ALL && bId !== bracketId) return;
      if (stage !== ALL && Number(m.bracket?.stage) !== Number(stage)) return;
      if (round !== ALL && Number(m.round) !== Number(round)) return;
      const evType = (m.tournament?.eventType || "double").toLowerCase();
      const label = `${m.code || `Trận #${m.order ?? ""}`} — ${pairLabel(
        m.pairA,
        evType
      )} vs ${pairLabel(m.pairB, evType)}`;
      arr.push({ id: String(m._id), label });
    });
    // Sort: theo order trong vòng
    arr.sort((a, b) => a.label.localeCompare(b.label));
    return arr;
  }, [myMatches, tournamentId, bracketId, stage, round]);

  // Khi đổi filter cha → reset con
  const onChangeTournament = (val) => {
    setTournamentId(val);
    setBracketId(ALL);
    setStage(ALL);
    setRound(ALL);
    setMatchId(ALL);
    setPage(1);
  };
  const onChangeBracket = (val) => {
    setBracketId(val);
    setStage(ALL);
    setRound(ALL);
    setMatchId(ALL);
    setPage(1);
  };
  const onChangeStage = (val) => {
    setStage(val);
    setRound(ALL);
    setMatchId(ALL);
    setPage(1);
  };
  const onChangeRound = (val) => {
    setRound(val);
    setMatchId(ALL);
    setPage(1);
  };
  const onChangeMatch = (val) => {
    setMatchId(val);
    setPage(1);
  };

  const resetFilters = () => {
    setQ("");
    setStatus(ALL);
    setTournamentId(ALL);
    setBracketId(ALL);
    setStage(ALL);
    setRound(ALL);
    setMatchId(ALL);
    setPage(1);
  };

  /** -------------------- APPLY FILTERS -------------------- **/
  const filtered = useMemo(() => {
    const key = q.trim().toLowerCase();

    const arr = myMatches.filter((m) => {
      // status
      if (status !== ALL && m.status !== status) return false;

      // tournament / bracket / stage / round / match
      const tId = String(m.tournament?._id || "");
      const bId = String(m.bracket?._id || "");
      if (tournamentId !== ALL && tId !== tournamentId) return false;
      if (bracketId !== ALL && bId !== bracketId) return false;
      if (stage !== ALL && Number(m.bracket?.stage) !== Number(stage)) return false;
      if (round !== ALL && Number(m.round) !== Number(round)) return false;
      if (matchId !== ALL && String(m._id) !== matchId) return false;

      // text search
      if (!key) return true;
      const evType = (m.tournament?.eventType || "double").toLowerCase();
      const hay = `${m.code || ""} ${m.tournament?.name || ""} ${m.bracket?.name || ""} ${pairLabel(
        m.pairA,
        evType
      )} ${pairLabel(m.pairB, evType)} ${m.status || ""}`.toLowerCase();
      return hay.includes(key);
    });

    // sort: tournament name → bracket stage → round → order
    arr.sort((a, b) => {
      const tn = (a.tournament?.name || "").localeCompare(b.tournament?.name || "");
      if (tn) return tn;
      const st = (a.bracket?.stage ?? 0) - (b.bracket?.stage ?? 0);
      if (st) return st;
      const r = (a.round ?? 0) - (b.round ?? 0);
      if (r) return r;
      return (a.order ?? 0) - (b.order ?? 0);
    });

    return arr;
  }, [myMatches, q, status, tournamentId, bracketId, stage, round, matchId]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rpp));
  const paged = filtered.slice((page - 1) * rpp, page * rpp);
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  /** -------------------- DETAIL DIALOG -------------------- **/
  const [detailId, setDetailId] = useState(null);
  const {
    data: detail,
    isLoading: loadingDetail,
    error: detailError,
    refetch: refetchDetail,
  } = useGetMatchQuery(detailId, { skip: !detailId });

  // join room socket khi mở dialog chi tiết
  useEffect(() => {
    if (!socket || !detailId) return;
    socket.emit("match:join", { matchId: detailId });
    const onUpd = (payload) => {
      if (payload?.matchId === String(detailId)) refetchDetail();
    };
    socket.on("match:patched", onUpd);
    socket.on("score:updated", onUpd);
    socket.on("status:updated", onUpd);
    socket.on("winner:updated", onUpd);
    return () => {
      socket.emit("match:leave", { matchId: detailId });
      socket.off("match:patched", onUpd);
      socket.off("score:updated", onUpd);
      socket.off("status:updated", onUpd);
      socket.off("winner:updated", onUpd);
    };
  }, [socket, detailId, refetchDetail]);

  const gotoConsole = useCallback((id) => nav(`/admin/referee/console?matchId=${id}`), [nav]);

  const renderDetailDialog = () => {
    const evType = (detail?.tournament?.eventType || "double").toLowerCase();
    const chip = statusChipProps(detail?.status);

    return (
      <Dialog open={!!detailId} onClose={() => setDetailId(null)} maxWidth="md" fullWidth>
        <DialogTitle>Chi tiết trận</DialogTitle>
        <DialogContent dividers>
          {loadingDetail ? (
            <Box textAlign="center" py={4}>
              <CircularProgress size={24} />
            </Box>
          ) : detailError ? (
            <Alert severity="error">
              {detailError?.data?.message || detailError?.error || "Không tải được chi tiết"}
            </Alert>
          ) : detail ? (
            <>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                spacing={1}
                sx={{ mb: 1 }}
              >
                <Box>
                  <Typography variant="h6">{detail?.tournament?.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Nhánh {detail?.bracket?.name} ({detail?.bracket?.type}) • Giai đoạn{" "}
                    {detail?.bracket?.stage} • Vòng {detail?.round} • Trận #{detail?.order ?? 0}
                  </Typography>
                </Box>
                <Chip size="small" color={chip.color} label={chip.label} />
              </Stack>

              <Divider sx={{ my: 1.5 }} />

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography fontWeight={700} sx={{ mb: 0.5 }}>
                      Đôi A
                    </Typography>
                    <Typography>{pairLabel(detail.pairA, evType)}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography fontWeight={700} sx={{ mb: 0.5 }}>
                      Đôi B
                    </Typography>
                    <Typography>{pairLabel(detail.pairB, evType)}</Typography>
                  </Paper>
                </Grid>
              </Grid>

              <Typography variant="subtitle1" sx={{ mt: 2 }}>
                Tỷ số từng ván
              </Typography>
              <Table size="small" sx={{ mt: 1 }}>
                <TableHead sx={{ display: "table-header-group" }}>
                  <TableRow>
                    <TableCell sx={{ width: 100 }}>Ván</TableCell>
                    <TableCell align="center">Đôi A</TableCell>
                    <TableCell align="center">Đôi B</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(detail?.gameScores || []).length ? (
                    detail.gameScores.map((g, i) => (
                      <TableRow key={i}>
                        <TableCell>#{i + 1}</TableCell>
                        <TableCell align="center">{g?.a ?? "—"}</TableCell>
                        <TableCell align="center">{g?.b ?? "—"}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} align="center">
                        Chưa có điểm ván.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              <Divider sx={{ my: 2 }} />

              <Stack direction="row" spacing={2} alignItems="center" justifyContent="flex-end">
                <Button
                  variant="contained"
                  startIcon={<OpenInNewIcon />}
                  onClick={() => gotoConsole(detail._id)}
                  sx={{ color: "white !important" }}
                >
                  Vào console chấm điểm
                </Button>
              </Stack>
            </>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailId(null)}>Đóng</Button>
        </DialogActions>
      </Dialog>
    );
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box p={3}>
        {/* --- Header + Filters (responsive) --- */}
        <Box mb={2}>
          {/* Title + actions (actions ẩn trên mobile) */}
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
            <Typography variant={isMobile ? "h5" : "h4"}>Trận của trọng tài</Typography>

            {/* Actions hiện ở >= sm */}
            <Stack direction="row" spacing={1} sx={{ display: { xs: "none", sm: "flex" } }}>
              <IconButton onClick={() => refetch()} title="Làm mới">
                <RefreshIcon />
              </IconButton>
              <Button
                variant="text"
                size="small"
                startIcon={<ClearAllIcon />}
                onClick={resetFilters}
              >
                Reset
              </Button>
            </Stack>
          </Stack>

          {/* Filters: grid responsive */}
          <Grid container spacing={1.5}>
            {/* Search */}
            <Grid item xs={12} md={6} lg={4}>
              <TextField
                size="small"
                placeholder="Tìm mã trận / giải / đội…"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
                fullWidth
              />
            </Grid>

            {/* Status */}
            <Grid item xs={6} sm={4} md={3} lg={2}>
              <TextField
                select
                size="small"
                label="Trạng thái"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                fullWidth
              >
                <MenuItem value={ALL}>Tất cả</MenuItem>
                <MenuItem value="scheduled">Chưa diễn ra</MenuItem>
                <MenuItem value="live">Đang diễn ra</MenuItem>
                <MenuItem value="finished">Đã kết thúc</MenuItem>
              </TextField>
            </Grid>

            {/* Tournament */}
            <Grid item xs={12} sm={8} md={5} lg={4}>
              <TextField
                select
                size="small"
                label="Giải đấu"
                value={tournamentId}
                onChange={(e) => onChangeTournament(e.target.value)}
                fullWidth
              >
                <MenuItem value={ALL}>Tất cả</MenuItem>
                {tournamentOptions.map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Bracket */}
            <Grid item xs={6} sm={4} md={3} lg={2}>
              <TextField
                select
                size="small"
                label="Nhánh"
                value={bracketId}
                onChange={(e) => onChangeBracket(e.target.value)}
                disabled={tournamentId === ALL && bracketOptions.length === 0}
                fullWidth
              >
                <MenuItem value={ALL}>Tất cả</MenuItem>
                {bracketOptions.map((b) => (
                  <MenuItem key={b.id} value={b.id}>
                    {b.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Stage */}
            <Grid item xs={6} sm={4} md={3} lg={2}>
              <TextField
                select
                size="small"
                label="Giai đoạn"
                value={stage}
                onChange={(e) => onChangeStage(e.target.value)}
                disabled={stageOptions.length === 0}
                fullWidth
              >
                <MenuItem value={ALL}>Tất cả</MenuItem>
                {stageOptions.map((s) => (
                  <MenuItem key={s} value={String(s)}>
                    {s}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Round */}
            <Grid item xs={6} sm={4} md={3} lg={2}>
              <TextField
                select
                size="small"
                label="Vòng"
                value={round}
                onChange={(e) => onChangeRound(e.target.value)}
                disabled={roundOptions.length === 0}
                fullWidth
              >
                <MenuItem value={ALL}>Tất cả</MenuItem>
                {roundOptions.map((r) => (
                  <MenuItem key={r} value={String(r)}>
                    {r}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Match */}
            <Grid item xs={12} sm={8} md={5} lg={4}>
              <TextField
                select
                size="small"
                label="Trận"
                value={matchId}
                onChange={(e) => onChangeMatch(e.target.value)}
                disabled={matchOptions.length === 0}
                fullWidth
              >
                <MenuItem value={ALL}>Tất cả</MenuItem>
                {matchOptions.map((m) => (
                  <MenuItem key={m.id} value={m.id}>
                    {m.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Rows per page */}
            <Grid item xs={6} sm={4} md={2} lg={2}>
              <TextField
                select
                size="small"
                label="Rows"
                value={rpp}
                onChange={(e) => {
                  setRpp(Number(e.target.value) || 10);
                  setPage(1);
                }}
                fullWidth
              >
                {[5, 10, 20, 50].map((n) => (
                  <MenuItem key={n} value={n}>
                    {n}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Actions (hiện ở xs; ẩn ở >= sm vì đã có trên header) */}
            <Grid item xs={12} sx={{ display: { xs: "flex", sm: "none" }, gap: 1, mt: 0.5 }}>
              <IconButton onClick={() => refetch()} title="Làm mới">
                <RefreshIcon />
              </IconButton>
              <Button
                variant="text"
                size="small"
                startIcon={<ClearAllIcon />}
                onClick={resetFilters}
              >
                Reset
              </Button>
            </Grid>
          </Grid>
        </Box>

        {/* Summary nhỏ về số lượng */}
        <Box mb={1}>
          <Typography variant="body2" color="text.secondary">
            Đang hiển thị {filtered.length} / {myMatches.length} trận
          </Typography>
        </Box>

        {isLoading ? (
          <Box textAlign="center" py={6}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">
            {error?.data?.message || error?.error || "Lỗi tải dữ liệu"}
          </Alert>
        ) : filtered.length === 0 ? (
          <Alert severity="info">Không có trận nào khớp bộ lọc.</Alert>
        ) : (
          <>
            <Stack spacing={1}>
              {paged.map((m) => {
                const evType = (m.tournament?.eventType || "double").toLowerCase();
                const chip = statusChipProps(m.status);
                return (
                  <Card key={m._id} sx={{ p: 2 }}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1}
                      alignItems={{ xs: "flex-start", sm: "center" }}
                      justifyContent="space-between"
                    >
                      <Box>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="h6">
                            {m.tournament?.name} {m.code ? `• ${m.code}` : ""}
                          </Typography>
                          <Chip size="small" color={chip.color} label={chip.label} />
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          Nhánh {m.bracket?.name} ({m.bracket?.type}) • Giai đoạn {m.bracket?.stage}{" "}
                          • Vòng {m.round} • Trận #{m.order ?? 0}
                        </Typography>
                        <Typography variant="subtitle2" sx={{ mt: 0.5 }}>
                          {pairLabel(m.pairA, evType)} <span style={{ opacity: 0.6 }}>vs</span>{" "}
                          {pairLabel(m.pairB, evType)}
                        </Typography>
                      </Box>

                      <Stack direction="row" spacing={1}>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<InfoOutlinedIcon />}
                          onClick={() => setDetailId(m._id)}
                        >
                          Chi tiết
                        </Button>
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<OpenInNewIcon />}
                          onClick={() => gotoConsole(m._id)}
                          sx={{ color: "white !important" }}
                        >
                          Vào console
                        </Button>
                      </Stack>
                    </Stack>
                  </Card>
                );
              })}
            </Stack>

            <Box display="flex" justifyContent="center" mt={2}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_e, v) => setPage(v)}
                size="small"
              />
            </Box>
          </>
        )}
      </Box>
      <Footer />
      {renderDetailDialog()}
    </DashboardLayout>
  );
}
