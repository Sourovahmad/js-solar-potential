/*
 Copyright 2024 Google LLC

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

      https://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

import { test, expect } from 'vitest';
import { showMoney, showNumber } from './utils';

test('showMoney formats currency in EUR for Italy', () => {
  const result1 = showMoney(1234.56);
  const result2 = showMoney(100);
  const result3 = showMoney(0);
  
  // Check that it contains EUR symbol and correct numbers
  expect(result1).toMatch(/1234,56.*€/);
  expect(result2).toMatch(/100,00.*€/);
  expect(result3).toMatch(/0,00.*€/);
  
  // Check that it starts with the number (Italian format puts € at the end)
  expect(result1).toMatch(/^1234,56/);
  expect(result2).toMatch(/^100,00/);
  expect(result3).toMatch(/^0,00/);
});

test('showNumber formats numbers correctly', () => {
  expect(showNumber(1234.56789)).toBe('1234,6');
  expect(showNumber(100)).toBe('100');
  expect(showNumber(0)).toBe('0');
});
