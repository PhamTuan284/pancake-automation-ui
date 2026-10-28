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
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';
import SearchIcon from '@mui/icons-material/Search';
import { useAuth } from '../../context/AuthContext';
import { SESSION_EXPIRED_MESSAGE } from '../../lib/authFetch';

// ─── storefront API helpers ─────────────────────────────────────────────────
// storefront.routes.ts hardcodes an `/api/` prefix on every route (shared with the
// customer-facing meit-storefront app), unlike the rest of this app's routes.
// The shared apiUrl()/authFetch() helpers and this app's vite proxy assume no
// `/api/` prefix, so storefront calls need their own origin + prefix here.
const STOREFRONT_API_ORIGIN =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') || 'http://localhost:4001';

function storefrontApiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${STOREFRONT_API_ORIGIN}/api${p}`;
}

async function storefrontAuthFetch(
  path: string,
  token: string,
  logout: (reason?: string) => void,
  init: RequestInit = {}
): Promise<Response | null> {
  const res = await fetch(storefrontApiUrl(path), {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    logout(SESSION_EXPIRED_MESSAGE);
    return null;
  }
  return res;
}

// ─── local types ────────────────────────────────────────────────────────────

type HeroBannerConfig = { videoUrl: string; posterUrl: string };
type ImageOverride = { id: string; imageUrl: string };
type CostPriceOverride = { id: string; costPrice: number };

type StorefrontConfig = {
  heroBanner: HeroBannerConfig;
  categoryBanners: ImageOverride[];
  productImageOverrides: ImageOverride[];
  variantImageOverrides: ImageOverride[];
  productCostPrices: CostPriceOverride[];
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
  productCostPrices: [],
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
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{cat.nameVi}</Typography>
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

// ─── shared product catalog (fetched once, reused by Product Images + Giá nhập tabs) ──

function useProductCatalog(token: string | undefined, logout: (reason?: string) => void) {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPage = useCallback((q: string, pg: number, append: boolean) => {
    setLoadingProducts(true);
    const params = new URLSearchParams({ pageSize: '20', page: String(pg) });
    if (q) params.set('search', q);
    return fetch(storefrontApiUrl(`/store/products?${params}`))
      .then((r) => r.json())
      .then((data: { products: Product[]; total: number }) => {
        setProducts((prev) => (append ? [...prev, ...data.products] : data.products));
        setTotal(data.total);
      })
      .catch(() => {})
      .finally(() => setLoadingProducts(false));
  }, []);

  // Runs once — this hook lives in the parent, so it survives tab switches
  // instead of refetching every time Product Images / Giá nhập is reselected.
  useEffect(() => {
    void fetchPage('', 1, false);
  }, [fetchPage]);

  function handleSearchChange(value: string) {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      void fetchPage(value, 1, false);
    }, 400);
  }

  function loadMore() {
    const nextPage = page + 1;
    setPage(nextPage);
    void fetchPage(search, nextPage, true);
  }

  async function refresh() {
    setRefreshing(true);
    try {
      if (token) {
        await storefrontAuthFetch('/store/cache/invalidate', token, logout, { method: 'POST' });
      }
      setPage(1);
      await fetchPage(search, 1, false);
    } finally {
      setRefreshing(false);
    }
  }

  return { products, total, search, loadingProducts, refreshing, handleSearchChange, loadMore, refresh };
}

function ProductSearchBar({
  search,
  onSearchChange,
  onRefresh,
  refreshing,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <Box sx={{ display: 'flex', gap: 1 }}>
      <TextField
        placeholder="Tìm sản phẩm theo tên..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        fullWidth
        size="small"
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
      />
      <Button
        variant="outlined"
        onClick={onRefresh}
        disabled={refreshing}
        startIcon={refreshing ? <CircularProgress size={16} /> : <RefreshIcon />}
        sx={{ flexShrink: 0 }}
      >
        Làm mới
      </Button>
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
        slotProps={{
          input: value
            ? {
                endAdornment: (
                  <InputAdornment position="end">
                    <Chip label="Override" size="small" color="primary" />
                  </InputAdornment>
                ),
              }
            : {},
        }}
      />
      {activeImage && <ImagePreview src={activeImage} />}
    </Box>
  );
}

function ProductImagesTab({
  products,
  total,
  search,
  loadingProducts,
  refreshing,
  onSearchChange,
  onLoadMore,
  onRefresh,
  productOverrides,
  variantOverrides,
  onProductOverride,
  onVariantOverride,
}: {
  products: Product[];
  total: number;
  search: string;
  loadingProducts: boolean;
  refreshing: boolean;
  onSearchChange: (value: string) => void;
  onLoadMore: () => void;
  onRefresh: () => void;
  productOverrides: ImageOverride[];
  variantOverrides: ImageOverride[];
  onProductOverride: (id: string, imageUrl: string) => void;
  onVariantOverride: (id: string, imageUrl: string) => void;
}) {
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

      <ProductSearchBar search={search} onSearchChange={onSearchChange} onRefresh={onRefresh} refreshing={refreshing} />

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
                <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{product.name}</Typography>
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
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 1, display: 'block' }}>
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
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 1, display: 'block' }}>
                    ẢNH BIẾN THỂ
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {product.variants.map((variant) => (
                      <Card key={variant.id} variant="outlined" sx={{ p: 1.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
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
          onClick={onLoadMore}
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

// ─── Product Cost Price tab ───────────────────────────────────────────────────

function ProductCostPriceTab({
  products,
  total,
  search,
  loadingProducts,
  refreshing,
  onSearchChange,
  onLoadMore,
  onRefresh,
  costPrices,
  onChange,
}: {
  products: Product[];
  total: number;
  search: string;
  loadingProducts: boolean;
  refreshing: boolean;
  onSearchChange: (value: string) => void;
  onLoadMore: () => void;
  onRefresh: () => void;
  costPrices: CostPriceOverride[];
  onChange: (id: string, costPrice: number) => void;
}) {
  function getCostPrice(id: string) {
    return costPrices.find((o) => o.id === id)?.costPrice ?? '';
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="body2" color="text.secondary">
        Nhập giá nhập (giá vốn) cho từng sản phẩm. Dữ liệu này chỉ admin xem được, không hiển thị cho khách hàng trên storefront.
      </Typography>

      <ProductSearchBar search={search} onSearchChange={onSearchChange} onRefresh={onRefresh} refreshing={refreshing} />

      {loadingProducts && products.length === 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={32} />
        </Box>
      )}

      {products.map((product) => {
        const value = getCostPrice(product.id);
        return (
          <Card key={product.id} variant="outlined">
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {product.images[0] && (
                <Box
                  component="img"
                  src={product.images[0]}
                  alt=""
                  sx={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 0.5, flexShrink: 0 }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{product.name}</Typography>
                <Typography variant="caption" color="text.secondary">ID: {product.id}</Typography>
              </Box>
              <TextField
                label="Giá nhập"
                type="number"
                value={value}
                onChange={(e) => onChange(product.id, Number(e.target.value))}
                size="small"
                sx={{ width: 180 }}
                slotProps={{
                  input: {
                    endAdornment: <InputAdornment position="end">đ</InputAdornment>,
                  },
                }}
              />
            </CardContent>
          </Card>
        );
      })}

      {products.length < total && (
        <Button
          variant="outlined"
          onClick={onLoadMore}
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
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [config, setConfig] = useState<StorefrontConfig>(DEFAULT_CONFIG);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const catalog = useProductCatalog(user?.token, logout);

  useEffect(() => {
    if (!user?.token) {
      setLoading(false);
      return;
    }
    Promise.all([
      storefrontAuthFetch('/admin/storefront-config', user.token, logout).then((r) => r?.json() ?? DEFAULT_CONFIG),
      fetch(storefrontApiUrl('/store/categories')).then((r) => r.json()),
    ])
      .then(([cfg, cats]: [StorefrontConfig, StoreCategory[]]) => {
        setConfig({ ...DEFAULT_CONFIG, ...cfg });
        setCategories(Array.isArray(cats) ? cats : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.token, logout]);

  async function handleSave() {
    if (!user?.token) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await storefrontAuthFetch('/admin/storefront-config', user.token, logout, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!res) return;
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

  function handleCostPriceOverride(id: string, costPrice: number) {
    setConfig((prev) => {
      const exists = prev.productCostPrices.find((o) => o.id === id);
      const updated = exists
        ? prev.productCostPrices.map((o) => (o.id === id ? { id, costPrice } : o))
        : [...prev.productCostPrices, { id, costPrice }];
      return { ...prev, productCostPrices: updated };
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
            <Tab label="Giá nhập" />
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
              products={catalog.products}
              total={catalog.total}
              search={catalog.search}
              loadingProducts={catalog.loadingProducts}
              refreshing={catalog.refreshing}
              onSearchChange={catalog.handleSearchChange}
              onLoadMore={catalog.loadMore}
              onRefresh={catalog.refresh}
              productOverrides={config.productImageOverrides}
              variantOverrides={config.variantImageOverrides}
              onProductOverride={handleProductOverride}
              onVariantOverride={handleVariantOverride}
            />
          )}
          {activeTab === 3 && (
            <ProductCostPriceTab
              products={catalog.products}
              total={catalog.total}
              search={catalog.search}
              loadingProducts={catalog.loadingProducts}
              refreshing={catalog.refreshing}
              onSearchChange={catalog.handleSearchChange}
              onLoadMore={catalog.loadMore}
              onRefresh={catalog.refresh}
              costPrices={config.productCostPrices}
              onChange={handleCostPriceOverride}
            />
          )}
        </>
      )}
    </Box>
  );
}
