/**
 * Income vs expense chart readability: small non-zero bars stay visible without
 * altering any plotted values, and the "expenses dwarfed" notice triggers only
 * when the shared scale would hide expenses.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MIN_VISIBLE_BAR_PX,
  expensesDwarfedByIncome,
  minVisibleBarSize,
} from "../chart-scale";
import { formatINR } from "../money";

describe("minVisibleBarSize", () => {
  it("gives any non-zero amount a minimum visible height", () => {
    assert.equal(minVisibleBarSize(50), MIN_VISIBLE_BAR_PX);
    assert.equal(minVisibleBarSize(0.01), MIN_VISIBLE_BAR_PX);
    assert.equal(minVisibleBarSize(300000), MIN_VISIBLE_BAR_PX);
    assert.equal(minVisibleBarSize(-120), MIN_VISIBLE_BAR_PX);
  });

  it("never draws a bar for zero or missing amounts", () => {
    assert.equal(minVisibleBarSize(0), 0);
    assert.equal(minVisibleBarSize(null), 0);
    assert.equal(minVisibleBarSize(undefined), 0);
    assert.equal(minVisibleBarSize(Number.NaN), 0);
  });
});

describe("expensesDwarfedByIncome", () => {
  it("flags ₹50 of expenses against ₹3,00,000 of income", () => {
    assert.equal(expensesDwarfedByIncome([0, 0, 0, 0, 0, 300000], [0, 0, 0, 0, 0, 50]), true);
  });

  it("does not flag large expenses", () => {
    assert.equal(expensesDwarfedByIncome([300000, 120000], [180000, 95000]), false);
    assert.equal(expensesDwarfedByIncome([300000], [6000]), false); // exactly 2%
  });

  it("does not flag when there are no expenses or no income", () => {
    assert.equal(expensesDwarfedByIncome([300000], [0]), false);
    assert.equal(expensesDwarfedByIncome([0], [50]), false);
    assert.equal(expensesDwarfedByIncome([], []), false);
  });

  it("compares the largest values across all periods", () => {
    // A small month next to a large month is fine as long as the largest expense is visible.
    assert.equal(expensesDwarfedByIncome([300000, 1000], [40000, 50]), false);
  });

  it("does not modify the input values", () => {
    const income = [300000];
    const expenses = [50];
    expensesDwarfedByIncome(income, expenses);
    assert.deepEqual(income, [300000]);
    assert.deepEqual(expenses, [50]);
  });
});

describe("tooltip amounts", () => {
  it("shows small expense amounts exactly", () => {
    assert.equal(formatINR(50), "₹50");
    assert.equal(formatINR(50.5), "₹50.50");
    assert.equal(formatINR(0.75), "₹0.75");
    assert.equal(formatINR(300000), "₹3,00,000");
  });
});
