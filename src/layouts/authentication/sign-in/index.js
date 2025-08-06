import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Switch from "@mui/material/Switch";
import Alert from "@mui/material/Alert";

import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDInput from "components/MDInput";
import MDButton from "components/MDButton";

import BasicLayout from "../components/BasicLayout";
import bgImage from "assets/images/bg-sign-in-basic.jpeg";

import { useDispatch } from "react-redux";
import { useLoginMutation } from "slices/authApiSlice";
import { setUser } from "slices/authSlice";

export default function SignIn() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [remember, setRemember] = useState(false);
  const [login, { isLoading }] = useLoginMutation();
  const [error, setError] = useState("");
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/dashboard";

  // LoginScreen.jsx (trích phần submit handler)
  const submit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      // BE trả { user, token }
      const { user, token } = await login(form).unwrap();

      // Gom lại object duy nhất để tiện lưu trữ
      const userInfo = { ...user, token };

      // Lưu vào Redux
      dispatch(setCredentials({ user, token })); // ⬅️ action mới

      // Tuỳ chọn nhớ phiên
      if (remember) localStorage.setItem("userInfo", JSON.stringify(userInfo));

      // Điều hướng
      navigate(from, { replace: true });
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
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <MDBox component="form" onSubmit={submit}>
            <MDBox mb={2}>
              <MDInput
                type="email"
                label="Email"
                fullWidth
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </MDBox>
            <MDBox mb={2}>
              <MDInput
                type="password"
                label="Password"
                fullWidth
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                required
              />
            </MDBox>

            <MDBox display="flex" alignItems="center" ml={-1}>
              <Switch checked={remember} onChange={() => setRemember(!remember)} />
              <MDTypography
                variant="button"
                color="text"
                onClick={() => setRemember(!remember)}
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
                {isLoading ? "Signing in…" : "Sign In"}
              </MDButton>
            </MDBox>
          </MDBox>
        </MDBox>
      </Card>
    </BasicLayout>
  );
}
