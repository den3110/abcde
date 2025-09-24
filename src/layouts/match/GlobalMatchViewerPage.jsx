// src/layouts/match/GlobalMatchViewerPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link as RouterLink } from "react-router-dom";
import {
  Box,
  Paper,
  Stack,
  Typography,
  TextField,
  Button,
  Divider,
  Alert,
  Link,
  Autocomplete,
  Chip,
  CircularProgress,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SportsTennisIcon from "@mui/icons-material/SportsTennis";
import ReplayIcon from "@mui/icons-material/Replay";
import TournamentIcon from "@mui/icons-material/EmojiEvents";
import MatchIcon from "@mui/icons-material/Sports";

import {
  useGetAdminTournamentsQuery,
  useGetMatchesByTournamentQuery,
} from "../../slices/matchesApiSlice";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

// ===== Helpers: Chuẩn hoá & dịch status giải đấu + màu Chip =====
const canonTournamentStatus = (raw) => {
  const s = String(raw || "")
    .trim()
    .toLowerCase();
  if (
    [
      "upcoming",
      "planned",
      "scheduled",
      "pending",
      "not_started",
      "future",
      "registration_open",
    ].includes(s)
  )
    return "upcoming";
  if (["live", "ongoing", "in_progress", "running"].includes(s)) return "live";
  if (["finished", "completed", "done", "closed", "ended"].includes(s)) return "finished";
  if (["draft"].includes(s)) return "draft";
  if (["paused"].includes(s)) return "paused";
  if (["cancelled", "canceled"].includes(s)) return "cancelled";
  return s || "unknown";
};
const vnTournamentStatus = (raw) => {
  switch (canonTournamentStatus(raw)) {
    case "upcoming":
      return "Sắp diễn ra";
    case "live":
      return "Đang diễn ra";
    case "finished":
      return "Đã diễn ra";
    case "draft":
      return "Nháp";
    case "paused":
      return "Tạm dừng";
    case "cancelled":
      return "Đã huỷ";
    default:
      return "Khác";
  }
};
const chipColorForTour = (raw) => {
  switch (canonTournamentStatus(raw)) {
    case "upcoming":
      return "info";
    case "live":
      return "warning";
    case "finished":
      return "success";
    case "cancelled":
      return "error";
    case "paused":
      return "secondary";
    default:
      return "default";
  }
};

/* ===== NEW: helpers V-round & code ===== */
const isNum = (x) => typeof x === "number" && isFinite(x);

// Lấy V-round (ưu tiên globalRound; fallback parse code/labelKey; cuối cùng rrRound/round)
const vRoundOf = (m) => {
  if (!m) return null;
  const gr = Number(m.globalRound);
  if (Number.isFinite(gr) && gr > 0) return gr;

  const fromStr = (s) => {
    if (!s) return null;
    const mv = /V(\d+)/i.exec(s);
    if (mv) return Number(mv[1]);
    const mr = /R(\d+)/i.exec(s);
    if (mr) return Number(mr[1]); // convert R -> V
    return null;
  };
  const fromCode = fromStr(m.code) ?? fromStr(m.labelKey);
  if (Number.isFinite(fromCode)) return fromCode;

  if (isNum(m.rrRound)) return m.rrRound;
  if (isNum(m.round)) return m.round;
  if (typeof m.round === "string") {
    const mm = /(\d+)/.exec(m.round);
    if (mm) return Number(mm[1]);
  }
  return null;
};

// T-index = order + 1 nếu có
const tIndexOf = (m) => (isNum(m?.order) ? m.order + 1 : null);

// Mã trận: ưu tiên BE chuẩn hoá, nếu không có tự tạo fallback "V{n}-T{t}"
const codeOf = (m) => {
  if (!m) return "";
  if (m.globalCode) return m.globalCode;
  if (m.code) return m.code;
  if (m.labelKey) return m.labelKey;
  const vr = vRoundOf(m);
  const t = tIndexOf(m);
  if (vr) return `V${vr}${t ? `-T${t}` : ""}`;
  return m._id?.slice(-6) || "";
};

// Nhãn hiển thị một dòng trong combobox
const matchLabel = (m) => {
  if (!m) return "";
  const base = codeOf(m);
  const bName = m.bracket?.name ? ` • ${m.bracket.name}` : "";
  const vr = vRoundOf(m);
  const t = tIndexOf(m);
  const ro = vr ? ` • V${vr}${t ? `-T${t}` : ""}` : "";
  const st = m.status ? ` • ${m.status}` : "";
  return `${base}${bName}${ro}${st}`;
};

export default function GlobalMatchViewerPage() {
  const [searchParams] = useSearchParams();
  const nav = useNavigate();

  const [tour, setTour] = useState(null);
  const [match, setMatch] = useState(null);

  // ====== Tournaments ======
  const {
    data: tournamentsRaw,
    isFetching: loadingTours,
    refetch: refetchTours,
  } = useGetAdminTournamentsQuery();

  const tournaments = useMemo(() => {
    if (Array.isArray(tournamentsRaw)) return tournamentsRaw;
    if (Array.isArray(tournamentsRaw?.list)) return tournamentsRaw.list;
    if (Array.isArray(tournamentsRaw?.items)) return tournamentsRaw.items;
    return [];
  }, [tournamentsRaw]);

  // Preselect từ ?tid
  useEffect(() => {
    const tid = searchParams.get("tid");
    if (tid && tournaments.length) {
      const found = tournaments.find((t) => t._id === tid);
      if (found) setTour(found);
    }
  }, [searchParams, tournaments]);

  // ====== Matches theo tournament ======
  const tourId = tour?._id || null;
  const {
    data: matchesRaw,
    isFetching: loadingMatches,
    refetch: refetchMatches,
  } = useGetMatchesByTournamentQuery(tourId, { skip: !tourId });

  const matches = useMemo(() => {
    if (Array.isArray(matchesRaw)) return matchesRaw;
    if (Array.isArray(matchesRaw?.list)) return matchesRaw.list;
    if (Array.isArray(matchesRaw?.items)) return matchesRaw.items;
    return [];
  }, [matchesRaw]);

  // Preselect match từ ?mid
  useEffect(() => {
    const mid = searchParams.get("mid");
    if (mid && matches.length) {
      const found = matches.find((m) => m._id === mid);
      if (found) setMatch(found);
    }
  }, [searchParams, matches]);

  // Hỗ trợ ?id=<matchId> → nhảy thẳng
  useEffect(() => {
    const qid = searchParams.get("id");
    if (qid && /^[a-f\d]{24}$/i.test(qid)) {
      nav(`/admin/matches/${qid}`, { replace: true });
    }
  }, [searchParams, nav]);

  const canOpen = Boolean(match?._id);

  const go = () => {
    if (!canOpen) return;
    nav(`/admin/matches/${match._id}`);
  };

  // Helpers hiển thị
  const tourLabel = (t) =>
    t ? `${t.name}${t.status ? ` (${vnTournamentStatus(t.status)})` : ""}` : "";

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box sx={{ p: 2, mx: "auto" }}>
        <Paper sx={{ p: 3 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <SportsTennisIcon />
            <Typography variant="h5">Xem chi tiết trận (Global)</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Chọn <b>Giải đấu</b> rồi chọn <b>Trận đấu</b> để mở trang chi tiết. Bạn cũng có thể vào{" "}
            <Link component={RouterLink} to="/admin/matches">
              danh sách trận
            </Link>{" "}
            để duyệt.
          </Typography>

          {/* Hàng chọn giải & refresh */}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 1 }}>
            <Autocomplete
              fullWidth
              disablePortal
              options={tournaments}
              loading={loadingTours}
              value={tour}
              onChange={(_, v) => {
                setTour(v);
                setMatch(null);
                if (v && tourId && v._id !== tourId) refetchMatches();
              }}
              getOptionLabel={tourLabel}
              isOptionEqualToValue={(o, v) => o?._id === v?._id}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Chọn giải đấu"
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <>
                        <TournamentIcon sx={{ mr: 1, opacity: 0.7 }} />
                        {params.InputProps.startAdornment}
                      </>
                    ),
                    endAdornment: (
                      <>
                        {loadingTours ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              renderOption={(props, option) => {
                const color = chipColorForTour(option.status);
                const labelVi = vnTournamentStatus(option.status);
                return (
                  <li {...props} key={option._id}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2">{option.name}</Typography>
                      {option.status && <Chip size="small" color={color} label={labelVi} />}
                    </Stack>
                  </li>
                );
              }}
            />
            <Button onClick={() => refetchTours()} startIcon={<ReplayIcon />} variant="outlined">
              Refresh
            </Button>
          </Stack>

          {/* Hàng chọn trận của giải */}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Autocomplete
              fullWidth
              disablePortal
              options={matches}
              loading={loadingMatches && !!tourId}
              value={match}
              onChange={(_, v) => setMatch(v)}
              getOptionLabel={matchLabel}
              isOptionEqualToValue={(o, v) => o?._id === v?._id}
              groupBy={(m) => (m?.status || "other").toUpperCase()}
              disabled={!tourId}
              noOptionsText={tourId ? "Không có trận" : "Chọn giải trước"}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={tourId ? "Chọn trận đấu" : "Chọn giải trước"}
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <>
                        <MatchIcon sx={{ mr: 1, opacity: 0.7 }} />
                        {params.InputProps.startAdornment}
                      </>
                    ),
                    endAdornment: (
                      <>
                        {loadingMatches ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              renderOption={(props, option) => {
                const code = codeOf(option);
                const vr = vRoundOf(option);
                const t = tIndexOf(option);
                return (
                  <li {...props} key={option._id}>
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      sx={{ flexWrap: "wrap" }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {code}
                      </Typography>
                      {Number.isFinite(vr) && <Chip size="small" label={`V${vr}`} />}
                      {Number.isFinite(t) && <Chip size="small" label={`T${t}`} />}
                      {option.bracket?.name && (
                        <Chip size="small" label={option.bracket.name} variant="outlined" />
                      )}
                      {option.winner && (
                        <Chip size="small" color="success" label={`W: ${option.winner}`} />
                      )}
                    </Stack>
                  </li>
                );
              }}
            />
            <Button
              variant="contained"
              startIcon={<OpenInNewIcon />}
              onClick={go}
              disabled={!canOpen}
              sx={{ minWidth: 140 }}
            >
              Mở trận
            </Button>
          </Stack>

          {!tourId && !match && (
            <>
              <Divider sx={{ my: 3 }} />
              <Alert severity="info">
                Có thể truyền <code>?tid=&lt;tournamentId&gt;</code> (và{" "}
                <code>?mid=&lt;matchId&gt;</code>) để preselect nhanh.
              </Alert>
            </>
          )}
        </Paper>
      </Box>
    </DashboardLayout>
  );
}
