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
  Autocomplete,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import SupervisorAccountIcon from "@mui/icons-material/SupervisorAccount";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import { useNavigate } from "react-router-dom";

import {
  useListMatchesPagedQuery,
  useGetMatchQuery,
  useListMatchGroupsQuery,
} from "slices/tournamentsApiSlice";
import { useGetUsersQuery } from "slices/adminApiSlice";
import { useSocket } from "context/SocketContext";

/* ===== helpers ===== */
const isHex24 = (s) => /^[0-9a-fA-F]{24}$/.test(String(s || "").trim());
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

/* ======== Ưu tiên nickname ========= */
const preferNick = (p) =>
  (p?.nickname && String(p.nickname).trim()) ||
  (p?.nickName && String(p.nickName).trim()) ||
  (p?.nick_name && String(p.nick_name).trim()) ||
  "";

const nameWithNick = (p) => {
  const nk = preferNick(p);
  return nk || p?.fullName || p?.name || "N/A";
};

function pairLabel(reg, eventType = "double") {
  if (!reg) return "—";
  const p1 = nameWithNick(reg.player1);
  const p2 = reg.player2 ? nameWithNick(reg.player2) : "";
  return String(eventType).toLowerCase() === "single" || !p2 ? p1 : `${p1} & ${p2}`;
}

/* ======== Hiển thị R{vòng} cộng dồn giữa các bracket ========

Dữ liệu từ useListMatchGroupsQuery() giả định dạng:
[
  {
    tournamentId,
    tournamentName,
    brackets: [
      { bracketId, bracketName, type, stage, /* ...có thể có rounds/maxRounds/drawRounds *\/ },
      ...
    ]
  },
  ...
]

Logic:
- Group = 1 vòng.
- RoundElim/KO = số vòng = ưu tiên: max(round) quan sát được từ list matches của bracket → 
  hoặc b.rounds || b.maxRounds || b.drawRounds → fallback 1.
- BaseRoundStart của mỗi bracket = 1 + tổng số vòng của các bracket trước đó (cùng tournament),
  sắp theo stage tăng dần. (Nếu stage bằng nhau, giữ nguyên thứ tự trả về).
*/
function buildBaseRoundStartMap(groups, matches) {
  // Gom max(round) quan sát được theo bracketId
  const observedMaxRound = new Map(); // bracketId -> maxRound
  (matches || []).forEach((m) => {
    const bid = String(m?.bracket?._id || m?.bracketId || "");
    const r = Number(m?.round || 1);
    if (!bid) return;
    const cur = observedMaxRound.get(bid) || 0;
    observedMaxRound.set(bid, Math.max(cur, r));
  });

  // Tính số vòng cho 1 bracket
  const roundsCountFor = (b) => {
    const bid = String(b?.bracketId || b?._id || "");
    const type = String(b?.type || "").toLowerCase();
    if (!bid) return 1;
    if (type === "group") return 1;

    // Ưu tiên round quan sát được
    const obs = observedMaxRound.get(bid);
    if (Number.isFinite(obs) && obs > 0) return obs;

    // Nếu payload có thông tin cấu hình
    const metaK = Number(b?.rounds) || Number(b?.maxRounds) || Number(b?.drawRounds) || 0;
    if (metaK > 0) return metaK;

    // fallback
    return 1;
  };

  // Duyệt theo tournament, sắp theo stage, cộng dồn
  const baseMap = new Map(); // bracketId -> baseStart (1-based)
  (groups || []).forEach((g) => {
    const arr = (g?.brackets || []).slice().sort((a, b) => {
      const sa = Number(a?.stage || 0);
      const sb = Number(b?.stage || 0);
      return sa - sb;
    });
    let acc = 0;
    arr.forEach((b) => {
      const bid = String(b?.bracketId || "");
      if (!bid) return;
      baseMap.set(bid, acc + 1); // base cho bracket này
      acc += roundsCountFor(b);
    });
  });

  return baseMap;
}

function displayRoundForMatch(m, baseMap) {
  const bid = String(m?.bracket?._id || m?.bracketId || "");
  const base = baseMap.get(bid) || 1;
  const r = Number(m?.round || 1);
  return base + (r - 1);
}

