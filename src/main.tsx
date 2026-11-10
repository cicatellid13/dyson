import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppTooltips } from "./components/AppTooltips";
import { App } from "./App";
import "./styles/global.css";
import { useWorkspace } from "./lib/persistence";
function ProfileRoot(){const {profileId}=useWorkspace();return <><App key={profileId}/><AppTooltips key={`${profileId}-tooltips`}/></>;}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ProfileRoot />
  </StrictMode>,
);
