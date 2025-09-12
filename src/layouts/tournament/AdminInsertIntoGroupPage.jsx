// src/layouts/tournament/AdminInsertIntoGroupPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Stack,
  Typography,
  Autocomplete,
  TextField,
  Button,
  MenuItem,
  Grid,
  Chip,
  Divider,
  Tooltip,
  IconButton,
  Alert,
  CircularProgress,
  FormControlLabel,
  Switch,
} from "@mui/material";
import ReplayIcon from "@mui/icons-material/Replay";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import SportsKabaddiIcon from "@mui/icons-material/SportsKabaddi";
import PropTypes from "prop-types";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

// ✅ Dùng slice mới
import {
  useGetBracketQuery, // GET /admin/brackets/:bracketId
  useGetRegistrationsQuery, // GET /admin/tournaments/:id/registrations
  useInsertRegIntoGroupSlotMutation, // POST /admin/brackets/:bid/groups/:gid/insert-slot
  useGenerateGroupMatchesForTeamMutation, // POST /admin/brackets/:bid/groups/:gid/generate-matches
} from "slices/tournamentsApiSlice";

// ======================= Sub-component: SlotList =======================
function SlotList({ group, regMap, onCreateMatches }) {
  return (
    <Card variant="outlined">
      <CardHeader
        title={
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="h6">{group ? `Bảng ${group.name}` : "Chưa chọn bảng"}</Typography>
            {group && (
              <Chip
                size="small"
                label={`Slots: ${group?.regIds?.length || 0}${
                  group?.expectedSize ? `/${group.expectedSize}` : ""
                }`}
              />
            )}
          </Stack>
        }
      />
      <CardContent>
        {!group ? (
          <Typography color="text.secondary">Chọn 1 bảng ở khung bên trái.</Typography>
        ) : (
          <Stack spacing={1}>
            {(group?.regIds || []).map((id, idx) => (
              <Box
                key={`${id}-${idx}`}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  px: 1,
                  py: 1,
                  borderRadius: 1,
                  border: "1px solid",
                  borderColor: "divider",
                }}
              >
                <Typography>
                  <b>{idx + 1}.</b> {regMap.get(String(id)) || String(id)}
                </Typography>
                <Tooltip title="Tạo các trận còn thiếu cho đội này">
                  <span>
                    <IconButton size="small" onClick={() => onCreateMatches(String(id))}>
                      <SportsKabaddiIcon fontSize="inherit" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>
            ))}

            {(!group?.regIds || group.regIds.length === 0) && (
              <Typography color="text.secondary">(Chưa có đội nào trong bảng)</Typography>
            )}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

SlotList.propTypes = {
  group: PropTypes.shape({
    _id: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    name: PropTypes.string,
    expectedSize: PropTypes.number,
    regIds: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.object])),
  }),
  regMap: PropTypes.instanceOf(Map).isRequired,
  onCreateMatches: PropTypes.func.isRequired,
};

