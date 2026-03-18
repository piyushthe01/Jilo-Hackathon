import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Patients from "./pages/Patients";
import Alerts from "./pages/Alerts";
import Followups from "./pages/Followups";
import AiFollowup from "./pages/AiFollowup";
import WorkflowBuilder from "./pages/WorkflowBuilder";
import MedicalInbox from "./pages/MedicalInbox";
import DiseaseDetection from "./pages/DiseaseDetection";
import AutomatedCalls from "./pages/AutomatedCalls";
import theme from "./theme";

function App() {
  return (
    <BrowserRouter>
      <div
        className="app-shell"
        style={{ backgroundColor: theme.colors.background }}
      >
        <Sidebar />

        <main className="app-main">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/patients" element={<Patients />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/followups" element={<Followups />} />
            <Route path="/ai-followup" element={<AiFollowup />} />
            <Route path="/workflow-builder" element={<WorkflowBuilder />} />
            <Route path="/medical-inbox" element={<MedicalInbox />} />
            <Route path="/disease-detection" element={<DiseaseDetection />} />
            <Route path="/automated-calls" element={<AutomatedCalls />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
