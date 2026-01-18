/**
 * Contact utilities for CRM system
 * Provides validation, formatting, and scoring functions for contact management
 */

export interface Contact {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  position?: string;
  lastContactDate?: Date;
  interactions?: number;
  dealValue?: number;
}

/**
 * Validates if an email address is in correct format
 * @param email - Email address to validate
 * @returns true if email is valid, false otherwise
 */
export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Formats a phone number to standard format (XXX) XXX-XXXX
 * @param phone - Phone number to format (digits only or with separators)
 * @returns Formatted phone number or null if invalid
 */
export function formatPhoneNumber(phone: string): string | null {
  if (!phone || typeof phone !== 'string') {
    return null;
  }

  const digits = phone.replace(/\D/g, '');

  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  return null;
}

/**
 * Calculates a lead score based on contact properties
 * Score ranges from 0-100 based on various factors
 * @param contact - Contact object to score
 * @returns Lead score (0-100)
 */
export function calculateLeadScore(contact: Contact): number {
  let score = 0;

  // Email validation (10 points)
  if (contact.email && validateEmail(contact.email)) {
    score += 10;
  }

  // Phone number (10 points)
  if (contact.phone && formatPhoneNumber(contact.phone)) {
    score += 10;
  }

  // Company information (15 points)
  if (contact.company && contact.company.trim().length > 0) {
    score += 15;
  }

  // Position/title (10 points)
  if (contact.position && contact.position.trim().length > 0) {
    score += 10;
  }

  // Recent interactions (20 points max)
  if (contact.lastContactDate) {
    const daysSinceContact = Math.floor(
      (Date.now() - contact.lastContactDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceContact <= 7) {
      score += 20;
    } else if (daysSinceContact <= 30) {
      score += 15;
    } else if (daysSinceContact <= 90) {
      score += 10;
    } else if (daysSinceContact <= 180) {
      score += 5;
    }
  }

  // Number of interactions (15 points max)
  if (contact.interactions) {
    if (contact.interactions >= 10) {
      score += 15;
    } else if (contact.interactions >= 5) {
      score += 10;
    } else if (contact.interactions >= 1) {
      score += 5;
    }
  }

  // Deal value (20 points max)
  if (contact.dealValue) {
    if (contact.dealValue >= 100000) {
      score += 20;
    } else if (contact.dealValue >= 50000) {
      score += 15;
    } else if (contact.dealValue >= 10000) {
      score += 10;
    } else if (contact.dealValue > 0) {
      score += 5;
    }
  }

  return Math.min(score, 100);
}

/**
 * Generates a full name from contact
 * @param contact - Contact object
 * @returns Full name string
 */
export function getFullName(contact: Contact): string {
  if (!contact.firstName && !contact.lastName) {
    return 'Unknown';
  }

  return `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
}

/**
 * Checks if a contact is considered "hot" based on lead score
 * @param contact - Contact object
 * @returns true if contact is a hot lead (score >= 70)
 */
export function isHotLead(contact: Contact): boolean {
  return calculateLeadScore(contact) >= 70;
}

/**
 * Sanitizes contact data by trimming whitespace and normalizing fields
 * @param contact - Contact object to sanitize
 * @returns Sanitized contact object
 */
export function sanitizeContact(contact: Contact): Contact {
  return {
    ...contact,
    firstName: contact.firstName?.trim() || '',
    lastName: contact.lastName?.trim() || '',
    email: contact.email?.trim().toLowerCase() || '',
    phone: contact.phone?.trim() || undefined,
    company: contact.company?.trim() || undefined,
    position: contact.position?.trim() || undefined,
  };
}

/**
 * Validates if a contact has minimum required fields
 * @param contact - Contact object to validate
 * @returns true if contact has required fields
 */
export function isValidContact(contact: Contact): boolean {
  if (!contact) {
    return false;
  }

  const hasName = (contact.firstName && contact.firstName.trim().length > 0) ||
                  (contact.lastName && contact.lastName.trim().length > 0);

  const hasValidEmail = validateEmail(contact.email);

  return hasName && hasValidEmail;
}
