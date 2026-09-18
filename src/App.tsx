import { Navigate, Route, Routes } from 'react-router-dom'
import { InvitationProvider } from './invitation/InvitationContext'
import { OpeningExperience } from './components/OpeningExperience'
import { InvitationPage } from './pages/InvitationPage'
import { AdminApp } from './admin/AdminApp'
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
      <Route path="/admin/*" element={<AdminApp />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
