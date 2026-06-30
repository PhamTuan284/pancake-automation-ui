import { useCallback, useEffect, useRef, useState } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import InputAdornment from '@mui/material/InputAdornment';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SaveIcon from '@mui/icons-material/Save';
import SearchIcon from '@mui/icons-material/Search';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../lib/api';

// ─── local types ────────────────────────────────────────────────────────────

type HeroBannerConfig = { videoUrl: string; posterUrl: string };
type ImageOverride = { id: string; imageUrl: string };

type StorefrontConfig = {
  heroBanner: HeroBannerConfig;
  categoryBanners: ImageOverride[];
  productImageOverrides: ImageOverride[];
  variantImageOverrides: ImageOverride[];
};

type Variant = {
  id: string;
  name: string;
  images: string[];
  fields: { name: string; value: string }[];
};

type Product = {
  id: string;
  name: string;
  images: string[];
  variants: Variant[];
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
  productImageOverrides: [],
  variantImageOverrides: [],
};

// ─── helpers ─────────────────────────────────────────────────────────────────

function ImagePreview({ src }: { src: string }) {
  const [show, setShow] = useState(true);
  if (!src || !show) return null;
  return (
    <Box
      component="img"
      src={src}
      alt="preview"
      sx={{ maxHeight: 140, maxWidth: '100%', objectFit: 'cover', borderRadius: 1, mt: 1 }}
      onError={() => setShow(false)}
    />
  );
}

// ─── Hero Banner tab ─────────────────────────────────────────────────────────

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
            helperText="URL file video MP4. Để trống để dùng biến môi trường VITE_HERO_VIDEO_URL."
          />
          <TextField
            label="Poster Image URL (ảnh preview)"
            placeholder="https://example.com/poster.jpg"
            value={config.posterUrl}
            onChange={(e) => onChange({ ...config, posterUrl: e.target.value })}
            fullWidth
            helperText="Ảnh hiển thị trong khi video đang tải."
          />
          <ImagePreview src={config.posterUrl} />
        </CardContent>
      </Card>
    </Box>
  );
}

// ─── Category Banners tab ─────────────────────────────────────────────────────

