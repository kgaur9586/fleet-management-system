import { vehiclesApi } from './vehiclesApi';
import { driversApi } from './driversApi';
import { firmsApi } from './firmsApi';
import { companiesApi } from './companiesApi';
import { routesApi } from './routesApi';
import { contractsApi } from './contractsApi';
import { tripsApi } from './tripsApi';

export interface GlobalSearchResult {
  id: string;
  category: string;
  title: string;
  subtitle?: string;
  path: string;
}

/** Queries each module's existing search-capable list endpoint in parallel; a single module failing does not block the rest. */
export async function globalSearch(term: string): Promise<GlobalSearchResult[]> {
  const query = { search: term, page: 1, limit: 5 };
  const settle = async <T,>(promise: Promise<T>): Promise<T | null> => {
    try {
      return await promise;
    } catch {
      return null;
    }
  };

  const [vehicles, drivers, firms, companies, routes, contracts, trips] = await Promise.all([
    settle(vehiclesApi.list(query)),
    settle(driversApi.list(query)),
    settle(firmsApi.list(query)),
    settle(companiesApi.list(query)),
    settle(routesApi.list(query)),
    settle(contractsApi.list(query)),
    settle(tripsApi.list(query)),
  ]);

  const results: GlobalSearchResult[] = [];

  vehicles?.data.forEach((vehicle) => results.push({ id: vehicle._id, category: 'Vehicles', title: vehicle.registrationNumber, subtitle: vehicle.vehicleType, path: `/vehicles/${vehicle._id}` }));
  drivers?.data.forEach((driver) => results.push({ id: driver._id, category: 'Drivers', title: driver.name, subtitle: driver.mobile, path: `/drivers/${driver._id}` }));
  firms?.data.forEach((firm) => results.push({ id: firm._id, category: 'Firms', title: firm.billingName ?? firm.name, subtitle: firm.gstNumber, path: `/firms/${firm._id}` }));
  companies?.data.forEach((company) => results.push({ id: company._id, category: 'Companies', title: company.name, subtitle: company.legalName, path: `/companies/${company._id}` }));
  routes?.data.forEach((route) => results.push({ id: route._id, category: 'Routes', title: route.name, subtitle: `${route.pickupLocation} \u2192 ${route.dropLocation}`, path: `/routes/${route._id}` }));
  contracts?.data.forEach((contract) => results.push({ id: contract._id, category: 'Contracts', title: contract.name, subtitle: contract.description, path: `/contracts/${contract._id}` }));
  trips?.data.forEach((trip) => results.push({ id: trip._id, category: 'Trips', title: `${trip.pickupLocation} \u2192 ${trip.dropLocation}`, subtitle: new Date(trip.tripDate).toLocaleDateString('en-IN'), path: `/trips/${trip._id}` }));

  return results;
}
