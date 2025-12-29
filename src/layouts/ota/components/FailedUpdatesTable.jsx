// pages/admin/components/FailedUpdatesTable.jsx
import React, { useState } from "react";
import {
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Box,
  IconButton,
  Collapse,
  Skeleton,
} from "@mui/material";
import { KeyboardArrowDown, KeyboardArrowUp, BugReport } from "@mui/icons-material";
import { useGetOtaAnalyticsQuery } from "../../../slices/otaApiSlice";

const formatDate = (date) => {
  if (!date) return "-";
  return new Date(date).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const FailedUpdateRow = ({ log }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TableRow
        sx={{ "&:hover": { bgcolor: "action.hover" }, cursor: "pointer" }}
        onClick={() => setOpen(!open)}
      >
        <TableCell>
          <IconButton size="small">{open ? <KeyboardArrowUp /> : <KeyboardArrowDown />}</IconButton>
        </TableCell>
        <TableCell>
          <Typography variant="body2" fontFamily="monospace">
            {log.fromVersion} → {log.toVersion}
          </Typography>
        </TableCell>
        <TableCell>
          <Chip label={log.errorCode || "UNKNOWN"} size="small" color="error" variant="outlined" />
        </TableCell>
        <TableCell>
          <Typography
            variant="body2"
            sx={{
              maxWidth: 200,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {log.errorMessage || "-"}
          </Typography>
        </TableCell>
        <TableCell>{log.deviceInfo?.model || "-"}</TableCell>
        <TableCell>{formatDate(log.createdAt)}</TableCell>
      </TableRow>

      <TableRow>
        <TableCell colSpan={6} sx={{ py: 0 }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ py: 2, px: 4, bgcolor: "action.hover" }}>
              <Typography variant="subtitle2" gutterBottom>
                Chi tiết lỗi
              </Typography>

              <Box display="grid" gridTemplateColumns="repeat(2, 1fr)" gap={2} mb={2}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    App Version
                  </Typography>
                  <Typography variant="body2">{log.appVersion}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Duration
                  </Typography>
                  <Typography variant="body2">
                    {log.duration ? `${log.duration}ms` : "-"}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Device
                  </Typography>
                  <Typography variant="body2">
                    {log.deviceInfo?.brand} {log.deviceInfo?.model}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    OS Version
                  </Typography>
                  <Typography variant="body2">{log.deviceInfo?.osVersion || "-"}</Typography>
                </Box>
              </Box>

              <Typography variant="caption" color="text.secondary">
                Error Message
              </Typography>
              <Paper
                variant="outlined"
                sx={{
                  p: 1.5,
                  mt: 0.5,
                  bgcolor: "error.dark",
                  fontFamily: "monospace",
                  fontSize: 12,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                }}
              >
                {log.errorMessage || "No error message provided"}
              </Paper>

              {log.ip && (
                <Box mt={1}>
                  <Typography variant="caption" color="text.secondary">
                    IP: {log.ip}
                  </Typography>
                </Box>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

export default function FailedUpdatesTable({ platform }) {
  const { data: analytics, isLoading } = useGetOtaAnalyticsQuery({ platform, days: 7 });
  const failedUpdates = analytics?.failedUpdates || [];

  if (isLoading) {
    return <Skeleton variant="rounded" height={200} />;
  }

  return (
    <Paper>
      <Box display="flex" alignItems="center" gap={1} p={2} borderBottom={1} borderColor="divider">
        <BugReport color="error" />
        <Typography variant="h6">Update thất bại gần đây</Typography>
        {failedUpdates.length > 0 && (
          <Chip label={failedUpdates.length} size="small" color="error" sx={{ ml: 1 }} />
        )}
      </Box>

      {failedUpdates.length === 0 ? (
        <Box p={4} textAlign="center">
          <Typography color="text.secondary">
            🎉 Không có lỗi update nào trong 7 ngày qua
          </Typography>
        </Box>
      ) : (
        <TableContainer sx={{ maxHeight: 400 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell width={50} />
                <TableCell>Version</TableCell>
                <TableCell>Error Code</TableCell>
                <TableCell>Message</TableCell>
                <TableCell>Device</TableCell>
                <TableCell>Thời gian</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {failedUpdates.map((log, index) => (
                <FailedUpdateRow key={log._id || index} log={log} />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
}
