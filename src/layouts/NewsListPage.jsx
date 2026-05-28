import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Grid,
  Card,
  CardActionArea,
  CardContent,
  Typography,
  Chip,
  Stack,
  CircularProgress,
  Button,
  TextField,
  FormControlLabel,
  Switch,
  Alert,
} from "@mui/material";
import {
  useGenerateNewsArticlesMutation,
  useGetNewsListQuery,
} from "slices/newsApiSlice";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import PropTypes from "prop-types";

const formatDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

// Ảnh + placeholder, luôn giữ đúng chiều cao, không cho tràn card
const NewsImage = ({ src, alt }) => {
  const [failed, setFailed] = useState(false);

  const hasImage = !!src && !failed;

  if (!hasImage) {
    return (
      <Box
        sx={{
          height: 160,
          width: "100%",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "background.default",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Không có ảnh
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      component="img"
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      sx={{
        height: 160,
        width: "100%",
        flexShrink: 0,
        display: "block",
        objectFit: "cover",
      }}
    />
  );
};

const NewsListPage = () => {
  const navigate = useNavigate();
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(1);
  const [publish, setPublish] = useState(true);
  const [generateResult, setGenerateResult] = useState(null);

  const { data, isLoading, isError, error, refetch } = useGetNewsListQuery(30); // lấy 30 bài mới nhất
  const [generateNewsArticles, { isLoading: isGenerating }] = useGenerateNewsArticlesMutation();

  const handleGenerate = async () => {
    setGenerateResult(null);
    try {
      const res = await generateNewsArticles({
        topic: topic.trim(),
        count: Number(count) || 1,
        publish,
      }).unwrap();
      setGenerateResult({
        type: "success",
        message: `Đã tạo ${res?.generated || 0}/${res?.requested || 0} bài AI.`,
      });
      await refetch();
    } catch (err) {
      setGenerateResult({
        type: "error",
        message: err?.data?.message || err?.error || "Không tạo được bài AI.",
      });
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  if (isError) {
    return (
      <Box p={3}>
        <Typography color="error">
          Lỗi tải danh sách tin tức: {error?.data?.message || error?.error || "Không xác định"}
        </Typography>
      </Box>
    );
  }

  const items = data || [];

  return (
    <DashboardLayout>
      <DashboardNavbar />

      <Box p={3}>
        <Typography variant="h4" fontWeight={600} mb={2}>
          Tin tức PickleTour
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          Tổng hợp các bài viết liên quan pickleball, giải đấu và hệ sinh thái PickleTour (đã chọn
          lọc tự động).
        </Typography>

        <Card variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Stack spacing={1.5}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1.5}
              alignItems={{ xs: "stretch", md: "center" }}
            >
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle1" fontWeight={600}>
                  Tự tạo bài AI
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Dùng gateway OpenAI-compatible tại port 8317 để tạo bài PickleTour.
                </Typography>
              </Box>
              <TextField
                size="small"
                label="Chủ đề"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Để trống để hệ thống tự chọn"
                sx={{ minWidth: { xs: "100%", md: 300 } }}
              />
              <TextField
                size="small"
                label="Số bài"
                type="number"
                value={count}
                onChange={(e) =>
                  setCount(Math.max(1, Math.min(Number(e.target.value) || 1, 5)))
                }
                inputProps={{ min: 1, max: 5 }}
                sx={{ width: { xs: "100%", md: 100 } }}
              />
              <FormControlLabel
                control={
                  <Switch checked={publish} onChange={(e) => setPublish(e.target.checked)} />
                }
                label="Đăng ngay"
                sx={{ m: 0, whiteSpace: "nowrap" }}
              />
              <Button variant="contained" onClick={handleGenerate} disabled={isGenerating}>
                {isGenerating ? "Đang tạo..." : "Tạo bài"}
              </Button>
            </Stack>
            {generateResult && (
              <Alert severity={generateResult.type}>{generateResult.message}</Alert>
            )}
          </Stack>
        </Card>

        {items.length === 0 && <Typography>Chưa có bài viết nào được xuất bản.</Typography>}

        <Grid container spacing={2}>
          {items.map((article) => {
            const imgSrc = article.thumbImageUrl || article.heroImageUrl;

            return (
              <Grid item key={article.slug} xs={12} sm={6} md={4} xl={3}>
                <Card
                  variant="outlined"
                  sx={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden", // chặn ảnh tràn ra ngoài
                  }}
                >
                  <CardActionArea
                    onClick={() => navigate(`/news/${article.slug}`)}
                    sx={{
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "stretch",
                    }}
                  >
                    {/* Ảnh / placeholder */}
                    <NewsImage src={imgSrc} alt={article.title} />

                    <CardContent sx={{ flexGrow: 1, width: "100%" }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom noWrap>
                        {article.sourceName || "Nguồn tổng hợp"} •{" "}
                        {formatDate(article.originalPublishedAt || article.createdAt)}
                      </Typography>

                      <Typography
                        variant="h6"
                        fontSize={16}
                        fontWeight={600}
                        gutterBottom
                        sx={{
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {article.title}
                      </Typography>

                      {article.summary && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            mt: 0.5,
                            display: "-webkit-box",
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {article.summary}
                        </Typography>
                      )}

                      {article.tags && article.tags.length > 0 && (
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" mt={1.5}>
                          {article.tags.slice(0, 3).map((tag) => (
                            <Chip key={tag} label={tag} size="small" sx={{ fontSize: 10 }} />
                          ))}
                        </Stack>
                      )}
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Box>
    </DashboardLayout>
  );
};

export default NewsListPage;

NewsImage.propTypes = {
  src: PropTypes.string,
  alt: PropTypes.string,
};
