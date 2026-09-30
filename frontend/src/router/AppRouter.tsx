import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/layouts/AppLayout';
import { DashboardPage } from '@/pages/DashboardPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { PagePlaceholder } from '@/components/common/PagePlaceholder';
import { AuthProvider } from '@/context/AuthContext';
import { ProtectedRoute, PublicOnlyRoute } from './RouteGuards';
import { VehicleListPage } from '@/pages/vehicles/VehicleListPage';
import { VehicleFormPage } from '@/pages/vehicles/VehicleFormPage';
import { VehicleDetailsPage } from '@/pages/vehicles/VehicleDetailsPage';
import { DriverListPage } from '@/pages/drivers/DriverListPage';
import { DriverFormPage } from '@/pages/drivers/DriverFormPage';
import { DriverDetailsPage } from '@/pages/drivers/DriverDetailsPage';
import { FirmListPage } from '@/pages/firms/FirmListPage';
import { FirmFormPage } from '@/pages/firms/FirmFormPage';
import { FirmDetailsPage } from '@/pages/firms/FirmDetailsPage';
import { CompanyListPage } from '@/pages/companies/CompanyListPage';
import { CompanyFormPage } from '@/pages/companies/CompanyFormPage';
import { CompanyDetailsPage } from '@/pages/companies/CompanyDetailsPage';
import { RouteListPage } from '@/pages/routes/RouteListPage';
import { RouteFormPage } from '@/pages/routes/RouteFormPage';
import { RouteDetailsPage } from '@/pages/routes/RouteDetailsPage';
import { ContractListPage } from '@/pages/contracts/ContractListPage';
import { ContractFormPage } from '@/pages/contracts/ContractFormPage';
import { ContractDetailsPage } from '@/pages/contracts/ContractDetailsPage';
import { ContractVersionFormPage } from '@/pages/contracts/ContractVersionFormPage';
import { TripListPage } from '@/pages/trips/TripListPage';
import { TripFormPage } from '@/pages/trips/TripFormPage';
import { TripDetailsPage } from '@/pages/trips/TripDetailsPage';
import { BillingOverviewPage } from '@/pages/billing/BillingOverviewPage';
import { MonthlyBillingPage } from '@/pages/billing/MonthlyBillingPage';
import { InvoiceHistoryPage } from '@/pages/billing/InvoiceHistoryPage';
import { InvoiceDetailsPage } from '@/pages/billing/InvoiceDetailsPage';
import { ExpenseListPage } from '@/pages/expenses/ExpenseListPage';
import { ExpenseFormPage } from '@/pages/expenses/ExpenseFormPage';
import { PaymentListPage } from '@/pages/payments/PaymentListPage';
import { PaymentFormPage } from '@/pages/payments/PaymentFormPage';
import { VehicleDocumentListPage } from '@/pages/documents/VehicleDocumentListPage';
import { VehicleDocumentFormPage } from '@/pages/documents/VehicleDocumentFormPage';

const placeholder = (eyebrow: string, title: string) => <PagePlaceholder eyebrow={eyebrow} title={title} description="The foundation is in place. This domain page will be added without changing the shared application shell." />;

export function AppRouter() {
  return <BrowserRouter><AuthProvider><Routes><Route element={<PublicOnlyRoute />}><Route path="/login" element={<LoginPage />} /></Route><Route element={<ProtectedRoute />}><Route element={<AppLayout />}><Route index element={<DashboardPage />} /><Route path="vehicles" element={<VehicleListPage />} /><Route path="vehicles/new" element={<VehicleFormPage />} /><Route path="vehicles/:id/edit" element={<VehicleFormPage />} /><Route path="vehicles/:id" element={<VehicleDetailsPage />} /><Route path="drivers" element={<DriverListPage />} /><Route path="drivers/new" element={<DriverFormPage />} /><Route path="drivers/:id/edit" element={<DriverFormPage />} /><Route path="drivers/:id" element={<DriverDetailsPage />} /><Route path="firms" element={<FirmListPage />} /><Route path="firms/new" element={<FirmFormPage />} /><Route path="firms/:id/edit" element={<FirmFormPage />} /><Route path="firms/:id" element={<FirmDetailsPage />} /><Route path="companies" element={<CompanyListPage />} /><Route path="companies/new" element={<CompanyFormPage />} /><Route path="companies/:id/edit" element={<CompanyFormPage />} /><Route path="companies/:id" element={<CompanyDetailsPage />} /><Route path="routes" element={<RouteListPage />} /><Route path="routes/new" element={<RouteFormPage />} /><Route path="routes/:id/edit" element={<RouteFormPage />} /><Route path="routes/:id" element={<RouteDetailsPage />} /><Route path="contracts" element={<ContractListPage />} /><Route path="contracts/new" element={<ContractFormPage />} /><Route path="contracts/:id/edit" element={<ContractFormPage />} /><Route path="contracts/:id" element={<ContractDetailsPage />} /><Route path="contracts/:id/versions/new" element={<ContractVersionFormPage />} /><Route path="trips" element={<TripListPage />} /><Route path="trips/new" element={<TripFormPage />} /><Route path="trips/:id/edit" element={<TripFormPage />} /><Route path="trips/:id" element={<TripDetailsPage />} /><Route path="billing" element={<BillingOverviewPage />} /><Route path="billing/monthly" element={<MonthlyBillingPage />} /><Route path="billing/invoices" element={<InvoiceHistoryPage />} /><Route path="billing/invoices/:id" element={<InvoiceDetailsPage />} /><Route path="expenses" element={<ExpenseListPage />} /><Route path="expenses/new" element={<ExpenseFormPage />} /><Route path="expenses/:id/edit" element={<ExpenseFormPage />} /><Route path="payments" element={<PaymentListPage />} /><Route path="payments/new" element={<PaymentFormPage />} /><Route path="documents" element={<VehicleDocumentListPage />} /><Route path="documents/new" element={<VehicleDocumentFormPage />} /><Route path="reports" element={placeholder('Intelligence', 'Reports')} /><Route path="*" element={placeholder('Not found', 'This page does not exist')} /></Route></Route></Routes></AuthProvider></BrowserRouter>;
}