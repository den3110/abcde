import { useDeferredValue, useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import LockOpenRoundedIcon from "@mui/icons-material/LockOpenRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import DeleteSweepRoundedIcon from "@mui/icons-material/DeleteSweepRounded";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import { toast } from "react-toastify";
import {
  useForceFreeCourtStationMutation,
  useForceReleaseCourtStationPresenceMutation,
  useGetCourtFreeManagerQuery,
} from "slices/courtFreeManagerApiSlice";

function sid(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value._id) return String(value._id);
  return String(value);
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

function formatDateTime(value) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "—";
  return parsed.toLocaleString("vi-VN", {
    hour12: false,
  });
}

function tournamentStatusMeta(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "ongoing") return { label: "Đang diễn ra", color: "warning" };
  if (normalized === "finished") return { label: "Đã kết thúc", color: "default" };
  return { label: "Sắp diễn ra", color: "info" };
}

function stationStatusMeta(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "live") return { label: "Đang live", color: "error" };
  if (normalized === "assigned") return { label: "Đã gán", color: "info" };
  if (normalized === "maintenance") return { label: "Bảo trì", color: "warning" };
  return { label: "Rảnh", color: "success" };
}

function buildStationSearchText(tournament, cluster, station) {
  return normalizeText(
    [
      tournament?.name,
      tournament?.code,
      cluster?.name,
      cluster?.venueName,
      station?.name,
      station?.code,
      station?.currentMatch?.displayCode,
      station?.currentMatch?.code,
      station?.currentMatch?.pairA?.name,
      station?.currentMatch?.pairB?.name,
      station?.currentTournament?.name,
      station?.presence?.screenState,
    ].join(" ")
  );
}

