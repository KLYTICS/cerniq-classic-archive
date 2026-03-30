describe('AlmController upload interceptor', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('@nestjs/platform-express');
  });

  it('accepts csv uploads and rejects non-csv files', () => {
    const capturedOptions: Array<Record<string, any>> = [];

    jest.isolateModules(() => {
      jest.doMock('@nestjs/platform-express', () => {
        const actual = jest.requireActual('@nestjs/platform-express');
        return {
          ...actual,
          FileInterceptor: jest.fn((_fieldName: string, options: any) => {
            capturedOptions.push(options);
            return class MockFileInterceptor {};
          }),
        };
      });

      require('./alm.controller');
    });

    const uploadCsvOptions = capturedOptions.find(
      (options) =>
        options?.limits?.fileSize === 10 * 1024 * 1024 &&
        typeof options?.fileFilter === 'function',
    );

    expect(uploadCsvOptions).toBeDefined();

    const reject = jest.fn();
    uploadCsvOptions?.fileFilter({}, { originalname: 'positions.txt' }, reject);
    expect(reject).toHaveBeenCalledWith(expect.any(Error), false);

    const accept = jest.fn();
    uploadCsvOptions?.fileFilter({}, { originalname: 'positions.csv' }, accept);
    expect(accept).toHaveBeenCalledWith(null, true);
  });
});
