const BLOCKED_HOSTS = ['localhost', '127.0.0.1', '10.', '192.168.', '172.'];

export function isValidUrl(url) {
  try {
    const parsed = new URL(url);
    if (BLOCKED_HOSTS.some(b => parsed.hostname.includes(b))) {
      return false;
    }
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export function isValidProviderName(name) {
  return typeof name === 'string' && name.length >= 1 && name.length <= 100;
}

export function isValidPrefix(prefix) {
  return typeof prefix === 'string' && prefix.length >= 1 && prefix.length <= 50;
}

export function isValidApiType(apiType) {
  return ['openai', 'anthropic', 'google', 'custom'].includes(apiType);
}

export function isValidProviderType(type) {
  return ['primary', 'backup', 'test'].includes(type);
}

export const VALID_API_TYPES = ['openai', 'anthropic', 'google', 'custom'];
export const VALID_PROVIDER_TYPES = ['primary', 'backup', 'test'];

export function validateProviderNode(node) {
  const errors = [];

  if (!isValidProviderName(node.name)) {
    errors.push({ field: 'name', message: 'Name must be 1-100 characters' });
  }
  if (!isValidPrefix(node.prefix)) {
    errors.push({ field: 'prefix', message: 'Prefix must be 1-50 characters' });
  }
  if (!isValidUrl(node.baseUrl)) {
    errors.push({ field: 'baseUrl', message: 'Invalid or internal URL' });
  }
  if (!isValidApiType(node.apiType)) {
    errors.push({ field: 'apiType', message: `apiType must be one of: ${VALID_API_TYPES.join(', ')}` });
  }
  if (!isValidProviderType(node.type)) {
    errors.push({ field: 'type', message: `type must be one of: ${VALID_PROVIDER_TYPES.join(', ')}` });
  }

  return { valid: errors.length === 0, errors };
}

export function validateApiKey(key) {
  if (!key || typeof key !== 'string') {
    return { valid: false, error: 'API key is required' };
  }
  if (key.length < 10) {
    return { valid: false, error: 'API key seems too short' };
  }
  return { valid: true };
}

export function sanitizeString(str, maxLength = 1000) {
  if (typeof str !== 'string') return '';
  return str.slice(0, maxLength).replace(/[<>]/g, '');
}