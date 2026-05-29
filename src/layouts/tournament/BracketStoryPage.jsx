import { useMemo } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useParams } from "react-router-dom";
import { toast } from "react-toastify";
import PropTypes from "prop-types";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import {
  useGenerateBracketStoryMutation,
  useGetBracketStoryQuery,
} from "slices/bracketStoryApiSlice";

function listify(value) {
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value].filter(Boolean);
}

function formatDateTime(value) {
  if (!value) return "Chưa có";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa có";
  return date.toLocaleString("vi-VN");
}

function StorySection({ title, items }) {
  const rows = listify(items);
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="h6" fontWeight={700} gutterBottom>
          {title}
        </Typography>
        <Stack spacing={1}>
          {rows.length ? (
            rows.map((item, index) => (
              <Typography key={`${title}-${index}`} variant="body2" color="text.secondary">
                {index + 1}. {String(item)}
              </Typography>
            ))
          ) : (
            <Typography variant="body2" color="text.secondary">
              Chưa có dữ liệu.
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

StorySection.propTypes = {
  title: PropTypes.string.isRequired,
  items: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.number])),
    PropTypes.string,
  ]),
};

export default function BracketStoryPage() {
  const { id } = useParams();
  const { data, isLoading, isFetching, error } = useGetBracketStoryQuery(id, {
    skip: !id,
  });
  const [generateStory, { isLoading: isGenerating }] = useGenerateBracketStoryMutation();

  const doc = data?.story || null;
  const story = doc?.story || {};
  const sourceSummary = data?.sourceSummary || doc?.sourceSummary || {};
  const metrics = sourceSummary?.metrics || {};
  const tournament = sourceSummary?.tournament || {};
  const hasStory = Boolean(doc?._id);
  const busy = isLoading || isFetching || isGenerating;

  const statusChips = useMemo(
    () => [
      { label: "Bracket", value: metrics.brackets ?? 0 },
      { label: "Đăng ký", value: metrics.registrations ?? 0 },
      { label: "Trận", value: metrics.totalMatches ?? 0 },
      { label: "Đã xong", value: metrics.completedMatches ?? 0 },
      { label: "Còn lại", value: metrics.pendingMatches ?? 0 },
    ],
    [metrics]
  );

  const handleGenerate = async () => {
    try {
      const result = await generateStory({ tournamentId: id }).unwrap();
      if (result?.story?.source === "ai") {
        toast.success("Đã tạo AI Bracket Story");
      } else {
        toast.info("Đã tạo Bracket Story bằng fallback");
      }
    } catch (err) {
      toast.error(err?.data?.message || err?.error || "Không thể tạo Bracket Story");
    }
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box py={3}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between">
          <Box>
            <Typography variant="h4" fontWeight={800}>
              AI Bracket Story
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {tournament.name || "Tổng hợp câu chuyện bracket theo dữ liệu giải đấu"}
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={isGenerating ? <CircularProgress size={18} /> : <RefreshIcon />}
            onClick={handleGenerate}
            disabled={busy || !id}
          >
            {hasStory ? "Tạo lại story" : "Tạo AI Bracket Story"}
          </Button>
        </Stack>

        {busy && <LinearProgress sx={{ mt: 2 }} />}

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error?.data?.message || error?.error || "Không thể tải AI Bracket Story"}
          </Alert>
        )}

        {!hasStory && !isLoading && !error && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Chưa có story cho giải này. Bấm tạo để hệ thống đọc bracket, match và điểm số rồi dựng story.
          </Alert>
        )}

        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip
                  icon={<AutoStoriesIcon />}
                  label={doc?.source === "ai" ? "Nguồn: AI" : "Nguồn: fallback"}
                  color={doc?.source === "ai" ? "success" : "warning"}
                  size="small"
                />
                <Chip label={`Model: ${doc?.model || "Chưa chạy"}`} size="small" />
                <Chip label={`Tạo lúc: ${formatDateTime(doc?.createdAt)}`} size="small" />
              </Stack>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {statusChips.map((item) => (
                  <Chip key={item.label} label={`${item.label}: ${item.value}`} size="small" />
                ))}
              </Stack>
              {doc?.aiError && <Alert severity="warning">AI fallback: {doc.aiError}</Alert>}
            </Stack>
          </CardContent>
        </Card>

        {hasStory && (
          <>
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Typography variant="h5" fontWeight={800} gutterBottom>
                  {story.title || "AI Bracket Story"}
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  {story.summary || "Chưa có nội dung tóm tắt."}
                </Typography>
              </CardContent>
            </Card>

            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <StorySection title="Tổng quan bracket" items={story.bracketOverview} />
              </Grid>
              <Grid item xs={12} md={6}>
                <StorySection title="Điểm nhấn chính" items={story.keyHighlights} />
              </Grid>
              <Grid item xs={12} md={6}>
                <StorySection title="Hành trình nổi bật" items={story.championPath} />
              </Grid>
              <Grid item xs={12} md={6}>
                <StorySection title="Trận đáng chú ý" items={story.notableMatches} />
              </Grid>
            </Grid>

            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  Caption chia sẻ
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {story.socialCaption || "Chưa có caption."}
                </Typography>
              </CardContent>
            </Card>

            <Box mt={2}>
              <StorySection title="Ghi chú admin" items={story.adminNotes} />
            </Box>
          </>
        )}
      </Box>
      <Footer />
    </DashboardLayout>
  );
}
