// Material Dashboard 2 React layouts
import Dashboard from "layouts/dashboard";
import Tables from "layouts/tables";
import Billing from "layouts/billing";
import RTL from "layouts/rtl";
import Notifications from "layouts/notifications";
import Profile from "layouts/profile";
import SignIn from "layouts/authentication/sign-in";
import SignUp from "layouts/authentication/sign-up";
import UserManagement from "layouts/user/UserListPage";

/* 🆕 Admin tournament pages */

// @mui icons
import Icon from "@mui/material/Icon";
import TournamentFormPage from "layouts/tournament/TournamentFormPage";
import TournamentsListPage from "layouts/tournament/TournamentsListPage";
import AdminTournamentRegistrations from "layouts/tournament/AdminTournamentRegistrations";

const routes = [
  {
    type: "collapse",
    name: "Dashboard",
    key: "dashboard",
    icon: <Icon fontSize="small">dashboard</Icon>,
    route: "/dashboard",
    component: <Dashboard />,
    private: true,
  },

  /* ---------- AUTH (ẩn) ---------- */
  {
    show: false,
    type: "collapse",
    name: "Sign In",
    key: "sign-in",
    icon: <Icon fontSize="small">login</Icon>,
    route: "/authentication/sign-in",
    component: <SignIn />,
  },
  {
    show: false,
    type: "collapse",
    name: "Sign Up",
    key: "sign-up",
    icon: <Icon fontSize="small">assignment</Icon>,
    route: "/authentication/sign-up",
    component: <SignUp />,
  },

  /* ---------- User management ---------- */
  {
    type: "collapse",
    name: "User Management",
    key: "user-management",
    icon: <Icon fontSize="small">people</Icon>,
    route: "/users",
    component: <UserManagement />,
    private: true,
  },

  /* ---------- 🆕 Tournaments ---------- */
  {
    type: "collapse",
    name: "Tournaments",
    key: "tournaments",
    icon: <Icon fontSize="small">emoji_events</Icon>,
    route: "/admin/tournaments",
    component: <TournamentsListPage />,
    private: true,
  },

  {
    show: false, // không hiện sidebar
    type: "collapse",
    name: "Create Tournament",
    key: "tournament-new",
    route: "/admin/tournaments/new",
    component: <TournamentFormPage />,
    private: true,
  },
  {
    show: false,
    type: "collapse",
    name: "Edit Tournament",
    key: "tournament-edit",
    route: "/admin/tournaments/:id/edit",
    component: <TournamentFormPage />,
    private: true,
  },
  {
    show: false, // ẩn khỏi sidebar
    type: "collapse",
    name: "Registrations",
    key: "tournament-registrations",
    route: "/admin/tournaments/:id/registrations",
    component: <AdminTournamentRegistrations />,
    private: true,
  },
];

export default routes;
