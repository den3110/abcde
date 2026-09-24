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
  FormControl, Alert, Box, Stack, Tooltip, Divider, Collapse,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
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
  useGetVenueDahuaQuery,
  useSetVenueDahuaMutation,
} from "slices/tournamentAutoLiveApiSlice";
import { useListVenuesAdminQuery } from "slices/venueAdminApiSlice";

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
          <b>Độ mượt phụ thuộc nguồn.</b> Cam Imou qua <b>cloud</b> bị relay giới
          hạn (~0.85× realtime) nên live dài có thể trễ/giật — hãy bật tuỳ chọn
          <b>Luồng phụ</b>, <b>Tắt tiếng cam</b>, <b>Re-sync</b> trong dialog Bắt
          đầu. Mượt & trễ thấp nhất: dùng <b>Custom link RTSP nội bộ</b> của cam
          (bỏ qua cloud Imou), hoặc chạy <b>app desktop</b> tại sân dùng GPU.
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

// Nguồn đầu thu Dahua/DMSS qua P2P (serial+mật khẩu, khác mạng, không port-forward).
// Chọn venue đã cấu hình đầu thu + kênh cam. GIỚI HẠN: đầu thu ~1 phiên P2P/lúc →
// 1 cam/lúc. Có phần cấu hình creds (mã hoá ở backend).
function DahuaSourcePicker({ venueId, channel, onChange }) {
  const { data: venuesRes, isLoading: loadingVenues } = useListVenuesAdminQuery({ limit: 200 });
  const venues = venuesRes?.venues || venuesRes?.data || venuesRes?.items ||
    (Array.isArray(venuesRes) ? venuesRes : []);
  const { data: dahua } = useGetVenueDahuaQuery(venueId, { skip: !venueId });
  const [setVenueDahua, { isLoading: saving }] = useSetVenueDahuaMutation();
  const [cfgOpen, setCfgOpen] = useState(false);
  const [form, setForm] = useState({ serial: "", username: "admin", password: "", channels: 8 });
  const [msg, setMsg] = useState("");

  React.useEffect(() => {
    if (dahua) {
      setForm((f) => ({
        ...f,
        serial: dahua.serial || "",
        username: dahua.username || "admin",
        channels: dahua.channels || 8,
        password: "", // không hiển thị mật khẩu cũ
      }));
    }
  }, [dahua]);

  const chans = Math.max(1, Number(dahua?.channels || form.channels || 8));
  const saveCfg = async () => {
    setMsg("");
    if (!venueId) { setMsg("Chọn venue trước"); return; }
    if (!form.serial.trim()) { setMsg("Nhập serial đầu thu"); return; }
    try {
      await setVenueDahua({
        venueId, serial: form.serial.trim(), username: form.username.trim() || "admin",
        password: form.password || undefined, channels: Number(form.channels) || 8,
      }).unwrap();
      setMsg("Đã lưu cấu hình đầu thu.");
      setForm((f) => ({ ...f, password: "" }));
    } catch (e) {
      setMsg(e?.data?.message || String(e));
    }
  };

  return (
    <Stack spacing={1.5}>
      <FormControl fullWidth size="small">
        <InputLabel>Venue (đầu thu)</InputLabel>
        <Select
          label="Venue (đầu thu)"
          value={venueId || ""}
          onChange={(e) => onChange(e.target.value, channel)}
          disabled={loadingVenues}
        >
          {venues.map((v) => (
            <MenuItem key={v._id} value={v._id}>{v.name}</MenuItem>
          ))}
        </Select>
      </FormControl>

      {venueId ? (
        dahua?.hasPassword ? (
          <>
            <Alert severity="success" sx={{ py: 0.5 }}>
              Đầu thu: <b>{dahua.serial}</b> · {dahua.channels} kênh · đã có mật khẩu.
            </Alert>
            <FormControl size="small" sx={{ maxWidth: 200 }}>
              <InputLabel>Kênh cam</InputLabel>
              <Select
                label="Kênh cam"
                value={channel || 1}
                onChange={(e) => onChange(venueId, Number(e.target.value))}
              >
                {Array.from({ length: chans }, (_, i) => i + 1).map((n) => (
                  <MenuItem key={n} value={n}>Kênh {n}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </>
        ) : (
          <Alert severity="warning" sx={{ py: 0.5 }}>
            Venue này chưa cấu hình đầu thu Dahua. Mở &quot;Cấu hình đầu thu&quot; bên dưới.
          </Alert>
        )
      ) : null}

      <Button size="small" onClick={() => setCfgOpen((o) => !o)} sx={{ alignSelf: "flex-start" }}>
        {cfgOpen ? "Ẩn cấu hình đầu thu" : "Cấu hình đầu thu (serial + mật khẩu)"}
      </Button>
      <Collapse in={cfgOpen}>
        <Stack spacing={1}>
          <Alert severity="info" sx={{ py: 0.5 }}>
            Đầu thu Dahua/DMSS truy cập TỪ XA qua P2P chỉ bằng <b>serial + mật khẩu</b>
            {" "}(không cần port-forward/VPN). Đầu thu chỉ cho <b>~1 phiên P2P/lúc</b> → live
            1 cam tại một thời điểm. Mật khẩu được mã hoá ở máy chủ.
          </Alert>
          <TextField size="small" fullWidth label="Serial đầu thu" value={form.serial}
            onChange={(e) => setForm({ ...form, serial: e.target.value })} />
          <Stack direction="row" spacing={1}>
            <TextField size="small" fullWidth label="Tài khoản" value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })} />
            <TextField size="small" sx={{ maxWidth: 130 }} type="number" label="Số kênh"
              value={form.channels}
              onChange={(e) => setForm({ ...form, channels: e.target.value })} />
          </Stack>
          <TextField size="small" fullWidth type="password"
            label={dahua?.hasPassword ? "Mật khẩu mới (để trống = giữ nguyên)" : "Mật khẩu"}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <Button variant="outlined" size="small" onClick={saveCfg} disabled={saving || !venueId}
            sx={{ alignSelf: "flex-start" }}>
            {saving ? "Đang lưu..." : "Lưu cấu hình đầu thu"}
          </Button>
          {msg ? <Typography variant="caption" color="text.secondary">{msg}</Typography> : null}
        </Stack>
      </Collapse>
    </Stack>
  );
}