export default function AdminRefereeMatches() {
  const nav = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const socket = useSocket();

  /* ===== options: giải/nhánh ===== */
  const { data: groups = [], isLoading: groupsLoading } = useListMatchGroupsQuery({});
  const tournamentOptions = useMemo(
    () =>
      groups.map((g) => ({
        id: g.tournamentId,
        name: g.tournamentName,
        brackets: g.brackets || [],
      })),
    [groups]
  );

  /* ===== filters & paging ===== */
  const [filters, setFilters] = useState({
    q: "",
    matchId: "",
    status: "all",
    tournamentId: "",
    bracketId: "",
    refereeId: "",
  });
  const [page, setPage] = useState(1);
  const [rpp, setRpp] = useState(10);
  const hasIdQuery = isHex24(filters.matchId);

  useEffect(() => {
    setPage(1);
  }, [
    filters.q,
    filters.status,
    filters.tournamentId,
    filters.bracketId,
    filters.refereeId,
    filters.matchId,
  ]);

  const bracketOptions = useMemo(() => {
    const t = tournamentOptions.find((t) => t.id === filters.tournamentId);
    return t ? t.brackets.map((b) => ({ id: b.bracketId, name: b.bracketName })) : [];
  }, [filters.tournamentId, tournamentOptions]);

  /* ===== Autocomplete trọng tài ===== */
  const [refKeyword, setRefKeyword] = useState("");
  const { data: users = { users: [] }, isFetching: fetchingRefs } = useGetUsersQuery({
    page: 1,
    keyword: refKeyword,
    role: "referee",
  });
  const refOptions = users?.users || [];
  const selectedRef = useMemo(
    () => refOptions.find((u) => u._id === filters.refereeId) || null,
    [filters.refereeId, refOptions]
  );

  /* ===== fetch by exact _id ===== */
  const {
    data: idMatch,
    isLoading: idLoading,
    error: idError,
    refetch: refetchId,
  } = useGetMatchQuery(filters.matchId, { skip: !hasIdQuery });

  /* ===== server-side list (đã gán trọng tài) ===== */
  const listParams = useMemo(
    () => ({
      page,
      limit: rpp,
      q: filters.q || undefined,
      status: filters.status !== "all" ? filters.status : undefined,
      tournament: filters.tournamentId || undefined,
      bracket: filters.bracketId || undefined,
      referee: filters.refereeId || undefined, // lọc theo 1 trọng tài
      hasReferee: true, // BE lọc referee != null
      assigned: 1, // backup flag nếu BE dùng tên khác
    }),
    [page, rpp, filters]
  );

  const {
    data: resp = { list: [], total: 0, totalPages: 1 },
    isLoading,
    error,
    refetch,
  } = useListMatchesPagedQuery(listParams, { skip: hasIdQuery });

  const listRaw = hasIdQuery ? (idMatch ? [idMatch] : []) : resp.list || resp.items || [];
  const totalPages = hasIdQuery
    ? 1
    : resp.totalPages || Math.max(1, Math.ceil((resp.total || 0) / rpp));
  const listLoading = hasIdQuery ? idLoading : isLoading;
  const listError = hasIdQuery ? idError : error;

  /* ===== Tính base R theo nhóm giải/bracket + dữ liệu đang có ===== */
  const baseMap = useMemo(() => buildBaseRoundStartMap(groups, listRaw), [groups, listRaw]);

  /* ===== realtime ===== */
  useEffect(() => {
    if (!socket) return;
    let tid = null;
    const safeRefetch = () => {
      clearTimeout(tid);
      tid = setTimeout(() => (hasIdQuery ? refetchId() : refetch()), 250);
    };
    const onUpd = () => safeRefetch();
    ["match:patched", "score:updated", "status:updated", "winner:updated"].forEach((e) =>
      socket.on(e, onUpd)
    );
    return () => {
      ["match:patched", "score:updated", "status:updated", "winner:updated"].forEach((e) =>
        socket.off(e, onUpd)
      );
      if (tid) clearTimeout(tid);
    };
  }, [socket, hasIdQuery, refetch, refetchId]);

  /* ===== detail dialog ===== */
  const [detailId, setDetailId] = useState(null);
  const {
    data: detail,
    isLoading: loadingDetail,
    error: detailError,
    refetch: refetchDetail,
  } = useGetMatchQuery(detailId, { skip: !detailId });

  useEffect(() => {
    if (!socket || !detailId) return;
    socket.emit("match:join", { matchId: detailId });
    const onUpd = (p) => {
      if (p?.matchId === String(detailId)) refetchDetail();
    };
    ["match:patched", "score:updated", "status:updated", "winner:updated"].forEach((e) =>
      socket.on(e, onUpd)
    );
    return () => {
      socket.emit("match:leave", { matchId: detailId });
      ["match:patched", "score:updated", "status:updated", "winner:updated"].forEach((e) =>
        socket.off(e, onUpd)
      );
    };
  }, [socket, detailId, refetchDetail]);

  const gotoConsole = useCallback((id) => nav(`/admin/referee/console?matchId=${id}`), [nav]);
  const doRefresh = () => (hasIdQuery ? refetchId() : refetch());

  /* ===== UI ===== */
  const renderDetailDialog = () => {
    const evType = (detail?.tournament?.eventType || "double").toLowerCase();
    const chip = statusChipProps(detail?.status);
    const R = detail ? displayRoundForMatch(detail, baseMap) : null;
    const ord = Number.isFinite(Number(detail?.order)) ? Number(detail.order) + 1 : detail?.order;

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
                    {detail?.bracket?.stage} • Vòng <b>R{R}</b> • Trận #{ord ?? 0}
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

  const list = listRaw; // alias

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box p={3}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h4">Trận đã gán trọng tài</Typography>
          <SupervisorAccountIcon color="action" titleAccess="Admin" />
        </Stack>
        <Stack
          direction={isMobile ? "column" : "row"}
          spacing={2}
          alignItems={isMobile ? "stretch" : "center"}
          justifyContent="space-between"
          mb={2}
        >
          <Grid container spacing={1.5} alignItems="center">
            {/* Search */}
            <Grid item xs={12} sm={6} md={4} lg={3}>
              <TextField
                size="small"
                placeholder="Tìm mã/_id/giải/đội…"
                value={filters.q}
                onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
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

            {/* Exact _id */}
            <Grid item xs={12} sm={6} md={4} lg={2}>
              <TextField
                size="small"
                label="_id trận (chính xác)"
                placeholder="24 ký tự hex"
                value={filters.matchId}
                error={!!filters.matchId && !isHex24(filters.matchId)}
                onChange={(e) => setFilters((f) => ({ ...f, matchId: e.target.value.trim() }))}
                fullWidth
              />
            </Grid>

            {/* Giải */}
            <Grid item xs={12} sm={6} md={4} lg={2}>
              <TextField
                select
                size="small"
                label="Giải"
                value={filters.tournamentId}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, tournamentId: e.target.value, bracketId: "" }))
                }
                disabled={groupsLoading}
                fullWidth
              >
                <MenuItem value="">Tất cả</MenuItem>
                {tournamentOptions.map((t) => (
                  <MenuItem value={t.id} key={t.id}>
                    {t.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Nhánh/Bảng */}
            <Grid item xs={12} sm={6} md={4} lg={2}>
              <TextField
                select
                size="small"
                label="Nhánh/Bảng"
                value={filters.bracketId}
                onChange={(e) => setFilters((f) => ({ ...f, bracketId: e.target.value }))}
                disabled={!filters.tournamentId}
                fullWidth
              >
                <MenuItem value="">Tất cả</MenuItem>
                {bracketOptions.map((b) => (
                  <MenuItem value={b.id} key={b.id}>
                    {b.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Trạng thái */}
            <Grid item xs={12} sm={6} md={4} lg={2}>
              <TextField
                select
                size="small"
                label="Trạng thái"
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                fullWidth
              >
                <MenuItem value="all">Tất cả</MenuItem>
                <MenuItem value="scheduled">Chưa diễn ra</MenuItem>
                <MenuItem value="live">Đang diễn ra</MenuItem>
                <MenuItem value="finished">Đã kết thúc</MenuItem>
              </TextField>
            </Grid>

            {/* Rows */}
            <Grid item xs={12} sm={6} md={4} lg={1.5}>
              <TextField
                select
                size="small"
                label="Rows"
                value={rpp}
                onChange={(e) => setRpp(Number(e.target.value) || 10)}
                fullWidth
              >
                {[5, 10, 20, 50].map((n) => (
                  <MenuItem key={n} value={n}>
                    {n}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Autocomplete trọng tài */}
            <Grid item xs={12} sm={8} md={6} lg={3}>
              <Autocomplete
                size="small"
                options={refOptions}
                loading={fetchingRefs}
                value={selectedRef}
                getOptionLabel={(o) => o?.nickname || o?.name || o?.email || ""}
                onChange={(_e, val) => setFilters((f) => ({ ...f, refereeId: val?._id || "" }))}
                inputValue={refKeyword}
                onInputChange={(_e, val) => setRefKeyword(val)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Trọng tài"
                    placeholder="Tìm theo tên/email"
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {fetchingRefs ? <CircularProgress size={16} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                    fullWidth
                  />
                )}
                clearOnBlur={false}
                isOptionEqualToValue={(o, v) => o._id === v._id}
                fullWidth
              />
            </Grid>

            {/* Refresh */}
            <Grid item xs={12} sm="auto">
              <IconButton onClick={doRefresh} title="Làm mới" sx={{ ml: { xs: 0, md: 1 } }}>
                <RefreshIcon />
              </IconButton>
            </Grid>
          </Grid>
        </Stack>

        {listLoading ? (
          <Box textAlign="center" py={6}>
            <CircularProgress />
          </Box>
        ) : listError ? (
          <Alert severity="error">
            {listError?.data?.message || listError?.error || "Lỗi tải dữ liệu"}
          </Alert>
        ) : list.length === 0 ? (
          <Alert severity="info">Không có trận nào khớp bộ lọc.</Alert>
        ) : (
          <>
            <Stack spacing={1}>
              {list.map((m) => {
                const evType = (m.tournament?.eventType || "double").toLowerCase();
                const chip = statusChipProps(m.status);
                const R = displayRoundForMatch(m, baseMap);
                const ord = Number.isFinite(Number(m?.order)) ? Number(m.order) + 1 : m?.order;
                const fallbackCode = `R${R}-T${ord ?? "?"}`;
                const refName = m?.referee?.nickname || m?.referee?.name || m?.referee?.email || "";

                return (
                  <Card key={m._id} sx={{ p: 2 }}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1}
                      alignItems={{ xs: "flex-start", sm: "center" }}
                      justifyContent="space-between"
                    >
                      <Box>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                          <Typography variant="h6" sx={{ mr: 1 }}>
                            {m.tournament?.name}
                          </Typography>
                          <Chip size="small" color={chip.color} label={chip.label} />
                          {refName && (
                            <Chip
                              size="small"
                              variant="outlined"
                              label={`TT: ${refName}`}
                              sx={{ ml: 1 }}
                            />
                          )}
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          Nhánh {m.bracket?.name} ({m.bracket?.type}) • Giai đoạn {m.bracket?.stage}{" "}
                          • Vòng <b>R{R}</b> • Trận #{ord ?? 0}
                        </Typography>
                        <Typography variant="subtitle2" sx={{ mt: 0.5 }}>
                          {pairLabel(m.pairA, evType)} <span style={{ opacity: 0.6 }}>vs</span>{" "}
                          {pairLabel(m.pairB, evType)}
                        </Typography>
                        {(m.code || m._id) && (
                          <Typography variant="caption" color="text.secondary">
                            {`Mã trận: ${m.code || fallbackCode} • `}_id: {m._id}
                          </Typography>
                        )}
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

            {!hasIdQuery && (
              <Box display="flex" justifyContent="center" mt={2}>
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={(_e, v) => setPage(v)}
                  size="small"
                />
              </Box>
            )}
          </>
        )}
      </Box>
      <Footer />
      {renderDetailDialog()}
    </DashboardLayout>
  );
}
