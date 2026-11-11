// Mahalliy sana YYYY-MM-DD (toISOString UTC beradi — O'zbekistonda tunda kechagi sana chiqib qoladi)
function localDate(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
module.exports = { localDate };
