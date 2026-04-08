import {
  ManualUploadAdapter,
  PublicWebAdapter,
  extractHtmlMetadata,
} from './intelligence.adapters';

describe('intelligence adapters', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('extracts basic HTML metadata', () => {
    const metadata = extractHtmlMetadata(`
      <html>
        <head>
          <title>Competitor Pricing</title>
          <meta name="description" content="Fast ALM pricing for credit unions" />
        </head>
        <body><h1>New product launch</h1></body>
      </html>
    `);

    expect(metadata.title).toBe('Competitor Pricing');
    expect(metadata.description).toBe('Fast ALM pricing for credit unions');
    expect(metadata.h1).toBe('New product launch');
  });

  it('manual adapter turns metadata into a low-risk insight', async () => {
    const adapter = new ManualUploadAdapter();
    const result = await adapter.collect(
      {
        id: 'acct-1',
        kind: 'BUYER',
        name: 'Cooperativa Sol',
      },
      {
        url: 'manual://acct-1',
        sourceType: 'MANUAL_UPLOAD',
        metadata: { summary: 'Uploaded official call report and board memo.' },
      },
    );

    expect(result.summary).toContain('Uploaded official call report');
    expect(result.insights[0].type).toBe('REFRESH_NOTE');
  });

  it('public web adapter captures live page metadata', async () => {
    jest.spyOn(global, 'fetch' as any).mockResolvedValue({
      status: 200,
      text: async () =>
        `
          <html>
            <head>
              <title>CERNIQ Rival</title>
              <meta name="description" content="Pricing page refreshed with new enterprise package" />
            </head>
            <body><h1>Enterprise ALM</h1></body>
          </html>
        `,
    });

    const adapter = new PublicWebAdapter();
    const result = await adapter.collect(
      {
        id: 'acct-2',
        kind: 'COMPETITOR',
        name: 'Rival',
      },
      {
        url: 'https://example.com/pricing',
        sourceType: 'PRICING_PAGE',
      },
    );

    expect(result.summary).toContain('CERNIQ Rival');
    expect(result.insights[0].type).toBe('PRICING_CHANGE');
    expect(result.facts.httpStatus).toBe(200);
  });
});
