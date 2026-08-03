'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { X, Package, Video, FileText, Camera, BookOpen, ChevronLeft, Upload, Check, AlertCircle, Tag, DollarSign, FolderOpen, Users, Percent } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { PageSkeleton } from '@/components/page-skeleton';
import { api, formatPrice, API_BASE } from '@/lib/api';
import { MagneticButton } from '@/components/animation-provider';

import { useScrollPreservation } from '@/components/global-state-provider';
type PostType = 'video' | 'photo' | 'text' | 'story';
type CreateMode = 'post' | 'product';

export default function CreatePage() {
  useScrollPreservation('create');

  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSeller, setIsSeller] = useState(false);
  const [checking, setChecking] = useState(true);
  const [products, setProducts] = useState<any[]>([]);

  // Top-level mode: post vs product
  const [mode, setMode] = useState<CreateMode>('post');

  // Post form state
  const [postType, setPostType] = useState<PostType>('photo');
  const [selectedProduct, setSelectedProduct] = useState<number | ''>('');
  const [caption, setCaption] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Product form state
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productCategory, setProductCategory] = useState('General');
  const [productDescription, setProductDescription] = useState('');
  const [productImage, setProductImage] = useState('');
  const [uploadingProductImage, setUploadingProductImage] = useState(false);
  const [groupBuyEnabled, setGroupBuyEnabled] = useState(false);
  const [groupBuyTarget, setGroupBuyTarget] = useState('3');
  const [groupBuyDiscount, setGroupBuyDiscount] = useState('20');
  const [creatingProduct, setCreatingProduct] = useState(false);
  const productImageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?next=/create');
      return;
    }
    if (user) {
      (async () => {
        try {
          const resp = await fetch(`${API_BASE}/api/seller-profile`, {
            credentials: 'include',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ op: 'get' }),
          });
          if (resp.ok) {
            const data = await resp.json();
            if (data.success && data.seller) {
              setIsSeller(true);
              // Fetch seller's products for the post dropdown
              const prodResp = await api.sellerProducts.list();
              if (prodResp.success) setProducts(prodResp.products || []);
            }
          }
        } catch {}
        setChecking(false);
      })();
    }
  }, [user, authLoading, router]);

  const postTypes = [
    { type: 'photo' as PostType, icon: Camera, label: 'Photo', desc: 'Share a product photo' },
    { type: 'video' as PostType, icon: Video, label: 'Video', desc: 'Showcase a product' },
    { type: 'text' as PostType, icon: FileText, label: 'Text', desc: 'Write about a product' },
    { type: 'story' as PostType, icon: BookOpen, label: 'Story', desc: '24h story post' },
  ];

  const categories = [
    'General', 'Electronics', 'Fashion', 'Beauty', 'Home & Kitchen',
    'Food & Grocery', 'Health', 'Sports', 'Books', 'Toys', 'Auto', 'Other',
  ];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        const isVideo = file.type.startsWith('video/');
        const endpoint = isVideo ? '/api/upload-video' : '/api/upload-image';
        const bodyKey = isVideo ? 'videoData' : 'imageData';
        const resp = await fetch(`${API_BASE}${endpoint}`, {
          credentials: 'include',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [bodyKey]: base64 }),
        });
        const data = await resp.json();
        if (data.success) {
          setMediaUrl(data.url);
          toast({ title: 'Upload complete!' });
        } else {
          toast({ title: 'Upload failed', description: data.error });
        }
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      toast({ title: 'Upload failed' });
      setUploading(false);
    }
  };

  const handleProductImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please choose an image' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Image too large', description: 'Max 5MB' });
      return;
    }
    setUploadingProductImage(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        const resp = await fetch(`${API_BASE}/api/upload-image`, {
          credentials: 'include',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageData: base64 }),
        });
        const data = await resp.json();
        if (data.success) {
          setProductImage(data.imageUrl);
          toast({ title: 'Image uploaded!' });
        } else {
          toast({ title: 'Upload failed', description: data.error });
        }
        setUploadingProductImage(false);
      };
      reader.readAsDataURL(file);
    } catch {
      toast({ title: 'Upload failed' });
      setUploadingProductImage(false);
    }
  };

  const handlePostSubmit = async () => {
    if (!selectedProduct) {
      toast({ title: 'Please select a product', description: 'Every post must have a product attached.' });
      return;
    }
    if (postType !== 'text' && !mediaUrl) {
      toast({ title: 'Please upload media', description: `${postType} posts require an image or video.` });
      return;
    }
    if (postType === 'text' && !caption.trim()) {
      toast({ title: 'Please write a caption', description: 'Text posts need a caption.' });
      return;
    }

    setPosting(true);
    try {
      const resp = await api.feedPosts.create({
        postType,
        productId: Number(selectedProduct),
        caption,
        mediaUrl,
      });
      if (resp.success) {
        toast({ title: 'Post created!', description: 'Your post is now live in the feed.' });
        router.push('/');
      } else {
        toast({ title: 'Failed to create post', description: resp.error });
      }
    } catch (err) {
      toast({ title: 'Failed to create post' });
    }
    setPosting(false);
  };

  const handleProductSubmit = async () => {
    if (!productName.trim()) {
      toast({ title: 'Product name required' });
      return;
    }
    const priceNum = Number(productPrice);
    if (!productPrice || isNaN(priceNum) || priceNum <= 0) {
      toast({ title: 'Valid price required' });
      return;
    }
    if (!productImage) {
      toast({ title: 'Product image required', description: 'Please upload at least one image.' });
      return;
    }
    if (groupBuyEnabled) {
      const tc = Number(groupBuyTarget);
      const dp = Number(groupBuyDiscount);
      if (isNaN(tc) || tc < 2) {
        toast({ title: 'Group buy target must be at least 2' });
        return;
      }
      if (isNaN(dp) || dp < 1 || dp > 99) {
        toast({ title: 'Discount must be 1-99%' });
        return;
      }
    }

    setCreatingProduct(true);
    try {
      const createResp = await api.sellerProducts.create({
        name: productName.trim(),
        price: priceNum,
        description: productDescription.trim(),
        category: productCategory,
        image_url: productImage,
      });

      if (!createResp.success) {
        toast({ title: 'Failed to create product', description: createResp.error });
        setCreatingProduct(false);
        return;
      }

      const newProductId = createResp.product?.id;

      // If group buy is enabled, enable it on the new product
      if (groupBuyEnabled && newProductId) {
        const gbResp = await fetch(`${API_BASE}/api/group-buy`, {
          credentials: 'include',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            op: 'enable',
            productId: newProductId,
            targetCount: Number(groupBuyTarget),
            discountPct: Number(groupBuyDiscount),
          }),
        });
        const gbData = await gbResp.json();
        if (!gbData.success) {
          toast({ title: 'Product created, but group buy setup failed', description: gbData.error });
        }
      }

      toast({
        title: 'Product created!',
        description: groupBuyEnabled ? 'Group buy is now active for this product.' : 'Your product is now live in your shop.',
      });
      router.push('/seller-dashboard');
    } catch (err) {
      toast({ title: 'Failed to create product' });
    }
    setCreatingProduct(false);
  };

  if (authLoading || checking) {
    return <PageSkeleton variant="create" />;
  }

  if (!isSeller) {
    return (
      <div className="min-h-screen bg-white">
        <div className="sticky top-0 z-30 bg-white border-b border-[#E5E7EB] px-4 h-14 flex items-center gap-2">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#F3F4F6]" aria-label="Back">
            <ChevronLeft className="w-5 h-5 text-[#111827]" />
          </button>
          <h1 className="text-base font-semibold flex-1 text-[#111827]">Create</h1>
        </div>
        <div className="p-8 text-center">
          <Package className="w-12 h-12 mx-auto mb-3 text-[#9CA3AF]" />
          <p className="text-sm mb-4 text-[#6B7280]">
            You need a seller account to create posts or products.
          </p>
          <button
            onClick={() => router.push('/become-seller')}
            className="bg-[#111827] btn-ripple  text-white text-sm font-semibold px-6 py-3 rounded-full"
          >
            Become a Seller
          </button>
        </div>
      </div>
    );
  }

  const inputClass = "w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-4 py-3 text-sm text-[#111827] outline-none focus:border-[#111827] focus:bg-white transition";

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-white border-b border-[#E5E7EB] px-4 h-14 flex items-center gap-2">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#F3F4F6]" aria-label="Back">
          <ChevronLeft className="w-5 h-5 text-[#111827]" />
        </button>
        <h1 className="text-base font-semibold flex-1 text-[#111827]">Create</h1>
        {mode === 'post' ? (
          <button
            onClick={handlePostSubmit}
            disabled={posting || uploading || !selectedProduct || (postType !== 'text' && !mediaUrl)}
            className="text-sm font-bold px-5 py-2 rounded-full bg-[#111827] btn-ripple  text-white disabled:opacity-40 transition"
          >
            {posting ? 'Posting...' : 'Post'}
          </button>
        ) : (
          <button
            onClick={handleProductSubmit}
            disabled={creatingProduct || uploadingProductImage || !productName || !productPrice || !productImage}
            className="text-sm font-bold px-5 py-2 rounded-full bg-[#111827] btn-ripple  text-white disabled:opacity-40 transition"
          >
            {creatingProduct ? 'Creating...' : 'Publish'}
          </button>
        )}
      </div>

      {/* Mode toggle — Post vs Product */}
      <div className="px-4 pt-4">
        <div className="bg-[#F3F4F6] rounded-full p-1 flex">
          <button
            onClick={() => setMode('post')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-semibold transition ${
              mode === 'post' ? 'bg-white text-[#111827] shadow-sm' : 'text-[#6B7280]'
            }`}
          >
            <Camera className="w-4 h-4" /> Post
          </button>
          <button
            onClick={() => setMode('product')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-semibold transition ${
              mode === 'product' ? 'bg-white text-[#111827] shadow-sm' : 'text-[#6B7280]'
            }`}
          >
            <Package className="w-4 h-4" /> Product
          </button>
        </div>
      </div>

      {/* ============ POST MODE ============ */}
      {mode === 'post' && (
        <div className="p-4 space-y-5">
          {/* Post type selector */}
          <div>
            <label className="text-xs font-semibold mb-2 block text-[#6B7280]">POST TYPE</label>
            <div className="grid grid-cols-4 gap-2">
              {postTypes.map((pt) => {
                const Icon = pt.icon;
                const active = postType === pt.type;
                return (
                  <button
                    key={pt.type}
                    onClick={() => { setPostType(pt.type); setMediaUrl(''); }}
                    className="flex flex-col items-center gap-1 py-3 rounded-xl border transition"
                    style={{
                      background: active ? '#111827' : '#F9FAFB',
                      borderColor: active ? '#111827' : '#E5E7EB',
                      color: active ? '#FFFFFF' : '#111827',
                    }}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-[10px] font-semibold">{pt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Product attachment */}
          <div>
            <label className="text-xs font-semibold mb-2 flex items-center gap-1 text-[#6B7280]">
              PRODUCT <span className="text-[#111827]">*</span>
              <span className="font-normal">(required)</span>
            </label>
            {products.length === 0 ? (
              <div className="p-4 rounded-xl text-center bg-[#F9FAFB] border border-[#E5E7EB]">
                <p className="text-xs mb-2 text-[#6B7280]">No products yet. Switch to "Product" tab to add one.</p>
                <button onClick={() => setMode('product')} className="text-xs font-bold text-[#111827] underline">
                  Add Product →
                </button>
              </div>
            ) : (
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value ? Number(e.target.value) : '')}
                className={inputClass}
              >
                <option value="">Select a product...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} — {formatPrice(p.price)}</option>
                ))}
              </select>
            )}
            {selectedProduct && (() => {
              const p = products.find((x) => x.id === Number(selectedProduct));
              if (!p) return null;
              return (
                <div className="mt-2 flex items-center gap-3 p-2 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB]">
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#F3F4F6] shrink-0">
                    {p.image_url && <img src={p.image_url} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold truncate text-[#111827]">{p.name}</div>
                    <div className="text-sm font-bold text-[#111827]">{formatPrice(p.price)}</div>
                  </div>
                  <Check className="w-4 h-4 text-[#111827]" />
                </div>
              );
            })()}
          </div>

          {/* Media upload */}
          {postType !== 'text' && (
            <div>
              <label className="text-xs font-semibold mb-2 block text-[#6B7280]">
                {postType === 'video' ? 'VIDEO' : 'PHOTO'} <span className="text-[#111827]">*</span>
              </label>
              {mediaUrl ? (
                <div className="relative rounded-xl overflow-hidden bg-[#F9FAFB] border border-[#E5E7EB]">
                  {postType === 'video' || mediaUrl.includes('.mp4') ? (
                    <video src={mediaUrl} className="w-full max-h-64 object-contain" controls />
                  ) : (
                    <img src={mediaUrl} alt="preview" className="w-full max-h-64 object-contain" />
                  )}
                  <button
                    onClick={() => setMediaUrl('')}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center"
                    aria-label="Remove media"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full py-8 rounded-xl border-2 border-dashed flex flex-col items-center gap-2 transition border-[#E5E7EB] text-[#6B7280] hover:border-[#111827] hover:text-[#111827]"
                >
                  {uploading ? (
                    <>
                      <div className="w-6 h-6 border-2 border-[#111827] border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs">Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-6 h-6" />
                      <span className="text-xs">Tap to upload {postType === 'video' ? 'a video' : 'an image'}</span>
                    </>
                  )}
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept={postType === 'video' ? 'video/*' : 'image/*'}
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          )}

          {/* Caption */}
          <div>
            <label className="text-xs font-semibold mb-2 block text-[#6B7280]">
              CAPTION {postType === 'text' && <span className="text-[#111827]">*</span>}
            </label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={postType === 'text' ? 'Write about your product...' : 'Add a caption...'}
              rows={postType === 'text' ? 6 : 3}
              maxLength={2000}
              className={inputClass + ' resize-none'}
            />
            <div className="text-right text-[10px] mt-1 text-[#6B7280]">
              {caption.length}/2000
            </div>
          </div>
        </div>
      )}

      {/* ============ PRODUCT MODE ============ */}
      {mode === 'product' && (
        <div className="p-4 space-y-5">
          {/* Image upload */}
          <div>
            <label className="text-xs font-semibold mb-2 block text-[#6B7280]">
              PRODUCT IMAGE <span className="text-[#111827]">*</span>
            </label>
            {productImage ? (
              <div className="relative rounded-xl overflow-hidden bg-[#F9FAFB] border border-[#E5E7EB]">
                <img src={productImage} alt="product" className="w-full max-h-64 object-contain" />
                <button
                  onClick={() => setProductImage('')}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center"
                  aria-label="Remove image"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
                <button
                  onClick={() => productImageInputRef.current?.click()}
                  className="absolute bottom-2 right-2 px-3 py-1.5 rounded-full bg-white/90 text-xs font-semibold text-[#111827]"
                >
                  Change
                </button>
              </div>
            ) : (
              <button
                onClick={() => productImageInputRef.current?.click()}
                disabled={uploadingProductImage}
                className="w-full py-10 rounded-xl border-2 border-dashed flex flex-col items-center gap-2 transition border-[#E5E7EB] text-[#6B7280] hover:border-[#111827] hover:text-[#111827]"
              >
                {uploadingProductImage ? (
                  <>
                    <div className="w-6 h-6 border-2 border-[#111827] border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs">Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-6 h-6" />
                    <span className="text-xs">Tap to upload product image</span>
                    <span className="text-[10px] text-[#9CA3AF]">Max 5MB</span>
                  </>
                )}
              </button>
            )}
            <input
              ref={productImageInputRef}
              type="file"
              accept="image/*"
              onChange={handleProductImageUpload}
              className="hidden"
            />
          </div>

          {/* Product name */}
          <div>
            <label className="text-xs font-semibold mb-2 block text-[#6B7280]">NAME <span className="text-[#111827]">*</span></label>
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="e.g. Wireless Earbuds Pro"
                className={inputClass + ' pl-10'}
                maxLength={200}
              />
            </div>
          </div>

          {/* Price + Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold mb-2 block text-[#6B7280]">PRICE (₦) <span className="text-[#111827]">*</span></label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                <input
                  type="number"
                  value={productPrice}
                  onChange={(e) => setProductPrice(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="any"
                  className={inputClass + ' pl-10'}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold mb-2 block text-[#6B7280]">CATEGORY</label>
              <div className="relative">
                <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] z-10" />
                <select
                  value={productCategory}
                  onChange={(e) => setProductCategory(e.target.value)}
                  className={inputClass + ' pl-10 appearance-none'}
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold mb-2 block text-[#6B7280]">DESCRIPTION</label>
            <textarea
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
              placeholder="Describe your product..."
              rows={4}
              maxLength={2000}
              className={inputClass + ' resize-none'}
            />
          </div>

          {/* Group buy toggle */}
          <div className="rounded-xl border border-[#E5E7EB] overflow-hidden">
            <button
              onClick={() => setGroupBuyEnabled(!groupBuyEnabled)}
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-[#F9FAFB] transition"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${groupBuyEnabled ? 'bg-[#111827]' : 'bg-[#F3F4F6]'}`}>
                <Users className={`w-5 h-5 ${groupBuyEnabled ? 'text-white' : 'text-[#6B7280]'}`} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-[#111827]">Enable Group Buy</div>
                <div className="text-xs text-[#6B7280]">Let buyers team up for a discount</div>
              </div>
              <div className={`w-11 h-6 rounded-full relative transition ${groupBuyEnabled ? 'bg-[#111827]' : 'bg-[#E5E7EB]'}`}>
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition ${groupBuyEnabled ? 'left-[22px]' : 'left-0.5'}`} />
              </div>
            </button>

            {groupBuyEnabled && (
              <div className="px-4 pb-4 pt-2 border-t border-[#E5E7EB] bg-[#F9FAFB] grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold mb-1 flex items-center gap-1 text-[#6B7280]">
                    <Users className="w-3 h-3" /> BUYERS NEEDED
                  </label>
                  <input
                    type="number"
                    value={groupBuyTarget}
                    onChange={(e) => setGroupBuyTarget(e.target.value)}
                    min="2"
                    max="1000"
                    className={inputClass + ' py-2'}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold mb-1 flex items-center gap-1 text-[#6B7280]">
                    <Percent className="w-3 h-3" /> DISCOUNT %
                  </label>
                  <input
                    type="number"
                    value={groupBuyDiscount}
                    onChange={(e) => setGroupBuyDiscount(e.target.value)}
                    min="1"
                    max="99"
                    className={inputClass + ' py-2'}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Info notice */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-[#FFF7ED] border border-[#FED7AA]">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#9A3412]" />
            <p className="text-xs text-[#9A3412]">
              Your product will be live in your shop immediately. Buyers can purchase it or start a group buy (if enabled).
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