function CategoryBannersTab({
  banners,
  categories,
  onChange,
}: {
  banners: ImageOverride[];
  categories: StoreCategory[];
  onChange: (updated: ImageOverride[]) => void;
}) {
  function getBanner(id: string) {
    return banners.find((b) => b.id === id)?.imageUrl ?? '';
  }

  function setBanner(id: string, imageUrl: string) {
    const exists = banners.find((b) => b.id === id);
    if (exists) {
      onChange(banners.map((b) => (b.id === id ? { id, imageUrl } : b)));
    } else {
      onChange([...banners, { id, imageUrl }]);
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="body2" color="text.secondary">
        Cấu hình ảnh banner cho từng danh mục sản phẩm hiển thị trên trang chủ.
      </Typography>
      {categories.length === 0 && <Alert severity="info">Đang tải danh sách danh mục...</Alert>}
      {categories.map((cat) => (
        <Card key={cat.id} variant="outlined">
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle1" fontWeight={600}>{cat.nameVi}</Typography>
              <Typography variant="caption" color="text.secondary">
                ({cat.nameEn}) · {cat.id}
              </Typography>
            </Box>
            <TextField
              label="Image URL"
              placeholder="https://example.com/banner.jpg"
              value={getBanner(cat.id)}
              onChange={(e) => setBanner(cat.id, e.target.value)}
              fullWidth
              size="small"
            />
            <ImagePreview src={getBanner(cat.id)} />
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

// ─── Product Images tab ───────────────────────────────────────────────────────

function OverrideField({
  label,
  value,
  onChange,
  pancakeImages,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  pancakeImages: string[];
}) {
  const activeImage = value || pancakeImages[0] || '';
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <TextField
        label={label}
        placeholder="https://example.com/image.jpg (để trống = dùng ảnh Pancake)"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        fullWidth
        size="small"
        helperText={
          value
            ? 'Override đang hoạt động'
            : pancakeImages.length > 0
            ? `Đang dùng ảnh Pancake (${pancakeImages.length} ảnh)`
            : 'Không có ảnh từ Pancake'
        }
        InputProps={
          value
            ? {
                endAdornment: (
                  <InputAdornment position="end">
                    <Chip label="Override" size="small" color="primary" />
                  </InputAdornment>
                ),
              }
            : undefined
        }
      />
      {activeImage && <ImagePreview src={activeImage} />}
    </Box>
  );
}

function ProductImagesTab({
  productOverrides,
  variantOverrides,
  onProductOverride,
  onVariantOverride,
}: {
  productOverrides: ImageOverride[];
  variantOverrides: ImageOverride[];
  onProductOverride: (id: string, imageUrl: string) => void;
  onVariantOverride: (id: string, imageUrl: string) => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loadingProducts, setLoadingProducts] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPage = useCallback((q: string, pg: number, append: boolean) => {
    setLoadingProducts(true);
    const params = new URLSearchParams({ pageSize: '20', page: String(pg) });
    if (q) params.set('search', q);
    fetch(apiUrl(`/store/products?${params}`))
      .then((r) => r.json())
      .then((data: { products: Product[]; total: number }) => {
        setProducts((prev) => (append ? [...prev, ...data.products] : data.products));
        setTotal(data.total);
      })
      .catch(() => {})
      .finally(() => setLoadingProducts(false));
  }, []);

  useEffect(() => {
    fetchPage('', 1, false);
  }, [fetchPage]);

  function handleSearchChange(value: string) {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      fetchPage(value, 1, false);
    }, 400);
  }

  function loadMore() {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPage(search, nextPage, true);
  }

  function getProductOverride(id: string) {
    return productOverrides.find((o) => o.id === id)?.imageUrl ?? '';
  }
  function getVariantOverride(id: string) {
    return variantOverrides.find((o) => o.id === id)?.imageUrl ?? '';
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="body2" color="text.secondary">
        Đặt ảnh override cho từng sản phẩm và biến thể. Nếu để trống, hệ thống dùng ảnh từ Pancake.
      </Typography>

      <TextField
        placeholder="Tìm sản phẩm theo tên..."
        value={search}
        onChange={(e) => handleSearchChange(e.target.value)}
        fullWidth
        size="small"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
      />

      {loadingProducts && products.length === 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={32} />
        </Box>
      )}

      {products.map((product) => (
        <Accordion key={product.id} variant="outlined" disableGutters>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
              {(getProductOverride(product.id) || product.images[0]) && (
                <Box
                  component="img"
                  src={getProductOverride(product.id) || product.images[0]}
                  alt=""
                  sx={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 0.5, flexShrink: 0 }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" fontWeight={600} noWrap>{product.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  ID: {product.id} · {product.variants.length} biến thể
                  {getProductOverride(product.id) && (
                    <Chip label="Override" size="small" color="primary" sx={{ ml: 1, height: 16, fontSize: 10 }} />
                  )}
                </Typography>
              </Box>
            </Box>
          </AccordionSummary>

          <AccordionDetails>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* Product-level image override */}
              <Box>
                <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                  ẢNH SẢN PHẨM (CHÍNH)
                </Typography>
                <OverrideField
                  label="Override ảnh sản phẩm"
                  value={getProductOverride(product.id)}
                  onChange={(v) => onProductOverride(product.id, v)}
                  pancakeImages={product.images}
                />
              </Box>

              {/* Variant overrides */}
              {product.variants.length > 0 && (
                <Box>
                  <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                    ẢNH BIẾN THỂ
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {product.variants.map((variant) => (
                      <Card key={variant.id} variant="outlined" sx={{ p: 1.5 }}>
                        <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>
                          {variant.name || variant.fields.map((f) => `${f.name}: ${f.value}`).join(' · ') || variant.id}
                          {getVariantOverride(variant.id) && (
                            <Chip label="Override" size="small" color="primary" sx={{ ml: 1, height: 16, fontSize: 10 }} />
                          )}
                        </Typography>
                        <OverrideField
                          label="Override ảnh biến thể"
                          value={getVariantOverride(variant.id)}
                          onChange={(v) => onVariantOverride(variant.id, v)}
                          pancakeImages={variant.images}
                        />
                      </Card>
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          </AccordionDetails>
        </Accordion>
      ))}

      {products.length < total && (
        <Button
          variant="outlined"
          onClick={loadMore}
          disabled={loadingProducts}
          startIcon={loadingProducts ? <CircularProgress size={16} /> : undefined}
        >
          Tải thêm ({products.length}/{total})
        </Button>
      )}

      {!loadingProducts && products.length === 0 && (
        <Alert severity="info">Không tìm thấy sản phẩm nào.</Alert>
      )}
    </Box>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

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
        setConfig({ ...DEFAULT_CONFIG, ...cfg });
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
      const updated = (await res.json()) as StorefrontConfig;
      setConfig({ ...DEFAULT_CONFIG, ...updated });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu thất bại.');
    } finally {
      setSaving(false);
    }
  }

  function handleProductOverride(id: string, imageUrl: string) {
    setConfig((prev) => {
      const exists = prev.productImageOverrides.find((o) => o.id === id);
      const updated = exists
        ? prev.productImageOverrides.map((o) => (o.id === id ? { id, imageUrl } : o))
        : [...prev.productImageOverrides, { id, imageUrl }];
      return { ...prev, productImageOverrides: updated };
    });
  }

  function handleVariantOverride(id: string, imageUrl: string) {
    setConfig((prev) => {
      const exists = prev.variantImageOverrides.find((o) => o.id === id);
      const updated = exists
        ? prev.variantImageOverrides.map((o) => (o.id === id ? { id, imageUrl } : o))
        : [...prev.variantImageOverrides, { id, imageUrl }];
      return { ...prev, variantImageOverrides: updated };
    });
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
    <Box sx={{ p: 3, maxWidth: 860 }}>
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
            <Tab label="Product Images" />
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
          {activeTab === 2 && (
            <ProductImagesTab
              productOverrides={config.productImageOverrides}
              variantOverrides={config.variantImageOverrides}
              onProductOverride={handleProductOverride}
              onVariantOverride={handleVariantOverride}
            />
          )}
        </>
      )}
    </Box>
  );
}
