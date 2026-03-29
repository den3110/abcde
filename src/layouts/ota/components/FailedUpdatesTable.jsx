import React from "react";
import PropTypes from "prop-types";
import {
  Box,
  Chip,
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { BugReport } from "@mui/icons-material";
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

const truncateMiddle = (value, head = 8, tail = 6) => {
  const text = String(value || "");
  if (!text) return "-";
  if (text.length <= head + tail + 3) return text;
  return `${text.slice(0, head)}...${text.slice(-tail)}`;
};

export default function FailedUpdatesTable({ platform }) {
  const { data: analytics, isLoading } = useGetOtaAnalyticsQuery({ platform, days: 7 });
  const failedUpdates = analytics?.failedUpdates || [];

  if (isLoading) {
    return <Skeleton variant="rounded" height={220} />;
  }

  return (
    <Paper>
      <Box display="flex" alignItems="center" gap={1} p={2} borderBottom={1} borderColor="divider">
        <BugReport color="error" />
        <Typography variant="h6">Update thất bại gần đây</Typography>
        {failedUpdates.length ? (
          <Chip label={failedUpdates.length} size="small" color="error" sx={{ ml: 1 }} />
        ) : null}
      </Box>

      {!failedUpdates.length ? (
        <Box p={4} textAlign="center">
          <Typography color="text.secondary">
            Không có lỗi update nào trong 7 ngày qua
          </Typography>
        </Box>
      ) : (
        <TableContainer sx={{ maxHeight: 420 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell>Bundle</TableCell>
                <TableCell>App đích</TableCell>
                <TableCell>Lỗi</TableCell>
                <TableCell>Thiết bị</TableCell>
                <TableCell>Thời gian</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {failedUpdates.map((event) => (
                <TableRow key={event._id || event.eventId} hover>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">
                      {truncateMiddle(event.bundleId, 10, 8)}
                    </Typography>
                    <Chip
                      label={event.status === "recovered" ? "Recovered" : "Failed"}
                      size="small"
                      color={event.status === "recovered" ? "warning" : "error"}
                      variant="outlined"
                      sx={{ mt: 0.5 }}
                    />
                  </TableCell>
                  <TableCell>{event.targetAppVersion || "-"}</TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{
                        maxWidth: 220,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {event.errorMessage || event.message || "-"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {event?.deviceInfo?.model || event?.deviceInfo?.deviceId || "-"}
                    </Typography>
                  </TableCell>
                  <TableCell>{formatDate(event.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
}

FailedUpdatesTable.propTypes = {
  platform: PropTypes.string.isRequired,
};
