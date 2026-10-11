import { Routes, Route } from "react-router-dom";
import { Welcome } from "./pages/Welcome";
import { Play } from "./pages/Play";
import { Wall } from "./pages/Wall";
import { Host } from "./pages/Host";
import { NotFound } from "./pages/NotFound";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Welcome />} />
      <Route path="/play" element={<Play />} />
      <Route path="/wall" element={<Wall />} />
      <Route path="/host" element={<Host />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}