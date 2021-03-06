// vendors
import { contextBridge, ipcRenderer } from "electron";
// project
import { createLogger } from "@podman-desktop-companion/logger";
import { bridge } from "@podman-desktop-companion/container-app";
// locals
// Using worker to avoid users perceive the app as stuck during long operations
import { userConfiguration, osType, version, environment } from "./configuration";

async function main() {
  const logger = createLogger("preload");
  logger.debug("Starting renderer process");
  process.once("loaded", () => {
    // Expose to application
    contextBridge.exposeInMainWorld(
      "nativeBridge",
      bridge.createContext({ ipcRenderer, userConfiguration, osType, version, environment })
    );
  });
  // Wait for window to bbe ready
  window.addEventListener("DOMContentLoaded", () => {
    const replaceText = (selector: any, text: any) => {
      const element = document.getElementById(selector);
      if (element) element.innerText = text;
    };
    for (const type of ["chrome", "node", "electron"]) {
      replaceText(`${type}-version`, process.versions[type]);
    }
  });
}

main();
