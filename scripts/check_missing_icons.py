#!/usr/bin/env python3
"""Scan all .tsx files in src/ for lucide-react icons that are USED but NOT IMPORTED.

Catches the same class of bug that just crashed the homepage (Sparkles used but not imported).
"""
import re
import os
from pathlib import Path

SRC_DIR = Path('/home/z/my-project/src')

# Match: <SomeIcon ... /> OR <SomeIcon> ... </SomeIcon>
# PascalCase tag that does NOT start with a lowercase letter
TAG_RE = re.compile(r'<([A-Z][a-zA-Z0-9]+)[\s/>]')

problems = []

for tsx in SRC_DIR.rglob('*.tsx'):
    rel = tsx.relative_to(SRC_DIR)
    text = tsx.read_text(encoding='utf-8', errors='ignore')

    # Find all lucide-react import statements in this file
    # e.g. import { A, B, C } from 'lucide-react'
    lucide_imports = set()
    for m in re.finditer(r"from\s+['\"]lucide-react['\"]", text):
        # Walk backwards to find the matching import { ... }
        start = text.rfind('{', 0, m.start())
        end = text.find('}', start)
        if start == -1 or end == -1:
            continue
        # Handle multiline: just take what's between { and }
        inner = text[start+1:end]
        # Split by comma, take first token of each (may have "as" alias)
        for item in inner.split(','):
            item = item.strip()
            if not item:
                continue
            # Take the part before " as "
            name = item.split(' as ')[0].strip()
            if name:
                lucide_imports.add(name)

    # If file has no lucide-react import at all, skip — it might be using other components
    if not lucide_imports:
        continue

    # Find all PascalCase tags used
    used_tags = set()
    for m in TAG_RE.finditer(text):
        tag = m.group(1)
        # Skip known React/Next/third-party PascalCase components
        skip = {
            'Link', 'Image', 'Head', 'Script', 'Router', 'Suspense',
            'AuthProvider', 'OptimisticUIProvider', 'NavShell', 'MobileNav',
            'GlobalSpotlight', 'Toaster', 'OTABootstrap', 'IOSStack', 'Screen',
            'PageSkeleton', 'MotionDiv', 'Motion', 'AnimatePresence',
            'Card', 'Button', 'Badge', 'Input', 'Textarea', 'Label', 'Avatar',
            'AvatarImage', 'AvatarFallback', 'Tabs', 'TabsList', 'TabsTrigger',
            'TabsContent', 'Dialog', 'DialogTrigger', 'DialogContent', 'DialogHeader',
            'DialogTitle', 'DialogDescription', 'DialogFooter', 'Sheet', 'SheetContent',
            'SheetHeader', 'SheetTitle', 'SheetTrigger', 'Drawer', 'DrawerContent',
            'DrawerHeader', 'DrawerTitle', 'DrawerTrigger', 'ScrollArea',
            'DropdownMenu', 'DropdownMenuTrigger', 'DropdownMenuContent',
            'DropdownMenuItem', 'DropdownMenuLabel', 'DropdownMenuSeparator',
            'Tooltip', 'TooltipTrigger', 'TooltipContent', 'TooltipProvider',
            'HoverCard', 'HoverCardTrigger', 'HoverCardContent', 'Popover',
            'PopoverTrigger', 'PopoverContent', 'Accordion', 'AccordionItem',
            'AccordionTrigger', 'AccordionContent', 'Carousel', 'CarouselContent',
            'CarouselItem', 'CarouselPrevious', 'CarouselNext', 'AspectRatio',
            'Separator', 'Progress', 'Skeleton', 'Sonner', 'Toast', 'ToastProvider',
            'ToastViewport', 'ToastTitle', 'ToastDescription', 'ToastClose',
            'ToastAction', 'ChartContainer', 'ChartTooltip', 'ChartTooltipContent',
            'ChartLegend', 'ChartLegendContent', 'Command', 'CommandDialog',
            'CommandInput', 'CommandList', 'CommandEmpty', 'CommandGroup',
            'CommandItem', 'CommandSeparator', 'ContextMenu', 'ContextMenuTrigger',
            'ContextMenuContent', 'ContextMenuItem', 'Sidebar', 'SidebarProvider',
            'SidebarTrigger', 'SidebarContent', 'SidebarMenu', 'SidebarMenuItem',
            'SidebarMenuButton', 'SidebarGroup', 'SidebarGroupLabel', 'SidebarMenuSub',
            'SidebarMenuSubItem', 'SidebarMenuSubButton', 'Form', 'FormField',
            'FormItem', 'FormLabel', 'FormControl', 'FormDescription', 'FormMessage',
            'RadioGroup', 'RadioGroupItem', 'ToggleGroup', 'ToggleGroupItem',
            'Checkbox', 'Switch', 'Slider', 'Select', 'SelectTrigger',
            'SelectValue', 'SelectContent', 'SelectItem', 'SelectGroup',
            'SelectLabel', 'Menubar', 'MenubarTrigger', 'MenubarContent',
            'MenubarMenu', 'MenubarItem', 'NavigationMenu', 'NavigationMenuList',
            'NavigationMenuItem', 'NavigationMenuTrigger', 'NavigationMenuContent',
            'NavigationMenuLink', 'NavigationMenuIndicator', 'NavigationMenuViewport',
            'AlertDialog', 'AlertDialogTrigger', 'AlertDialogContent',
            'AlertDialogHeader', 'AlertDialogTitle', 'AlertDialogDescription',
            'AlertDialogFooter', 'AlertDialogAction', 'AlertDialogCancel',
            'InputOTP', 'InputOTPGroup', 'InputOTPSlot', 'InputOTPSeparator',
            'Breadcrumb', 'BreadcrumbList', 'BreadcrumbItem', 'BreadcrumbLink',
            'BreadcrumbPage', 'BreadcrumbSeparator', 'Pagination',
            'PaginationContent', 'PaginationItem', 'PaginationLink',
            'PaginationPrevious', 'PaginationNext', 'PaginationEllipsis',
            'ResizablePanelGroup', 'ResizablePanel', 'ResizableHandle',
            'Collapsible', 'CollapsibleTrigger', 'CollapsibleContent',
            'Table', 'TableHeader', 'TableBody', 'TableFooter', 'TableHead',
            'TableRow', 'TableCell', 'TableCaption', 'Calendar',
            'FeedPostCard', 'HomePage', 'ProductContent', 'ProductPage',
            'MagneticButton', 'SpotlightSearch', 'TryItOnModal', 'Navbar',
            'LayoutShell', 'PageTransition', 'SwipeBack', 'OTAUpdater',
            'VideoPlayer', 'VideoCard', 'ProductCard', 'CartProvider',
            'MotionConfig', 'LayoutGroup', 'Reorder',
            'LucideIcon', 'Icon',
            'SuccessPage', 'CheckoutContent', 'Messenger', 'SearchPage',
            'AiChatPage', 'OrdersPage', 'WishlistPage', 'CartPage',
            'CategoriesPage', 'LoginPage', 'ProfilePage', 'SettingsPage',
            'VideosPage', 'LivePage', 'LiveWatchPage', 'SellersPage',
            'SellerProfilePage', 'BecomeSellerPage', 'LinkAccountPage',
            'TelegramPage', 'GroupBuyPage', 'GroupBuyJoinPage', 'PaymentPage',
            'NotificationsPage', 'CreatePage',
            'SellerLayout', 'SellerDashboard', 'SellerProductsPage',
            'SellerOrdersPage', 'SellerProfileEdit', 'SellerVideosPage',
            'SellerStoriesPage', 'SellerGoLivePage', 'SellerSettingsPage',
            'SellerAcademyPage', 'SellerPreparingPage', 'SellerDashboardPage',
            'Page', 'App', 'RootLayout', 'Template',
            'Loading', 'NotFound', 'Error',
        }
        if tag in skip:
            continue
        used_tags.add(tag)

    # Find tags used but not imported
    missing = used_tags - lucide_imports
    # Filter — only flag if the same name exists as a known lucide icon
    # (otherwise it might be a custom component we didn't skip)
    # Quick heuristic: check if it's a CamelCase word like "Sparkles" or "ShoppingCart"
    # We'll just flag missing ones; user can review
    if missing:
        for m in sorted(missing):
            # Check if it could plausibly be a lucide icon (heuristic)
            # If the file has any lucide-react import, assume missing PascalCase tags
            # might be lucide icons
            problems.append(f"{rel}: uses <{m}> but didn't import it from lucide-react")

if problems:
    print(f"Found {len(problems)} potential missing-import issues:\n")
    for p in problems:
        print(f"  - {p}")
else:
    print("No missing lucide-react imports found.")
