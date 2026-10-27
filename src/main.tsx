import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppTooltips } from "./components/AppTooltips";
import { App } from "./App";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <AppTooltips />
  </StrictMode>,
);
