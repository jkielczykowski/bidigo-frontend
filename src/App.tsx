import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { RedirectAuction, RedirectAuctionEdit, RedirectMessage } from './components/LegacyRedirects'
import { Layout } from './components/Layout'
import { ScrollManager } from './components/ScrollManager'
import { AuthProvider } from './lib/auth'
import { FeaturesProvider } from './lib/features'
import { NotificationsProvider } from './lib/notifications'
import { UnreadMessagesProvider } from './lib/unreadMessages'
import { LandingPage } from './pages/LandingPage'
import './index.css'

// The home page ships in the main bundle; every other page loads when first visited
const page = <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })))

const AuctionDetailPage = page(() => import('./pages/AuctionDetailPage'), 'AuctionDetailPage')
const CreateAuctionPage = page(() => import('./pages/CreateAuctionPage'), 'CreateAuctionPage')
const VerifyPhonePage = page(() => import('./pages/VerifyPhonePage'), 'VerifyPhonePage')
const EditAuctionPage = page(() => import('./pages/EditAuctionPage'), 'EditAuctionPage')
const HomePage = page(() => import('./pages/HomePage'), 'HomePage')
const MessagesPage = page(() => import('./pages/MessagesPage'), 'MessagesPage')
const MyActivityPage = page(() => import('./pages/MyActivityPage'), 'MyActivityPage')
const MyBiddingPage = page(() => import('./pages/MyBiddingPage'), 'MyBiddingPage')
const MyFeesPage = page(() => import('./pages/MyFeesPage'), 'MyFeesPage')
const MyHubPage = page(() => import('./pages/MyHubPage'), 'MyHubPage')
const MySellingPage = page(() => import('./pages/MySellingPage'), 'MySellingPage')
const NotificationsPage = page(() => import('./pages/NotificationsPage'), 'NotificationsPage')
const ProfileSettingsPage = page(() => import('./pages/ProfileSettingsPage'), 'ProfileSettingsPage')
const LoginPage = page(() => import('./pages/AuthPages'), 'LoginPage')
const RegisterPage = page(() => import('./pages/AuthPages'), 'RegisterPage')
const PrivacyPolicyPage = page(() => import('./pages/LegalPages'), 'PrivacyPolicyPage')
const TermsPage = page(() => import('./pages/LegalPages'), 'TermsPage')
const SupportPage = page(() => import('./pages/LegalPages'), 'SupportPage')
const AccountDeletionPage = page(() => import('./pages/LegalPages'), 'AccountDeletionPage')

export default function App() {
  return (
    <FeaturesProvider>
      <AuthProvider>
        <UnreadMessagesProvider>
          <NotificationsProvider>
            <BrowserRouter>
              <ScrollManager />
              <Layout>
                <Suspense fallback={<div className="page-loading" aria-busy="true" />}>
                <Routes>
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/auctions" element={<HomePage />} />
                  <Route path="/auction/:id" element={<AuctionDetailPage />} />
                  <Route path="/auction/:id/edit" element={<EditAuctionPage />} />
                  <Route path="/sell" element={<CreateAuctionPage />} />
                  <Route path="/verify-phone" element={<VerifyPhonePage />} />
                  <Route path="/my" element={<MyHubPage />} />
                  <Route path="/my/selling" element={<MySellingPage />} />
                  <Route path="/my/bidding" element={<MyBiddingPage />} />
                  <Route path="/my/fees" element={<MyFeesPage />} />
                  <Route path="/my/activity" element={<MyActivityPage />} />
                  <Route path="/notifications" element={<NotificationsPage />} />
                  <Route path="/settings" element={<ProfileSettingsPage />} />
                  <Route path="/messages" element={<MessagesPage />} />
                  <Route path="/messages/:id" element={<MessagesPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/privacy" element={<PrivacyPolicyPage />} />
                  <Route path="/terms" element={<TermsPage />} />
                  <Route path="/pomoc" element={<SupportPage />} />
                  <Route path="/support" element={<SupportPage />} />
                  <Route path="/usun-konto" element={<AccountDeletionPage />} />
                  <Route path="/delete-account" element={<AccountDeletionPage />} />

                  <Route path="/aukcje" element={<Navigate to="/auctions" replace />} />
                  <Route path="/aukcja/:id" element={<RedirectAuction />} />
                  <Route path="/aukcja/:id/edycja" element={<RedirectAuctionEdit />} />
                  <Route path="/wystaw" element={<Navigate to="/sell" replace />} />
                  <Route path="/moje" element={<Navigate to="/my" replace />} />
                  <Route path="/moje/aukcje" element={<Navigate to="/my/selling" replace />} />
                  <Route path="/moje/licytuje" element={<Navigate to="/my/bidding" replace />} />
                  <Route path="/moje/oplaty" element={<Navigate to="/my/fees" replace />} />
                  <Route path="/moje/aktywnosc" element={<Navigate to="/my/activity" replace />} />
                  <Route path="/powiadomienia" element={<Navigate to="/notifications" replace />} />
                  <Route path="/ustawienia" element={<Navigate to="/settings" replace />} />
                  <Route path="/wiadomosci" element={<Navigate to="/messages" replace />} />
                  <Route path="/wiadomosci/:id" element={<RedirectMessage />} />
                  <Route path="/logowanie" element={<Navigate to="/login" replace />} />
                  <Route path="/rejestracja" element={<Navigate to="/register" replace />} />
                  <Route path="/prywatnosc" element={<Navigate to="/privacy" replace />} />
                  <Route path="/regulamin" element={<Navigate to="/terms" replace />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
                </Suspense>
              </Layout>
            </BrowserRouter>
          </NotificationsProvider>
        </UnreadMessagesProvider>
      </AuthProvider>
    </FeaturesProvider>
  )
}
