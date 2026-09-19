/* eslint-disable react/prop-types */
// Admin: quản lý phiên auto-live server-side cho 1 giải đấu.
// Mỗi court có 1 phiên (tối đa) — hàng court chọn cam Imou + destination(s)
// (FB pages + YT + custom RTMP) → Start. Bảng list phiên đang chạy: status,
// currentMatch, uptime, nút Stop / xem log.
import React, { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Card, CardContent, Grid, Typography, Chip, Button, IconButton,
  Table, TableBody, TableCell, TableHead, TableRow, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Select, InputLabel,
  FormControl, Alert, Box, Stack, Tooltip, Divider,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import RefreshIcon from "@mui/icons-material/Refresh";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import {
  useListAutoLiveSessionsQuery,
  useStartAutoLiveMutation,
  useStopAutoLiveMutation,
  useListTournamentCourtsForAutoLiveQuery,
  useListAdminFbPagesQuery,
  useListAvailableCamsQuery,
  useGetAutoLiveStatsQuery,
} from "slices/tournamentAutoLiveApiSlice";

function statusChip(status) {
  const map = {
    live: { c: "success", l: "LIVE" },
    starting: { c: "info", l: "Đang khởi động" },
    reconnecting: { c: "warning", l: "Đang nối lại" },
    paused: { c: "default", l: "Tạm dừng" },
    stopped: { c: "default", l: "Đã dừng" },
    error: { c: "error", l: "Lỗi" },
  };
  const m = map[status] || { c: "default", l: status };
  return <Chip size="small" color={m.c} label={m.l} />;
}

function fmtUptime(startedAt) {
  if (!startedAt) return "—";
  const ms = Date.now() - new Date(startedAt).getTime();
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h${m % 60}m` : `${m}m`;
}

export default function AutoLivePage() {
  const { id: tournamentId } = useParams();
  const { data: sessions = [], refetch, isFetching } = useListAutoLiveSessionsQuery(
    { tournamentId },
    { pollingInterval: 10_000 }
  );
  const { data: courts = [] } = useListTournamentCourtsForAutoLiveQuery(tournamentId);
  const { data: stats } = useGetAutoLiveStatsQuery(undefined, { pollingInterval: 10_000 });
  const [startOpen, setStartOpen] = useState(null); // court object đang mở dialog
  const [stopAutoLive] = useStopAutoLiveMutation();

  const runningByCourt = useMemo(() => {
    const m = new Map();
    for (const s of sessions) {
      if (["live", "starting", "reconnecting", "paused"].includes(s.status)) {
        m.set(String(s.court?._id || s.court), s);
      }
    }
    return m;
  }, [sessions]);
  // Session error gần nhất theo court — để hiển thị lý do lỗi nếu chưa có
  // phiên đang chạy.
  const lastErrorByCourt = useMemo(() => {
    const m = new Map();
    for (const s of sessions) {
      const cid = String(s.court?._id || s.court);
      if (s.status === "error" && !m.has(cid)) m.set(cid, s);
    }
    return m;
  }, [sessions]);

  const doStop = async (id) => {
    if (!window.confirm("Dừng phiên live cho court này?")) return;
    await stopAutoLive(id).unwrap();
    refetch();
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box p={2}>
        <Stack direction="row" alignItems="center" spacing={2} mb={2}>
          <Typography variant="h5" fontWeight={700}>
            Auto-Live theo sân
          </Typography>
          <IconButton onClick={() => refetch()} disabled={isFetching}>
            <RefreshIcon />
          </IconButton>
        </Stack>

        <Alert severity="info" sx={{ mb: 2 }}>
          Server tự pull stream từ cam Imou đã gắn vào court → chồng overlay
          (điểm số, tên đội) → đẩy đồng thời lên FB/YT/RTMP tuỳ chọn. Khi trận
          hiện tại kết thúc và court được assign trận mới, overlay tự đổi mà
          không đứt live.
        </Alert>
        <Alert severity="warning" sx={{ mb: 2 }}>
          MVP giai đoạn 1: cam Imou hiện gắn vào <b>sân vật lý (VenueCourt)</b>,
          chưa auto-link với CourtStation của giải. Admin cần copy tay
          <code> deviceId </code> của cam từ trang chủ sân → dán vào dialog Start.
        </Alert>

        {stats && (
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} mb={1}>
                Tài nguyên máy chủ
              </Typography>
              <Grid container spacing={2}>
                <ResCard label="Đang live" value={`${stats.liveCount} luồng`} />
                <ResCard label="CPU" value={`${stats.cores} lõi · load ${stats.load1}`} />
                <ResCard label="RAM" value={`${Math.round((stats.totalMemMB - stats.freeMemMB) / 1024)}/${Math.round(stats.totalMemMB / 1024)} GB`} />
                <ResCard
                  label="Ước tính tối đa"
                  value={`~${stats.maxConcurrent} luồng`}
                  hint={`${stats.avgCorePerStream || "?"} lõi + ${stats.avgMemPerStreamMB || "?"}MB/luồng · nghẽn ${stats.limitedBy === "cpu" ? "CPU" : "RAM"}`}
                  highlight
                />
              </Grid>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} mb={1}>
              Các sân của giải
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Sân</TableCell>
                  <TableCell>Phiên hiện tại</TableCell>
                  <TableCell>Điểm đến</TableCell>
                  <TableCell>CPU / RAM</TableCell>
                  <TableCell>Uptime</TableCell>
                  <TableCell align="right">Hành động</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(courts?.items || courts || []).map((c) => {
                  const running = runningByCourt.get(String(c._id));
                  const lastErr = !running && lastErrorByCourt.get(String(c._id));
                  return (
                    <TableRow key={c._id}>
                      <TableCell>
                        <b>{c.label || c.name}</b>
                        {c.code ? <Chip size="small" label={c.code} sx={{ ml: 1 }} /> : null}
                        {c.clusterName ? (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {c.clusterName}
                          </Typography>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {running ? (
                          <Stack direction="row" spacing={1} alignItems="center">
                            {statusChip(running.status)}
                            <Typography variant="caption" color="text.secondary">
                              {running.currentMatchLabel || "chờ trận…"}
                            </Typography>
                          </Stack>
                        ) : lastErr ? (
                          <Stack direction="row" spacing={1} alignItems="center">
                            {statusChip("error")}
                            <Tooltip title={lastErr.lastError || ""}>
                              <Typography variant="caption" color="error" sx={{ maxWidth: 200 }} noWrap>
                                {lastErr.lastError || "lỗi worker"}
                              </Typography>
                            </Tooltip>
                          </Stack>
                        ) : (
                          <Chip size="small" label="—" />
                        )}
                      </TableCell>
                      <TableCell>
                        {running ? (
                          <Stack direction="row" spacing={0.5}>
                            {(running.destinations || []).map((d, i) => (
                              <Tooltip
                                key={i}
                                title={d.watchUrl ? `Mở link xem: ${d.watchUrl}` : `${d.type.toUpperCase()} ${d.pageName || ""}`}
                              >
                                <Chip
                                  size="small"
                                  color={d.watchUrl ? "primary" : "default"}
                                  icon={d.watchUrl ? <OpenInNewIcon fontSize="small" /> : undefined}
                                  label={`${d.type.toUpperCase()}${d.pageName ? ` · ${d.pageName}` : ""}`}
                                  clickable={!!d.watchUrl}
                                  component={d.watchUrl ? "a" : "div"}
                                  href={d.watchUrl || undefined}
                                  target={d.watchUrl ? "_blank" : undefined}
                                  rel={d.watchUrl ? "noopener noreferrer" : undefined}
                                />
                              </Tooltip>
                            ))}
                          </Stack>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        {running ? (
                          <Typography variant="caption" color="text.secondary">
                            {(running.cpuPct || 0)}% · {(running.memMB || 0)}MB
                          </Typography>
                        ) : "—"}
                      </TableCell>
                      <TableCell>{running ? fmtUptime(running.startedAt) : "—"}</TableCell>
                      <TableCell align="right">
                        {running ? (
                          <Button
                            size="small" variant="outlined" color="error"
                            startIcon={<StopIcon />} onClick={() => doStop(running._id)}
                          >Dừng</Button>
                        ) : (
                          <Button
                            size="small" variant="contained"
                            startIcon={<PlayArrowIcon />}
                            onClick={() => setStartOpen(c)}
                          >Bắt đầu</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {(courts?.items || courts || []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography variant="caption" color="text.secondary">
                        Giải chưa có sân được phân bổ.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {startOpen && (
          <StartDialog
            tournamentId={tournamentId}
            court={startOpen}
            onClose={() => { setStartOpen(null); refetch(); }}
          />
        )}
      </Box>
    </DashboardLayout>
  );
}

function CamPicker({ deviceId, onChange }) {
  const { data: cams = [], isLoading } = useListAvailableCamsQuery();
  const items = useMemo(() => {
    const arr = [...cams];
    arr.sort((a, b) =>
      (a.venueName || "").localeCompare(b.venueName || "") ||
      (a.courtName || "").localeCompare(b.courtName || "") ||
      (a.camName || "").localeCompare(b.camName || "")
    );
    return arr;
  }, [cams]);
  if (isLoading) {
    return <TextField size="small" fullWidth disabled label="Đang tải danh sách cam..." />;
  }
  if (!items.length) {
    return (
      <Alert severity="warning">
        Chưa có cam Imou nào được gắn vào sân. Chủ sân cần login Imou trong app
        mobile rồi gắn cam vào sân trước.
      </Alert>
    );
  }
  return (
    <FormControl fullWidth size="small">
      <InputLabel>Chọn cam Imou</InputLabel>
      <Select
        label="Chọn cam Imou"
        value={deviceId}
        onChange={(e) => {
          const cam = items.find((c) => c.deviceId === e.target.value);
          onChange(e.target.value, cam);
        }}
      >
        {items.map((c) => (
          <MenuItem key={`${c.courtId}:${c.deviceId}`} value={c.deviceId}>
            {c.venueName} / {c.courtName} · {c.camName}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function StartDialog({ tournamentId, court, onClose }) {
  const [deviceId, setDeviceId] = useState("");
  const [venueId, setVenueId] = useState("");
  const [destinations, setDestinations] = useState([]);
  const [dtype, setDtype] = useState("rtmp");
  const [durl, setDurl] = useState("");
  const [dkey, setDkey] = useState("");
  const [dlabel, setDlabel] = useState("");
  const [selectedFbPage, setSelectedFbPage] = useState("");
  const [err, setErr] = useState("");
  const { data: fbPages = [] } = useListAdminFbPagesQuery();
  const [startAutoLive, { isLoading }] = useStartAutoLiveMutation();

  const addDest = () => {
    setErr("");
    if (dtype === "fb") {
      const page = fbPages.find((p) => p.pageId === selectedFbPage);
      if (!page) { setErr("Chọn 1 fanpage"); return; }
      setDestinations((d) => [...d, {
        type: "fb", label: page.pageName, pageId: page.pageId, pageName: page.pageName,
        streamUrl: "", // backend fill sau khi tạo live_video
      }]);
      return;
    }
    if (!durl) { setErr("Nhập URL RTMP"); return; }
    setDestinations((d) => [...d, {
      type: dtype, label: dlabel || dtype.toUpperCase(),
      streamUrl: durl, streamKey: dkey,
    }]);
    setDurl(""); setDkey(""); setDlabel("");
  };

  const submit = async () => {
    setErr("");
    if (!deviceId) { setErr("Chọn cam"); return; }
    if (destinations.length === 0) { setErr("Thêm tối thiểu 1 điểm đến"); return; }
    try {
      await startAutoLive({
        tournamentId,
        courtStationId: court._id,
        imouDeviceId: deviceId,
        venueId,
        destinations,
      }).unwrap();
      onClose();
    } catch (e) {
      setErr(e?.data?.message || String(e));
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Bắt đầu Auto-Live — {court.label || court.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <CamPicker
            deviceId={deviceId}
            onChange={(id, cam) => { setDeviceId(id); setVenueId(cam?.venueId || ""); }}
          />

          <Divider>Điểm đến livestream</Divider>

          <Stack direction="row" spacing={1}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Loại</InputLabel>
              <Select label="Loại" value={dtype} onChange={(e) => setDtype(e.target.value)}>
                <MenuItem value="fb">Facebook Page</MenuItem>
                <MenuItem value="youtube">YouTube</MenuItem>
                <MenuItem value="rtmp">RTMP tuỳ chỉnh</MenuItem>
              </Select>
            </FormControl>
            {dtype === "fb" ? (
              <FormControl size="small" fullWidth>
                <InputLabel>Fanpage</InputLabel>
                <Select label="Fanpage" value={selectedFbPage} onChange={(e) => setSelectedFbPage(e.target.value)}>
                  {fbPages.map((p) => (
                    <MenuItem key={p.pageId} value={p.pageId}>{p.pageName}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : (
              <>
                <TextField size="small" label="RTMP URL" fullWidth value={durl} onChange={(e) => setDurl(e.target.value)} />
                <TextField size="small" label="Stream Key" fullWidth value={dkey} onChange={(e) => setDkey(e.target.value)} />
              </>
            )}
            <Button size="small" variant="outlined" onClick={addDest}>Thêm</Button>
          </Stack>

          {destinations.length > 0 && (
            <Box>
              {destinations.map((d, i) => (
                <Chip
                  key={i} label={`${d.type.toUpperCase()} · ${d.label}`}
                  onDelete={() => setDestinations((arr) => arr.filter((_, j) => j !== i))}
                  sx={{ mr: 0.5, mb: 0.5 }}
                />
              ))}
            </Box>
          )}

          {err && <Alert severity="error">{err}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Huỷ</Button>
        <Button variant="contained" onClick={submit} disabled={isLoading}>
          Bắt đầu
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ResCard({ label, value, hint, highlight }) {
  return (
    <Grid item xs={6} md={3}>
      <Box
        sx={{
          p: 1.5, borderRadius: 2, height: "100%",
          border: (t) => `1px solid ${highlight ? t.palette.primary.main : t.palette.divider}`,
          bgcolor: (t) => (highlight ? t.palette.action.hover : "transparent"),
        }}
      >
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="h6" fontWeight={800} lineHeight={1.2}>{value}</Typography>
        {hint ? (
          <Typography variant="caption" color="text.secondary">{hint}</Typography>
        ) : null}
      </Box>
    </Grid>
  );
}
