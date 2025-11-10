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
import { Plus, Pencil, Trash2, Archive, ArchiveRestore } from 'lucide-react'
import { DeleteDialog } from '@/components/delete-dialog'
import { SimpleColumnToggle, useColumnVisibility, type ColumnConfig } from '@/components/simple-column-toggle'
import { SortableHeader, useSorting } from '@/components/sortable-header'
import type { Supplier } from '@/lib/types/database'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useSubscription } from '@/hooks/use-subscription'
import { SubscriptionUpgradeDialog } from '@/components/subscription-upgrade-dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SupplierDialog } from '@/components/suppliers/supplier-dialog'
import type { SupplierInput } from '@/lib/validations/supplier'

export default function SuppliersPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const t = useTranslations('suppliers')
  const tCommon = useTranslations('common')
  const tTabs = useTranslations('tabs')
  
  const { subscription, checkLimits } = useSubscription()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [supplierToDelete, setSupplierToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false)
  const [upgradeDialogParams, setUpgradeDialogParams] = useState({
    currentCount: 0,
    maxCount: 0,
    planName: 'Free'
  })
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [dialogLoading, setDialogLoading] = useState(false)

  // Column visibility configuration
  const supplierColumns: ColumnConfig[] = [
    { key: 'name', label: t('fields.name'), visible: true },
    { key: 'contact', label: t('fields.contact'), visible: true, hiddenClass: 'hidden md:table-cell' },
    { key: 'email', label: t('fields.email'), visible: true, hiddenClass: 'hidden lg:table-cell' },
    { key: 'phone', label: t('fields.phone'), visible: true, hiddenClass: 'hidden lg:table-cell' },
    { key: 'actions', label: tCommon('actions'), visible: true, alwaysVisible: true },
  ]

  const { visibleColumns, getColumnClass, handleVisibilityChange } = useColumnVisibility(
    supplierColumns,
    'suppliers-table-columns'
  )

  useEffect(() => {
    loadSuppliers()
  }, [showArchived])

  // Sorting
  const { sortedData: sortedSuppliers, sortKey, sortDirection, handleSort } = useSorting(
    suppliers,
    'name',
    'asc'
  )

  async function loadSuppliers() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push(`/${locale}/auth/login`)
      return
    }

    let query = supabase
      .from('suppliers')
      .select('*')
      .eq('user_id', user.id)
      .order('name')

    if (showArchived) {
      query = query.not('deleted_at', 'is', null)
    } else {
      query = query.is('deleted_at', null)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error loading suppliers:', error)
      toast.error(t('loadError') || 'Errore nel caricamento dei fornitori')
    } else {
      setSuppliers(data || [])
    }
    setLoading(false)
  }

  async function handleCreate() {
    const limitsCheck = await checkLimits('supplier')
    if (!limitsCheck.allowed) {
      setUpgradeDialogParams({
        currentCount: limitsCheck.current_count || 0,
        maxCount: limitsCheck.max_count || 0,
        planName: subscription?.plan?.name || 'Free'
      })
      setShowUpgradeDialog(true)
      return
    }

    setSelectedSupplier(null)
    setDialogOpen(true)
  }

  function handleEdit(supplier: Supplier) {
    setSelectedSupplier(supplier)
    setDialogOpen(true)
  }

  async function handleDialogSubmit(data: SupplierInput) {
    setDialogLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      toast.error(tCommon('error') || 'Errore')
      setDialogLoading(false)
      return
    }

    try {
      if (selectedSupplier) {
        // Update existing supplier
        const { error } = await supabase
          .from('suppliers')
          .update({
            name: data.name,
            contact_person: data.contact_person,
            email: data.email,
            phone: data.phone,
            address: data.address,
            city: data.city,
            postal_code: data.postal_code,
            country: data.country,
            vat_number: data.vat_number,
            website: data.website,
            payment_terms: data.payment_terms,
            notes: data.notes,
            is_active: data.is_active ?? true,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedSupplier.id)

        if (error) throw error
        toast.success(t('updateSuccess') || 'Fornitore aggiornato con successo')
      } else {
        // Create new supplier
        const { error } = await supabase
          .from('suppliers')
          .insert({
            user_id: user.id,
            name: data.name,
            contact_person: data.contact_person,
            email: data.email,
            phone: data.phone,
            address: data.address,
            city: data.city,
            postal_code: data.postal_code,
            country: data.country,
            vat_number: data.vat_number,
            website: data.website,
            payment_terms: data.payment_terms,
            notes: data.notes,
            is_active: data.is_active ?? true,
          })

        if (error) throw error
        toast.success(t('createSuccess') || 'Fornitore creato con successo')
      }

      setDialogOpen(false)
      setSelectedSupplier(null)
      loadSuppliers()
    } catch (error: any) {
      console.error('Error saving supplier:', error)
      toast.error(selectedSupplier ? t('updateError') : t('createError'))
    } finally {
      setDialogLoading(false)
    }
  }

  function confirmDelete(supplierId: string) {
    setSupplierToDelete(supplierId)
    setDeleteDialogOpen(true)
  }

  async function handleDelete() {
    if (!supplierToDelete) return

    setIsDeleting(true)
    const supabase = createClient()
    
    const { error } = await supabase
      .from('suppliers')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', supplierToDelete)

    if (error) {
      console.error('Error archiving supplier:', error)
      toast.error(t('deleteError') || 'Errore nell\'archiviazione del fornitore')
    } else {
      toast.success(t('deleteSuccess') || 'Fornitore archiviato con successo')
      loadSuppliers()
    }
    
    setIsDeleting(false)
    setDeleteDialogOpen(false)
    setSupplierToDelete(null)
  }

  async function handleRestore(supplierId: string) {
    const supabase = createClient()
    
    const { error } = await supabase
      .from('suppliers')
      .update({ deleted_at: null })
      .eq('id', supplierId)

    if (error) {
      console.error('Error restoring supplier:', error)
      toast.error(t('restoreError') || 'Errore nel ripristino del fornitore')
    } else {
      toast.success(t('restoreSuccess') || 'Fornitore ripristinato con successo')
      loadSuppliers()
    }
  }

  async function handlePermanentDelete(supplierId: string) {
    const supabase = createClient()
    
    const { error } = await supabase
      .from('suppliers')
      .delete()
      .eq('id', supplierId)

    if (error) {
      console.error('Error deleting supplier:', error)
      toast.error(t('permanentDeleteError') || 'Errore nell\'eliminazione del fornitore')
    } else {
      toast.success(t('permanentDeleteSuccess') || 'Fornitore eliminato definitivamente')
      loadSuppliers()
    }
  }

  function handleRowClick(supplier: Supplier) {
    if (!showArchived) {
      handleEdit(supplier)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            {t('subtitle')}
          </p>
        </div>
        <Button onClick={handleCreate} size="default" className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          {t('newSupplier')}
        </Button>
      </div>

      {/* Main Content Card */}
      <Card>
        <CardHeader className="pb-3 md:pb-4">
          <div className="flex flex-col gap-4">
            {/* Tabs and Column Toggle Row */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <Tabs value={showArchived ? 'archived' : 'active'} onValueChange={(value) => setShowArchived(value === 'archived')} className="w-full sm:w-auto">
                <TabsList className="grid w-full sm:w-auto grid-cols-2">
                  <TabsTrigger value="active" className="text-xs md:text-sm">
                    {tTabs('active')}
                  </TabsTrigger>
                  <TabsTrigger value="archived" className="text-xs md:text-sm">
                    <Archive className="h-4 w-4 mr-2" />
                    {tTabs('archived')}
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Column Toggle */}
              {!showArchived && suppliers.length > 0 && (
                <SimpleColumnToggle
                  columns={visibleColumns}
                  onVisibilityChange={handleVisibilityChange}
                  storageKey="suppliers-table-columns"
                  label={t('toggleColumns') || tCommon('toggleColumns') || 'Colonne'}
                />
              )}
            </div>
          </div>

          <CardTitle className="mt-4 text-lg md:text-xl">
            {showArchived ? t('archivedTitle') : t('listTitle')}
          </CardTitle>
          <CardDescription className="text-xs md:text-sm">
            {showArchived ? t('archivedDescription') : t('listDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 md:py-12 text-muted-foreground">
              {tCommon('loading')}...
            </div>
          ) : sortedSuppliers.length === 0 ? (
            <div className="text-center py-8 md:py-12 text-muted-foreground">
              {showArchived ? t('noArchivedSuppliers') : t('noSuppliers')}
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="inline-block min-w-full align-middle">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className={`text-xs md:text-sm ${getColumnClass('name')}`}>
                        <SortableHeader
                          label={t('fields.name')}
                          sortKey="name"
                          currentSortKey={sortKey}
                          currentDirection={sortDirection}
                          onSort={handleSort}
                        />
                      </TableHead>
                      <TableHead className={`hidden md:table-cell text-xs md:text-sm ${getColumnClass('contact')}`}>
                        <SortableHeader
                          label={t('fields.contact')}
                          sortKey="contact_person"
                          currentSortKey={sortKey}
                          currentDirection={sortDirection}
                          onSort={handleSort}
                        />
                      </TableHead>
                      <TableHead className={`hidden lg:table-cell text-xs md:text-sm ${getColumnClass('email')}`}>
                        <SortableHeader
                          label={t('fields.email')}
                          sortKey="email"
                          currentSortKey={sortKey}
                          currentDirection={sortDirection}
                          onSort={handleSort}
                        />
                      </TableHead>
                      <TableHead className={`hidden lg:table-cell text-xs md:text-sm ${getColumnClass('phone')}`}>
                        <SortableHeader
                          label={t('fields.phone')}
                          sortKey="phone"
                          currentSortKey={sortKey}
                          currentDirection={sortDirection}
                          onSort={handleSort}
                        />
                      </TableHead>
                      <TableHead className={`text-right text-xs md:text-sm ${getColumnClass('actions')}`}>{tCommon('actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedSuppliers.map((supplier) => (
                      <TableRow 
                        key={supplier.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleRowClick(supplier)}
                      >
                        <TableCell className={`font-medium text-xs md:text-sm ${getColumnClass('name')}`}>
                          {supplier.name}
                        </TableCell>
                        <TableCell className={`hidden md:table-cell text-xs md:text-sm ${getColumnClass('contact')}`}>{supplier.contact_person || '-'}</TableCell>
                        <TableCell className={`hidden lg:table-cell text-xs md:text-sm ${getColumnClass('email')}`}>{supplier.email || '-'}</TableCell>
                        <TableCell className={`hidden lg:table-cell text-xs md:text-sm ${getColumnClass('phone')}`}>{supplier.phone || '-'}</TableCell>
                        <TableCell className={`text-right ${getColumnClass('actions')}`} onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-2">
                            {!showArchived && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEdit(supplier)}
                                  title={tCommon('edit')}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => confirmDelete(supplier.id)}
                                  title={tCommon('delete')}
                                >
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                              </>
                            )}
                            {showArchived && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRestore(supplier.id)}
                                  title={t('restore')}
                                >
                                  <ArchiveRestore className="h-4 w-4 text-green-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handlePermanentDelete(supplier.id)}
                                  title={t('permanentDelete')}
                                >
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                              </>
                            )}
                          </div>
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

      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title={t('deleteTitle') || 'Elimina Fornitore'}
        description={t('deleteDescription') || 'Sei sicuro di voler archiviare questo fornitore?'}
        isDeleting={isDeleting}
      />

      <SubscriptionUpgradeDialog
        open={showUpgradeDialog}
        onOpenChange={setShowUpgradeDialog}
        limitType="supplier"
        currentCount={upgradeDialogParams.currentCount}
        maxCount={upgradeDialogParams.maxCount}
        planName={upgradeDialogParams.planName}
      />

      {/* Supplier Dialog */}
      <SupplierDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleDialogSubmit}
        supplier={selectedSupplier}
        loading={dialogLoading}
      />
    </div>
  )
}

