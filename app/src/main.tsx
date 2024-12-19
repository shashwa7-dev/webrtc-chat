import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { SocketContextProvider } from "./context/socket.tsx";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "./components/ui/sonner.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SocketContextProvider>
      <BrowserRouter>
        <App />
        <Toaster position="top-right" theme="light" />
      </BrowserRouter>
    </SocketContextProvider>
  </StrictMode>
);
