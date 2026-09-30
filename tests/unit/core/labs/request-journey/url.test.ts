import { describe, expect, it } from 'vitest';
import { parseUrl, requestTarget } from '@/core/labs/request-journey';

describe('parseUrl', () => {
  it('splits scheme, host, port, path, query and fragment', () => {
    expect(parseUrl('https://www.weather.example:8443/forecast?city=leeds#hourly')).toEqual({
      scheme: 'https',
      host: 'www.weather.example',
      port: 8443,
      defaultPort: false,
      path: '/forecast',
      query: 'city=leeds',
      fragment: 'hourly',
    });
  });

  it('applies the default port of the scheme and the root path', () => {
    expect(parseUrl('https://weather.example')).toMatchObject({
      port: 443,
      defaultPort: true,
      path: '/',
    });
    expect(parseUrl('http://weather.example/')).toMatchObject({ port: 80, defaultPort: true });
    expect(parseUrl('http://weather.example:80/')).toMatchObject({ defaultPort: true });
  });

  it('lower-cases the scheme and the host, and trims', () => {
    expect(parseUrl('  HTTPS://Www.Weather.Example/Forecast ')).toMatchObject({
      scheme: 'https',
      host: 'www.weather.example',
      path: '/Forecast',
    });
  });

  it('returns null for what it does not understand', () => {
    for (const bad of [
      '',
      'ftp://x.example/',
      'www.weather.example',
      'https://',
      'https://a..b/',
      'https://.a/',
      'https://a./',
      'https://a.example:0/',
      'https://a.example:70000/',
      'https://a b/',
    ]) {
      expect(parseUrl(bad), bad).toBeNull();
    }
  });
});

describe('requestTarget', () => {
  it('is the path plus the query, never the fragment', () => {
    expect(requestTarget(parseUrl('https://a.example/forecast?city=leeds#x')!)).toBe(
      '/forecast?city=leeds',
    );
    expect(requestTarget(parseUrl('https://a.example/forecast')!)).toBe('/forecast');
  });
});
