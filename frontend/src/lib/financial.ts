const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatCurrency = (value: number | string) => currencyFormatter.format(Number(value));
const wholeCurrencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export const formatWholeCurrency = (value: number | string) => wholeCurrencyFormatter.format(Number(value));
export const money = { format: formatCurrency, formatWhole: formatWholeCurrency };
