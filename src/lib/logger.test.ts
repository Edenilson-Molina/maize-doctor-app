import { logger } from './logger';

describe('logger', () => {
  const originalDev = (global as { __DEV__?: boolean }).__DEV__;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    (global as { __DEV__?: boolean }).__DEV__ = originalDev;
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('prints warnings in development', () => {
    (global as { __DEV__?: boolean }).__DEV__ = true;
    logger.warn('algo raro pasó');
    expect(warnSpy).toHaveBeenCalledWith('algo raro pasó');
  });

  it('prints errors in development', () => {
    (global as { __DEV__?: boolean }).__DEV__ = true;
    logger.error('algo falló');
    expect(errorSpy).toHaveBeenCalledWith('algo falló');
  });

  it('is a no-op outside development', () => {
    (global as { __DEV__?: boolean }).__DEV__ = false;
    logger.warn('no debería imprimirse');
    logger.error('no debería imprimirse');
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
