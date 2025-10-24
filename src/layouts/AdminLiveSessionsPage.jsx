// =========================
// FILE: src/pages/admin/AdminLiveSessionsPage.jsx
// =========================
/* eslint-disable react/prop-types */
import React, { useMemo, useState, useCallback } from "react";
import {
  Box,
  Container,
  Stack,
  Typography,
  Paper,
  Chip,
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
  Divider,
  CircularProgress,
  Switch,
  FormControlLabel,
  Button,
  Alert,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import LiveTvIcon from "@mui/icons-material/LiveTv";
import LinkIcon from "@mui/icons-material/Link";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import durationPlugin from "dayjs/plugin/duration";
import { useAdminListLiveSessionsQuery } from "slices/liveApiSlice";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

dayjs.extend(relativeTime);
dayjs.extend(durationPlugin);

/* ---------------------------------- utils --------------------------------- */
const PLATFORM_LABEL = {
  facebook: "Facebook",
  youtube: "YouTube",
  tiktok: "TikTok",
  rtmp: "RTMP",
  other: "Khác",
};

function normalizePlatform(p) {
  if (!p) return "other";
  const s = String(p).toLowerCase();
  if (s.includes("face")) return "facebook";
  if (s.includes("you")) return "youtube";
  if (s.includes("tik")) return "tiktok";
  if (s.includes("rtmp")) return "rtmp";
  return s;
}

function formatPlayers(match) {
  const a1 = match?.pairA?.player1?.user?.nickname || match?.pairA?.player1?.user?.name;
  const a2 = match?.pairA?.player2?.user?.nickname || match?.pairA?.player2?.user?.name;
  const b1 = match?.pairB?.player1?.user?.nickname || match?.pairB?.player1?.user?.name;
  const b2 = match?.pairB?.player2?.user?.nickname || match?.pairB?.player2?.user?.name;

  const side = (p1, p2) => [p1, p2].filter(Boolean).join(" / ") || "?";
  return `${side(a1, a2)}  vs  ${side(b1, b2)}`;
}

function formatBracket(bracket) {
  if (!bracket) return "-";
  const bits = [bracket?.name, bracket?.stage, bracket?.round].filter(Boolean);
  return bits.join(" • ");
}

function humanDuration(startedAt) {
  if (!startedAt) return "-";
  const d = dayjs.duration(dayjs().diff(dayjs(startedAt)));
  const h = d.hours();
  const m = d.minutes();
  const s = d.seconds();
  return h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`;
}

function copyToClipboard(text) {
  try {
    navigator.clipboard?.writeText(text);
  } catch (e) {}
}

/* ------------------------------ row component ----------------------------- */
function LiveOutputs({ outputs = [] }) {
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      {outputs.map((o, idx) => {
        const platform = normalizePlatform(o.platform || o.provider);
        const label = PLATFORM_LABEL[platform] || o.platform || o.provider || "N/A";
        const target = o.targetName || o.pageName || o.channelName || o.account || o.pageId || "";
        const url = o.publicUrl || o.viewUrl || o.url || "";
        return (
          <Stack
            key={`${platform}-${idx}`}
            direction="row"
            spacing={0.5}
            alignItems="center"
            sx={{ bgcolor: "action.hover", px: 1, py: 0.5, borderRadius: 1.5 }}
          >
            <Chip
              size="small"
              icon={<LiveTvIcon fontSize="small" />}
              label={label}
              sx={{ fontWeight: 600 }}
            />
            {target ? (
              <Typography variant="body2" sx={{ px: 0.5, opacity: 0.8 }}>
                ({target})
              </Typography>
            ) : null}
            {url ? (
              <Tooltip title="Mở link live">
                <IconButton
                  size="small"
                  component="a"
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <OpenInNewIcon fontSize="inherit" />
                </IconButton>
              </Tooltip>
            ) : (
              <Tooltip title="Không có link công khai">
                <span>
                  <IconButton size="small" disabled>
                    <LinkIcon fontSize="inherit" />
                  </IconButton>
                </span>
              </Tooltip>
            )}
            {url ? (
              <Tooltip title="Copy link">
                <IconButton size="small" onClick={() => copyToClipboard(url)}>
                  <ContentCopyIcon fontSize="inherit" />
                </IconButton>
              </Tooltip>
            ) : null}
          </Stack>
        );
      })}
    </Stack>
  );
}

function LiveRow({ session }) {
  const match = session?.match;
  const bracket = match?.bracket || session?.bracket;
  const tournament = match?.tournament || session?.tournament;
  const code = match?.code || match?.shortCode || (match?._id ? String(match._id).slice(-6) : "-");
  const status = session?.status || "live";
  const startedBy = session?.startedBy?.name || session?.user?.name || session?.owner?.name || "?";
  const startedAt = session?.startedAt || session?.createdAt;

  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.5}
        alignItems={{ xs: "flex-start", md: "center" }}
        justifyContent="space-between"
      >
        <Stack spacing={0.5} sx={{ minWidth: 240, flex: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              size="small"
              color={status === "live" ? "error" : "default"}
              label={status.toUpperCase()}
            />
            <Typography variant="subtitle1" fontWeight={700}>
              Mã trận: {code}
            </Typography>
            {startedAt ? (
              <Typography variant="body2" sx={{ opacity: 0.7 }}>
                • {humanDuration(startedAt)}
              </Typography>
            ) : null}
          </Stack>
          <Typography variant="body2" sx={{ opacity: 0.9 }}>
            {formatPlayers(match)}
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip size="small" label={`Bracket: ${formatBracket(bracket)}`} />
            <Chip size="small" label={`Giải: ${tournament?.name || "-"}`} />
            <Chip size="small" label={`Streamer: ${startedBy}`} />
          </Stack>
        </Stack>

        <Stack spacing={0.75} sx={{ flex: 3, width: "100%" }}>
          <LiveOutputs outputs={session?.outputs || []} />
        </Stack>
      </Stack>
    </Paper>
  );
}

/* --------------------------------- page ----------------------------------- */
export default function AdminLiveSessionsPage() {
  const theme = useTheme();
  const isSm = useMediaQuery(theme.breakpoints.down("sm"));

  const [q, setQ] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [platformFilter, setPlatformFilter] = useState([]); // ["facebook","youtube",...]
  const [tournamentId, setTournamentId] = useState("all");

  const {
    data: resp,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useAdminListLiveSessionsQuery(
    { status: "live" },
    { pollingInterval: autoRefresh ? 10000 : 0, refetchOnMountOrArgChange: true }
  );

  const sessions = resp?.items || resp?.data || resp || [];

  const tournaments = useMemo(() => {
    const map = new Map();
    sessions.forEach((s) => {
      const t = s?.match?.tournament || s?.tournament;
      if (t?._id) map.set(t._id, t);
    });
    return Array.from(map.values());
  }, [sessions]);

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    return (sessions || []).filter((s) => {
      // platform filter
      if (platformFilter.length > 0) {
        const pls = (s?.outputs || []).map((o) => normalizePlatform(o.platform || o.provider));
        if (!pls.some((p) => platformFilter.includes(p))) return false;
      }
      // tournament
      if (tournamentId !== "all") {
        const tid = s?.match?.tournament?._id || s?.tournament?._id;
        if (tid !== tournamentId) return false;
      }
      // keyword: match code, player names, bracket/tournament names, page/channel
      if (keyword) {
        const hay = [
          s?.match?.code,
          s?.match?.shortCode,
          s?.match?._id,
          formatPlayers(s?.match || {}),
          s?.match?.bracket?.name,
          s?.match?.tournament?.name,
          s?.bracket?.name,
          s?.tournament?.name,
          s?.startedBy?.name,
          ...(s?.outputs || []).map(
            (o) =>
              `${o.platform || o.provider} ${
                o.targetName || o.pageName || o.channelName || o.account || o.pageId || ""
              } ${o.publicUrl || o.url || ""}`
          ),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(keyword)) return false;
      }
      return true;
    });
  }, [sessions, q, platformFilter, tournamentId]);

  const platformsAvailable = useMemo(() => {
    const set = new Set();
    sessions.forEach((s) =>
      (s.outputs || []).forEach((o) => set.add(normalizePlatform(o.platform || o.provider)))
    );
    return Array.from(set);
  }, [sessions]);

  const handleTogglePlatform = useCallback((p) => {
    setPlatformFilter((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }, []);

  return (
    <DashboardLayout>
      <DashboardNavbar />

      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing={2}
          sx={{ mb: 2 }}
        >
          <Stack>
            <Typography variant={isSm ? "h6" : "h5"} fontWeight={800}>
              Quản lý các trận đang LIVE
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.75 }}>
              Hiển thị: trận nào • VĐV nào • bracket nào • giải nào • nền tảng nào • link •
              page/channel • người live
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1}>
            <FormControlLabel
              control={
                <Switch checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
              }
              label="Tự làm mới (10s)"
            />
            <Tooltip title="Làm mới ngay">
              <span>
                <IconButton onClick={() => refetch()} disabled={isFetching}>
                  <RefreshIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Stack>

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            alignItems={{ xs: "stretch", md: "center" }}
          >
            <TextField
              fullWidth
              placeholder="Tìm theo mã trận, VĐV, giải, bracket, page/channel, link..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip
                variant={tournamentId === "all" ? "filled" : "outlined"}
                label="Tất cả giải"
                onClick={() => setTournamentId("all")}
              />
              {tournaments.map((t) => (
                <Chip
                  key={t._id}
                  variant={tournamentId === t._id ? "filled" : "outlined"}
                  label={t.name}
                  onClick={() => setTournamentId(t._id)}
                />
              ))}
            </Stack>

            <Divider flexItem orientation={isSm ? "horizontal" : "vertical"} />

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {platformsAvailable.map((p) => (
                <Chip
                  key={p}
                  color={platformFilter.includes(p) ? "primary" : "default"}
                  variant={platformFilter.includes(p) ? "filled" : "outlined"}
                  label={PLATFORM_LABEL[p] || p}
                  onClick={() => handleTogglePlatform(p)}
                />
              ))}
            </Stack>
          </Stack>
        </Paper>

        {isLoading ? (
          <Stack alignItems="center" sx={{ py: 6 }}>
            <CircularProgress />
            <Typography sx={{ mt: 1, opacity: 0.7 }}>Đang tải danh sách live...</Typography>
          </Stack>
        ) : isError ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            Không tải được dữ liệu. Vui lòng thử lại.
            <Button onClick={() => refetch()} startIcon={<RefreshIcon />} sx={{ ml: 1 }}>
              Thử lại
            </Button>
          </Alert>
        ) : (
          <Stack spacing={1.25}>
            <Typography variant="body2" sx={{ opacity: 0.7 }}>
              Tổng cộng <strong>{filtered.length}</strong> phiên live đang hoạt động
            </Typography>
            {filtered.length === 0 ? (
              <Paper variant="outlined" sx={{ p: 3, textAlign: "center", borderRadius: 2 }}>
                <Typography>Không có phiên live nào phù hợp bộ lọc.</Typography>
              </Paper>
            ) : (
              filtered.map((s) => <LiveRow key={s.id || s._id} session={s} />)
            )}
          </Stack>
        )}
      </Container>
    </DashboardLayout>
  );
}
