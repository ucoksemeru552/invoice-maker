// helpers
    function formatRp(n){
      if(n === undefined || n === null || isNaN(Number(n))) return 'Rp. 0';
      const isNegative = Number(n) < 0;
      n = Math.abs(Number(n));
      const cents = Math.round((n - Math.floor(n)) * 100);
      const intPart = Math.floor(n);
      // thousand separator dot, decimal comma
      const intStr = intPart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      if(cents === 0) return (isNegative?'-':'') + 'Rp. ' + intStr;
      const centsStr = cents.toString().padStart(2,'0');
      return (isNegative?'-':'') + 'Rp. ' + intStr + ',' + centsStr;
    }

    function parseNumberVal(v){
      if(v === '' || v === null || v === undefined) return 0;
      return Number(String(v).replace(/[^0-9-]+/g,'')) || 0;
    }

    // store the invoice counter in localStorage so it persists after refresh
    let invoiceCounter = parseInt(localStorage.getItem('invoiceCounter') || '0', 10);

    function getInvoiceID() {
      return `Invoice No. ${invoiceCounter.toString().padStart(4, '0')}`;
    }

    function incrementInvoiceID() {
      invoiceCounter++;
      localStorage.setItem('invoiceCounter', invoiceCounter);
      return `Invoice No. ${invoiceCounter.toString().padStart(4, '0')}`;
    }

    // set invoice_no field on page load (no increment)
    document.addEventListener('DOMContentLoaded', () => {
      document.getElementById('invoice_no').value = getInvoiceID();
      updatePreview();
    });

      // We'll integrate the rank upgrade logic directly into your existing invoice generator

      // rank pricing map
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

      // grab static selects from html
      const rankFrom = document.getElementById('rank-from');
      const rankTo = document.getElementById('rank-to');

      // filter To Rank so it only shows higher ranks than From Rank
      rankFrom.addEventListener('change', () => {
        const fromRank = rankFrom.value;
        rankTo.innerHTML = `<option value="">To Rank</option>`;
        Object.keys(rankPrices).forEach(r => {
          if (!fromRank || rankPrices[r] > rankPrices[fromRank]) {
            rankTo.innerHTML += `<option value="${r}">${r} (${formatRp(rankPrices[r])})</option>`;
          }
        });
      });

      // when selecting To Rank, calculate price difference and add to items
      rankTo.addEventListener('change', () => {
        const fromRank = rankFrom.value;
        const toRank = rankTo.value;
        if (fromRank && toRank) {
          const diff = rankPrices[toRank] - rankPrices[fromRank];
          if (diff > 0) {
            // replace any previous upgrade row
            itemsBody.innerHTML = '';
            createItemRow(`${fromRank} → ${toRank}`, 1, diff);
            recalc();
            updatePreview();
          }
        }
      });

    function showMessageBox() {
      const messageBox = document.getElementById('message-box');
      messageBox.style.display = 'flex';
    }

    // Show purchase missing message box
    function showPurchaseMessageBox() {
      const purchaseBox = document.getElementById('message-box-purchase');
      purchaseBox.style.display = 'flex';
    }

    // Close purchase message box when clicking OK
    document.getElementById('message-box-purchase-ok').addEventListener('click', () => {
      document.getElementById('message-box-purchase').style.display = 'none';
    });

    document.getElementById('download').addEventListener('click', () => {
      const nickRaw = document.getElementById('nick').value;
      const discordRaw = document.getElementById('discord').value;

      console.log('Raw values before trim:');
      console.log('nick:', `"${nickRaw}"`, 'discord:', `"${discordRaw}"`);

      const nick = nickRaw.trim();
      const discord = discordRaw.trim();

      console.log('Trimmed values:');
      console.log('nick:', `"${nick}"`, 'discord:', `"${discord}"`);

      if (!nick || !discord) {
        showMessageBox();
        return;
      }

      // Check if there is at least one purchased item with qty > 0 and price > 0
      const rows = itemsBody.querySelectorAll('tr');
      let hasValidPurchase = false;
      rows.forEach(r => {
        const q = parseNumberVal(r.querySelector('.iqty').value);
        const p = parseNumberVal(r.querySelector('.iprice').value);
        if (q > 0 && p > 0) hasValidPurchase = true;
      });

      if (!hasValidPurchase) {
        showPurchaseMessageBox();
        return;
      }

      // Check if there's at least one valid item row
      rows.forEach(r => {
        const q = parseNumberVal(r.querySelector('.iqty').value);
        const p = parseNumberVal(r.querySelector('.iprice').value);
        if (q > 0 && p > 0) hasValidPurchase = true;
      });

      // Or a rank purchase
      if (rankVal) {
        const parts = rankVal.split('|');
        if (parts.length === 2 && parseNumberVal(parts[1]) > 0) {
          hasValidPurchase = true;
        }
      }

      if (!hasValidPurchase) {
        showMessageBox();
        return;
      }

      recalc();
      const element = document.getElementById('preview');

      // Ensure all images (including logo) are loaded before generating PDF
      const images = element.querySelectorAll('img');
      const imagePromises = Array.from(images).map(img => {
        // Force crossorigin for logo loading in html2canvas
        img.crossOrigin = 'anonymous';
        // For base64 images, this step is not needed, but for hosted images, it allows CORS fetching
        if (!img.complete) {
          return new Promise(resolve => {
            img.onload = resolve;
            img.onerror = resolve;
          });
        }
        return Promise.resolve();
      });

      Promise.all(imagePromises).then(() => {
        // Clone element to avoid shifting and add padding to prevent top cut-off
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
            allowTaint: true, // allow cross-domain images if CORS headers are missing
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

    // close message box when OK button clicked
    document.getElementById('message-box-ok').addEventListener('click', () => {
      document.getElementById('message-box').style.display = 'none';
    });

    // reset button keeps invoice_no intact, just resets other fields
    document.getElementById('reset').addEventListener('click', () => {
      const currentInvoice = document.getElementById('invoice_no').value;

      document.getElementById('invoice_date').value = '';
      const nickInput = document.getElementById('nick');
      nickInput.value = '';
      nickInput.dispatchEvent(new Event('input')); // force input event so preview updates
      document.getElementById('discord').value = '';
      document.getElementById('rank').value = '';
      itemsBody.innerHTML = '';
      discountEl.value = '';
      createItemRow('', 0, 0);
      recalc();
      document.getElementById('invoice_no').value = currentInvoice; // restore invoice_no
      updatePreview();
    });

    const itemsBody = document.getElementById('items-body');
    const pItems = document.getElementById('p-items');
    const subtotalEl = document.getElementById('subtotal');
    const totalEl = document.getElementById('total');
    const discountEl = document.getElementById('discount');

    function createItemRow(name = '', qty = 0, price = 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input class="iname" type="text" value="${name}" placeholder="" style="width:100%;padding:6px;border-radius:6px;border:1px solid #eef2ff"/></td>
        <td class="qty"><input class="iqty" type="text" min="0" max="64" value="${qty || ''}" placeholder="0" style="width:80px;padding:6px;border-radius:6px;border:1px solid #eef2ff;text-align:center"/></td>
        <td class="price"><input class="iprice" type="text" value="${price === 0 ? '' : formatRp(price)}" placeholder="0" style="width:140px;padding:6px;border-radius:6px;border:1px solid #eef2ff;text-align:center"/></td>
        <td class="price line">Rp. 0</td>
        <td><button class="remove ghost">x</button></td>
      `;
      itemsBody.appendChild(tr);

      // bind events (scoped per-row)
      const iname = tr.querySelector('.iname');
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
    }

    // live formatting with instant "Rp."
    iprice.addEventListener('input', () => {
      let raw = iprice.value.replace(/\D/g, '');

      if (raw === '') {
        iprice.value = 'Rp. ';
        // move cursor to end after setting value
        setTimeout(() => {
          iprice.selectionStart = iprice.selectionEnd = iprice.value.length;
        }, 0);
        updateLine();
        return;
      }

      iprice.value = 'Rp. ' + parseInt(raw, 10).toLocaleString('id-ID');

      // fix cursor position to be at the end after formatting
      setTimeout(() => {
        iprice.selectionStart = iprice.selectionEnd = iprice.value.length;
      }, 0);

      updateLine();
    });

    // blur event still keeps formatting clean
    iprice.addEventListener('blur', () => {
      let raw = iprice.value.replace(/\D/g, '');
      if (raw === '') {
        iprice.value = 'Rp. ';
        return;
      }
      iprice.value = 'Rp. ' + parseInt(raw, 10).toLocaleString('id-ID');
    });

    // make sure rank changes update everything instantly
    document.getElementById('rank').addEventListener('change', updateAll);

    // when discount changes
    discountEl.addEventListener('input', () => {
      // get only digits
      let val = discountEl.value.replace(/[^0-9]/g, '');
      if (val === '') val = '0';

      // clamp
      let num = Math.min(Math.max(Number(val), 0), 100);

      // always display with %
      discountEl.value = num + '%';

      updateAll();
    });

    // keep cursor before % when editing
    discountEl.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && discountEl.selectionStart === discountEl.value.length) {
        e.preventDefault();
        let val = discountEl.value.replace(/[^0-9]/g, '');
        val = val.slice(0, -1);
        discountEl.value = (val || '0') + '%';
        updateAll();
      }
    });

    // invoice details changes
    document.getElementById('invoice_no').addEventListener('input', updateAll);
    document.getElementById('invoice_date').addEventListener('input', updateAll);
    document.getElementById('nick').addEventListener('input', updateAll);
    document.getElementById('discord').addEventListener('input', updateAll);

    // make sure every item price or qty update triggers recalculation and preview instantly
    itemsBody.addEventListener('input', updateAll);

    // also run once on page load
    updateAll();

      iqty.addEventListener('input', updateLine);
      iname.addEventListener('input', updatePreview);
      remove.addEventListener('click', ()=>{ tr.remove(); recalc(); updatePreview(); });

      updateLine();
      updatePreview();
    }

    document.getElementById('add-item').addEventListener('click', ()=>{ createItemRow('','',''); });
    document.getElementById('clear-items').addEventListener('click', ()=>{ itemsBody.innerHTML=''; recalc(); updatePreview(); });

    function recalc(){
      const rows = itemsBody.querySelectorAll('tr');
      let subtotal = 0;
      rows.forEach(r=>{
        const q = parseNumberVal(r.querySelector('.iqty').value);
        const p = parseNumberVal(r.querySelector('.iprice').value);
        subtotal += q * p;
      });

      const rankVal = document.getElementById('rank').value;
      let rankPrice = 0;
      if(rankVal){
        const parts = rankVal.split('|');
        if(parts.length === 2){
          rankPrice = Number(parts[1]) || 0;
        }
      }
      subtotal += rankPrice;

      const discPercent = parseNumberVal(discountEl.value);
      const discountValue = subtotal * (discPercent / 100);
      const total = subtotal - discountValue;

      console.log('subtotal:', subtotal, 'discount %:', discPercent, 'discount value:', discountValue, 'total:', total);

      subtotalEl.textContent = formatRp(subtotal);
      totalEl.textContent = formatRp(total);

      document.getElementById('p-sub').textContent = formatRp(subtotal);
      document.getElementById('p-disc').textContent = formatRp(discountValue);
      document.getElementById('p-total').textContent = formatRp(total);
    }

    function updateInputsDisplay(){
      document.querySelectorAll('input.iqty, input.iprice').forEach(input => {
        let val = input.value.replace(/\D/g,''); // get numeric only
        if(val === '0' || val === '' ){
          input.value = '';
          input.placeholder = '0';
        } else {
          input.value = val;
          input.placeholder = '';
        }
      });
    }

    // call updateInputsDisplay after any input changes
    itemsBody.addEventListener('input', () => {
      updateInputsDisplay();
      recalc();
      updatePreview();
    });
    updateInputsDisplay();

    function updatePreview() {

      // invoice no & date
      document.getElementById('p-inv').textContent =
        document.getElementById('invoice_no').value || '';
      const d = document.getElementById('invoice_date').value;
      document.getElementById('p-date').textContent =
        d ? new Date(d).toLocaleDateString('id-ID') : '';

      // nick / discord
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

      // rank label
      if (rankVal) {
        const [rname] = rankVal.split('|');
        document.getElementById('p-rank').textContent = 'Rank Purchase: ' + rname;
      } else {
        document.getElementById('p-rank').textContent = '';
      }

      // items
      pItems.innerHTML = '';
      if (rankVal) {
        const [rname, rprice] = rankVal.split('|');
        if (rname && rprice && Number(rprice) > 0) {
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

      // totals
      recalc();

      // default notes if empty
      document.getElementById('p-notes').textContent =
        document.getElementById('notes').value || '-';
    }

    // Date
    document.addEventListener('DOMContentLoaded', () => {
      // set invoice_no as you already do
      document.getElementById('invoice_no').value = getInvoiceID();

      // set today's date as default for invoice_date input
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0'); // months are 0-based
      const dd = String(today.getDate()).padStart(2, '0');
      const formattedDate = `${yyyy}-${mm}-${dd}`;
      document.getElementById('invoice_date').value = formattedDate;

      updatePreview();
    });

    // auto replace spaces with underscores for minecraft usernames
    document.getElementById('nick').addEventListener('input', function() {
      this.value = this.value.replace(/\s+/g, '_');
      updatePreview();
    });

    // bind inputs to preview updates
    ['input', 'change'].forEach(evt => {
      document.getElementById('nick').addEventListener(evt, updatePreview);
      document.getElementById('discord').addEventListener(evt, updatePreview);
      document.getElementById('rank').addEventListener(evt, updatePreview);
      document.getElementById('invoice_no').addEventListener(evt, updatePreview);
      document.getElementById('invoice_date').addEventListener(evt, updatePreview);
      document.getElementById('discount').addEventListener(evt, updatePreview);
      document.getElementById('notes').addEventListener(evt, updatePreview);
      itemsBody.addEventListener(evt, updatePreview);
    });

    // initial state
    createItemRow('',0,0);
    recalc();

    document.getElementById('reset').addEventListener('click', () => {
      document.getElementById('invoice_no').value = getInvoiceID();  // show current invoice number
      document.getElementById('invoice_date').value = '';
      const nickInput = document.getElementById('nick');
      nickInput.value = '';
      nickInput.dispatchEvent(new Event('input')); // update preview
      document.getElementById('discord').value = '';
      document.getElementById('rank').value = '';
      itemsBody.innerHTML = '';
      discountEl.value = '';
      createItemRow('', 0, 0);
      recalc();
      updatePreview();
    });

    // auto-format preview on any table change
    itemsBody.addEventListener('input', ()=>{ recalc(); updatePreview(); });

    window.onload = () => {
      const box = document.getElementById('message-box');
      console.log('message-box display on load:', getComputedStyle(box).display);
      if(getComputedStyle(box).display !== 'none') {
        box.style.display = 'none';
        console.log('message-box forced hidden on load');
      }
    };