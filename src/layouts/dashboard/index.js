// src/layouts/dashboard/index.jsx
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import MDBox from "components/MDBox";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import ReportsBarChart from "examples/Charts/BarCharts/ReportsBarChart";
import ReportsLineChart from "examples/Charts/LineCharts/ReportsLineChart";
import ComplexStatisticsCard from "examples/Cards/StatisticsCards/ComplexStatisticsCard";
import Icon from "@mui/material/Icon";
import Skeleton from "@mui/material/Skeleton";
import LinearProgress from "@mui/material/LinearProgress";
import { useMemo } from "react";

import { useGetDashboardMetricsQuery, useGetDashboardSeriesQuery } from "slices/dashboardApiSlice";
import { fillSeries, toBarLineDataset } from "./utils/chartTransforms.js";
import PropTypes from "prop-types";

/* ============ Skeleton helpers ============ */
function KpiSkeleton() {
  return (
    <Card>
      <MDBox p={2}>
        <MDBox mb={1}>
          <Skeleton variant="text" width={120} height={20} />
        </MDBox>
        <Skeleton variant="rounded" height={28} width={80} />
        <MDBox mt={1}>
          <Skeleton variant="text" width={140} height={16} />
        </MDBox>
      </MDBox>
    </Card>
  );
}

function ChartSkeleton() {
  return (
    <Card>
      <MDBox p={2}>
        <Skeleton variant="text" width="60%" height={24} />
        <Skeleton variant="text" width="40%" height={16} />
      </MDBox>
      <MDBox px={2} pb={2}>
        <Skeleton variant="rounded" height={260} />
      </MDBox>
    </Card>
  );
}

