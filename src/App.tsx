import { Routes, Route } from "react-router-dom";
import { Welcome } from "./pages/Welcome";
import { Survey } from "./pages/Survey";
import { Host } from "./pages/Host";
import { NotFound } from "./pages/NotFound";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Welcome />} />
      <Route path="/survey" element={<Survey />} />
      <Route path="/host" element={<Host />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}