function CourtStationCard({ station, onForceFree, onReleasePresence, busy }) {
  const status = stationStatusMeta(station?.status);
  const currentMatch = station?.currentMatch;
  const presence = station?.presence;
  const clusterName = station?.clusterName || "Cụm chưa rõ";

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: 2.5,
        borderLeft: "4px solid",
        borderLeftColor: busy ? "warning.main" : "success.main",
        height: "100%",
      }}
    >
      <Stack direction="row" justifyContent="space-between" spacing={1.5} mb={1.5}>
        <Box>
          <Typography variant="h6" fontWeight={700}>
            {station?.name || "Sân chưa rõ"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {station?.code || "—"} · {clusterName}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent="flex-end">
          <Chip size="small" label={status.label} color={status.color} />
          {station?.management?.hasPresenceLock ? (
            <Chip size="small" color="secondary" label="App đang giữ" />
          ) : null}
          {station?.queueCount ? (
            <Chip size="small" variant="outlined" label={`Queue ${station.queueCount}`} />
          ) : null}
        </Stack>
      </Stack>

      <Stack spacing={1.25}>
        <Box>
          <Typography variant="caption" color="text.secondary" display="block">
            Trận hiện tại
          </Typography>
          {currentMatch ? (
            <>
              <Typography variant="body2" fontWeight={700}>
                {currentMatch?.displayCode || currentMatch?.code || "Trận hiện tại"}
              </Typography>
              <Typography variant="body2">
                {currentMatch?.pairA?.name || "Đội A"} vs {currentMatch?.pairB?.name || "Đội B"}
              </Typography>
            </>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Không có trận đang gán
            </Typography>
          )}
        </Box>

        <Box>
          <Typography variant="caption" color="text.secondary" display="block">
            Giải / Queue tiếp theo
          </Typography>
          <Typography variant="body2">
            {station?.currentTournament?.name || "Không có giải đang chiếm sân"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {station?.nextQueuedMatch
              ? `${station.nextQueuedMatch?.displayCode || station.nextQueuedMatch?.code || "Trận kế"} · ${station.nextQueuedMatch?.pairA?.name || "Đội A"} vs ${station.nextQueuedMatch?.pairB?.name || "Đội B"}`
              : "Không có trận chờ"}
          </Typography>
        </Box>

        <Box>
          <Typography variant="caption" color="text.secondary" display="block">
            Lock app live
          </Typography>
          {presence ? (
            <>
              <Typography variant="body2">
                {presence?.screenState || "active"} · heartbeat {formatDateTime(presence?.lastHeartbeatAt)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Tự nhả lúc {formatDateTime(presence?.previewReleaseAt)}
              </Typography>
            </>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Không có lock app
            </Typography>
          )}
        </Box>
      </Stack>

      <Divider sx={{ my: 2 }} />

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
        <Button
          fullWidth
          variant="contained"
          color="warning"
          startIcon={<DeleteSweepRoundedIcon />}
          onClick={() => onForceFree(station)}
          disabled={!station?.management?.canForceFree}
        >
          Free sân
        </Button>
        <Button
          fullWidth
          variant="outlined"
          color="secondary"
          startIcon={<LockOpenRoundedIcon />}
          onClick={() => onReleasePresence(station)}
          disabled={!station?.management?.canReleasePresence}
        >
          Gỡ lock app
        </Button>
      </Stack>
    </Paper>
  );
}

CourtStationCard.propTypes = {
  station: PropTypes.shape({
    _id: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    name: PropTypes.string,
    code: PropTypes.string,
    status: PropTypes.string,
    clusterName: PropTypes.string,
    queueCount: PropTypes.number,
    currentTournament: PropTypes.shape({
      name: PropTypes.string,
    }),
    currentMatch: PropTypes.shape({
      displayCode: PropTypes.string,
      code: PropTypes.string,
      pairA: PropTypes.shape({
        name: PropTypes.string,
      }),
      pairB: PropTypes.shape({
        name: PropTypes.string,
      }),
    }),
    nextQueuedMatch: PropTypes.shape({
      displayCode: PropTypes.string,
      code: PropTypes.string,
      pairA: PropTypes.shape({
        name: PropTypes.string,
      }),
      pairB: PropTypes.shape({
        name: PropTypes.string,
      }),
    }),
    presence: PropTypes.shape({
      screenState: PropTypes.string,
      lastHeartbeatAt: PropTypes.string,
      previewReleaseAt: PropTypes.string,
      occupied: PropTypes.bool,
    }),
    management: PropTypes.shape({
      hasPresenceLock: PropTypes.bool,
      canForceFree: PropTypes.bool,
      canReleasePresence: PropTypes.bool,
    }),
  }).isRequired,
  onForceFree: PropTypes.func.isRequired,
  onReleasePresence: PropTypes.func.isRequired,
  busy: PropTypes.bool,
};

CourtStationCard.defaultProps = {
  busy: false,
};

function CourtFreeManagerPage() {
  const [includeInactive, setIncludeInactive] = useState(false);
  const [onlyBusy, setOnlyBusy] = useState(false);
  const [onlyLocked, setOnlyLocked] = useState(false);
  const [search, setSearch] = useState("");
  const [actionDialog, setActionDialog] = useState({
    open: false,
    type: "",
    station: null,
  });
  const deferredSearch = useDeferredValue(search);

  const {
    data,
    isFetching,
    isLoading,
    refetch,
  } = useGetCourtFreeManagerQuery(
    { includeInactive },
    {
      pollingInterval: 15000,
      refetchOnFocus: true,
      refetchOnReconnect: true,
    }
  );
  const [forceFreeCourtStation, { isLoading: isForceFreeing }] =
    useForceFreeCourtStationMutation();
  const [forceReleaseCourtStationPresence, { isLoading: isReleasingPresence }] =
    useForceReleaseCourtStationPresenceMutation();

  const items = Array.isArray(data?.items) ? data.items : [];
  const totals = data?.totals || {};

  const filteredTournaments = useMemo(() => {
    const term = normalizeText(deferredSearch);

    return items
      .map((tournament) => {
        const tournamentHit = term
          ? normalizeText(`${tournament?.name} ${tournament?.code} ${tournament?.location}`).includes(term)
          : false;

        const clusters = (Array.isArray(tournament?.clusters) ? tournament.clusters : [])
          .map((cluster) => {
            const clusterHit = term
              ? normalizeText(`${cluster?.name} ${cluster?.venueName}`).includes(term)
              : false;

            const stations = (Array.isArray(cluster?.stations) ? cluster.stations : []).filter((station) => {
              const busy = Boolean(station?.management?.canForceFree);
              const locked = Boolean(station?.management?.hasPresenceLock);
              if (onlyBusy && !busy) return false;
              if (onlyLocked && !locked) return false;
              if (!term) return true;
              if (tournamentHit || clusterHit) return true;
              return buildStationSearchText(tournament, cluster, station).includes(term);
            });

            if (!stations.length && !clusterHit && !tournamentHit) return null;

            const busyCount = stations.filter((station) => station?.management?.canForceFree).length;
            const lockedCount = stations.filter((station) => station?.management?.hasPresenceLock).length;

            return {
              ...cluster,
              stations,
              stationCount: stations.length,
              busyCount,
              lockedCount,
            };
          })
          .filter(Boolean);

        if (!clusters.length && !tournamentHit) return null;

        return {
          ...tournament,
          clusters,
          clusterCount: clusters.length,
          stationCount: clusters.reduce(
            (total, cluster) => total + Number(cluster?.stationCount || 0),
            0
          ),
          busyCount: clusters.reduce(
            (total, cluster) => total + Number(cluster?.busyCount || 0),
            0
          ),
          lockedCount: clusters.reduce(
            (total, cluster) => total + Number(cluster?.lockedCount || 0),
            0
          ),
        };
      })
      .filter(Boolean);
  }, [deferredSearch, items, onlyBusy, onlyLocked]);

  const openActionDialog = (type, station) => {
    setActionDialog({
      open: true,
      type,
      station,
    });
  };

  const closeActionDialog = () => {
    setActionDialog({
      open: false,
      type: "",
      station: null,
    });
  };

  const handleConfirmAction = async () => {
    const stationId = sid(actionDialog?.station?._id);
    if (!stationId) {
      closeActionDialog();
      return;
    }

    try {
      if (actionDialog.type === "force-free") {
        await forceFreeCourtStation(stationId).unwrap();
        toast.success("Đã free sân và gỡ lock app.");
      } else if (actionDialog.type === "release-presence") {
        await forceReleaseCourtStationPresence(stationId).unwrap();
        toast.success("Đã gỡ lock app cho sân.");
      }
      closeActionDialog();
    } catch (error) {
      toast.error(error?.data?.message || error?.message || "Thao tác thất bại.");
    }
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box py={3}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "center" }}
          spacing={2}
          mb={3}
        >
          <Box>
            <Typography variant="h4" fontWeight={700}>
              Quản lý sân rảnh
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Super admin quản lý nhanh trạng thái sân theo giải, free sân và gỡ lock app live.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<RefreshRoundedIcon />}
            onClick={refetch}
            disabled={isFetching}
          >
            Tải lại
          </Button>
        </Stack>

        <Grid container spacing={2} mb={3}>
          <Grid item xs={12} md={3}>
            <Card sx={{ p: 2.5, borderRadius: 3 }}>
              <Typography variant="caption" color="text.secondary">
                Giải có map sân
              </Typography>
              <Typography variant="h4" fontWeight={700}>
                {Number(totals?.tournaments || 0)}
              </Typography>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card sx={{ p: 2.5, borderRadius: 3 }}>
              <Typography variant="caption" color="text.secondary">
                Tổng số sân
              </Typography>
              <Typography variant="h4" fontWeight={700}>
                {Number(totals?.stations || 0)}
              </Typography>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card sx={{ p: 2.5, borderRadius: 3 }}>
              <Typography variant="caption" color="text.secondary">
                Sân đang bận
              </Typography>
              <Typography variant="h4" fontWeight={700} color="warning.main">
                {Number(totals?.busy || 0)}
              </Typography>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card sx={{ p: 2.5, borderRadius: 3 }}>
              <Typography variant="caption" color="text.secondary">
                Sân đang bị giữ
              </Typography>
              <Typography variant="h4" fontWeight={700} color="secondary.main">
                {Number(totals?.locked || 0)}
              </Typography>
            </Card>
          </Grid>
        </Grid>

        <Card sx={{ p: 2.5, borderRadius: 3, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} lg={5}>
              <TextField
                fullWidth
                label="Tìm theo giải / cụm / sân / mã trận"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </Grid>
            <Grid item xs={12} lg={7}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={includeInactive}
                      onChange={(event) => setIncludeInactive(event.target.checked)}
                    />
                  }
                  label="Hiện cả giải đã kết thúc"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={onlyBusy}
                      onChange={(event) => setOnlyBusy(event.target.checked)}
                    />
                  }
                  label="Chỉ sân đang bận"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={onlyLocked}
                      onChange={(event) => setOnlyLocked(event.target.checked)}
                    />
                  }
                  label="Chỉ sân đang bị giữ"
                />
              </Stack>
            </Grid>
          </Grid>
        </Card>

        {isLoading ? (
          <Alert severity="info">Đang tải dữ liệu sân theo giải...</Alert>
        ) : filteredTournaments.length ? (
          <Stack spacing={2}>
            {filteredTournaments.map((tournament) => {
              const status = tournamentStatusMeta(tournament?.status);
              return (
                <Accordion
                  key={sid(tournament?._id)}
                  defaultExpanded={String(tournament?.status || "").trim().toLowerCase() === "ongoing"}
                  disableGutters
                  sx={{
                    borderRadius: 3,
                    overflow: "hidden",
                    "&:before": { display: "none" },
                    border: (theme) => `1px solid ${theme.palette.divider}`,
                  }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      justifyContent="space-between"
                      alignItems={{ xs: "flex-start", md: "center" }}
                      spacing={1.5}
                      width="100%"
                    >
                      <Box>
                        <Typography variant="h5" fontWeight={700}>
                          {tournament?.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {tournament?.code || "—"} · {tournament?.location || "Chưa có địa điểm"}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Chip size="small" color={status.color} label={status.label} />
                        <Chip size="small" variant="outlined" label={`${tournament?.clusterCount || 0} cụm`} />
                        <Chip size="small" variant="outlined" label={`${tournament?.stationCount || 0} sân`} />
                        <Chip size="small" color="warning" variant="outlined" label={`Bận ${tournament?.busyCount || 0}`} />
                        <Chip size="small" color="secondary" variant="outlined" label={`Giữ ${tournament?.lockedCount || 0}`} />
                      </Stack>
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails>
                    {tournament?.clusters?.length ? (
                      <Stack spacing={2.5}>
                        {tournament.clusters.map((cluster) => (
                          <Card
                            key={sid(cluster?._id)}
                            sx={{
                              p: 2.5,
                              borderRadius: 3,
                              borderTop: "4px solid",
                              borderTopColor: cluster?.color || "primary.main",
                            }}
                          >
                            <Stack
                              direction={{ xs: "column", md: "row" }}
                              justifyContent="space-between"
                              alignItems={{ xs: "flex-start", md: "center" }}
                              spacing={1.5}
                              mb={2}
                            >
                              <Box>
                                <Typography variant="h6" fontWeight={700}>
                                  {cluster?.name}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {cluster?.venueName || "Chưa có địa điểm cụm"}
                                </Typography>
                              </Box>
                              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                <Chip size="small" variant="outlined" label={`${cluster?.stationCount || 0} sân`} />
                                <Chip size="small" color="warning" variant="outlined" label={`Bận ${cluster?.busyCount || 0}`} />
                                <Chip size="small" color="secondary" variant="outlined" label={`Giữ ${cluster?.lockedCount || 0}`} />
                                {Number(cluster?.sharedTournamentCount || 1) > 1 ? (
                                  <Chip
                                    size="small"
                                    color="info"
                                    variant="outlined"
                                    label={`Shared ${cluster.sharedTournamentCount} giải`}
                                  />
                                ) : null}
                              </Stack>
                            </Stack>

                            {cluster?.stations?.length ? (
                              <Grid container spacing={2}>
                                {cluster.stations.map((station) => (
                                  <Grid item xs={12} xl={6} key={sid(station?._id)}>
                                    <CourtStationCard
                                      station={station}
                                      busy={Boolean(station?.management?.canForceFree)}
                                      onForceFree={(item) => openActionDialog("force-free", item)}
                                      onReleasePresence={(item) =>
                                        openActionDialog("release-presence", item)
                                      }
                                    />
                                  </Grid>
                                ))}
                              </Grid>
                            ) : (
                              <Alert severity="info">Cụm này hiện chưa có sân nào phù hợp bộ lọc.</Alert>
                            )}
                          </Card>
                        ))}
                      </Stack>
                    ) : (
                      <Alert severity="info">Giải này chưa được map cụm sân nào.</Alert>
                    )}
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </Stack>
        ) : (
          <Alert severity="info">
            Không có sân nào khớp bộ lọc hiện tại.
          </Alert>
        )}
      </Box>

      <Dialog open={actionDialog.open} onClose={closeActionDialog} maxWidth="xs" fullWidth>
        <DialogTitle>
          {actionDialog.type === "force-free" ? "Free sân" : "Gỡ lock app"}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            {actionDialog.type === "force-free"
              ? `Free sân ${actionDialog?.station?.name || ""} sẽ xóa match hiện tại và gỡ lock app nếu có.`
              : `Gỡ lock app của sân ${actionDialog?.station?.name || ""} sẽ chỉ xóa tình trạng thiết bị đang giữ sân.`}
          </Typography>
          {actionDialog?.station?.currentMatch ? (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Trận hiện tại: {actionDialog.station.currentMatch.displayCode || actionDialog.station.currentMatch.code} ·{" "}
              {actionDialog.station.currentMatch.pairA?.name || "Đội A"} vs{" "}
              {actionDialog.station.currentMatch.pairB?.name || "Đội B"}
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={closeActionDialog}>Hủy</Button>
          <Button
            variant="contained"
            color={actionDialog.type === "force-free" ? "warning" : "secondary"}
            startIcon={
              actionDialog.type === "force-free" ? (
                <DeleteSweepRoundedIcon />
              ) : (
                <LockOpenRoundedIcon />
              )
            }
            onClick={handleConfirmAction}
            disabled={isForceFreeing || isReleasingPresence}
          >
            {actionDialog.type === "force-free" ? "Free sân" : "Gỡ lock"}
          </Button>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}

export default CourtFreeManagerPage;
