import { Navigate, Route, Routes } from 'react-router-dom'
import { InvitationProvider } from './invitation/InvitationContext'
import { OpeningExperience } from './components/OpeningExperience'
import { InvitationPage } from './pages/InvitationPage'
import { MomentsPage } from './pages/MomentsPage'
import { AdminApp } from './admin/AdminApp'
import { LiveDashboard } from './live/LiveDashboard'
import './index.css'

function DemoInvitation() {
  return (
    <InvitationProvider>
      <OpeningExperience />
    </InvitationProvider>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<DemoInvitation />} />
      <Route path="/i/:token" element={<InvitationPage />} />
      <Route path="/moments" element={<MomentsPage />} />
      <Route path="/admin/*" element={<AdminApp />} />
      <Route path="/live" element={<LiveDashboard />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
