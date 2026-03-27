import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DragIndicatorRoundedIcon from "@mui/icons-material/DragIndicatorRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import { closestCenter, DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import PropTypes from "prop-types";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import { useSocket } from "context/SocketContext";
import { toast } from "react-toastify";
import {
  useAssignMatchToCourtStationMutation,
  useCreateCourtClusterMutation,
  useCreateCourtStationMutation,
  useDeleteCourtClusterMutation,
  useDeleteCourtStationMutation,
  useFreeCourtStationMutation,
  useGetCourtClusterRuntimeQuery,
  useListCourtClustersQuery,
  useUpdateCourtClusterMutation,
  useUpdateCourtStationMutation,
} from "slices/courtClustersApiSlice";

const EMPTY_CLUSTER = {
  name: "",
  venueName: "",
  description: "",
  notes: "",
  isActive: true,
};

const EMPTY_STATION = {
  name: "",
  status: "idle",
  isActive: true,
};

const STATION_STATUS_OPTIONS = [
  { value: "idle", label: "Sẵn sàng", color: "success" },
  { value: "assigned", label: "Đã gán trận", color: "info" },
  { value: "live", label: "Đang live", color: "error" },
  { value: "maintenance", label: "Bảo trì", color: "warning" },
];

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
    .replace(/Đ/g, "D");
}

function buildStationCodePreview(name) {
  const base = normalizeText(name)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return base || "SAN";
}

function teamLine(match) {
  return `${match?.pairA?.name || "Đội A"} vs ${match?.pairB?.name || "Đội B"}`;
}

function getStationStatusMeta(status) {
  return STATION_STATUS_OPTIONS.find((item) => item.value === status) || STATION_STATUS_OPTIONS[0];
}

function buildStationDraft(station) {
  return {
    name: station?.name || "",
    status: station?.status || "idle",
    isActive: station?.isActive !== false,
  };
}

function buildMatchOptionLabel(match) {
  const code = match?.displayCode || match?.code || "Trận";
  const tournament = match?.tournament?.name ? ` · ${match.tournament.name}` : "";
  return `${code} · ${teamLine(match)}${tournament}`;
}

function SortableItem({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  return (
    <Box
      ref={setNodeRef}
      sx={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.7 : 1,
      }}
    >
      {children({ attributes, listeners, isDragging })}
    </Box>
  );
}

SortableItem.propTypes = {
  id: PropTypes.string.isRequired,
  children: PropTypes.func.isRequired,
};

