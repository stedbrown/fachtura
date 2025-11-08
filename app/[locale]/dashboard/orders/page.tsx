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
import { Plus, Edit, Trash2, Archive, ArchiveRestore, ShoppingCart } from 'lucide-react'
import { DeleteDialog } from '@/components/delete-dialog'
import type { OrderWithClient } from '@/lib/types/database'
import { format } from 'date-fns'
import { it, de, fr, enUS, type Locale } from 'date-fns/locale'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useSubscription } from '@/hooks/use-subscription'
import { SubscriptionUpgradeDialog } from '@/components/subscription-upgrade-dialog'
import { Input } from '@/components/ui/input'

const localeMap: Record<string, Locale> = {
  it: it,
  de: de,
  fr: fr,
  en: enUS,
  rm: de,
}

function getOrderStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'delivered':
      return 'default' // Green
    case 'confirmed':
    case 'processing':
    case 'shipped':
      return 'outline' // Blue
    case 'cancelled':
      return 'destructive' // Red
    default:
      return 'secondary' // Gray for draft
  }
}

export default function OrdersPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const t = useTranslations('orders')
  const tCommon = useTranslations('common')
  const tStatus = useTranslations('orders.status')
  
  const { subscription, checkLimits } = useSubscription()
  const [orders, setOrders] = useState<OrderWithClient[]>([])
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false)
  const [upgradeDialogParams, setUpgradeDialogParams] = useState({
    currentCount: 0,
    maxCount: 0,
    planName: 'Free'
  })

  useEffect(() => {
    loadOrders()
  }, [showArchived])

  async function loadOrders() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push(`/${locale}/auth/login`)
      return
    }

    let query = supabase
      .from('orders')
      .select(`
        *,
        client:clients(*)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (showArchived) {
      query = query.not('deleted_at', 'is', null)
    } else {
      query = query.is('deleted_at', null)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error loading orders:', error)
      toast.error(t('loadError') || 'Errore nel caricamento degli ordini')
    } else {
      setOrders(data || [])
    }
    setLoading(false)
  }

  async function handleAddNew() {
    const limitsCheck = await checkLimits('orders')
    if (!limitsCheck.allowed) {
      setUpgradeDialogParams({
        currentCount: limitsCheck.currentCount || 0,
        maxCount: limitsCheck.maxCount || 0,
        planName: subscription?.plan?.name || 'Free'
      })
      setShowUpgradeDialog(true)
      return
    }

    router.push(`/${locale}/dashboard/orders/new`)
  }

  async function handleDelete(id: string) {
    setIsDeleting(true)
    const supabase = createClient()
    
    const { error } = await supabase
      .from('orders')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      console.error('Error deleting order:', error)
      toast.error(t('deleteError') || 'Errore nell\'eliminazione dell\'ordine')
    } else {
      toast.success(t('deleteSuccess') || 'Ordine eliminato con successo')
      loadOrders()
    }
    
    setIsDeleting(false)
    setDeleteDialogOpen(false)
    setOrderToDelete(null)
  }

  async function handleRestore(id: string) {
    const supabase = createClient()
    
    const { error } = await supabase
      .from('orders')
      .update({ deleted_at: null })
      .eq('id', id)

    if (error) {
      console.error('Error restoring order:', error)
      toast.error(t('restoreError') || 'Errore nel ripristino dell\'ordine')
    } else {
      toast.success(t('restoreSuccess') || 'Ordine ripristinato con successo')
      loadOrders()
    }
  }

  const filteredOrders = orders.filter(order => {
    if (!searchQuery) return true
    const search = searchQuery.toLowerCase()
    return (
      order.order_number.toLowerCase().includes(search) ||
      order.client.name.toLowerCase().includes(search)
    )
  })

  const totalValue = filteredOrders.reduce((sum, o) => sum + Number(o.total), 0)

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
            {t('title') || 'Ordini'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('description') || 'Gestisci gli ordini dei tuoi clienti'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowArchived(!showArchived)}
          >
            {showArchived ? (
              <>
                <ShoppingCart className="mr-2 h-4 w-4" />
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
            {t('addNew') || 'Nuovo Ordine'}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('totalOrders') || 'Ordini Totali'}
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredOrders.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('ordersValue') || 'Valore Totale'}
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">CHF {totalValue.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('planLimit') || 'Limite Piano'}
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {subscription?.plan?.max_orders ? `${filteredOrders.length}/${subscription.plan.max_orders}` : '∞'}
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
          placeholder={t('searchPlaceholder') || 'Cerca per numero ordine, cliente...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {showArchived ? (t('archivedOrders') || 'Ordini Archiviati') : (t('yourOrders') || 'I Tuoi Ordini')}
          </CardTitle>
          <CardDescription>
            {showArchived
              ? (t('archivedDescription') || 'Ordini eliminati che possono essere ripristinati')
              : (t('tableDescription') || 'Visualizza e gestisci gli ordini dei clienti')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">
                {showArchived
                  ? (t('noArchivedOrders') || 'Nessun ordine archiviato')
                  : (t('noOrders') || 'Nessun ordine')}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {showArchived
                  ? (t('noArchivedDescription') || 'Non hai ordini archiviati.')
                  : (t('noOrdersDescription') || 'Inizia creando il tuo primo ordine.')}
              </p>
              {!showArchived && (
                <Button onClick={handleAddNew} className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  {t('createFirst') || 'Crea il tuo primo ordine'}
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('orderNumber') || 'N. Ordine'}</TableHead>
                  <TableHead>{t('client') || 'Cliente'}</TableHead>
                  <TableHead>{t('orderDate') || 'Data'}</TableHead>
                  <TableHead>{t('status') || 'Stato'}</TableHead>
                  <TableHead className="text-right">{t('totalAmount') || 'Totale'}</TableHead>
                  <TableHead className="text-right">{tCommon('actions') || 'Azioni'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium font-mono text-sm">
                      {order.order_number}
                    </TableCell>
                    <TableCell>{order.client.name}</TableCell>
                    <TableCell>
                      {format(new Date(order.date), 'dd/MM/yyyy', { locale: localeMap[locale] || enUS })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getOrderStatusVariant(order.status)}>
                        {tStatus(order.status as any)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      CHF {Number(order.total).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {showArchived ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRestore(order.id)}
                            title={t('restore') || 'Ripristina'}
                          >
                            <ArchiveRestore className="h-4 w-4" />
                          </Button>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => router.push(`/${locale}/dashboard/orders/${order.id}`)}
                              title={t('edit') || 'Modifica'}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setOrderToDelete(order.id)
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
        onConfirm={() => orderToDelete && handleDelete(orderToDelete)}
        title={t('deleteDialogTitle') || 'Eliminare questo ordine?'}
        description={t('deleteDialogDescription') || 'L\'ordine sarà archiviato e potrà essere ripristinato in seguito.'}
        isDeleting={isDeleting}
      />

      {/* Upgrade Dialog */}
      <SubscriptionUpgradeDialog
        open={showUpgradeDialog}
        onOpenChange={setShowUpgradeDialog}
        resourceType="orders"
        currentCount={upgradeDialogParams.currentCount}
        maxCount={upgradeDialogParams.maxCount}
        planName={upgradeDialogParams.planName}
      />
    </div>
  )
}

