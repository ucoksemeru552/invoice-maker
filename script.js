// Helpers
function formatRp(n) {
  if (n === undefined || n === null || isNaN(Number(n))) return 'Rp. 0';
  const isNegative = Number(n) < 0;
  n = Math.abs(Number(n));
  const cents = Math.round((n - Math.floor(n)) * 100);
  const intPart = Math.floor(n);
  const intStr = intPart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (cents === 0) return (isNegative ? '-' : '') + 'Rp. ' + intStr;
  const centsStr = cents.toString().padStart(2, '0');
  return (isNegative ? '-' : '') + 'Rp. ' + intStr + ',' + centsStr;
}

function parseNumberVal(v) {
  if (v === '' || v === null || v === undefined) return 0;
  return Number(String(v).replace(/[^0-9-]+/g, '')) || 0;
}

// Invoice counter in localStorage
let invoiceCounter = parseInt(localStorage.getItem('invoiceCounter') || '0', 10);

function getInvoiceID() {
  return `Invoice No. ${invoiceCounter.toString().padStart(4, '0')}`;
}

function incrementInvoiceID() {
  invoiceCounter++;
  localStorage.setItem('invoiceCounter', invoiceCounter);
  return `Invoice No. ${invoiceCounter.toString().padStart(4, '0')}`;
}

// DOM references
const itemsBody = document.getElementById('items-body');
const pItems = document.getElementById('p-items');
const subtotalEl = document.getElementById('subtotal');
const totalEl = document.getElementById('total');
const discountEl = document.getElementById('discount');
const rankFrom = document.getElementById('rank-from');
const rankTo = document.getElementById('rank-to');

let rankUpgrade = null;

// Rank prices map
const rankPrices = {
  'VIP': 50000,
  'VIP+': 80000,
  'CUSTOM': 1000000,
  'CRISPY+': 570000,
  'RICH': 360000,
  'MVP++': 220000,
  'MVP+': 180000,
  'MVP': 140000
};

// Disable same option in rankTo when rankFrom changes
rankFrom.addEventListener('change', () => {
  const fromRank = rankFrom.value;

  if (!fromRank) {
    // If fromRank is empty, reset toRank and enable all options
    rankTo.value = '';
    Array.from(rankTo.options).forEach(opt => {
      opt.disabled = false;
    });
    rankTo.dispatchEvent(new Event('change'));
    return;
  }

  Array.from(rankTo.options).forEach(opt => {
    opt.disabled = (opt.value === fromRank);
  });

  if (rankTo.value === fromRank) {
    rankTo.value = '';
    rankTo.dispatchEvent(new Event('change'));
  }
});

// Rank To change -> calculate upgrade price and update item rows
rankTo.addEventListener('change', () => {
  const fromRank = rankFrom.value;
  const toRank = rankTo.value;

  if (fromRank && toRank) {
    const diff = rankPrices[toRank] - rankPrices[fromRank];
    if (diff >= 0) {
      rankUpgrade = { from: fromRank, to: toRank, price: diff };
    } else {
      rankUpgrade = null;
    }
  } else {
    rankUpgrade = null;
  }
  recalc();
  updatePreview();
});

