import { logger } from './logger';

describe('logger', () => {
  const originalDev = global.__DEV__;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    global.__DEV__ = originalDev;
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('prints warnings in development', () => {
    global.__DEV__ = true;
    logger.warn('algo raro pasó');
    expect(warnSpy).toHaveBeenCalledWith('algo raro pasó');
  });

  it('prints errors in development', () => {
    global.__DEV__ = true;
    logger.error('algo falló');
    expect(errorSpy).toHaveBeenCalledWith('algo falló');
  });

  it('is a no-op outside development', () => {
    global.__DEV__ = false;
    logger.warn('no debería imprimirse');
    logger.error('no debería imprimirse');
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
