describe('telemetry bootstrap', () => {
  const startMock = jest.fn();
  const shutdownMock = jest.fn().mockResolvedValue(undefined);
  const sdkCtorMock = jest.fn(() => ({
    start: startMock,
    shutdown: shutdownMock,
  }));
  const exporterCtorMock = jest.fn();
  const autoInstrumentationMock = jest.fn(() => ['auto-instrumentations']);
  const processOnSpy = jest.spyOn(process, 'on');
  const stdoutWriteSpy = jest
    .spyOn(process.stdout, 'write')
    .mockReturnValue(true);

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    delete process.env.OTEL_EXPORTER_OTLP_HEADERS;
    delete process.env.npm_package_version;
  });

  afterAll(() => {
    processOnSpy.mockRestore();
    stdoutWriteSpy.mockRestore();
  });

  it('starts OpenTelemetry with the configured exporter and shutdown hooks', async () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'https://otel.example';
    process.env.OTEL_EXPORTER_OTLP_HEADERS =
      'Authorization=Bearer abc,X-Team=quant';
    process.env.npm_package_version = '9.9.9';

    jest.doMock('@opentelemetry/sdk-node', () => ({
      NodeSDK: sdkCtorMock,
    }));
    jest.doMock('@opentelemetry/auto-instrumentations-node', () => ({
      getNodeAutoInstrumentations: autoInstrumentationMock,
    }));
    jest.doMock('@opentelemetry/exporter-trace-otlp-http', () => ({
      OTLPTraceExporter: exporterCtorMock,
    }));

    jest.isolateModules(() => {
      require('./telemetry');
    });

    expect(exporterCtorMock).toHaveBeenCalledWith({
      url: 'https://otel.example/v1/traces',
      headers: {
        Authorization: 'Bearer abc',
        'X-Team': 'quant',
      },
    });
    expect(autoInstrumentationMock).toHaveBeenCalledWith({
      '@opentelemetry/instrumentation-fs': { enabled: false },
    });
    expect(sdkCtorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceDetectors: [],
        instrumentations: [['auto-instrumentations']],
      }),
    );
    expect(startMock).toHaveBeenCalledTimes(1);
    expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect(stdoutWriteSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'OpenTelemetry traces exporting to https://otel.example',
      ),
    );

    const sigtermHandler = processOnSpy.mock.calls.find(
      ([signal]) => signal === 'SIGTERM',
    )?.[1] as () => Promise<void>;
    await sigtermHandler();
    expect(shutdownMock).toHaveBeenCalledTimes(1);
  });

  it('stays inert when no OTLP endpoint is configured', () => {
    jest.doMock('@opentelemetry/sdk-node', () => ({
      NodeSDK: sdkCtorMock,
    }));
    jest.doMock('@opentelemetry/auto-instrumentations-node', () => ({
      getNodeAutoInstrumentations: autoInstrumentationMock,
    }));
    jest.doMock('@opentelemetry/exporter-trace-otlp-http', () => ({
      OTLPTraceExporter: exporterCtorMock,
    }));

    jest.isolateModules(() => {
      require('./telemetry');
    });

    expect(exporterCtorMock).not.toHaveBeenCalled();
    expect(sdkCtorMock).not.toHaveBeenCalled();
    expect(startMock).not.toHaveBeenCalled();
  });
});
