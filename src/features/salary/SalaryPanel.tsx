import { useEffect, useMemo, useState } from 'react';
import type { SalaryInputDraft, SalaryResult } from '../../types';
import { apiUrl } from '../../lib/api';
import { UiButton } from '../../components/ui';

const MONEY_FIELDS = [
  'baseSalary',
  'allowance',
  'bonus',
  'otherAddition',
  'latePenalty',
  'otherDeduction',
  'advancePayment',
  'personalDeduction',
  'dependentDeductionPerPerson',
] as const;

const MONEY_FIELD_LABELS: Record<(typeof MONEY_FIELDS)[number], string> = {
  baseSalary: 'Lương cơ bản tháng',
  allowance: 'Phụ cấp',
  bonus: 'Thưởng',
  otherAddition: 'Thu nhập bổ sung',
  latePenalty: 'Phạt đi trễ',
  otherDeduction: 'Khấu trừ khác',
  advancePayment: 'Tạm ứng',
  personalDeduction: 'Giảm trừ bản thân',
  dependentDeductionPerPerson: 'Giảm trừ / người phụ thuộc',
};

function formatVnd(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value);
}

const EMPTY_DRAFT: SalaryInputDraft = {
  employeeName: '',
  baseSalary: 0,
  workDays: 26,
  standardWorkDays: 26,
  overtimeWeekdayHours: 0,
  overtimeWeekendHours: 0,
  overtimeHolidayHours: 0,
  allowance: 0,
  bonus: 0,
  otherAddition: 0,
  latePenalty: 0,
  otherDeduction: 0,
  advancePayment: 0,
  insuranceRate: 0.105,
  personalDeduction: 11_000_000,
  dependentCount: 0,
  dependentDeductionPerPerson: 4_400_000,
};

