const ALLOWED_TAGS = new Set([
  'a',
  'b',
  'blockquote',
  'br',
  'code',
  'div',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'i',
  'li',
  'ol',
  'p',
  'pre',
  's',
  'span',
  'strong',
  'u',
  'ul',
]);

const DROP_TAGS = new Set([
  'base',
  'embed',
  'form',
  'iframe',
  'img',
  'link',
  'math',
  'meta',
  'object',
  'script',
  'style',
  'svg',
  'template',
  'video',
  'audio',
]);

const SAFE_URL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);
const ALLOWED_LINK_ATTRIBUTES = new Set(['href', 'rel', 'target', 'title']);

function safeHref(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('#')) return trimmed;

  try {
    const url = new URL(trimmed, document.baseURI);
    return SAFE_URL_PROTOCOLS.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * Keep diary formatting while removing executable markup and unsafe URLs.
 * This runs in the browser, where DOMParser gives us HTML parsing without
 * inserting the untrusted source into the live document.
 */
export function sanitizeDiaryHtml(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) return '';
  if (typeof DOMParser === 'undefined') return '';

  const document = new DOMParser().parseFromString(value, 'text/html');
  const elements = Array.from(document.body.querySelectorAll('*')).reverse();

  for (const element of elements) {
    const tag = element.tagName.toLowerCase();

    if (DROP_TAGS.has(tag)) {
      element.remove();
      continue;
    }

    if (!ALLOWED_TAGS.has(tag)) {
      const parent = element.parentNode;
      if (!parent) continue;
      while (element.firstChild) parent.insertBefore(element.firstChild, element);
      element.remove();
      continue;
    }

    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();

      if (tag !== 'a' || !ALLOWED_LINK_ATTRIBUTES.has(name)) {
        element.removeAttribute(attribute.name);
        continue;
      }

      if (name === 'href') {
        const href = safeHref(attribute.value);
        if (href) element.setAttribute('href', href);
        else element.removeAttribute(attribute.name);
      } else if (name === 'target') {
        if (!['_blank', '_self', '_parent', '_top'].includes(attribute.value)) {
          element.removeAttribute(attribute.name);
        }
      }
    }

    if (tag === 'a' && element.getAttribute('target') === '_blank') {
      element.setAttribute('rel', 'noopener noreferrer');
    }
  }

  return document.body.innerHTML;
}
