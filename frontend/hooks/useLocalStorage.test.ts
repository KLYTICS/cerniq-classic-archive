import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from './useLocalStorage';

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('returns initial value when nothing is stored', () => {
    const { result } = renderHook(() => useLocalStorage('key', 'default'));
    expect(result.current[0]).toBe('default');
  });

  it('reads existing value from localStorage on mount', () => {
    localStorage.setItem('key', JSON.stringify('stored'));
    const { result } = renderHook(() => useLocalStorage('key', 'default'));
    // After effect runs
    expect(result.current[0]).toBe('stored');
  });

  it('writes to localStorage when setValue is called', () => {
    const { result } = renderHook(() => useLocalStorage('key', 'initial'));

    act(() => {
      result.current[1]('updated');
    });

    expect(result.current[0]).toBe('updated');
    expect(JSON.parse(localStorage.getItem('key')!)).toBe('updated');
  });

  it('supports functional updater', () => {
    const { result } = renderHook(() => useLocalStorage('count', 0));

    act(() => {
      result.current[1]((prev: number) => prev + 1);
    });

    expect(result.current[0]).toBe(1);
    expect(JSON.parse(localStorage.getItem('count')!)).toBe(1);
  });

  it('removes value from localStorage', () => {
    localStorage.setItem('key', JSON.stringify('value'));
    const { result } = renderHook(() => useLocalStorage('key', 'default'));

    act(() => {
      result.current[2](); // removeValue
    });

    expect(result.current[0]).toBe('default');
    expect(localStorage.getItem('key')).toBeNull();
  });

  it('handles complex objects', () => {
    const obj = { name: 'Cerniq', version: 2 };
    const { result } = renderHook(() => useLocalStorage('config', obj));

    const updated = { name: 'Cerniq', version: 3 };
    act(() => {
      result.current[1](updated);
    });

    expect(result.current[0]).toEqual(updated);
    expect(JSON.parse(localStorage.getItem('config')!)).toEqual(updated);
  });

  it('handles localStorage errors gracefully', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    const { result } = renderHook(() => useLocalStorage('key', 'default'));

    act(() => {
      result.current[1]('too-large');
    });

    expect(warnSpy).toHaveBeenCalled();
  });
});
