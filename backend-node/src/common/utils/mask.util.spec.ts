import {
  maskEmail,
  maskPhone,
  maskApiKey,
  maskCreditCard,
  maskSensitiveFields,
} from './mask.util';

describe('maskEmail', () => {
  it('masks a standard email', () => {
    expect(maskEmail('john@example.com')).toBe('j***@example.com');
  });

  it('masks a single-character local part', () => {
    expect(maskEmail('j@example.com')).toBe('*@example.com');
  });

  it('returns *** for empty input', () => {
    expect(maskEmail('')).toBe('***');
  });

  it('returns *** for invalid email without @', () => {
    expect(maskEmail('notanemail')).toBe('***');
  });

  it('limits mask length to 3 asterisks', () => {
    expect(maskEmail('abcdef@test.com')).toBe('a***@test.com');
  });
});

describe('maskPhone', () => {
  it('masks a standard phone number', () => {
    expect(maskPhone('787-555-1234')).toBe('***-***-1234');
  });

  it('masks a number with formatting', () => {
    expect(maskPhone('(787) 555-1234')).toBe('***-***-1234');
  });

  it('returns *** for empty input', () => {
    expect(maskPhone('')).toBe('***');
  });

  it('returns *** for short phone number', () => {
    expect(maskPhone('123')).toBe('***');
  });
});

describe('maskApiKey', () => {
  it('masks a standard API key', () => {
    expect(maskApiKey('sk_live_abc123xyz789')).toBe('sk_****z789');
  });

  it('returns **** for short keys', () => {
    expect(maskApiKey('short')).toBe('****');
  });

  it('returns *** for empty input', () => {
    expect(maskApiKey('')).toBe('***');
  });

  it('handles key without underscore', () => {
    const result = maskApiKey('abcdefghijklmnop');
    expect(result).toMatch(/^abcd\*\*\*\*mnop$/);
  });
});

describe('maskCreditCard', () => {
  it('masks a standard card number', () => {
    expect(maskCreditCard('4111111111111111')).toBe('****-****-****-1111');
  });

  it('masks a formatted card number', () => {
    expect(maskCreditCard('4111-1111-1111-1111')).toBe('****-****-****-1111');
  });

  it('returns *** for empty input', () => {
    expect(maskCreditCard('')).toBe('***');
  });

  it('returns **** for too short input', () => {
    expect(maskCreditCard('123')).toBe('****');
  });
});

describe('maskSensitiveFields', () => {
  it('masks email fields', () => {
    const result = maskSensitiveFields({ userEmail: 'john@example.com' });
    expect(result.userEmail).toBe('j***@example.com');
  });

  it('masks phone fields', () => {
    const result = maskSensitiveFields({ mobilePhone: '787-555-1234' });
    expect(result.mobilePhone).toBe('***-***-1234');
  });

  it('masks password fields', () => {
    const result = maskSensitiveFields({ password: 'secret123' });
    expect(result.password).toBe('********');
  });

  it('masks token fields', () => {
    const result = maskSensitiveFields({ authToken: 'abc123xyz' });
    expect(result.authToken).toBe('********');
  });

  it('masks API key fields', () => {
    const result = maskSensitiveFields({
      apiKey: 'sk_live_abcdef1234567890',
    });
    expect(result.apiKey).toMatch(/^\w+_\*\*\*\*\w{4}$/);
  });

  it('masks card fields', () => {
    const result = maskSensitiveFields({
      creditCard: '4111111111111111',
    });
    expect(result.creditCard).toBe('****-****-****-1111');
  });

  it('preserves non-sensitive fields', () => {
    const result = maskSensitiveFields({ name: 'John', age: 30 });
    expect(result.name).toBe('John');
    expect(result.age).toBe(30);
  });

  it('handles nested objects', () => {
    const result = maskSensitiveFields({
      user: { email: 'john@example.com', name: 'John' },
    });
    expect(result.user.email).toBe('j***@example.com');
    expect(result.user.name).toBe('John');
  });

  it('handles arrays', () => {
    const result = maskSensitiveFields([
      { email: 'a@b.com' },
      { email: 'c@d.com' },
    ]);
    expect(result[0].email).toBe('a***@b.com');
    expect(result[1].email).toBe('c***@d.com');
  });

  it('returns null/primitive as-is', () => {
    expect(maskSensitiveFields(null)).toBeNull();
    expect(maskSensitiveFields(undefined)).toBeUndefined();
    expect(maskSensitiveFields(42)).toBe(42);
  });
});