function AdminCourtClustersPage() {
  const socket = useSocket();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [socketConnected, setSocketConnected] = useState(Boolean(socket?.connected));
  const [selectedClusterId, setSelectedClusterId] = useState("");
  const [newCluster, setNewCluster] = useState(EMPTY_CLUSTER);
  const [clusterForm, setClusterForm] = useState(EMPTY_CLUSTER);
  const [newStation, setNewStation] = useState(EMPTY_STATION);
  const [orderedClusters, setOrderedClusters] = useState([]);
  const [orderedStations, setOrderedStations] = useState([]);
  const [stationDrafts, setStationDrafts] = useState({});
  const [stationSelections, setStationSelections] = useState({});
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: "",
    description: "",
    confirmText: "Xác nhận",
    confirmColor: "error",
    onConfirm: null,
  });

  const {
    data: clusters = [],
    isFetching: isClustersFetching,
    refetch: refetchClusters,
  } = useListCourtClustersQuery();
  const {
    data: runtime,
    isFetching: isRuntimeFetching,
    refetch: refetchRuntime,
  } = useGetCourtClusterRuntimeQuery(selectedClusterId, { skip: !selectedClusterId });

  const [createCourtCluster, { isLoading: isCreatingCluster }] = useCreateCourtClusterMutation();
  const [updateCourtCluster, { isLoading: isUpdatingCluster }] = useUpdateCourtClusterMutation();
  const [deleteCourtCluster, { isLoading: isDeletingCluster }] = useDeleteCourtClusterMutation();
  const [createCourtStation, { isLoading: isCreatingStation }] = useCreateCourtStationMutation();
  const [updateCourtStation, { isLoading: isUpdatingStation }] = useUpdateCourtStationMutation();
  const [deleteCourtStation, { isLoading: isDeletingStation }] = useDeleteCourtStationMutation();
  const [assignMatchToCourtStation, { isLoading: isAssigningStation }] =
    useAssignMatchToCourtStationMutation();
  const [freeCourtStation, { isLoading: isFreeingStation }] = useFreeCourtStationMutation();

  const selectedCluster = useMemo(
    () =>
      runtime?.cluster ||
      orderedClusters.find((item) => sid(item?._id) === sid(selectedClusterId)) ||
      null,
    [orderedClusters, runtime?.cluster, selectedClusterId]
  );
  const stations = useMemo(() => orderedStations, [orderedStations]);
  const allowedTournaments = useMemo(
    () => runtime?.allowedTournaments || [],
    [runtime?.allowedTournaments]
  );
  const availableMatches = useMemo(
    () => runtime?.availableMatches || [],
    [runtime?.availableMatches]
  );
  const newStationCodePreview = useMemo(
    () => buildStationCodePreview(newStation.name),
    [newStation.name]
  );

  useEffect(() => {
    setOrderedClusters(clusters);
  }, [clusters]);

  useEffect(() => {
    setOrderedStations(runtime?.stations || []);
  }, [runtime?.stations]);

  useEffect(() => {
    if (!clusters.length) {
      setSelectedClusterId("");
      return;
    }
    if (!selectedClusterId || !clusters.some((item) => sid(item?._id) === sid(selectedClusterId))) {
      setSelectedClusterId(sid(clusters[0]?._id));
    }
  }, [clusters, selectedClusterId]);

  useEffect(() => {
    if (!selectedCluster) {
      setClusterForm(EMPTY_CLUSTER);
      return;
    }
    setClusterForm({
      name: selectedCluster?.name || "",
      venueName: selectedCluster?.venueName || "",
      description: selectedCluster?.description || "",
      notes: selectedCluster?.notes || "",
      isActive: selectedCluster?.isActive !== false,
    });
  }, [selectedCluster]);

  useEffect(() => {
    const nextDrafts = {};
    const nextSelections = {};
    stations.forEach((station) => {
      nextDrafts[sid(station?._id)] = buildStationDraft(station);
      nextSelections[sid(station?._id)] = station?.currentMatch || null;
    });
    setStationDrafts(nextDrafts);
    setStationSelections(nextSelections);
  }, [stations]);

  useEffect(() => {
    if (!socket || !selectedClusterId) return undefined;

    const handleConnect = () => setSocketConnected(true);
    const handleDisconnect = () => setSocketConnected(false);
    const handleClusterUpdate = (payload) => {
      if (sid(payload?.clusterId) === sid(selectedClusterId)) refetchRuntime();
      refetchClusters();
    };
    const handleStationUpdate = (payload) => {
      if (sid(payload?.clusterId) === sid(selectedClusterId)) refetchRuntime();
    };

    setSocketConnected(Boolean(socket.connected));
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.emit("court-cluster:watch", { clusterId: selectedClusterId });
    socket.on("court-cluster:update", handleClusterUpdate);
    socket.on("court-station:update", handleStationUpdate);

    return () => {
      socket.emit("court-cluster:unwatch", { clusterId: selectedClusterId });
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("court-cluster:update", handleClusterUpdate);
      socket.off("court-station:update", handleStationUpdate);
    };
  }, [refetchClusters, refetchRuntime, selectedClusterId, socket]);

  const refreshAll = async () => {
    await Promise.allSettled([
      refetchClusters(),
      selectedClusterId ? refetchRuntime() : Promise.resolve(),
    ]);
    toast.info("Đã tải lại dữ liệu cụm sân.");
  };

  const openConfirmDialog = ({ title, description, confirmText = "Xác nhận", onConfirm }) => {
    setConfirmDialog({
      open: true,
      title,
      description,
      confirmText,
      confirmColor: "error",
      onConfirm,
    });
  };

  const closeConfirmDialog = () => {
    setConfirmDialog({
      open: false,
      title: "",
      description: "",
      confirmText: "Xác nhận",
      confirmColor: "error",
      onConfirm: null,
    });
  };

  const confirmDangerDialog = async () => {
    if (typeof confirmDialog.onConfirm !== "function") {
      closeConfirmDialog();
      return;
    }
    try {
      await confirmDialog.onConfirm();
      closeConfirmDialog();
    } catch (error) {
      toast.error(error?.data?.message || error?.message || "Thao tác thất bại.");
    }
  };

  const handleClusterSortEnd = async ({ active, over }) => {
    if (!active?.id || !over?.id || sid(active.id) === sid(over.id)) return;
    const oldIndex = orderedClusters.findIndex((item) => sid(item?._id) === sid(active.id));
    const newIndex = orderedClusters.findIndex((item) => sid(item?._id) === sid(over.id));
    const previous = orderedClusters;
    const reordered = arrayMove(orderedClusters, oldIndex, newIndex);
    setOrderedClusters(reordered);
    try {
      for (const [index, cluster] of reordered.entries()) {
        if (Number(cluster?.order || 0) === index + 1) continue;
        await updateCourtCluster({
          id: sid(cluster?._id),
          body: {
            name: cluster?.name || "",
            venueName: cluster?.venueName || "",
            description: cluster?.description || "",
            notes: cluster?.notes || "",
            order: index + 1,
            isActive: cluster?.isActive !== false,
          },
        }).unwrap();
      }
    } catch (error) {
      setOrderedClusters(previous);
      toast.error(error?.data?.message || error?.message || "Sắp xếp cụm sân thất bại.");
    }
  };

  const handleStationSortEnd = async ({ active, over }) => {
    if (!active?.id || !over?.id || sid(active.id) === sid(over.id) || !selectedClusterId) return;
    const oldIndex = orderedStations.findIndex((item) => sid(item?._id) === sid(active.id));
    const newIndex = orderedStations.findIndex((item) => sid(item?._id) === sid(over.id));
    const previous = orderedStations;
    const reordered = arrayMove(orderedStations, oldIndex, newIndex);
    setOrderedStations(reordered);
    try {
      for (const [index, station] of reordered.entries()) {
        if (Number(station?.order || 0) === index + 1) continue;
        await updateCourtStation({
          clusterId: selectedClusterId,
          stationId: sid(station?._id),
          body: { order: index + 1 },
        }).unwrap();
      }
    } catch (error) {
      setOrderedStations(previous);
      toast.error(error?.data?.message || error?.message || "Sắp xếp sân thất bại.");
    }
  };

  const handleCreateCluster = async () => {
    if (!newCluster.name.trim()) {
      toast.error("Tên cụm không được để trống.");
      return;
    }
    try {
      const created = await createCourtCluster({
        name: newCluster.name.trim(),
        venueName: newCluster.venueName.trim(),
        description: newCluster.description.trim(),
        notes: newCluster.notes.trim(),
        order: clusters.length + 1,
        isActive: newCluster.isActive,
      }).unwrap();
      setNewCluster(EMPTY_CLUSTER);
      setSelectedClusterId(sid(created?._id));
      toast.success("Đã tạo cụm sân.");
    } catch (error) {
      toast.error(error?.data?.message || error?.message || "Tạo cụm sân thất bại.");
    }
  };

  const handleSaveCluster = async () => {
    if (!selectedClusterId || !clusterForm.name.trim()) {
      toast.error("Tên cụm không được để trống.");
      return;
    }
    try {
      await updateCourtCluster({
        id: selectedClusterId,
        body: {
          name: clusterForm.name.trim(),
          venueName: clusterForm.venueName.trim(),
          description: clusterForm.description.trim(),
          notes: clusterForm.notes.trim(),
          isActive: clusterForm.isActive,
        },
      }).unwrap();
      toast.success("Đã lưu thông tin cụm sân.");
    } catch (error) {
      toast.error(error?.data?.message || error?.message || "Lưu cụm sân thất bại.");
    }
  };

  const handleDeleteCluster = async () => {
    if (!selectedClusterId) return;
    openConfirmDialog({
      title: "Xóa cụm sân",
      description: "Bạn có chắc muốn xóa cụm sân này không?",
      confirmText: "Xóa cụm",
      onConfirm: async () => {
        await deleteCourtCluster(selectedClusterId).unwrap();
        toast.success("Đã xóa cụm sân.");
        setSelectedClusterId("");
      },
    });
  };

  const createNewStation = async () => {
    if (!selectedClusterId || !newStation.name.trim()) {
      toast.error("Tên sân không được để trống.");
      return;
    }
    try {
      await createCourtStation({
        clusterId: selectedClusterId,
        body: {
          name: newStation.name.trim(),
          order: stations.length + 1,
          status: newStation.status,
          isActive: newStation.isActive,
        },
      }).unwrap();
      setNewStation(EMPTY_STATION);
      toast.success("Đã thêm sân vật lý.");
    } catch (error) {
      toast.error(error?.data?.message || error?.message || "Thêm sân thất bại.");
    }
  };

  const saveStation = async (station) => {
    const stationId = sid(station?._id);
    const draft = stationDrafts[stationId];
    if (!draft?.name?.trim()) {
      toast.error("Tên sân không được để trống.");
      return;
    }
    try {
      await updateCourtStation({
        clusterId: selectedClusterId,
        stationId,
        body: {
          name: draft.name.trim(),
          status: draft.status,
          isActive: draft.isActive,
        },
      }).unwrap();
      toast.success("Đã lưu thông tin sân.");
    } catch (error) {
      toast.error(error?.data?.message || error?.message || "Lưu sân thất bại.");
    }
  };

  const removeStation = async (stationId) => {
    openConfirmDialog({
      title: "Xóa sân vật lý",
      description: "Bạn có chắc muốn xóa sân vật lý này không?",
      confirmText: "Xóa sân",
      onConfirm: async () => {
        await deleteCourtStation({ clusterId: selectedClusterId, stationId }).unwrap();
        toast.success("Đã xóa sân vật lý.");
      },
    });
  };

  const assignToStation = async (stationId) => {
    const selectedMatch = stationSelections[stationId];
    if (!selectedMatch?._id) {
      toast.error("Hãy chọn trận trước khi gán.");
      return;
    }
    try {
      await assignMatchToCourtStation({
        stationId,
        matchId: selectedMatch._id,
      }).unwrap();
      toast.success("Đã gán trận cho sân.");
    } catch (error) {
      toast.error(error?.data?.message || error?.message || "Gán trận thất bại.");
    }
  };

  const clearStation = async (stationId) => {
    try {
      await freeCourtStation(stationId).unwrap();
      toast.success("Đã giải phóng sân.");
    } catch (error) {
      toast.error(error?.data?.message || error?.message || "Giải phóng sân thất bại.");
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
              Cụm sân live
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Quản lý cụm sân dùng chung nhiều giải và sắp xếp bằng kéo thả.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Chip
              size="small"
              color={socketConnected ? "success" : "default"}
              label={socketConnected ? "Socket đang kết nối" : "Socket chưa kết nối"}
            />
            <Button
              variant="outlined"
              startIcon={<RefreshRoundedIcon />}
              onClick={refreshAll}
              disabled={isClustersFetching || isRuntimeFetching}
            >
              Tải lại
            </Button>
          </Stack>
        </Stack>

        <Grid container spacing={3}>
          <Grid item xs={12} lg={4}>
            <Stack spacing={3}>
              <Card sx={{ p: 3, borderRadius: 3 }}>
                <Typography variant="h6" fontWeight={700} mb={2}>
                  Tạo cụm sân mới
                </Typography>
                <Stack spacing={2}>
                  <TextField
                    label="Tên cụm"
                    value={newCluster.name}
                    onChange={(e) => setNewCluster((prev) => ({ ...prev, name: e.target.value }))}
                    fullWidth
                  />
                  <TextField
                    label="Địa điểm"
                    value={newCluster.venueName}
                    onChange={(e) =>
                      setNewCluster((prev) => ({ ...prev, venueName: e.target.value }))
                    }
                    fullWidth
                  />
                  <Alert severity="info">Thứ tự cụm được sắp bằng kéo thả trong danh sách.</Alert>
                  <TextField
                    label="Mô tả"
                    value={newCluster.description}
                    onChange={(e) =>
                      setNewCluster((prev) => ({ ...prev, description: e.target.value }))
                    }
                    multiline
                    minRows={2}
                    fullWidth
                  />
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="body2" fontWeight={600}>
                      Bật cụm
                    </Typography>
                    <Switch
                      checked={newCluster.isActive}
                      onChange={(e) =>
                        setNewCluster((prev) => ({ ...prev, isActive: e.target.checked }))
                      }
                    />
                  </Stack>
                  <Button
                    variant="contained"
                    startIcon={<AddRoundedIcon />}
                    onClick={handleCreateCluster}
                    disabled={isCreatingCluster}
                  >
                    Tạo cụm
                  </Button>
                </Stack>
              </Card>

              <Card sx={{ p: 2.5, borderRadius: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6" fontWeight={700}>
                    Danh sách cụm
                  </Typography>
                  <Chip label={`${clusters.length} cụm`} size="small" />
                </Stack>
                <Stack spacing={1.5}>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleClusterSortEnd}
                  >
                    <SortableContext
                      items={orderedClusters.map((cluster) => sid(cluster?._id))}
                      strategy={verticalListSortingStrategy}
                    >
                      {orderedClusters.map((cluster) => {
                        const clusterId = sid(cluster?._id);
                        const isActive = clusterId === sid(selectedClusterId);
                        return (
                          <SortableItem key={clusterId} id={clusterId}>
                            {({ attributes, listeners }) => (
                              <Paper
                                variant="outlined"
                                onClick={() => setSelectedClusterId(clusterId)}
                                sx={{
                                  p: 2,
                                  cursor: "pointer",
                                  borderRadius: 2.5,
                                  borderColor: isActive ? "primary.main" : "divider",
                                  bgcolor: isActive ? "rgba(37,99,235,0.05)" : "background.paper",
                                }}
                              >
                                <Stack
                                  direction="row"
                                  justifyContent="space-between"
                                  alignItems="flex-start"
                                >
                                  <Box>
                                    <Typography variant="h5" fontWeight={700} mb={0.5}>
                                      {cluster?.name}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                      {cluster?.venueName || "Chưa có địa điểm"}
                                    </Typography>
                                  </Box>
                                  <Stack spacing={1} alignItems="flex-end">
                                    <Chip
                                      size="small"
                                      color={cluster?.isActive !== false ? "success" : "default"}
                                      label={cluster?.isActive !== false ? "Đang bật" : "Đang tắt"}
                                    />
                                    <Box
                                      {...attributes}
                                      {...listeners}
                                      onClick={(e) => e.stopPropagation()}
                                      sx={{
                                        display: "inline-flex",
                                        cursor: "grab",
                                        color: "text.secondary",
                                      }}
                                    >
                                      <DragIndicatorRoundedIcon fontSize="small" />
                                    </Box>
                                  </Stack>
                                </Stack>
                              </Paper>
                            )}
                          </SortableItem>
                        );
                      })}
                    </SortableContext>
                  </DndContext>
                  {!clusters.length && <Alert severity="info">Chưa có cụm sân nào.</Alert>}
                </Stack>
              </Card>
            </Stack>
          </Grid>
          <Grid item xs={12} lg={8}>
            <Stack spacing={3}>
              <Card sx={{ p: 3, borderRadius: 3 }}>
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  justifyContent="space-between"
                  alignItems={{ xs: "flex-start", md: "center" }}
                  spacing={2}
                  mb={2.5}
                >
                  <Box>
                    <Typography variant="h5" fontWeight={700}>
                      {selectedCluster?.name || "Chọn cụm sân"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {selectedCluster?.venueName || "Chưa có địa điểm"}
                    </Typography>
                  </Box>
                  {selectedCluster && (
                    <Chip
                      size="small"
                      color={selectedCluster?.isActive !== false ? "success" : "default"}
                      label={selectedCluster?.isActive !== false ? "Cụm đang bật" : "Cụm đang tắt"}
                    />
                  )}
                </Stack>

                {selectedCluster ? (
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={7}>
                      <TextField
                        label="Tên cụm"
                        fullWidth
                        value={clusterForm.name}
                        onChange={(e) =>
                          setClusterForm((prev) => ({ ...prev, name: e.target.value }))
                        }
                      />
                    </Grid>
                    <Grid item xs={12} md={5}>
                      <TextField
                        label="Địa điểm"
                        fullWidth
                        value={clusterForm.venueName}
                        onChange={(e) =>
                          setClusterForm((prev) => ({ ...prev, venueName: e.target.value }))
                        }
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        label="Mô tả"
                        fullWidth
                        multiline
                        minRows={2}
                        value={clusterForm.description}
                        onChange={(e) =>
                          setClusterForm((prev) => ({ ...prev, description: e.target.value }))
                        }
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        label="Ghi chú"
                        fullWidth
                        multiline
                        minRows={2}
                        value={clusterForm.notes}
                        onChange={(e) =>
                          setClusterForm((prev) => ({ ...prev, notes: e.target.value }))
                        }
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Typography variant="body2" fontWeight={600}>
                          Bật cụm
                        </Typography>
                        <Switch
                          checked={clusterForm.isActive}
                          onChange={(e) =>
                            setClusterForm((prev) => ({ ...prev, isActive: e.target.checked }))
                          }
                        />
                      </Stack>
                    </Grid>
                    <Grid item xs={12}>
                      <Stack direction="row" spacing={1.5}>
                        <Button
                          variant="contained"
                          startIcon={<SaveRoundedIcon />}
                          onClick={handleSaveCluster}
                          disabled={isUpdatingCluster}
                        >
                          Lưu cụm
                        </Button>
                        <Button
                          variant="outlined"
                          color="error"
                          startIcon={<DeleteOutlineRoundedIcon />}
                          onClick={handleDeleteCluster}
                          disabled={isDeletingCluster}
                        >
                          Xóa cụm
                        </Button>
                      </Stack>
                    </Grid>
                  </Grid>
                ) : (
                  <Alert severity="info">Hãy chọn một cụm sân ở cột bên trái.</Alert>
                )}
              </Card>

              <Card sx={{ p: 3, borderRadius: 3 }}>
                <Typography variant="h6" fontWeight={700} mb={2}>
                  Giải được phép dùng cụm này
                </Typography>
                {allowedTournaments.length ? (
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {allowedTournaments.map((item) => (
                      <Chip
                        key={sid(item?._id)}
                        label={item?.name}
                        color="primary"
                        variant="outlined"
                      />
                    ))}
                  </Stack>
                ) : (
                  <Alert severity="info">Chưa có giải nào map vào cụm sân này.</Alert>
                )}
              </Card>

              <Card sx={{ p: 3, borderRadius: 3 }}>
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  justifyContent="space-between"
                  alignItems={{ xs: "flex-start", md: "center" }}
                  spacing={2}
                  mb={2}
                >
                  <Box>
                    <Typography variant="h5" fontWeight={700}>
                      Sân vật lý
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Mã sân tự sinh từ tên sân. Kéo thả để đổi vị trí sân.
                    </Typography>
                  </Box>
                  <Chip label={`${stations.length} sân`} size="small" />
                </Stack>

                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    mb: 3,
                    borderRadius: 2.5,
                    borderStyle: "dashed",
                    borderColor: "primary.main",
                    bgcolor: "rgba(37,99,235,0.03)",
                  }}
                >
                  <Typography variant="subtitle1" fontWeight={700} mb={2}>
                    Thêm sân mới
                  </Typography>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={5}>
                      <TextField
                        label="Tên sân"
                        fullWidth
                        value={newStation.name}
                        onChange={(e) =>
                          setNewStation((prev) => ({ ...prev, name: e.target.value }))
                        }
                      />
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <TextField
                        label="Mã sân"
                        fullWidth
                        value={newStationCodePreview}
                        InputProps={{ readOnly: true }}
                        helperText="Tự sinh theo tên sân"
                      />
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <TextField
                        select
                        label="Trạng thái"
                        fullWidth
                        value={newStation.status}
                        onChange={(e) =>
                          setNewStation((prev) => ({ ...prev, status: e.target.value }))
                        }
                      >
                        {STATION_STATUS_OPTIONS.map((item) => (
                          <MenuItem key={item.value} value={item.value}>
                            {item.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <Stack alignItems="center">
                        <Typography variant="caption" color="text.secondary">
                          Bật
                        </Typography>
                        <Switch
                          checked={newStation.isActive}
                          onChange={(e) =>
                            setNewStation((prev) => ({ ...prev, isActive: e.target.checked }))
                          }
                        />
                      </Stack>
                    </Grid>
                    <Grid item xs={12}>
                      <Button
                        variant="contained"
                        startIcon={<AddRoundedIcon />}
                        onClick={createNewStation}
                        disabled={!selectedClusterId || isCreatingStation}
                      >
                        Thêm sân
                      </Button>
                    </Grid>
                  </Grid>
                </Paper>

                <Stack spacing={2}>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleStationSortEnd}
                  >
                    <SortableContext
                      items={orderedStations.map((station) => sid(station?._id))}
                      strategy={verticalListSortingStrategy}
                    >
                      {orderedStations.map((station) => {
                        const stationId = sid(station?._id);
                        const draft = stationDrafts[stationId] || buildStationDraft(station);
                        const statusMeta = getStationStatusMeta(draft.status);
                        const selectedMatch = stationSelections[stationId] || null;
                        const matchOptions =
                          station?.currentMatch &&
                          !availableMatches.some(
                            (item) => sid(item?._id) === sid(station.currentMatch?._id)
                          )
                            ? [station.currentMatch, ...availableMatches]
                            : availableMatches;

                        return (
                          <SortableItem key={stationId} id={stationId}>
                            {({ attributes, listeners }) => (
                              <Paper
                                variant="outlined"
                                sx={{
                                  p: 2,
                                  borderRadius: 2.5,
                                  borderLeft: "4px solid",
                                  borderLeftColor:
                                    station?.isActive !== false ? "primary.main" : "divider",
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
                                      {station?.name}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                      {station?.code}
                                    </Typography>
                                  </Box>
                                  <Stack
                                    direction="row"
                                    spacing={1}
                                    alignItems="center"
                                    flexWrap="wrap"
                                    useFlexGap
                                  >
                                    <Chip
                                      label={statusMeta.label}
                                      size="small"
                                      color={statusMeta.color}
                                    />
                                    <Chip
                                      label={station?.isActive !== false ? "Đang bật" : "Đang tắt"}
                                      size="small"
                                      color={station?.isActive !== false ? "success" : "default"}
                                      variant="outlined"
                                    />
                                    <Box
                                      {...attributes}
                                      {...listeners}
                                      sx={{
                                        display: "inline-flex",
                                        cursor: "grab",
                                        color: "text.secondary",
                                      }}
                                    >
                                      <DragIndicatorRoundedIcon fontSize="small" />
                                    </Box>
                                  </Stack>
                                </Stack>

                                <Grid container spacing={2} alignItems="flex-start">
                                  <Grid item xs={12} md={5}>
                                    <TextField
                                      label="Tên sân"
                                      fullWidth
                                      value={draft.name}
                                      onChange={(e) =>
                                        setStationDrafts((prev) => ({
                                          ...prev,
                                          [stationId]: { ...draft, name: e.target.value },
                                        }))
                                      }
                                    />
                                  </Grid>
                                  <Grid item xs={12} md={3}>
                                    <TextField
                                      label="Mã sân"
                                      fullWidth
                                      value={buildStationCodePreview(draft.name)}
                                      InputProps={{ readOnly: true }}
                                      helperText="Tự sinh theo tên sân"
                                    />
                                  </Grid>
                                  <Grid item xs={12} md={2}>
                                    <TextField
                                      select
                                      label="Trạng thái"
                                      fullWidth
                                      value={draft.status}
                                      onChange={(e) =>
                                        setStationDrafts((prev) => ({
                                          ...prev,
                                          [stationId]: { ...draft, status: e.target.value },
                                        }))
                                      }
                                    >
                                      {STATION_STATUS_OPTIONS.map((item) => (
                                        <MenuItem key={item.value} value={item.value}>
                                          {item.label}
                                        </MenuItem>
                                      ))}
                                    </TextField>
                                  </Grid>
                                  <Grid item xs={12} md={2}>
                                    <Stack alignItems="center">
                                      <Typography variant="caption" color="text.secondary">
                                        Bật
                                      </Typography>
                                      <Switch
                                        checked={draft.isActive}
                                        onChange={(e) =>
                                          setStationDrafts((prev) => ({
                                            ...prev,
                                            [stationId]: { ...draft, isActive: e.target.checked },
                                          }))
                                        }
                                      />
                                    </Stack>
                                  </Grid>
                                  <Grid item xs={12}>
                                    <Stack direction="row" spacing={1.5} justifyContent="flex-end">
                                      <Button
                                        variant="contained"
                                        startIcon={<SaveRoundedIcon />}
                                        onClick={() => saveStation(station)}
                                        disabled={isUpdatingStation}
                                      >
                                        Lưu sân
                                      </Button>
                                      <Button
                                        variant="outlined"
                                        color="error"
                                        startIcon={<DeleteOutlineRoundedIcon />}
                                        onClick={() => removeStation(stationId)}
                                        disabled={isDeletingStation}
                                      >
                                        Xóa
                                      </Button>
                                    </Stack>
                                  </Grid>
                                  <Grid item xs={12}>
                                    <Divider />
                                  </Grid>
                                  <Grid item xs={12} md={6}>
                                    <Stack spacing={1}>
                                      <Typography variant="subtitle2" fontWeight={700}>
                                        Trận hiện tại
                                      </Typography>
                                      {station?.currentMatch ? (
                                        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                                          <Typography variant="body2" fontWeight={700}>
                                            {station?.currentMatch?.displayCode ||
                                              station?.currentMatch?.code}
                                          </Typography>
                                          <Typography variant="body2">
                                            {teamLine(station.currentMatch)}
                                          </Typography>
                                          <Typography variant="caption" color="text.secondary">
                                            {station?.currentMatch?.tournament?.name ||
                                              "Chưa rõ giải"}
                                          </Typography>
                                        </Paper>
                                      ) : (
                                        <Alert severity="info">Sân này hiện chưa gán trận.</Alert>
                                      )}
                                    </Stack>
                                  </Grid>
                                  <Grid item xs={12} md={6}>
                                    <Stack spacing={1.5}>
                                      <Typography variant="subtitle2" fontWeight={700}>
                                        Gán hoặc đổi trận
                                      </Typography>
                                      <Autocomplete
                                        options={matchOptions}
                                        value={selectedMatch}
                                        onChange={(_, value) =>
                                          setStationSelections((prev) => ({
                                            ...prev,
                                            [stationId]: value,
                                          }))
                                        }
                                        isOptionEqualToValue={(option, value) =>
                                          sid(option?._id) === sid(value?._id)
                                        }
                                        getOptionLabel={buildMatchOptionLabel}
                                        renderInput={(params) => (
                                          <TextField
                                            {...params}
                                            label="Chọn trận"
                                            placeholder="Tìm theo mã hoặc đội"
                                          />
                                        )}
                                      />
                                      <Stack direction="row" spacing={1.5}>
                                        <Button
                                          variant="contained"
                                          onClick={() => assignToStation(stationId)}
                                          disabled={isAssigningStation}
                                        >
                                          Gán trận
                                        </Button>
                                        <Button
                                          variant="outlined"
                                          color="warning"
                                          onClick={() => clearStation(stationId)}
                                          disabled={isFreeingStation || !station?.currentMatch}
                                        >
                                          Giải phóng sân
                                        </Button>
                                      </Stack>
                                    </Stack>
                                  </Grid>
                                </Grid>
                              </Paper>
                            )}
                          </SortableItem>
                        );
                      })}
                    </SortableContext>
                  </DndContext>
                  {!stations.length && (
                    <Alert severity="info">Cụm này chưa có sân vật lý nào.</Alert>
                  )}
                </Stack>
              </Card>
            </Stack>
          </Grid>
        </Grid>
      </Box>

      <Dialog open={confirmDialog.open} onClose={closeConfirmDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{confirmDialog.title}</DialogTitle>
        <DialogContent>
          <Typography variant="body1">{confirmDialog.description}</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={closeConfirmDialog}>Hủy</Button>
          <Button
            variant="contained"
            color={confirmDialog.confirmColor}
            onClick={confirmDangerDialog}
          >
            {confirmDialog.confirmText}
          </Button>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}

export default AdminCourtClustersPage;
