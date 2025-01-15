import ReactDOM from "react-dom/client";
// import React from 'react';
import App from "./App";
import { FlashbarProvider } from "./components/notifications";

const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(
    // <React.StrictMode>
    <FlashbarProvider>
        <App />
    </FlashbarProvider>
    // </React.StrictMode>
);
