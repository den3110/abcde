// src/layouts/match/AdminMatchesListGrouped.jsx
import React, { useState, useEffect, useMemo, useCallback, memo } from "react";
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Card,
  Stack,
  IconButton,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Snackbar,
  Alert,
  Grid,
  TableContainer,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Avatar,
  Divider,
  FormControl,
  InputLabel,
  Select,
  Pagination,
  Tooltip,
} from "@mui/material";
import {
  ExpandMore as ExpandMoreIcon,
  Edit as EditIcon,
  Info as InfoIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
} from "@mui/icons-material";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import {
  useListMatchGroupsQuery,
  useListMatchesPagedQuery,
  useGetMatchQuery,
  useAssignRefereeMutation,
} from "slices/tournamentsApiSlice";
import { useGetUsersQuery } from "slices/adminApiSlice";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import PropTypes from "prop-types";

/* ========= helpers ========= */
const maskPhone = (p) => {
  if (!p) return "—";
  const s = String(p).replace(/\D/g, "");
  if (s.length < 7) return p;
  return `${s}`;
};
const isSinglesMatch = (m) => !m?.pairA?.player2 && !m?.pairB?.player2;
const sideLabel = (pair, singles) => {
  if (!pair) return "—";
  const n1 = pair.player1?.fullName || pair.player1?.name || "—";
  if (singles) return n1;
  const n2 = pair.player2?.fullName || pair.player2?.name || "—";
  return `${n1} & ${n2}`;
};

/* -------- BracketSection: gọi API theo trang ở BE -------- */
const BracketSection = memo(function BracketSection({
  tournamentId,
  bracketId,
  bracketName,
  expanded, // chỉ fetch khi true
  onOpenAssign,
  onOpenDetail,
  highlightId,
  statusFilter, // "all" | "scheduled" | "live" | "finished"
}) {
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRpp] = useState(10);

  const queryArgs = useMemo(() => {
    const args = { tournament: tournamentId, bracket: bracketId, page, limit: rowsPerPage };
    if (statusFilter && statusFilter !== "all") args.status = statusFilter;
    return args;
  }, [tournamentId, bracketId, page, rowsPerPage, statusFilter]);

  const { data, isFetching, isLoading, error } = useListMatchesPagedQuery(queryArgs, {
    skip: !expanded,
  });

  const total = data?.total || 0;
  const listRaw = data?.list || [];
  // Lọc client-side fallback nếu BE không hỗ trợ status (không hại nếu có)
  const list =
    statusFilter && statusFilter !== "all"
      ? listRaw.filter((m) => (m?.status || "").toLowerCase() === statusFilter)
      : listRaw;

  const totalPages = Math.max(
    1,
    Math.ceil((statusFilter && statusFilter !== "all" ? list.length : total) / rowsPerPage)
  );

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  const handleChangePage = useCallback((_e, v) => setPage(v), []);
  const handleChangeRpp = useCallback((e) => {
    const v = Number(e.target.value) || 10;
    setRpp(v);
    setPage(1);
  }, []);

  const from = total === 0 ? 0 : (page - 1) * rowsPerPage + 1;
  const to = Math.min(page * rowsPerPage, total);

  return (
    <Box sx={{ mb: 3 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        spacing={1}
        sx={{ mb: 1 }}
      >
        <Typography variant="subtitle1">📋 Bảng: {bracketName}</Typography>

        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="caption" color="text.secondary">
            {from}-{to}/{total}
          </Typography>
          <TextField
            select
            size="small"
            label="Rows"
            value={rowsPerPage}
            onChange={handleChangeRpp}
            sx={{ width: 100 }}
          >
            {[5, 10, 20, 50, 100].map((n) => (
              <MenuItem key={n} value={n}>
                {n}
              </MenuItem>
            ))}
          </TextField>
          <Pagination
            size="small"
            page={page}
            count={totalPages}
            onChange={handleChangePage}
            siblingCount={0}
            boundaryCount={1}
          />
        </Stack>
      </Stack>

      {!expanded ? (
        <Typography variant="body2" color="text.secondary">
          Mở để tải trận…
        </Typography>
      ) : isLoading ? (
        <Box textAlign="center" py={2}>
          <CircularProgress size={20} />
        </Box>
      ) : error ? (
        <Alert severity="error">{error?.data?.message || error.error || "Lỗi tải dữ liệu"}</Alert>
      ) : list.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Không có trận nào
        </Typography>
      ) : (
        <Stack spacing={1}>
          {list.map((m) => {
            const singles = isSinglesMatch(m);
            const labelA = sideLabel(m?.pairA, singles);
            const labelB = sideLabel(m?.pairB, singles);
            const isHL = highlightId === m._id;
            return (
              <Card
                key={m._id}
                sx={{
                  p: 2,
                  opacity: isFetching ? 0.7 : 1,
                  border: "1px solid",
                  borderColor: isHL ? "primary.main" : "divider",
                  boxShadow: isHL ? 3 : 0,
                  bgcolor: isHL ? "action.hover" : "background.paper",
                  scrollMarginTop: "96px",
                }}
                id={isHL ? `match-${m._id}` : undefined}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography>
                      Vòng {m.round}: <strong>{labelA}</strong> vs <strong>{labelB}</strong>
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Trạng thái:{" "}
                      {m.status === "scheduled"
                        ? "Chưa diễn ra"
                        : m.status === "live"
                        ? "Đang diễn ra"
                        : "Đã kết thúc"}
                      {" • "}
                      Thắng{" "}
                      {m?.rules?.bestOf
                        ? Math.ceil(m.rules.bestOf / 2) + "/" + m.rules.bestOf
                        : "-"}{" "}
                      ván, tới {m?.rules?.pointsToWin ?? "-"} điểm (
                      {m?.rules?.winByTwo ? "phải hơn 2 điểm" : "không cần hơn 2 điểm"})
                    </Typography>
                    <Typography variant="caption" display="block" color="text.secondary">
                      Trọng tài: {m?.referee?.name || "Chưa phân"}
                    </Typography>
                    <Typography variant="caption" display="block" color="text.secondary">
                      _id: {m._id}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <Tooltip title="Chi tiết">
                      <IconButton onClick={() => onOpenDetail(m._id)} size="small">
                        <InfoIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Gán trọng tài">
                      <IconButton onClick={() => onOpenAssign(m)} size="small">
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Stack>
              </Card>
            );
          })}
        </Stack>
      )}
    </Box>
  );
});