// Create item row helper with event bindings
function createItemRow(name = '', qty = 0, price = 0) {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input class="iname" type="text" value="${name}" style="width:100%;padding:6px;border-radius:6px;border:1px solid #eef2ff"/></td>
    <td class="qty"><input class="iqty" type="text" min="0" max="64" value="${qty || ''}" placeholder="0" style="width:80px;padding:6px;border-radius:6px;border:1px solid #eef2ff;text-align:center"/></td>
    <td class="price"><input class="iprice" type="text" value="${price === 0 ? '' : formatRp(price)}" placeholder="0" style="width:140px;padding:6px;border-radius:6px;border:1px solid #eef2ff;text-align:center"/></td>
    <td class="price line">${formatRp(qty * price)}</td>
    <td><button class="remove ghost">x</button></td>
  `;
  itemsBody.appendChild(tr);

  const iqty = tr.querySelector('.iqty');
  const iprice = tr.querySelector('.iprice');
  const line = tr.querySelector('.line');
  const remove = tr.querySelector('.remove');

  function updateLine() {
    let q = parseNumberVal(iqty.value);
    if (q > 64) q = 64;
    if (q < 0) q = 0;
    iqty.value = q === 0 ? '' : q;

    let p = parseNumberVal(iprice.value);
    const lt = q * p;
    line.textContent = formatRp(lt);
    recalc();
    updatePreview();
  }

  iqty.addEventListener('input', updateLine);

  iprice.addEventListener('input', () => {
    let raw = iprice.value.replace(/\D/g, '');
    if (raw === '') {
      iprice.value = 'Rp. ';
      setTimeout(() => {
        iprice.selectionStart = iprice.selectionEnd = iprice.value.length;
      }, 0);
      updateLine();
      return;
    }
    iprice.value = 'Rp. ' + parseInt(raw, 10).toLocaleString('id-ID');
    setTimeout(() => {
      iprice.selectionStart = iprice.selectionEnd = iprice.value.length;
    }, 0);
    updateLine();
  });

  iprice.addEventListener('blur', () => {
    let raw = iprice.value.replace(/\D/g, '');
    if (raw === '') {
      iprice.value = 'Rp. ';
      return;
    }
    iprice.value = 'Rp. ' + parseInt(raw, 10).toLocaleString('id-ID');
  });

  remove.addEventListener('click', () => {
    tr.remove();
    recalc();
    updatePreview();
  });

  // Initial line update
  updateLine();
  return tr;
}

// Recalculate totals
function recalc() {
  const rows = itemsBody.querySelectorAll('tr');
  let subtotal = 0;

  rows.forEach(r => {
    const q = parseNumberVal(r.querySelector('.iqty').value);
    const p = parseNumberVal(r.querySelector('.iprice').value);
    subtotal += q * p;
  });

  // Rank purchase price if no upgrade
  let rankPrice = 0;
  const rankEl = document.getElementById('rank');
  if (rankEl && rankEl.value && !rankUpgrade) {
    const parts = rankEl.value.split('|');
    if (parts.length === 2) {
      rankPrice = Number(parts[1]) || 0;
    }
  }
  if (rankUpgrade) {
    subtotal += rankUpgrade.price;
  } else {
    subtotal += rankPrice;
  }

  // Include rankUpgrade price if any (already added as item row, so no double add)

  const discPercent = parseNumberVal(discountEl.value);
  const discountValue = subtotal * (discPercent / 100);
  const total = subtotal - discountValue;

  subtotalEl.textContent = formatRp(subtotal);
  totalEl.textContent = formatRp(total);

  document.getElementById('p-sub').textContent = formatRp(subtotal);
  document.getElementById('p-disc').textContent = formatRp(discountValue);
  document.getElementById('p-total').textContent = formatRp(total);
}

// Update preview panel with invoice data and items
function updatePreview() {
  document.getElementById('p-inv').textContent = document.getElementById('invoice_no').value || '';
  const d = document.getElementById('invoice_date').value;
  document.getElementById('p-date').textContent = d ? new Date(d).toLocaleDateString('id-ID') : '';

  const nickVal = document.getElementById('nick').value;
  const discordVal = document.getElementById('discord').value;
  const rankVal = document.getElementById('rank').value;

  if (!nickVal && rankVal) {
    const [rname] = rankVal.split('|');
    document.getElementById('p-nick').textContent = rname;
  } else {
    document.getElementById('p-nick').textContent = nickVal || '';
  }
  document.getElementById('p-discord').textContent = discordVal || '';

  // Clear previous items preview
  pItems.innerHTML = '';

  if (rankUpgrade) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${rankUpgrade.from} → ${rankUpgrade.to}</td>
      <td class="qty">1</td>
      <td class="price">${formatRp(rankUpgrade.price)}</td>
      <td class="price">${formatRp(rankUpgrade.price)}</td>
    `;
    pItems.appendChild(tr);
  } else if (rankVal) {
    const [rname, rprice] = rankVal.split('|');
    if (Number(rprice) > 0) {
      const trRank = document.createElement('tr');
      trRank.innerHTML = `
        <td>Rank: ${rname}</td>
        <td class="qty">1</td>
        <td class="price">${formatRp(Number(rprice))}</td>
        <td class="price">${formatRp(Number(rprice))}</td>
      `;
      pItems.appendChild(trRank);
    }
  }

  // Add item rows (excluding rank upgrade/purchase shown above)
  const rows = itemsBody.querySelectorAll('tr');
  rows.forEach(r => {
    const name = r.querySelector('.iname').value || '';
    const qty = parseNumberVal(r.querySelector('.iqty').value) || 0;
    const price = parseNumberVal(r.querySelector('.iprice').value) || 0;
    if (name === '' && qty === 0 && price === 0) return;
    const line = qty * price;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${name}</td>
      <td class="qty">${qty}</td>
      <td class="price">${formatRp(price)}</td>
      <td class="price">${formatRp(line)}</td>
    `;
    pItems.appendChild(tr);
  });

  recalc();

  document.getElementById('p-notes').textContent = document.getElementById('notes').value || '-';
}

// On page load setup
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('invoice_no').value = getInvoiceID();

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  document.getElementById('invoice_date').value = `${yyyy}-${mm}-${dd}`;

  createItemRow('', 0, 0);

  updatePreview();
  recalc();
});

// Auto replace spaces in nick with underscores
document.getElementById('nick').addEventListener('input', function () {
  this.value = this.value.replace(/\s+/g, '_');
  updatePreview();
});

// Discount input handler with % clamp and display
discountEl.addEventListener('input', () => {
  let val = discountEl.value.replace(/[^0-9]/g, '');
  if (val === '') val = '0';
  let num = Math.min(Math.max(Number(val), 0), 100);
  discountEl.value = num + '%';
  updatePreview();
  recalc();
});

discountEl.addEventListener('keydown', (e) => {
  if (e.key === 'Backspace' && discountEl.selectionStart === discountEl.value.length) {
    e.preventDefault();
    let val = discountEl.value.replace(/[^0-9]/g, '');
    val = val.slice(0, -1);
    discountEl.value = (val || '0') + '%';
    updatePreview();
    recalc();
  }
});

// Bind inputs to update preview
['input', 'change'].forEach(evt => {
  document.getElementById('nick').addEventListener(evt, updatePreview);
  document.getElementById('discord').addEventListener(evt, updatePreview);
  document.getElementById('rank').addEventListener(evt, updatePreview);
  document.getElementById('invoice_no').addEventListener(evt, updatePreview);
  document.getElementById('invoice_date').addEventListener(evt, updatePreview);
  document.getElementById('discount').addEventListener(evt, updatePreview);
  document.getElementById('notes').addEventListener(evt, updatePreview);
  itemsBody.addEventListener(evt, () => {
    recalc();
    updatePreview();
  });
});

// Add / clear item buttons
document.getElementById('add-item').addEventListener('click', () => createItemRow('', 0, 0));
document.getElementById('clear-items').addEventListener('click', () => {
  itemsBody.innerHTML = '';
  recalc();
  updatePreview();
  createItemRow('', 0, 0);
});

// Reset button (keep invoice_no)
document.getElementById('reset').addEventListener('click', () => {
  const currentInvoice = document.getElementById('invoice_no').value;
  document.getElementById('invoice_date').value = '';
  document.getElementById('nick').value = '';
  document.getElementById('discord').value = '';
  document.getElementById('rank').value = '';
  discountEl.value = '';
  itemsBody.innerHTML = '';
  createItemRow('', 0, 0);
  recalc();
  updatePreview();
  document.getElementById('invoice_no').value = currentInvoice;
});

// Message boxes
function showMessageBox() {
  document.getElementById('message-box').style.display = 'flex';
}

function showPurchaseMessageBox() {
  document.getElementById('message-box-purchase').style.display = 'flex';
}

document.getElementById('message-box-ok').addEventListener('click', () => {
  document.getElementById('message-box').style.display = 'none';
});

document.getElementById('message-box-purchase-ok').addEventListener('click', () => {
  document.getElementById('message-box-purchase').style.display = 'none';
});

// PDF download button
document.getElementById('download').addEventListener('click', () => {
  const nickRaw = document.getElementById('nick').value;
  const discordRaw = document.getElementById('discord').value;

  const nick = nickRaw.trim();
  const discord = discordRaw.trim();

  if (!nick || !discord) {
    showMessageBox();
    return;
  }

  const rows = itemsBody.querySelectorAll('tr');
  let hasValidPurchase = false;
  rows.forEach(r => {
    const q = parseNumberVal(r.querySelector('.iqty').value);
    const p = parseNumberVal(r.querySelector('.iprice').value);
    if (q > 0 && p > 0) hasValidPurchase = true;
  });

  const rankVal = document.getElementById('rank').value;
  if (!hasValidPurchase && rankVal) {
    const parts = rankVal.split('|');
    if (parts.length === 2 && parseNumberVal(parts[1]) > 0) {
      hasValidPurchase = true;
    }
  }

  if (!hasValidPurchase) {
    showPurchaseMessageBox();
    return;
  }

  recalc();
  const element = document.getElementById('preview');

  // Wait for images to load for html2pdf
  const images = element.querySelectorAll('img');
  const imagePromises = Array.from(images).map(img => {
    img.crossOrigin = 'anonymous';
    if (!img.complete) {
      return new Promise(resolve => {
        img.onload = resolve;
        img.onerror = resolve;
      });
    }
    return Promise.resolve();
  });

  Promise.all(imagePromises).then(() => {
    const clone = element.cloneNode(true);
    clone.style.background = '#fff';
    clone.style.paddingTop = '20px';

    const opt = {
      margin: [10, 10, 10, 10],
      filename: `${nick || 'invoice'}_${document.getElementById('invoice_no').value || ''}.pdf`,
      image: { type: 'jpeg', quality: 1 },
      html2canvas: {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        scrollY: 0,
        logging: false,
        backgroundColor: '#fff'
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(clone).save().then(() => {
      document.getElementById('invoice_no').value = incrementInvoiceID();
      updatePreview();
    }).catch(() => {
      console.log('PDF download cancelled or failed, invoice not incremented');
    });
  });
});

// Hide message-box on load if visible
window.onload = () => {
  const box = document.getElementById('message-box');
  if (getComputedStyle(box).display !== 'none') {
    box.style.display = 'none';
  }
};