// ======================= Main component =======================
export default function AdminInsertIntoGroupPage() {
  const { bracketId: bracketIdFromRoute } = useParams();
  const [params, setParams] = useSearchParams();
  const [groupId, setGroupId] = useState(params.get("groupId") || "");

  // --- Fetch bracket by id ---
  const {
    data: bracket,
    isLoading: loadingBracket,
    isFetching: fetchingBracket,
    refetch: refetchBracket,
    error: bracketError,
  } = useGetBracketQuery(bracketIdFromRoute, {
    skip: !bracketIdFromRoute,
  });

  // Lấy registrations theo tournament của bracket
  const tournamentId = bracket?.tournament?._id || bracket?.tournament;
  const {
    data: regsResp,
    isLoading: loadingRegs,
    isFetching: fetchingRegs,
    error: regsError,
    refetch: refetchRegs,
  } = useGetRegistrationsQuery(tournamentId, { skip: !tournamentId });

  const registrations = useMemo(() => {
    if (Array.isArray(regsResp)) return regsResp;
    if (Array.isArray(regsResp?.docs)) return regsResp.docs;
    if (Array.isArray(regsResp?.items)) return regsResp.items;
    return [];
  }, [regsResp]);

  const groups = bracket?.groups || [];

  // Nếu chưa có groupId -> tự chọn group đầu tiên sau khi load bracket
  useEffect(() => {
    if (!groupId && groups.length > 0) {
      setGroupId(String(groups[0]._id));
      const next = new URLSearchParams(params);
      next.set("groupId", String(groups[0]._id));
      setParams(next, { replace: true });
    }
  }, [groups, groupId, params, setParams]);

  // Đồng bộ groupId trên URL khi chọn
  useEffect(() => {
    const next = new URLSearchParams(params);
    if (groupId) next.set("groupId", String(groupId));
    else next.delete("groupId");
    setParams(next, { replace: true });
  }, [groupId]); // eslint-disable-line

  // group đang chọn
  const group = useMemo(
    () => groups.find((g) => String(g._id) === String(groupId)) || null,
    [groups, groupId]
  );

  // Map id -> label (để hiển thị danh sách slot & search)
  const regMap = useMemo(() => {
    const m = new Map();
    (registrations || []).forEach((r) => {
      const p = r.player1 || {};
      const name = p.fullName || p.nickName || "";
      const tag = p.nickName || p.phone || "";
      m.set(String(r._id), name ? `${name}${tag ? ` (${tag})` : ""}` : String(r._id));
    });
    return m;
  }, [registrations]);

  // ✅ Set các reg đã thuộc bất kỳ group nào trong bracket
  const assignedRegSet = useMemo(() => {
    const s = new Set();
    (groups || []).forEach((g) => (g.regIds || []).forEach((id) => s.add(String(id))));
    return s;
  }, [groups]);

  // ✅ Chỉ show registrations chưa thuộc group nào
  const unassignedRegistrations = useMemo(
    () => (registrations || []).filter((r) => !assignedRegSet.has(String(r._id))),
    [registrations, assignedRegSet]
  );

  // --- Local form states ---
  const [registrationId, setRegistrationId] = useState("");
  const [slotIndex, setSlotIndex] = useState(1); // 1-based
  const [autoGrow, setAutoGrow] = useState(true);
  const [autoCreateAfterInsert, setAutoCreateAfterInsert] = useState(true); // ✅ mặc định bật

  // --- Mutations ---
  const [insertSlot, insertState] = useInsertRegIntoGroupSlotMutation();
  const [genMatches, genState] = useGenerateGroupMatchesForTeamMutation();

  const handleCreateMatches = async (regId) => {
    if (!bracket?._id || !group?._id || !regId) return;
    try {
      await genMatches({
        bracketId: bracket._id,
        groupId: group._id,
        body: { registrationId: regId },
      }).unwrap();
      refetchBracket();
    } catch (e) {}
  };

  const handleInsert = async () => {
    if (!bracket?._id || !group?._id || !registrationId) return;
    const currentRegId = registrationId;
    try {
      await insertSlot({
        bracketId: bracket._id,
        groupId: group._id,
        body: {
          registrationId: currentRegId,
          slotIndex: Number(slotIndex) || 1,
          autoGrowExpectedSize: !!autoGrow,
        },
      }).unwrap();

      // ✅ Nếu bật công tắc, tự tạo trận ngay sau khi chèn
      if (autoCreateAfterInsert) {
        await handleCreateMatches(currentRegId);
      }

      // Clear chọn để tránh bấm nhầm lần 2
      setRegistrationId("");
      // làm tươi lại dữ liệu
      refetchBracket();
      refetchRegs();
    } catch (e) {
      // lỗi sẽ hiển thị ở Alert
    }
  };

  const maxSlot = (group?.regIds?.length || 0) + 1;
  const busy = loadingBracket || fetchingBracket;

  return (
    <DashboardLayout>
      <DashboardNavbar />

      <Box sx={{ p: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <Typography variant="h5">Chèn đội vào bảng & bù trận</Typography>
          <Tooltip title="Reload">
            <IconButton onClick={() => window.location.reload()} size="small">
              <ReplayIcon fontSize="inherit" />
            </IconButton>
          </Tooltip>
        </Stack>

        {(bracketError || regsError) && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {bracketError?.data?.message || regsError?.data?.message || "Không tải được dữ liệu"}
          </Alert>
        )}

        <Grid container spacing={2}>
          {/* Chọn Group */}
          <Grid item xs={12} md={6} lg={5}>
            <Card variant="outlined">
              <CardHeader
                title={
                  busy ? (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CircularProgress size={18} />
                      <span>Đang tải bracket…</span>
                    </Stack>
                  ) : (
                    `Bracket: ${bracket?.name || ""}`
                  )
                }
                subheader={
                  bracket
                    ? `ID: ${String(bracket._id)} — Giải: ${
                        bracket.tournament?.name || bracket.tournament
                      }`
                    : ""
                }
              />
              <CardContent>
                <Stack spacing={2}>
                  <TextField
                    select
                    label="Bảng"
                    size="small"
                    value={groupId}
                    onChange={(e) => setGroupId(e.target.value)}
                    disabled={busy || (groups || []).length === 0}
                  >
                    {busy && <MenuItem disabled>Đang tải…</MenuItem>}
                    {(groups || []).map((g) => (
                      <MenuItem key={g._id} value={g._id}>
                        {g.name}
                      </MenuItem>
                    ))}
                  </TextField>

                  {group && (
                    <Alert severity="info">
                      groupId = <b>{String(group._id)}</b> (ObjectId của item trong
                      <code> bracket.groups[]</code>)
                    </Alert>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Danh sách slot hiện tại + tạo trận nhanh từng đội */}
          <Grid item xs={12} md={6} lg={7}>
            <SlotList group={group} regMap={regMap} onCreateMatches={handleCreateMatches} />
          </Grid>

          {/* Form chèn đội */}
          <Grid item xs={12}>
            <Card variant="outlined">
              <CardHeader title="Chèn 1 đội vào vị trí bất kỳ" />
              <CardContent>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} md={6} lg={4}>
                    <Autocomplete
                      options={unassignedRegistrations}
                      getOptionLabel={(o) => {
                        const p = o?.player1 || {};
                        const name = p.fullName || p.nickName || "";
                        const tag = p.nickName || p.phone || "";
                        return name ? `${name}${tag ? ` (${tag})` : ""}` : o?._id || "";
                      }}
                      size="small"
                      loading={loadingRegs || fetchingRegs}
                      value={unassignedRegistrations.find((r) => r._id === registrationId) || null}
                      onChange={(e, val) => setRegistrationId(val?._id || "")}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Chọn đội (chưa vào bảng)"
                          placeholder="Tìm theo tên/biệt danh/điện thoại"
                          helperText={
                            loadingRegs || fetchingRegs
                              ? ""
                              : `Còn ${unassignedRegistrations.length} đội chưa vào bảng nào`
                          }
                          InputProps={{
                            ...params.InputProps,
                            endAdornment: (
                              <>
                                {loadingRegs || fetchingRegs ? (
                                  <CircularProgress color="inherit" size={16} />
                                ) : null}
                                {params.InputProps.endAdornment}
                              </>
                            ),
                          }}
                        />
                      )}
                    />
                  </Grid>

                  <Grid item xs={6} md={3} lg={2}>
                    <TextField
                      type="number"
                      size="small"
                      label={`Vị trí muốn chèn (1..${maxSlot})`}
                      value={slotIndex}
                      onChange={(e) => setSlotIndex(e.target.value)}
                      inputProps={{ min: 1, max: maxSlot }}
                      helperText="Các slot sau sẽ đẩy xuống"
                      disabled={!group}
                    />
                  </Grid>

                  <Grid item xs={6} md={3} lg={3}>
                    <TextField
                      select
                      label="Khi vượt expectedSize"
                      size="small"
                      value={autoGrow ? "grow" : "reject"}
                      onChange={(e) => setAutoGrow(e.target.value === "grow")}
                      helperText="grow: tự tăng expectedSize"
                      disabled={!group}
                    >
                      <MenuItem value="grow">Grow (khuyến nghị)</MenuItem>
                      <MenuItem value="reject">Reject</MenuItem>
                    </TextField>
                  </Grid>

                  {/* ✅ Công tắc tự tạo trận sau khi chèn */}
                  <Grid item xs={12} md={6} lg={3}>
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={autoCreateAfterInsert}
                          onChange={(e) => setAutoCreateAfterInsert(e.target.checked)}
                        />
                      }
                      label="Tự tạo trận sau khi chèn"
                    />
                  </Grid>

                  <Grid item xs={12} md={12} lg={4}>
                    <Stack direction="row" spacing={1}>
                      <Button
                        variant="contained"
                        startIcon={<AddCircleOutlineIcon />}
                        disabled={
                          insertState.isLoading || !registrationId || !group || !bracket?._id
                        }
                        onClick={handleInsert}
                      >
                        Chèn vào bảng
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<SportsKabaddiIcon />}
                        disabled={genState.isLoading || !registrationId || !group || !bracket?._id}
                        onClick={() => handleCreateMatches(registrationId)}
                      >
                        Tạo trận cho đội
                      </Button>
                    </Stack>
                  </Grid>

                  {(insertState.error || genState.error) && (
                    <Grid item xs={12}>
                      <Alert severity="error">
                        {insertState.error?.data?.message ||
                          genState.error?.data?.message ||
                          "Có lỗi xảy ra"}
                      </Alert>
                    </Grid>
                  )}
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
            <Typography variant="body2" color="text.secondary">
              Mẹo: Bạn có thể truyền sẵn <code>groupId</code> trên URL để tự chọn bảng, ví dụ:
              <code> ?groupId=&lt;_id_của_group&gt;</code>.
            </Typography>
          </Grid>
        </Grid>
      </Box>
    </DashboardLayout>
  );
}
