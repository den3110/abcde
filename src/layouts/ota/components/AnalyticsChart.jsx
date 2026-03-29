import React, { useMemo } from "react";
import PropTypes from "prop-types";
import { Box, Paper, Skeleton, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useGetOtaAnalyticsQuery } from "../../../slices/otaApiSlice";

export default function AnalyticsChart({ platform, days, onDaysChange }) {
  const { data: analytics, isLoading } = useGetOtaAnalyticsQuery({ platform, days });

  const chartData = useMemo(() => {
    if (!analytics?.dailyStats?.length) {
      return [];
    }

    return analytics.dailyStats
      .map((item) => ({
        date: item.date,
        downloads: Number(item.downloads || 0),
        success: Number(item.success || 0),
        failed: Number(item.failed || 0),
        deployments: Number(item.deployments || 0),
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [analytics]);

  const handleDaysChange = (_, newDays) => {
    if (newDays) {
      onDaysChange(newDays);
    }
  };

  if (isLoading) {
    return <Skeleton variant="rounded" height={320} />;
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Thống kê tải và cài đặt OTA</Typography>
        <ToggleButtonGroup value={days} exclusive onChange={handleDaysChange} size="small">
          <ToggleButton value={7}>7 ngày</ToggleButton>
          <ToggleButton value={14}>14 ngày</ToggleButton>
          <ToggleButton value={30}>30 ngày</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {!chartData.length ? (
        <Box display="flex" alignItems="center" justifyContent="center" height={260}>
          <Typography color="text.secondary">
            Chưa có dữ liệu telemetry trong khoảng thời gian này
          </Typography>
        </Box>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => {
                const date = new Date(value);
                return `${date.getDate()}/${date.getMonth() + 1}`;
              }}
            />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <Tooltip
              labelFormatter={(value) => new Date(value).toLocaleDateString("vi-VN")}
              contentStyle={{
                backgroundColor: "rgba(17,24,39,0.95)",
                border: "none",
                borderRadius: 8,
                color: "#fff",
              }}
            />
            <Legend />
            <Bar dataKey="downloads" name="Downloads" fill="#1976d2" radius={[4, 4, 0, 0]} />
            <Bar dataKey="success" name="Thành công" fill="#2e7d32" radius={[4, 4, 0, 0]} />
            <Bar dataKey="failed" name="Thất bại" fill="#d32f2f" radius={[4, 4, 0, 0]} />
            <Bar dataKey="deployments" name="Bundle deploy" fill="#8e24aa" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Paper>
  );
}

AnalyticsChart.propTypes = {
  platform: PropTypes.string.isRequired,
  days: PropTypes.number.isRequired,
  onDaysChange: PropTypes.func.isRequired,
};