export function SalaryPanel({ toolDescription }: { toolDescription: string }) {
  const [draft, setDraft] = useState<SalaryInputDraft>(EMPTY_DRAFT);
  const [result, setResult] = useState<SalaryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadDefaults = async () => {
      try {
        const res = await fetch(apiUrl('/salary/defaults'));
        const data = (await res.json().catch(() => ({}))) as {
          defaults?: SalaryInputDraft;
        };
        if (res.ok && data.defaults) {
          setDraft((prev) => ({ ...prev, ...data.defaults }));
        }
      } catch {
        // ignore and keep local defaults
      }
    };
    void loadDefaults();
  }, []);

  const summaryRows = useMemo(() => {
    if (!result) return [];
    return [
      ['Lương cơ bản theo công', result.proratedSalary],
      ['Tiền OT', result.overtimePay],
      ['Phụ cấp', result.allowance],
      ['Thưởng', result.bonus],
      ['Thu nhập bổ sung', result.otherAddition],
      ['Tổng thu nhập', result.grossIncome],
      ['BH (nhân viên đóng)', -result.insuranceDeduction],
      ['Thuế TNCN', -result.pitTax],
      ['Phạt đi trễ', -result.latePenalty],
      ['Khấu trừ khác', -result.otherDeduction],
      ['Tạm ứng', -result.advancePayment],
      ['Thực lĩnh', result.netIncome],
    ] as const;
  }, [result]);

  const updateField = (key: keyof SalaryInputDraft, value: string) => {
    setDraft((prev) => {
      if (key === 'employeeName') {
        return { ...prev, [key]: value };
      }
      const n = Number(value);
      return { ...prev, [key]: Number.isFinite(n) ? n : 0 };
    });
  };

  const calculate = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(apiUrl('/salary/calculate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const data = (await res.json().catch(() => ({}))) as {
        result?: SalaryResult;
        error?: string;
      };
      if (!res.ok || !data.result) {
        throw new Error(data.error || 'Không thể tính lương');
      }
      setResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tính lương');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <p className="tool-intro muted">{toolDescription}</p>

      <section className="card" aria-labelledby="salary-input-title">
        <h2 id="salary-input-title" className="section-title">
          Dữ liệu chấm công và thu nhập
        </h2>
        <div className="salary-form-grid">
          <label className="webhook-register-field">
            <span>Tên nhân viên</span>
            <input
              type="text"
              className="search-input webhook-url-input"
              value={draft.employeeName}
              onChange={(e) => updateField('employeeName', e.target.value)}
              placeholder="Nguyễn Văn A"
            />
          </label>
          <label className="webhook-register-field">
            <span>Số công thực tế</span>
            <input
              type="number"
              className="search-input webhook-url-input"
              value={draft.workDays}
              onChange={(e) => updateField('workDays', e.target.value)}
            />
          </label>
          <label className="webhook-register-field">
            <span>Số công chuẩn</span>
            <input
              type="number"
              className="search-input webhook-url-input"
              value={draft.standardWorkDays}
              onChange={(e) => updateField('standardWorkDays', e.target.value)}
            />
          </label>
          <label className="webhook-register-field">
            <span>OT ngày thường (giờ)</span>
            <input
              type="number"
              className="search-input webhook-url-input"
              value={draft.overtimeWeekdayHours}
              onChange={(e) =>
                updateField('overtimeWeekdayHours', e.target.value)
              }
            />
          </label>
          <label className="webhook-register-field">
            <span>OT cuối tuần (giờ)</span>
            <input
              type="number"
              className="search-input webhook-url-input"
              value={draft.overtimeWeekendHours}
              onChange={(e) =>
                updateField('overtimeWeekendHours', e.target.value)
              }
            />
          </label>
          <label className="webhook-register-field">
            <span>OT lễ/tết (giờ)</span>
            <input
              type="number"
              className="search-input webhook-url-input"
              value={draft.overtimeHolidayHours}
              onChange={(e) =>
                updateField('overtimeHolidayHours', e.target.value)
              }
            />
          </label>
          {MONEY_FIELDS.map((field) => (
            <label key={field} className="webhook-register-field">
              <span>{MONEY_FIELD_LABELS[field]}</span>
              <input
                type="number"
                className="search-input webhook-url-input"
                value={draft[field]}
                onChange={(e) => updateField(field, e.target.value)}
              />
            </label>
          ))}
          <label className="webhook-register-field">
            <span>Số người phụ thuộc</span>
            <input
              type="number"
              className="search-input webhook-url-input"
              value={draft.dependentCount}
              onChange={(e) => updateField('dependentCount', e.target.value)}
            />
          </label>
          <label className="webhook-register-field">
            <span>Tỷ lệ BH nhân viên đóng (0-1)</span>
            <input
              type="number"
              step="0.001"
              className="search-input webhook-url-input"
              value={draft.insuranceRate}
              onChange={(e) => updateField('insuranceRate', e.target.value)}
            />
          </label>
        </div>

        <div className="webhook-register-actions">
          <UiButton onClick={() => void calculate()} disabled={loading}>
            {loading ? 'Đang tính…' : 'Tính lương'}
          </UiButton>
        </div>
        {error && <p className="hint hint-error">{error}</p>}
      </section>

      {result && (
        <section className="card card-table" aria-labelledby="salary-result-title">
          <h2 id="salary-result-title" className="section-title">
            Kết quả lương: {result.employeeName}
          </h2>
          <div className="salary-summary-list">
            {summaryRows.map(([label, value]) => (
              <div key={label} className="salary-summary-row">
                <span className="muted">{label}</span>
                <strong className={value < 0 ? 'salary-negative' : undefined}>
                  {value < 0 ? '-' : ''}
                  {formatVnd(Math.abs(value))} đ
                </strong>
              </div>
            ))}
          </div>
          <p className="muted small">
            Thuế TNCN được tính theo biểu thuế luỹ tiến từng phần tháng (chuẩn VN).
          </p>
        </section>
      )}
    </>
  );
}
