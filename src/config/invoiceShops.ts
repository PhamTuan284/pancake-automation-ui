export type InvoiceShopKey = 'dpa' | 'meit';

export type InvoiceShopUiConfig = {
  toolId: string;
  shopKey: InvoiceShopKey;
  label: string;
  /** Default Pancake shop id (server may override via env). */
  defaultPancakeShopId: string;
};

export const INVOICE_SHOPS: InvoiceShopUiConfig[] = [
  {
    toolId: 'pancake-einvoice-meit',
    shopKey: 'meit',
    label: 'Pancake · Hóa đơn MeiT',
    defaultPancakeShopId: '1021314908',
  },
  {
    toolId: 'pancake-einvoice-dpa',
    shopKey: 'dpa',
    label: 'Pancake · Hóa đơn DPA',
    defaultPancakeShopId: '1942925579',
  },
];

export function invoiceApiBase(shopKey: InvoiceShopKey): string {
  return `/pancake-einvoice/${shopKey}`;
}
