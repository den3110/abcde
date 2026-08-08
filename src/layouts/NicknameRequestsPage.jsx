// layouts/NicknameRequestsPage.jsx
// Trang admin duyệt yêu cầu đổi biệt danh.
import React, { useState } from "react";
import PropTypes from "prop-types";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/CheckCircle";
import RejectIcon from "@mui/icons-material/Cancel";
import RefreshIcon from "@mui/icons-material/Refresh";
import { toast } from "react-toastify";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

import {
  useApproveNicknameRequestMutation,
  useListNicknameRequestsQuery,
  useRejectNicknameRequestMutation,
} from "slices/nicknameRequestsApiSlice";

const STATUS_OPTIONS = [
  { value: "pending", label: "Chờ duyệt" },
  { value: "approved", label: "Đã duyệt" },
  { value: "rejected", label: "Đã từ chối" },
  { value: "cancelled", label: "Đã huỷ" },
  { value: "all", label: "Tất cả" },
];

const STATUS_META = {
  pending: { color: "warning", label: "Chờ duyệt" },
  approved: { color: "success", label: "Đã duyệt" },
  rejected: { color: "error", label: "Từ chối" },
  cancelled: { color: "default", label: "Huỷ" },
};

function fmtDate(d) {
  if (!d) return "-";
  const dd = new Date(d);
  return `${dd.toLocaleDateString("vi-VN")} ${dd.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function RejectDialog({ open, onClose, onConfirm, loading }) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Từ chối yêu cầu đổi biệt danh</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          User sẽ nhận thông báo với lý do dưới đây và KHÔNG mất lần đổi.
        </Typography>
        <TextField
          autoFocus
          fullWidth
          multiline
          minRows={2}
          maxRows={4}
          label="Lý do từ chối"
          placeholder="VD: Tên không phù hợp, chứa từ nhạy cảm..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Huỷ</Button>
        <Button
          onClick={() => {
            onConfirm(reason);
            setReason("");
          }}
          variant="contained"
          color="error"
          disabled={loading}
        >
          {loading ? "Đang gửi..." : "Từ chối"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
RejectDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  loading: PropTypes.bool,
};
RejectDialog.defaultProps = { loading: false };

export default function NicknameRequestsPage() {
  const [status, setStatus] = useState("pending");
  const { data, isFetching, refetch } = useListNicknameRequestsQuery({
    status,
    limit: 50,
  });
  const [approve, { isLoading: approving }] = useApproveNicknameRequestMutation();
  const [reject, { isLoading: rejecting }] = useRejectNicknameRequestMutation();
  const [rejectTarget, setRejectTarget] = useState(null);

  const items = data?.items || [];
  const counts = data?.counts || {};

  const doApprove = async (row) => {
    if (
      !window.confirm(
        `Duyệt đổi biệt danh "${row.oldNickname || "-"}" → "${row.newNickname}" cho ${
          row.user?.name || row.snapshot?.name || row.user?.nickname
        }?`
      )
    )
      return;
    try {
      await approve(row._id).unwrap();
      toast.success("Đã duyệt yêu cầu");
    } catch (err) {
      toast.error(err?.data?.message || err?.error || "Lỗi khi duyệt");
    }
  };

  const doReject = async (reason) => {
    if (!rejectTarget) return;
    try {
      await reject({ id: rejectTarget._id, reason }).unwrap();
      toast.success("Đã từ chối yêu cầu");
      setRejectTarget(null);
    } catch (err) {
      toast.error(err?.data?.message || err?.error || "Lỗi khi từ chối");
    }
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box sx={{ p: 3 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          alignItems={{ sm: "center" }}
          justifyContent="space-between"
          sx={{ mb: 2 }}
        >
          <Box>
            <Typography variant="h5" fontWeight={800}>
              Duyệt đổi biệt danh
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Duyệt yêu cầu đổi nickname từ user. Nếu từ chối, user vẫn còn lần
              đổi (không bị consume cooldown).
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              label={`Chờ: ${counts.pending ?? "?"}`}
              color="warning"
              size="small"
            />
            <TextField
              select
              size="small"
              label="Trạng thái"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              sx={{ minWidth: 160 }}
            >
              {STATUS_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </TextField>
            <IconButton onClick={refetch} disabled={isFetching}>
              <RefreshIcon />
            </IconButton>
          </Stack>
        </Stack>

        <Paper variant="outlined" sx={{ overflow: "auto" }}>
          {isFetching && !items.length ? (
            <Box sx={{ p: 4, display: "flex", justifyContent: "center" }}>
              <CircularProgress size={24} />
            </Box>
          ) : items.length === 0 ? (
            <Box sx={{ p: 4, textAlign: "center" }}>
              <Alert severity="info" sx={{ display: "inline-flex" }}>
                Không có yêu cầu nào ở trạng thái{" "}
                <strong style={{ marginLeft: 4 }}>
                  {STATUS_OPTIONS.find((o) => o.value === status)?.label}
                </strong>
                .
              </Alert>
            </Box>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>User</TableCell>
                  <TableCell>Biệt danh cũ</TableCell>
                  <TableCell>Biệt danh mới</TableCell>
                  <TableCell>SĐT</TableCell>
                  <TableCell>Yêu cầu lúc</TableCell>
                  <TableCell>Trạng thái</TableCell>
                  <TableCell align="right">Thao tác</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((row) => {
                  const u = row.user || {};
                  const meta = STATUS_META[row.status] || STATUS_META.pending;
                  const isPending = row.status === "pending";
                  return (
                    <TableRow key={row._id} hover>
                      <TableCell>
                        <Stack>
                          <Typography variant="body2" fontWeight={700}>
                            {u.name || row.snapshot?.name || "-"}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {u._id}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {row.oldNickname || "-"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={700} color="primary">
                          {row.newNickname}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">
                          {u.phone || row.snapshot?.phone || "-"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">
                          {fmtDate(row.requestedAt || row.createdAt)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={meta.label}
                          color={meta.color}
                          size="small"
                        />
                        {row.status === "rejected" && row.rejectionReason && (
                          <Tooltip title={row.rejectionReason}>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{
                                display: "block",
                                maxWidth: 180,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {row.rejectionReason}
                            </Typography>
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {isPending ? (
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Button
                              size="small"
                              variant="contained"
                              color="success"
                              startIcon={<CheckIcon />}
                              onClick={() => doApprove(row)}
                              disabled={approving}
                            >
                              Duyệt
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              startIcon={<RejectIcon />}
                              onClick={() => setRejectTarget(row)}
                              disabled={rejecting}
                            >
                              Từ chối
                            </Button>
                          </Stack>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            {row.resolvedBy?.name || row.resolvedBy?.nickname || ""}
                            {row.resolvedAt ? ` · ${fmtDate(row.resolvedAt)}` : ""}
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Paper>
      </Box>

      <RejectDialog
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        onConfirm={doReject}
        loading={rejecting}
      />
    </DashboardLayout>
  );
}
