import { redirect } from 'next/navigation'

// Subjects now live on the Departments page, under each department.
export default function SchoolAdminSubjectsPage() {
  redirect('/school-admin/departments')
}
