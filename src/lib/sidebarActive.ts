// Which menu item is lit for the page being shown. Exactly one item at most: the page's own item if it has one, otherwise the item whose address is the
// longest start of the page's address ("/teacher/exam/123" lights "/teacher/tests" only when a layout maps it there; an unmapped page lights nothing).
// A portal's home item ("/teacher", "/learning", "/school-admin") lights only on its own page. It used to light for every page without a menu item of its
// own, which looked like being sent back to the home page.
export function activeNavHref(hrefs: string[], pathname: string | null | undefined): string | null {
  if (!pathname) return null
  if (hrefs.includes(pathname)) return pathname
  const isHome = (href: string) => href.split('/').filter(Boolean).length <= 1
  const best = hrefs.filter((h) => !isHome(h) && pathname.startsWith(h + '/')).sort((a, b) => b.length - a.length)[0]
  return best ?? null
}
