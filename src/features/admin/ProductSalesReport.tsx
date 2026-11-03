import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import SendIcon from '@mui/icons-material/Send';
import { apiUrl } from '../../lib/api';
import { authFetch } from '../../lib/authFetch';
import { extractApiRows } from '../../lib/apiResponse';
import { useAuth, type AuthUser } from '../../context/AuthContext';

type ProductOption = { code: string; name: string };

type SentProduct = { productCode: string; totalQty: number };

type Props = {
  token: AuthUser['token'];
};

/** "YYYY-MM-DD" in Vietnam time, `offsetDays` from today. */
function vnDate(offsetDays = 0): string {
  return new Date(Date.now() + 7 * 3_600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

function rowProductCode(row: Record<string, unknown>): string {
  const prod = row.product && typeof row.product === 'object' ? (row.product as Record<string, unknown>) : null;
  return String(row.product_display_id ?? prod?.display_id ?? '').trim();
}

function rowProductName(row: Record<string, unknown>): string {
  const prod = row.product && typeof row.product === 'object' ? (row.product as Record<string, unknown>) : null;
  return String(row.product_name ?? prod?.name ?? row.name ?? '').trim();
}

export function ProductSalesReport({ token }: Props) {
  const { logout } = useAuth();
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState(vnDate(-6));
  const [toDate, setToDate] = useState(vnDate(0));

  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<SentProduct[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl('/pancake-webhook/products/variations?shop=meit'));
        const json = (await res.json().catch(() => ({}))) as { data?: unknown; error?: string };
        if (!res.ok) throw new Error(json.error ?? 'Không tải được danh sách sản phẩm.');
        const byCode = new Map<string, ProductOption>();
        for (const row of extractApiRows(json.data ?? null)) {
          const code = rowProductCode(row);
          if (code && !byCode.has(code)) byCode.set(code, { code, name: rowProductName(row) });
        }
        if (!cancelled) {
          setOptions([...byCode.values()].sort((a, b) => a.code.localeCompare(b.code)));
        }
      } catch (err) {
        if (!cancelled) setOptionsError(err instanceof Error ? err.message : 'Không tải được danh sách sản phẩm.');
      } finally {
        if (!cancelled) setLoadingOptions(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const nameByCode = useMemo(() => new Map(options.map((o) => [o.code, o.name])), [options]);

  const rangeInvalid = !fromDate || !toDate || fromDate > toDate;
  const canSend = selectedCodes.length > 0 && !rangeInvalid && !sending;

  async function handleSend() {
    setSending(true);
    setError(null);
    setSent(null);
    try {
      const res = await authFetch('/zalo-bot/send-product-sales-range', token, logout, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productCodes: selectedCodes, fromDate, toDate }),
      });
      if (!res) return;
      const data = (await res.json().catch(() => ({}))) as { products?: SentProduct[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Gửi thất bại.');
      setSent(data.products ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định.');
    } finally {
      setSending(false);
    }
  }

  return (
    <Box sx={{ maxWidth: 640 }}>
      <Typography variant="h6" gutterBottom>
        Gửi số lượng đã bán
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Chọn mã sản phẩm và khoảng thời gian, bot Zalo sẽ gửi số lượng đã bán (theo màu/size) của các mã đó vào nhóm.
      </Typography>
      <Divider sx={{ mb: 2 }} />

      {optionsError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {optionsError} Bạn vẫn có thể gõ mã sản phẩm rồi nhấn Enter.
        </Alert>
      )}

      <Autocomplete
        multiple
        freeSolo
        filterSelectedOptions
        loading={loadingOptions}
        options={options.map((o) => o.code)}
        value={selectedCodes}
        onChange={(_e, v) => setSelectedCodes([...new Set(v.map((c) => c.trim()).filter(Boolean))])}
        filterOptions={(codes, state) => {
          const q = state.inputValue.trim().toLowerCase();
          const matched = q
            ? codes.filter((c) => `${c} ${nameByCode.get(c) ?? ''}`.toLowerCase().includes(q))
            : codes;
          return matched.slice(0, 100);
        }}
        renderOption={(props, code) => (
          <li {...props} key={code}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{code}</Typography>
              {nameByCode.get(code) && (
                <Typography variant="caption" color="text.secondary">{nameByCode.get(code)}</Typography>
              )}
            </Box>
          </li>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Mã sản phẩm"
            placeholder={selectedCodes.length === 0 ? 'Tìm hoặc gõ mã…' : undefined}
          />
        )}
        sx={{ mb: 2 }}
      />

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 1 }}>
        <TextField
          type="date"
          label="Từ ngày"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: toDate || undefined } }}
          size="small"
        />
        <TextField
          type="date"
          label="Đến ngày"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: fromDate || undefined } }}
          size="small"
        />
      </Box>
      {rangeInvalid && fromDate && toDate && (
        <Typography variant="caption" color="error">
          Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.
        </Typography>
      )}

      <Box sx={{ mt: 3, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          onClick={handleSend}
          disabled={!canSend}
          startIcon={sending ? <CircularProgress size={16} /> : <SendIcon />}
        >
          Gửi
        </Button>
        {error && <Alert severity="error" sx={{ py: 0 }}>{error}</Alert>}
      </Box>

      {sent && (
        <Alert severity="success" sx={{ mt: 2 }}>
          Đã gửi vào Zalo.
          <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
            {sent.map((p) => (
              <li key={p.productCode}>
                {p.productCode}: <strong>{p.totalQty}</strong>
              </li>
            ))}
          </Box>
        </Alert>
      )}
    </Box>
  );
}
