import React from "react";
import ReactDOM from "react-dom/client";
import { perfMark } from "./performance";
import "./index.css";
import App from "./App.tsx";

perfMark('main-start');
ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
perfMark('react-mounted');