/* ============ Simple Upcoming table ============ */
function UpcomingCard({ items = [], loading = false }) {
  return (
    <Card>
      <MDBox p={2}>
        <MDBox variant="h6" fontWeight="bold">
          Giải sắp diễn ra
        </MDBox>
      </MDBox>
      <MDBox px={2} pb={2}>
        {loading ? (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th align="left">Tên</th>
                <th align="left">Ngày</th>
                <th align="right">Đã ĐK / Tối đa</th>
              </tr>
            </thead>
            <tbody>
              {[...Array(3)].map((_, i) => (
                <tr key={i}>
                  <td style={{ padding: "8px 0" }}>
                    <Skeleton variant="text" width="80%" />
                  </td>
                  <td>
                    <Skeleton variant="text" width={110} />
                  </td>
                  <td align="right">
                    <Skeleton variant="text" width={80} style={{ marginLeft: "auto" }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : items.length === 0 ? (
          <MDBox color="text" fontSize={14}>
            Không có giải sắp tới
          </MDBox>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th align="left">Tên</th>
                <th align="left">Ngày</th>
                <th align="right">Đã ĐK / Tối đa</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t._id}>
                  <td style={{ padding: "8px 0" }}>{t.name}</td>
                  <td>{new Date(t.startDate).toLocaleDateString()}</td>
                  <td align="right">
                    {t.registered ?? 0}
                    {t.maxPairs ? ` / ${t.maxPairs}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </MDBox>
    </Card>
  );
}

/* ============ Simple TODOs card ============ */
function TodosCard({ todos, loading = false }) {
  const rows = [
    { icon: "sports", label: "Trận chưa gán trọng tài", value: todos?.needReferee ?? 0 },
    { icon: "how_to_reg", label: "Đăng ký chờ duyệt", value: todos?.pendingApprovals ?? 0 },
    { icon: "verified_user", label: "KYC chưa xác minh", value: todos?.pendingKyc ?? 0 },
    { icon: "report", label: "Sự cố chưa xử lý", value: todos?.incidents ?? 0 },
  ];
  return (
    <Card>
      <MDBox p={2}>
        <MDBox variant="h6" fontWeight="bold">
          Công việc cần xử lý
        </MDBox>
      </MDBox>
      <MDBox px={2} pb={2}>
        {loading
          ? [...Array(rows.length)].map((_, i) => (
              <MDBox
                key={i}
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                py={1}
              >
                <MDBox display="flex" alignItems="center" gap={1}>
                  <Skeleton variant="circular" width={20} height={20} />
                  <Skeleton variant="text" width={180} />
                </MDBox>
                <Skeleton variant="text" width={30} />
              </MDBox>
            ))
          : rows.map((r) => (
              <MDBox
                key={r.label}
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                py={1}
              >
                <MDBox display="flex" alignItems="center" gap={1}>
                  <Icon fontSize="small">{r.icon}</Icon>
                  <span>{r.label}</span>
                </MDBox>
                <MDBox fontWeight="bold">{r.value}</MDBox>
              </MDBox>
            ))}
      </MDBox>
    </Card>
  );
}

function Dashboard() {
  const { data: metrics, isLoading: mLoading } = useGetDashboardMetricsQuery();
  const { data: series, isLoading: sLoading } = useGetDashboardSeriesQuery({ days: 30 });

  // KPI cards
  const openTournaments = metrics?.cards?.openTournaments?.count ?? 0;
  const openDelta = metrics?.cards?.openTournaments?.deltaPct ?? 0;

  const regsToday = metrics?.cards?.newRegsToday?.count ?? 0;
  const regsDelta = metrics?.cards?.newRegsToday?.deltaPct ?? 0;

  const liveMatches = metrics?.cards?.liveMatches?.count ?? 0;
  const unassigned = metrics?.cards?.unassigned?.count ?? 0;

  // Charts
  const barRegs = useMemo(() => {
    if (!series?.range || !series?.regsDaily) return null;
    const { labels, data } = fillSeries(series.range.start, series.range.end, series.regsDaily);
    return toBarLineDataset({ title: "Đăng ký/ngày", labels, data });
  }, [series]);

  const lineUsers = useMemo(() => {
    if (!series?.range || !series?.usersDaily) return null;
    const { labels, data } = fillSeries(series.range.start, series.range.end, series.usersDaily);
    return toBarLineDataset({ title: "Người dùng mới/ngày", labels, data });
  }, [series]);

  const lineFinished = useMemo(() => {
    if (!series?.range || !series?.matchesFinished) return null;
    const { labels, data } = fillSeries(
      series.range.start,
      series.range.end,
      series.matchesFinished
    );
    return toBarLineDataset({ title: "Trận hoàn tất/ngày", labels, data });
  }, [series]);

  const anyLoading = mLoading || sLoading;

  return (
    <DashboardLayout>
      <DashboardNavbar />
      {/* {anyLoading && <LinearProgress />} */}
      <MDBox py={3}>
        <Grid container spacing={3}>
          {/* KPI cards */}
          <Grid item xs={12} md={6} lg={3}>
            <MDBox mb={1.5}>
              {mLoading ? (
                <KpiSkeleton />
              ) : (
                <ComplexStatisticsCard
                  color="dark"
                  icon="emoji_events"
                  title="Giải đang mở"
                  count={openTournaments}
                  percentage={{
                    color: openDelta >= 0 ? "success" : "error",
                    amount: `${openDelta >= 0 ? "+" : ""}${openDelta}%`,
                    label: "so với tuần trước",
                  }}
                />
              )}
            </MDBox>
          </Grid>

          <Grid item xs={12} md={6} lg={3}>
            <MDBox mb={1.5}>
              {mLoading ? (
                <KpiSkeleton />
              ) : (
                <ComplexStatisticsCard
                  icon="assignment_ind"
                  title="Đăng ký hôm nay"
                  count={regsToday}
                  percentage={{
                    color: regsDelta >= 0 ? "success" : "error",
                    amount: `${regsDelta >= 0 ? "+" : ""}${regsDelta}%`,
                    label: "so với hôm qua",
                  }}
                />
              )}
            </MDBox>
          </Grid>

          <Grid item xs={12} md={6} lg={3}>
            <MDBox mb={1.5}>
              {mLoading ? (
                <KpiSkeleton />
              ) : (
                <ComplexStatisticsCard
                  color="success"
                  icon="live_tv"
                  title="Trận đang diễn ra"
                  count={String(liveMatches)}
                  percentage={{ color: "success", amount: "", label: "Cập nhật" }}
                />
              )}
            </MDBox>
          </Grid>

          <Grid item xs={12} md={6} lg={3}>
            <MDBox mb={1.5}>
              {mLoading ? (
                <KpiSkeleton />
              ) : (
                <ComplexStatisticsCard
                  color="primary"
                  icon="sports_handball"
                  title="Chưa gán trọng tài"
                  count={String(unassigned)}
                  percentage={{ color: "error", amount: "", label: "Cần xử lý" }}
                />
              )}
            </MDBox>
          </Grid>
        </Grid>

        {/* Charts */}
        <MDBox mt={4.5}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6} lg={4}>
              <MDBox mb={3}>
                {sLoading || !barRegs ? (
                  <ChartSkeleton />
                ) : (
                  <ReportsBarChart
                    color="info"
                    title="Đăng ký theo ngày"
                    description="30 ngày gần nhất"
                    date={
                      series?.updatedAt
                        ? `cập nhật ${new Date(series.updatedAt).toLocaleString()}`
                        : ""
                    }
                    chart={barRegs}
                  />
                )}
              </MDBox>
            </Grid>

            <Grid item xs={12} md={6} lg={4}>
              <MDBox mb={3}>
                {sLoading || !lineUsers ? (
                  <ChartSkeleton />
                ) : (
                  <ReportsLineChart
                    color="success"
                    title="Người dùng mới"
                    description="30 ngày gần nhất"
                    date={
                      series?.updatedAt
                        ? `cập nhật ${new Date(series.updatedAt).toLocaleString()}`
                        : ""
                    }
                    chart={lineUsers}
                  />
                )}
              </MDBox>
            </Grid>

            <Grid item xs={12} md={6} lg={4}>
              <MDBox mb={3}>
                {sLoading || !lineFinished ? (
                  <ChartSkeleton />
                ) : (
                  <ReportsLineChart
                    color="dark"
                    title="Trận hoàn tất"
                    description="30 ngày gần nhất"
                    date={
                      series?.updatedAt
                        ? `cập nhật ${new Date(series.updatedAt).toLocaleString()}`
                        : ""
                    }
                    chart={lineFinished}
                  />
                )}
              </MDBox>
            </Grid>
          </Grid>
        </MDBox>

        {/* Lists */}
        <MDBox>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6} lg={8}>
              <UpcomingCard items={metrics?.upcoming || []} loading={mLoading} />
            </Grid>
            <Grid item xs={12} md={6} lg={4}>
              <TodosCard todos={metrics?.todos} loading={mLoading} />
            </Grid>
          </Grid>
        </MDBox>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default Dashboard;

/* ===== PropTypes ===== */
UpcomingCard.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
      name: PropTypes.string,
      startDate: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
      endDate: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
      registrationDeadline: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
      maxPairs: PropTypes.number,
      status: PropTypes.string,
      registered: PropTypes.number,
    })
  ),
  loading: PropTypes.bool,
};

UpcomingCard.defaultProps = {
  items: [],
  loading: false,
};

TodosCard.propTypes = {
  todos: PropTypes.shape({
    needReferee: PropTypes.number,
    pendingApprovals: PropTypes.number,
    pendingKyc: PropTypes.number,
    incidents: PropTypes.number,
  }),
  loading: PropTypes.bool,
};

TodosCard.defaultProps = {
  todos: {
    needReferee: 0,
    pendingApprovals: 0,
    pendingKyc: 0,
    incidents: 0,
  },
  loading: false,
};
