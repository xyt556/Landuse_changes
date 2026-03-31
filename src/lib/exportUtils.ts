import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export interface ExportData {
  matrix: number[][];
  categories: string[];
  colors: string[];
  unit?: string;
}

export const calculateStats = (matrix: number[][], categories: string[]) => {
  const rowSums = matrix.map(row => row.reduce((a, b) => a + b, 0));
  const colSums = categories.map((_, j) => matrix.reduce((sum, row) => sum + (row[j] || 0), 0));
  
  return categories.map((name, i) => {
    const t1 = rowSums[i] || 0;
    const t2 = colSums[i] || 0;
    const unchanged = (matrix[i] && matrix[i][i]) || 0;
    const loss = t1 - unchanged;
    const gain = t2 - unchanged;
    const net = t2 - t1;
    const swap = 2 * Math.min(loss, gain);
    
    return { name, t1, t2, unchanged, loss, gain, net, swap };
  });
};

export const exportToCSV = (data: ExportData) => {
  const { matrix, categories } = data;
  let csvContent = "\ufeff"; // UTF-8 BOM for Excel
  csvContent += "T1 \\ T2," + categories.join(",") + ",T1 Total\n";
  
  matrix.forEach((row, i) => {
    const total = row.reduce((a, b) => a + b, 0);
    csvContent += categories[i] + "," + row.join(",") + "," + total + "\n";
  });
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `land_use_matrix_${new Date().getTime()}.csv`;
  link.click();
};

export const exportToExcel = (data: ExportData) => {
  const { matrix, categories, unit = 'ha' } = data;
  const stats = calculateStats(matrix, categories);
  
  const wb = XLSX.utils.book_new();
  
  // Sheet 1: Matrix
  const matrixData = [
    [`土地利用转移矩阵 (单位: ${unit})`],
    ["T1 \\ T2", ...categories, "T1 总计"],
    ...matrix.map((row, i) => [categories[i], ...row, row.reduce((a, b) => a + b, 0)])
  ];
  const wsMatrix = XLSX.utils.aoa_to_sheet(matrixData);
  XLSX.utils.book_append_sheet(wb, wsMatrix, "转移矩阵");
  
  // Sheet 2: Statistics
  const statsData = [
    ["类别", "T1 面积", "T2 面积", "未变化", "转出 (Loss)", "转入 (Gain)", "净变化 (Net)", "交换变化 (Swap)"],
    ...stats.map(s => [s.name, s.t1, s.t2, s.unchanged, s.loss, s.gain, s.net, s.swap])
  ];
  const wsStats = XLSX.utils.aoa_to_sheet(statsData);
  XLSX.utils.book_append_sheet(wb, wsStats, "变化统计");
  
  XLSX.writeFile(wb, `土地利用分析报告_${new Date().getTime()}.xlsx`);
};

export const exportToPDF = async (elementId: string, filename: string = "分析报告") => {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff'
  });
  
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
  
  pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
  pdf.save(`${filename}.pdf`);
};
