import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('GET /api/health', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('GET /api/search', () => {
  it('matches on name', async () => {
    const res = await request(app).get('/api/search').query({ q: 'pizza' });
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items.every((i: { category: string }) => i.category === 'Pizza')).toBe(true);
  });

  it('applies category filter and price sort end to end', async () => {
    const res = await request(app).get('/api/search').query({ category: 'Burgers', sort: 'price' });
    expect(res.status).toBe(200);
    expect(res.body.query).toMatchObject({ category: 'Burgers', sort: 'price', order: 'asc' });
    const prices = res.body.items.map((i: { offer: { price: number } }) => i.offer.price);
    expect(prices.length).toBe(5);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it('defaults to relevance, descending', async () => {
    const res = await request(app).get('/api/search');
    expect(res.body.query).toEqual({ q: '', sort: 'relevance', order: 'desc' });
  });

  it('rejects an unknown sort field with a 400', async () => {
    const res = await request(app).get('/api/search').query({ sort: 'banana' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });
});

describe('GET /api/search validation', () => {
  it('rejects an unknown order with a 400 listing the allowed values', async () => {
    const res = await request(app).get('/api/search').query({ order: 'sideways' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: 'BAD_REQUEST', details: { allowed: ['asc', 'desc'] } });
  });

  it('ignores repeated params rather than crashing', async () => {
    const res = await request(app).get('/api/search?q=pizza&q=burger');
    expect(res.status).toBe(200);
    expect(res.body.query.q).toBe('');
  });
});

describe('GET /api/categories', () => {
  it('returns the distinct categories, sorted', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=300');
    expect(res.body.categories).toEqual([
      'Beverages', 'Burgers', 'Chicken', 'Desserts', 'Groceries', 'Healthy', 'Pizza', 'Sushi',
    ]);
  });
});

describe('unknown routes', () => {
  it('return a 404 error envelope', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
