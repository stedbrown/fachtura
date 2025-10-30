'use client'

import { useEffect, useState } from 'react'
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
import { ClientDialog } from '@/components/clients/client-dialog'
import { DeleteDialog } from '@/components/delete-dialog'
import type { Client } from '@/lib/types/database'
import type { ClientInput } from '@/lib/validations/client'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'
import Link from 'next/link'

export default function ClientsPage() {
  const params = useParams()
  const locale = params.locale as string
  const t = useTranslations('clients')
  const tCommon = useTranslations('common')
  const tTabs = useTranslations('tabs')
  
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [clientToDelete, setClientToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    loadClients()
  }, [showArchived])

  const loadClients = async () => {
    setLoading(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    let query = supabase
      .from('clients')
      .select('*')
      .eq('user_id', user.id)

    // Filter based on archived status
    if (showArchived) {
      query = query.not('deleted_at', 'is', null)
    } else {
      query = query.is('deleted_at', null)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (data) {
      setClients(data)
    }
    setLoading(false)
  }

  const handleCreate = () => {
    setSelectedClient(null)
    setDialogOpen(true)
  }

  const handleEdit = (client: Client) => {
    setSelectedClient(client)
    setDialogOpen(true)
  }

  const confirmDelete = (clientId: string) => {
    setClientToDelete(clientId)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!clientToDelete) return

    setIsDeleting(true)
    const supabase = createClient()

    // Soft delete: set deleted_at instead of deleting the record
    const { error } = await supabase
      .from('clients')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', clientToDelete)

    if (!error) {
      loadClients()
    } else {
      alert('Errore durante l\'eliminazione del cliente')
    }

    setIsDeleting(false)
    setDeleteDialogOpen(false)
    setClientToDelete(null)
  }

  const handleRestore = async (clientId: string) => {
    const supabase = createClient()

    // Restore: remove deleted_at
    const { error } = await supabase
      .from('clients')
      .update({ deleted_at: null })
      .eq('id', clientId)

    if (!error) {
      loadClients()
    } else {
      alert('Errore durante il ripristino del cliente')
    }
  }

  const handlePermanentDelete = async (clientId: string) => {
    if (!confirm(t('permanentDeleteWarning'))) {
      return
    }

    const supabase = createClient()

    // Permanently delete
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', clientId)

    if (!error) {
      loadClients()
    } else {
      alert('Errore durante l\'eliminazione definitiva del cliente')
    }
  }

  const handleSubmit = async (data: ClientInput) => {
    setSubmitting(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    try {
      if (selectedClient) {
        // Update existing client
        await supabase
          .from('clients')
          .update({
            ...data,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedClient.id)
      } else {
        // Create new client
        await supabase.from('clients').insert({
          ...data,
          user_id: user.id,
        })
      }

      setDialogOpen(false)
      loadClients()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {t('newClient')}
        </Button>
      </div>

      <Tabs value={showArchived ? 'archived' : 'active'} onValueChange={(value) => setShowArchived(value === 'archived')}>
        <TabsList>
          <TabsTrigger value="active">{tTabs('active')}</TabsTrigger>
          <TabsTrigger value="archived">
            <Archive className="mr-2 h-4 w-4" />
            {tTabs('archived')}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>{showArchived ? t('archivedTitle') : t('listTitle')}</CardTitle>
          <CardDescription>
            {showArchived ? t('archivedDescription') : t('listDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">
              {tCommon('loading')}
            </p>
          ) : clients.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              {t('noClients')}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('fields.name')}</TableHead>
                  <TableHead>{t('fields.email')}</TableHead>
                  <TableHead>{t('fields.phone')}</TableHead>
                  <TableHead>{t('fields.city')}</TableHead>
                  <TableHead className="text-right">{tCommon('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/${locale}/dashboard/clients/${client.id}`}
                        className="text-primary hover:underline"
                      >
                        {client.name}
                      </Link>
                    </TableCell>
                    <TableCell>{client.email || '-'}</TableCell>
                    <TableCell>{client.phone || '-'}</TableCell>
                    <TableCell>{client.city || '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {!showArchived && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(client)}
                              title={tCommon('edit')}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => confirmDelete(client.id)}
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
                              onClick={() => handleRestore(client.id)}
                              title={t('restore')}
                            >
                              <ArchiveRestore className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handlePermanentDelete(client.id)}
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
          )}
        </CardContent>
      </Card>

      <ClientDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        client={selectedClient}
        loading={submitting}
      />

      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title={t('deleteClient')}
        description={t('deleteDescription')}
        isDeleting={isDeleting}
      />
    </div>
  )
}

