import Joi from 'joi'

// Username validation - alphanumeric, underscore, hyphen, 3-50 chars
export const usernameSchema = Joi.string()
  .alphanum()
  .min(3)
  .max(50)
  .required()
  .messages({
    'string.alphanum': 'Username must contain only alphanumeric characters',
    'string.min': 'Username must be at least 3 characters long',
    'string.max': 'Username must not exceed 50 characters',
    'any.required': 'Username is required'
  })

// Password validation - minimum 8 chars
export const passwordSchema = Joi.string()
  .min(8)
  .max(128)
  .required()
  .messages({
    'string.min': 'Password must be at least 8 characters long',
    'string.max': 'Password must not exceed 128 characters',
    'any.required': 'Password is required'
  })

// API key validation - hex string format
export const apiKeySchema = Joi.string()
  .pattern(/^[a-f0-9]{64}$/)
  .required()
  .messages({
    'string.pattern.base': 'Invalid API key format',
    'any.required': 'API key is required'
  })

// Timestamp validation - positive integer, reasonable range
const now = Date.now()
const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000
const oneYearFromNow = now + 365 * 24 * 60 * 60 * 1000

export const timestampSchema = Joi.number()
  .integer()
  .positive()
  .min(oneYearAgo)
  .max(oneYearFromNow)
  .messages({
    'number.base': 'Timestamp must be a number',
    'number.integer': 'Timestamp must be an integer',
    'number.positive': 'Timestamp must be positive',
    'number.min': 'Timestamp is too old (more than 1 year ago)',
    'number.max': 'Timestamp is too far in the future (more than 1 year from now)'
  })

// API Key creation schema
export const createApiKeySchema = Joi.object({
  username: usernameSchema
})

// Auth login schema
export const loginSchema = Joi.object({
  username: Joi.string().min(1).max(128).required(),
  password: passwordSchema
})

// Analytics query schema
export const analyticsQuerySchema = Joi.object({
  keyId: apiKeySchema,
  startDate: timestampSchema.optional(),
  endDate: timestampSchema.optional()
}).custom((value, helpers) => {
  // If both dates provided, ensure startDate < endDate
  if (value.startDate && value.endDate && value.startDate >= value.endDate) {
    return helpers.error('any.invalid', { message: 'Start date must be before end date' })
  }
  return value
})

// Helper function to validate and sanitize input
export function validate<T>(schema: Joi.Schema, data: any): { value: T; error: null } | { value: null; error: string } {
  const result = schema.validate(data, { stripUnknown: true, abortEarly: false })

  if (result.error) {
    const errorMessage = result.error.details.map(d => d.message).join(', ')
    return { value: null, error: errorMessage }
  }

  return { value: result.value as T, error: null }
}
