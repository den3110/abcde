// src/routes.js
import Dashboard from "layouts/dashboard";
import Tables from "layouts/tables";
import Billing from "layouts/billing";
import RTL from "layouts/rtl";
import Notifications from "layouts/notifications";
import Profile from "layouts/profile";
import SignIn from "layouts/authentication/sign-in";
import SignUp from "layouts/authentication/sign-up";
import UserManagement from "layouts/user/UserListPage";

// 🆕 Trang quản trị giải đấu
import TournamentsListPage from "layouts/tournament/TournamentsListPage";
import TournamentFormPage from "layouts/tournament/TournamentFormPage";
import AdminTournamentRegistrations from "layouts/tournament/AdminTournamentRegistrations";
import AdminBracketsPage from "layouts/tournament/AdminBracketsPage";

// 🆕 Trận đấu (admin)
import AdminMatchesList from "layouts/match/AdminMatchesList";

// 🆕 Trọng tài
import Icon from "@mui/material/Icon";
import AdminTournamentMatches from "layouts/tournament/AdminTournamentMatches";
import TournamentBracketView from "layouts/tournament/TournamentBracketView";
import AdminRefereeConsole from "layouts/tournament/referee/AdminRefereeConsole";
import RefereeMatches from "layouts/tournament/referee/RefereeMatches";

// 🆕 Cấu hình thuật toán bốc thăm (Admin)
import AlgoSettingsPage from "layouts/tournament/AlgoSettingsPage"; // <— THÊM DÒNG NÀY
// nếu bạn đặt file ở "pages/admin/AlgoSettingsPage.jsx" thì đổi import cho đúng

const routes = [
  // Dashboard
  {
    type: "collapse",
    name: "Bảng điều khiển",
    key: "dashboard",
    icon: <Icon fontSize="small">dashboard</Icon>,
    route: "/dashboard",
    component: <Dashboard />,
    private: true,
  },

  // Xác thực (ẩn)
  {
    show: false,
    type: "collapse",
    name: "Đăng nhập",
    key: "sign-in",
    icon: <Icon fontSize="small">login</Icon>,
    route: "/authentication/sign-in",
    component: <SignIn />,
  },
  {
    show: false,
    type: "collapse",
    name: "Đăng ký",
    key: "sign-up",
    icon: <Icon fontSize="small">assignment</Icon>,
    route: "/authentication/sign-up",
    component: <SignUp />,
  },

  // Quản lý người dùng (Admin)
  {
    type: "collapse",
    name: "Quản lý người dùng",
    key: "user-management",
    icon: <Icon fontSize="small">people</Icon>,
    route: "/users",
    component: <UserManagement />,
    private: true,
    roles: ["admin"],
  },

  // Giải đấu (Admin)
  {
    type: "collapse",
    name: "Giải đấu",
    key: "tournaments",
    icon: <Icon fontSize="small">emoji_events</Icon>,
    route: "/admin/tournaments",
    component: <TournamentsListPage />,
    private: true,
    roles: ["admin"],
  },
  {
    show: false,
    type: "collapse",
    name: "Tạo giải đấu",
    key: "tournament-new",
    route: "/admin/tournaments/new",
    component: <TournamentFormPage />,
    private: true,
    roles: ["admin"],
  },
  {
    show: false,
    type: "collapse",
    name: "Sửa giải đấu",
    key: "tournament-edit",
    route: "/admin/tournaments/:id/edit",
    component: <TournamentFormPage />,
    private: true,
    roles: ["admin"],
  },
  {
    show: false,
    type: "collapse",
    name: "Danh sách đăng ký",
    key: "tournament-registrations",
    route: "/admin/tournaments/:id/registrations",
    component: <AdminTournamentRegistrations />,
    private: true,
    roles: ["admin"],
  },

  // Nhánh/Bảng đấu theo giải (Admin)
  {
    show: false,
    type: "collapse",
    name: "Nhánh/Bảng đấu",
    key: "tournament-brackets",
    route: "/admin/tournaments/:id/brackets",
    component: <AdminBracketsPage />,
    private: true,
    roles: ["admin"],
  },

  // Trận đấu (Admin)
  {
    type: "collapse",
    name: "Trận đấu",
    key: "admin-matches",
    icon: <Icon fontSize="small">sports_tennis</Icon>,
    route: "/admin/matches",
    component: <AdminMatchesList />,
    private: true,
    roles: ["admin"],
  },

  // 🆕 Tham số thuật toán (Admin)
  {
    type: "collapse",
    name: "Tham số thuật toán",
    key: "algo-settings",
    icon: <Icon fontSize="small">tune</Icon>,
    route: "/admin/algo-settings",
    component: <AlgoSettingsPage />,
    private: true,
    roles: ["admin"],
  },

  // Màn hình cho trọng tài và các view liên quan
  {
    show: false,
    type: "collapse",
    name: "Trận đấu của giải",
    key: "tournament-matches",
    route: "/admin/tournaments/:id/matches",
    component: <AdminTournamentMatches />,
    private: true,
    roles: ["admin"],
  },
  {
    show: false,
    type: "collapse",
    name: "Xem sơ đồ nhánh",
    key: "tournament-bracket-view",
    route: "/admin/tournaments/:id/bracket",
    component: <TournamentBracketView />,
    private: true,
    roles: ["admin"],
  },
  {
    show: false,
    type: "collapse",
    name: "Bảng điều khiển trọng tài (Trận)",
    key: "admin-referee-console-match",
    route: "/admin/referee/matches/:matchId",
    component: <AdminRefereeConsole />,
    private: true,
    roles: ["admin", "referee"],
  },
  {
    show: false,
    type: "collapse",
    name: "Bảng điều khiển trọng tài",
    key: "admin-referee-console",
    route: "/admin/referee/console",
    component: <AdminRefereeConsole />,
    private: true,
    roles: ["admin", "referee"],
  },
  {
    type: "collapse",
    name: "Trọng tài",
    key: "referee-matches",
    icon: <Icon fontSize="small">sports_score</Icon>,
    route: "/referee/matches",
    component: <RefereeMatches />,
    private: true,
    roles: ["referee"],
  },
];

export default routes;
