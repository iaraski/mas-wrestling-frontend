import { createTheme, CssBaseline, ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';
import Applications from './pages/ApplicationList';
import AuthVerified from './pages/AuthVerified';
import BracketView from './pages/BracketView';
import CompetitionCreate from './pages/CompetitionCreate';
import CompetitionDetails from './pages/CompetitionDetails';
import CompetitionExecution from './pages/CompetitionExecution';
import Competitions from './pages/CompetitionList';
import Login from './pages/Login';
import UserDashboard from './pages/UserDashboard';
import UserManagement from './pages/UserManagement';

const queryClient = new QueryClient();

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#9c27b0',
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <Router>
            <Routes>
              <Route path='/login' element={<Login />} />
              <Route path='/auth/verified' element={<AuthVerified />} />

              <Route element={<ProtectedRoute />}>
                <Route element={<Layout />}>
                  {/* Admin Routes */}
                  <Route path='/' element={<Competitions />} />
                  <Route path='/competitions' element={<Competitions />} />
                  <Route path='/competitions/create' element={<CompetitionCreate />} />
                  <Route path='/competitions/:compId/edit' element={<CompetitionCreate />} />
                  <Route path='/competitions/:compId' element={<CompetitionDetails />} />
                  <Route path='/competitions/:compId/applications' element={<Applications />} />
                  <Route
                    path='/competitions/:compId/execution'
                    element={<CompetitionExecution />}
                  />
                  <Route path='/brackets/:categoryId' element={<BracketView />} />
                  <Route path='/users' element={<UserManagement />} />

                  {/* Athlete Dashboard Route */}
                  <Route path='/dashboard' element={<UserDashboard />} />
                </Route>
              </Route>
            </Routes>
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
