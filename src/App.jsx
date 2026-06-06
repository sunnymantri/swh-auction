import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { AuctionProvider } from './context/AuctionContext'
import RequireAuth from './components/common/RequireAuth'
import Landing from './pages/Landing'
import Login from './pages/Login'
import AuctionCentre from './pages/AuctionCentre'
import Dashboard from './pages/Dashboard'
import Auctions from './pages/Auctions'
import AuctionSetup from './pages/AuctionSetup'
import TeamsManagement from './pages/TeamsManagement'
import PlayersManagement from './pages/PlayersManagement'
import CategoryConfig from './pages/CategoryConfig'
import QueueManagement from './pages/QueueManagement'
import UserManagement from './pages/UserManagement'
import TeamOwnerBidding from './pages/TeamOwnerBidding'
import PublicLiveView from './pages/PublicLiveView'
import AuctionResults from './pages/AuctionResults'
import TeamSquadSummary from './pages/TeamSquadSummary'
import UnsoldReauctionQueue from './pages/UnsoldReauctionQueue'

export default function App() {
  return (
    <AuthProvider>
      <AuctionProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />

            {/* Public (no login required) */}
            <Route path="/public-live" element={<PublicLiveView />} />
            <Route path="/results" element={<AuctionResults />} />
            <Route path="/squads" element={<TeamSquadSummary />} />

            {/* Authenticated */}
            <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
            <Route path="/auctions" element={<RequireAuth><Auctions /></RequireAuth>} />
            <Route path="/setup" element={<RequireAuth><AuctionSetup /></RequireAuth>} />
            <Route path="/teams" element={<RequireAuth><TeamsManagement /></RequireAuth>} />
            <Route path="/players" element={<RequireAuth><PlayersManagement /></RequireAuth>} />
            <Route path="/categories" element={<RequireAuth><CategoryConfig /></RequireAuth>} />
            <Route path="/queue" element={<RequireAuth><QueueManagement /></RequireAuth>} />
            <Route path="/users" element={<RequireAuth><UserManagement /></RequireAuth>} />
            <Route path="/auction" element={<RequireAuth><AuctionCentre /></RequireAuth>} />
            <Route path="/team-bidding" element={<RequireAuth><TeamOwnerBidding /></RequireAuth>} />
            <Route path="/unsold" element={<RequireAuth><UnsoldReauctionQueue /></RequireAuth>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuctionProvider>
    </AuthProvider>
  )
}
