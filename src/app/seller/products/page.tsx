'use client';

import { useEffect, useState, useRef } from 'react';
import { api, formatPrice, type Product } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Search, Store, Package, Users, Upload, Loader2, X, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { EmptyState } from '@/components/product-card';
import { PageSkeleton } from '@/components/page-skeleton';
import { API_BASE } from '@/lib/api';

import { usePersistedState, useScrollPreservation } from '@/components/global-state-provider';
const CATEGORIES = ['Electronics', 'Fashion', 'Home', 'Beauty', 'Farm', 'Sports', 'Books', 'Food', 'Toys'];

export default function SellerProductsPage() {
  useScrollPreservation('seller-products');

  const { toast } = useToast();
  const [products, setProducts] = usePersistedState<Product[]>('seller-products:data', []);
  const [loading, setLoading] = useState(products.length === 0);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Electronics');

  // Image upload — IG Create style. We support up to 4 images.
  // The first image becomes image_url; the rest go into additional_images.
  const [images, setImages] = useState<string[]>([]); // array of URLs (either uploaded /api/image?id=... or existing https://...)
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Video upload — same as before
  const [videoUrl, setVideoUrl] = useState('');
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [groupBuyEnabled, setGroupBuyEnabled] = useState(false);
  const [groupBuyTarget, setGroupBuyTarget] = useState('3');
  const [groupBuyDiscount, setGroupBuyDiscount] = useState('20');

  const load = async () => {
    setLoading(true);
    const result = await api.sellerProducts.list();
    if (result.success) setProducts(result.products || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setName(''); setPrice(''); setDescription(''); setCategory('Electronics');
    setImages([]); setVideoUrl('');
    setGroupBuyEnabled(false); setGroupBuyTarget('3'); setGroupBuyDiscount('20');
  };

  const openCreate = () => {
    setEditing(null);
    resetForm();
    setOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setName(p.name); setPrice(String(p.price)); setDescription(p.description || '');
    setCategory(p.category || 'Electronics');
    // Load existing images: first image_url, then any additional_images
    const additional = (p as any).additional_images;
    const allImages = [
      ...(p.image_url ? [p.image_url] : []),
      ...(Array.isArray(additional) ? additional : []),
    ];
    setImages(allImages);
    setVideoUrl((p as any).video_url || '');
    setGroupBuyEnabled((p as any).group_buy_enabled || false);
    setGroupBuyTarget(String((p as any).group_buy_target_count || 3));
    setGroupBuyDiscount(String((p as any).group_buy_discount_pct || 20));
    setOpen(true);
  };

  const handleImageUpload = async (files: FileList) => {
    if (!files || files.length === 0) return;
    if (images.length + files.length > 4) {
      toast({ title: 'Max 4 images', description: 'You can upload up to 4 images per product', variant: 'destructive' });
      return;
    }

    setUploadingImage(true);
    const newUrls: string[] = [];

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        toast({ title: 'Invalid file', description: `${file.name} is not an image`, variant: 'destructive' });
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: 'Image too large', description: `${file.name} is over 5MB`, variant: 'destructive' });
        continue;
      }

      // Read as data URL, then upload to /api/upload-image
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      try {
        const resp = await fetch(`${API_BASE}/api/upload-image`, {
      credentials: 'include',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: editing?.id,
            imageData: dataUrl,
          }),
        });
        const data = await resp.json();
        if (data.success) {
          newUrls.push(data.imageUrl);
        } else {
          toast({ title: 'Upload failed', description: data.error, variant: 'destructive' });
        }
      } catch (err) {
        toast({ title: 'Upload failed', description: String(err), variant: 'destructive' });
      }
    }

    if (newUrls.length > 0) {
      setImages(prev => [...prev, ...newUrls]);
      toast({ title: 'Image uploaded', description: `${newUrls.length} image(s) added` });
    }
    setUploadingImage(false);
    // Reset the file input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  const handleVideoUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Video too large', description: 'Max 10MB', variant: 'destructive' });
      return;
    }
    setUploadingVideo(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        if (!editing) {
          // For new products, store the data URL temporarily — it'll be saved
          // when the product is created. (Same pattern as before.)
          setVideoUrl(reader.result as string);
          setUploadingVideo(false);
        } else {
          const resp = await fetch(`${API_BASE}/api/upload-video`, {
      credentials: 'include',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId: editing.id, videoData: reader.result }),
          });
          const data = await resp.json();
          if (data.success) {
            setVideoUrl(data.videoUrl);
            toast({ title: 'Video uploaded!' });
          } else {
            toast({ title: 'Upload failed', description: data.error, variant: 'destructive' });
          }
          setUploadingVideo(false);
        }
      } catch {
        setUploadingVideo(false);
        toast({ title: 'Upload failed', variant: 'destructive' });
      }
    };
    reader.readAsDataURL(file);
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const save = async () => {
    if (!name || !price) {
      toast({ title: 'Missing fields', description: 'Name and price are required', variant: 'destructive' });
      return;
    }
    if (images.length === 0) {
      toast({ title: 'Add at least one image', description: 'Upload a product photo from your device', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const additional = images.slice(1); // first image is image_url, rest are additional_images
    const data: any = {
      name,
      price: Number(price),
      description,
      category,
      image_url: images[0],
      additional_images: additional.length > 0 ? additional : undefined,
      video_url: videoUrl || undefined,
    };
    const result = editing
      ? await api.sellerProducts.update(editing.id, data)
      : await api.sellerProducts.create(data);
    setSaving(false);
    if (result.success) {
      // Update group buy settings via the group-buy API
      if (groupBuyEnabled) {
        await fetch(`${API_BASE}/api/group-buy`, {
      credentials: 'include',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ op: 'enable', productId: result.product?.id || editing?.id, targetCount: Number(groupBuyTarget), discountPct: Number(groupBuyDiscount) }),
        });
      } else if (editing) {
        await fetch(`${API_BASE}/api/group-buy`, {
      credentials: 'include',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ op: 'disable', productId: editing.id }),
        });
      }
      toast({ title: editing ? 'Product updated' : 'Product created' });
      setOpen(false);
      load();
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this product?')) return;
    const result = await api.sellerProducts.delete(id);
    if (result.success) {
      toast({ title: 'Deleted' });
      load();
    }
  };

  const filtered = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold">Products</h1>
        <Button onClick={openCreate} className="bg-[#111827] btn-ripple  text-black hover:bg-[#F5F5F5] font-bold">
          <Plus className="w-4 h-4 mr-1" /> Add product
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666666]" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products..."
          className="pl-9"
        />
      </div>

      {loading ? (<PageSkeleton variant="seller-products" />) : filtered.length === 0 ? (
        <EmptyState
          icon={<Package className="w-8 h-8" />}
          title="No products yet"
          message="Add your first product to start selling on Cellex."
          action={<Button onClick={openCreate} className="bg-[#111827] btn-ripple  text-black hover:bg-[#F5F5F5]">Add product</Button>}
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
          {filtered.map((p) => (
            <div key={p.id} className="overflow-hidden bg-[#F5F5F5] border border-[#E5E5E5] rounded-lg">
              <div className="aspect-square bg-[#F5F5F5] relative">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#666666]">
                    <Store className="w-10 h-10" />
                  </div>
                )}
                <div className="absolute top-1.5 right-1.5 flex gap-1">
                  <button
                    onClick={() => openEdit(p)}
                    className="bg-white/90 backdrop-blur p-1.5 rounded-lg shadow hover:bg-[#F5F5F5]"
                    aria-label="Edit"
                  >
                    <Edit className="w-3.5 h-3.5 text-[#666666]" />
                  </button>
                  <button
                    onClick={() => remove(p.id)}
                    className="bg-white/90 backdrop-blur p-1.5 rounded-lg shadow hover:bg-[#F5F5F5]"
                    aria-label="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </button>
                </div>
              </div>
              <div className="p-2 sm:p-3">
                <h3 className="font-semibold text-xs sm:text-sm line-clamp-1">{p.name}</h3>
                <div className="flex items-center justify-between mt-1">
                  <span className="font-bold text-sm text-black">{formatPrice(p.price)}</span>
                  <span className="text-[10px] text-[#666666]">{p.units_sold || 0} sold</span>
                </div>
                {p.category && (
                  <span className="inline-block mt-1.5 text-[9px] bg-[#F5F5F5] px-1.5 py-0.5 rounded text-[#666666]">{p.category}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit dialog — Instagram Create style */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit product' : 'Add new product'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {/* Image upload — Instagram Create style */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Product photos *</Label>
              <p className="text-[11px] text-[#666666] -mt-1">Upload from your device. First photo is the cover. Max 4 photos.</p>

              {images.length > 0 && (
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {images.map((url, idx) => (
                    <div key={idx} className="relative aspect-square rounded-md overflow-hidden bg-[#F5F5F5] group">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      {idx === 0 && (
                        <span className="absolute top-1 left-1 bg-[#111827] btn-ripple  text-black text-[8px] font-bold px-1 py-0.5 rounded">COVER</span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-black flex items-center justify-center hover:bg-[#111827] btn-ripple "
                        aria-label="Remove image"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {images.length < 4 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="w-full border-2 border-dashed border-white/15 rounded-xl p-6 flex flex-col items-center justify-center hover:border-[#E5E5E5] hover:bg-[#F5F5F5] transition-colors disabled:opacity-50"
                >
                  {uploadingImage ? (
                    <>
                      <Loader2 className="w-7 h-7 text-[#666666] animate-spin mb-2" />
                      <span className="text-xs text-[#666666]">Uploading...</span>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-full bg-[#F5F5F5] flex items-center justify-center mb-2">
                        <ImageIcon className="w-6 h-6 text-[#666666]" />
                      </div>
                      <span className="text-sm font-semibold text-black">Upload photos</span>
                      <span className="text-[11px] text-[#666666] mt-0.5">Tap to choose from your device</span>
                      <span className="text-[10px] text-[#666666] mt-0.5">JPG, PNG, WebP · Max 5MB each</span>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => e.target.files && handleImageUpload(e.target.files)}
                  />
                </button>
              )}
            </div>

            {/* Video upload */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Product video (optional)</Label>
              <p className="text-[11px] text-[#666666] -mt-1">Show authenticity. Max 10MB.</p>
              {videoUrl ? (
                <div className="flex items-center gap-3">
                  <video src={videoUrl} className="w-20 h-20 rounded-lg object-cover bg-[#111827] btn-ripple " muted />
                  <button
                    type="button"
                    onClick={() => setVideoUrl('')}
                    className="text-xs text-red-500 font-medium"
                  >
                    Remove video
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  disabled={uploadingVideo}
                  className="w-full border-2 border-dashed border-white/15 rounded-xl p-4 flex items-center justify-center gap-2 hover:border-[#E5E5E5] hover:bg-[#F5F5F5] transition-colors disabled:opacity-50"
                >
                  {uploadingVideo ? (
                    <>
                      <Loader2 className="w-5 h-5 text-[#666666] animate-spin" />
                      <span className="text-xs text-[#666666]">Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5 text-[#666666]" />
                      <span className="text-xs text-[#666666] font-medium">Upload a video</span>
                    </>
                  )}
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleVideoUpload(e.target.files[0])}
                  />
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Product name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. iPhone 15 Pro Max" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Price (₦) *</Label>
                <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="50000" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Category</Label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg text-sm bg-[#F5F5F5]"
                >
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Describe your product..." />
            </div>

            {/* Group Buy Toggle */}
            <div className="border-t border-[#E5E5E5] pt-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#666666]" />
                  <div>
                    <Label className="text-xs font-bold">Enable Group Buy</Label>
                    <p className="text-[10px] text-[#666666]">Let buyers team up for bulk discounts</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setGroupBuyEnabled(!groupBuyEnabled)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${groupBuyEnabled ? 'bg-[#111827]' : 'bg-[#F5F5F5]'}`}
                  aria-label="Toggle group buy"
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${groupBuyEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
              {groupBuyEnabled && (
                <div className="grid grid-cols-2 gap-3 pl-6">
                  <div className="space-y-1.5">
                    <Label className="text-xs">People needed</Label>
                    <Input type="number" value={groupBuyTarget} onChange={(e) => setGroupBuyTarget(e.target.value)} placeholder="3" min="2" max="100" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Discount %</Label>
                    <Input type="number" value={groupBuyDiscount} onChange={(e) => setGroupBuyDiscount(e.target.value)} placeholder="20" min="5" max="80" />
                  </div>
                </div>
              )}
            </div>

            <Button onClick={save} disabled={saving} className="w-full bg-[#111827] btn-ripple  text-black hover:bg-[#F5F5F5] font-bold">
              {saving ? 'Saving...' : editing ? 'Update product' : 'Create product'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
