import React, { useMemo } from "react";
import PropTypes from "prop-types";
import { Box, Paper, Typography, Skeleton, ToggleButton, ToggleButtonGroup } from "@mui/material";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useGetOtaAnalyticsQuery } from "../../../slices/otaApiSlice";

export default function AnalyticsChart({ platform, days, onDaysChange }) {
  const { data: analytics, isLoading } = useGetOtaAnalyticsQuery({ platform, days });

  const chartData = useMemo(() => {
    if (!analytics?.dailyStats || analytics.dailyStats.length === 0) return [];

    return analytics.dailyStats
      .map((item) => ({
        date: item.date,
        deployments: Number(item.enabled || 0) + Number(item.disabled || 0),
        enabled: Number(item.enabled || 0),
        disabled: Number(item.disabled || 0),
        force: Number(item.force || 0),
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [analytics]);

  const handleDaysChange = (_, newDays) => {
    if (newDays) onDaysChange(newDays);
  };

  if (isLoading) {
    return <Skeleton variant="rounded" height={300} />;
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Thống kê deploy hot-updater</Typography>
        <ToggleButtonGroup value={days} exclusive onChange={handleDaysChange} size="small">
          <ToggleButton value={7}>7 ngày</ToggleButton>
          <ToggleButton value={14}>14 ngày</ToggleButton>
          <ToggleButton value={30}>30 ngày</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {chartData.length === 0 ? (
        <Box display="flex" alignItems="center" justifyContent="center" height={250}>
          <Typography color="text.secondary">
            Chưa có dữ liệu deploy trong khoảng thời gian này
          </Typography>
        </Box>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
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
                backgroundColor: "rgba(0,0,0,0.8)",
                border: "none",
                borderRadius: 8,
                color: "#fff",
              }}
            />
            <Legend />
            <Bar dataKey="deployments" name="Tổng deploy" fill="#1976d2" radius={[4, 4, 0, 0]} />
            <Bar dataKey="enabled" name="Đang bật" fill="#2e7d32" radius={[4, 4, 0, 0]} />
            <Bar dataKey="disabled" name="Đã tắt" fill="#ef6c00" radius={[4, 4, 0, 0]} />
            <Bar dataKey="force" name="Force update" fill="#d32f2f" radius={[4, 4, 0, 0]} />
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
