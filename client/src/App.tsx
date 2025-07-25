import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useCacheBusting } from "@/hooks/useCacheBusting";
import { CacheBustingNotification } from "@/components/CacheBustingNotification";
import Layout from "@/components/Layout";
import LoginPage from "@/pages/LoginPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import MasterDashboard from "@/pages/MasterDashboard";
import ClientsPage from "@/pages/ClientsPage";
import ApiConfigPage from "@/pages/ApiConfigPage";
import ClientDashboard from "@/pages/ClientDashboard";
import DashboardPage from "@/pages/DashboardPage";
import JobsPage from "@/pages/JobsPage";
import CadastroVagasPage from "@/pages/CadastroVagasPage";
import CandidatesPage from "@/pages/CandidatesPage";
import CandidatesManagementPage from "@/pages/CandidatesManagementPage";
import SelectionsPage from "@/pages/SelectionsPage";
import ResultsPage from "@/pages/ResultsPage";
import InterviewPage from "@/pages/InterviewPage";
import NaturalInterviewPage from "@/pages/NaturalInterviewPage";
import InterviewDemoPage from "@/pages/InterviewDemoPage";

import NewReportsPage from "@/pages/NewReportsPage";
import IndependentReportsPage from "@/pages/IndependentReportsPage";
import StatisticsPage from "@/pages/StatisticsPage";
import AssessmentsPage from "@/pages/AssessmentsPage";
import UnauthorizedPage from "@/pages/UnauthorizedPage";

import NotFound from "@/pages/not-found";

function PrivateRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Redirect to="/unauthorized" />;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/interview/:token?" component={InterviewPage} />
      <Route path="/natural-interview/:token" component={NaturalInterviewPage} />
      <Route path="/demo-entrevista" component={InterviewDemoPage} />

      {/* Unified Dashboard - Shows appropriate content based on user role */}
      <Route path="/dashboard">
        <PrivateRoute allowedRoles={['master', 'client']}>
          <Layout>
            <DashboardPage />
          </Layout>
        </PrivateRoute>
      </Route>

      <Route path="/clients">
        <PrivateRoute allowedRoles={['master']}>
          <Layout>
            <ClientsPage />
          </Layout>
        </PrivateRoute>
      </Route>

      <Route path="/vagas">
        <PrivateRoute allowedRoles={['master', 'client']}>
          <Layout>
            <CadastroVagasPage />
          </Layout>
        </PrivateRoute>
      </Route>

      <Route path="/jobs">
        <PrivateRoute allowedRoles={['master', 'client']}>
          <Layout>
            <CadastroVagasPage />
          </Layout>
        </PrivateRoute>
      </Route>

      <Route path="/selecoes">
        <PrivateRoute allowedRoles={['master', 'client']}>
          <Layout>
            <SelectionsPage />
          </Layout>
        </PrivateRoute>
      </Route>

      <Route path="/configuracoes">
        <PrivateRoute allowedRoles={['master', 'client']}>
          <Layout>
            <ApiConfigPage />
          </Layout>
        </PrivateRoute>
      </Route>





      <Route path="/relatorios">
        <PrivateRoute allowedRoles={['master', 'client']}>
          <Layout>
            <NewReportsPage />
          </Layout>
        </PrivateRoute>
      </Route>

      <Route path="/assessments">
        <PrivateRoute allowedRoles={['master', 'client']}>
          <Layout>
            <AssessmentsPage />
          </Layout>
        </PrivateRoute>
      </Route>

      <Route path="/estatisticas">
        <PrivateRoute allowedRoles={['client']}>
          <Layout>
            <StatisticsPage />
          </Layout>
        </PrivateRoute>
      </Route>

      <Route path="/candidates">
        <PrivateRoute allowedRoles={['client', 'master']}>
          <Layout>
            <CandidatesPage />
          </Layout>
        </PrivateRoute>
      </Route>

      <Route path="/candidatos">
        <PrivateRoute allowedRoles={['master', 'client']}>
          <Layout>
            <CandidatesManagementPage />
          </Layout>
        </PrivateRoute>
      </Route>

      <Route path="/results">
        <PrivateRoute allowedRoles={['master', 'client']}>
          <Layout>
            <ResultsPage />
          </Layout>
        </PrivateRoute>
      </Route>

      {/* Unauthorized page */}
      <Route path="/unauthorized" component={UnauthorizedPage} />

      {/* Default redirects */}
      <Route path="/">
        <RedirectToDashboard />
      </Route>

      {/* Fallback */}
      <Route component={NotFound} />
    </Switch>
  );
}

function RedirectToDashboard() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (user?.role === 'master' || user?.role === 'client') {
    return <Redirect to="/dashboard" />;
  }

  return <Redirect to="/login" />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <CacheBustingNotification />
          <Router />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;