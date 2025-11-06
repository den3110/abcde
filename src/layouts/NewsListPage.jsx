import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Grid,
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  Typography,
  Chip,
  Stack,
  CircularProgress,
} from "@mui/material";
import { useGetNewsListQuery } from "slices/newsApiSlice";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

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

const NewsListPage = () => {
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useGetNewsListQuery(30); // lấy 30 bài mới nhất

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

        {items.length === 0 && <Typography>Chưa có bài viết nào được xuất bản.</Typography>}

        <Grid container spacing={2}>
          {items.map((article) => (
            <Grid item key={article.slug} xs={12} sm={6} md={4} xl={3}>
              <Card
                variant="outlined"
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <CardActionArea
                  onClick={() => navigate(`/news/${article.slug}`)}
                  sx={{ height: "100%" }}
                >
                  {article.thumbImageUrl || article.heroImageUrl ? (
                    <CardMedia
                      component="img"
                      sx={{ height: 160 }}
                      image={article.thumbImageUrl || article.heroImageUrl}
                      alt={article.title}
                    />
                  ) : null}

                  <CardContent>
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
          ))}
        </Grid>
      </Box>
    </DashboardLayout>
  );
};

export default NewsListPage;
