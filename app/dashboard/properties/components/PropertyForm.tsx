'use client'

import PropertyWizard, { PropertyWizardProps } from './PropertyWizard'

export default function PropertyForm(props: PropertyWizardProps) {
  return (
    <div id="property-form">
      <PropertyWizard {...props} variant="card" />
    </div>
  )
}

export * from './PropertyWizard'
