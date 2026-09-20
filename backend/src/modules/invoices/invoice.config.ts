export const invoiceCompanySnapshot = {
  name: process.env.INVOICE_COMPANY_NAME ?? 'Fleet Management Company',
  address: process.env.INVOICE_COMPANY_ADDRESS,
  phone: process.env.INVOICE_COMPANY_PHONE,
  email: process.env.INVOICE_COMPANY_EMAIL,
  taxId: process.env.INVOICE_COMPANY_TAX_ID,
};