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
} from "@mui/material";
import { useGetNewsListQuery } from "slices/newsApiSlice";
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
