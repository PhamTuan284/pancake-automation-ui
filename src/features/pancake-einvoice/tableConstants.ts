import type { ColumnKey } from '../../types';

export const TABLE_COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: 'buyerName', label: 'Tên khách hàng' },
  { key: 'operationName', label: 'Tên đơn vị' },
  { key: 'taxCode', label: 'Mã số thuế' },
  { key: 'phone', label: 'Số điện thoại' },
  { key: 'idNumber', label: 'Số CCCD' },
  { key: 'address', label: 'Địa chỉ' },
  { key: 'businessLicense', label: 'Giấy phép kinh doanh' },
];
