import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router"
import { FrappeProvider } from "frappe-react-sdk"
import { Toaster } from "sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ThemeProvider } from "@/components/theme-provider"
import { ReloadPrompt } from "@/components/ReloadPrompt"
import { cleanupLegacyServiceWorker } from "@/lib/cleanup-legacy-sw"
import "./index.css"
import App from "./App"

void cleanupLegacyServiceWorker()

// The socket.io namespace must equal the Frappe site name, or the connection is
// rejected with "Invalid namespace" and no realtime event ever arrives. Frappe
// renders it into the served HTML; under `vite dev` the jinja tag is left
// unrendered, so fall back to the hostname.
const injectedSiteName = (window as unknown as { site_name?: string }).site_name
const siteName =
  injectedSiteName && !injectedSiteName.includes("{{") ? injectedSiteName : window.location.hostname

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FrappeProvider siteName={siteName}>
      <ThemeProvider defaultTheme="system" storageKey="vms-ui-theme">
        <TooltipProvider>
          <BrowserRouter basename="/vms">
            <App />
            <Toaster position="top-right" />
            <ReloadPrompt />
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </FrappeProvider>
  </StrictMode>
)
