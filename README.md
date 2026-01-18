# Capital CRM

A comprehensive Customer Relationship Management system with utility functions for contact management.

## Features

- Email validation
- Phone number formatting
- Lead scoring algorithm
- Contact sanitization and validation
- Full name generation

## Project Structure

```
Capital-CRM/
├── src/
│   └── utils/
│       └── contactUtils.ts    # Contact utility functions
├── tests/
│   └── contactUtils.test.ts   # Comprehensive test suite
├── jest.config.js             # Jest configuration
├── tsconfig.json              # TypeScript configuration
└── package.json               # Project dependencies
```

## Installation

```bash
npm install
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Test Coverage

The project includes comprehensive tests for all utility functions:

- **validateEmail**: 8 test cases covering valid/invalid emails and edge cases
- **formatPhoneNumber**: 10 test cases for various phone formats
- **calculateLeadScore**: 13 test cases for scoring algorithm
- **getFullName**: 5 test cases for name formatting
- **isHotLead**: 3 test cases for lead qualification
- **sanitizeContact**: 4 test cases for data sanitization
- **isValidContact**: 10 test cases for contact validation

Total: 53 test cases ensuring robust functionality

## Functions

### validateEmail(email: string): boolean
Validates if an email address is in correct format.

### formatPhoneNumber(phone: string): string | null
Formats a phone number to standard format (XXX) XXX-XXXX.

### calculateLeadScore(contact: Contact): number
Calculates a lead score (0-100) based on contact properties.

### getFullName(contact: Contact): string
Generates a full name from contact.

### isHotLead(contact: Contact): boolean
Checks if a contact is a hot lead (score >= 70).

### sanitizeContact(contact: Contact): Contact
Sanitizes contact data by trimming whitespace and normalizing fields.

### isValidContact(contact: Contact): boolean
Validates if a contact has minimum required fields.
