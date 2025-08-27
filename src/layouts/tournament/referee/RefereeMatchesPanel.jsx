import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Pagination,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useGetRefereeTournamentsQuery } from "slices/tournamentsApiSlice";
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
  Stadium as StadiumIcon,
  Info as InfoIcon,
  GridView as PoolIcon,
  ExpandMore as ExpandMoreIcon,
  RestartAlt as RestartAltIcon,
  Close as CloseIcon,
  FilterAlt as FilterAltIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import { useListRefereeMatchesByTournamentQuery } from "slices/tournamentsApiSlice";
import { useGetRefereeBracketsQuery } from "slices/tournamentsApiSlice";
import {
  displayOrder,
  getMatchStatusChip,
  matchCode,
  pairLabel,
  poolNote,
  VI_MATCH_STATUS,
} from "./AdminRefereeConsole";
import PropTypes from "prop-types";

// debounce nho nhỏ cho ô tìm kiếm
function useDebounced(value, delay = 400) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function TournamentAccordion({
  tournament,
  open,
  onToggle,
  status,
  q,
  page,
  onPageChange,
  bracketId,
  onBracketChange,
  pageSize,
  onPickMatch,
  selectedId,
}) {
  // Brackets (load khi mở)
  const { data: brData, isLoading: brLoading } = useGetRefereeBracketsQuery(
    { tournamentId: tournament._id },
    { skip: !open }
  );
  const brackets = brData?.items || [];

  // Matches (load khi mở)
  const queryArgs = useMemo(() => {
    const args = { tournamentId: tournament._id, page, pageSize };
    if (status && status !== "all") args.status = status;
    if (q) args.q = q;
    if (bracketId && bracketId !== "all") args.bracketId = bracketId;
    return args;
  }, [tournament._id, status, q, page, pageSize, bracketId]);

  const {
    data: matchesResp,
    isFetching: listFetching,
    isLoading: listLoading,
    error: listErr,
    refetch: refetchList,
  } = useListRefereeMatchesByTournamentQuery(queryArgs, { skip: !open });
  console.log("list error", listErr);
  const items = matchesResp?.items || [];
  const totalPages = matchesResp?.totalPages || 1;

  return (
    <Accordion expanded={open} onChange={(_, v) => onToggle(v)} disableGutters>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack sx={{ width: "100%" }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Typography fontWeight={700}>{tournament.name}</Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              {typeof tournament?.pendingCount === "number" && tournament.pendingCount > 0 && (
                <Chip size="small" color="warning" label={`Đang chờ: ${tournament.pendingCount}`} />
              )}
              <Tooltip title="Làm mới danh sách trận của giải này">
                <span>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      refetchList();
                    }}
                  >
                    <Refresh fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {tournament.location || ""} •{" "}
            {tournament.startDate ? new Date(tournament.startDate).toLocaleDateString() : ""}{" "}
            {tournament.endDate ? `- ${new Date(tournament.endDate).toLocaleDateString()}` : ""}
          </Typography>
        </Stack>
      </AccordionSummary>

      <AccordionDetails>
        {/* inner filters */}
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }} flexWrap="wrap">
          <TextField
            select
            size="small"
            label="Bracket"
            value={bracketId || "all"}
            onChange={(e) => onBracketChange(e.target.value)}
            sx={{ minWidth: 220 }}
            disabled={brLoading}
          >
            <MenuItem value="all">
              <em>Tất cả bracket</em>
            </MenuItem>
            {brackets.map((b) => (
              <MenuItem key={b._id} value={b._id}>
                {b.name} ({b.type})
              </MenuItem>
            ))}
          </TextField>
          {listFetching && <CircularProgress size={16} />}
        </Stack>

        {listLoading && !items.length ? (
          <Box textAlign="center" py={3}>
            <CircularProgress size={20} />
          </Box>
        ) : listErr ? (
          <Alert severity="error">
            {listErr?.data?.message || listErr?.error || "Lỗi tải danh sách trận"}
          </Alert>
        ) : !items.length ? (
          <Alert severity="info">Không có trận phù hợp với bộ lọc.</Alert>
        ) : (
          <>
            <List dense sx={{ maxHeight: 360, overflowY: "auto" }}>
              {items.map((m) => {
                const chip = getMatchStatusChip(m.status);
                const courtName = m.court?.name || m.courtName || "";
                const evt = (m?.tournament?.eventType || "double").toLowerCase();
                return (
                  <ListItemButton
                    key={m._id}
                    selected={selectedId === m._id}
                    onClick={() => onPickMatch?.(m._id)}
                  >
                    <ListItemText
                      primary={
                        <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                          <Typography variant="body2" fontWeight={700}>
                            {matchCode(m)}
                          </Typography>
                          <Chip size="small" color={chip.color} label={chip.label} />
                          <Typography variant="caption" color="text.secondary">
                            Bracket: {m.bracket?.name} ({m.bracket?.type}) • R{m.round} • #
                            {displayOrder(m)}
                          </Typography>
                          {courtName && (
                            <Chip
                              size="small"
                              icon={<StadiumIcon sx={{ fontSize: 14 }} />}
                              label={courtName}
                              variant="outlined"
                            />
                          )}
                          {poolNote(m) && (
                            <Chip
                              size="small"
                              icon={<PoolIcon sx={{ fontSize: 14 }} />}
                              label={poolNote(m)}
                              color="info"
                              variant="outlined"
                            />
                          )}
                        </Stack>
                      }
                      secondary={
                        <Typography variant="caption">
                          {pairLabel(m.pairA, evt)} <b style={{ opacity: 0.6 }}>vs</b>{" "}
                          {pairLabel(m.pairB, evt)}
                        </Typography>
                      }
                    />
                  </ListItemButton>
                );
              })}
            </List>
            <Box display="flex" justifyContent="center" py={1}>
              <Pagination
                size="small"
                color="primary"
                count={totalPages}
                page={page}
                onChange={(_, p) => onPageChange(p)}
              />
            </Box>
          </>
        )}
      </AccordionDetails>
    </Accordion>
  );
}

