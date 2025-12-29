// pages/admin/components/AnalyticsChart.jsx
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

    const dateMap = {};
    analytics.dailyStats.forEach((item) => {
      const date = item._id.date;
      if (!dateMap[date]) {
        dateMap[date] = {
          date,
          checking: 0,
          downloading: 0,
          installing: 0,
          success: 0,
          failed: 0,
          skipped: 0,
        };
      }
      dateMap[date][item._id.status] = item.count;
    });

    return Object.values(dateMap).sort((a, b) => new Date(a.date) - new Date(b.date));
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
        <Typography variant="h6">Thống kê Update</Typography>
        <ToggleButtonGroup value={days} exclusive onChange={handleDaysChange} size="small">
          <ToggleButton value={7}>7 ngày</ToggleButton>
          <ToggleButton value={14}>14 ngày</ToggleButton>
          <ToggleButton value={30}>30 ngày</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {chartData.length === 0 ? (
        <Box display="flex" alignItems="center" justifyContent="center" height={250}>
          <Typography color="text.secondary">Chưa có dữ liệu thống kê</Typography>
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
            <Bar dataKey="checking" name="Kiểm tra" fill="#9c27b0" radius={[4, 4, 0, 0]} />
            <Bar dataKey="downloading" name="Đang tải" fill="#2196f3" radius={[4, 4, 0, 0]} />
            <Bar dataKey="installing" name="Đang cài" fill="#ff9800" radius={[4, 4, 0, 0]} />
            <Bar dataKey="success" name="Thành công" fill="#4caf50" radius={[4, 4, 0, 0]} />
            <Bar dataKey="failed" name="Thất bại" fill="#f44336" radius={[4, 4, 0, 0]} />
            <Bar dataKey="skipped" name="Bỏ qua" fill="#607d8b" radius={[4, 4, 0, 0]} />
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
