import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import EditorPage from "./pages/EditorPage";
import PracticeList from "./pages/PracticeList";
import PracticeProblem from "./pages/PracticeProblem";
import Auth from "./pages/Auth";
import ProtectedRoute from "./components/ProtectedRoute";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Auth />} />
        <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/editor/:roomId" element={<ProtectedRoute><EditorPage /></ProtectedRoute>} />
        <Route path="/practice" element={<ProtectedRoute><PracticeList /></ProtectedRoute>} />
        <Route path="/practice/:id" element={<ProtectedRoute><PracticeProblem /></ProtectedRoute>} />
        
        {/* Fallback routing */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;