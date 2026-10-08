import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import { authFetch } from '../../lib/authFetch';
import { useAuth } from '../../context/AuthContext';

type EasyInvoiceApiResult = { httpStatus: number; body: unknown; error?: string };

type OperationDef = {
  id: string;
  label: string;
  description: string;
  sample: Record<string, unknown>;
};

const SAMPLE_XML = `<Invoices><Inv><Invoice>
<TaxAuthorityCode>M1-26-XXXXX-00000000001</TaxAuthorityCode>
<Ikey>test-ikey-001</Ikey>
<CusCode>KH001</CusCode>
<Buyer>Nguyen Van A</Buyer>
<CusName>Nguyen Van A</CusName>
<CusAddress>Ha Noi</CusAddress>
<PaymentMethod>Tiền mặt</PaymentMethod>
<ArisingDate>06/10/2026</ArisingDate>
<CurrencyUnit>VND</CurrencyUnit>
<Products><Product>
<Feature>1</Feature>
<ProdName>San pham thu</ProdName>
<ProdUnit>Cai</ProdUnit>
<ProdQuantity>1</ProdQuantity>
<ProdPrice>100000</ProdPrice>
<Total>100000</Total>
<VATRate>10</VATRate>
<VATAmount>10000</VATAmount>
<Amount>110000</Amount>
<Extra>{"Pos":"1"}</Extra>
</Product></Products>
<Total>100000</Total>
<VATRate>10</VATRate>
<VATAmount>10000</VATAmount>
<Amount>110000</Amount>
<AmountInWords>Một trăm mười nghìn đồng</AmountInWords>
</Invoice></Inv></Invoices>`;

/** Every operation in the EasyInvoice integration doc; samples follow the doc's examples. */
const OPERATIONS: OperationDef[] = [
  {
    id: 'checkInvoiceState',
    label: '4. Kiểm tra trạng thái hóa đơn',
    description: 'api/publish/checkInvoiceState — Ikeys là mảng các ikey cần tra cứu.',
    sample: { Pattern: '2C26MTT', Serial: '2C26MTT', Ikeys: ['test-ikey-001'] },
  },
  {
    id: 'importAndPublishInvoice',
    label: '1. Tạo & phát hành hóa đơn MTT',
    description: 'api/publish/importAndPublishInvoice — cấp số và gửi CQT. Sửa XmlData trước khi gửi thật.',
    sample: { Pattern: '2C26MTT', XmlData: SAMPLE_XML },
  },
  {
    id: 'replaceInvoice',
    label: '2. Thay thế hóa đơn',
    description: 'api/business/replaceInvoice — cần Ikey của hóa đơn gốc đã phát hành.',
    sample: { Pattern: '2C26MTT', Ikey: 'test-ikey-001', XmlData: SAMPLE_XML },
  },
  {
    id: 'adjustInvoice',
    label: '3. Điều chỉnh hóa đơn',
    description: 'api/business/adjustInvoice — cần Ikey của hóa đơn gốc đã phát hành.',
    sample: { Pattern: '2C26MTT', Ikey: 'test-ikey-001', XmlData: SAMPLE_XML },
  },
  {
    id: 'registerDeclaration',
    label: '5. Đăng ký / thay đổi tờ khai 01',
    description: 'api/declaration/registerAndPublish — method: 1 đăng ký, 2 thay đổi. Ghi thật lên thuế.',
    sample: {
      email: 'test@gmail.com',
      phone: '0123456789',
      contractPerson: 'Tran Van Test',
      method: 1,
      declNormalInv: { CashRegister: true, SaleInv: true, InvTransfer: true },
    },
  },
  {
    id: 'searchDeclaration',
    label: '6. Tra cứu danh sách tờ khai 01',
    description: 'api/declaration/search — option 1: theo key (rỗng = tất cả); option 2: bản ghi cuối hợp lệ.',
    sample: { option: 1, key: '' },
  },
  {
    id: 'declarationDetail',
    label: '7. Chi tiết tờ khai 01 theo key',
    description: 'api/declaration/get_detail — key là ID tờ khai (lấy từ tra cứu).',
    sample: { key: '' },
  },
];

