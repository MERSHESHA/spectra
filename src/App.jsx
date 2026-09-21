import { BrowserRouter, Routes, Route } from "react-router-dom";

import LandingPage from "./pages/LandingPage";
import CodingPage from "./pages/CodingPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />

        <Route path="/coding" element={<CodingPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;