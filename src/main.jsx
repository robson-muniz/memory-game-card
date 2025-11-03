import React from "react";
import ReactDOM from "react-dom/client";
import MemoryGame from "./App.jsx"; // ✅ Fixed import path
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <MemoryGame />
    </React.StrictMode>
);