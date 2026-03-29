import React from "react";
import PropTypes from "prop-types";
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
  Skeleton,
} from "@mui/material";
import { Block } from "@mui/icons-material";
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

export default function FailedUpdatesTable({ platform }) {
  const { data: analytics, isLoading } = useGetOtaAnalyticsQuery({ platform, days: 7 });
  const disabledBundles = analytics?.recentDisabledBundles || [];

  if (isLoading) {
    return <Skeleton variant="rounded" height={200} />;
  }

  return (
    <Paper>
      <Box display="flex" alignItems="center" gap={1} p={2} borderBottom={1} borderColor="divider">
        <Block color="warning" />
        <Typography variant="h6">Bundle đã tắt gần đây</Typography>
        {disabledBundles.length > 0 && (
          <Chip label={disabledBundles.length} size="small" color="warning" sx={{ ml: 1 }} />
        )}
      </Box>

      {disabledBundles.length === 0 ? (
        <Box p={4} textAlign="center">
          <Typography color="text.secondary">Không có bundle nào bị tắt trong 7 ngày qua</Typography>
        </Box>
      ) : (
        <TableContainer sx={{ maxHeight: 400 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell>Bundle ID</TableCell>
                <TableCell>Phiên bản app đích</TableCell>
                <TableCell>Kênh</TableCell>
                <TableCell>Mô tả</TableCell>
                <TableCell>Trạng thái</TableCell>
                <TableCell>Ngày deploy</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {disabledBundles.map((bundle, index) => (
                <TableRow key={bundle.bundleId || bundle._id || index} hover>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">
                      {bundle.bundleId || "-"}
                    </Typography>
                  </TableCell>
                  <TableCell>{bundle.targetAppVersion || "-"}</TableCell>
                  <TableCell>
                    <Chip label={bundle.channel || "production"} size="small" variant="outlined" />
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
                      {bundle.message || "-"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label="Đã tắt" size="small" color="warning" />
                  </TableCell>
                  <TableCell>{formatDate(bundle.createdAt)}</TableCell>
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
