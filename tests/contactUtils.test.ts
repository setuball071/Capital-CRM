import {
  validateEmail,
  formatPhoneNumber,
  calculateLeadScore,
  getFullName,
  isHotLead,
  sanitizeContact,
  isValidContact,
  Contact,
} from '../src/utils/contactUtils';

describe('contactUtils', () => {
  describe('validateEmail', () => {
    it('should return true for valid email addresses', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name@example.co.uk')).toBe(true);
      expect(validateEmail('user+tag@example.com')).toBe(true);
      expect(validateEmail('user_name@sub.example.com')).toBe(true);
      expect(validateEmail('123@example.com')).toBe(true);
    });

    it('should return false for invalid email addresses', () => {
      expect(validateEmail('invalid')).toBe(false);
      expect(validateEmail('invalid@')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
      expect(validateEmail('invalid@example')).toBe(false);
      expect(validateEmail('invalid@.com')).toBe(false);
      expect(validateEmail('invalid..email@example.com')).toBe(false);
      expect(validateEmail('invalid @example.com')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(validateEmail('')).toBe(false);
      expect(validateEmail('   ')).toBe(false);
      expect(validateEmail(null as any)).toBe(false);
      expect(validateEmail(undefined as any)).toBe(false);
      expect(validateEmail(123 as any)).toBe(false);
    });

    it('should trim whitespace before validation', () => {
      expect(validateEmail('  test@example.com  ')).toBe(true);
      expect(validateEmail('\ntest@example.com\n')).toBe(true);
    });
  });

  describe('formatPhoneNumber', () => {
    it('should format 10-digit phone numbers correctly', () => {
      expect(formatPhoneNumber('1234567890')).toBe('(123) 456-7890');
      expect(formatPhoneNumber('5551234567')).toBe('(555) 123-4567');
    });

    it('should format 11-digit phone numbers with country code 1', () => {
      expect(formatPhoneNumber('11234567890')).toBe('(123) 456-7890');
      expect(formatPhoneNumber('15551234567')).toBe('(555) 123-4567');
    });

    it('should handle phone numbers with separators', () => {
      expect(formatPhoneNumber('(123) 456-7890')).toBe('(123) 456-7890');
      expect(formatPhoneNumber('123-456-7890')).toBe('(123) 456-7890');
      expect(formatPhoneNumber('123.456.7890')).toBe('(123) 456-7890');
      expect(formatPhoneNumber('123 456 7890')).toBe('(123) 456-7890');
    });

    it('should return null for invalid phone numbers', () => {
      expect(formatPhoneNumber('123')).toBeNull();
      expect(formatPhoneNumber('12345678901234')).toBeNull();
      expect(formatPhoneNumber('21234567890')).toBeNull(); // 11 digits but doesn't start with 1
      expect(formatPhoneNumber('abcdefghij')).toBeNull();
    });

    it('should handle edge cases', () => {
      expect(formatPhoneNumber('')).toBeNull();
      expect(formatPhoneNumber('   ')).toBeNull();
      expect(formatPhoneNumber(null as any)).toBeNull();
      expect(formatPhoneNumber(undefined as any)).toBeNull();
      expect(formatPhoneNumber(1234567890 as any)).toBeNull();
    });
  });

  describe('calculateLeadScore', () => {
    it('should return 0 for minimal contact', () => {
      const contact: Contact = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'invalid-email',
      };
      expect(calculateLeadScore(contact)).toBe(0);
    });

    it('should award 10 points for valid email', () => {
      const contact: Contact = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      };
      expect(calculateLeadScore(contact)).toBe(10);
    });

    it('should award 10 points for valid phone', () => {
      const contact: Contact = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'invalid',
        phone: '1234567890',
      };
      expect(calculateLeadScore(contact)).toBe(10);
    });

    it('should award 15 points for company', () => {
      const contact: Contact = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'invalid',
        company: 'Acme Corp',
      };
      expect(calculateLeadScore(contact)).toBe(15);
    });

    it('should award 10 points for position', () => {
      const contact: Contact = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'invalid',
        position: 'CEO',
      };
      expect(calculateLeadScore(contact)).toBe(10);
    });

    it('should award points based on recent contact date', () => {
      const now = Date.now();

      // 5 days ago - 20 points
      const contact1: Contact = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'invalid',
        lastContactDate: new Date(now - 5 * 24 * 60 * 60 * 1000),
      };
      expect(calculateLeadScore(contact1)).toBe(20);

      // 20 days ago - 15 points
      const contact2: Contact = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'invalid',
        lastContactDate: new Date(now - 20 * 24 * 60 * 60 * 1000),
      };
      expect(calculateLeadScore(contact2)).toBe(15);

      // 60 days ago - 10 points
      const contact3: Contact = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'invalid',
        lastContactDate: new Date(now - 60 * 24 * 60 * 60 * 1000),
      };
      expect(calculateLeadScore(contact3)).toBe(10);

      // 120 days ago - 5 points
      const contact4: Contact = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'invalid',
        lastContactDate: new Date(now - 120 * 24 * 60 * 60 * 1000),
      };
      expect(calculateLeadScore(contact4)).toBe(5);

      // 200 days ago - 0 points
      const contact5: Contact = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'invalid',
        lastContactDate: new Date(now - 200 * 24 * 60 * 60 * 1000),
      };
      expect(calculateLeadScore(contact5)).toBe(0);
    });

    it('should award points based on number of interactions', () => {
      const contact1: Contact = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'invalid',
        interactions: 15,
      };
      expect(calculateLeadScore(contact1)).toBe(15);

      const contact2: Contact = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'invalid',
        interactions: 7,
      };
      expect(calculateLeadScore(contact2)).toBe(10);

      const contact3: Contact = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'invalid',
        interactions: 2,
      };
      expect(calculateLeadScore(contact3)).toBe(5);

      const contact4: Contact = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'invalid',
        interactions: 0,
      };
      expect(calculateLeadScore(contact4)).toBe(0);
    });

    it('should award points based on deal value', () => {
      const contact1: Contact = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'invalid',
        dealValue: 150000,
      };
      expect(calculateLeadScore(contact1)).toBe(20);

      const contact2: Contact = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'invalid',
        dealValue: 75000,
      };
      expect(calculateLeadScore(contact2)).toBe(15);

      const contact3: Contact = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'invalid',
        dealValue: 25000,
      };
      expect(calculateLeadScore(contact3)).toBe(10);

      const contact4: Contact = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'invalid',
        dealValue: 5000,
      };
      expect(calculateLeadScore(contact4)).toBe(5);

      const contact5: Contact = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'invalid',
        dealValue: 0,
      };
      expect(calculateLeadScore(contact5)).toBe(0);
    });

    it('should calculate comprehensive score for complete contact', () => {
      const contact: Contact = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '1234567890',
        company: 'Acme Corp',
        position: 'CEO',
        lastContactDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        interactions: 12,
        dealValue: 120000,
      };
      // 10 + 10 + 15 + 10 + 20 + 15 + 20 = 100
      expect(calculateLeadScore(contact)).toBe(100);
    });

    it('should cap score at 100', () => {
      const contact: Contact = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '1234567890',
        company: 'Acme Corp',
        position: 'CEO',
        lastContactDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        interactions: 20,
        dealValue: 200000,
      };
      expect(calculateLeadScore(contact)).toBe(100);
    });
  });

  describe('getFullName', () => {
    it('should combine first and last name', () => {
      const contact: Contact = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      };
      expect(getFullName(contact)).toBe('John Doe');
    });

    it('should handle only first name', () => {
      const contact: Contact = {
        firstName: 'John',
        lastName: '',
        email: 'john@example.com',
      };
      expect(getFullName(contact)).toBe('John');
    });

    it('should handle only last name', () => {
      const contact: Contact = {
        firstName: '',
        lastName: 'Doe',
        email: 'john@example.com',
      };
      expect(getFullName(contact)).toBe('Doe');
    });

    it('should return "Unknown" for missing names', () => {
      const contact: Contact = {
        firstName: '',
        lastName: '',
        email: 'john@example.com',
      };
      expect(getFullName(contact)).toBe('Unknown');
    });

    it('should trim extra whitespace', () => {
      const contact: Contact = {
        firstName: '  John  ',
        lastName: '  Doe  ',
        email: 'john@example.com',
      };
      expect(getFullName(contact)).toBe('John     Doe');
    });
  });

  describe('isHotLead', () => {
    it('should return true for high-scoring contacts (>= 70)', () => {
      const contact: Contact = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '1234567890',
        company: 'Acme Corp',
        position: 'CEO',
        lastContactDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        interactions: 10,
      };
      // Score: 10 + 10 + 15 + 10 + 20 + 15 = 80
      expect(isHotLead(contact)).toBe(true);
    });

    it('should return false for low-scoring contacts (< 70)', () => {
      const contact: Contact = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        company: 'Acme Corp',
      };
      // Score: 10 + 15 = 25
      expect(isHotLead(contact)).toBe(false);
    });

    it('should return true for contact scoring exactly 70', () => {
      const contact: Contact = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '1234567890',
        company: 'Acme Corp',
        position: 'CEO',
        lastContactDate: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
        interactions: 3,
      };
      // Score: 10 + 10 + 15 + 10 + 5 + 5 + 15 = 70
      expect(isHotLead(contact)).toBe(true);
    });
  });

  describe('sanitizeContact', () => {
    it('should trim whitespace from all string fields', () => {
      const contact: Contact = {
        firstName: '  John  ',
        lastName: '  Doe  ',
        email: '  JOHN@EXAMPLE.COM  ',
        phone: '  123-456-7890  ',
        company: '  Acme Corp  ',
        position: '  CEO  ',
      };

      const sanitized = sanitizeContact(contact);

      expect(sanitized.firstName).toBe('John');
      expect(sanitized.lastName).toBe('Doe');
      expect(sanitized.email).toBe('john@example.com');
      expect(sanitized.phone).toBe('123-456-7890');
      expect(sanitized.company).toBe('Acme Corp');
      expect(sanitized.position).toBe('CEO');
    });

    it('should convert email to lowercase', () => {
      const contact: Contact = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'JOHN.DOE@EXAMPLE.COM',
      };

      const sanitized = sanitizeContact(contact);
      expect(sanitized.email).toBe('john.doe@example.com');
    });

    it('should handle empty strings', () => {
      const contact: Contact = {
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        company: '',
        position: '',
      };

      const sanitized = sanitizeContact(contact);

      expect(sanitized.firstName).toBe('');
      expect(sanitized.lastName).toBe('');
      expect(sanitized.email).toBe('');
      expect(sanitized.phone).toBeUndefined();
      expect(sanitized.company).toBeUndefined();
      expect(sanitized.position).toBeUndefined();
    });

    it('should preserve other fields', () => {
      const lastContactDate = new Date();
      const contact: Contact = {
        id: '123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        interactions: 5,
        dealValue: 10000,
        lastContactDate,
      };

      const sanitized = sanitizeContact(contact);

      expect(sanitized.id).toBe('123');
      expect(sanitized.interactions).toBe(5);
      expect(sanitized.dealValue).toBe(10000);
      expect(sanitized.lastContactDate).toBe(lastContactDate);
    });
  });

  describe('isValidContact', () => {
    it('should return true for valid contact with all required fields', () => {
      const contact: Contact = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      };
      expect(isValidContact(contact)).toBe(true);
    });

    it('should return true for contact with only first name and valid email', () => {
      const contact: Contact = {
        firstName: 'John',
        lastName: '',
        email: 'john@example.com',
      };
      expect(isValidContact(contact)).toBe(true);
    });

    it('should return true for contact with only last name and valid email', () => {
      const contact: Contact = {
        firstName: '',
        lastName: 'Doe',
        email: 'john@example.com',
      };
      expect(isValidContact(contact)).toBe(true);
    });

    it('should return false for contact without name', () => {
      const contact: Contact = {
        firstName: '',
        lastName: '',
        email: 'john@example.com',
      };
      expect(isValidContact(contact)).toBe(false);
    });

    it('should return false for contact with only whitespace name', () => {
      const contact: Contact = {
        firstName: '   ',
        lastName: '   ',
        email: 'john@example.com',
      };
      expect(isValidContact(contact)).toBe(false);
    });

    it('should return false for contact without valid email', () => {
      const contact: Contact = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'invalid-email',
      };
      expect(isValidContact(contact)).toBe(false);
    });

    it('should return false for contact with empty email', () => {
      const contact: Contact = {
        firstName: 'John',
        lastName: 'Doe',
        email: '',
      };
      expect(isValidContact(contact)).toBe(false);
    });

    it('should return false for null contact', () => {
      expect(isValidContact(null as any)).toBe(false);
    });

    it('should return false for undefined contact', () => {
      expect(isValidContact(undefined as any)).toBe(false);
    });

    it('should handle contacts with additional fields', () => {
      const contact: Contact = {
        id: '123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '1234567890',
        company: 'Acme Corp',
        position: 'CEO',
        interactions: 5,
        dealValue: 10000,
      };
      expect(isValidContact(contact)).toBe(true);
    });
  });
});
