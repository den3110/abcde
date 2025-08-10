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
} from "@mui/material";
import {
  ExpandMore as ExpandMoreIcon,
  Edit as EditIcon,
  Info as InfoIcon,
} from "@mui/icons-material";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import { useListMatchGroupsQuery, useListMatchesPagedQuery } from "slices/tournamentsApiSlice";
import { useGetMatchQuery, useAssignRefereeMutation } from "slices/tournamentsApiSlice";
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
}) {
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRpp] = useState(10);

  const { data, isFetching, isLoading, error } = useListMatchesPagedQuery(
    { tournament: tournamentId, bracket: bracketId, page, limit: rowsPerPage },
    { skip: !expanded }
  );

  const total = data?.total || 0;
  const list = data?.list || [];
  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));
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
            return (
              <Card key={m._id} sx={{ p: 2, opacity: isFetching ? 0.7 : 1 }}>
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
                      {" • "}best-of {m?.rules?.bestOf ?? "-"}, tới {m?.rules?.pointsToWin ?? "-"} (
                      {m?.rules?.winByTwo ? "cần chênh 2" : "không cần chênh 2"})
                    </Typography>
                    <Typography variant="caption" display="block" color="text.secondary">
                      Trọng tài: {m?.referee?.name || "Chưa phân"}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <IconButton onClick={() => onOpenDetail(m._id)} size="small" title="Chi tiết">
                      <InfoIcon />
                    </IconButton>
                    <IconButton onClick={() => onOpenAssign(m)} size="small" title="Gán trọng tài">
                      <EditIcon />
                    </IconButton>
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

export default function AdminMatchesListGrouped() {
  // 1) skeleton nhóm: giải → các bracket
  const {
    data: groups = [],
    isLoading: groupsLoading,
    error: groupsError,
  } = useListMatchGroupsQuery({});
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

        {groupsLoading ? (
          <Box textAlign="center" py={6}>
            <CircularProgress />
          </Box>
        ) : groupsError ? (
          <Alert severity="error">{groupsError?.data?.message || groupsError.error}</Alert>
        ) : groups.length === 0 ? (
          <Alert severity="info">Chưa có trận nào</Alert>
        ) : (
          groups.map((g) => {
            const tId = g.tournamentId;
            const expanded = !!openTourIds[tId];
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
                      tournamentId={tId}
                      bracketId={b.bracketId}
                      bracketName={b.bracketName}
                      expanded={expanded}
                      onOpenAssign={openAssign}
                      onOpenDetail={setDetailId}
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
                              {/* mask phone */}
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

BracketSection.propTypes = {
  tournamentId: PropTypes.string.isRequired,
  bracketId: PropTypes.string.isRequired,
  bracketName: PropTypes.string.isRequired,
  expanded: PropTypes.bool, // optional
  onOpenAssign: PropTypes.func.isRequired,
  onOpenDetail: PropTypes.func.isRequired,
};

BracketSection.defaultProps = {
  expanded: false,
};
