import { APIRequestContext } from '@playwright/test';
import { Credentials } from './env';

interface HotelSummary {
  readonly id: string;
  readonly name: string;
}

interface HotelPage {
  readonly items: readonly HotelSummary[];
}

function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export async function adminToken(request: APIRequestContext, credentials: Credentials): Promise<string> {
  const response = await request.post('/api/auth/login', { data: credentials });
  if (!response.ok()) {
    throw new Error(`The administrator API login answered ${response.status()}.`);
  }
  const body = (await response.json()) as { accessToken: string };
  return body.accessToken;
}

export async function publicHotelNames(request: APIRequestContext, name: string): Promise<string[]> {
  const response = await request.get('/api/public/hotels', { params: { name } });
  const page = (await response.json()) as HotelPage;
  return page.items.map((hotel) => hotel.name);
}

export async function firstPublicHotelId(request: APIRequestContext): Promise<string> {
  const response = await request.get('/api/public/hotels', { params: { pageSize: 1 } });
  const page = (await response.json()) as HotelPage;
  const hotel = page.items[0];
  if (hotel === undefined) {
    throw new Error('The public catalogue has no hotels.');
  }
  return hotel.id;
}

export async function adminHotelIdNamed(request: APIRequestContext, token: string, name: string): Promise<string | null> {
  const response = await request.get('/api/hotels', { params: { name }, headers: bearer(token) });
  const page = (await response.json()) as HotelPage;
  return page.items.find((hotel) => hotel.name === name)?.id ?? null;
}

export async function deleteHotel(request: APIRequestContext, token: string, id: string): Promise<void> {
  const response = await request.delete(`/api/hotels/${id}`, { headers: bearer(token) });
  if (!response.ok() && response.status() !== 404) {
    throw new Error(`Deleting the test hotel answered ${response.status()}.`);
  }
}
