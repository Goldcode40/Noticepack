export type FieldType = 'text' | 'number' | 'date' | 'textarea'

export type FieldSchema = {
  key: string
  label: string
  type: FieldType
  required?: boolean
  placeholder?: string
  help?: string
}

export type WizardSchema = {
  title: string
  fields: FieldSchema[]
}

/**
 * Schema is keyed by document_types.doc_name (what you display in UI).
 * If a doc has no schema yet, we fall back to a small generic set.
 */
const schemasByDocName: Record<string, WizardSchema> = {
  'Notice of Non-Renewal': {
    title: 'Notice of Non-Renewal',
    fields: [
      { key: 'landlord_name', label: 'Landlord name', type: 'text', required: true, placeholder: 'e.g. John Landlord' },
      { key: 'tenant_name', label: 'Tenant name', type: 'text', required: true, placeholder: 'e.g. Jane Tenant' },
      { key: 'property_address', label: 'Property address', type: 'textarea', required: true, placeholder: 'Street, City, State, ZIP' },
      { key: 'notice_date', label: 'Notice date', type: 'date', required: true },
      { key: 'move_out_date', label: 'Move-out date', type: 'date', required: true },
      { key: 'landlord_email', label: 'Landlord email', type: 'text', placeholder: 'optional' },
      { key: 'landlord_phone', label: 'Landlord phone', type: 'text', placeholder: 'optional' },
    ],
  },

  'Pay Rent or Quit': {
    title: 'Pay Rent or Quit',
    fields: [
      { key: 'landlord_name', label: 'Landlord name', type: 'text', required: true },
      { key: 'tenant_name', label: 'Tenant name', type: 'text', required: true },
      { key: 'property_address', label: 'Property address', type: 'textarea', required: true },
      { key: 'rent_amount', label: 'Past due rent amount', type: 'number', required: true, placeholder: 'e.g. 1200' },
      { key: 'rent_due_date', label: 'Rent due date', type: 'date', required: true },
      { key: 'notice_date', label: 'Notice date', type: 'date', required: true },
      { key: 'payment_instructions', label: 'How tenant can pay', type: 'textarea', placeholder: 'optional' },
    ],
  },

  'Late Rent Reminder': {
    title: 'Late Rent Reminder',
    fields: [
      { key: 'tenant_name', label: 'Tenant name', type: 'text', required: true },
      { key: 'property_address', label: 'Property address', type: 'textarea', required: true },
      { key: 'rent_amount', label: 'Rent amount', type: 'number', required: true },
      { key: 'rent_due_date', label: 'Rent due date', type: 'date', required: true },
      { key: 'note', label: 'Optional note', type: 'textarea' },
    ],
  },
}

const fallbackSchema: WizardSchema = {
  title: 'Document Wizard',
  fields: [
    { key: 'landlord_name', label: 'Landlord name', type: 'text', required: true },
    { key: 'tenant_name', label: 'Tenant name', type: 'text', required: true },
    { key: 'property_address', label: 'Property address', type: 'textarea', required: true },
    { key: 'notice_date', label: 'Notice date', type: 'date' },
  ],
}

export function getWizardSchema(docName: string | null | undefined): WizardSchema {
  if (!docName) return fallbackSchema
  return schemasByDocName[docName] ?? fallbackSchema
}