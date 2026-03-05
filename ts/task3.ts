
interface Transaction {
    id?: string;
    date: string;   // ISO YYYY-MM-DD
    header: string;
    credit: number; // >= 0
    debit: number;  // >= 0
  }
  
  type PartialTxnForPatch = Partial<Omit<Transaction, 'id'>>;
  
  // ===== Constants =====
  const STATEMENT = 'txn_book_v1';
  const STATEMENT_NXTID = 'txn_book_next_id_v1';
  
  const nf = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
  
  // ===== Utilities =====
  function formatAmt(n?: number | null): string {
    if (!n || n === 0) return '';
    return nf.format(+n);
  }
  
  // Accepts YYYY-MM-DD; displays as DD-MMM-YYYY (e.g., 01-Jan-2026)
  function toDisplayDate(iso:string ):string {  
    if (!iso) return '';
    // Expect strictly "YYYY-MM-DD"
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
    if (!match) return '';
    const [, yStr, mStr, dStr] = match;
    const y = Number(yStr);
    const m = Number(mStr);
    const d = Number(dStr);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
  }
  
  // Encode HTML text node safely
  function escapeHtml(text: string): string {
    return (text || '').replace(/[&<>"']/g, (m) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      } as const)[m] as string
    );
  }
  
  // LocalStorage helpers
  function getStatementAry(): Transaction[] {
    try {
      return JSON.parse(localStorage.getItem(STATEMENT) || '[]') as Transaction[];
    } catch {
      return [];
    }
  }
  
  function setStatementAry(arr: Transaction[]): void {
    localStorage.setItem(STATEMENT, JSON.stringify(arr));
  }
  
  function getNextId(): string {
    const curr = localStorage.getItem(STATEMENT_NXTID);
    let n = parseInt(curr ?? '1', 10);
    if (!Number.isFinite(n) || n < 1) n = 1;
    localStorage.setItem(STATEMENT_NXTID, String(n + 1));
    return String(n);
  }
  
  function setNextIdIfMissing(arr: Transaction[]): void {
    if (!localStorage.getItem(STATEMENT_NXTID)) {
      const maxId = arr.reduce<number>((m, t) => Math.max(m, Number(t.id) || 0), 0);
      localStorage.setItem(STATEMENT_NXTID, String(maxId + 1));
    }
  }
  
  // ===== State =====
  let transactions: Transaction[] = []; // or: let transactions = getStatementAry();
  let editingId: string | null = null;
  
  // ===== DOM =====
  function byId<T extends HTMLElement>(id: string): T {
    const el = document.getElementById(id);
    if (!el) {
      throw new Error(`Element #${id} not found`);
    }
    return el as T;
  }
  
  const rowsBody = byId<HTMLTableSectionElement>('rowsBody');
  const totCreditEl = byId<HTMLElement>('totCredit');
  const totDebitEl = byId<HTMLElement>('totDebit');
  const balanceEl = byId<HTMLElement>('balance');
  
  const addDate = byId<HTMLInputElement>('addDate');
  const addHeader = byId<HTMLInputElement>('addHeader');
  const addCredit = byId<HTMLInputElement>('addCredit');
  const addDebit = byId<HTMLInputElement>('addDebit');
  
  const dateErr = byId<HTMLElement>('dateErr');
  const headerErr = byId<HTMLElement>('headerErr');
  const amountErr = byId<HTMLElement>('amountErr');
  const form = byId<HTMLFormElement>('addstate');
  const stateErr = byId<HTMLElement>('state-err');
  
  // ===== Network (JSON Server) =====
  const BASE_URL = 'http://localhost:3000';
  
  async function fetchStatements(): Promise<void> {
    try {
      const response = await fetch(`${BASE_URL}/statement`);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const stmts = (await response.json()) as Transaction[];
      transactions = stmts;
      // setStatementAry(transactions); // optional local cache
    } catch (error) {
      console.error('Error fetching statements:', error);
      stateErr.innerHTML = `<p style="color:red;">Failed to load statement, try again.</p>`;
      transactions = [];
    } finally {
      renderTable();
      setNextIdIfMissing(transactions);
    }
  }
  
  async function updateStatements(data: Transaction): Promise<Transaction> {
    const res = await fetch(`${BASE_URL}/statement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const created = (await res.json()) as Transaction;
    console.log('created', created);
    return created;
  }
  
  async function patchStatements(id: string, partial: PartialTxnForPatch): Promise<Transaction> {
    const res = await fetch(`${BASE_URL}/statement/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const updated = (await res.json()) as Transaction;
    console.log('updated', updated);
    return updated;
  }
  
  async function deleteStatements(id: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/statement/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  }
  
  // ===== Rendering =====
  function renderTable(): void {
    rowsBody.innerHTML = '';
  
    transactions.forEach((t, idx) => {
      const tr = document.createElement('tr');
  
      const tdIdx = document.createElement('td');
      tdIdx.textContent = String(idx + 1);
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
          saveSAVE</button>
          cancelCANCEL</button>
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
          editEDIT</button>
          removeREMOVE</button>
        `;
        tr.appendChild(tdActions);
      }
  
      rowsBody.appendChild(tr);
    });
  
    updateTotals();
  }
  
  function updateTotals(): void {
    const totalCredit = transactions.reduce((s, t) => s + (+t.credit || 0), 0);
    const totalDebit = transactions.reduce((s, t) => s + (+t.debit || 0), 0);
    const balance = totalCredit - totalDebit;
  
    totCreditEl.textContent = formatAmt(totalCredit);
    totDebitEl.textContent = formatAmt(totalDebit);
    balanceEl.textContent = formatAmt(balance);
  }
  
  // ===== Handlers =====
  function clearErrors(): void {
    dateErr.classList.add('d-none');
    headerErr.classList.add('d-none');
    amountErr.classList.add('d-none');
  }
  
  form.addEventListener('submit', async (event: SubmitEvent) => {
    clearErrors();
    event.preventDefault();
  
    const date = (addDate.value || '').trim();
    const header = (addHeader.value || '').trim();
    const credit = parseFloat(addCredit.value);
    const debit = parseFloat(addDebit.value);
  
    let valid = true;
  
    if (!date) { dateErr.classList.remove('d-none'); valid = false; }
    if (!header) { headerErr.classList.remove('d-none'); valid = false; }
  
    const creditValid = !Number.isNaN(credit) && credit > 0;
    const debitValid = !Number.isNaN(debit) && debit > 0;
  
    if ((creditValid && debitValid) || (!creditValid && !debitValid)) {
      amountErr.classList.remove('d-none');
      valid = false;
    }
  
    if (!valid) return;
  
    const newTxn: Transaction = {
      id: String(getNextId()),
      date,
      header,
      credit: creditValid ? +credit.toFixed(2) : 0,
      debit: debitValid ? +debit.toFixed(2) : 0,
    };
  
    transactions.push(newTxn);
    // setStatementAry(transactions);
  
    try {
      await updateStatements(newTxn);
    } catch (e) {
      console.error('POST failed, keeping local state only:', e);
    }
  
    addHeader.value = '';
    addCredit.value = '';
    addDebit.value = '';
    addHeader.focus();
    renderTable();
  });
  
  rowsBody.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    const btn = target?.closest('button[data-action]') as HTMLButtonElement | null;
    if (!btn) return;
  
    const action = btn.getAttribute('data-action');
    const id = btn.getAttribute('data-id');
  
    if (!action || !id) return;
  
    if (action === 'edit') {
      if (editingId !== null) return;
      editingId = id;
      renderTable();
    } else if (action === 'cancel') {
      editingId = null;
      renderTable();
    } else if (action === 'save') {
      handleSave(id);
    } else if (action === 'remove') {
      handleRemove(id);
    }
  });
  
  function handleSave(id: string): void {
    const edDate = (byId<HTMLInputElement>(`editDate-${id}`).value || '').trim();
    const edHeader = (byId<HTMLInputElement>(`editHeader-${id}`).value || '').trim();
    const edCredit = parseFloat(byId<HTMLInputElement>(`editCredit-${id}`).value);
    const edDebit = parseFloat(byId<HTMLInputElement>(`editDebit-${id}`).value);
  
    if (!edDate || !edHeader) {
      alert('Please fill Date and Header.');
      return;
    }
  
    const creditValid = !Number.isNaN(edCredit) && edCredit > 0;
    const debitValid = !Number.isNaN(edDebit) && edDebit > 0;
  
    if ((creditValid && debitValid) || (!creditValid && !debitValid)) {
      alert('Enter either Credit OR Debit (exactly one), greater than 0.');
      return;
    }
  
    const idx = transactions.findIndex((t) => t.id === id);
    if (idx !== -1) {
      const partial: PartialTxnForPatch = {
        date: edDate,
        header: edHeader,
        credit: creditValid ? +edCredit.toFixed(2) : 0,
        debit: debitValid ? +edDebit.toFixed(2) : 0,
      };
  
      
const prev = transactions[idx];
transactions[idx] = {
  ...prev,
  date:   partial.date   ?? prev!.date,
  header: partial.header ?? prev!.header,
  credit: partial.credit ?? prev!.credit,
  debit:  partial.debit  ?? prev!.debit,
  // id stays untouched (prev.id)
};

      // setStatementAry(transactions);
  
      // Fire and forget; you can await and add a spinner if needed
      void patchStatements(id, partial).catch((e) =>
        console.error('PATCH failed, local state updated anyway:', e)
      );
    }
  
    editingId = null;
    renderTable();
  }
  
  function handleRemove(id: string): void {
    if (!confirm('Remove this transaction?')) return;
    transactions = transactions.filter((t) => t.id !== id);
    // setStatementAry(transactions);
    void deleteStatements(id).catch((e) =>
      console.error('DELETE failed, local removal already applied:', e)
    );
    renderTable();
  }
  
  // ===== Init =====
  void fetchStatements();
  