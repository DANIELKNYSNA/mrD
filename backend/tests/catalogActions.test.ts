import { describe, expect, it } from 'vitest';
import { findItems, tokenize } from '../src/models_actions/catalogActions.js';
import { CatalogModel } from '../src/models/CatalogModel.js';

const names = (q: string, category?: string) => findItems(q, category).map((i) => i.name);

describe('tokenize', () => {
  it('lowercases, splits, strips accents and plurals', () => {
    expect(tokenize('  Sautéed  PIZZAS, eggs ')).toEqual(['sauteed', 'pizza', 'egg']);
  });
});

describe('findItems', () => {
  it('returns the whole catalog, most popular first, for an empty query', () => {
    const results = findItems('');
    expect(results).toHaveLength(CatalogModel.all().length);
    const popularity = results.map((i) => i.popularity);
    expect(popularity).toEqual([...popularity].sort((a, b) => b - a));
  });

  it('matches on name', () => {
    expect(names('margherita')).toEqual(['Classic Margherita Pizza']);
  });

  it('matches on category', () => {
    expect(findItems('desserts').every((i) => i.category === 'Desserts')).toBe(true);
    expect(findItems('desserts')).toHaveLength(4);
  });

  it('matches on tags and description', () => {
    expect(names('spicy')).toContain('Peri-Peri Half Chicken'); // tag
    expect(names('edamame')).toEqual(['Chicken Poke Bowl']); // description
  });

  it('is case, accent and plural insensitive', () => {
    expect(names('PIZZAS')).toEqual(names('pizza'));
    expect(names('sauteed')).toEqual(['Mushroom Swiss Burger']);
  });

  it('matches word prefixes for partially typed queries', () => {
    expect(names('marg')).toEqual(['Classic Margherita Pizza']);
  });

  it('requires every term to match (AND semantics)', () => {
    expect(names('vegan burger')).toEqual(['Plant-Based Burger']);
    expect(names('chicken pizza')).toEqual(['BBQ Chicken Pizza']);
  });

  it('ranks name matches above description-only matches', () => {
    const results = names('cheese');
    expect(results[0]).toBe('Four Cheese Pizza'); // whole word in name
    expect(results.indexOf('Double Cheeseburger')).toBeLessThan(results.indexOf('Mushroom Swiss Burger')); // name prefix beats description
  });

  it('does not substring-match very short terms', () => {
    expect(findItems('a').length).toBeLessThan(CatalogModel.all().length);
  });

  it('returns nothing for a query that matches nothing', () => {
    expect(findItems('xyzzy')).toEqual([]);
  });

  it('filters by category, case-insensitively, combined with a query', () => {
    expect(names('chicken', 'burgers')).toEqual(['Crispy Chicken Burger']);
    expect(findItems('', 'PIZZA').every((i) => i.category === 'Pizza')).toBe(true);
    expect(findItems('', 'Nope')).toEqual([]);
  });
});
