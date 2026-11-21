export function downloadTextFile(value, filename, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
