
    const STATEMENT = 'txn_book_v1';
    const STATEMENT_NXTID = 'txn_book_next_id_v1';

    const nf = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

    const formatAmt = (n) => {
      if (!n || n === 0) return '';
      return nf.format(+n);
    };

    // Accepts YYYY-MM-DD; displays as DD-MMM-YYYY (e.g., 01-Jan-2026)
    function toDisplayDate(iso) {
      if (!iso) return '';
      const [y, m, d] = iso.split('-').map(Number);
      const dt = new Date(Date.UTC(y, (m - 1), d));
      return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
    }

    function getStatementAry() {
      try { return JSON.parse(localStorage.getItem(STATEMENT)) || []; }
      catch { return []; }
    }
    function setStatementAry(arr) {
      localStorage.setItem(STATEMENT, JSON.stringify(arr));
    }
    function getNextId() {
      let n = parseInt(localStorage.getItem(STATEMENT_NXTID) || '1', 10);
      localStorage.setItem(STATEMENT_NXTID, String(n + 1));
      return n;
    }
    function setNextIdIfMissing(arr) {
      if (!localStorage.getItem(STATEMENT_NXTID)) {
        const maxId = arr.reduce((m, t) => Math.max(m, t.id || 0), 0);
        localStorage.setItem(STATEMENT_NXTID, String(maxId + 1));
      }
    }

    let transactions = getStatementAry();
    setNextIdIfMissing(transactions);
    let editingId = null; 

    const rowsBody = document.getElementById('rowsBody');
    const totCreditEl = document.getElementById('totCredit');
    const totDebitEl = document.getElementById('totDebit');
    const balanceEl = document.getElementById('balance');

    const addDate = document.getElementById('addDate');
    const addHeader = document.getElementById('addHeader');
    const addCredit = document.getElementById('addCredit');
    const addDebit = document.getElementById('addDebit');

    const dateErr = document.getElementById('dateErr');
    const headerErr = document.getElementById('headerErr');
    const amountErr = document.getElementById('amountErr');
    const form = document.getElementById("addstate");

    function renderTable() {
      rowsBody.innerHTML = '';
      transactions.forEach((t, idx) => {
        const tr = document.createElement('tr');

        const tdIdx = document.createElement('td');
        //tdIdx.innerHTML = `<span class="badge rounded-pill badge-id">${idx + 1}.</span>`;
        tdIdx.innerHTML = idx + 1;
        tr.appendChild(tdIdx);

        if (editingId === t.id) {
          const tdDate = document.createElement('td');
          tdDate.innerHTML = `
            <input type="date" class="form-control form-control-sm" value="${t.date || ''}" id="editDate-${t.id}">
          `;
          tr.appendChild(tdDate);

          const tdHeader = document.createElement('td');
          tdHeader.innerHTML = `
            <input type="text" class="form-control form-control-sm" value="${escapeHtml(t.header || '')}" id="editHeader-${t.id}">
          `;
          tr.appendChild(tdHeader);

          const tdCredit = document.createElement('td');
          tdCredit.className = 'amount';
          tdCredit.innerHTML = `
            <input type="number" class="form-control form-control-sm text-end" id="editCredit-${t.id}" min="0" step="0.01" value="${t.credit || ''}">
          `;
          tr.appendChild(tdCredit);

          const tdDebit = document.createElement('td');
          tdDebit.className = 'amount';
          tdDebit.innerHTML = `
            <input type="number" class="form-control form-control-sm text-end" id="editDebit-${t.id}" min="0" step="0.01" value="${t.debit || ''}">
          `;
          tr.appendChild(tdDebit);

          const tdActions = document.createElement('td');
          tdActions.className = 'text-nowrap';
          tdActions.innerHTML = `
            <button class="btn btn-success btn-xs me-2" data-action="save" data-id="${t.id}">SAVE</button>
            <button class="btn btn-secondary btn-xs" data-action="cancel" data-id="${t.id}">CANCEL</button>
          `;
          tr.appendChild(tdActions);

        } else {
          const tdDate = document.createElement('td');
          tdDate.textContent = toDisplayDate(t.date);
          tr.appendChild(tdDate);

          const tdHeader = document.createElement('td');
          tdHeader.textContent = t.header || '';
          tr.appendChild(tdHeader);

          const tdCredit = document.createElement('td');
          tdCredit.className = 'amount';
          tdCredit.textContent = formatAmt(t.credit);
          tr.appendChild(tdCredit);

          const tdDebit = document.createElement('td');
          tdDebit.className = 'amount';
          tdDebit.textContent = formatAmt(t.debit);
          tr.appendChild(tdDebit);

          const tdActions = document.createElement('td');
          tdActions.className = 'text-nowrap';
          tdActions.innerHTML = `
            <button class="btn btn-outline-info btn-xs me-2" data-action="edit" data-id="${t.id}">EDIT</button>
            <button class="btn btn-outline-danger btn-xs" data-action="remove" data-id="${t.id}">REMOVE</button>
          `;
          tr.appendChild(tdActions);
        }

        rowsBody.appendChild(tr);
      });

      updateTotals();
    }

    function updateTotals() {
      const totalCredit = transactions.reduce((s, t) => s + (+t.credit || 0), 0);
      const totalDebit = transactions.reduce((s, t) => s + (+t.debit || 0), 0);
      const balance = totalCredit - totalDebit;

      totCreditEl.textContent = formatAmt(totalCredit);
      totDebitEl.textContent = formatAmt(totalDebit);
      balanceEl.textContent = formatAmt(balance);
    }

    function escapeHtml(text) {
      return (text || '').replace(/[&<>"']/g, (m) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
      }[m]));
    }
    
    form.addEventListener("submit", (event) => {
      clearErrors();
      if (!form.checkValidity()) {
        event.preventDefault();
        event.stopPropagation();
      } else {
        event.preventDefault(); 
        const date = (addDate.value || '').trim();
      const header = (addHeader.value || '').trim();
      const credit = parseFloat(addCredit.value);
      const debit  = parseFloat(addDebit.value);

      let valid = true;

      if (!date) { dateErr.classList.remove('d-none'); valid = false; }
      if (!header) { headerErr.classList.remove('d-none'); valid = false; }

      const creditValid = !isNaN(credit) && credit > 0;
      const debitValid  = !isNaN(debit)  && debit  > 0;

      if ((creditValid && debitValid) || (!creditValid && !debitValid)) {
        amountErr.classList.remove('d-none');
        valid = false;
      }

      if (!valid) return;

      const newTxn = {
        id: getNextId(),
        date,
        header,
        credit: creditValid ? +credit.toFixed(2) : 0,
        debit: debitValid ? +debit.toFixed(2) : 0
      };

      transactions.push(newTxn);
      setStatementAry(transactions);
      addHeader.value = '';
      addCredit.value = '';
      addDebit.value = '';
      addHeader.focus();
      renderTable();
      }
      form.classList.add("was-validated");

    },false);

    function clearErrors() {
      dateErr.classList.add('d-none');
      headerErr.classList.add('d-none');
      amountErr.classList.add('d-none');
    }

    rowsBody.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-action');
      const id = parseInt(btn.getAttribute('data-id'), 10);

      if (action === 'edit') {
        if (editingId !== null) return;
        editingId = id;
        renderTable();
      }
      else if (action === 'cancel') {
        editingId = null;
        renderTable();
      }
      else if (action === 'save') {
        handleSave(id);
      }
      else if (action === 'remove') {
        handleRemove(id);
      }
    });

    function handleSave(id) {
      const edDate = document.getElementById(`editDate-${id}`)?.value.trim();
      const edHeader = document.getElementById(`editHeader-${id}`)?.value.trim();
      const edCredit = parseFloat(document.getElementById(`editCredit-${id}`)?.value);
      const edDebit  = parseFloat(document.getElementById(`editDebit-${id}`)?.value);

      if (!edDate || !edHeader) {
        alert('Please fill Date and Header.');
        return;
      }
      const creditValid = !isNaN(edCredit) && edCredit > 0;
      const debitValid  = !isNaN(edDebit)  && edDebit  > 0;

      if ((creditValid && debitValid) || (!creditValid && !debitValid)) {
        alert('Enter either Credit OR Debit (exactly one), greater than 0.');
        return;
      }

      const idx = transactions.findIndex(t => t.id === id);
      if (idx !== -1) {
        transactions[idx] = {
          ...transactions[idx],
          date: edDate,
          header: edHeader,
          credit: creditValid ? +edCredit.toFixed(2) : 0,
          debit: debitValid ? +edDebit.toFixed(2) : 0
        };
        setStatementAry(transactions);
      }
      editingId = null;
      renderTable();
    }

    function handleRemove(id) {
      if (!confirm('Remove this transaction?')) return;
      transactions = transactions.filter(t => t.id !== id);
      setStatementAry(transactions);
      renderTable();
    }

    renderTable();