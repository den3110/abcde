import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Card from "@mui/material/Card";
import Switch from "@mui/material/Switch";

import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import MDTypography from "components/MDTypography";

import BasicLayout from "../components/BasicLayout";
import bgImage from "assets/images/bg-sign-in-basic.jpeg";

import { useDispatch } from "react-redux";
import { authApiSlice, useLoginMutation } from "slices/authApiSlice";
import { setCredentials } from "slices/authSlice";

export default function SignIn() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [remember, setRemember] = useState(false);
  const [login, { isLoading }] = useLoginMutation();
  const [error, setError] = useState("");
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/dashboard";

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    try {
      const { user, token } = await login(form).unwrap();
      const userInfo = { ...user, token };

      dispatch(setCredentials({ user, token }));
      dispatch(
        authApiSlice.util.upsertQueryData("verify", undefined, {
          user,
          token,
        })
      );

      if (remember) {
        localStorage.setItem("userInfo", JSON.stringify(userInfo));
      }

      const roles = new Set([
        ...(Array.isArray(user?.roles) ? user.roles : []),
        ...(user?.role ? [user.role] : []),
      ]);
      if (user?.isAdmin) roles.add("admin");

      const isAdmin = roles.has("admin");
      const isReferee = roles.has("referee");
      const redirectTo = isReferee && !isAdmin ? "/referee/matches" : from;

      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err?.data?.message || "Login failed");
    }
  };

  return (
    <BasicLayout image={bgImage}>
      <Card>
        <MDBox
          variant="gradient"
          bgColor="info"
          borderRadius="lg"
          mx={2}
          mt={-3}
          p={2}
          mb={1}
          textAlign="center"
        >
          <MDTypography variant="h4" color="white">
            Admin Sign In
          </MDTypography>
        </MDBox>

        <MDBox pt={4} pb={3} px={3}>
          {error ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          ) : null}

          <MDBox component="form" onSubmit={submit}>
            <MDBox mb={2}>
              <MDInput
                type="email"
                label="Email"
                fullWidth
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                required
              />
            </MDBox>

            <MDBox mb={2}>
              <MDInput
                type="password"
                label="Password"
                fullWidth
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                required
              />
            </MDBox>

            <MDBox display="flex" alignItems="center" ml={-1}>
              <Switch checked={remember} onChange={() => setRemember((prev) => !prev)} />
              <MDTypography
                variant="button"
                color="text"
                onClick={() => setRemember((prev) => !prev)}
                sx={{ cursor: "pointer", userSelect: "none", ml: -1 }}
              >
                &nbsp;&nbsp;Remember me
              </MDTypography>
            </MDBox>

            <MDBox mt={4} mb={1}>
              <MDButton
                variant="gradient"
                color="info"
                fullWidth
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </MDButton>
            </MDBox>
          </MDBox>
        </MDBox>
      </Card>
    </BasicLayout>
  );
}
