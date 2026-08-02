import { Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import MatcherPage from "./pages/MatcherPage";
import ExplorerPage from "./pages/ExplorerPage";
import TrendsPage from "./pages/TrendsPage";

export default function App() {
  const location = useLocation();

  return (
    <>
      <Navbar />
      <div key={location.pathname} className="page-transition-wrapper">
        <Routes location={location}>
          <Route path="/" element={<MatcherPage />} />
          <Route path="/explore" element={<ExplorerPage />} />
          <Route path="/trends" element={<TrendsPage />} />
        </Routes>
      </div>
    </>
  );
}