function RefereeMatchesPanel({ selectedId, onPickMatch }) {
  // Global filters
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const q = useDebounced(query, 400);

  // Multi-select tournament to show
  const [selectedTourneys, setSelectedTourneys] = useState([]);

  // Per-tournament UI state
  const [openAcc, setOpenAcc] = useState({}); // { [tid]: boolean }
  const [pageMap, setPageMap] = useState({}); // { [tid]: number }
  const [bracketMap, setBracketMap] = useState({}); // { [tid]: "all" | bracketId }
  const pageSize = 10;

  // Load tournaments for this referee
  const {
    data: tourneysData,
    isLoading: loadingTours,
    error: toursErr,
    refetch: refetchTours,
  } = useGetRefereeTournamentsQuery();

  const tourneys = useMemo(() => tourneysData?.items || [], [tourneysData]);

  const listToRender = useMemo(() => {
    if (!selectedTourneys.length) return tourneys;
    const set = new Set(selectedTourneys.map((t) => t._id));
    return tourneys.filter((t) => set.has(t._id));
  }, [tourneys, selectedTourneys]);

  const toggleAccordion = (tid, next) =>
    setOpenAcc((m) => ({ ...m, [tid]: typeof next === "boolean" ? next : !m[tid] }));
  const setPage = (tid, p) => setPageMap((m) => ({ ...m, [tid]: p }));
  const setBracket = (tid, bid) => setBracketMap((m) => ({ ...m, [tid]: bid || "all" }));

  return (
    <Card sx={{ p: 1, minHeight: 500 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" px={1}>
        <Typography variant="h6">Danh sách trận (Trọng tài)</Typography>
        <IconButton onClick={() => refetchTours()} size="small" title="Làm mới danh sách giải">
          <Refresh fontSize="small" />
        </IconButton>
      </Stack>
      <Divider sx={{ my: 1 }} />

      {/* Filter bar */}
      <Stack spacing={1} sx={{ p: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <FilterAltIcon fontSize="small" />
          <Typography fontWeight={700}>Bộ lọc</Typography>
        </Stack>

        <Stack
          direction={{ xs: "column", sm: "column" }}
          spacing={1.5}
          alignItems="stretch"
          flexWrap="wrap"
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: 2,
              bgcolor: "background.paper",
              boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
            },
          }}
        >
          {/* Giải (multi) */}
          <Autocomplete
            multiple
            size="small"
            options={tourneys}
            disableCloseOnSelect
            value={selectedTourneys}
            onChange={(_, v) => setSelectedTourneys(v)}
            getOptionLabel={(o) => o?.name || ""}
            sx={{ minWidth: 280, flex: 1.2 }}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  {...getTagProps({ index })}
                  key={option._id}
                  label={option.name}
                  size="small"
                  variant="outlined"
                  sx={{ borderRadius: 2 }}
                />
              ))
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Giải (chọn để hiển thị)"
                placeholder={params.inputProps?.value ? "" : "Chọn 1 hoặc nhiều giải"}
                inputProps={{
                  ...params.inputProps,
                  "data-hotkeys-ignore": "true", // 👈 thêm dòng này
                }}
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <>
                      <InputAdornment position="start">
                        <FilterAltIcon fontSize="small" />
                      </InputAdornment>
                      {params.InputProps.startAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
          <div style={{ marginTop: 10, marginBottom: 10 }}></div>
          {/* Trạng thái */}
          <TextField
            select
            size="small"
            label="Trạng thái"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            sx={{ width: { xs: "100%", sm: 210 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <FilterAltIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            SelectProps={{
              renderValue: (val) => (
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Chip
                    size="small"
                    label={getMatchStatusChip(val).label}
                    color={getMatchStatusChip(val).color}
                    variant="outlined"
                    sx={{ borderRadius: 2 }}
                  />
                </Stack>
              ),
              MenuProps: { PaperProps: { sx: { borderRadius: 2 } } },
            }}
          >
            {Object.keys(VI_MATCH_STATUS).map((s) => (
              <MenuItem key={s} value={s}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Chip
                    size="small"
                    label={getMatchStatusChip(s).label}
                    color={getMatchStatusChip(s).color}
                  />
                </Stack>
              </MenuItem>
            ))}
          </TextField>

          {/* Tìm kiếm mã trận / tên */}
          <TextField
            size="small"
            label="Tìm theo mã trận / tên (biệt danh)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            sx={{ flex: 1.2, minWidth: 260 }}
            inputProps={{ "data-hotkeys-ignore": "true" }} // 👈 thêm dòng này
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: query ? (
                <InputAdornment position="end">
                  <IconButton size="small" edge="end" onClick={() => setQuery("")}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
            placeholder="VD: R3#12, G-A#5, 'Nam Anh', 'Lan'"
          />

          {/* Reset */}
          <Button
            variant="outlined"
            color="inherit"
            onClick={() => {
              setStatus("all");
              setQuery("");
              setSelectedTourneys([]);
            }}
            startIcon={<RestartAltIcon />}
            sx={{
              borderRadius: 2,
              borderStyle: "dashed",
              px: 1.6,
              alignSelf: { xs: "stretch", sm: "center" },
            }}
          >
            Reset
          </Button>
        </Stack>
      </Stack>

      <Divider sx={{ my: 1 }} />

      {/* Accordions */}
      {loadingTours ? (
        <Box textAlign="center" py={4}>
          <CircularProgress size={20} />
        </Box>
      ) : toursErr ? (
        <Alert severity="error">
          {toursErr?.data?.message || toursErr?.error || "Lỗi tải danh sách giải"}
        </Alert>
      ) : !tourneys.length ? (
        <Alert severity="info" sx={{ m: 1 }}>
          Bạn chưa được phân công ở giải nào.
        </Alert>
      ) : (
        <Box sx={{ maxHeight: "calc(100vh - 240px)", overflowY: "auto", pr: 0.5 }}>
          {listToRender.map((t) => (
            <TournamentAccordion
              key={t._id}
              tournament={t}
              open={!!openAcc[t._id]}
              onToggle={(v) => toggleAccordion(t._id, v)}
              status={status}
              q={q}
              page={pageMap[t._id] || 1}
              onPageChange={(p) => setPage(t._id, p)}
              bracketId={bracketMap[t._id] || "all"}
              onBracketChange={(bid) => setBracket(t._id, bid)}
              pageSize={pageSize}
              onPickMatch={onPickMatch}
              selectedId={selectedId}
            />
          ))}
        </Box>
      )}
    </Card>
  );
}

export default RefereeMatchesPanel;

RefereeMatchesPanel.propTypes = {
  selectedId: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  onPickMatch: PropTypes.func, // gọi khi chọn 1 match
};

RefereeMatchesPanel.defaultProps = {
  selectedId: null,
  onPickMatch: undefined,
};

TournamentAccordion.propTypes = {
  tournament: PropTypes.shape({
    _id: PropTypes.oneOfType([PropTypes.string, PropTypes.object]).isRequired,
    name: PropTypes.string.isRequired,
    location: PropTypes.string,
    startDate: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
    endDate: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
    pendingCount: PropTypes.number,
  }).isRequired,

  open: PropTypes.bool, // accordion mở/đóng
  onToggle: PropTypes.func.isRequired, // (bool) => void

  status: PropTypes.oneOf(["all", "scheduled", "queued", "assigned", "live", "finished"]),
  q: PropTypes.string,

  page: PropTypes.number,
  onPageChange: PropTypes.func.isRequired,

  bracketId: PropTypes.string, // "all" | bracketId
  onBracketChange: PropTypes.func.isRequired,

  pageSize: PropTypes.number,

  onPickMatch: PropTypes.func, // (matchId) => void
  selectedId: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
};

TournamentAccordion.defaultProps = {
  open: false,
  status: "all",
  q: "",
  page: 1,
  pageSize: 10,
  bracketId: "all",
  onPickMatch: undefined,
  selectedId: null,
};