BracketSection.propTypes = {
  tournamentId: PropTypes.string.isRequired,
  bracketId: PropTypes.string.isRequired,
  bracketName: PropTypes.string.isRequired,
  expanded: PropTypes.bool,
  onOpenAssign: PropTypes.func.isRequired,
  onOpenDetail: PropTypes.func.isRequired,
  highlightId: PropTypes.string,
  statusFilter: PropTypes.string,
};

BracketSection.defaultProps = {
  expanded: false,
  highlightId: undefined,
  statusFilter: "all",
};

/* ================== MAIN ================== */
export default function AdminMatchesListGrouped() {
  // 1) skeleton nhóm: giải → các bracket
  const {
    data: groups = [],
    isLoading: groupsLoading,
    error: groupsError,
  } = useListMatchGroupsQuery({});

  // filter state (tournament / bracket / status)
  const [tourFilter, setTourFilter] = useState("all");
  const [bracketFilter, setBracketFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all"); // scheduled | live | finished

  // điều khiển accordion open theo giải
  const [openTourIds, setOpenTourIds] = useState({});

  // 2) referees
  const { data: users = { users: [] } } = useGetUsersQuery({
    page: 1,
    keyword: "",
    role: "referee",
  });

  // dialog state
  const [assignDlg, setAssignDlg] = useState(null); // { match, refereeId }
  const [detailId, setDetailId] = useState(null); // match._id
  const [snack, setSnack] = useState({ open: false, type: "success", msg: "" });
  const showSnack = (type, msg) => setSnack({ open: true, type, msg });

  // mutation gán referee
  const [assignReferee, { isLoading: assigning }] = useAssignRefereeMutation();
  const openAssign = useCallback(
    (m) => setAssignDlg({ match: m, refereeId: m?.referee?._id || "" }),
    []
  );
  const saveAssign = useCallback(async () => {
    try {
      await assignReferee({
        matchId: assignDlg.match._id,
        refereeId: assignDlg.refereeId || null,
      }).unwrap();
      showSnack("success", "Gán trọng tài thành công");
      setAssignDlg(null);
    } catch (e) {
      showSnack("error", e?.data?.message || e?.error || "Cập nhật thất bại");
    }
  }, [assignDlg, assignReferee]);

  // ===== SEARCH BY _id =====
  const [searchInput, setSearchInput] = useState("");
  const [searchId, setSearchId] = useState(""); // trigger id
  const {
    data: foundMatch,
    isFetching: searching,
    error: searchError,
  } = useGetMatchQuery(searchId, { skip: !searchId });

  // highlight theo kết quả search
  const [highlightId, setHighlightId] = useState(null);

  useEffect(() => {
    if (searchError && searchId) {
      showSnack("error", "Không tìm thấy trận với _id đã nhập");
    }
  }, [searchError, searchId]);

  useEffect(() => {
    if (!foundMatch?._id) return;
    const tId = foundMatch?.tournament?._id || foundMatch?.tournamentId || foundMatch?.tournament;
    const bId = foundMatch?.bracket?._id || foundMatch?.bracketId || foundMatch?.bracket;

    if (tId) {
      setTourFilter(String(tId));
      setOpenTourIds({ [tId]: true });
    }
    if (bId) setBracketFilter(String(bId));
    setHighlightId(foundMatch._id);

    // mở dialog chi tiết ngay cho tiện
    setDetailId(foundMatch._id);

    // cố gắng scroll tới card (nếu đang render)
    setTimeout(() => {
      const el = document.getElementById(`match-${foundMatch._id}`);
      if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 250);
  }, [foundMatch]);

  const handleSubmitSearch = useCallback(() => {
    const v = (searchInput || "").trim();
    if (!v) return;
    setSearchId(v);
  }, [searchInput]);

  const clearSearch = useCallback(() => {
    setSearchInput("");
    setSearchId("");
    setHighlightId(null);
  }, []);

  // ====== lọc groups theo filter chọn ======
  const filteredGroups = useMemo(() => {
    if (!groups?.length) return [];
    let gs = groups;
    if (tourFilter !== "all") {
      gs = gs.filter((g) => String(g.tournamentId) === String(tourFilter));
    }
    // map để lọc bracket bên trong
    if (bracketFilter !== "all") {
      gs = gs
        .map((g) => ({
          ...g,
          brackets: g.brackets.filter((b) => String(b.bracketId) === String(bracketFilter)),
        }))
        .filter((g) => g.brackets.length > 0);
    }
    return gs;
  }, [groups, tourFilter, bracketFilter]);

  // Khi đổi giải thì reset bracket filter
  const handleTourChange = useCallback((e) => {
    const v = e.target.value;
    setTourFilter(v);
    setBracketFilter("all");
    if (v !== "all") setOpenTourIds({ [v]: true });
  }, []);

  // list tournament options & bracket options phụ thuộc tourFilter
  const tourOptions = useMemo(() => {
    return groups.map((g) => ({
      id: g.tournamentId,
      name: g.tournamentName,
      brackets: g.brackets,
    }));
  }, [groups]);

  const bracketOptions = useMemo(() => {
    if (tourFilter === "all") {
      // gom tất cả bracket (ít dùng) – nhưng vẫn cho "all"
      const all = [];
      groups.forEach((g) =>
        g.brackets.forEach((b) =>
          all.push({ id: b.bracketId, name: `${g.tournamentName} • ${b.bracketName}` })
        )
      );
      return all;
    }
    const selected = groups.find((g) => String(g.tournamentId) === String(tourFilter));
    return (selected?.brackets || []).map((b) => ({ id: b.bracketId, name: b.bracketName }));
  }, [groups, tourFilter]);

  // chi tiết trận
  const {
    data: detail,
    isLoading: detailLoading,
    error: detailError,
  } = useGetMatchQuery(detailId, { skip: !detailId });

  const singlesDetail = useMemo(
    () => (!detail ? false : !detail?.pairA?.player2 && !detail?.pairB?.player2),
    [detail]
  );
  const entityWord = singlesDetail ? "VĐV" : "Đôi";

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box p={3}>
        <Typography variant="h4" gutterBottom>
          Quản lý trận đấu
        </Typography>

        {/* ===== Filter & Search Bar ===== */}
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                label="Tìm theo Match _id"
                placeholder="Nhập chính xác _id (ObjectId)"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmitSearch()}
                InputProps={{
                  endAdornment: (
                    <Stack direction="row" spacing={0.5}>
                      {searchInput ? (
                        <IconButton size="small" onClick={clearSearch} title="Xoá">
                          <ClearIcon fontSize="small" />
                        </IconButton>
                      ) : null}
                      <IconButton
                        size="small"
                        onClick={handleSubmitSearch}
                        disabled={searching}
                        title="Tìm"
                      >
                        <SearchIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  ),
                }}
              />
              {searchId ? (
                searching ? (
                  <Typography variant="caption" color="text.secondary">
                    Đang tìm…
                  </Typography>
                ) : foundMatch?._id ? (
                  <Typography variant="caption" color="success.main">
                    Đã định vị trận trong {foundMatch?.tournament?.name} /{" "}
                    {foundMatch?.bracket?.name}
                  </Typography>
                ) : searchError ? (
                  <Typography variant="caption" color="error.main">
                    Không tìm thấy _id đã nhập
                  </Typography>
                ) : null
              ) : null}
            </Grid>

            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel id="tour-filter-label">Giải</InputLabel>
                <Select
                  labelId="tour-filter-label"
                  value={tourFilter}
                  onChange={handleTourChange}
                  label="Giải"
                  IconComponent={ArrowDropDownIcon}
                >
                  <MenuItem value="all">Tất cả</MenuItem>
                  {tourOptions.map((t) => (
                    <MenuItem key={t.id} value={String(t.id)}>
                      {t.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={3}>
              <FormControl
                fullWidth
                size="small"
                disabled={tourFilter === "all" && bracketOptions.length === 0}
              >
                <InputLabel id="bracket-filter-label">Bracket</InputLabel>
                <Select
                  labelId="bracket-filter-label"
                  value={bracketFilter}
                  onChange={(e) => setBracketFilter(e.target.value)}
                  label="Bracket"
                  IconComponent={ArrowDropDownIcon}
                >
                  <MenuItem value="all">Tất cả</MenuItem>
                  {bracketOptions.map((b) => (
                    <MenuItem key={b.id} value={String(b.id)}>
                      {b.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel id="status-filter-label">Trạng thái</InputLabel>
                <Select
                  labelId="status-filter-label"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  label="Trạng thái"
                  IconComponent={ArrowDropDownIcon}
                >
                  <MenuItem value="all">Tất cả</MenuItem>
                  <MenuItem value="scheduled">Chưa diễn ra</MenuItem>
                  <MenuItem value="live">Đang diễn ra</MenuItem>
                  <MenuItem value="finished">Đã kết thúc</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={12}>
              <Stack direction="row" spacing={1}>
                <Button
                  variant="text"
                  onClick={() => {
                    setTourFilter("all");
                    setBracketFilter("all");
                    setStatusFilter("all");
                    setOpenTourIds({});
                    setHighlightId(null);
                  }}
                  startIcon={<ClearIcon />}
                >
                  Xoá bộ lọc
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </Paper>

        {groupsLoading ? (
          <Box textAlign="center" py={6}>
            <CircularProgress />
          </Box>
        ) : groupsError ? (
          <Alert severity="error">{groupsError?.data?.message || groupsError.error}</Alert>
        ) : filteredGroups.length === 0 ? (
          <Alert severity="info">Không có dữ liệu theo bộ lọc</Alert>
        ) : (
          filteredGroups.map((g) => {
            const tId = g.tournamentId;
            const expanded = !!openTourIds[tId] || tourFilter === String(tId);
            return (
              <Accordion
                key={tId}
                expanded={expanded}
                onChange={(_e, isExp) => setOpenTourIds((prev) => ({ ...prev, [tId]: isExp }))}
                sx={{ mb: 2 }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">Giải: {g.tournamentName}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  {g.brackets.map((b) => (
                    <BracketSection
                      key={b.bracketId}
                      tournamentId={String(tId)}
                      bracketId={String(b.bracketId)}
                      bracketName={b.bracketName}
                      expanded={expanded}
                      onOpenAssign={openAssign}
                      onOpenDetail={setDetailId}
                      highlightId={highlightId}
                      statusFilter={statusFilter}
                    />
                  ))}
                </AccordionDetails>
              </Accordion>
            );
          })
        )}
      </Box>

      {/* Dialog Gán Trọng tài */}
      <Dialog open={!!assignDlg} onClose={() => setAssignDlg(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Gán trọng tài</DialogTitle>
        <DialogContent>
          <FormControl fullWidth size="small" sx={{ mt: 2 }} variant="outlined">
            <InputLabel id="select-referee-label">Chọn trọng tài</InputLabel>
            <Select
              labelId="select-referee-label"
              id="select-referee"
              value={assignDlg?.refereeId || ""}
              onChange={(e) => setAssignDlg((d) => ({ ...d, refereeId: e.target.value }))}
              label="Chọn trọng tài"
              IconComponent={ArrowDropDownIcon}
              sx={{
                minHeight: 56,
                "& .MuiSelect-select": { display: "flex", alignItems: "center" },
              }}
            >
              <MenuItem value="">
                <em>Chưa phân</em>
              </MenuItem>
              {users.users.map((u) => (
                <MenuItem key={u._id} value={u._id}>
                  {u.name} {u.nickname ? `(${u.nickname})` : ""}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignDlg(null)} color="error">
            Hủy
          </Button>
          <Button onClick={saveAssign} disabled={assigning} variant="contained">
            Lưu
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Chi tiết trận */}
      <Dialog open={!!detailId} onClose={() => setDetailId(null)} maxWidth="md" fullWidth>
        <DialogTitle>Chi tiết trận đấu</DialogTitle>
        <DialogContent dividers>
          {detailLoading ? (
            <Box textAlign="center" py={4}>
              <CircularProgress size={24} />
            </Box>
          ) : detailError ? (
            <Alert severity="error">{detailError?.data?.message || detailError.error}</Alert>
          ) : detail ? (
            <>
              <Typography variant="h6" gutterBottom>
                {detail?.tournament?.name} • {detail?.bracket?.name} • Vòng {detail?.round}
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                {["pairA", "pairB"].map((key) => {
                  const p = detail[key];
                  const title = key === "pairA" ? `${entityWord} A` : `${entityWord} B`;
                  return (
                    <Grid item xs={12} sm={6} key={key}>
                      <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
                        <Typography variant="subtitle1" gutterBottom>
                          {title}
                        </Typography>

                        {/* dòng chính tên */}
                        <Stack direction="row" spacing={2} alignItems="center" mb={1}>
                          <Avatar sx={{ width: 48, height: 48 }} />
                          <Box>
                            <Typography>{sideLabel(p, singlesDetail)}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {singlesDetail
                                ? maskPhone(p?.player1?.phone)
                                : `${maskPhone(p?.player1?.phone)} – ${maskPhone(
                                    p?.player2?.phone
                                  )}`}
                            </Typography>
                          </Box>
                        </Stack>

                        {/* điểm đăng ký */}
                        <Typography variant="body2" color="text.secondary">
                          {singlesDetail ? (
                            <>Điểm đăng ký: {p?.player1?.score ?? "—"}</>
                          ) : (
                            <>
                              Điểm đăng ký: {p?.player1?.score ?? "—"} + {p?.player2?.score ?? "—"}{" "}
                              ={" "}
                              {typeof p?.player1?.score === "number" &&
                              typeof p?.player2?.score === "number"
                                ? p.player1.score + p.player2.score
                                : "—"}
                            </>
                          )}
                        </Typography>
                      </Paper>
                    </Grid>
                  );
                })}
              </Grid>

              <Typography variant="subtitle1" sx={{ mt: 3, mb: 1 }}>
                Bảng điểm từng ván
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small" sx={{ tableLayout: "fixed", minWidth: 360 }}>
                  <TableHead sx={{ display: "table-header-group" }}>
                    <TableRow>
                      <TableCell sx={{ width: "20%" }}>Ván</TableCell>
                      <TableCell sx={{ width: "40%", textAlign: "center" }}>
                        {entityWord} A
                      </TableCell>
                      <TableCell sx={{ width: "40%", textAlign: "center" }}>
                        {entityWord} B
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(detail?.gameScores || []).map((g, i) => (
                      <TableRow key={i}>
                        <TableCell>#{i + 1}</TableCell>
                        <TableCell sx={{ textAlign: "center" }}>{g?.a ?? "—"}</TableCell>
                        <TableCell sx={{ textAlign: "center" }}>{g?.b ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Stack spacing={1} sx={{ mt: 3 }}>
                <Typography>
                  <strong>Trạng thái:</strong>{" "}
                  {detail?.status === "scheduled"
                    ? "Chưa diễn ra"
                    : detail?.status === "live"
                    ? "Đang diễn ra"
                    : "Đã kết thúc"}
                </Typography>
                <Typography>
                  <strong>Người thắng:</strong>{" "}
                  {detail?.winner === "A"
                    ? `${entityWord} A`
                    : detail?.winner === "B"
                    ? `${entityWord} B`
                    : "Chưa xác định"}
                </Typography>
                <Typography>
                  <strong>Trọng tài:</strong> {detail?.referee?.name || "Chưa phân"}
                </Typography>
                <Typography>
                  <strong>Match _id:</strong> {detail?._id}
                </Typography>
                {detail?.note && (
                  <Typography>
                    <strong>Ghi chú:</strong> {detail.note}
                  </Typography>
                )}
              </Stack>
            </>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailId(null)}>Đóng</Button>
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
