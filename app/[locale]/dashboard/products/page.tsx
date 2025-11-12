'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Plus, Edit3, Trash2, Archive, ArchiveRestore, Package, MoreHorizontal } from 'lucide-react'
import { DeleteDialog } from '@/components/delete-dialog'
import { SimpleColumnToggle, useColumnVisibility, type ColumnConfig } from '@/components/simple-column-toggle'
import { AdvancedFilters, type FilterState } from '@/components/advanced-filters'
import { SortableHeader, useSorting } from '@/components/sortable-header'
import type { Product } from '@/lib/types/database'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useSubscription } from '@/hooks/use-subscription'
import { SubscriptionUpgradeDialog } from '@/components/subscription-upgrade-dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { exportFormattedToCSV, exportFormattedToExcel, formatCurrencyForExport } from '@/lib/export-utils'
import { ProductDialog } from '@/components/products/product-dialog'
import type { ProductFormInput } from '@/lib/validations/product'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export default function ProductsPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const t = useTranslations('products')
  const tCommon = useTranslations('common')
  const tTabs = useTranslations('tabs')
  
  const { subscription, checkLimits } = useSubscription()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false)
  const [upgradeDialogParams, setUpgradeDialogParams] = useState({
    currentCount: 0,
    maxCount: 0,
    planName: 'Free'
  })
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [dialogLoading, setDialogLoading] = useState(false)

  // Column visibility configuration
  const productColumns: ColumnConfig[] = [
    { key: 'sku', label: t('sku') || 'SKU', visible: true },
    { key: 'name', label: t('name'), visible: true },
    { key: 'category', label: t('category'), visible: true, hiddenClass: 'hidden md:table-cell' },
    { key: 'price', label: t('price'), visible: true },
    { key: 'stock', label: t('stock') || 'Stock', visible: true, hiddenClass: 'hidden sm:table-cell' },
    { key: 'status', label: t('status'), visible: true },
    { key: 'actions', label: tCommon('actions'), visible: true, alwaysVisible: true },
  ]

  const { columnVisibility, getColumnClass, handleVisibilityChange } = useColumnVisibility(
    productColumns,
    'products-table-columns'
  )

  useEffect(() => {
    loadProducts()
  }, [showArchived])

  // Sorting
  const { sortedData: sortedProducts, sortKey, sortDirection, handleSort } = useSorting(
    products,
    'name',
    'asc'
  )

  async function loadProducts() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push(`/${locale}/auth/login`)
      return
    }

    let query = supabase
      .from('products')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (showArchived) {
      query = query.not('deleted_at', 'is', null)
    } else {
      query = query.is('deleted_at', null)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error loading products:', error)
      toast.error(t('loadError') || 'Errore nel caricamento dei prodotti')
    } else {
      setProducts(data || [])
    }
    setLoading(false)
  }

  async function handleAddNew() {
    // Check subscription limits
    const limitsCheck = await checkLimits('product')
    if (!limitsCheck.allowed) {
      setUpgradeDialogParams({
        currentCount: limitsCheck.current_count || 0,
        maxCount: limitsCheck.max_count || 0,
        planName: subscription?.plan?.name || 'Free'
      })
      setShowUpgradeDialog(true)
      return
    }

    setSelectedProduct(null)
    setDialogOpen(true)
  }

  function handleEdit(product: Product) {
    setSelectedProduct(product)
    setDialogOpen(true)
  }

  function handleRowClick(product: Product) {
    router.push(`/${locale}/dashboard/products/${product.id}`)
  }

  async function handleDialogSubmit(data: ProductFormInput) {
    setDialogLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      toast.error(tCommon('error') || 'Errore')
      setDialogLoading(false)
      return
    }

    try {
      if (selectedProduct) {
        // Update existing product
        const { error } = await supabase
          .from('products')
          .update({
            name: data.name,
            description: data.description,
            category: data.category,
            unit_price: data.unit_price,
            tax_rate: data.tax_rate ?? 8.1,
            track_inventory: data.track_inventory ?? false,
            stock_quantity: data.stock_quantity ?? 0,
            low_stock_threshold: data.low_stock_threshold ?? 10,
            is_active: data.is_active ?? true,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedProduct.id)

        if (error) throw error
        toast.success(t('updateSuccess') || 'Prodotto aggiornato con successo')
      } else {
        // Create new product
        const { error } = await supabase
          .from('products')
          .insert({
            user_id: user.id,
            name: data.name,
            description: data.description,
            category: data.category,
            unit_price: data.unit_price,
            tax_rate: data.tax_rate ?? 8.1,
            track_inventory: data.track_inventory ?? false,
            stock_quantity: data.stock_quantity ?? 0,
            low_stock_threshold: data.low_stock_threshold ?? 10,
            is_active: data.is_active ?? true,
          })

        if (error) throw error
        toast.success(t('createSuccess') || 'Prodotto creato con successo')
      }

      setDialogOpen(false)
      setSelectedProduct(null)
      loadProducts()
    } catch (error: any) {
      console.error('Error saving product:', error)
      toast.error(selectedProduct ? t('updateError') : t('createError'))
    } finally {
      setDialogLoading(false)
    }
  }

  async function handleDelete(id: string) {
    setIsDeleting(true)
    const supabase = createClient()
    
    // Soft delete
    const { error } = await supabase
      .from('products')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      console.error('Error deleting product:', error)
      toast.error(t('deleteError') || 'Errore nell\'eliminazione del prodotto')
    } else {
      toast.success(t('deleteSuccess') || 'Prodotto eliminato con successo')
      loadProducts()
    }
    
    setIsDeleting(false)
    setDeleteDialogOpen(false)
    setProductToDelete(null)
  }

  async function handleRestore(id: string) {
    const supabase = createClient()
    
    const { error } = await supabase
      .from('products')
      .update({ deleted_at: null })
      .eq('id', id)

    if (error) {
      console.error('Error restoring product:', error)
      toast.error(t('restoreError') || 'Errore nel ripristino del prodotto')
    } else {
      toast.success(t('restoreSuccess') || 'Prodotto ripristinato con successo')
      loadProducts()
    }
  }

  function handleExport(format: 'csv' | 'excel') {
    const dataToExport = products.map(product => ({
      [t('sku') || 'SKU']: product.sku || '',
      [t('name') || 'Nome']: product.name,
      [t('category') || 'Categoria']: product.category || '',
      [t('price') || 'Prezzo']: formatCurrencyForExport(product.unit_price),
      [t('taxRate') || 'IVA %']: `${product.tax_rate}%`,
      [t('stock') || 'Stock']: product.track_inventory ? product.stock_quantity?.toString() || '0' : t('notTracked') || 'Non tracciato',
      [t('status') || 'Stato']: product.is_active ? (t('active') || 'Attivo') : (t('inactive') || 'Inattivo'),
    }))

    const filename = `prodotti_${new Date().toISOString().split('T')[0]}`

    if (format === 'csv') {
      exportFormattedToCSV(dataToExport, filename)
    } else {
      exportFormattedToExcel(dataToExport, filename)
    }

    toast.success(tCommon('exportSuccess') || 'Export completato con successo')
  }


  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            {t('moduleDescription')}
          </p>
        </div>
        <Button onClick={handleAddNew} size="default" className="w-full sm:w-auto lg:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          {t('addNew')}
        </Button>
      </div>

      {/* Main Content Card */}
      <Card>
        <CardHeader className="pb-3 md:pb-4">
          <div className="flex flex-col gap-4">
            {/* Tabs and Export Row */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <Tabs value={showArchived ? 'archived' : 'active'} onValueChange={(v) => setShowArchived(v === 'archived')} className="w-full lg:w-auto">
                <TabsList className="grid w-full sm:w-auto grid-cols-2">
                  <TabsTrigger value="active" className="text-xs md:text-sm">
                    <Package className="h-4 w-4 mr-2" />
                    {tTabs('active')}
                  </TabsTrigger>
                  <TabsTrigger value="archived" className="text-xs md:text-sm">
                    <Archive className="h-4 w-4 mr-2" />
                    {tTabs('archived')}
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Filters and Column Toggle */}
              {!showArchived && (
                <div className="flex flex-row flex-wrap items-center justify-end gap-2 w-full lg:w-auto">
                  <AdvancedFilters
                    filters={{}}
                    onFiltersChange={() => {}}
                    onExport={handleExport}
                  />
                  <SimpleColumnToggle
                    columns={productColumns}
                    columnVisibility={columnVisibility}
                    onVisibilityChange={handleVisibilityChange}
                    label={tCommon('toggleColumns')}
                  />
                </div>
              )}
            </div>
          </div>

          <CardTitle className="mt-4 text-lg md:text-xl">
            {showArchived ? t('archivedProducts') : t('yourProducts')}
          </CardTitle>
          <CardDescription className="text-xs md:text-sm">
            {showArchived ? t('archivedDescription') : t('tableDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 md:py-12 text-muted-foreground">
              {tCommon('loading')}...
            </div>
          ) : sortedProducts.length === 0 ? (
            <div className="text-center py-8 md:py-12">
              <Package className="h-12 w-12 md:h-16 md:w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-base md:text-lg font-semibold mb-2">
                {showArchived ? t('noArchivedProducts') : t('noProducts')}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {showArchived ? t('noArchivedDescription') : t('noProductsDescription')}
              </p>
              {!showArchived && (
                <Button onClick={handleAddNew}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('createFirst')}
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="inline-block min-w-full align-middle">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className={getColumnClass('sku', 'text-xs md:text-sm')}>
                        <SortableHeader
                          label={t('sku') || 'SKU'}
                          sortKey="sku"
                          currentSortKey={sortKey}
                          currentDirection={sortDirection}
                          onSort={handleSort}
                        />
                      </TableHead>
                      <TableHead className={getColumnClass('name', 'text-xs md:text-sm')}>
                        <SortableHeader
                          label={t('name')}
                          sortKey="name"
                          currentSortKey={sortKey}
                          currentDirection={sortDirection}
                          onSort={handleSort}
                        />
                      </TableHead>
                      <TableHead className={getColumnClass('category', 'hidden md:table-cell text-xs md:text-sm')}>
                        <SortableHeader
                          label={t('category')}
                          sortKey="category"
                          currentSortKey={sortKey}
                          currentDirection={sortDirection}
                          onSort={handleSort}
                        />
                      </TableHead>
                      <TableHead className={getColumnClass('price', 'text-right text-xs md:text-sm')}>
                        <SortableHeader
                          label={t('price')}
                          sortKey="unit_price"
                          currentSortKey={sortKey}
                          currentDirection={sortDirection}
                          onSort={handleSort}
                          align="right"
                        />
                      </TableHead>
                      <TableHead className={getColumnClass('stock', 'hidden sm:table-cell text-right text-xs md:text-sm')}>
                        <SortableHeader
                          label={t('stock') || 'Stock'}
                          sortKey="stock_quantity"
                          currentSortKey={sortKey}
                          currentDirection={sortDirection}
                          onSort={handleSort}
                          align="right"
                        />
                      </TableHead>
                      <TableHead className={getColumnClass('status', 'text-xs md:text-sm')}>
                        <SortableHeader
                          label={t('status')}
                          sortKey="is_active"
                          currentSortKey={sortKey}
                          currentDirection={sortDirection}
                          onSort={handleSort}
                        />
                      </TableHead>
                      <TableHead className={getColumnClass('actions', 'text-right text-xs md:text-sm')}>{tCommon('actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedProducts.map((product) => (
                      <TableRow
                        key={product.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleRowClick(product)}
                      >
                        <TableCell className={getColumnClass('sku', 'font-mono text-xs md:text-sm')}>{product.sku || '-'}</TableCell>
                        <TableCell className={getColumnClass('name', 'font-medium text-xs md:text-sm')}>
                          {product.name}
                          {product.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px] sm:max-w-[300px]">
                              {product.description}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className={getColumnClass('category', 'hidden md:table-cell text-xs md:text-sm')}>{product.category || '-'}</TableCell>
                        <TableCell className={getColumnClass('price', 'text-right text-xs md:text-sm tabular-nums')}>
                          CHF {Number(product.unit_price).toLocaleString('it-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className={getColumnClass('stock', 'hidden sm:table-cell text-right text-xs md:text-sm tabular-nums')}>
                          {product.track_inventory ? (
                            <span className={product.stock_quantity && product.stock_quantity <= (product.low_stock_threshold || 10) ? 'text-destructive font-medium' : ''}>
                              {product.stock_quantity || 0}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">{t('notTracked')}</span>
                          )}
                        </TableCell>
                        <TableCell className={getColumnClass('status', 'text-xs md:text-sm')}>
                          <Badge variant={product.is_active ? 'default' : 'secondary'} className="text-xs">
                            {product.is_active ? t('active') : t('inactive')}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={getColumnClass('actions', 'text-right')}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 data-[state=open]:bg-muted"
                                aria-label={tCommon('actions')}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              {!showArchived ? (
                                <>
                                  <DropdownMenuItem onSelect={() => handleEdit(product)}>
                                    <Edit3 className="mr-2 h-4 w-4" />
                                    {t('edit')}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onSelect={() => {
                                      setProductToDelete(product.id)
                                      setDeleteDialogOpen(true)
                                    }}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    {t('delete')}
                                  </DropdownMenuItem>
                                </>
                              ) : (
                                <>
                                  <DropdownMenuItem onSelect={() => handleRestore(product.id)}>
                                    <ArchiveRestore className="mr-2 h-4 w-4" />
                                    {t('restore')}
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => productToDelete && handleDelete(productToDelete)}
        title={t('deleteDialogTitle')}
        description={t('deleteDialogDescription')}
        isDeleting={isDeleting}
      />

      {/* Upgrade Dialog */}
      <SubscriptionUpgradeDialog
        open={showUpgradeDialog}
        onOpenChange={setShowUpgradeDialog}
        limitType="product"
        currentCount={upgradeDialogParams.currentCount}
        maxCount={upgradeDialogParams.maxCount}
        planName={upgradeDialogParams.planName}
      />

      {/* Product Dialog */}
      <ProductDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleDialogSubmit}
        product={selectedProduct}
        loading={dialogLoading}
      />
    </div>
  )
}
