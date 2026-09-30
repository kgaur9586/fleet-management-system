import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { requestLogger } from './middleware/logger';
import { errorHandler } from './middleware/errorHandler';
import { NotFoundError } from './common/errors';
import { sendSuccess } from './common/response';

const app: Application = express();

// Security middleware
app.use(helmet());

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api', apiLimiter);

// CORS middleware
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true, // In case we ever use cookies, allow them
  })
);

// Body parser - limit payload size to 10kb to prevent DOS attacks
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Request logging
app.use(requestLogger);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  sendSuccess(res, 200, 'Server is healthy');
});

import authRoutes from './modules/auth/auth.routes';
import companyRoutes from './modules/companies/company.routes';
import vehicleRoutes from './modules/vehicles/vehicle.routes';
import driverRoutes from './modules/drivers/driver.routes';
import firmRoutes from './modules/firms/firm.routes';
import routeRoutes from './modules/routes/route.routes';
import contractRoutes from './modules/contracts/contract.routes';
import tripRoutes from './modules/trips/trip.routes';
import expenseRoutes from './modules/expenses/expense.routes';
import invoiceRoutes from './modules/invoices/invoice.routes';
import paymentRoutes from './modules/payments/payment.routes';
import vehicleDocumentRoutes from './modules/documents/vehicle-document.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';

// API Routes will be registered here
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/companies', companyRoutes);
app.use('/api/v1/vehicles', vehicleRoutes);
app.use('/api/v1/drivers', driverRoutes);
app.use('/api/v1/firms', firmRoutes);
app.use('/api/v1/routes', routeRoutes);
app.use('/api/v1/contracts', contractRoutes);
app.use('/api/v1/trips', tripRoutes);
app.use('/api/v1/expenses', expenseRoutes);
app.use('/api/v1/invoices', invoiceRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/documents', vehicleDocumentRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);

// Handle 404
app.use((req: Request, res: Response, next: NextFunction) => {
  next(new NotFoundError(`Route ${req.originalUrl} not found`));
});

// Global Error Handler
app.use(errorHandler);

export default app;
