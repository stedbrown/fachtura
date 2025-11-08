'use client'

import { useEffect, useState } from 'react'
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
import { Plus, Eye, Trash2, Edit, Package, Archive, ArchiveRestore } from 'lucide-react'
import { DeleteDialog } from '@/components/delete-dialog'
import type { Product } from '@/lib/types/database'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useSubscription } from '@/hooks/use-subscription'
import { SubscriptionUpgradeDialog } from '@/components/subscription-upgrade-dialog'
import { Input } from '@/components/ui/input'

export default function ProductsPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const t = useTranslations('products')
  const tCommon = useTranslations('common')
  
  const { subscription, checkLimits } = useSubscription()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false)
  const [upgradeDialogParams, setUpgradeDialogParams] = useState({
    currentCount: 0,
    maxCount: 0,
    planName: 'Free'
  })

  useEffect(() => {
    loadProducts()
  }, [showArchived])

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
        currentCount: limitsCheck.currentCount || 0,
        maxCount: limitsCheck.maxCount || 0,
        planName: subscription?.plan?.name || 'Free'
      })
      setShowUpgradeDialog(true)
      return
    }

    router.push(`/${locale}/dashboard/products/new`)
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

  const filteredProducts = products.filter(product => {
    if (!searchQuery) return true
    const search = searchQuery.toLowerCase()
    return (
      product.name.toLowerCase().includes(search) ||
      product.sku?.toLowerCase().includes(search) ||
      product.category?.toLowerCase().includes(search) ||
      product.description?.toLowerCase().includes(search)
    )
  })

  const activeProducts = filteredProducts.filter(p => p.is_active && !showArchived).length
  const inactiveProducts = filteredProducts.filter(p => !p.is_active && !showArchived).length
  const totalValue = filteredProducts.reduce((sum, p) => sum + Number(p.unit_price), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">{tCommon('loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t('title') || 'Prodotti'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('description') || 'Gestisci il catalogo dei tuoi prodotti e servizi'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowArchived(!showArchived)}
          >
            {showArchived ? (
              <>
                <Package className="mr-2 h-4 w-4" />
                {t('showActive') || 'Mostra Attivi'}
              </>
            ) : (
              <>
                <Archive className="mr-2 h-4 w-4" />
                {t('showArchived') || 'Mostra Archiviati'}
              </>
            )}
          </Button>
          <Button onClick={handleAddNew}>
            <Plus className="mr-2 h-4 w-4" />
            {t('addNew') || 'Nuovo Prodotto'}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('totalProducts') || 'Prodotti Totali'}
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredProducts.length}</div>
            <p className="text-xs text-muted-foreground">
              {activeProducts} {t('active') || 'attivi'}, {inactiveProducts} {t('inactive') || 'inattivi'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('catalogValue') || 'Valore Catalogo'}
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">CHF {totalValue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {t('averagePrice') || 'Prezzo medio'}: CHF {filteredProducts.length > 0 ? (totalValue / filteredProducts.length).toFixed(2) : '0.00'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('planLimit') || 'Limite Piano'}
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {subscription?.plan?.max_products ? `${filteredProducts.length}/${subscription.plan.max_products}` : '∞'}
            </div>
            <p className="text-xs text-muted-foreground">
              {subscription?.plan?.name || 'Free'} Plan
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <Input
          placeholder={t('searchPlaceholder') || 'Cerca per nome, SKU, categoria...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {showArchived ? (t('archivedProducts') || 'Prodotti Archiviati') : (t('yourProducts') || 'I Tuoi Prodotti')}
          </CardTitle>
          <CardDescription>
            {showArchived
              ? (t('archivedDescription') || 'Prodotti eliminati che possono essere ripristinati')
              : (t('tableDescription') || 'Visualizza e gestisci il tuo catalogo prodotti')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">
                {showArchived
                  ? (t('noArchivedProducts') || 'Nessun prodotto archiviato')
                  : (t('noProducts') || 'Nessun prodotto')}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {showArchived
                  ? (t('noArchivedDescription') || 'Non hai prodotti archiviati.')
                  : (t('noProductsDescription') || 'Inizia creando il tuo primo prodotto.')}
              </p>
              {!showArchived && (
                <Button onClick={handleAddNew} className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  {t('createFirst') || 'Crea il tuo primo prodotto'}
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('name') || 'Nome'}</TableHead>
                  <TableHead>{t('sku') || 'SKU'}</TableHead>
                  <TableHead>{t('category') || 'Categoria'}</TableHead>
                  <TableHead className="text-right">{t('price') || 'Prezzo'}</TableHead>
                  <TableHead>{t('inventory') || 'Inventario'}</TableHead>
                  <TableHead>{t('status') || 'Stato'}</TableHead>
                  <TableHead className="text-right">{tCommon('actions') || 'Azioni'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">
                      {product.name}
                      {product.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {product.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {product.sku || '-'}
                      </code>
                    </TableCell>
                    <TableCell>
                      {product.category && (
                        <Badge variant="outline">{product.category}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      CHF {Number(product.unit_price).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {product.track_inventory ? (
                        <div className="text-sm">
                          <span className={product.stock_quantity <= product.low_stock_threshold ? 'text-destructive font-medium' : ''}>
                            {product.stock_quantity}
                          </span>
                          {product.stock_quantity <= product.low_stock_threshold && (
                            <Badge variant="destructive" className="ml-2 text-xs">
                              {t('lowStock') || 'Scorta bassa'}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          {t('notTracked') || 'Non tracciato'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={product.is_active ? 'default' : 'secondary'}>
                        {product.is_active ? (t('active') || 'Attivo') : (t('inactive') || 'Inattivo')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {showArchived ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRestore(product.id)}
                            title={t('restore') || 'Ripristina'}
                          >
                            <ArchiveRestore className="h-4 w-4" />
                          </Button>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => router.push(`/${locale}/dashboard/products/${product.id}`)}
                              title={t('edit') || 'Modifica'}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setProductToDelete(product.id)
                                setDeleteDialogOpen(true)
                              }}
                              title={t('delete') || 'Elimina'}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => productToDelete && handleDelete(productToDelete)}
        title={t('deleteDialogTitle') || 'Eliminare questo prodotto?'}
        description={t('deleteDialogDescription') || 'Il prodotto sarà archiviato e potrà essere ripristinato in seguito.'}
        isDeleting={isDeleting}
      />

      {/* Upgrade Dialog */}
      <SubscriptionUpgradeDialog
        open={showUpgradeDialog}
        onOpenChange={setShowUpgradeDialog}
        resourceType="products"
        currentCount={upgradeDialogParams.currentCount}
        maxCount={upgradeDialogParams.maxCount}
        planName={upgradeDialogParams.planName}
      />
    </div>
  )
}