const CORNER_OPTS = [
  { v: "top-left", l: "Trên · Trái" },
  { v: "top-right", l: "Trên · Phải" },
  { v: "bottom-left", l: "Dưới · Trái" },
  { v: "bottom-right", l: "Dưới · Phải" },
];

function StartDialog({ tournamentId, court, onClose }) {
  const [deviceId, setDeviceId] = useState("");
  const [venueId, setVenueId] = useState("");
  const [srcType, setSrcType] = useState("imou"); // imou | url
  const [sourceUrl, setSourceUrl] = useState("");
  const [layout, setLayout] = useState({ scoreboard: "top-left", brand: "top-right", sponsor: "bottom-right" });
  const [destinations, setDestinations] = useState([]);
  const [dtype, setDtype] = useState("fb");
  const [durl, setDurl] = useState("");
  const [dkey, setDkey] = useState("");
  const [dlabel, setDlabel] = useState("");
  const [ytKey, setYtKey] = useState("");
  const [selectedFbPage, setSelectedFbPage] = useState("");
  const [err, setErr] = useState("");
  // Cấu hình nâng cao (khớp advancedEnv backend)
  const [advOpen, setAdvOpen] = useState(false);
  const [adv, setAdv] = useState({
    resolutionH: 1080, fps: 0, videoBitrateKbps: 4500, audioBitrateKbps: 128, encoder: "auto",
  });
  // Tuỳ chọn riêng cho cam Imou (cloud)
  const [imouStreamId, setImouStreamId] = useState("0"); // 0=chính, 1=phụ (nhẹ)
  const [imouAudio, setImouAudio] = useState("0");        // 0=tắt tiếng cam
  const [resyncSec, setResyncSec] = useState(600);        // re-sync mép live (Imou)
  const [dahuaChannel, setDahuaChannel] = useState(1);    // kênh cam đầu thu Dahua P2P
  // 0=luồng chính (nét, NẶNG — dễ giật khi P2P relay); 1=luồng phụ (nhẹ, ỔN ĐỊNH).
  // Mặc định PHỤ vì P2P/relay băng thông thấp → chính hay starve input sau ~1 phút.
  const [dahuaSubtype, setDahuaSubtype] = useState(1);
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
    if (dtype === "youtube") {
      if (!ytKey.trim()) { setErr("Nhập YouTube stream key (từ YouTube Studio)"); return; }
      setDestinations((d) => [...d, {
        type: "rtmp", label: "YouTube",
        streamUrl: "rtmp://a.rtmp.youtube.com/live2", streamKey: ytKey.trim(),
      }]);
      setYtKey("");
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
    if (srcType === "imou" && !deviceId) { setErr("Chọn cam"); return; }
    if (srcType === "dahua" && !venueId) { setErr("Chọn venue có đầu thu Dahua"); return; }
    if (srcType === "url" && !sourceUrl.trim()) { setErr("Nhập Custom link"); return; }
    if (destinations.length === 0) { setErr("Thêm tối thiểu 1 điểm đến"); return; }
    const advanced = {
      resolutionH: Number(adv.resolutionH) || 1080,
      fps: Number(adv.fps) || 0,
      videoBitrateKbps: Number(adv.videoBitrateKbps) || 4500,
      audioBitrateKbps: Number(adv.audioBitrateKbps) || 128,
      encoder: adv.encoder || "auto",
      // Chỉ áp cho nguồn Imou (cloud)
      ...(srcType === "imou"
        ? { imouStreamId, imouAudio, resyncSec: Number(resyncSec) || 0 }
        : {}),
    };
    try {
      await startAutoLive({
        tournamentId,
        courtStationId: court._id,
        imouDeviceId: srcType === "imou" ? deviceId : "",
        venueId: (srcType === "imou" || srcType === "dahua") ? venueId : "",
        sourceUrl: srcType === "url" ? sourceUrl.trim() : "",
        dahuaP2p: srcType === "dahua"
          ? { channel: Number(dahuaChannel) || 1, subtype: Number(dahuaSubtype) }
          : undefined,
        destinations,
        layout,
        advanced,
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
          <FormControl fullWidth size="small">
            <InputLabel>Nguồn video</InputLabel>
            <Select label="Nguồn video" value={srcType} onChange={(e) => setSrcType(e.target.value)}>
              <MenuItem value="imou">Camera Imou</MenuItem>
              <MenuItem value="dahua">Đầu thu Dahua P2P (1 cam/lúc)</MenuItem>
              <MenuItem value="url">Custom link (m3u8 / RTSP / RTMP)</MenuItem>
            </Select>
          </FormControl>
          {srcType === "imou" && (
            <CamPicker
              deviceId={deviceId}
              onChange={(id, cam) => { setDeviceId(id); setVenueId(cam?.venueId || ""); }}
            />
          )}
          {srcType === "dahua" && (
            <>
              <DahuaSourcePicker
                venueId={venueId}
                channel={dahuaChannel}
                onChange={(vid, ch) => { setVenueId(vid); setDahuaChannel(ch || 1); }}
              />
              <FormControl size="small" fullWidth>
                <InputLabel>Luồng cam</InputLabel>
                <Select
                  label="Luồng cam"
                  value={dahuaSubtype}
                  onChange={(e) => setDahuaSubtype(e.target.value)}
                >
                  <MenuItem value={1}>Phụ (nhẹ, ỔN ĐỊNH — khuyến nghị cho P2P/xa)</MenuItem>
                  <MenuItem value={0}>Chính (nét, nặng — chỉ khi mạng khoẻ/LAN)</MenuItem>
                </Select>
              </FormControl>
              <Alert severity="info" sx={{ py: 0.5 }}>
                Qua P2P từ xa thường rơi về <b>relay</b> (băng thông thấp) → luồng
                <b> chính</b> hay mượt ~1 phút rồi giật/mất tín hiệu. Chọn <b>luồng phụ</b>
                {" "}để ổn định; muốn nét thì mở cổng RTSP (LAN/DDNS).
              </Alert>
            </>
          )}
          {srcType === "url" && (
            <TextField
              size="small" fullWidth label="Link nguồn"
              placeholder="rtsp://admin:pass@192.168.1.10:554/cam/realmonitor?channel=1&subtype=0"
              value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)}
              helperText="RTSP/HLS/RTMP. Nguồn nội bộ (LAN) mượt & trễ thấp nhất."
            />
          )}

          {srcType === "imou" && (
            <>
              <Alert severity="info" sx={{ py: 0.5 }}>
                Cam Imou kéo qua <b>cloud Imou</b> có thể trễ/giật khi live dài
                (relay giới hạn ~0.85× realtime). Mượt nhất: dùng <b>Custom link
                RTSP nội bộ</b> của cam. Các tuỳ chọn dưới giúp giảm nhẹ.
              </Alert>
              <Stack direction="row" spacing={1}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Luồng cam</InputLabel>
                  <Select label="Luồng cam" value={imouStreamId} onChange={(e) => setImouStreamId(e.target.value)}>
                    <MenuItem value="0">Chính (nét, nặng)</MenuItem>
                    <MenuItem value="1">Phụ (nhẹ, đỡ trễ)</MenuItem>
                  </Select>
                </FormControl>
                <FormControl size="small" fullWidth>
                  <InputLabel>Tiếng cam</InputLabel>
                  <Select label="Tiếng cam" value={imouAudio} onChange={(e) => setImouAudio(e.target.value)}>
                    <MenuItem value="0">Tắt (khuyến nghị)</MenuItem>
                    <MenuItem value="1">Bật</MenuItem>
                  </Select>
                </FormControl>
                <FormControl size="small" fullWidth>
                  <InputLabel>Re-sync</InputLabel>
                  <Select label="Re-sync" value={resyncSec} onChange={(e) => setResyncSec(e.target.value)}>
                    <MenuItem value={0}>Tắt</MenuItem>
                    <MenuItem value={300}>Mỗi 5 phút</MenuItem>
                    <MenuItem value={600}>Mỗi 10 phút</MenuItem>
                    <MenuItem value={900}>Mỗi 15 phút</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            </>
          )}

          <Divider>Vị trí overlay</Divider>
          <Stack direction="row" spacing={1}>
            {[
              { key: "scoreboard", label: "Bảng điểm" },
              { key: "brand", label: "Logo PickleTour" },
              { key: "sponsor", label: "Tài trợ" },
            ].map((f) => (
              <FormControl key={f.key} size="small" fullWidth>
                <InputLabel>{f.label}</InputLabel>
                <Select
                  label={f.label}
                  value={layout[f.key]}
                  onChange={(e) => setLayout((l) => ({ ...l, [f.key]: e.target.value }))}
                >
                  {CORNER_OPTS.map((o) => (
                    <MenuItem key={o.v} value={o.v}>{o.l}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            ))}
          </Stack>

          <Box>
            <Button
              size="small" color="inherit"
              onClick={() => setAdvOpen((v) => !v)}
              endIcon={advOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            >
              Cấu hình nâng cao (bitrate, độ phân giải, encoder…)
            </Button>
            <Collapse in={advOpen}>
              <Stack spacing={1.5} mt={1}>
                <Stack direction="row" spacing={1}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Độ phân giải</InputLabel>
                    <Select label="Độ phân giải" value={adv.resolutionH}
                      onChange={(e) => setAdv((a) => ({ ...a, resolutionH: e.target.value }))}>
                      <MenuItem value={1080}>1080p</MenuItem>
                      <MenuItem value={720}>720p</MenuItem>
                      <MenuItem value={480}>480p</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl size="small" fullWidth>
                    <InputLabel>FPS</InputLabel>
                    <Select label="FPS" value={adv.fps}
                      onChange={(e) => setAdv((a) => ({ ...a, fps: e.target.value }))}>
                      <MenuItem value={0}>Khớp nguồn</MenuItem>
                      <MenuItem value={30}>30</MenuItem>
                      <MenuItem value={25}>25</MenuItem>
                      <MenuItem value={20}>20</MenuItem>
                      <MenuItem value={15}>15</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Encoder</InputLabel>
                    <Select label="Encoder" value={adv.encoder}
                      onChange={(e) => setAdv((a) => ({ ...a, encoder: e.target.value }))}>
                      <MenuItem value="auto">Tự động (ưu tiên GPU)</MenuItem>
                      <MenuItem value="x264">x264 (CPU)</MenuItem>
                      <MenuItem value="nvenc">NVIDIA NVENC</MenuItem>
                      <MenuItem value="videotoolbox">Apple VideoToolbox</MenuItem>
                      <MenuItem value="qsv">Intel QuickSync</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>
                <Stack direction="row" spacing={1}>
                  <TextField
                    size="small" fullWidth type="number" label="Video bitrate (kbps)"
                    value={adv.videoBitrateKbps}
                    onChange={(e) => setAdv((a) => ({ ...a, videoBitrateKbps: e.target.value }))}
                    helperText="Mạng yếu → 2000–3000; khoẻ → 5000–8000"
                  />
                  <FormControl size="small" fullWidth>
                    <InputLabel>Audio (kbps)</InputLabel>
                    <Select label="Audio (kbps)" value={adv.audioBitrateKbps}
                      onChange={(e) => setAdv((a) => ({ ...a, audioBitrateKbps: e.target.value }))}>
                      <MenuItem value={64}>64</MenuItem>
                      <MenuItem value={96}>96</MenuItem>
                      <MenuItem value={128}>128</MenuItem>
                      <MenuItem value={160}>160</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>
              </Stack>
            </Collapse>
          </Box>

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
            ) : dtype === "youtube" ? (
              <TextField
                size="small" fullWidth label="YouTube stream key"
                placeholder="xxxx-xxxx-xxxx-xxxx (YouTube Studio → Phát trực tiếp)"
                value={ytKey} onChange={(e) => setYtKey(e.target.value)}
              />
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
