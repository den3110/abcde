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
  // đổi import nếu hook của bạn ở slice khác
  useGetAdminTournamentsQuery,
  useGetMatchesByTournamentQuery,
} from "../../slices/matchesApiSlice";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

export default function GlobalMatchViewerPage() {
  const [searchParams] = useSearchParams();
  const nav = useNavigate();

  // chọn theo tầng
  const [tour, setTour] = useState(null);
  const [match, setMatch] = useState(null);

  // ====== Tournaments ======
  const {
    data: tournamentsRaw,
    isFetching: loadingTours,
    refetch: refetchTours,
  } = useGetAdminTournamentsQuery();

  // ép về array: ưu tiên res.list, sau đó res.items, sau đó chính res nếu đã transformResponse
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

  // Vẫn giữ hỗ trợ ?id=<matchId> → nhảy thẳng
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
  const tourLabel = (t) => (t ? `${t.name}${t.status ? ` (${t.status})` : ""}` : "");

  const matchLabel = (m) => {
    if (!m) return "";
    const tag = m.labelKey || m.code || m._id?.slice(-6);
    const br = m.bracket?.name ? ` • ${m.bracket.name}` : "";
    const ro = Number.isFinite(m.round)
      ? ` • R${m.round}${Number.isFinite(m.order) ? `#${m.order}` : ""}`
      : "";
    const st = m.status ? ` • ${m.status}` : "";
    return `${tag}${br}${ro}${st}`;
  };

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
              options={tournaments} // ✅ luôn là array
              loading={loadingTours}
              value={tour}
              onChange={(_, v) => {
                setTour(v);
                setMatch(null);
                if (v && tourId && v._id !== tourId) refetchMatches();
              }}
              getOptionLabel={tourLabel}
              isOptionEqualToValue={(o, v) => o?._id === v?._id} // ✅ tránh warning & mismatch ref
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
              renderOption={(props, option) => (
                <li {...props} key={option._id}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2">{option.name}</Typography>
                    {option.status && <Chip size="small" label={option.status} />}
                  </Stack>
                </li>
              )}
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
              options={matches} // ✅ luôn là array
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
              renderOption={(props, option) => (
                <li {...props} key={option._id}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {option.labelKey || option.code || option._id?.slice(-6)}
                    </Typography>
                    {Number.isFinite(option.round) && (
                      <Chip
                        size="small"
                        label={`R${option.round}${
                          Number.isFinite(option.order) ? `#${option.order}` : ""
                        }`}
                      />
                    )}
                    {option.bracket?.name && (
                      <Chip size="small" label={option.bracket.name} variant="outlined" />
                    )}
                    {option.winner && (
                      <Chip size="small" color="success" label={`W: ${option.winner}`} />
                    )}
                  </Stack>
                </li>
              )}
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