const WRITE_OPERATIONS = new Set(['importAndPublishInvoice', 'replaceInvoice', 'adjustInvoice', 'registerDeclaration']);

/** Test runner for the EasyInvoice (SoftDreams) API; credentials come from EASYINVOICE_* in .env. */
export function EasyInvoicePanel() {
  const { user, logout } = useAuth();
  const [operationId, setOperationId] = useState(OPERATIONS[0].id);
  const operation = OPERATIONS.find((op) => op.id === operationId) ?? OPERATIONS[0];
  const [payloadText, setPayloadText] = useState(() => JSON.stringify(OPERATIONS[0].sample, null, 2));
  const [result, setResult] = useState<EasyInvoiceApiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function selectOperation(nextId: string) {
    const next = OPERATIONS.find((op) => op.id === nextId) ?? OPERATIONS[0];
    setOperationId(next.id);
    setPayloadText(JSON.stringify(next.sample, null, 2));
    setResult(null);
    setError(null);
  }

  async function postJson(path: string, body: unknown): Promise<EasyInvoiceApiResult | null> {
    if (!user) return null;
    const res = await authFetch(path, user.token, logout, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res) return null;
    const data = (await res.json()) as EasyInvoiceApiResult;
    if (!res.ok) throw new Error(data.error ?? 'Yêu cầu thất bại.');
    return data;
  }

  async function handleSend() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      let payload: unknown;
      try {
        payload = JSON.parse(payloadText);
      } catch {
        throw new Error('Payload không phải JSON hợp lệ.');
      }
      const data = await postJson('/easyinvoice/call', { operation: operation.id, payload });
      if (data) setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định.');
    } finally {
      setLoading(false);
    }
  }

  async function handleTestConnection() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await postJson('/easyinvoice/test-connection', {});
      if (data) setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định.');
    } finally {
      setLoading(false);
    }
  }

  const isWrite = WRITE_OPERATIONS.has(operation.id);
  const ok = result && result.httpStatus >= 200 && result.httpStatus < 300;

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h6" gutterBottom>
        EasyInvoice (SoftDreams) API
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Backend ký request bằng EASYINVOICE_USERNAME/PASSWORD/TAXCODE trong .env và gọi trực tiếp
        api.softdreams.vn theo tài liệu tích hợp.
      </Typography>

      <Box sx={{ mb: 2 }}>
        <Button variant="outlined" onClick={handleTestConnection} disabled={loading}>
          Kiểm tra kết nối
        </Button>
      </Box>

      <TextField
        select
        fullWidth
        size="small"
        label="API"
        value={operation.id}
        onChange={(e) => selectOperation(e.target.value)}
        helperText={operation.description}
      >
        {OPERATIONS.map((op) => (
          <MenuItem key={op.id} value={op.id}>
            {op.label}
          </MenuItem>
        ))}
      </TextField>

      {isWrite && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          API này ghi dữ liệu thật (phát hành hóa đơn / đăng ký tờ khai). Kiểm tra payload trước khi gửi.
        </Alert>
      )}

      <TextField
        fullWidth
        multiline
        minRows={10}
        label="Payload (JSON)"
        value={payloadText}
        onChange={(e) => setPayloadText(e.target.value)}
        sx={{ mt: 2, fontFamily: 'monospace' }}
        slotProps={{ input: { sx: { fontFamily: 'monospace', fontSize: 13 } } }}
      />

      <Button variant="contained" onClick={handleSend} disabled={loading} sx={{ mt: 2 }}>
        {loading ? <CircularProgress size={20} /> : 'Gửi request'}
      </Button>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      {result && (
        <Alert severity={ok ? 'success' : 'warning'} sx={{ mt: 2 }}>
          <b>HTTP {result.httpStatus}</b>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: '8px 0 0' }}>
            {JSON.stringify(result.body, null, 2)}
          </pre>
        </Alert>
      )}
    </Box>
  );
}
