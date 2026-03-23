import './PreviewTable.css'

const COLUMNS = [
  { key: 'upc', label: 'UPC' },
  { key: 'name', label: 'Product/Service Name' },
  { key: 'category', label: 'Category' },
  { key: 'subCategory', label: 'Sub-Category' },
  { key: 'sizeDescription', label: 'Size/Description' },
  { key: 'unitOfMeasure', label: 'Unit' },
  { key: 'storePrice', label: 'Store Price' },
]

export default function PreviewTable({ rows }) {
  if (!rows || rows.length === 0) return null

  const displayRows = rows.slice(0, 10)

  return (
    <div className="preview-table-wrap" role="region" aria-label="Inventory preview" tabIndex={0}>
      <table className="preview-table">
        <thead>
          <tr>
            {COLUMNS.map(col => (
              <th key={col.key} className="preview-table__th">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayRows.map((row, i) => (
            <tr key={i} className="preview-table__tr">
              {COLUMNS.map(col => (
                <td key={col.key} className="preview-table__td">
                  {col.key === 'storePrice'
                    ? `$${Number(row[col.key] || 0).toFixed(2)}`
                    : row[col.key] || '—'
                  }
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
