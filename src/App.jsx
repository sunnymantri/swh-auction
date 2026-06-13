import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { AuctionProvider } from './context/AuctionContext'
import RequireAuth from './components/common/RequireAuth'
import RequirePublicAuth from './components/common/RequirePublicAuth'
import Landing from './pages/Landing'
import Login from './pages/Login'
import AuctionCentre from './pages/AuctionCentre'
import Auctions from './pages/Auctions'
import TeamsManagement from './pages/TeamsManagement'
import PlayersManagement from './pages/PlayersManagement'
import QueueManagement from './pages/QueueManagement'
import UserManagement from './pages/UserManagement'
import TeamOwnerBidding from './pages/TeamOwnerBidding'
import PublicLiveView from './pages/PublicLiveView'
import AuctionResults from './pages/AuctionResults'
import VacationForm from './pages/VacationForm'
import VacationResponses from './pages/VacationResponses'
import TeamSquadSummary from './pages/TeamSquadSummary'

export default function App() {
  return (
    <AuthProvider>
      <AuctionProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />

            {/* Public (no login required, but may require access code) */}
            <Route path="/public-live" element={<RequirePublicAuth><PublicLiveView /></RequirePublicAuth>} />
            <Route path="/results" element={<RequirePublicAuth><AuctionResults /></RequirePublicAuth>} />
            <Route path="/vacation" element={<VacationForm />} />

            {/* Authenticated */}
            <Route path="/auctions" element={<RequireAuth><Auctions /></RequireAuth>} />
            <Route path="/teams" element={<RequireAuth><TeamsManagement /></RequireAuth>} />
            <Route path="/players" element={<RequireAuth><PlayersManagement /></RequireAuth>} />
            <Route path="/queue" element={<RequireAuth><QueueManagement /></RequireAuth>} />
            <Route path="/users" element={<RequireAuth><UserManagement /></RequireAuth>} />
            <Route path="/auction" element={<RequireAuth><AuctionCentre /></RequireAuth>} />
            <Route path="/team-bidding" element={<RequireAuth><TeamOwnerBidding /></RequireAuth>} />
            <Route path="/squads" element={<RequireAuth><TeamSquadSummary /></RequireAuth>} />
            <Route path="/vacation-responses" element={<RequireAuth><VacationResponses /></RequireAuth>} />

            {/* Redirects from removed routes */}
            <Route path="/setup" element={<Navigate to="/auctions" replace />} />
            <Route path="/categories" element={<Navigate to="/players" replace />} />
            <Route path="/unsold" element={<Navigate to="/queue" replace />} />
            <Route path="/dashboard" element={<Navigate to="/auctions" replace />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuctionProvider>
    </AuthProvider>
  )
}
