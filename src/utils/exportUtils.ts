export class ExportUtils {
  /**
   * Generates and downloads a CSV file with UTF-8 BOM support for Microsoft Excel
   */
  public static exportToCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
    const csvContent = [
      headers.join(';'),
      ...rows.map((row) =>
        row
          .map((cell) => {
            const str = cell !== undefined && cell !== null ? String(cell) : '';
            // Escape double quotes and wrap in quotes if contains delimiter or newline
            if (str.includes(';') || str.includes('\n') || str.includes('"')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          })
          .join(';')
      ),
    ].join('\r\n');

    // Add UTF-8 Byte Order Mark (BOM)
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Exports data to a formatted JSON file
   */
  public static exportToJson(filename: string, data: any): void {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Exports tabular data into an Excel-compatible XML/HTML spreadsheet format
   */
  public static exportToExcel(
    filename: string,
    sheetTitle: string,
    headers: string[],
    rows: (string | number)[][]
  ): void {
    const tableHeader = headers.map((h) => `<th style="background-color:#1e40af;color:#ffffff;padding:8px;border:1px solid #cbd5e1;font-weight:bold;">${h}</th>`).join('');
    const tableRows = rows
      .map(
        (r) =>
          `<tr>${r
            .map(
              (c) =>
                `<td style="padding:6px;border:1px solid #cbd5e1;">${c !== undefined && c !== null ? String(c) : ''}</td>`
            )
            .join('')}</tr>`
      )
      .join('');

    const excelHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <title>${sheetTitle}</title>
      </head>
      <body>
        <h2 style="font-family:sans-serif;color:#1e3a8a;">${sheetTitle}</h2>
        <table style="border-collapse:collapse;font-family:sans-serif;font-size:12px;" border="1">
          <thead><tr>${tableHeader}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </body>
      </html>
    `.trim();

    const blob = new Blob(['\uFEFF' + excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

