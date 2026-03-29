/**
=========================================================
* PickleTour React - v2.2.0
=========================================================

* Product Page: https://www.creative-tim.com/product/material-dashboard-react
* Copyright 2023 Creative Tim (https://www.creative-tim.com)

Coded by www.creative-tim.com

 =========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
*/

// PickleTour React base styles
import borders from "assets/theme/base/borders";
import colors from "assets/theme/base/colors";

// PickleTour React helper functions
import pxToRem from "assets/theme/functions/pxToRem";

const { borderRadius } = borders;
const { light } = colors;

const linearProgress = {
  styleOverrides: {
    root: {
      height: pxToRem(6),
      borderRadius: borderRadius.md,
      // MUI uses overflow:hidden + transform:translateX to clip the bar.
      // overflow:visible breaks this — the bar appears full width regardless
      // of value because the shifted portion is not clipped.
      overflow: "hidden",
      position: "relative",
    },

    colorPrimary: {
      backgroundColor: light.main,
    },

    colorSecondary: {
      backgroundColor: light.main,
    },

    bar: {
      height: pxToRem(6),
      borderRadius: borderRadius.sm,
      // Do NOT override transform or position — MUI handles these
      // natively via transform: translateX(value - 100%) for determinate.
      transition: "transform 0.6s ease !important",
    },
  },
};

export default linearProgress;
