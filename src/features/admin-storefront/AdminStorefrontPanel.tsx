import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Divider from '@mui/material/Divider';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import SaveIcon from '@mui/icons-material/Save';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../lib/api';

type HeroBannerConfig = {
  videoUrl: string;
  posterUrl: string;
};

type CategoryBannerConfig = {
  id: string;
  imageUrl: string;
};

type StorefrontConfig = {
  heroBanner: HeroBannerConfig;
  categoryBanners: CategoryBannerConfig[];
};

type StoreCategory = {
  id: string;
  nameVi: string;
  nameEn: string;
  subcategories: { id: string; nameVi: string; nameEn: string }[];
};

const DEFAULT_CONFIG: StorefrontConfig = {
  heroBanner: { videoUrl: '', posterUrl: '' },
  categoryBanners: [],
};

function HeroBannerTab({
  config,
  onChange,
}: {
  config: HeroBannerConfig;
  onChange: (updated: HeroBannerConfig) => void;
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="body2" color="text.secondary">
        Cấu hình video và ảnh nền cho phần hero ở đầu trang chủ storefront.
      </Typography>

      <Card variant="outlined">
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Video URL (hero.mp4)"
            placeholder="https://example.com/hero.mp4"
            value={config.videoUrl}
            onChange={(e) => onChange({ ...config, videoUrl: e.target.value })}
            fullWidth
            helperText="URL file video MP4 cho hero banner. Để trống để dùng giá trị từ biến môi trường."
          />
          <TextField
            label="Poster Image URL (ảnh preview)"
            placeholder="https://example.com/poster.jpg"
            value={config.posterUrl}
            onChange={(e) => onChange({ ...config, posterUrl: e.target.value })}
            fullWidth
            helperText="URL ảnh hiển thị trong khi video đang tải."
          />
          {config.posterUrl && (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                Xem trước poster:
              </Typography>
              <Box
                component="img"
                src={config.posterUrl}
                alt="Hero poster preview"
                sx={{ maxHeight: 200, maxWidth: '100%', objectFit: 'cover', borderRadius: 1 }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

function CategoryBannersTab({
  banners,
  categories,
  onChange,
}: {
  banners: CategoryBannerConfig[];
  categories: StoreCategory[];
  onChange: (updated: CategoryBannerConfig[]) => void;
}) {
  function getBanner(categoryId: string): string {
    return banners.find((b) => b.id === categoryId)?.imageUrl ?? '';
  }

  function setBanner(categoryId: string, imageUrl: string) {
    const existing = banners.find((b) => b.id === categoryId);
    if (existing) {
      onChange(banners.map((b) => (b.id === categoryId ? { ...b, imageUrl } : b)));
    } else {
      onChange([...banners, { id: categoryId, imageUrl }]);
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="body2" color="text.secondary">
        Cấu hình ảnh banner cho từng danh mục sản phẩm hiển thị trên trang chủ.
      </Typography>

      {categories.length === 0 && (
        <Alert severity="info">Đang tải danh sách danh mục...</Alert>
      )}

      {categories.map((cat) => (
        <Card key={cat.id} variant="outlined">
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle1" fontWeight={600}>
                {cat.nameVi}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                ({cat.nameEn}) — ID: {cat.id}
              </Typography>
            </Box>

            <TextField
              label="Image URL"
              placeholder="https://example.com/category-banner.jpg"
              value={getBanner(cat.id)}
              onChange={(e) => setBanner(cat.id, e.target.value)}
              fullWidth
              size="small"
            />

            {getBanner(cat.id) && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                  Xem trước:
                </Typography>
                <Box
                  component="img"
                  src={getBanner(cat.id)}
                  alt={`${cat.nameVi} banner preview`}
                  sx={{ maxHeight: 160, maxWidth: '100%', objectFit: 'cover', borderRadius: 1 }}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              </Box>
            )}

            {cat.subcategories.length > 0 && (
              <Typography variant="caption" color="text.secondary">
                Danh mục con: {cat.subcategories.map((s) => s.nameVi).join(', ')}
              </Typography>
            )}
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}

export function AdminStorefrontPanel({ toolDescription }: { toolDescription: string }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [config, setConfig] = useState<StorefrontConfig>(DEFAULT_CONFIG);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(apiUrl('/admin/storefront-config')).then((r) => r.json()),
      fetch(apiUrl('/store/categories')).then((r) => r.json()),
    ])
      .then(([cfg, cats]: [StorefrontConfig, StoreCategory[]]) => {
        setConfig(cfg);
        setCategories(Array.isArray(cats) ? cats : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!user?.token) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch(apiUrl('/admin/storefront-config'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? 'Lưu thất bại.');
      }
      const updated = await res.json() as StorefrontConfig;
      setConfig(updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu thất bại.');
    } finally {
      setSaving(false);
    }
  }

  if (!user) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>Admin Storefront</Typography>
        <Alert severity="warning" sx={{ mt: 2 }}>
          Vui lòng đăng nhập từ tab <strong>Admin</strong> để cấu hình storefront.
        </Alert>
      </Box>
    );
  }

  if (user.role !== 'admin') {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>Admin Storefront</Typography>
        <Alert severity="error" sx={{ mt: 2 }}>
          Chỉ tài khoản <strong>admin</strong> mới có thể cấu hình storefront.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 800 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
        <Box>
          <Typography variant="h5">Admin Storefront</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {toolDescription}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          onClick={handleSave}
          disabled={saving || loading}
        >
          Lưu
        </Button>
      </Box>

      <Divider sx={{ mb: 3, mt: 2 }} />

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }}>Đã lưu thành công!</Alert>}

          <Tabs value={activeTab} onChange={(_e, v: number) => setActiveTab(v)} sx={{ mb: 3 }}>
            <Tab label="Hero Banner" />
            <Tab label="Category Banners" />
          </Tabs>

          {activeTab === 0 && (
            <HeroBannerTab
              config={config.heroBanner}
              onChange={(updated) => setConfig((prev) => ({ ...prev, heroBanner: updated }))}
            />
          )}
          {activeTab === 1 && (
            <CategoryBannersTab
              banners={config.categoryBanners}
              categories={categories}
              onChange={(updated) => setConfig((prev) => ({ ...prev, categoryBanners: updated }))}
            />
          )}
        </>
      )}
    </Box>
  );
}
