export const allowedDocumentMimeTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);

export const isAllowedDocumentMimeType = (contentType: string) => allowedDocumentMimeTypes.has(contentType);
